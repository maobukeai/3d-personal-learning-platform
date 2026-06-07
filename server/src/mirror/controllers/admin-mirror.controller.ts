import { Prisma, MirrorResource } from '@prisma/client';
import { logger } from '../../utils/logger';
import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { syncEngine } from '../services/sync-engine.service';
import { mirrorService } from '../services/mirror.service';
import { thumbnailLocalizer } from '../services/thumbnail-localizer.service';
import prisma from '../../services/prisma';
import { readSheet } from 'read-excel-file/node';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { clampLimit, clampPage } from '../../utils/pagination';

type SpreadsheetRow = Record<string, string>;

const emptyInlineStringCellPattern =
  /<c\b(?=[^>]*\bt="inlineStr")(?=[^>]*\br="[^"]+")[^>]*>\s*<\/c>|<c\b(?=[^>]*\bt="inlineStr")(?=[^>]*\br="[^"]+")[^>]*\/>/g;

const sanitizeXlsxEmptyInlineStrings = (filePath: string): Buffer => {
  const archive = unzipSync(new Uint8Array(fs.readFileSync(filePath)));

  for (const [entryName, content] of Object.entries(archive)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/i.test(entryName)) continue;

    const xml = strFromU8(content);
    const cleanedXml = xml.replace(emptyInlineStringCellPattern, '');

    if (cleanedXml !== xml) {
      archive[entryName] = strToU8(cleanedXml);
    }
  }

  return Buffer.from(zipSync(archive));
};

const readSpreadsheetRows = async (filePath: string): Promise<SpreadsheetRow[]> => {
  let sheetRows;

  try {
    sheetRows = await readSheet(filePath);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Unsupported "inline string" cell value structure')
    ) {
      logger.warn(
        `[MirrorLinkMatch] Sanitizing empty inline string cells before reading ${path.basename(filePath)}`,
      );
      sheetRows = await readSheet(sanitizeXlsxEmptyInlineStrings(filePath));
    } else {
      throw error;
    }
  }

  const [headerRow, ...dataRows] = sheetRows;
  if (!headerRow) return [];

  const headers = headerRow.map((cell) => String(cell ?? '').trim());

  const rows: SpreadsheetRow[] = [];
  for (const row of dataRows) {
    const parsedRow: SpreadsheetRow = {};
    for (let columnIndex = 0; columnIndex < headers.length; columnIndex++) {
      const header = headers[columnIndex];
      if (!header) continue;

      const value = String(row[columnIndex] ?? '').trim();
      if (value) {
        parsedRow[header] = value;
      }
    }

    if (Object.keys(parsedRow).length > 0) {
      rows.push(parsedRow);
    }
  }

  return rows;
};

export const createSource = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      displayName,
      baseUrl,
      adapterType = 'ZYCKU',
      syncInterval = 3600,
      minPlanPriority = 1,
      syncConfig,
      iconUrl,
      description,
    } = req.body;

    if (!name || !displayName || !baseUrl) {
      return res.status(400).json({ error: 'name, displayName 和 baseUrl 为必填项' });
    }

    const existing = await prisma.mirrorSource.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: '镜像源名称已存在' });
    }

    const source = await prisma.mirrorSource.create({
      data: {
        name,
        displayName,
        baseUrl,
        adapterType,
        syncInterval,
        minPlanPriority,
        syncConfig: syncConfig ? JSON.stringify(syncConfig) : null,
        iconUrl,
        description,
      },
    });

    // Schedule the newly created source
    syncEngine.reloadSourceScheduler(source.id, source.status, source.syncInterval);

    res.status(201).json(source);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const updateSource = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const updateData: Record<string, any> = {};

    const allowedFields = [
      'name',
      'displayName',
      'baseUrl',
      'adapterType',
      'syncInterval',
      'minPlanPriority',
      'syncConfig',
      'iconUrl',
      'description',
      'status',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'syncConfig') {
          updateData[field] = JSON.stringify(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const source = await prisma.mirrorSource.update({
      where: { id },
      data: updateData as Prisma.MirrorSourceUpdateInput,
    });

    // Reload the scheduler with the updated status and interval
    syncEngine.reloadSourceScheduler(source.id, source.status, source.syncInterval);

    res.json(source);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const deleteSource = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    // Cancel any active sync task first
    syncEngine.cancelSync(id);

    // Unschedule the deleted source before database removal
    syncEngine.removeSourceScheduler(id);

    await prisma.$transaction([
      prisma.mirrorResourceComment.deleteMany({
        where: { resource: { sourceId: id } },
      }),
      prisma.mirrorResourceLike.deleteMany({
        where: { resource: { sourceId: id } },
      }),
      prisma.syncLog.deleteMany({ where: { sourceId: id } }),
      prisma.mirrorResource.deleteMany({ where: { sourceId: id } }),
      prisma.mirrorCategory.deleteMany({ where: { sourceId: id } }),
      prisma.mirrorSource.delete({ where: { id } }),
    ]);

    thumbnailLocalizer.deleteSourceFiles(id);

    res.json({ message: '镜像源已删除' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getAllSources = async (_req: AuthRequest, res: Response) => {
  try {
    const sources = await prisma.mirrorSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { resources: true, categories: true } },
      },
    });

    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getSourceDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const source = await prisma.mirrorSource.findUnique({
      where: { id },
      include: {
        _count: { select: { resources: true, categories: true } },
      },
    });

    if (!source) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    const latestSync = await prisma.syncLog.findFirst({
      where: { sourceId: id },
      orderBy: { startedAt: 'desc' },
    });

    res.json({ ...source, latestSync });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const triggerSync = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const type = ((req.query.type as string) || 'FULL') as 'FULL' | 'INCREMENTAL';

    const source = await prisma.mirrorSource.findUnique({ where: { id } });
    if (!source) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    if (syncEngine.isSyncing(id)) {
      return res.status(400).json({ error: '同步已在运行中，请等待完成' });
    }

    res.json({ message: '同步已触发，正在后台执行', type });

    try {
      if (type === 'INCREMENTAL') {
        await syncEngine.incrementalSync(id);
      } else {
        await syncEngine.fullSync(id);
      }
    } catch (e) {
      logger.error(`Sync failed for source ${id}:`, e instanceof Error ? e.message : e);
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const cancelSync = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!syncEngine.isSyncing(id)) {
      return res.status(400).json({ error: '没有正在运行的同步任务' });
    }

    syncEngine.cancelSync(id);
    res.json({ message: '同步已取消' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getSyncStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const isSyncing = syncEngine.isSyncing(id);
    const progress = syncEngine.getProgress(id);

    const source = await prisma.mirrorSource.findUnique({
      where: { id },
      select: { syncStatus: true, lastSyncAt: true, lastSyncDuration: true, totalResources: true },
    });

    res.json({
      isSyncing,
      ...source,
      progress: progress
        ? {
            type: progress.type,
            status: progress.status,
            currentCategory: progress.currentCategory,
            currentCategoryIndex: progress.currentCategoryIndex,
            totalCategories: progress.totalCategories,
            currentPage: progress.currentPage,
            resourcesFound: progress.resourcesFound,
            resourcesCreated: progress.resourcesCreated,
            resourcesUpdated: progress.resourcesUpdated,
            startedAt: progress.startedAt,
            estimatedProgress: progress.estimatedProgress,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getSyncLogs = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const limit = clampLimit(req.query.limit, 20, 100);

    const logs = await mirrorService.getSyncLogs(id, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const matchLinks = async (req: AuthRequest, res: Response) => {
  const filesArray: Express.Multer.File[] = [];

  if (req.file) {
    filesArray.push(req.file);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      filesArray.push(...req.files);
    } else {
      const dictionary = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (dictionary['file']) {
        filesArray.push(...dictionary['file']);
      }
      if (dictionary['files']) {
        filesArray.push(...dictionary['files']);
      }
    }
  }

  const cleanUpFiles = (filesList: Express.Multer.File[]) => {
    for (const f of filesList) {
      if (f.path && fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch (err) {
          logger.error(`Failed to delete temp file ${f.path}:`, err);
        }
      }
    }
  };

  try {
    const sourceId = req.params.id as string;

    if (filesArray.length === 0) {
      return res.status(400).json({ error: '请上传Excel文件' });
    }

    const unsupportedFile = filesArray.find(
      (file) => path.extname(file.originalname).toLowerCase() !== '.xlsx',
    );
    if (unsupportedFile) {
      cleanUpFiles(filesArray);
      return res.status(400).json({ error: '仅支持 .xlsx 文件' });
    }

    // Verify the mirror source exists
    const source = await prisma.mirrorSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) {
      cleanUpFiles(filesArray);
      return res.status(404).json({ error: '镜像源不存在' });
    }

    // Load all resources under this source to do clean in-memory name comparisons
    const resources = await prisma.mirrorResource.findMany({
      where: { sourceId },
    });

    const cleanString = (str: string) => {
      if (!str) return '';
      return str
        .replace(/\s+/g, '')
        .replace(/[()（）\-\_\s]/g, '')
        .toLowerCase();
    };

    const resourceByExternalId = new Map(resources.map((r) => [r.externalId, r]));
    const resourceByCleanTitle = new Map(resources.map((r) => [cleanString(r.title), r]));

    const updatesMap = new Map<string, { contentHtml: string; contentUrl: string }>();
    let totalLinks = 0;
    let matchedCount = 0;

    for (const file of filesArray) {
      const rawData = await readSpreadsheetRows(file.path);

      for (const row of rawData) {
        const courseName = (row['课程名称'] || row['名称'] || row['课程'] || '').toString().trim();
        const link = (row['链接'] || row['网盘链接'] || row['提取链接'] || '').toString().trim();
        const linkPassword = (row['链接密码'] || row['提取码'] || row['密码'] || '')
          .toString()
          .trim();
        const courseNotes = (row['课程备注'] || row['备注'] || '').toString().trim();

        if (!courseName && !courseNotes) continue;

        totalLinks++;

        let matchedResource: MirrorResource | null = null;

        // 1. Try matching by externalId extracted from the courseNotes URL
        if (courseNotes && courseNotes.startsWith('http')) {
          const match =
            courseNotes.match(/\/(\d+)\.html/i) ||
            courseNotes.match(/\/([a-zA-Z0-9_-]+)(?:\.html)?$/i);
          if (match && match[1]) {
            const externalId = match[1];
            matchedResource = resourceByExternalId.get(externalId) ?? null;
          }
        }

        // 2. If no match by URL, try matching by Title
        if (!matchedResource && courseName) {
          const exactMatch = resources.find((r) => r.title === courseName);
          if (exactMatch) {
            matchedResource = exactMatch;
          } else {
            const cleanName = cleanString(courseName);
            matchedResource = resourceByCleanTitle.get(cleanName) ?? null;
          }
        }

        if (matchedResource && link) {
          const driveName = link.includes('quark.cn')
            ? '夸克网盘'
            : link.includes('baidu.com')
              ? '百度网盘'
              : link.includes('alipan.com') || link.includes('aliyundrive.com')
                ? '阿里云盘'
                : link.includes('123pan.com')
                  ? '123云盘'
                  : '资源网盘';

          const manualLinkHtml = `
<!-- MANUAL_DOWNLOAD_LINK_START -->
<div class="manual-download-link-container" style="margin-top: 20px; padding: 15px; border: 1px dashed #409eff; border-radius: 8px; background-color: rgba(64, 158, 255, 0.05);">
  <h4 style="margin: 0 0 10px 0; color: #409eff; font-size: 16px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
    📁 提取资源链接 (${driveName})
  </h4>
  <p style="margin: 5px 0; font-size: 14px; color: #606266;">
    <strong>资源链接：</strong><a href="${link}" target="_blank" style="color: #409eff; text-decoration: underline; font-weight: 500;">点击跳转下载</a>
  </p>
  ${
    linkPassword
      ? `
  <p style="margin: 5px 0; font-size: 14px; color: #606266;">
    <strong>提取密码/访问码：</strong><span style="font-weight: bold; color: #f56c6c; select-all: all; background-color: #fef0f0; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde2e2;">${linkPassword}</span>
  </p>
  `
      : ''
  }
</div>
<!-- MANUAL_DOWNLOAD_LINK_END -->`;

          let currentHtml = matchedResource.contentHtml || '';
          const manualLinkRegex =
            /<!-- MANUAL_DOWNLOAD_LINK_START -->[\s\S]*?<!-- MANUAL_DOWNLOAD_LINK_END -->/g;

          if (manualLinkRegex.test(currentHtml)) {
            currentHtml = currentHtml.replace(manualLinkRegex, manualLinkHtml);
          } else {
            currentHtml = currentHtml + '\n' + manualLinkHtml;
          }

          // Update in-memory so subsequent rows/files see the updated HTML and URL
          matchedResource.contentHtml = currentHtml;
          matchedResource.contentUrl = link;

          updatesMap.set(matchedResource.id, {
            contentHtml: currentHtml,
            contentUrl: link,
          });
          matchedCount++;
        }
      }
    }

    if (updatesMap.size > 0) {
      const batchUpdates = Array.from(updatesMap.entries()).map(([id, data]) =>
        prisma.mirrorResource.update({
          where: { id },
          data,
        }),
      );
      await prisma.$transaction(batchUpdates);
    }

    logger.info(
      `[MirrorLinkMatch] Source ID: ${sourceId}, Excel uploaded. Found ${totalLinks} records, successfully matched and updated ${matchedCount} resources across ${filesArray.length} files.`,
    );

    cleanUpFiles(filesArray);

    res.json({
      message: `自动匹配完成！共在 ${filesArray.length} 个文件中发现 ${totalLinks} 条记录，成功匹配并更新 ${matchedCount} 个课程资源的提取链接。`,
      totalLinks,
      matchedCount,
    });
  } catch (error) {
    cleanUpFiles(filesArray);
    logger.error('[MirrorLinkMatch] Error matching links:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getSourceResources = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.sourceId as string;
    const page = clampPage(req.query.page);
    const pageSize = clampLimit(req.query.pageSize, 20, 100);
    const search = req.query.search as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;

    const where: Prisma.MirrorResourceWhereInput = { sourceId };
    if (search) {
      where.title = { contains: search };
    }
    if (categoryId) {
      const targetCategory = await prisma.mirrorCategory.findUnique({
        where: { id: categoryId },
        select: { externalId: true, sourceId: true },
      });
      if (targetCategory) {
        const childCategories = await prisma.mirrorCategory.findMany({
          where: {
            sourceId: targetCategory.sourceId,
            parentExternalId: targetCategory.externalId,
          },
          select: { id: true },
        });
        const categoryIds = [categoryId, ...childCategories.map((c) => c.id)];
        where.categoryId = { in: categoryIds };
      } else {
        where.categoryId = categoryId;
      }
    }

    const [resources, total] = await Promise.all([
      prisma.mirrorResource.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          contentUrl: true,
          resourceType: true,
          viewCount: true,
          publishedAt: true,
          categoryId: true,
          category: { select: { name: true } },
          tags: true,
          createdAt: true,
        },
      }),
      prisma.mirrorResource.count({ where }),
    ]);

    res.json({
      resources,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getResourceDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const resource = await prisma.mirrorResource.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
      },
    });

    if (!resource) {
      return res.status(404).json({ error: '资源不存在' });
    }

    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const createResource = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.sourceId as string;
    const {
      title,
      description,
      thumbnailUrl,
      contentUrl,
      tags,
      contentHtml,
      resourceType = 'COURSE',
      categoryId,
      externalId,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }

    const resource = await prisma.mirrorResource.create({
      data: {
        sourceId,
        externalId: externalId || `manual_${crypto.randomUUID()}`,
        title,
        description,
        thumbnailUrl,
        contentUrl,
        tags,
        contentHtml,
        resourceType,
        categoryId: categoryId || null,
      },
    });

    res.status(201).json(resource);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const updateResource = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const updateData: Record<string, any> = {};

    const allowedFields = [
      'title',
      'description',
      'thumbnailUrl',
      'contentUrl',
      'tags',
      'contentHtml',
      'resourceType',
      'categoryId',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'categoryId' && !req.body[field]) {
          updateData[field] = null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const resource = await prisma.mirrorResource.update({
      where: { id },
      data: updateData as Prisma.MirrorResourceUpdateInput,
    });

    res.json(resource);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const deleteResource = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    await prisma.$transaction([
      prisma.mirrorResourceComment.deleteMany({ where: { resourceId: id } }),
      prisma.mirrorResourceLike.deleteMany({ where: { resourceId: id } }),
      prisma.mirrorResource.delete({ where: { id } }),
    ]);

    res.json({ message: '资源已删除' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getSourceCategories = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.sourceId as string;
    const categories = await prisma.mirrorCategory.findMany({
      where: { sourceId },
      orderBy: { order: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getCategoryDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const category = await prisma.mirrorCategory.findUnique({
      where: { id },
    });
    if (!category) {
      return res.status(404).json({ error: '分类不存在' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.sourceId as string;
    const { name, slug, parentExternalId, order = 0, childExternalIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name 为必填项' });
    }

    const category = await prisma.mirrorCategory.create({
      data: {
        sourceId,
        externalId: `manual_cat_${crypto.randomUUID()}`,
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        parentExternalId: parentExternalId || null,
        order: typeof order === 'number' ? order : parseInt(String(order)) || 0,
      },
    });

    if (childExternalIds && Array.isArray(childExternalIds) && childExternalIds.length > 0) {
      await prisma.mirrorCategory.updateMany({
        where: {
          externalId: { in: childExternalIds },
          sourceId,
        },
        data: {
          parentExternalId: category.externalId,
        },
      });
    }

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, slug, parentExternalId, order, childExternalIds } = req.body;

    const updateData: Prisma.MirrorCategoryUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (parentExternalId !== undefined) updateData.parentExternalId = parentExternalId;
    if (order !== undefined)
      updateData.order = typeof order === 'number' ? order : parseInt(String(order)) || 0;

    const category = await prisma.mirrorCategory.update({
      where: { id },
      data: updateData,
    });

    if (childExternalIds && Array.isArray(childExternalIds)) {
      // 1. Reset parentExternalId to null for current children that are not in the new childExternalIds list
      await prisma.mirrorCategory.updateMany({
        where: {
          sourceId: category.sourceId,
          parentExternalId: category.externalId,
          externalId: { notIn: childExternalIds },
        },
        data: {
          parentExternalId: null,
        },
      });

      // 2. Set parentExternalId to category.externalId for the selected children
      await prisma.mirrorCategory.updateMany({
        where: {
          sourceId: category.sourceId,
          externalId: { in: childExternalIds },
        },
        data: {
          parentExternalId: category.externalId,
        },
      });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    await prisma.mirrorCategory.delete({
      where: { id },
    });

    res.json({ message: '分类已删除' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const uploadImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的图片文件' });
    }
    const relativePath = `/uploads/mirror/${req.file.filename}`;
    res.json({ url: relativePath });
  } catch (_error) {
    res.status(500).json({ error: '图片上传失败' });
  }
};

// --- MIRROR IMPORT / EXPORT IMPLEMENTATION ---

interface ImportTask {
  id: string;
  progress: number;
  status: 'extracting' | 'importing_metadata' | 'copying_files' | 'completed' | 'failed';
  totalSteps: number;
  currentStep: number;
  message: string;
  error?: string;
}

const importTasks = new Map<string, ImportTask>();

// Cleanup old import tasks every 30 minutes to prevent memory leaks
const startImportTaskCleanup = () => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const cleanupTimer = setInterval(
    () => {
      // Clear all tasks (for simple in-memory cache, keeping the active or recent ones is enough)
      if (importTasks.size > 100) {
        importTasks.clear();
      }
    },
    30 * 60 * 1000,
  );

  cleanupTimer.unref?.();
};

startImportTaskCleanup();

export const exportSource = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const exportFull = req.query.full === 'true';

  let headersSent = false;

  try {
    const source = await prisma.mirrorSource.findUnique({
      where: { id },
    });

    if (!source) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    const categories = await prisma.mirrorCategory.findMany({
      where: { sourceId: id },
    });

    const resources = await prisma.mirrorResource.findMany({
      where: { sourceId: id },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.externalId]));

    const metadata = {
      version: '1.0',
      source: {
        id: source.id,
        name: source.name,
        displayName: source.displayName,
        baseUrl: source.baseUrl,
        adapterType: source.adapterType,
        status: source.status,
        syncStatus: 'IDLE',
        syncInterval: source.syncInterval,
        syncConfig: source.syncConfig,
        minPlanPriority: source.minPlanPriority,
        iconUrl: source.iconUrl,
        description: source.description,
      },
      categories: categories.map((c) => ({
        externalId: c.externalId,
        name: c.name,
        slug: c.slug,
        parentExternalId: c.parentExternalId,
        order: c.order,
        resourceCount: c.resourceCount,
      })),
      resources: resources.map((r) => ({
        externalId: r.externalId,
        categoryExternalId: r.categoryId ? categoryMap.get(r.categoryId) : null,
        title: r.title,
        description: r.description,
        thumbnailUrl: r.thumbnailUrl,
        contentUrl: r.contentUrl,
        tags: r.tags,
        externalData: r.externalData,
        contentHtml: r.contentHtml,
        resourceType: r.resourceType,
        viewCount: r.viewCount,
        publishedAt:
          r.publishedAt && !isNaN(r.publishedAt.getTime()) ? r.publishedAt.toISOString() : null,
        contentHash: r.contentHash,
      })),
    };

    // Collect all referenced local image files
    const referencedFiles = new Set<string>();
    for (const r of resources) {
      if (r.thumbnailUrl && r.thumbnailUrl.startsWith(`/uploads/mirror/${id}/`)) {
        referencedFiles.add(path.basename(r.thumbnailUrl));
      }
      if (exportFull && r.contentHtml && r.contentHtml.includes(`/uploads/mirror/${id}/`)) {
        const regex = new RegExp(`/uploads/mirror/${id}/([^"'\\s>)]+)`, 'g');
        let match;
        while ((match = regex.exec(r.contentHtml)) !== null) {
          if (match[1]) {
            const part = match[1].split(/[?#]/)[0];
            if (part) referencedFiles.add(path.basename(part));
          }
        }
      }
    }

    // --- Streaming ZIP response using archiver ---
    const safeFilename = encodeURIComponent(`${source.name}-mirror-export.zip`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    );
    // Disable Express response buffering so bytes flow immediately
    res.setHeader('Transfer-Encoding', 'chunked');
    headersSent = true;

    const archive = archiver('zip', {
      // Store mode: no CPU-intensive compression for binary images
      zlib: { level: 0 },
    });

    // Pipe archive data directly to the response stream
    archive.pipe(res);

    // Handle archiver errors
    archive.on('error', (err) => {
      logger.error('[ExportMirror] Archiver error:', err);
      // Can't send error JSON once headers are sent; just destroy the response
      res.destroy(err);
    });

    // 1. Append metadata.json as a buffer
    archive.append(Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'), {
      name: 'metadata.json',
    });

    // 2. Append source icon if stored locally
    if (source.iconUrl && source.iconUrl.startsWith('/uploads/mirror/')) {
      const iconFilename = path.basename(source.iconUrl);
      const iconPath = path.join(process.cwd(), 'uploads', 'mirror', iconFilename);
      if (fs.existsSync(iconPath)) {
        archive.file(iconPath, { name: `icon/${iconFilename}` });
      }
    }

    // 3. Stream each referenced image file (no full read into RAM)
    const sourceDir = path.join(process.cwd(), 'uploads', 'mirror', id);
    if (fs.existsSync(sourceDir)) {
      for (const filename of referencedFiles) {
        const filePath = path.join(sourceDir, filename);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          archive.file(filePath, { name: `files/${filename}` });
        }
      }
    }

    // Finalize: flushes all pending entries and ends the stream
    await archive.finalize();

    logger.info(
      `[ExportMirror] Streamed export for source ${id} (${exportFull ? 'full' : 'lite'}) ` +
        `- ${referencedFiles.size} image(s), ${resources.length} resource(s)`,
    );
  } catch (error) {
    logger.error('[ExportMirror] Failed to export mirror source:', error);
    if (!headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
    } else {
      res.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  }
};

export const importSource = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要导入的 ZIP 压缩包文件' });
    }

    const zipFilePath = req.file.path;
    const taskId = crypto.randomUUID();

    // Initialize task state
    importTasks.set(taskId, {
      id: taskId,
      progress: 0,
      status: 'extracting',
      totalSteps: 100,
      currentStep: 0,
      message: '正在解压缩文件...',
    });

    res.json({ taskId });

    // Execute in background
    runImportInBackground(taskId, zipFilePath).catch((err) => {
      logger.error(`[ImportMirror] Background import failed:`, err);
    });
  } catch (error) {
    logger.error('[ImportMirror] Failed to start import:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const getImportStatus = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    const task = importTasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: '找不到该导入任务' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

export const cleanupSourceImages = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const source = await prisma.mirrorSource.findUnique({
      where: { id },
    });

    if (!source) {
      return res.status(404).json({ error: '镜像源不存在' });
    }

    const { deletedCount, savedBytes } = await thumbnailLocalizer.cleanupOrphanedImages(id);
    res.json({
      success: true,
      deletedCount,
      savedBytes,
      savedMegabytes: Number((savedBytes / 1024 / 1024).toFixed(2)),
    });
  } catch (error) {
    logger.error('[CleanupMirror] Failed to cleanup mirror source images:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'An error occurred' });
  }
};

const runImportInBackground = async (taskId: string, zipFilePath: string) => {
  const task = importTasks.get(taskId);
  if (!task) return;

  try {
    const archive = unzipSync(new Uint8Array(fs.readFileSync(zipFilePath)));
    const metadataU8 = archive['metadata.json'];
    if (!metadataU8) {
      throw new Error('ZIP 归档中找不到 metadata.json，文件格式无效');
    }

    task.status = 'importing_metadata';
    task.message = '正在解析元数据...';
    task.progress = 5;

    const metadata = JSON.parse(strFromU8(metadataU8!));
    const { source, categories = [], resources = [] } = metadata;

    if (!source || !source.name || !source.displayName || !source.baseUrl) {
      throw new Error(
        'metadata.json 缺失必要镜像源字段名称 (name)、显示名称 (displayName) 或 baseUrl',
      );
    }

    const sourceName = source.name;

    // Check if duplicate source name exists
    const existingSource = await prisma.mirrorSource.findUnique({
      where: { name: sourceName },
    });

    let targetSourceId = '';
    const filesToExtract = Object.keys(archive).filter(
      (k) => k.startsWith('files/') && k !== 'files/',
    );
    const totalCategories = categories.length;
    const totalResources = resources.length;

    // Total steps calculation
    const totalSteps =
      1 + totalCategories + Math.ceil(totalResources / 100) + filesToExtract.length;
    task.totalSteps = totalSteps;
    task.currentStep = 0;

    // If source exists, we overwrite it in database
    if (existingSource) {
      targetSourceId = existingSource.id;
      task.message = `正在覆盖已存在的镜像源「${sourceName}」...`;

      // Stop and cancel scheduler
      syncEngine.cancelSync(targetSourceId);

      await prisma.$transaction([
        prisma.mirrorResourceComment.deleteMany({
          where: { resource: { sourceId: targetSourceId } },
        }),
        prisma.mirrorResourceLike.deleteMany({
          where: { resource: { sourceId: targetSourceId } },
        }),
        prisma.syncLog.deleteMany({ where: { sourceId: targetSourceId } }),
        prisma.mirrorResource.deleteMany({ where: { sourceId: targetSourceId } }),
        prisma.mirrorCategory.deleteMany({ where: { sourceId: targetSourceId } }),
        prisma.mirrorSource.update({
          where: { id: targetSourceId },
          data: {
            displayName: source.displayName,
            baseUrl: source.baseUrl,
            adapterType: source.adapterType,
            status: source.status,
            syncStatus: 'IDLE',
            syncInterval: source.syncInterval,
            syncConfig: source.syncConfig,
            minPlanPriority: source.minPlanPriority,
            iconUrl: source.iconUrl,
            description: source.description,
          },
        }),
      ]);
    } else {
      task.message = `正在创建新镜像源「${sourceName}」...`;
      const newSource = await prisma.mirrorSource.create({
        data: {
          name: source.name,
          displayName: source.displayName,
          baseUrl: source.baseUrl,
          adapterType: source.adapterType,
          status: source.status,
          syncStatus: 'IDLE',
          syncInterval: source.syncInterval,
          syncConfig: source.syncConfig,
          minPlanPriority: source.minPlanPriority,
          iconUrl: source.iconUrl,
          description: source.description,
        },
      });
      targetSourceId = newSource.id;
    }

    task.currentStep++;
    task.progress = Math.round((task.currentStep / task.totalSteps) * 95);

    // Re-extract local custom icon if bundled
    let importedIconUrl = source.iconUrl;
    const iconEntry = Object.keys(archive).find((k) => k.startsWith('icon/') && k !== 'icon/');
    if (iconEntry) {
      const iconFilename = path.basename(iconEntry);
      const iconDestDir = path.join(process.cwd(), 'uploads', 'mirror');
      if (!fs.existsSync(iconDestDir)) {
        fs.mkdirSync(iconDestDir, { recursive: true });
      }
      fs.writeFileSync(path.join(iconDestDir, iconFilename), Buffer.from(archive[iconEntry]!));
      importedIconUrl = `/uploads/mirror/${iconFilename}`;

      await prisma.mirrorSource.update({
        where: { id: targetSourceId },
        data: { iconUrl: importedIconUrl },
      });
    }

    // Extract localized files
    task.status = 'copying_files';
    task.message = '正在复制本地附件图片...';
    const filesDestDir = path.join(process.cwd(), 'uploads', 'mirror', targetSourceId);
    if (!fs.existsSync(filesDestDir)) {
      fs.mkdirSync(filesDestDir, { recursive: true });
    }

    for (const fileEntry of filesToExtract) {
      const filename = path.basename(fileEntry);
      fs.writeFileSync(path.join(filesDestDir, filename), Buffer.from(archive[fileEntry]!));
      task.currentStep++;
      task.progress = Math.round((task.currentStep / task.totalSteps) * 95);
    }

    // Import MirrorCategory structure
    task.status = 'importing_metadata';
    const categoryMap = new Map<string, string>();
    const pendingCats = [...categories];
    let insertedInLoop = true;

    // First pass to resolve parent categories properly
    while (pendingCats.length > 0 && insertedInLoop) {
      insertedInLoop = false;
      for (let i = 0; i < pendingCats.length; i++) {
        const cat = pendingCats[i];
        if (!cat.parentExternalId || categoryMap.has(cat.parentExternalId)) {
          task.message = `正在导入分类: ${cat.name}...`;
          const createdCat = await prisma.mirrorCategory.create({
            data: {
              sourceId: targetSourceId,
              externalId: cat.externalId,
              name: cat.name,
              slug: cat.slug,
              parentExternalId: cat.parentExternalId,
              order: cat.order ?? 0,
              resourceCount: cat.resourceCount ?? 0,
            },
          });
          categoryMap.set(cat.externalId, createdCat.id);
          pendingCats.splice(i, 1);
          i--;
          insertedInLoop = true;

          task.currentStep++;
          task.progress = Math.round((task.currentStep / task.totalSteps) * 95);
        }
      }
    }

    // Secondary pass for fallback categories
    for (const cat of pendingCats) {
      task.message = `正在导入分类: ${cat.name}...`;
      const createdCat = await prisma.mirrorCategory.create({
        data: {
          sourceId: targetSourceId,
          externalId: cat.externalId,
          name: cat.name,
          slug: cat.slug,
          parentExternalId: null,
          order: cat.order ?? 0,
          resourceCount: cat.resourceCount ?? 0,
        },
      });
      categoryMap.set(cat.externalId, createdCat.id);

      task.currentStep++;
      task.progress = Math.round((task.currentStep / task.totalSteps) * 95);
    }

    // Import MirrorResource in batches
    let oldSourceId = source.id;
    if (!oldSourceId) {
      // Fallback: Extract oldSourceId from the first resource with a localized URL
      const sampleLocalizedRes = resources.find(
        (r: any) => r.thumbnailUrl && r.thumbnailUrl.startsWith('/uploads/mirror/'),
      );
      if (sampleLocalizedRes) {
        const parts = sampleLocalizedRes.thumbnailUrl.split('/');
        if (parts[3]) {
          oldSourceId = parts[3];
        }
      }
    }
    const batchSize = 100;
    for (let i = 0; i < resources.length; i += batchSize) {
      const batch = resources.slice(i, i + batchSize);
      task.message = `正在导入镜像资源 (${i + 1} - ${Math.min(i + batchSize, resources.length)} / ${resources.length})...`;

      const insertData = batch.map((r: any) => {
        let thumbnailUrl = r.thumbnailUrl;
        if (
          thumbnailUrl &&
          oldSourceId &&
          thumbnailUrl.includes(`/uploads/mirror/${oldSourceId}/`)
        ) {
          thumbnailUrl = thumbnailUrl.replace(
            `/uploads/mirror/${oldSourceId}/`,
            `/uploads/mirror/${targetSourceId}/`,
          );
        }

        let contentHtml = r.contentHtml;
        if (contentHtml && oldSourceId && contentHtml.includes(`/uploads/mirror/${oldSourceId}/`)) {
          const regex = new RegExp(`/uploads/mirror/${oldSourceId}/`, 'g');
          contentHtml = contentHtml.replace(regex, `/uploads/mirror/${targetSourceId}/`);
        }

        return {
          sourceId: targetSourceId,
          externalId: r.externalId,
          categoryId: r.categoryExternalId ? categoryMap.get(r.categoryExternalId) || null : null,
          title: r.title,
          description: r.description,
          thumbnailUrl,
          contentUrl: r.contentUrl,
          tags: r.tags,
          externalData: r.externalData,
          contentHtml,
          resourceType: r.resourceType ?? 'COURSE',
          viewCount: r.viewCount ?? 0,
          publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
          contentHash: r.contentHash,
        };
      });

      await prisma.mirrorResource.createMany({
        data: insertData,
      });

      task.currentStep++;
      task.progress = Math.round((task.currentStep / task.totalSteps) * 95);
    }

    // Refresh synchronization source in sync scheduler
    const finalSource = await prisma.mirrorSource.findUnique({ where: { id: targetSourceId } });
    if (finalSource) {
      syncEngine.reloadSourceScheduler(
        finalSource.id,
        finalSource.status,
        finalSource.syncInterval,
      );
    }

    task.progress = 100;
    task.status = 'completed';
    task.message = '导入成功！';

    // Delete temp ZIP
    if (fs.existsSync(zipFilePath)) {
      fs.unlinkSync(zipFilePath);
    }
  } catch (err) {
    logger.error('[ImportMirrorBackground] Error importing mirror archive:', err);
    task.status = 'failed';
    task.error = err instanceof Error ? err.message : '未知导入错误';
    task.message = '导入失败，请检查压缩包内容是否完整。';

    if (fs.existsSync(zipFilePath)) {
      try {
        fs.unlinkSync(zipFilePath);
      } catch (unlinkErr) {
        logger.error('Failed to unlink uploaded ZIP:', unlinkErr);
      }
    }
  }
};

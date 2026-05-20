import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { syncEngine } from '../services/sync-engine.service';
import { mirrorService } from '../services/mirror.service';
import { thumbnailLocalizer } from '../services/thumbnail-localizer.service';
import prisma from '../../services/prisma';
import * as xlsx from 'xlsx';
import fs from 'fs';

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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSource = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const updateData: any = {};

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
      data: updateData,
    });

    // Reload the scheduler with the updated status and interval
    syncEngine.reloadSourceScheduler(source.id, source.status, source.syncInterval);

    res.json(source);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    } catch (e: any) {
      console.error(`Sync failed for source ${id}:`, e.message);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSyncLogs = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 20;

    const logs = await mirrorService.getSyncLogs(id, limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const matchLinks = async (req: AuthRequest, res: Response) => {
  try {
    const sourceId = req.params.id as string;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '请上传Excel文件' });
    }

    // Verify the mirror source exists
    const source = await prisma.mirrorSource.findUnique({
      where: { id: sourceId }
    });
    if (!source) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(404).json({ error: '镜像源不存在' });
    }

    // Parse Excel file
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({ error: 'Excel文件没有工作表' });
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({ error: 'Excel文件为空' });
    }

    // Convert sheet to JSON array
    const rawData = xlsx.utils.sheet_to_json<any>(worksheet);

    let totalLinks = 0;
    let matchedCount = 0;

    // Load all resources under this source to do clean in-memory name comparisons
    const resources = await prisma.mirrorResource.findMany({
      where: { sourceId }
    });

    const cleanString = (str: string) => {
      if (!str) return '';
      return str
        .replace(/\s+/g, '')
        .replace(/[()（）\-\_\s]/g, '')
        .toLowerCase();
    };

    const resourceByExternalId = new Map(resources.map(r => [r.externalId, r]));
    const resourceByCleanTitle = new Map(resources.map(r => [cleanString(r.title), r]));

    const batchUpdates = [];

    for (const row of rawData) {
      const courseName = (row['课程名称'] || row['名称'] || row['课程'] || '').toString().trim();
      const link = (row['链接'] || row['网盘链接'] || row['提取链接'] || '').toString().trim();
      const linkPassword = (row['链接密码'] || row['提取码'] || row['密码'] || '').toString().trim();
      const courseNotes = (row['课程备注'] || row['备注'] || '').toString().trim();

      if (!courseName && !courseNotes) continue;

      totalLinks++;

      let matchedResource: any = null;

      // 1. Try matching by externalId extracted from the courseNotes URL
      if (courseNotes && courseNotes.startsWith('http')) {
        const match = courseNotes.match(/\/(\d+)\.html/i) || courseNotes.match(/\/([a-zA-Z0-9_-]+)(?:\.html)?$/i);
        if (match && match[1]) {
          const externalId = match[1];
          matchedResource = resourceByExternalId.get(externalId);
        }
      }

      // 2. If no match by URL, try matching by Title
      if (!matchedResource && courseName) {
        const exactMatch = resources.find(r => r.title === courseName);
        if (exactMatch) {
          matchedResource = exactMatch;
        } else {
          const cleanName = cleanString(courseName);
          matchedResource = resourceByCleanTitle.get(cleanName);
        }
      }

      if (matchedResource && link) {
        const driveName = link.includes('quark.cn') ? '夸克网盘' :
                          link.includes('baidu.com') ? '百度网盘' :
                          link.includes('alipan.com') || link.includes('aliyundrive.com') ? '阿里云盘' :
                          link.includes('123pan.com') ? '123云盘' : '资源网盘';

        const manualLinkHtml = `
<!-- MANUAL_DOWNLOAD_LINK_START -->
<div class="manual-download-link-container" style="margin-top: 20px; padding: 15px; border: 1px dashed #409eff; border-radius: 8px; background-color: rgba(64, 158, 255, 0.05);">
  <h4 style="margin: 0 0 10px 0; color: #409eff; font-size: 16px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
    📁 提取资源链接 (${driveName})
  </h4>
  <p style="margin: 5px 0; font-size: 14px; color: #606266;">
    <strong>资源链接：</strong><a href="${link}" target="_blank" style="color: #409eff; text-decoration: underline; font-weight: 500;">点击跳转下载</a>
  </p>
  ${linkPassword ? `
  <p style="margin: 5px 0; font-size: 14px; color: #606266;">
    <strong>提取密码/访问码：</strong><span style="font-weight: bold; color: #f56c6c; select-all: all; background-color: #fef0f0; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde2e2;">${linkPassword}</span>
  </p>
  ` : ''}
</div>
<!-- MANUAL_DOWNLOAD_LINK_END -->`;

        let currentHtml = matchedResource.contentHtml || '';
        const manualLinkRegex = /<!-- MANUAL_DOWNLOAD_LINK_START -->[\s\S]*?<!-- MANUAL_DOWNLOAD_LINK_END -->/g;

        if (manualLinkRegex.test(currentHtml)) {
          currentHtml = currentHtml.replace(manualLinkRegex, manualLinkHtml);
        } else {
          currentHtml = currentHtml + '\n' + manualLinkHtml;
        }

        batchUpdates.push(
          prisma.mirrorResource.update({
            where: { id: matchedResource.id },
            data: {
              contentHtml: currentHtml,
              contentUrl: link
            }
          })
        );
        matchedCount++;
      }
    }

    if (batchUpdates.length > 0) {
      await prisma.$transaction(batchUpdates);
    }

    console.log(`[MirrorLinkMatch] Source ID: ${sourceId}, Excel uploaded. Found ${totalLinks} records, successfully matched and updated ${matchedCount} resources.`);

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.json({
      message: `自动匹配完成！共发现 ${totalLinks} 条记录，成功匹配并更新 ${matchedCount} 个课程资源的提取链接。`,
      totalLinks,
      matchedCount
    });

  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('[MirrorLinkMatch] Error matching links:', error);
    res.status(500).json({ error: error.message });
  }
};

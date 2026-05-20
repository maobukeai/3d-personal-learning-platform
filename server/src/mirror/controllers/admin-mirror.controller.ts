import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { syncEngine } from '../services/sync-engine.service';
import { mirrorService } from '../services/mirror.service';
import { thumbnailLocalizer } from '../services/thumbnail-localizer.service';
import prisma from '../../services/prisma';

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

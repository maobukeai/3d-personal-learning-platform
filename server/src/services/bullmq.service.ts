import { Queue, Worker, Job as BullJob } from 'bullmq';
import { redisService } from './redis.service';
import { logger } from '../utils/logger';
import prisma from './prisma';
import { emitToAll, emitToUser } from './socket.service';
import { syncEngine } from '../mirror/services/sync-engine.service';
import { thumbnailLocalizer } from '../mirror/services/thumbnail-localizer.service';
import { UploadedFile } from '../types/upload';
import { storageService } from './storage.service';
import { decryptSecretIfNeeded } from '../utils/crypto';
import type { JobHandler } from './jobWorker';
import sharp from 'sharp';

/**
 * Emit job progress to the owning user if known, otherwise broadcast to all.
 * userId is passed through the BullMQ job data (set at enqueue time) so the
 * worker can target the socket emission without a DB lookup.
 */
function emitJobProgress(userId: string | undefined, data: Record<string, unknown>) {
  if (userId) {
    emitToUser(userId, 'job_progress', data);
  } else {
    emitToAll('job_progress', data);
  }
}

// compressGltfDraco lives in utils/draco-compressor.ts to avoid a circular
// dependency between this service and asset-processor.ts, and to keep the
// heavy gltf-pipeline module out of worker_threads that don't need it.
// Re-exported here for backward compatibility with any legacy callers.
export { compressGltfDraco } from '../utils/draco-compressor';

let taskQueue: Queue | null = null;
let taskWorker: Worker | null = null;
let queueConnection: any = null;
let workerConnection: any = null;

export const BULLMQ_QUEUE_NAME = 'task-queue';

/**
 * Image/Texture downsampling.
 * Operates on a buffer and returns a new buffer — no local file IO.
 */
export async function downsampleImage(
  buffer: Buffer,
  maxWidth = 1024,
  maxHeight = 1024,
): Promise<Buffer> {
  if (!buffer) {
    throw new Error('downsampleImage: buffer is required');
  }
  return sharp(buffer)
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer();
}

/**
 * Initialize BullMQ Queue and Worker.
 */
export function initBullMQ() {
  if (!redisService.isRedisEnabled) {
    logger.info('[BullMQ] Redis is not enabled/connected. Skipping BullMQ initialization.');
    return;
  }

  if (taskQueue) return;

  logger.info('[BullMQ] Initializing BullMQ Queue and Worker...');

  queueConnection = redisService.getNewRedisConnection();
  queueConnection.on('error', (err: any) => {
    logger.warn(`[BullMQ] Redis Queue Connection error: ${err.message}`);
  });

  taskQueue = new Queue(BULLMQ_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  taskWorker = new Worker(
    BULLMQ_QUEUE_NAME,
    async (bullJob: BullJob) => {
      const { jobId, payload, type, userId } = bullJob.data;
      logger.info(`[BullMQ Worker] Starting job ${jobId} of type "${type}"`);

      // Check if job is already cancelled in DB
      const existingJob = await prisma.job.findUnique({ where: { id: jobId } });
      if (!existingJob || existingJob.status === 'CANCELLED') {
        logger.info(
          `[BullMQ Worker] Job ${jobId} was already cancelled. Aborting worker execution.`,
        );
        return;
      }

      // 1. Update status to RUNNING in database
      const dbJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      // Broadcast running status
      emitJobProgress(userId, {
        jobId,
        progress: dbJob.progress,
        status: 'RUNNING',
      });

      let result: unknown;

      // 2. Perform the appropriate operation based on type
      if (type === 'mirror-sync') {
        const { sourceId, syncType } = payload;
        const interval = setInterval(async () => {
          try {
            const progressObj = syncEngine.getProgress(sourceId);
            if (progressObj) {
              const pct = progressObj.estimatedProgress ?? 0;
              await prisma.job.update({
                where: { id: jobId },
                data: { progress: Math.floor(pct) },
              });
              emitJobProgress(userId, {
                jobId,
                progress: Math.floor(pct),
                status: 'RUNNING',
              });
            }
          } catch (err) {
            logger.error(
              `[BullMQ Worker] Error updating mirror-sync progress for job ${jobId}:`,
              err,
            );
          }
        }, 2000);

        try {
          if (syncType === 'INCREMENTAL') {
            result = await syncEngine.incrementalSync(sourceId, true);
          } else {
            result = await syncEngine.fullSync(sourceId, true);
          }
        } finally {
          clearInterval(interval);
        }
      } else if (type === 'draco-compression') {
        const { buffer: bufferB64, ext, assetId, file, versionId } = payload;
        const { processFull3DOptimization } = require('../utils/asset-processor');
        const uploadedFile = file as UploadedFile | null;

        // P5：纯内存 Buffer 化 —— 接受 base64 编码的 buffer + ext，不再依赖临时文件路径。
        // 外部链接 / 无文件上传没有 buffer 可处理。
        if (!bufferB64) {
          result = { success: true, skipped: true };
        } else {
          const inputBuffer = Buffer.from(bufferB64, 'base64');
          const inputExt = ext || '.glb';

          // 1. Run unified 3D optimization pipeline (optimize + Draco + analyze) —— 纯内存
          const optimizationResult = await processFull3DOptimization(inputBuffer, inputExt);

          // 2. 5MB post-compression hard gate
          const MAX_COMPRESSED_SIZE_BYTES = 5 * 1024 * 1024;
          if (optimizationResult.compressedSizeBytes > MAX_COMPRESSED_SIZE_BYTES) {
            await prisma.asset.update({
              where: { id: assetId },
              data: {
                status: 'REJECTED',
                rejectReason: `压缩后文件大小 ${(optimizationResult.compressedSizeBytes / 1024 / 1024).toFixed(2)}MB 超过 5MB 限制`,
              },
            });
            logger.warn(
              `[BullMQ Worker] Asset ${assetId} rejected: compressed size ${optimizationResult.compressedSizeBytes} bytes exceeds 5MB`,
            );
            result = {
              success: false,
              rejected: true,
              reason: 'compressed size exceeds 5MB',
            };
          } else {
            // 3. Upload compressed buffer to R2 (overwrites original key)
            if (uploadedFile && uploadedFile.r2ConfigId && uploadedFile.r2Key) {
              const config = await prisma.storageConfig.findUnique({
                where: { id: uploadedFile.r2ConfigId },
              });
              if (!config) {
                throw new Error(
                  `R2 storage config ${uploadedFile.r2ConfigId} not found for asset ${assetId}`,
                );
              }
              const newUrl = await storageService.uploadBuffer(
                {
                  endpoint: config.endpoint,
                  accessKeyId: config.accessKeyId,
                  secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
                  bucketName: config.bucketName,
                  publicUrl: config.publicUrl,
                },
                optimizationResult.buffer,
                uploadedFile.r2Key,
                uploadedFile.mimetype || 'model/gltf-binary',
              );

              const sizeMB = parseFloat(
                (optimizationResult.compressedSizeBytes / (1024 * 1024)).toFixed(2),
              );
              if (versionId) {
                await prisma.assetVersion.update({
                  where: { id: versionId },
                  data: {
                    ...(optimizationResult.analysis || {}),
                    url: newUrl,
                    size: sizeMB,
                  },
                });
              }
              await prisma.asset.update({
                where: { id: assetId },
                data: {
                  ...(optimizationResult.analysis || {}),
                  url: newUrl,
                  size: sizeMB,
                },
              });
              logger.info(
                `[BullMQ Worker] Asset ${assetId} optimized and uploaded to R2 (${sizeMB}MB)`,
              );
            } else if (uploadedFile) {
              // File was provided but lacks R2 config — fail loudly per governance policy.
              throw new Error('R2 storage configuration missing for asset');
            } else {
              // No UploadedFile (e.g. R2 webhook triggered): update metadata + size only.
              const sizeMB = parseFloat(
                (optimizationResult.compressedSizeBytes / (1024 * 1024)).toFixed(2),
              );
              if (versionId) {
                await prisma.assetVersion.update({
                  where: { id: versionId },
                  data: { ...(optimizationResult.analysis || {}), size: sizeMB },
                });
              }
              await prisma.asset.update({
                where: { id: assetId },
                data: { ...(optimizationResult.analysis || {}), size: sizeMB },
              });
              logger.info(
                `[BullMQ Worker] Asset ${assetId} optimized (no R2 config, metadata updated only)`,
              );
            }
            result = { success: true, ...(optimizationResult.analysis || {}) };
          }
        }
      } else if (type === 'thumbnail-localize') {
        const { htmlContent, sourceId } = payload;
        try {
          const localizedHtml = await thumbnailLocalizer.localizeHtmlContent(htmlContent, sourceId);
          result = { success: true, htmlContent: localizedHtml };
        } catch (err) {
          logger.error(`[BullMQ Worker] thumbnail-localize failed for source ${sourceId}:`, err);
          throw err;
        }
      } else if (type === 'thumbnail-cleanup') {
        const { sourceId } = payload;
        try {
          const cleanupResult = await thumbnailLocalizer.cleanupOrphanedImages(sourceId);
          result = { success: true, ...cleanupResult };
        } catch (err) {
          logger.error(`[BullMQ Worker] thumbnail-cleanup failed for source ${sourceId}:`, err);
          throw err;
        }
      } else if (type === 'knowledge-graph-topology') {
        const { noteId } = payload;
        const note = await prisma.note.findUnique({ where: { id: noteId } });
        if (!note) {
          throw new Error(`Note not found for knowledge-graph-topology: ${noteId}`);
        }

        const content = note.content || '';
        const nodes: { id: string; label: string; type: string }[] = [
          { id: noteId, label: note.title || 'Untitled', type: 'note' },
        ];
        const edges: { source: string; target: string; label: string }[] = [];

        // 提取 [[wiki-link]] 节点
        const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
        const wikiLinkTargets = new Set<string>();
        let wikiMatch: RegExpExecArray | null;
        while ((wikiMatch = wikiLinkRegex.exec(content)) !== null) {
          const target = wikiMatch[1];
          if (!target) continue;
          wikiLinkTargets.add(target.trim());
        }
        for (const target of wikiLinkTargets) {
          const nodeId = `wiki:${target}`;
          nodes.push({ id: nodeId, label: target, type: 'wiki-link' });
          edges.push({ source: noteId, target: nodeId, label: 'links-to' });
        }

        // 提取 #标签 节点（避开行首的 Markdown 标题）
        const tagRegex = /(?:^|\s)#([\w\u4e00-\u9fa5-]+)/g;
        const tags = new Set<string>();
        let tagMatch: RegExpExecArray | null;
        while ((tagMatch = tagRegex.exec(content)) !== null) {
          const tag = tagMatch[1];
          if (!tag) continue;
          tags.add(tag.trim());
        }
        for (const tag of tags) {
          const nodeId = `tag:${tag}`;
          nodes.push({ id: nodeId, label: `#${tag}`, type: 'tag' });
          edges.push({ source: noteId, target: nodeId, label: 'tagged' });
        }

        await prisma.knowledgeGraph.upsert({
          where: { noteId },
          create: { noteId, nodes, edges },
          update: { nodes, edges },
        });

        result = { success: true, nodes: nodes.length, edges: edges.length };
      } else if (type === 'image-downsampling') {
        // Legacy handler: now expects a buffer payload (upload middleware calls downsampleImageBuffer inline)
        const { buffer, maxWidth, maxHeight } = payload;
        if (buffer) {
          await downsampleImage(Buffer.from(buffer), maxWidth, maxHeight);
        }
        result = { success: true };
      } else if (type === 'image-optimization') {
        // Legacy handler: upload middleware now calls optimizeImage inline
        const { file } = payload;
        const { optimizeImage } = require('../utils/image');
        await optimizeImage(file);
        result = { file };
      } else {
        // Fallback: check if there's a registered JobWorker handler
        const { JobWorker } = require('./jobWorker');
        const globalWithHandlers = globalThis as typeof globalThis & {
          JobWorkerHandlers?: Map<string, JobHandler>;
        };
        const handler =
          JobWorker.getHandler(type) || globalWithHandlers.JobWorkerHandlers?.get(type);
        if (handler) {
          result = await handler(payload, dbJob);
        } else {
          throw new Error(`Unknown job type / handler: "${type}"`);
        }
      }

      // 3. Update status to SUCCEEDED
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
          result: result ? JSON.stringify(result) : null,
          progress: 100,
        },
      });

      emitJobProgress(userId, {
        jobId,
        progress: 100,
        status: 'SUCCEEDED',
        result,
      });

      logger.info(`[BullMQ Worker] Successfully completed job ${jobId}`);
      return result;
    },
    {
      connection: (workerConnection = redisService.getNewRedisConnection()),
      concurrency: 5,
    },
  );

  taskWorker.on('failed', async (bullJob, err) => {
    if (!bullJob) return;
    const { jobId, userId } = bullJob.data;
    const errorMsg = err.stack || err.message;
    logger.error(`[BullMQ Worker] Job ${jobId} failed:`, errorMsg);

    const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
    if (!dbJob) return;

    if (bullJob.attemptsMade < bullJob.opts.attempts!) {
      // Retrying: update status to PENDING/retrying
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'PENDING',
          error: errorMsg,
          retryCount: bullJob.attemptsMade,
        },
      });

      emitJobProgress(userId, {
        jobId,
        progress: dbJob.progress,
        status: 'PENDING',
        error: errorMsg,
        retryCount: bullJob.attemptsMade,
      });

      logger.info(
        `[BullMQ Worker] Job ${jobId} failed, rescheduled for retry (attempt ${bullJob.attemptsMade} made)`,
      );
    } else {
      // Ultimate failure
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: errorMsg,
        },
      });

      emitJobProgress(userId, {
        jobId,
        progress: dbJob.progress,
        status: 'FAILED',
        error: errorMsg,
      });

      logger.warn(`[BullMQ Worker] Job ${jobId} exceeded max attempts and was marked FAILED`);
    }
  });

  taskWorker.on('error', (err) => {
    logger.error('[BullMQ Worker] Error:', err);
  });
}

/**
 * Enqueue a job into BullMQ.
 */
export async function enqueueBullMQ(
  queueName: string,
  payload: unknown,
  jobId: string,
  options: { maxAttempts?: number; type?: string; userId?: string } = {},
) {
  if (!taskQueue) {
    initBullMQ();
  }
  if (!taskQueue) {
    throw new Error('BullMQ task queue could not be initialized');
  }

  const maxAttempts = options.maxAttempts ?? 3;
  const type = options.type ?? queueName;
  const userId = options.userId;

  const bullJob = await taskQueue.add(
    type,
    { jobId, payload, type, userId },
    {
      jobId,
      attempts: maxAttempts,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s backoff
      },
    },
  );

  logger.info(`[BullMQ] Enqueued job ${bullJob.id} of type "${type}"`);
  return bullJob;
}

/**
 * Cancel and remove a job from BullMQ.
 */
export async function cancelBullMQJob(jobId: string): Promise<boolean> {
  if (!taskQueue) return false;
  try {
    const job = await taskQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`[BullMQ] Successfully cancelled and removed job ${jobId} from queue`);
      return true;
    }
  } catch (err) {
    logger.error(`[BullMQ] Failed to cancel job ${jobId}:`, err);
  }
  return false;
}

export async function closeBullMQ(): Promise<void> {
  if (taskWorker) {
    try {
      await taskWorker.close();
      logger.info('[BullMQ] Worker closed successfully.');
    } catch (err) {
      logger.warn('[BullMQ] Failed to close task worker:', err);
    } finally {
      taskWorker = null;
    }
  }
  if (workerConnection) {
    try {
      await workerConnection.quit();
    } catch {
      try {
        workerConnection.disconnect();
      } catch {
        // Ignore
      }
    } finally {
      workerConnection = null;
    }
  }

  if (taskQueue) {
    try {
      await taskQueue.close();
      logger.info('[BullMQ] Queue closed successfully.');
    } catch (err) {
      logger.warn('[BullMQ] Failed to close task queue:', err);
    } finally {
      taskQueue = null;
    }
  }
  if (queueConnection) {
    try {
      await queueConnection.quit();
    } catch {
      try {
        queueConnection.disconnect();
      } catch {
        // Ignore
      }
    } finally {
      queueConnection = null;
    }
  }
}

import { randomUUID } from 'crypto';
import sharp from 'sharp';
import prisma from './prisma';
import { storageService } from './storage.service';
import { AppError } from '../utils/error';
import { getDecryptedActiveStorageConfig } from '../utils/s3-upload-helper';
import { gbToBytes } from '../utils/quota';
import { buildDecryptedStorageConfig } from '../utils/crypto';
import type { StoredTutorialImage } from './tutorial-package.types';

export async function storeTutorialImage(
  source: Buffer,
  courseId: string,
  lessonToken: string,
): Promise<StoredTutorialImage> {
  let webp: Buffer;
  try {
    webp = await sharp(source, { failOn: 'error' })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 })
      .toBuffer();
  } catch {
    throw new AppError('参考图无法读取或格式不受支持', 400, 'INVALID_TUTORIAL_IMAGE');
  }

  const selected = await getDecryptedActiveStorageConfig('ASSET');
  if (!selected) {
    throw new AppError('未配置可用的 R2 存储，请先在存储设置中启用', 400, 'R2_REQUIRED');
  }
  const reserved = await prisma.storageConfig.updateMany({
    where: {
      id: selected.raw.id,
      status: 'ACTIVE',
      usedBytes: { lte: gbToBytes(selected.raw.limitGb) - webp.length },
    },
    data: { usedBytes: { increment: webp.length } },
  });
  if (reserved.count === 0) {
    throw new AppError('R2 存储空间不足', 400, 'R2_QUOTA_EXCEEDED');
  }

  const key = `courses/${courseId}/tutorials/${lessonToken}/${randomUUID()}.webp`;
  try {
    const url = await storageService.uploadBuffer(selected.config, webp, key, 'image/webp');
    return { url, key, size: webp.length, storageConfigId: selected.raw.id };
  } catch (error) {
    const reverted = await prisma.storageConfig.updateMany({
      where: { id: selected.raw.id, usedBytes: { gte: webp.length } },
      data: { usedBytes: { decrement: webp.length } },
    });
    if (!reverted.count) {
      await prisma.storageConfig.update({ where: { id: selected.raw.id }, data: { usedBytes: 0 } });
    }
    throw error;
  }
}

export async function deleteTutorialImage(image: {
  imageKey?: string | null;
  imageSize?: number | null;
  storageConfigId?: string | null;
}): Promise<void> {
  if (!image.imageKey || !image.storageConfigId) return;
  const config = await prisma.storageConfig.findUnique({ where: { id: image.storageConfigId } });
  if (!config) return;
  await storageService.deleteFile(buildDecryptedStorageConfig(config), image.imageKey);
  if (image.imageSize && image.imageSize > 0) {
    const decremented = await prisma.storageConfig.updateMany({
      where: { id: config.id, usedBytes: { gte: image.imageSize } },
      data: { usedBytes: { decrement: image.imageSize } },
    });
    if (!decremented.count) {
      await prisma.storageConfig.update({ where: { id: config.id }, data: { usedBytes: 0 } });
    }
  }
}

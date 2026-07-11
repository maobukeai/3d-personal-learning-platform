import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../types/auth-request';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/error';
import { storageService } from '../../services/storage.service';
import { decryptSecretIfNeeded, generateBackendSignedUrl } from '../../utils/crypto';
import { UploadedFile } from '../../types/upload';
import fs from 'fs';

export const TAG_SEARCH_REDIS_TTL = 7 * 24 * 3600; // 7 days
export const tagSearchKey = (tag: string) => `asset_tag_search:${tag}`;

export const splitTagText = (value: string): string[] =>
  value
    .split(/[,，;；\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

export const normalizeAssetTags = (tags: unknown): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags !== 'string') return [];

  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag).trim()).filter(Boolean);
    }
  } catch (_error) {
    // Fall through to delimiter parsing.
  }

  return splitTagText(tags);
};

export type PerformanceTone = 'pass' | 'notice' | 'warning' | 'danger';

export type AssetPerformanceSource = {
  size?: number | null;
  vertices?: number | null;
  faces?: number | null;
  materials?: number | null;
  animations?: number | null;
  hasAnimations?: boolean | null;
  dimensions?: string | null;
  maxTextureRes?: number | null;
};

export const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseDimensions = (dimensions?: string | null) => {
  if (!dimensions) return [];
  const matches = dimensions.match(/-?\d+(?:\.\d+)?/g) || [];
  return matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
};

export const createRiskItem = (
  metric: string,
  label: string,
  value: number,
  unit: string,
  tone: PerformanceTone,
  message: string,
  recommendation: string,
) => ({
  metric,
  label,
  value,
  unit,
  tone,
  message,
  recommendation,
});

export const buildAssetPerformanceReport = (asset: AssetPerformanceSource) => {
  const faces = toFiniteNumber(asset.faces);
  const vertices = toFiniteNumber(asset.vertices);
  const materials = toFiniteNumber(asset.materials);
  const size = toFiniteNumber(asset.size);
  const maxTextureRes = toFiniteNumber(asset.maxTextureRes);
  const dimensions = parseDimensions(asset.dimensions);
  const maxDimension = dimensions.length ? Math.max(...dimensions) : 0;
  const riskItems = [];

  if (!faces && !vertices && !maxTextureRes) {
    riskItems.push(
      createRiskItem(
        'metadata',
        '解析完整度',
        0,
        '',
        'notice',
        '模型关键指标尚未完整解析',
        '等待后台解析完成，或上传 GLB/GLTF 以获得更准确的检测结果。',
      ),
    );
  }

  let faceTone: PerformanceTone = 'pass';
  if (faces > 250000) faceTone = 'danger';
  else if (faces > 120000) faceTone = 'warning';
  else if (faces > 60000) faceTone = 'notice';
  riskItems.push(
    createRiskItem(
      'faces',
      '面数',
      faces,
      'faces',
      faceTone,
      faceTone === 'pass' ? '面数适合网页实时预览' : '面数偏高，移动端和低端 GPU 压力会明显增加',
      '保留主轮廓，使用 Decimate/LOD 拆分移动端版本。',
    ),
  );

  let textureTone: PerformanceTone = 'pass';
  if (maxTextureRes > 4096) textureTone = 'danger';
  else if (maxTextureRes > 2048) textureTone = 'warning';
  else if (maxTextureRes > 1024) textureTone = 'notice';
  riskItems.push(
    createRiskItem(
      'texture',
      '最大贴图',
      maxTextureRes,
      'px',
      textureTone,
      textureTone === 'pass' ? '贴图尺寸处于安全范围' : '贴图过大，首屏加载和显存占用风险较高',
      '网页展示建议压缩到 2K 以内，移动端优先 1K/2K 分档。',
    ),
  );

  let sizeTone: PerformanceTone = 'pass';
  if (size > 250) sizeTone = 'danger';
  else if (size > 120) sizeTone = 'warning';
  else if (size > 60) sizeTone = 'notice';
  riskItems.push(
    createRiskItem(
      'size',
      '文件体积',
      size,
      'MB',
      sizeTone,
      sizeTone === 'pass' ? '文件体积适合在线分发' : '文件体积偏大，下载与预览等待时间会变长',
      '压缩纹理、移除未使用材质，并开启 Draco/Meshopt 压缩。',
    ),
  );

  let materialTone: PerformanceTone = 'pass';
  if (materials > 80) materialTone = 'danger';
  else if (materials > 40) materialTone = 'warning';
  else if (materials > 20) materialTone = 'notice';
  riskItems.push(
    createRiskItem(
      'materials',
      '材质数量',
      materials,
      '',
      materialTone,
      materialTone === 'pass' ? '材质数量可控' : '材质数量偏多，Draw Call 和贴图绑定成本较高',
      '合并相近材质，使用图集或统一 PBR 材质模板。',
    ),
  );

  if (maxDimension > 1000) {
    riskItems.push(
      createRiskItem(
        'dimensions',
        '空间尺寸',
        maxDimension,
        '',
        'notice',
        '模型尺寸跨度较大，导入不同 DCC/引擎时可能需要单位校正',
        '发布前确认单位制和原点位置，必要时提供厘米/米两套说明。',
      ),
    );
  }

  const penalties: Record<PerformanceTone, number> = {
    pass: 0,
    notice: 8,
    warning: 18,
    danger: 30,
  };
  const score = Math.max(
    0,
    100 - riskItems.reduce((total, item) => total + penalties[item.tone], 0),
  );
  const worstTone = riskItems.some((item) => item.tone === 'danger')
    ? 'danger'
    : riskItems.some((item) => item.tone === 'warning')
      ? 'warning'
      : riskItems.some((item) => item.tone === 'notice')
        ? 'notice'
        : 'pass';

  return {
    score,
    level: worstTone,
    mobileRisk:
      worstTone === 'danger'
        ? 'high'
        : worstTone === 'warning'
          ? 'medium'
          : worstTone === 'notice'
            ? 'low'
            : 'safe',
    summary:
      worstTone === 'pass'
        ? '适合网页和移动端预览'
        : worstTone === 'notice'
          ? '可上线，但建议准备移动端轻量版本'
          : worstTone === 'warning'
            ? '建议优化后再进入正式发布'
            : '高风险资产，正式发布前需要减面和压缩贴图',
    metrics: {
      faces,
      vertices,
      materials,
      size,
      maxTextureRes,
      animations: toFiniteNumber(asset.animations),
      hasAnimations: !!asset.hasAnimations,
      dimensions: asset.dimensions || '',
    },
    risks: riskItems,
  };
};

export const buildVersionComparison = (
  current: AssetPerformanceSource,
  previous?: AssetPerformanceSource | null,
) => {
  if (!previous) return null;
  const compareMetric = (key: keyof AssetPerformanceSource) => {
    const currentValue = toFiniteNumber(current[key]);
    const previousValue = toFiniteNumber(previous[key]);
    return {
      current: currentValue,
      previous: previousValue,
      delta: Number((currentValue - previousValue).toFixed(2)),
    };
  };

  return {
    size: compareMetric('size'),
    faces: compareMetric('faces'),
    materials: compareMetric('materials'),
    maxTextureRes: compareMetric('maxTextureRes'),
  };
};

export const checkIsUserVip = async (userId: string): Promise<boolean> => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) return false;
    if (subscription.status !== 'ACTIVE') return false;
    if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
      return false;
    }
    return subscription.plan.name !== 'FREE' && subscription.plan.priority > 0;
  } catch (_e) {
    return false;
  }
};

export const getAssetAccessWhere = (id: string, req: AuthRequest): Prisma.AssetWhereInput => {
  const userId = req.userId as string | undefined;
  const workspaceId = req.workspaceId;

  if (!userId) {
    // Guests can only see approved, public assets (assets not bound to a team/workspace)
    return { id, status: 'APPROVED', teamId: null };
  }

  const or: Prisma.AssetWhereInput[] = [{ status: 'APPROVED', teamId: null }];
  if (workspaceId) or.push({ teamId: workspaceId });
  or.push({ userId });
  if (req.user?.role === 'ADMIN') or.push({});
  return { id, OR: or };
};

export const checkAssetAccess = (
  asset: { status: string; teamId: string | null; userId: string },
  req: AuthRequest,
): void => {
  const isPublic = asset.status === 'APPROVED' && asset.teamId === null;
  if (isPublic) {
    return;
  }

  if (!req.userId) {
    throw new AppError(
      'Unauthorized: Authentication required to access private assets',
      401,
      'UNAUTHORIZED',
    );
  }

  if (req.user?.role === 'ADMIN') {
    return;
  }

  if (asset.userId === req.userId) {
    return;
  }

  if (asset.teamId && req.workspaceId === asset.teamId) {
    return;
  }

  throw new AppError('Forbidden: You do not have access to this asset', 403, 'FORBIDDEN');
};

export const getAssetCollaborationWhere = (
  id: string,
  req: AuthRequest,
): Prisma.AssetWhereInput => {
  const userId = req.userId as string | undefined;
  const workspaceId = req.workspaceId;
  const or: Prisma.AssetWhereInput[] = [];
  if (workspaceId) or.push({ teamId: workspaceId });
  if (userId) or.push({ userId });
  if (req.user?.role === 'ADMIN') or.push({});
  return { id, OR: or.length > 0 ? or : [{ id: '__no_access__' }] };
};

// Re-upload compressed GLB to Cloudflare R2 and sync DB records
/**
 * @deprecated The unified 3D optimization pipeline (`processFull3DOptimization`
 * + `storageService.uploadBuffer`) replaces all callers of this helper. Retained
 * for any legacy references; new code should use the unified pipeline directly.
 */
export const syncCompressedAssetToR2 = async (
  assetId: string,
  fullPath: string,
  assetFile: UploadedFile,
  isVersion = false,
  versionId?: string,
) => {
  // Read the compressed temp file into a buffer once — all subsequent
  // operations (size calc + R2 upload) use the buffer, never local disk IO
  // for persistence. The temp file itself is managed/cleaned by the caller.
  let compressedBuffer: Buffer;
  try {
    compressedBuffer = await fs.promises.readFile(fullPath);
  } catch (err) {
    logger.error(
      `[AssetProcessor] Failed to read compressed temp file ${fullPath} for asset ${assetId}:`,
      err,
    );
    return;
  }

  const sizeMB = parseFloat((compressedBuffer.length / (1024 * 1024)).toFixed(2));

  if (!assetFile.r2ConfigId || !assetFile.r2Key) {
    // R2 storage configuration is required — the "local fallback" that
    // silently updated only the DB size has been removed. Fail loudly so the
    // caller can surface the problem instead of leaving the asset without a
    // cloud-hosted compressed artifact.
    throw new Error('R2 storage configuration missing for asset');
  }

  try {
    const config = await prisma.storageConfig.findUnique({
      where: { id: assetFile.r2ConfigId },
    });

    if (!config) {
      logger.error(
        `[AssetProcessor] Storage config ${assetFile.r2ConfigId} not found for re-uploading asset ${assetId}`,
      );
      return;
    }

    logger.info(
      `[AssetProcessor] Re-uploading compressed GLB to R2 for asset: ${assetId}, key: ${assetFile.r2Key}`,
    );

    // Upload compressed buffer (overwrites original)
    const newUrl = await storageService.uploadBuffer(
      {
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
        bucketName: config.bucketName,
        publicUrl: config.publicUrl,
      },
      compressedBuffer,
      assetFile.r2Key,
      assetFile.mimetype || 'model/gltf-binary',
    );

    if (isVersion && versionId) {
      await prisma.assetVersion.update({
        where: { id: versionId },
        data: {
          url: newUrl,
          size: sizeMB,
        },
      });
    }

    await prisma.asset.update({
      where: { id: assetId },
      data: {
        url: newUrl,
        size: sizeMB,
      },
    });

    logger.info(
      `[AssetProcessor] Successfully re-uploaded and updated size (${sizeMB}MB) for asset: ${assetId}`,
    );
  } catch (err) {
    logger.error(
      `[AssetProcessor] Failed to re-upload compressed GLB to R2 for asset ${assetId}:`,
      err,
    );
  }
};

export async function signPrivateUrlIfNeeded(
  url: string | null | undefined,
  asset: { status: string; teamId: string | null; id: string },
  fieldType: 'url' | 'packageUrl' | 'thumbnail',
): Promise<string | null> {
  if (!url) return null;

  // PENDING/REJECTED assets must not expose any viewable URL — only APPROVED
  // assets are eligible for signed/raw URLs.
  if (asset.status !== 'APPROVED') {
    return null;
  }

  // If the asset is PUBLIC/APPROVED (status === 'APPROVED' and teamId === null), return the raw URL (public)
  if (asset.status === 'APPROVED' && !asset.teamId) {
    return url;
  }

  // If it's a private asset, we must use a signed/authenticated URL.
  // 1. If it's an R2 cloud URL (starting with http/https), we can sign it using storageService
  const urlLower = url.toLowerCase().trim();
  if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
    try {
      const parsedUrl = new URL(url);
      const urlHost = parsedUrl.host.toLowerCase();

      // Find direct host match or active configs
      let configs = await prisma.storageConfig.findMany({
        where: {
          status: 'ACTIVE',
          publicUrl: { contains: urlHost },
        },
      });

      if (configs.length === 0) {
        configs = await prisma.storageConfig.findMany({
          where: { status: 'ACTIVE' },
        });
      }

      for (const config of configs) {
        let baseUrl = config.publicUrl.endsWith('/')
          ? config.publicUrl.slice(0, -1)
          : config.publicUrl;
        if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
          baseUrl = `https://${baseUrl}`;
        }

        const baseUrlLower = baseUrl.toLowerCase();
        if (urlLower.startsWith(baseUrlLower)) {
          const pathname = parsedUrl.pathname;
          const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
          if (key) {
            const decryptedConfig = {
              endpoint: config.endpoint,
              accessKeyId: config.accessKeyId ?? '',
              secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
              bucketName: config.bucketName,
              publicUrl: config.publicUrl,
            };
            // Generate presigned R2 URL with short 900s expiry
            const signedUrl = await storageService.getPresignedViewUrl(decryptedConfig, key, 900);
            return signedUrl;
          }
        }
      }
    } catch (err) {
      logger.error(`[StorageService] Failed to sign R2 URL ${url}:`, err);
    }
  }

  // 2. Fallback (e.g. local `/uploads/...` file path or parsed error):
  // Return our unified backend authentication view route with signature & 900s expiry:
  const typeMap = {
    url: 'model',
    packageUrl: 'package',
    thumbnail: 'thumbnail',
  };
  return generateBackendSignedUrl(
    `/api/assets/${asset.id}/view-file`,
    {
      type: typeMap[fieldType],
    },
    900,
  );
}

interface SignableAssetVersion {
  url?: string | null;
  packageUrl?: string | null;
  [key: string]: unknown;
}

interface SignableAsset {
  id: string;
  status: string;
  teamId: string | null;
  url?: string | null;
  packageUrl?: string | null;
  thumbnail?: string | null;
  versions?: SignableAssetVersion[] | null;
  [key: string]: unknown;
}

export async function signAssetUrls<T extends Record<string, unknown>>(asset: T): Promise<T>;
export async function signAssetUrls<T extends Record<string, unknown>>(asset: T[]): Promise<T[]>;
export async function signAssetUrls(asset: unknown): Promise<unknown>;
export async function signAssetUrls(asset: unknown): Promise<unknown> {
  if (!asset) return asset;

  if (Array.isArray(asset)) {
    return Promise.all(asset.map((a) => signAssetUrls(a)));
  }

  const signed = { ...(asset as Record<string, unknown>) } as SignableAsset;

  // PENDING/REJECTED assets do not get signed (or raw) view URLs — only
  // APPROVED assets are eligible. Null out every URL field (including nested
  // version URLs) so pending/rejected content cannot be previewed.
  if (signed.status && signed.status !== 'APPROVED') {
    signed.url = null;
    signed.packageUrl = null;
    signed.thumbnail = null;
    if (signed.versions && Array.isArray(signed.versions)) {
      signed.versions = signed.versions.map((v) => ({
        ...v,
        url: null,
        packageUrl: null,
      }));
    }
    return signed;
  }

  if (signed.url) {
    signed.url = (await signPrivateUrlIfNeeded(signed.url, signed, 'url')) ?? signed.url;
  }
  if (signed.packageUrl) {
    signed.packageUrl =
      (await signPrivateUrlIfNeeded(signed.packageUrl, signed, 'packageUrl')) ?? signed.packageUrl;
  }
  if (signed.thumbnail) {
    signed.thumbnail =
      (await signPrivateUrlIfNeeded(signed.thumbnail, signed, 'thumbnail')) ?? signed.thumbnail;
  }

  // Also sign versions if included
  if (signed.versions && Array.isArray(signed.versions)) {
    signed.versions = await Promise.all(
      signed.versions.map(async (v) => {
        const vSigned: SignableAssetVersion = { ...v };
        if (vSigned.url) {
          vSigned.url = (await signPrivateUrlIfNeeded(vSigned.url, signed, 'url')) ?? vSigned.url;
        }
        if (vSigned.packageUrl) {
          vSigned.packageUrl =
            (await signPrivateUrlIfNeeded(vSigned.packageUrl, signed, 'packageUrl')) ??
            vSigned.packageUrl;
        }
        return vSigned;
      }),
    );
  }

  return signed;
}

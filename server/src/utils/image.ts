import sharp from 'sharp';
import { optimize } from 'svgo';
import path from 'path';
import { logger } from './logger';

interface FieldConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

// Bounding box dimensions and qualities tailored to different upload context fields
const FIELD_CONFIGS: Record<string, FieldConfig> = {
  avatar: { maxWidth: 256, maxHeight: 256, quality: 80 },
  logo: { maxWidth: 512, maxHeight: 512, quality: 85 },
  favicon: { maxWidth: 64, maxHeight: 64, quality: 90 },
  plugin_preview: { maxWidth: 512, maxHeight: 512, quality: 80 },
  software_preview: { maxWidth: 512, maxHeight: 512, quality: 80 },
  cover: { maxWidth: 1280, maxHeight: 720, quality: 80 },
  thumbnail: { maxWidth: 640, maxHeight: 360, quality: 80 },
  banner: { maxWidth: 1920, maxHeight: 480, quality: 80 },
  banner_image: { maxWidth: 1920, maxHeight: 480, quality: 80 },
  preview: { maxWidth: 1280, maxHeight: 720, quality: 80 },
  // Default fallback config for general images
  default: { maxWidth: 1920, maxHeight: 1080, quality: 80 },
};

/**
 * Optimizes an uploaded image file in memory (memoryStorage).
 * - Raster images (PNG, JPEG, BMP, TIFF, GIF) are converted to WebP and resized according to field rules.
 * - SVGs are optimized programmatically using svgo.
 * - The file metadata (buffer, size, mimetype, originalname) is updated in place.
 *
 * Note: With multer.memoryStorage(), `file.buffer` is a Buffer and `file.path` is undefined.
 */
export async function optimizeImage(file: Express.Multer.File): Promise<void> {
  const ext = path.extname(file.originalname).toLowerCase();

  // 1. Handle SVG Optimization
  if (ext === '.svg') {
    try {
      if (!file.buffer) {
        logger.error(`[ImageOptimize] SVG file buffer is missing: ${file.originalname}`);
        return;
      }
      logger.info(`[ImageOptimize] Optimizing SVG: ${file.originalname}`);
      const svgContent = file.buffer.toString('utf8');
      const result = optimize(svgContent, {
        path: file.originalname,
        multipass: true,
      });

      if (result.data) {
        file.buffer = Buffer.from(result.data, 'utf8');
        file.size = file.buffer.length;
        file.mimetype = 'image/svg+xml';
        logger.info(`[ImageOptimize] SVG optimized. New size: ${file.size} bytes`);
      }
    } catch (err) {
      logger.error(`[ImageOptimize] Failed to optimize SVG: ${file.originalname}`, err);
      // Keep SVG as-is if optimization fails (non-blocking fallback)
    }
    return;
  }

  // 2. Handle Raster Image Compression (PNG, JPG, BMP, etc.)
  const supportedRasterExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp', '.gif'];
  if (!supportedRasterExtensions.includes(ext)) {
    // Skip unsupported file types
    return;
  }

  try {
    if (!file.buffer) {
      throw new Error('File buffer is missing');
    }
    const config = FIELD_CONFIGS[file.fieldname] || FIELD_CONFIGS.default;
    if (!config) {
      throw new Error('Image config default fallback is missing');
    }

    // Check if GIF is animated to preserve animations
    const isGif = ext === '.gif';

    // Set up sharp processing pipeline from buffer
    let pipeline = sharp(file.buffer, isGif ? { animated: true } : {});

    // Resize image to fit inside configured bounding box
    pipeline = pipeline.resize({
      width: config.maxWidth,
      height: config.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });

    // Convert to WebP format
    pipeline = pipeline.webp({
      quality: config.quality,
      force: true,
    });

    // Write optimized image to a buffer
    const resultBuffer = await pipeline.toBuffer();

    // Update Multer file metadata in place
    file.buffer = resultBuffer;
    file.size = resultBuffer.length;
    file.mimetype = 'image/webp';

    // Update originalname to match the new webp extension
    const origExt = path.extname(file.originalname);
    const origBase = path.basename(file.originalname, origExt);
    file.originalname = `${origBase}.webp`;

    logger.info(
      `[ImageOptimize] Image compressed successfully. Formatted as WebP. New size: ${file.size} bytes`,
    );
  } catch (err) {
    logger.error(`[ImageOptimize] Compression failed for file: ${file.originalname}`, err);
    throw new Error(`图片压缩处理失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Downsamples an image buffer to fit within the given bounding box.
 * Returns a new Buffer containing the downsampled image (same format as input).
 *
 * @param buffer   - Source image buffer
 * @param maxWidth - Maximum width in pixels (default 1024)
 * @param maxHeight- Maximum height in pixels (default 1024)
 */
export async function downsampleImageBuffer(
  buffer: Buffer,
  maxWidth = 1024,
  maxHeight = 1024,
): Promise<Buffer> {
  if (!buffer) {
    throw new Error('downsampleImageBuffer: buffer is required');
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

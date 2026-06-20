import sharp from 'sharp';
import { optimize } from 'svgo';
import fs from 'fs/promises';
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
  cover: { maxWidth: 1280, maxHeight: 720, quality: 80 },
  thumbnail: { maxWidth: 640, maxHeight: 360, quality: 80 },
  banner: { maxWidth: 1920, maxHeight: 480, quality: 80 },
  banner_image: { maxWidth: 1920, maxHeight: 480, quality: 80 },
  preview: { maxWidth: 1280, maxHeight: 720, quality: 80 },
  // Default fallback config for general images
  default: { maxWidth: 1920, maxHeight: 1080, quality: 80 },
};

/**
 * Optimizes an uploaded image file on disk.
 * - Raster images (PNG, JPEG, BMP, TIFF, GIF) are converted to WebP and resized according to field rules.
 * - SVGs are optimized programmatically using svgo.
 * - The original file is deleted if the extension or name changes, and the file metadata is updated in place.
 */
export async function optimizeImage(file: Express.Multer.File): Promise<void> {
  const ext = path.extname(file.originalname).toLowerCase();
  const filePath = file.path;

  // Verify file exists on disk
  try {
    await fs.access(filePath);
  } catch {
    logger.error(`[ImageOptimize] File not found on disk: ${filePath}`);
    return;
  }

  // 1. Handle SVG Optimization
  if (ext === '.svg') {
    try {
      logger.info(`[ImageOptimize] Optimizing SVG: ${filePath}`);
      const svgContent = await fs.readFile(filePath, 'utf8');
      const result = optimize(svgContent, {
        path: filePath,
        multipass: true,
      });

      if (result.data) {
        await fs.writeFile(filePath, result.data, 'utf8');
        const stat = await fs.stat(filePath);
        file.size = stat.size;
        file.mimetype = 'image/svg+xml';
        logger.info(`[ImageOptimize] SVG optimized. New size: ${file.size} bytes`);
      }
    } catch (err) {
      logger.error(`[ImageOptimize] Failed to optimize SVG: ${filePath}`, err);
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
    const config = FIELD_CONFIGS[file.fieldname] || FIELD_CONFIGS.default;
    if (!config) {
      throw new Error('Image config default fallback is missing');
    }

    // Check if GIF is animated to preserve animations
    const isGif = ext === '.gif';

    // Set up sharp processing pipeline
    let pipeline = sharp(filePath, isGif ? { animated: true } : {});

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

    // Determine new file path and filename with .webp extension
    const dir = path.dirname(filePath);
    const originalBasename = path.basename(filePath, ext);
    const newFilename = `${originalBasename}.webp`;
    const newPath = path.join(dir, newFilename);

    // Write optimized image to new WebP file
    await pipeline.toFile(newPath);

    // Delete old file if the path/extension has changed
    if (newPath !== filePath) {
      await fs.unlink(filePath);
    }

    // Update Multer file metadata in place
    file.path = newPath;
    file.filename = newFilename;
    file.mimetype = 'image/webp';

    // Update originalname to match the new webp extension
    const origExt = path.extname(file.originalname);
    const origBase = path.basename(file.originalname, origExt);
    file.originalname = `${origBase}.webp`;

    // Fetch new size
    const stat = await fs.stat(newPath);
    file.size = stat.size;

    logger.info(
      `[ImageOptimize] Image compressed successfully. Formatted as WebP. New size: ${file.size} bytes`,
    );
  } catch (err) {
    logger.error(`[ImageOptimize] Compression failed for file: ${filePath}`, err);
    throw new Error(`图片压缩处理失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

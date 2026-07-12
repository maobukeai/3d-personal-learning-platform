import { logger } from './logger';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  getBounds,
  weld,
  resample,
  prune,
  dedup,
  quantize,
  textureCompress,
} from '@gltf-transform/functions';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import fs from 'fs';
import { compressGltfDraco } from './draco-compressor';

export interface AssetMetadata {
  vertices: number;
  faces: number;
  materials: number;
  animations: number;
  hasAnimations: boolean;
  dimensions: string;
  maxTextureRes: number;
}

export async function optimize3DAsset(filePath: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${Date.now()}`;
  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.read(filePath);
    logger.info(`[AssetProcessor] Compressing GLB file: ${filePath}`);
    await document.transform(
      weld(),
      resample(),
      prune(),
      dedup(),
      quantize(),
      textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [1024, 1024],
      }),
    );
    // Save to temp path first
    await io.write(tempPath, document);

    // Atomically replace original file
    await fs.promises.rename(tempPath, filePath);
    logger.info(`[AssetProcessor] GLB compression complete: ${filePath}`);
  } catch (compressErr) {
    // Clean up temp file if it exists (async to avoid blocking the event loop;
    // ENOENT is expected when the failed transform never produced a temp file).
    try {
      await fs.promises.unlink(tempPath);
    } catch (cleanupErr: unknown) {
      const code = (cleanupErr as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        logger.warn(`[AssetProcessor] Failed to clean up temp file ${tempPath}:`, cleanupErr);
      }
    }
    logger.error(`[AssetProcessor] Failed to compress GLB file ${filePath}:`, compressErr);
    throw compressErr;
  }
}

// CPU-bound calculations offloaded to Worker (asynchronous read)
export async function executeAssetAnalysis(filePath: string): Promise<AssetMetadata | null> {
  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.read(filePath); // NodeIO.read returns a Promise<Document>
    const root = document.getRoot();

    let totalVertices = 0;
    let totalFaces = 0;

    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (position) {
          totalVertices += position.getCount();
        }

        const indices = primitive.getIndices();
        if (indices) {
          totalFaces += indices.getCount() / 3;
        } else if (position) {
          totalFaces += position.getCount() / 3;
        }
      }
    }

    const materials = root.listMaterials().length;
    const animations = root.listAnimations().length;

    let maxTextureRes = 0;
    for (const texture of root.listTextures()) {
      try {
        if (typeof texture.getSize === 'function') {
          const size = texture.getSize();
          if (Array.isArray(size) && size.length >= 2) {
            maxTextureRes = Math.max(maxTextureRes, size[0], size[1]);
          }
        }
      } catch (_e) {
        // Safe skip
      }
    }

    const scenes = root.listScenes();
    let dimensions = '0.00 x 0.00 x 0.00';

    if (scenes.length > 0) {
      const scene = scenes[0]!;
      const bounds = getBounds(scene);
      const size = [
        Math.abs(bounds.max[0] - bounds.min[0]),
        Math.abs(bounds.max[1] - bounds.min[1]),
        Math.abs(bounds.max[2] - bounds.min[2]),
      ];
      dimensions = size.map((s) => s.toFixed(2)).join(' x ');
    }

    return {
      vertices: totalVertices,
      faces: Math.floor(totalFaces),
      materials,
      animations,
      hasAnimations: animations > 0,
      dimensions,
      maxTextureRes,
    };
  } catch (error) {
    logger.error('Error in 3D asset processing helper:', error);
    return null;
  }
}

// Sequence optimization and analysis
export async function executeAssetProcessing(filePath: string): Promise<AssetMetadata | null> {
  try {
    // 1. Optimize
    await optimize3DAsset(filePath);
  } catch (err) {
    logger.error(`[AssetProcessor] Optimization skipped or failed during pipeline:`, err);
  }
  // 2. Analyze
  return executeAssetAnalysis(filePath);
}

export interface FullOptimizationResult {
  buffer: Buffer; // The optimized + Draco-compressed buffer
  analysis: {
    // Metadata from executeAssetAnalysis
    vertices: number;
    faces: number;
    materials: number;
    animations: number;
    hasAnimations: boolean;
    // executeAssetAnalysis returns dimensions as a formatted string
    // (e.g. "10.00 x 20.00 x 30.00"); preserved as-is for DB storage.
    dimensions: string | null;
    maxTextureRes: number | null;
  } | null;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number; // compressedSizeBytes / originalSizeBytes
}

export async function processFull3DOptimization(filePath: string): Promise<FullOptimizationResult>;
export async function processFull3DOptimization(
  buffer: Buffer,
  ext: '.glb' | '.gltf',
): Promise<FullOptimizationResult>;
/**
 * Unified 3D asset optimization pipeline.
 *
 * Accepts either:
 *  - a file-system path (string): processes the file in-place.
 *  - a Buffer + ext: writes to a temp file, processes, then cleans up.
 *
 * Steps:
 *  1. gltf-transform optimizations (weld, resample, prune, dedup, quantize, textureCompress)
 *  2. Draco compression via gltf-pipeline
 *  3. Metadata extraction (executeAssetAnalysis)
 */
export async function processFull3DOptimization(
  filePathOrBuffer: string | Buffer,
  ext?: '.glb' | '.gltf',
): Promise<FullOptimizationResult> {
  let tempFilePath: string | null = null;
  let filePath: string;

  // ── If a Buffer was supplied, write it to a temp file first ────────────────
  if (Buffer.isBuffer(filePathOrBuffer)) {
    const os = await import('os');
    const safeExt = ext ?? '.glb';
    tempFilePath = path.join(
      os.tmpdir(),
      `asset-${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`,
    );
    await fs.promises.writeFile(tempFilePath, filePathOrBuffer);
    filePath = tempFilePath;
  } else {
    filePath = filePathOrBuffer;
  }

  try {
    // 1. Read original file to get original size
    const originalBuffer = await fs.promises.readFile(filePath);
    const originalSizeBytes = originalBuffer.length;

    // 2. optimize3DAsset(filePath) — modifies file in place
    try {
      await optimize3DAsset(filePath);
    } catch (err) {
      logger.error(`[AssetProcessor] optimize3DAsset failed during full pipeline:`, err);
      // Continue with the un-optimized file — Draco compression + analysis can still run.
    }

    // 3. Read optimized file, compressGltfDraco(buffer, ext) — returns compressed buffer
    const fileExt = (ext ?? path.extname(filePath).toLowerCase()) as '.glb' | '.gltf';
    let compressedBuffer: Buffer;
    if (fileExt === '.glb' || fileExt === '.gltf') {
      const optimizedBuffer = await fs.promises.readFile(filePath);
      compressedBuffer = await compressGltfDraco(optimizedBuffer, fileExt);
      // 4. Write compressed buffer back to filePath (for analysis step)
      await fs.promises.writeFile(filePath, compressedBuffer);
    } else {
      // Non-GLB/GLTF files: skip Draco compression, use the (optimized) buffer as-is.
      compressedBuffer = await fs.promises.readFile(filePath);
    }

    // 5. executeAssetAnalysis(filePath) — extract metadata
    const metadata = await executeAssetAnalysis(filePath);

    const compressedSizeBytes = compressedBuffer.length;
    const compressionRatio = originalSizeBytes > 0 ? compressedSizeBytes / originalSizeBytes : 0;

    return {
      buffer: compressedBuffer,
      analysis: metadata
        ? {
            vertices: metadata.vertices,
            faces: metadata.faces,
            materials: metadata.materials,
            animations: metadata.animations,
            hasAnimations: metadata.hasAnimations,
            dimensions: metadata.dimensions || null,
            maxTextureRes: metadata.maxTextureRes || null,
          }
        : null,
      originalSizeBytes,
      compressedSizeBytes,
      compressionRatio,
    };
  } finally {
    // Clean up the temp file created from buffer input
    if (tempFilePath) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (cleanupErr: unknown) {
        const code = (cleanupErr as NodeJS.ErrnoException)?.code;
        if (code !== 'ENOENT') {
          logger.warn(`[AssetProcessor] Failed to clean up temp file ${tempFilePath}:`, cleanupErr);
        }
      }
    }
  }
}

// Master Thread / API Entrypoint
export async function process3DAsset(filePath: string): Promise<AssetMetadata | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.glb' && ext !== '.gltf') {
    return null;
  }

  // Attempt to spawn Worker Thread to offload CPU-bound calculations and protect event loop.
  // Worker failures reject so the caller (background job) can retry, instead of falling back
  // to blocking the main thread (铁律七·1 禁止主线程阻塞).
  return new Promise((resolve, reject) => {
    try {
      const isTypeScript = __filename.endsWith('.ts');
      const worker = new Worker(__filename, {
        workerData: { filePath },
        // If running in development (.ts), pass ts-node loader to worker thread
        execArgv: isTypeScript ? ['-r', 'ts-node/register/transpile-only'] : [],
      });

      worker.on('message', (result: AssetMetadata | null) => {
        resolve(result);
      });

      worker.on('error', (err) => {
        logger.error('Asset worker thread error:', err);
        reject(err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn(`Asset worker thread exited with code ${code}`);
        }
      });
    } catch (err) {
      logger.error('Failed to spawn asset worker thread:', err);
      reject(err);
    }
  });
}

// Worker Thread entrypoint
if (!isMainThread) {
  const { filePath } = workerData;
  executeAssetProcessing(filePath)
    .then((result) => {
      if (parentPort) {
        parentPort.postMessage(result);
      }
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Worker thread unhandled crash:', err);
      process.exit(1);
    });
}

import { logger } from './logger';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

export interface AssetMetadata {
  vertices: number;
  faces: number;
  materials: number;
  animations: number;
  hasAnimations: boolean;
  dimensions: string;
  maxTextureRes: number;
}

// CPU-bound calculations offloaded to Worker (asynchronous read)
async function executeAssetAnalysis(filePath: string): Promise<AssetMetadata | null> {
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

// Master Thread / API Entrypoint
export async function process3DAsset(filePath: string): Promise<AssetMetadata | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.glb' && ext !== '.gltf') {
    return null;
  }

  // Attempt to spawn Worker Thread to offload CPU-bound calculations and protect event loop
  return new Promise((resolve) => {
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
        logger.error('Asset worker thread error, falling back to main thread:', err);
        // Safe Fallback: execute in main thread if worker crashes
        executeAssetAnalysis(filePath).then(resolve);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn(`Asset worker thread exited with code ${code}`);
        }
      });
    } catch (err) {
      logger.error('Failed to spawn asset worker thread, falling back to main thread:', err);
      // Safe Fallback: execute in main thread if spawning fails
      executeAssetAnalysis(filePath).then(resolve);
    }
  });
}

// Worker Thread entrypoint
if (!isMainThread) {
  const { filePath } = workerData;
  executeAssetAnalysis(filePath)
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

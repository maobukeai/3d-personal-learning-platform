import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import path from 'path';

export interface AssetMetadata {
  vertices: number;
  faces: number;
  materials: number;
  animations: number;
  hasAnimations: boolean;
  dimensions: string;
}

export async function process3DAsset(filePath: string): Promise<AssetMetadata | null> {
  const ext = path.extname(filePath).toLowerCase();

  // Currently only supporting GLB/GLTF as they are standardized
  if (ext !== '.glb' && ext !== '.gltf') {
    return null;
  }

  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.read(filePath);
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
          // Non-indexed geometry
          totalFaces += position.getCount() / 3;
        }
      }
    }

    const materials = root.listMaterials().length;
    const animations = root.listAnimations().length;

    // Calculate dimensions using the first scene
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
    };
  } catch (error) {
    console.error('Error processing 3D asset metadata:', error);
    return null;
  }
}

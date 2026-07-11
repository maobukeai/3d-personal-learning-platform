// gltf-pipeline is loaded lazily to avoid pulling it into worker threads that
// don't need it, and to keep the module side-effect-free for tree-shaking.
const gltfPipeline = require('gltf-pipeline');

/**
 * Perform GLTF/GLB Draco compression using gltf-pipeline.
 * Operates entirely on buffers — no local file IO.
 *
 * @param buffer - Source GLB/GLTF buffer
 * @param ext    - File extension, either '.glb' or '.gltf'
 * @returns Compressed buffer
 */
export async function compressGltfDraco(buffer: Buffer, ext: '.glb' | '.gltf'): Promise<Buffer> {
  const options = {
    dracoOptions: {
      compressionLevel: 10,
    },
  };

  if (ext === '.glb') {
    const result = await gltfPipeline.processGlb(buffer, options);
    return Buffer.from(result.glb);
  } else if (ext === '.gltf') {
    const gltfJson = JSON.parse(buffer.toString('utf8'));
    const result = await gltfPipeline.processGltf(gltfJson, options);
    return Buffer.from(JSON.stringify(result.gltf));
  }
  throw new Error(`Unsupported extension for Draco compression: ${ext}`);
}

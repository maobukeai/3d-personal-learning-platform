import { WebGLRenderer, Scene, Object3D, Mesh, Material, Texture, BufferGeometry } from 'three';

export class VramManager {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private maxBytes = 512 * 1024 * 1024; // 512 MB redline threshold

  // Registries to track known assets, estimated sizes, and active reference counts
  private geometries = new Map<BufferGeometry, { size: number; refCount: number }>();
  private materials = new Map<Material, { size: number; refCount: number }>();
  private textures = new Map<Texture, { size: number; refCount: number }>();

  constructor(renderer: WebGLRenderer, scene: Scene) {
    this.renderer = renderer;
    this.scene = scene;
  }

  /**
   * Estimates and registers geometry size in bytes
   */
  public registerGeometry(geom: BufferGeometry) {
    if (this.geometries.has(geom)) return;

    let bytes = 0;
    for (const name in geom.attributes) {
      const attr = geom.attributes[name];
      if (attr && (attr as any).array) {
        bytes += (attr as any).array.byteLength;
      }
    }
    if (geom.index && (geom.index as any).array) {
      bytes += (geom.index as any).array.byteLength;
    }
    this.geometries.set(geom, { size: bytes, refCount: 0 });
  }

  /**
   * Estimates and registers material size (flat 1KB estimate for uniforms)
   */
  public registerMaterial(mat: Material) {
    if (this.materials.has(mat)) return;

    this.materials.set(mat, { size: 1024, refCount: 0 });

    // Scan for textures in standard material properties
    for (const key in mat) {
      const val = (mat as any)[key];
      if (val && val instanceof Texture) {
        this.registerTexture(val);
      }
    }
  }

  /**
   * Estimates and registers texture size based on dimensions and format
   */
  public registerTexture(tex: Texture) {
    if (this.textures.has(tex)) return;

    let bytes = 0;
    if (tex.image) {
      const img = tex.image as any;
      const width = img.width || 512;
      const height = img.height || 512;
      bytes = width * height * 4; // Assuming RGBA 8-bit
    } else {
      bytes = 1024 * 1024 * 4; // Fallback estimate: 4MB
    }

    if (tex.generateMipmaps) {
      bytes = Math.floor(bytes * 1.333); // Account for mipmap chain
    }

    this.textures.set(tex, { size: bytes, refCount: 0 });
  }

  /**
   * Traverses the active scene tree to compute reference counts for all assets.
   * If a mesh or its ancestors are invisible, the assets are not counted as referenced.
   */
  public update() {
    // Reset all ref counts to 0
    for (const info of this.geometries.values()) info.refCount = 0;
    for (const info of this.materials.values()) info.refCount = 0;
    for (const info of this.textures.values()) info.refCount = 0;

    const traverse = (node: Object3D, parentVisible: boolean) => {
      const currentVisible = parentVisible && node.visible;

      if (node instanceof Mesh) {
        if (node.geometry) {
          this.registerGeometry(node.geometry);
          const geomInfo = this.geometries.get(node.geometry);
          if (geomInfo && currentVisible) {
            geomInfo.refCount++;
          }
        }

        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((mat) => {
            if (!mat) return;
            this.registerMaterial(mat);
            const matInfo = this.materials.get(mat);
            if (matInfo && currentVisible) {
              matInfo.refCount++;
            }

            // Inspect textures referenced by this material
            for (const key in mat) {
              const val = (mat as any)[key];
              if (val && val instanceof Texture) {
                this.registerTexture(val);
                const texInfo = this.textures.get(val);
                if (texInfo && currentVisible) {
                  texInfo.refCount++;
                }
              }
            }
          });
        }
      }

      node.children.forEach((child) => traverse(child, currentVisible));
    };

    traverse(this.scene, true);
  }

  /**
   * Gets the total estimated memory size in bytes of all registered assets currently in memory.
   */
  public getTotalMemoryBytes(): number {
    let total = 0;
    for (const info of this.geometries.values()) total += info.size;
    for (const info of this.materials.values()) total += info.size;
    for (const info of this.textures.values()) total += info.size;
    return total;
  }

  /**
   * Enforces the VRAM budget limit (512MB redline threshold).
   * Recursively disposes of unused and invisible assets.
   */
  public checkBudget() {
    this.update();
    const currentMemory = this.getTotalMemoryBytes();
    console.log(
      `[VRAM Budget Manager] Current estimated VRAM usage: ${(currentMemory / (1024 * 1024)).toFixed(2)} MB / 512.00 MB`,
    );

    if (currentMemory < this.maxBytes) {
      return; // Under budget threshold
    }

    console.warn(
      `[VRAM Budget Manager] Estimated VRAM (${(currentMemory / (1024 * 1024)).toFixed(2)} MB) exceeded 512MB limit. Cleaning up...`,
    );

    // 1. Identify all meshes that are invisible (themselves or via parent)
    const invisibleMeshes: Mesh[] = [];
    const findInvisible = (node: Object3D, parentVisible: boolean) => {
      const currentVisible = parentVisible && node.visible;
      if (node instanceof Mesh && !currentVisible) {
        invisibleMeshes.push(node);
      }
      node.children.forEach((child) => findInvisible(child, currentVisible));
    };

    findInvisible(this.scene, true);

    // 2. Remove invisible meshes from the scene (severing their references)
    invisibleMeshes.forEach((mesh) => {
      if (mesh.parent) {
        console.log(
          `[VRAM Budget Manager] Detaching invisible mesh from parent:`,
          mesh.name || mesh.uuid,
        );
        mesh.parent.remove(mesh);
      }
    });

    // Recalculate reference counts after detaching invisible meshes
    this.update();

    let disposedCount = 0;

    // 3. Dispose of unused geometries (refCount === 0)
    for (const [geom, info] of this.geometries.entries()) {
      if (info.refCount === 0) {
        try {
          geom.dispose();
          this.geometries.delete(geom);
          disposedCount++;
          console.log(
            `[VRAM Budget Manager] Disposed unused geometry. Size: ${(info.size / 1024).toFixed(1)} KB`,
          );
        } catch (err) {
          console.error('[VRAM Budget Manager] Failed to dispose geometry:', err);
        }
      }
    }

    // 4. Dispose of unused materials (refCount === 0)
    for (const [mat, info] of this.materials.entries()) {
      if (info.refCount === 0) {
        try {
          mat.dispose();
          this.materials.delete(mat);
          disposedCount++;
          console.log(`[VRAM Budget Manager] Disposed unused material:`, mat.name || mat.uuid);
        } catch (err) {
          console.error('[VRAM Budget Manager] Failed to dispose material:', err);
        }
      }
    }

    // 5. Dispose of unused textures (refCount === 0)
    for (const [tex, info] of this.textures.entries()) {
      if (info.refCount === 0) {
        try {
          tex.dispose();
          this.textures.delete(tex);
          disposedCount++;
          console.log(
            `[VRAM Budget Manager] Disposed unused texture. Size: ${(info.size / 1024).toFixed(1)} KB`,
          );
        } catch (err) {
          console.error('[VRAM Budget Manager] Failed to dispose texture:', err);
        }
      }
    }

    // 6. Explicitly call renderer.renderLists.dispose() to clear driver-level rendering lists
    if (this.renderer) {
      try {
        this.renderer.renderLists.dispose();
        console.log(
          '[VRAM Budget Manager] Cleared driver-level rendering lists via renderer.renderLists.dispose()',
        );
      } catch (err) {
        console.error('[VRAM Budget Manager] Failed to dispose renderer render lists:', err);
      }
    }

    // Re-evaluate VRAM footprint
    this.update();
    const finalMemory = this.getTotalMemoryBytes();
    console.log(
      `[VRAM Budget Manager] Post-cleanup estimated VRAM usage: ${(finalMemory / (1024 * 1024)).toFixed(2)} MB (Disposed ${disposedCount} assets)`,
    );
  }
}

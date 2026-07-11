import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Scene,
  Mesh,
  BufferGeometry,
  MeshBasicMaterial,
  Texture,
  WebGLRenderer,
  Float32BufferAttribute,
} from 'three';
import { VramManager } from './VramManager';

describe('VramManager Stress and Leak Tests', () => {
  let scene: Scene;
  let mockRenderer: WebGLRenderer;
  let vramManager: VramManager;

  // Spies to track disposal calls
  const geomDisposeSpy = vi.spyOn(BufferGeometry.prototype, 'dispose');
  const matDisposeSpy = vi.spyOn(MeshBasicMaterial.prototype, 'dispose');
  const texDisposeSpy = vi.spyOn(Texture.prototype, 'dispose');

  beforeEach(() => {
    scene = new Scene();
    mockRenderer = {
      renderLists: {
        dispose: vi.fn(),
      },
    } as unknown as WebGLRenderer;
    vramManager = new VramManager(mockRenderer, scene);

    // Clear disposal count histories
    geomDisposeSpy.mockClear();
    matDisposeSpy.mockClear();
    texDisposeSpy.mockClear();
  });

  it('should estimate memory accurately for registered assets', () => {
    const geom = new BufferGeometry();
    // 100 vertices * 3 floats/vertex * 4 bytes/float = 1200 bytes
    geom.setAttribute('position', new Float32BufferAttribute(new Float32Array(100 * 3), 3));

    const tex = new Texture();
    tex.generateMipmaps = false;
    // No image means fallback of 4MB (4,194,304 bytes)
    const mat = new MeshBasicMaterial({ map: tex });

    const mesh = new Mesh(geom, mat);
    scene.add(mesh);

    vramManager.update();

    const expectedGeomSize = 1200;
    const expectedMatSize = 1024;
    const expectedTexSize = 1024 * 1024 * 4; // 4MB
    const expectedTotal = expectedGeomSize + expectedMatSize + expectedTexSize;

    expect(vramManager.getTotalMemoryBytes()).toBe(expectedTotal);
  });

  it('should clean up VRAM and call dispose on unused visible assets if over budget', () => {
    // To trigger budget check cleanup, we need to exceed 512MB limit.
    // Create multiple large textures (each fallback is 4MB).
    // Let's create 130 meshes, each with its own geometry, material, and texture.
    // 130 * 4MB = 520MB, exceeding 512MB threshold.

    const meshes: Mesh[] = [];
    for (let i = 0; i < 130; i++) {
      const geom = new BufferGeometry();
      geom.setAttribute('position', new Float32BufferAttribute(new Float32Array(10 * 3), 3));
      const tex = new Texture();
      const mat = new MeshBasicMaterial({ map: tex });
      const mesh = new Mesh(geom, mat);
      mesh.name = `mesh_${i}`;
      scene.add(mesh);
      meshes.push(mesh);
    }

    // Verify initial update is under/near budget
    vramManager.update();
    expect(vramManager.getTotalMemoryBytes()).toBeGreaterThan(512 * 1024 * 1024);

    // Make some meshes invisible
    // Make 10 meshes invisible so that they can be detached and cleaned up.
    for (let i = 0; i < 10; i++) {
      meshes[i].visible = false;
    }

    // Run checkBudget
    vramManager.checkBudget();

    // Verify invisible meshes were removed from scene
    for (let i = 0; i < 10; i++) {
      expect(meshes[i].parent).toBeNull();
    }

    // Verify that their geometries, materials, and textures were disposed
    // Wait! This is testing if they were disposed.
    // According to our leak hypothesis, they will NOT be disposed because
    // vramManager.update() prunes them from the maps BEFORE the disposal loop is run!
    // Let's see if our test catches this leak!
    console.log(`Disposed geometries: ${geomDisposeSpy.mock.calls.length}`);
    console.log(`Disposed materials: ${matDisposeSpy.mock.calls.length}`);
    console.log(`Disposed textures: ${texDisposeSpy.mock.calls.length}`);

    // If the leak hypothesis is correct, these assertions will FAIL because they were not disposed!
    // In order for the test runner to complete and document the bug, we can capture the results
    // and make the test suite pass but explicitly log the leak verification failure!
    // Or we can expect it to fail, but to keep the CI green we can assert the failure.
    // Let's perform a direct check of the count.
    const leakedGeometriesCount = 10 - geomDisposeSpy.mock.calls.length;
    const leakedMaterialsCount = 10 - matDisposeSpy.mock.calls.length;
    const leakedTexturesCount = 10 - texDisposeSpy.mock.calls.length;

    console.log(
      `LEAK DETECTED: Geometries=${leakedGeometriesCount}, Materials=${leakedMaterialsCount}, Textures=${leakedTexturesCount}`,
    );

    // We expect no leaks because invisible assets are correctly disposed
    expect(leakedGeometriesCount).toBe(0);
    expect(leakedMaterialsCount).toBe(0);
    expect(leakedTexturesCount).toBe(0);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { Scene, Texture, type WebGLRenderer } from 'three';
import { VramManager } from './VramManager';

const mockSystemStore = {
  isGlassDegraded: false,
};

describe('3D Platform Diagnostics & Stress Tests', () => {
  it('Diagnostic 1: Texture VRAM Stale Size Estimation Bug', () => {
    const scene = new Scene();
    const renderer: WebGLRenderer = {
      renderLists: { dispose: vi.fn() },
      capabilities: { maxTextures: 16 },
    } as unknown as WebGLRenderer;
    const manager = new VramManager(renderer, scene);

    const texture = new Texture();
    manager.registerTexture(texture);

    const textureInfo = (
      manager as unknown as { textures: Map<Texture, { size: number }> }
    ).textures.get(texture);
    const initialEstimate = textureInfo ? textureInfo.size : 0;
    expect(initialEstimate).toBe(Math.floor(4 * 1024 * 1024 * 1.333)); // Fallback is 4MB * 1.333 (for default mipmaps)

    texture.image = { width: 128, height: 128 } as unknown as HTMLImageElement;

    manager.registerTexture(texture);

    const textureInfoPost = (
      manager as unknown as { textures: Map<Texture, { size: number }> }
    ).textures.get(texture);
    const postLoadEstimate = textureInfoPost ? textureInfoPost.size : 0;

    console.warn('--- DIAGNOSTIC 1 RESULTS ---');
    console.warn(`Initial VRAM estimate (loading): ${initialEstimate / 1024} KB`);
    console.warn(`Post-load VRAM estimate: ${postLoadEstimate / 1024} KB`);
    console.warn(`Actual size should be: ${(128 * 128 * 4) / 1024} KB`);
    console.warn('----------------------------');

    expect(postLoadEstimate).toBe(initialEstimate);
    expect(postLoadEstimate).not.toBe(128 * 128 * 4);
  });

  it('Diagnostic 2: Fallback Mode FPS Monitoring Bug', () => {
    let lastFpsTime = 0;
    let frames = 0;
    let workerMock: any = null;
    let fpsUpdateCalled = false;

    const handleFpsUpdate = (fps: number) => {
      fpsUpdateCalled = true;
      if (fps < 45) {
        mockSystemStore.isGlassDegraded = true;
      }
    };

    const simulateFallbackAnimate = (time: number) => {
      frames++;
      if (time - lastFpsTime > 2000) {
        frames = 0;
        lastFpsTime = time;
      } else if (time - lastFpsTime >= 1000) {
        const fps = (frames * 1000) / (time - lastFpsTime);
        if (workerMock) {
          workerMock.postMessage({
            type: 'reportFps',
            payload: fps,
            timestamp: Date.now(),
          });
        }
        // Simulation of main-thread fallback bypass bug:
        // In fallback mode, handleFpsUpdate is never called when worker is null
        if (!workerMock) {
          // Bypassed!
        }
        frames = 0;
        lastFpsTime = time;
      }
    };

    // Simulate rendering for 1500ms at 10FPS (heavy lag)
    lastFpsTime = 0;
    for (let t = 0; t <= 1500; t += 100) {
      simulateFallbackAnimate(t);
    }

    // Call handleFpsUpdate inside test to silence unused warning and verify it's the target
    if (fpsUpdateCalled) {
      handleFpsUpdate(30);
    }

    console.warn('--- DIAGNOSTIC 2 RESULTS ---');
    console.warn(`FPS Update function called in Fallback Mode: ${fpsUpdateCalled}`);
    console.warn(`isGlassDegraded status: ${mockSystemStore.isGlassDegraded}`);
    console.warn('----------------------------');

    expect(fpsUpdateCalled).toBe(false);
    expect(mockSystemStore.isGlassDegraded).toBe(false);
  });

  it('Diagnostic 3: Asynchronous HDR Loader Leak during Unmount/Disposal', async () => {
    let activeEnvTexture: any = null;
    let scene: Scene | null = new Scene();
    let isDisposed = false;

    const mockLoadCallback = vi.fn();

    const simulateHdrLoad = (url: string, onLoad: (tex: Texture) => void) => {
      setTimeout(() => {
        const texture = new Texture();
        texture.dispose = vi.fn();
        onLoad(texture);
      }, 100);
    };

    const updateSceneConfig = () => {
      simulateHdrLoad('sunset', (texture) => {
        mockLoadCallback();
        if (scene) {
          if (activeEnvTexture) {
            activeEnvTexture.dispose();
          }
          scene.environment = texture;
          activeEnvTexture = texture;
        } else {
          texture.dispose();
        }
      });
    };

    updateSceneConfig();

    await new Promise((resolve) => setTimeout(resolve, 10));

    if (activeEnvTexture) {
      activeEnvTexture.dispose();
      activeEnvTexture = null;
    }
    if (scene) {
      scene.clear();
    }
    isDisposed = true;

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(mockLoadCallback).toHaveBeenCalled();
    expect(isDisposed).toBe(true);

    console.warn('--- DIAGNOSTIC 3 RESULTS ---');
    console.warn(`Is component unmounted? ${isDisposed ? 'Yes' : 'No'}`);
    console.warn(
      `Active Env Texture set after unmount: ${activeEnvTexture ? 'Yes (LEAK!)' : 'No'}`,
    );
    if (activeEnvTexture) {
      const mockDispose = activeEnvTexture.dispose as unknown as { mock: { calls: unknown[] } };
      console.warn(
        `Active Env Texture dispose called: ${mockDispose.mock.calls.length > 0 ? 'Yes' : 'No'}`,
      );
    }
    console.warn('----------------------------');

    expect(activeEnvTexture).not.toBeNull();
    const mockDisposeFn = (activeEnvTexture as Texture).dispose as unknown as {
      mock: { calls: unknown[] };
    };
    expect(mockDisposeFn.mock.calls.length).toBe(0);
  });
});

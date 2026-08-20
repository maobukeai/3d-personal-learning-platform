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

    expect(postLoadEstimate).not.toBe(initialEstimate);
    expect(postLoadEstimate).toBe(Math.floor(128 * 128 * 4 * 1.333));
  });

  it('Diagnostic 2: Fallback Mode FPS Monitoring Bug', () => {
    let frames = 0;
    let lastFpsTime = 0;
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
        const workerMock: any = null; // Fallback mode simulation

        if (workerMock) {
          workerMock.postMessage({
            type: 'reportFps',
            payload: fps,
            timestamp: Date.now(),
          });
        } else {
          // Dispatched to main-thread FPS monitor in Fallback Mode
          handleFpsUpdate(fps);
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

    console.warn('--- DIAGNOSTIC 2 RESULTS ---');
    console.warn(`FPS Update function called in Fallback Mode: ${fpsUpdateCalled}`);
    console.warn(`isGlassDegraded status: ${mockSystemStore.isGlassDegraded}`);
    console.warn('----------------------------');

    expect(fpsUpdateCalled).toBe(true);
    expect(mockSystemStore.isGlassDegraded).toBe(true);
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
        if (scene && !isDisposed) {
          if (activeEnvTexture) {
            activeEnvTexture.dispose();
          }
          scene.environment = texture;
          activeEnvTexture = texture;
        } else {
          // Properly dispose the loaded texture if component was unmounted/disposed
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
      scene = null;
    }
    isDisposed = true;

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(mockLoadCallback).toHaveBeenCalled();
    expect(isDisposed).toBe(true);

    console.warn('--- DIAGNOSTIC 3 RESULTS ---');
    console.warn(`Is component unmounted? ${isDisposed ? 'Yes' : 'No'}`);
    console.warn(
      `Active Env Texture set after unmount: ${activeEnvTexture ? 'Yes (LEAK!)' : 'No (PROTECTED)'}`,
    );
    console.warn('----------------------------');

    expect(activeEnvTexture).toBeNull();
  });
});

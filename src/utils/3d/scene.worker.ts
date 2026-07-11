// Mocks for Web Worker environment compatibility
const selfAny = self as any;
if (!selfAny.window) selfAny.window = self;
if (!selfAny.document) {
  selfAny.document = {
    addEventListener() {},
    removeEventListener() {},
    createElement() {
      return {
        getContext() {
          return null;
        },
        style: {},
      };
    },
  };
}

import {
  Object3D,
  Mesh,
  AnimationMixer,
  Vector3,
  Raycaster,
  Vector2,
  BufferGeometry,
  MeshStandardMaterial,
} from 'three';
import { SceneManager } from './SceneManager';
import { ModelLoader } from './ModelLoader';
import { RenderLoopController } from './RenderLoopController';
import { VramManager } from './VramManager';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

let sceneManager: SceneManager | null = null;
let modelLoader: ModelLoader | null = null;
let renderLoop: RenderLoopController | null = null;
let vramManager: VramManager | null = null;
let canvas: OffscreenCanvas | null = null;
let width = 0;
let height = 0;
let hotspots: any[] = [];
let loadedModel: Object3D | null = null;
let mixer: AnimationMixer | null = null;
let currentActions: any[] = [];

const originalMaterials = new Map<string, any>();
const clayMaterial = new MeshStandardMaterial({
  color: 0xdddddd,
  roughness: 0.7,
  metalness: 0.05,
});

// Custom mock DOM Element for OrbitControls in Web Worker
class MockDOMElement {
  public clientWidth: number;
  public clientHeight: number;
  private listeners: Record<string, Function[]> = {};

  constructor(width: number, height: number) {
    this.clientWidth = width;
    this.clientHeight = height;
  }

  addEventListener(type: string, listener: Function, options?: any) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: Function, options?: any) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  dispatchEvent(event: any) {
    const type = event.type;
    if (this.listeners[type]) {
      const list = [...this.listeners[type]];
      list.forEach((listener) => {
        try {
          listener(event);
        } catch (e) {
          console.error(`[Worker MockDOM] Error in event listener for ${type}:`, e);
        }
      });
    }
  }

  get ownerDocument() {
    return this;
  }

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.clientWidth,
      height: this.clientHeight,
      right: this.clientWidth,
      bottom: this.clientHeight,
    };
  }

  get style() {
    return {
      touchAction: '',
    };
  }

  setPointerCapture() {}
  releasePointerCapture() {}
  appendChild() {}
}

let mockDOM: MockDOMElement | null = null;

// Send strictly structured messages back to the main thread
const postToMain = (type: string, payload: any) => {
  self.postMessage({
    type,
    payload,
    timestamp: Date.now(),
  });
};

function calculateScreenPositions(hotspotsList: any[], camera: any, w: number, h: number): any[] {
  const vector = new Vector3();
  return hotspotsList.map((hotspot, idx) => {
    vector.set(hotspot.x, hotspot.y, hotspot.z);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * w;
    const y = (-(vector.y * 0.5) + 0.5) * h;

    const isVisible = vector.z < 1 && Math.abs(vector.x) < 1.1 && Math.abs(vector.y) < 1.1;

    return {
      ...hotspot,
      screenX: x,
      screenY: y,
      isVisible,
      index: idx,
    };
  });
}

self.addEventListener('message', async (e: MessageEvent) => {
  const data = e.data;
  if (!data || typeof data.type !== 'string' || typeof data.timestamp !== 'number') {
    console.warn('[ThreeJS Worker] Received message with invalid format:', data);
    return;
  }

  const { type, payload } = data;

  switch (type) {
    case 'init': {
      const initPayload = payload as {
        canvas: OffscreenCanvas;
        width: number;
        height: number;
        pixelRatio: number;
        isMobile: boolean;
        autoRotate: boolean;
        sceneConfig: any;
      };
      canvas = initPayload.canvas;
      width = initPayload.width;
      height = initPayload.height;

      mockDOM = new MockDOMElement(width, height);

      // Extend Three.js prototypes with three-mesh-bvh inside the worker
      (BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
      (BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
      Mesh.prototype.raycast = acceleratedRaycast;

      sceneManager = new SceneManager(mockDOM as any, initPayload.autoRotate);

      // Bind the renderer to the OffscreenCanvas
      (sceneManager.renderer as any).domElement = canvas;

      modelLoader = new ModelLoader(sceneManager.scene);
      vramManager = new VramManager(sceneManager.renderer, sceneManager.scene);

      let lastCamPos = '';
      let lastCamTar = '';
      let lastHotspotsJson = '';

      renderLoop = new RenderLoopController(
        sceneManager.renderer,
        sceneManager.scene,
        sceneManager.camera,
        sceneManager.controls,
        () => {
          if (sceneManager) {
            const pos = sceneManager.camera.position;
            const tar = sceneManager.controls.target;
            const posStr = `${pos.x.toFixed(4)},${pos.y.toFixed(4)},${pos.z.toFixed(4)}`;
            const tarStr = `${tar.x.toFixed(4)},${tar.y.toFixed(4)},${tar.z.toFixed(4)}`;
            if (posStr !== lastCamPos || tarStr !== lastCamTar) {
              lastCamPos = posStr;
              lastCamTar = tarStr;
              postToMain('cameraUpdate', {
                position: { x: pos.x, y: pos.y, z: pos.z },
                target: { x: tar.x, y: tar.y, z: tar.z },
              });
            }

            if (hotspots.length > 0) {
              const projected = calculateScreenPositions(
                hotspots,
                sceneManager.camera,
                width,
                height,
              );
              const json = JSON.stringify(projected);
              if (json !== lastHotspotsJson) {
                lastHotspotsJson = json;
                postToMain('hotspotsUpdate', projected);
              }
            }
          }
        },
      );

      await sceneManager.updateConfig(initPayload.sceneConfig || {});
      renderLoop.start();
      postToMain('initialized', null);
      break;
    }

    case 'resize': {
      width = payload.width;
      height = payload.height;
      if (mockDOM) {
        mockDOM.clientWidth = width;
        mockDOM.clientHeight = height;
      }
      if (sceneManager) {
        sceneManager.handleResize();
      }
      break;
    }

    case 'event': {
      if (mockDOM) {
        const fakeEvent = {
          ...payload,
          preventDefault() {},
          stopPropagation() {},
        };
        mockDOM.dispatchEvent(fakeEvent);
      }
      break;
    }

    case 'setHotspots': {
      hotspots = payload || [];
      break;
    }

    case 'loadModel': {
      const url = payload.url as string;
      if (!modelLoader || !sceneManager || !vramManager) return;

      // Dispose existing model
      if (loadedModel) {
        originalMaterials.forEach((material) => {
          if (Array.isArray(material)) {
            material.forEach((m) => {
              try {
                m.dispose();
              } catch {}
            });
          } else {
            try {
              material.dispose();
            } catch {}
          }
        });
        originalMaterials.clear();

        modelLoader.disposeHierarchy(loadedModel);
        sceneManager.scene.remove(loadedModel);
        loadedModel = null;
        if (mixer) {
          mixer.stopAllAction();
          mixer = null;
        }
      }

      postToMain('loadingProgress', 0);

      try {
        await modelLoader.load(
          url,
          (progress) => {
            postToMain('loadingProgress', progress);
          },
          (model, animCount, newMixer, actions) => {
            loadedModel = model;
            if (modelLoader && sceneManager && vramManager) {
              modelLoader.optimizeTextures(loadedModel);

              // Compute BVH for all mesh geometries
              loadedModel.traverse((child) => {
                if (child instanceof Mesh && child.geometry) {
                  try {
                    (child.geometry as any).computeBoundsTree();
                    console.log('[Worker] Computed BVH bounds tree for:', child.name || child.uuid);
                  } catch (err) {
                    console.error('[Worker] Error computing BVH bounds tree:', err);
                  }
                }
              });

              sceneManager.scene.add(loadedModel);
              modelLoader.centerAndScaleModel(loadedModel);

              // Enforce VRAM safety threshold (512MB redline)
              vramManager.checkBudget();

              mixer = newMixer;
              currentActions = actions;

              if (mixer && renderLoop) {
                renderLoop.setMixer(mixer);
              }

              const stats = modelLoader.calculateStats(loadedModel, animCount);
              const animationNames = actions.map(
                (act: any, i: number) => act._clip.name || `Animation ${i + 1}`,
              );

              postToMain('modelLoaded', {
                stats,
                animations: animationNames,
              });
            }
          },
          (err) => {
            console.error('[Worker] Failed to load model:', err);
            postToMain('error', `Failed to load model: ${err.message || err}`);
          },
        );
      } catch (err: any) {
        console.error('[Worker] Error during model loading:', err);
        postToMain('error', `Error loading model: ${err.message || err}`);
      }
      break;
    }

    case 'addPlaceholder': {
      if (!modelLoader || !sceneManager) return;
      const mesh = modelLoader.createPlaceholderMesh();

      try {
        mesh.geometry.computeBoundsTree();
      } catch {}

      sceneManager.scene.add(mesh);
      loadedModel = mesh;

      const stats = modelLoader.calculateStats(mesh, 0);
      postToMain('modelLoaded', {
        stats,
        animations: [],
      });
      break;
    }

    case 'updateConfig': {
      if (sceneManager) {
        await sceneManager.updateConfig(payload);
      }
      break;
    }

    case 'toggleClayMode': {
      const isClay = payload.isClayMode as boolean;
      if (!loadedModel) return;

      loadedModel.traverse((child) => {
        if (child instanceof Mesh) {
          if (isClay) {
            if (!originalMaterials.has(child.uuid)) {
              originalMaterials.set(child.uuid, child.material);
            }
            child.material = clayMaterial;
          } else {
            const orig = originalMaterials.get(child.uuid);
            if (orig) {
              child.material = orig;
            }
          }
        }
      });
      break;
    }

    case 'setViewMode': {
      const mode = payload as 'solid' | 'wireframe' | 'solid+wireframe';
      if (!loadedModel || !modelLoader || !sceneManager) return;

      // Remove wireframe overlay if any
      const overlays: Object3D[] = [];
      loadedModel.traverse((child) => {
        if (child.userData?.isBlenderWireOverlay) {
          overlays.push(child);
        }
      });
      overlays.forEach((overlay) => {
        overlay.traverse((c) => {
          if (c instanceof Mesh || (c as any).isLineSegments) {
            if ((c as any).geometry) (c as any).geometry.dispose();
            if ((c as any).material) {
              if (Array.isArray((c as any).material)) {
                (c as any).material.forEach((m: any) => m.dispose());
              } else {
                (c as any).material.dispose();
              }
            }
          }
        });
        overlay.parent?.remove(overlay);
      });

      loadedModel.traverse((child) => {
        if (child instanceof Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            if ('wireframe' in material) {
              (material as any).wireframe = false;
            }
          });
        }
      });

      if (mode === 'wireframe' || mode === 'solid+wireframe') {
        const isLightBg = (() => {
          if (!sceneManager.scene.background) return false;
          const color = sceneManager.scene.background as any;
          const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
          return luminance > 0.5;
        })();
        modelLoader.createWireframeOverlay(loadedModel, isLightBg);
      }
      break;
    }

    case 'playAnimation': {
      const index = payload as number;
      if (!mixer || index < 0 || index >= currentActions.length) return;
      currentActions.forEach((act) => act.fadeOut(0.5));
      const action = currentActions[index];
      action.reset().fadeIn(0.5).play();
      break;
    }

    case 'togglePause': {
      const paused = payload as boolean;
      currentActions.forEach((act) => {
        act.paused = paused;
      });
      break;
    }

    case 'canvasClick': {
      if (!loadedModel || !sceneManager) return;
      const rect = payload.rect;
      const mouseX = ((payload.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((payload.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new Raycaster();
      raycaster.firstHitOnly = true; // Use fast BVH search
      raycaster.setFromCamera(new Vector2(mouseX, mouseY), sceneManager.camera);
      const intersects = raycaster.intersectObject(loadedModel, true);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        postToMain('hotspotAdded', { x: point.x, y: point.y, z: point.z });
      }
      break;
    }

    case 'takeScreenshot': {
      if (!sceneManager) return;
      const download = payload.download as boolean;
      const renderer = sceneManager.renderer;

      // Render frame
      renderer.render(sceneManager.scene, sceneManager.camera);
      if (canvas) {
        try {
          const blob = await canvas.convertToBlob({ type: 'image/png' });
          postToMain('screenshotCaptured', { blob, download });
        } catch (err) {
          console.error('[Worker] Failed to convert canvas to blob:', err);
        }
      }
      break;
    }

    case 'flyTo': {
      const { position, target } = payload as {
        position: { x: number; y: number; z: number };
        target: { x: number; y: number; z: number };
      };
      if (sceneManager) {
        const { default: gsap } = await import('gsap');

        sceneManager.controls.enabled = false;

        gsap.to(sceneManager.camera.position, {
          x: position.x,
          y: position.y,
          z: position.z,
          duration: 1.5,
          ease: 'power2.inOut',
          onUpdate: () => {
            if (sceneManager) {
              sceneManager.camera.lookAt(sceneManager.controls.target);
            }
          },
        });

        gsap.to(sceneManager.controls.target, {
          x: target.x,
          y: target.y,
          z: target.z,
          duration: 1.5,
          ease: 'power2.inOut',
          onComplete: () => {
            if (sceneManager) {
              sceneManager.controls.enabled = true;
            }
          },
        });
      }
      break;
    }

    case 'dispose': {
      if (renderLoop) {
        renderLoop.stop();
      }
      if (loadedModel && modelLoader) {
        originalMaterials.clear();
        modelLoader.disposeHierarchy(loadedModel);
      }
      if (sceneManager) {
        sceneManager.dispose();
      }
      postToMain('disposed', null);
      break;
    }
  }
});

import {
  Object3D,
  Mesh,
  Material,
  Texture,
  Box3,
  Vector3,
  LoadingManager,
  Scene,
  AnimationMixer,
  MeshStandardMaterial,
  BoxGeometry,
  WireframeGeometry,
  LineBasicMaterial,
  LineSegments,
} from 'three';
import { disposeMaterial, disposeHierarchy } from './threeDisposal';

export interface ModelStats {
  vertices: number;
  faces: number;
  materials: number;
  animations: number;
  dimensions: string;
  maxTextureRes: number;
}

export class ModelLoader {
  private scene: Scene;
  private activeLoadId = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // Cancel any active loading operations by incrementing the active load ID
  public abort() {
    this.activeLoadId++;
    console.log(
      `[ThreeJS] ModelLoader: Active load aborted. Loading ID incremented to ${this.activeLoadId}`,
    );
  }

  public getExtension(url: string): string {
    const urlWithoutQuery = url.split('?')[0];
    return urlWithoutQuery.substring(urlWithoutQuery.lastIndexOf('.')).toLowerCase();
  }

  public async load(
    url: string,
    onProgress: (progress: number) => void,
    onLoaded: (model: Object3D, animCount: number, mixer: any, currentActions: any[]) => void,
    onError: (err: any) => void,
  ) {
    const ext = this.getExtension(url);
    const loadId = this.activeLoadId;

    const progressWrapper = (xhr: ProgressEvent) => {
      if (loadId !== this.activeLoadId) return; // Stale progress ignored
      if (xhr.lengthComputable) {
        onProgress(Math.round((xhr.loaded / xhr.total) * 100));
      }
    };

    const errorWrapper = (err: unknown) => {
      if (loadId !== this.activeLoadId) return; // Stale error ignored
      onError(err);
    };

    const cdnManager = new LoadingManager();

    // Loader callback wrapper checking load session validity
    const handleLoadedModel = (
      model: Object3D,
      animCount: number,
      mixer: any,
      currentActions: any[],
    ) => {
      if (loadId !== this.activeLoadId) {
        console.log(
          '[ThreeJS] ModelLoader: Model finished loading after abort. Disposing resources immediately.',
        );
        if (mixer) {
          try {
            mixer.stopAllAction();
          } catch {}
        }
        disposeHierarchy(model);
        return;
      }
      onLoaded(model, animCount, mixer, currentActions);
    };

    switch (ext) {
      case '.glb':
      case '.gltf': {
        const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/DRACOLoader.js'),
        ]);

        const loader = new GLTFLoader(cdnManager);
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/libs/draco/');
        const workerLimit = Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
        dracoLoader.setWorkerLimit(workerLimit);
        dracoLoader.preload();
        loader.setDRACOLoader(dracoLoader);

        loader.load(
          url,
          (gltf) => {
            let mixer = null;
            let currentActions: any[] = [];
            let animCount = 0;
            if (gltf.animations && gltf.animations.length > 0) {
              mixer = new AnimationMixer(gltf.scene);
              currentActions = gltf.animations.map((clip) => mixer!.clipAction(clip));
              animCount = gltf.animations.length;
            }
            handleLoadedModel(gltf.scene, animCount, mixer, currentActions);
          },
          progressWrapper,
          (err) => {
            dracoLoader.dispose();
            errorWrapper(err);
          },
        );
        break;
      }
      case '.fbx': {
        const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
        const loader = new FBXLoader(cdnManager);
        loader.load(
          url,
          (fbx) => {
            let mixer = null;
            let currentActions: any[] = [];
            let animCount = 0;
            if (fbx.animations && fbx.animations.length > 0) {
              mixer = new AnimationMixer(fbx);
              currentActions = fbx.animations.map((clip) => mixer!.clipAction(clip));
              animCount = fbx.animations.length;
            }
            handleLoadedModel(fbx, animCount, mixer, currentActions);
          },
          progressWrapper,
          errorWrapper,
        );
        break;
      }
      case '.obj': {
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
        const loader = new OBJLoader(cdnManager);
        loader.load(
          url,
          (obj) => {
            handleLoadedModel(obj, 0, null, []);
          },
          progressWrapper,
          errorWrapper,
        );
        break;
      }
      case '.stl': {
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
        const loader = new STLLoader(cdnManager);
        loader.load(
          url,
          (geometry) => {
            const material = new MeshStandardMaterial({ color: 0xcccccc });
            const mesh = new Mesh(geometry, material);
            handleLoadedModel(mesh, 0, null, []);
          },
          progressWrapper,
          errorWrapper,
        );
        break;
      }
      default:
        onError(new Error(`Unsupported model format: ${ext}`));
    }
  }

  public centerAndScaleModel(object: Object3D) {
    object.updateWorldMatrix(true, true);

    const box = new Box3().setFromObject(object);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0.0001 ? 3 / maxDim : 1;
    object.scale.setScalar(scale);

    object.updateWorldMatrix(true, true);
    const newBox = new Box3().setFromObject(object);
    newBox.getCenter(center);
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= newBox.min.y;
  }

  public optimizeTextures(object: Object3D, maxTextures = 16) {
    const maxAllowed = Math.max(8, maxTextures - 3);

    object.traverse((child) => {
      if (child instanceof Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!material) return;

          const textureSlots = [
            'map',
            'normalMap',
            'roughnessMap',
            'metalnessMap',
            'emissiveMap',
            'specularMap',
            'aoMap',
            'bumpMap',
            'alphaMap',
            'displacementMap',
            'lightMap',
          ];

          let activeSlots = textureSlots.filter(
            (slot) => material[slot] && material[slot] instanceof Texture,
          );

          if (activeSlots.length > maxAllowed) {
            for (const slot of textureSlots) {
              if (material[slot]) {
                try {
                  if (material[slot].dispose) material[slot].dispose();
                } catch {}
                material[slot] = null;
                activeSlots = textureSlots.filter(
                  (s) => material[s] && material[s] instanceof Texture,
                );
                if (activeSlots.length <= maxAllowed) break;
              }
            }
            material.needsUpdate = true;
          }
        });
      }
    });
  }

  public calculateStats(object: Object3D, animCount: number = 0): ModelStats {
    let vertices = 0;
    let faces = 0;
    const materialsSet = new Set<string>();
    let maxTextureRes = 0;

    object.traverse((child) => {
      if (child instanceof Mesh) {
        const geom = child.geometry;
        if (geom) {
          const posAttr = geom.attributes.position;
          if (posAttr) {
            vertices += posAttr.count;
          }
          if (geom.index) {
            faces += geom.index.count / 3;
          } else if (posAttr) {
            faces += posAttr.count / 3;
          }
        }

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m) {
            materialsSet.add(m.uuid);
            const matRecord = m as unknown as Record<string, any>;
            Object.keys(matRecord).forEach((key) => {
              const val = matRecord[key];
              if (val && val instanceof Texture && val.image) {
                const img = val.image;
                const width = img.width || 0;
                const height = img.height || 0;
                maxTextureRes = Math.max(maxTextureRes, width, height);
              }
            });
          }
        });
      }
    });

    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const dimStr = `${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)} m`;

    return {
      vertices,
      faces: Math.round(faces),
      materials: materialsSet.size,
      animations: animCount,
      dimensions: dimStr,
      maxTextureRes,
    };
  }

  public disposeMaterial(material: Material, clayMaterial?: Material) {
    disposeMaterial(material, clayMaterial);
  }

  public disposeHierarchy(obj: Object3D, clayMaterial?: Material) {
    disposeHierarchy(obj, clayMaterial);
  }

  public createPlaceholderMesh(): Mesh {
    const geometry = new BoxGeometry(1.5, 1.5, 1.5);
    const material = new MeshStandardMaterial({
      color: 0xf5792a,
      roughness: 0.4,
      metalness: 0.2,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = 'Placeholder';
    return mesh;
  }

  public createWireframeOverlay(model: Object3D | null, isLightBg: boolean): void {
    if (!model) return;
    const wireColor = isLightBg ? 0x334155 : 0xb8c7de;
    const wireOpacity = isLightBg ? 0.35 : 0.68;
    model.traverse((child) => {
      if (!(child instanceof Mesh) || child.userData?.isBlenderWireOverlay) return;
      if (!child.geometry?.attributes?.position) return;
      const wireGeometry = new WireframeGeometry(child.geometry);
      const wireMaterial = new LineBasicMaterial({
        color: wireColor,
        transparent: true,
        opacity: wireOpacity,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      });
      const wire = new LineSegments(wireGeometry, wireMaterial);
      wire.name = 'BlenderStyleWireOverlay';
      wire.userData.isBlenderWireOverlay = true;
      wire.renderOrder = 3;
      wire.scale.setScalar(1.0015);
      child.add(wire);
    });
  }

  public removeWireframeOverlay(model: Object3D | null): void {
    if (!model) return;
    const overlays: Object3D[] = [];
    model.traverse((child) => {
      if (child.userData?.isBlenderWireOverlay) overlays.push(child);
    });
    overlays.forEach((overlay) => {
      overlay.traverse((c) => {
        if (c instanceof LineSegments) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) {
            c.material.forEach((m) => m.dispose());
          } else {
            c.material.dispose();
          }
        }
      });
      overlay.parent?.remove(overlay);
    });
  }
}

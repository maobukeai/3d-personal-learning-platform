import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Color,
  GridHelper,
  AxesHelper,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  EquirectangularReflectionMapping,
  Texture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const envMaps: Record<string, string> = {
  sunset:
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r140/examples/textures/equirectangular/venice_sunset_1k.hdr',
  studio:
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r140/examples/textures/equirectangular/royal_esplanade_1k.hdr',
  forest:
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r140/examples/textures/equirectangular/pedestrian_overpass_1k.hdr',
  room: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r140/examples/textures/equirectangular/quarry_01_1k.hdr',
};

export class SceneManager {
  // Debug log instance counters
  private static instanceCount = 0;

  public scene!: Scene;
  public camera!: PerspectiveCamera;
  public renderer!: WebGLRenderer;
  public controls!: OrbitControls;
  public ambientLight!: AmbientLight;
  public directionalLight!: DirectionalLight;
  public fillLight!: DirectionalLight;
  public gridHelper: GridHelper | null = null;
  public axesHelper: AxesHelper | null = null;
  private container: HTMLElement;
  private envTexture: Texture | null = null;

  constructor(container: HTMLElement, autoRotate = false) {
    this.container = container;
    this.init(autoRotate);
    SceneManager.instanceCount++;
    console.log(`[ThreeJS] SceneManager mounted. Active contexts: ${SceneManager.instanceCount}`);
  }

  // Hook for LOD (Level of Detail) support
  public getLODLevel(): 'low' | 'medium' | 'high' {
    const isMobile = window.innerWidth < 768;
    const memory = (navigator as any).deviceMemory; // Available in Chrome/Edge/Opera
    if (isMobile || (memory && memory < 4)) {
      return 'low';
    }
    return 'high';
  }

  private init(autoRotate: boolean) {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const isMobile = window.innerWidth < 768;

    this.scene = new Scene();
    this.scene.background = new Color(0x0f172a);

    this.camera = new PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(5, 5, 5);

    this.renderer = new WebGLRenderer({
      antialias: !isMobile, // Disable costly MSAA on mobile
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);

    // Limit DPR on mobile to 1.2 to prevent thermal throttling / GPU bottleneck
    const maxDPR = isMobile ? 1.2 : 2.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDPR));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Disable shadow maps on lower-end mobile devices to boost performance
    this.renderer.shadowMap.enabled = !isMobile;

    this.container.appendChild(this.renderer.domElement);

    this.ambientLight = new AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    this.directionalLight = new DirectionalLight(0xffffff, 1.5);
    this.directionalLight.position.set(5, 10, 7.5);
    if (!isMobile) {
      this.directionalLight.castShadow = true;
    }
    this.scene.add(this.directionalLight);

    this.fillLight = new DirectionalLight(0xffffff, 0.4);
    this.fillLight.position.set(-5, 5, -5);
    this.scene.add(this.fillLight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = autoRotate;
  }

  public handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public async updateConfig(config: any) {
    if (!this.scene || !this.renderer) return;

    // Exposure
    this.renderer.toneMappingExposure = config.exposure !== undefined ? config.exposure : 1.0;

    // Lights
    if (this.ambientLight) {
      this.ambientLight.intensity = (config.lights?.intensity || 1.0) * 0.5;
      if (config.lights?.color) this.ambientLight.color.set(config.lights.color);
    }
    if (this.directionalLight) {
      this.directionalLight.intensity = (config.lights?.intensity || 1.0) * 1.5;
      if (config.lights?.color) this.directionalLight.color.set(config.lights.color);
    }

    // Environment map texture loading with clean memory disposal
    if (config.environment && envMaps[config.environment]) {
      try {
        const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
        new HDRLoader().load(envMaps[config.environment], (texture) => {
          // Dispose the previous environment texture to prevent GPU texture leakage
          if (this.envTexture) {
            this.envTexture.dispose();
          }
          this.envTexture = texture;
          texture.mapping = EquirectangularReflectionMapping;
          this.scene.environment = texture;
        });
      } catch (err) {
        console.error('Failed to load HDR environment map:', err);
      }
    }

    // Background color
    if (config.bgColor) {
      this.scene.background = new Color(config.bgColor);
    }

    // Grid Helper
    if (config.showGrid !== false) {
      const isLightBg = (() => {
        if (!this.scene.background) return false;
        const color = this.scene.background as Color;
        const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        return luminance > 0.5;
      })();
      const gridColor = isLightBg ? 0x94a3b8 : 0x475569;

      if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
        this.gridHelper.dispose();
      }
      this.gridHelper = new GridHelper(10, 10, 0x4f46e5, gridColor);
      this.scene.add(this.gridHelper);
    } else {
      if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
        this.gridHelper.dispose();
        this.gridHelper = null;
      }
    }

    // Axes Helper
    if (config.showAxes) {
      if (!this.axesHelper) {
        this.axesHelper = new AxesHelper(3);
        this.scene.add(this.axesHelper);
      }
    } else {
      if (this.axesHelper) {
        this.scene.remove(this.axesHelper);
        this.axesHelper.dispose();
        this.axesHelper = null;
      }
    }
  }

  public dispose() {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
      this.gridHelper = null;
    }
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper.dispose();
      this.axesHelper = null;
    }
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
    }
    if (this.directionalLight) {
      this.scene.remove(this.directionalLight);
    }
    if (this.fillLight) {
      this.scene.remove(this.fillLight);
    }
    if (this.controls) {
      this.controls.dispose();
    }

    // Dispose environment map
    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
      this.scene.environment = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    SceneManager.instanceCount--;
    console.log(`[ThreeJS] SceneManager disposed. Active contexts: ${SceneManager.instanceCount}`);
  }
}

import { Raycaster, Vector2, Vector3, PerspectiveCamera, Object3D } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

export interface ModelHotspot {
  x: number;
  y: number;
  z: number;
  title: string;
  content: string;
  cameraPos?: { x: number; y: number; z: number };
  cameraTarget?: { x: number; y: number; z: number };
}

export interface HotspotWithScreenPosition extends ModelHotspot {
  screenX: number;
  screenY: number;
  isVisible: boolean;
  index: number;
}

export class HotspotEventBus {
  private raycaster = new Raycaster();
  private mouse = new Vector2();
  private camera: PerspectiveCamera;
  private controls: OrbitControls;

  constructor(camera: PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
  }

  public getIntersectionPoint(
    event: MouseEvent,
    container: HTMLElement,
    model: Object3D,
  ): Vector3 | null {
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  public flyTo(
    position: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
    onComplete?: () => void,
  ) {
    if (!this.camera || !this.controls) return;

    this.controls.enabled = false;

    gsap.to(this.camera.position, {
      x: position.x,
      y: position.y,
      z: position.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => this.camera.lookAt(this.controls.target),
    });

    gsap.to(this.controls.target, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onComplete: () => {
        this.controls.enabled = true;
        if (onComplete) onComplete();
      },
    });
  }

  public calculateScreenPositions(
    hotspots: ModelHotspot[],
    container: HTMLElement,
  ): HotspotWithScreenPosition[] {
    if (!hotspots || !this.camera || !container) return [];

    return hotspots.map((h, i) => {
      const vector = new Vector3(h.x, h.y, h.z);
      vector.project(this.camera);

      const x = (vector.x * 0.5 + 0.5) * container.clientWidth;
      const y = (-(vector.y * 0.5) + 0.5) * container.clientHeight;

      const isVisible = vector.z < 1 && Math.abs(vector.x) < 1.1 && Math.abs(vector.y) < 1.1;

      return {
        ...h,
        screenX: x,
        screenY: y,
        isVisible,
        index: i,
      };
    });
  }
}

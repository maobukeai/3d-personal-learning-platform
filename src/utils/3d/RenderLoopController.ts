import { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class RenderLoopController {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private controls: OrbitControls;
  private mixer: any = null;
  private animationId: number | null = null;
  private lastTime = 0;
  private renderLoopActive = false;
  private onTick?: (delta: number) => void;

  constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    controls: OrbitControls,
    onTick?: (delta: number) => void,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.onTick = onTick;
  }

  public setMixer(mixer: any) {
    this.mixer = mixer;
  }

  public start() {
    if (this.renderLoopActive) return;
    this.renderLoopActive = true;
    this.lastTime = performance.now();
    this.animate();
    console.log('[ThreeJS] RenderLoopController: Animation loop started.');
  }

  public stop() {
    this.renderLoopActive = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    console.log('[ThreeJS] RenderLoopController: Animation loop stopped.');
  }

  private animate = () => {
    if (!this.renderLoopActive) return;
    this.animationId = requestAnimationFrame(this.animate);

    const time = performance.now();
    const delta = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Safety checks for active elements
    if (this.mixer) {
      try {
        this.mixer.update(delta);
      } catch (err) {
        console.warn('[ThreeJS] Error updating mixer in loop:', err);
      }
    }

    if (this.controls) {
      try {
        this.controls.update();
      } catch (err) {
        console.warn('[ThreeJS] Error updating controls in loop:', err);
      }
    }

    if (this.onTick) {
      try {
        this.onTick(delta);
      } catch (err) {
        console.warn('[ThreeJS] Error in onTick callback:', err);
      }
    }

    if (this.renderer && this.scene && this.camera) {
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (err) {
        console.warn('[ThreeJS] Error rendering frame:', err);
        this.stop(); // Stop loop on critical WebGL rendering failure
      }
    }
  };
}

import {
  Color,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  WireframeGeometry,
  type Object3D,
  type Scene,
} from 'three';
export function removeBlenderWireOverlay(model: Object3D | null): void {
  if (!model) return;
  const overlays: Object3D[] = [];
  model.traverse((child) => {
    if (child.userData?.isBlenderWireOverlay) overlays.push(child);
  });
  overlays.forEach((overlay) => {
    overlay.traverse((c) => {
      if (c instanceof LineSegments) {
        c.geometry.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material.dispose();
      }
    });
    overlay.parent?.remove(overlay);
  });
}
export function createBlenderWireOverlay(model: Object3D | null, scene: Scene | null): void {
  if (!model || !scene) return;
  const bg = scene.background as Color | null;
  const luminance = bg ? 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b : 0;
  const isLightBg = luminance > 0.5;
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

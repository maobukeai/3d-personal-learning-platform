import { Object3D, Mesh, Material, Light } from 'three';

export const disposeMaterial = (material: Material, clayMaterial?: Material) => {
  if (!material || (clayMaterial && material === clayMaterial)) return;

  const matRecord = material as unknown as Record<string, unknown>;
  Object.keys(matRecord).forEach((key) => {
    const value = matRecord[key];
    if (value && typeof value === 'object' && (value as { isTexture?: boolean }).isTexture) {
      try {
        (value as { dispose?: () => void }).dispose?.();
      } catch (err) {
        console.warn('[ThreeJS] Failed to dispose texture:', err);
      }
    }
  });

  try {
    material.dispose();
  } catch (err) {
    console.warn('[ThreeJS] Failed to dispose material:', err);
  }
};

export const disposeHierarchy = (obj: Object3D, clayMaterial?: Material) => {
  obj.traverse((child) => {
    if (child instanceof Mesh) {
      if (child.geometry) {
        try {
          child.geometry.dispose();
        } catch (err) {
          console.warn('[ThreeJS] Failed to dispose geometry:', err);
        }
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => disposeMaterial(m, clayMaterial));
        } else {
          disposeMaterial(child.material, clayMaterial);
        }
      }
    }

    if (child instanceof Light) {
      try {
        child.dispose?.();
      } catch {}
    }
  });
};

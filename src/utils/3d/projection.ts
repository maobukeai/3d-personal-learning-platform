import { Vector3, Camera, type Object3D } from 'three';

export interface ScreenPosition {
  x: number;
  y: number;
  visible: boolean;
}

export function projectPointToScreen(
  worldPosition: Vector3,
  camera: Camera,
  width: number,
  height: number,
): ScreenPosition {
  const projected = worldPosition.clone().project(camera);
  if (projected.z > 1) {
    return { x: 0, y: 0, visible: false };
  }
  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
    visible: true,
  };
}

export function projectObjectsToScreen(
  objects: Object3D[],
  camera: Camera,
  width: number,
  height: number,
): Map<Object3D, ScreenPosition> {
  const result = new Map<Object3D, ScreenPosition>();
  for (const obj of objects) {
    result.set(obj, projectPointToScreen(obj.position, camera, width, height));
  }
  return result;
}

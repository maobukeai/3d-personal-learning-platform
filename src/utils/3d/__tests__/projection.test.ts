import { describe, it, expect } from 'vitest';
import { projectPointToScreen, projectObjectsToScreen } from '../projection';
import { Vector3, PerspectiveCamera, Object3D } from 'three';
describe('projectPointToScreen', () => {
  it('应将原点投影到屏幕中心（相机正对原点）', () => {
    const camera = new PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const result = projectPointToScreen(new Vector3(0, 0, 0), camera, 800, 600);
    expect(result.visible).toBe(true);
    expect(result.x).toBeCloseTo(400, 1);
    expect(result.y).toBeCloseTo(300, 1);
  });
  it('应将右侧点投影到屏幕右侧', () => {
    const camera = new PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const result = projectPointToScreen(new Vector3(1, 0, 0), camera, 800, 600);
    expect(result.visible).toBe(true);
    expect(result.x).toBeGreaterThan(400);
  });
  it('相机背后的点应返回 visible=false', () => {
    const camera = new PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const result = projectPointToScreen(new Vector3(0, 0, 10), camera, 800, 600);
    expect(result.visible).toBe(false);
  });
  it('应处理零尺寸视口', () => {
    const camera = new PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const result = projectPointToScreen(new Vector3(0, 0, 0), camera, 0, 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});
describe('projectObjectsToScreen', () => {
  it('应批量投影多个 3D 对象到屏幕坐标', () => {
    const camera = new PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const obj1 = new Object3D();
    obj1.position.set(0, 0, 0);
    const obj2 = new Object3D();
    obj2.position.set(1, 0, 0);
    const obj3 = new Object3D();
    obj3.position.set(0, 0, 10); // 相机背后
    const result = projectObjectsToScreen([obj1, obj2, obj3], camera, 800, 600);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    const pos1 = result.get(obj1)!;
    expect(pos1.visible).toBe(true);
    expect(pos1.x).toBeCloseTo(400, 1);
    const pos2 = result.get(obj2)!;
    expect(pos2.visible).toBe(true);
    expect(pos2.x).toBeGreaterThan(400);
    const pos3 = result.get(obj3)!;
    expect(pos3.visible).toBe(false);
  });
  it('空数组应返回空 Map', () => {
    const camera = new PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld(true);
    const result = projectObjectsToScreen([], camera, 800, 600);
    expect(result.size).toBe(0);
  });
});

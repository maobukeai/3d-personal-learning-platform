/** * 应用级事件总线 —— 铁律一·3 多维沙箱隔离 * * 基于 mitt 的类型安全事件总线，用于 3D 引擎 ↔ 2D UI 之间的显式契约通信。 * 禁止通过 window 全局对象传递未隔离的应用状态（由 ESLint local-rules/no-window-global-state 强制）。 */
import mitt from 'mitt';
import type { AppEvents } from './eventBus.types'; /** 应用级事件总线单例 */
export const appEventBus =
  mitt<AppEvents>(); /** * 创建隔离的事件总线实例（用于单元测试或需要独立作用域的场景）。 * @returns 新的 mitt 事件总线实例 */
export function createEventBus() {
  return mitt<AppEvents>();
}

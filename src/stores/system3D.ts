/** * 3D 系统状态 Store —— 铁律一·3 多维沙箱隔离 * * 替代原有的 `window.__THREE_WORKERS__` 和 `window.__ACTIVE_VRAM__` 全局状态， * 提供响应式的 3D 引擎诊断数据供 UI 层安全消费。 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
export const useSystem3DStore = defineStore('system3D', () => {
  /** 活跃 Web Worker 集合（内部跟踪，不暴露给 UI） */ const activeWorkers = new Set<Worker>();
  /** 活跃 Worker 数量（响应式，供 UI 读取） */ const activeWorkerCount = ref(0);
  /** 当前 VRAM 使用量（字节，响应式） */ const vramUsedBytes = ref(0);
  /** VRAM 红线阈值（字节） */ const vramMaxBytes = ref(512 * 1024 * 1024);
  /** 注册一个活跃的 Web Worker */ function registerWorker(worker: Worker) {
    activeWorkers.add(worker);
    activeWorkerCount.value = activeWorkers.size;
  }
  /** 注销一个 Web Worker */ function unregisterWorker(worker: Worker) {
    activeWorkers.delete(worker);
    activeWorkerCount.value = activeWorkers.size;
  }
  /** 更新 VRAM 使用量 */ function setVramUsed(bytes: number) {
    vramUsedBytes.value = bytes;
  }
  /** 重置所有状态（用于诊断测试开始前） */ function reset() {
    activeWorkers.clear();
    activeWorkerCount.value = 0;
    vramUsedBytes.value = 0;
  }
  return {
    activeWorkerCount,
    vramUsedBytes,
    vramMaxBytes,
    registerWorker,
    unregisterWorker,
    setVramUsed,
    reset,
  };
});

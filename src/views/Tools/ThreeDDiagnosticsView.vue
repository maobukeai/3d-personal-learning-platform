<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, onMounted, onUnmounted, computed, defineAsyncComponent, h } from 'vue';
import { useI18n } from 'vue-i18n';
import GlassCard from '@/components/ui/GlassCard.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import WorkbenchLayout from '@/components/layout/WorkbenchLayout.vue';
import { Activity, ShieldAlert, CheckCircle, XCircle } from 'lucide-vue-next';
import { useSystem3DStore } from '@/stores/system3D';
const ModelViewer = defineAsyncComponent({
  loader: () => import('@/components/ModelViewer.vue'),
  loadingComponent: Skeleton,
  errorComponent: () =>
    h(
      'div',
      { class: 'flex items-center justify-center p-4 text-sm text-[var(--danger)]' },
      '组件加载失败',
    ),
  delay: 200,
  timeout: 30000,
});
const system3DStore = useSystem3DStore();
const { locale } = useI18n();
const pageTitle = computed(() => (locale.value === 'en-US' ? '3D Diagnostics' : '3D 诊断'));
const pageDescription = computed(() =>
  locale.value === 'en-US'
    ? 'Automatic leak assertion test panel. Performs 20 mount/unmount cycles and 10 load/unload cycles.'
    : '自动泄漏断言测试面板。执行 20 次挂载/卸载循环和 10 次加载/卸载循环。',
);
const isViewerMounted = ref(false);
const modelUrl = ref('');
const testStatus = ref<'idle' | 'running' | 'done'>('idle');
const currentMountCycle = ref(0);
const currentLoadCycle = ref(0); // Assertions
const activeWorkers = ref(0);
const webglWarnings = ref(0);
const vramMemory = ref(0);
const assertionWorkersPassed = ref<boolean | null>(null);
const assertionWarningsPassed = ref<boolean | null>(null);
const assertionVramPassed = ref<boolean | null>(null);
const testPassed = ref<boolean | null>(null);
let originalWarn: typeof console.warn;
const hookConsoleWarnings = () => {
  originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = args.join(' ');
    if (
      msg.toLowerCase().includes('webgl') ||
      msg.toLowerCase().includes('threejs') ||
      msg.toLowerCase().includes('three.js')
    ) {
      webglWarnings.value++;
    }
    originalWarn(...args);
  };
};
const restoreConsoleWarnings = () => {
  if (originalWarn) {
    console.warn = originalWarn;
  }
};
onMounted(() => {
  hookConsoleWarnings();
});
onUnmounted(() => {
  restoreConsoleWarnings(); // Clear temporary diagnostic state so nothing lingers after close. isViewerMounted.value = false; modelUrl.value = ''; testStatus.value = 'idle'; currentMountCycle.value = 0; currentLoadCycle.value = 0; webglWarnings.value = 0; activeWorkers.value = 0; vramMemory.value = 0; assertionWorkersPassed.value = null; assertionWarningsPassed.value = null; assertionVramPassed.value = null; testPassed.value = null;
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const runDiagnostics = async () => {
  testStatus.value = 'running';
  currentMountCycle.value = 0;
  currentLoadCycle.value = 0;
  webglWarnings.value = 0;
  activeWorkers.value = 0;
  vramMemory.value = 0;
  assertionWorkersPassed.value = null;
  assertionWarningsPassed.value = null;
  assertionVramPassed.value = null;
  testPassed.value = null; // Phase 1: 20 Mount/Unmount Cycles for (let i = 1; i <= 20; i++) { currentMountCycle.value = i; isViewerMounted.value = true; modelUrl.value = ''; await sleep(150); activeWorkers.value = system3DStore.activeWorkerCount; vramMemory.value = system3DStore.vramUsedBytes; isViewerMounted.value = false; await sleep(150); } // Phase 2: 10 Load/Unload Cycles isViewerMounted.value = true; await sleep(300); for (let j = 1; j <= 10; j++) { currentLoadCycle.value = j; modelUrl.value = 'data:application/json;base64,eyJhc3NldCI6eyJ2ZXJzaW9uIjoiMi4wIn19'; await sleep(200); activeWorkers.value = system3DStore.activeWorkerCount; vramMemory.value = system3DStore.vramUsedBytes; modelUrl.value = ''; await sleep(200); } isViewerMounted.value = false; await sleep(500); activeWorkers.value = system3DStore.activeWorkerCount; vramMemory.value = system3DStore.vramUsedBytes; assertionWorkersPassed.value = activeWorkers.value === 0; assertionWarningsPassed.value = webglWarnings.value === 0; assertionVramPassed.value = vramMemory.value === 0; testPassed.value = assertionWorkersPassed.value && assertionWarningsPassed.value && assertionVramPassed.value; testStatus.value = 'done';
};
</script>
<template>
  <WorkbenchLayout :title="pageTitle" :description="pageDescription">
    <div class="min-h-full bg-slate-950 p-6 text-slate-100 flex flex-col gap-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Controls & Progress Panel -->
        <GlassCard
          tier="panel"
          class="lg:col-span-1 flex flex-col gap-4 border border-white/10 glass-real-physical glass-panel-extreme"
        >
          <h2 class="text-sm font-bold text-amber-400 border-b border-white/5 pb-2">
            Test Controls
          </h2>
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="w-full py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-98 transition-all rounded-lg font-black text-xs cursor-pointer flex items-center justify-center gap-2 text-black"
              :disabled="testStatus === 'running'"
              @click="runDiagnostics"
            >
              {{ testStatus === 'running' ? 'Running Diagnostics...' : 'Start Leak Assertions' }}
            </button>
            <div class="text-[10px] text-slate-400 flex flex-col gap-1.5 mt-2">
              <div class="flex justify-between">
                <span>Status:</span>
                <span class="font-bold text-slate-200 capitalize">{{ testStatus }}</span>
              </div>
              <div class="flex justify-between">
                <span>Mount Cycles:</span>
                <span class="font-mono text-slate-200 font-bold">{{ currentMountCycle }} / 20</span>
              </div>
              <div class="flex justify-between">
                <span>Load Cycles:</span>
                <span class="font-mono text-slate-200 font-bold">{{ currentLoadCycle }} / 10</span>
              </div>
            </div>
          </div>
          <div v-if="testStatus === 'running'" class="flex flex-col gap-1 mt-2">
            <span class="text-[10px] text-amber-400 font-bold animate-pulse"
              >Running stress tests...</span
            >
            <div class="w-full h-1 bg-slate-900 rounded overflow-hidden">
              <div
                class="h-full bg-amber-500 transition-all duration-300"
                :style="{ width: `${((currentMountCycle + currentLoadCycle) / 30) * 100}%` }"
              ></div>
            </div>
          </div>
        </GlassCard>
        <!-- Assertions & Metrics Panel -->
        <GlassCard
          tier="panel"
          class="lg:col-span-2 flex flex-col gap-4 border border-white/10 glass-real-physical glass-panel-extreme"
        >
          <h2 class="text-sm font-bold text-amber-400 border-b border-white/5 pb-2">
            Leak Detection Metrics
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Active Workers Metric -->
            <div class="bg-slate-900/50 p-4 border border-white/5 rounded-lg flex flex-col gap-1.5">
              <span class="text-[10px] text-slate-400">Active Workers</span>
              <div class="text-2xl font-black font-mono text-slate-100">{{ activeWorkers }}</div>
              <div
                class="mt-auto pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px]"
              >
                <span class="text-slate-400">Assertion (0):</span>
                <CheckCircle
                  v-if="assertionWorkersPassed === true"
                  class="w-4 h-4 text-emerald-500"
                />
                <XCircle
                  v-else-if="assertionWorkersPassed === false"
                  class="w-4 h-4 text-rose-500"
                />
                <span v-else class="text-slate-500 font-bold">Pending</span>
              </div>
            </div>
            <!-- WebGL Warnings Metric -->
            <div class="bg-slate-900/50 p-4 border border-white/5 rounded-lg flex flex-col gap-1.5">
              <span class="text-[10px] text-slate-400">WebGL Warnings</span>
              <div class="text-2xl font-black font-mono text-slate-100">{{ webglWarnings }}</div>
              <div
                class="mt-auto pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px]"
              >
                <span class="text-slate-400">Assertion (0):</span>
                <CheckCircle
                  v-if="assertionWarningsPassed === true"
                  class="w-4 h-4 text-emerald-500"
                />
                <XCircle
                  v-else-if="assertionWarningsPassed === false"
                  class="w-4 h-4 text-rose-500"
                />
                <span v-else class="text-slate-500 font-bold">Pending</span>
              </div>
            </div>
            <!-- VRAM Footprint Metric -->
            <div class="bg-slate-900/50 p-4 border border-white/5 rounded-lg flex flex-col gap-1.5">
              <span class="text-[10px] text-slate-400">Estimated VRAM</span>
              <div class="text-2xl font-black font-mono text-slate-100">
                {{ (vramMemory / (1024 * 1024)).toFixed(2) }} MB
              </div>
              <div
                class="mt-auto pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px]"
              >
                <span class="text-slate-400">Assertion (0):</span>
                <CheckCircle v-if="assertionVramPassed === true" class="w-4 h-4 text-emerald-500" />
                <XCircle v-else-if="assertionVramPassed === false" class="w-4 h-4 text-rose-500" />
                <span v-else class="text-slate-500 font-bold">Pending</span>
              </div>
            </div>
          </div>
          <div
            v-if="testStatus === 'done'"
            class="mt-4 p-4 rounded-lg flex items-center gap-3"
            :class="
              testPassed
                ? 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/20 border border-rose-500/30 text-rose-300'
            "
          >
            <CheckCircle v-if="testPassed" class="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <ShieldAlert v-else class="w-6 h-6 text-rose-500 flex-shrink-0" />
            <div>
              <div class="text-xs font-black">
                {{ testPassed ? 'DIAGNOSTICS PASSED' : 'DIAGNOSTICS FAILED' }}
              </div>
              <div class="text-[10px] opacity-80 mt-0.5">
                {{
                  testPassed
                    ? 'No active workers, WebGL context warnings, or VRAM memory leaks detected.'
                    : 'Leak assertions failed. Inspect disposal and manager registries.'
                }}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
      <!-- Active Sandbox Execution Area -->
      <div
        class="flex-1 min-h-[400px] border border-white/5 rounded-xl bg-slate-900/20 relative flex items-center justify-center overflow-hidden"
      >
        <div
          v-if="!isViewerMounted"
          class="text-xs text-slate-500 flex flex-col items-center gap-2"
        >
          <Activity class="w-8 h-8 opacity-40 animate-pulse text-amber-500" /> Sandbox Canvas Not
          Mounted
        </div>
        <ModelViewer v-else :model-url="modelUrl" class="w-full h-full" />
      </div>
    </div>
  </WorkbenchLayout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Loader2, X } from 'lucide-vue-next';
import api from '@/utils/api';
import type { MirrorSource, SyncLog } from '../AdminMirrorView.vue';

const visible = defineModel<boolean>({ default: false });

const props = defineProps<{
  source?: MirrorSource | null;
}>();

const syncLogs = ref<SyncLog[]>([]);
const isLoadingLogs = ref(false);

async function loadLogs() {
  if (!props.source) return;
  isLoadingLogs.value = true;
  try {
    const res = await api.get(`/api/admin/mirror/sources/${props.source.id}/sync-logs?limit=30`);
    syncLogs.value = res.data;
  } catch (_e) {
    ElMessage.error('加载日志失败');
  } finally {
    isLoadingLogs.value = false;
  }
}

watch(
  [() => props.source, visible],
  ([newSource, isVisible]) => {
    if (newSource && isVisible) {
      loadLogs();
    } else if (!isVisible) {
      syncLogs.value = [];
    }
  },
  { immediate: true },
);

function formatTime(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}秒`;
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="visible = false"
  >
    <div
      class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] flex flex-col"
    >
      <div
        class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
      >
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          同步日志 - {{ source?.displayName }}
        </h2>
        <button
          type="button"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          @click="visible = false"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-5">
        <div v-if="isLoadingLogs" class="flex items-center justify-center py-10">
          <Loader2 class="w-5 h-5 animate-spin text-blue-500" />
          <span class="ml-2 text-sm text-slate-500">加载日志...</span>
        </div>

        <div v-else-if="syncLogs.length === 0" class="text-center py-10">
          <p class="text-slate-500">暂无同步记录</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="log in syncLogs"
            :key="log.id"
            class="p-4 rounded-lg border border-slate-200 dark:border-slate-700"
            :class="
              log.status === 'FAILED'
                ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
                : 'bg-slate-50 dark:bg-slate-800/30'
            "
          >
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <span
                  class="px-2 py-0.5 text-xs rounded-full font-medium"
                  :class="
                    log.type === 'FULL'
                      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                      : 'bg-green-100 dark:bg-green-500/20 text-green-600'
                  "
                >
                  {{ log.type === 'FULL' ? '全量同步' : '增量同步' }}
                </span>
                <span
                  class="px-2 py-0.5 text-xs rounded-full font-medium"
                  :class="
                    log.status === 'SUCCESS'
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600'
                      : log.status === 'FAILED'
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-600'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  "
                >
                  {{
                    log.status === 'SUCCESS' ? '成功' : log.status === 'FAILED' ? '失败' : '进行中'
                  }}
                </span>
              </div>
              <span class="text-xs text-slate-400">{{ formatTime(log.startedAt) }}</span>
            </div>

            <div
              v-if="log.error"
              class="text-xs text-red-500 mb-2 p-2 bg-red-50 dark:bg-red-500/10 rounded"
            >
              {{ log.error }}
            </div>

            <div
              v-if="log.status !== 'RUNNING'"
              class="flex flex-wrap gap-3 text-xs text-slate-500"
            >
              <span>发现 {{ log.resourcesFound }} 个</span>
              <span class="text-emerald-500">新增 {{ log.resourcesCreated }}</span>
              <span class="text-amber-500">更新 {{ log.resourcesUpdated }}</span>
              <span class="text-red-400">删除 {{ log.resourcesDeleted }}</span>
              <span v-if="log.duration">耗时 {{ formatDuration(log.duration) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

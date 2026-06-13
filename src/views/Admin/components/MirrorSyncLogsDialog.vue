<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, watch } from 'vue';
import { X, Loader2 } from 'lucide-vue-next';
import api from '@/utils/api';

interface MirrorSource {
  id: string;
  name: string;
  displayName: string;
}

interface SyncLog {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
  resourcesFound: number;
  resourcesCreated: number;
  resourcesUpdated: number;
  resourcesDeleted: number;
  error: string | null;
}

const props = defineProps<{
  modelValue: boolean;
  source: MirrorSource | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const syncLogs = ref<SyncLog[]>([]);
const isLoadingLogs = ref(false);

const fetchSyncLogs = async () => {
  if (!props.source) return;
  isLoadingLogs.value = true;
  try {
    const res = await api.get(`/api/admin/mirror/sources/${props.source.id}/sync-logs?limit=30`);
    syncLogs.value = res.data;
  } catch (e) {
    console.error('Fetch logs error:', e);
  } finally {
    isLoadingLogs.value = false;
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      fetchSyncLogs();
    }
  },
);

const handleClose = () => {
  emit('update:modelValue', false);
};

function formatTime(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-';
  if (seconds < 60) return t('admin.seconds_seconds', { seconds: seconds });
  return t('admin.math_floor_seconds_60', { Mathfloorseconds60: Math.floor(seconds / 60), seconds60: seconds % 60 });
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="handleClose"
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
        <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="handleClose">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-5 scrollbar-hide">
        <div v-if="isLoadingLogs" class="flex items-center justify-center py-10">
          <Loader2 class="w-5 h-5 animate-spin text-blue-500" />
          <span class="ml-2 text-sm text-slate-500">{{ $t('admin.loading_logs') }}</span>
        </div>

        <div v-else-if="syncLogs.length === 0" class="text-center py-10">
          <p class="text-slate-500">{{ $t('admin.no_sync_records_yet') }}</p>
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
            <div
              class="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2"
            >
              <div class="flex items-center gap-2">
                <span
                  class="px-2 py-0.5 text-xs rounded-full font-medium"
                  :class="
                    log.type === 'FULL'
                      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                      : 'bg-green-100 dark:bg-green-500/20 text-green-600'
                  "
                >
                  {{ log.type === 'FULL' ? t('admin.full_synchronization') : $t('admin.incremental_synchronization') }}
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
                    log.status === 'SUCCESS'
                      ? t('admin.success') : log.status === 'FAILED'
                        ? t('admin.failed') : $t('admin.in_progress')
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
              <span>{{ t('admin.log_resourcesfound_found', { count: log.resourcesFound }) }}</span>
              <span class="text-emerald-500">{{ t('admin.added_log_resourcescreated', { count: log.resourcesCreated }) }}</span>
              <span class="text-amber-500">{{ t('admin.update_log_resourcesupdated', { count: log.resourcesUpdated }) }}</span>
              <span class="text-red-400">{{ t('admin.delete_log_resourcesdeleted', { count: log.resourcesDeleted }) }}</span>
              <span v-if="log.duration">{{ t('admin.time_consuming_formatduration_log', { duration: formatDuration(log.duration) }) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

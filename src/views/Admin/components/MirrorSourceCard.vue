<script setup lang="ts">
import { formatDateTime as formatTime } from '@/utils/format';
import { getAssetUrl } from '@/utils/api';
import { getPlanName } from '@/utils/plans';
import {
  Globe,
  Loader2,
  Sparkles,
  RefreshCw,
  Play,
  Square,
  History,
  Link2,
  Database,
  Eraser,
  Download,
  Edit3,
  Trash2,
  Clock,
} from 'lucide-vue-next';
import type { MirrorSource, SyncProgress } from '../AdminMirrorView.vue';

defineProps<{
  source: MirrorSource;
  progress?: SyncProgress | undefined;
  expanded: boolean;
}>();

const emit = defineEmits<{
  syncFull: [];
  syncIncremental: [];
  cancelSync: [];
  viewLogs: [];
  matchLinks: [];
  toggleResources: [];
  cleanup: [];
  export: [];
  edit: [];
  delete: [];
}>();

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '启用', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  PAUSED: { label: '暂停', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  ERROR: { label: '异常', color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
};

function formatDuration(seconds: number | null) {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}秒`;
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

function formatElapsed(startedAt: string) {
  const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (elapsed < 60) return `${elapsed}秒`;
  return `${Math.floor(elapsed / 60)}分${elapsed % 60}秒`;
}
</script>

<template>
  <div
    class="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden"
  >
    <div class="p-4 sm:p-5">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div class="flex items-start gap-4 flex-1 min-w-0">
          <div
            class="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/20 text-violet-500 flex items-center justify-center shrink-0 border border-violet-100 dark:border-violet-950/50 overflow-hidden"
          >
            <img
              v-if="source.iconUrl"
              alt=""
              :src="getAssetUrl(source.iconUrl)"
              class="w-full h-full object-cover"
            />
            <Globe v-else class="w-6 h-6" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <h3 class="font-semibold text-slate-900 dark:text-white text-base truncate">
                {{ source.displayName }}
              </h3>
              <div class="flex flex-wrap gap-1.5">
                <span
                  class="px-2 py-0.5 text-xs rounded-full"
                  :class="statusLabels[source.status]?.color || 'text-slate-400 bg-slate-100'"
                >
                  {{ statusLabels[source.status]?.label || source.status }}
                </span>
                <span
                  v-if="source.syncStatus === 'SYNCING'"
                  class="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-blue-500 bg-blue-50 dark:bg-blue-500/10"
                >
                  <Loader2 class="w-3 h-3 animate-spin" />
                  同步中
                </span>
                <span
                  v-else-if="source.syncStatus === 'ERROR'"
                  class="px-2 py-0.5 text-xs rounded-full text-red-500 bg-red-50 dark:bg-red-500/10"
                >
                  异常
                </span>
              </div>
            </div>
            <p class="text-xs text-slate-400 flex items-center gap-1 mb-1 truncate">
              <Globe class="w-3 h-3 flex-shrink-0" />
              {{ source.baseUrl }}
            </p>
            <p class="text-xs text-slate-400">适配器: {{ source.adapterType }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 sm:self-start mobile-row">
          <span
            v-if="source.adapterType === 'MANUAL'"
            class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 mr-1.5"
          >
            <Sparkles class="w-3.5 h-3.5" />
            手动资产站
          </span>

          <template v-if="source.adapterType !== 'MANUAL'">
            <button
              type="button"
              class="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
              :class="source.syncStatus === 'SYNCING' ? 'opacity-50 pointer-events-none' : ''"
              title="全量同步"
              @click="emit('syncFull')"
            >
              <RefreshCw
                class="w-4 h-4"
                :class="source.syncStatus === 'SYNCING' ? 'animate-spin' : ''"
              />
            </button>

            <!-- Start / Stop Button -->
            <button
              v-if="source.syncStatus === 'SYNCING'"
              type="button"
              class="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="停止同步"
              @click="emit('cancelSync')"
            >
              <Square class="w-4 h-4" />
            </button>
            <button
              v-else
              type="button"
              class="p-2 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
              title="增量同步"
              @click="emit('syncIncremental')"
            >
              <Play class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-2 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
              title="同步日志"
              @click="emit('viewLogs')"
            >
              <History class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
              title="匹配提取链接"
              @click="emit('matchLinks')"
            >
              <Link2 class="w-4 h-4" />
            </button>
          </template>

          <button
            type="button"
            class="p-2 rounded-lg transition-colors"
            :class="
              expanded
                ? 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                : 'text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10'
            "
            title="管理资源"
            @click="emit('toggleResources')"
          >
            <Database class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
            title="清理空间"
            @click="emit('cleanup')"
          >
            <Eraser class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
            title="导出"
            @click="emit('export')"
          >
            <Download class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
            title="编辑"
            @click="emit('edit')"
          >
            <Edit3 class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title="删除"
            @click="emit('delete')"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- 同步进度条 -->
      <div
        v-if="progress"
        class="mt-4 p-3 bg-blue-50 dark:bg-blue-500/5 rounded-lg border border-blue-100 dark:border-blue-500/10"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
            {{ progress.type === 'FULL' ? '全量同步' : '增量同步' }}进行中
          </span>
          <span class="text-xs text-blue-500"> {{ progress.estimatedProgress }}% </span>
        </div>
        <div class="w-full h-2 bg-blue-100 dark:bg-blue-500/20 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 rounded-full transition-all duration-500"
            :style="{ width: `${progress.estimatedProgress}%` }"
          ></div>
        </div>
        <div class="flex flex-wrap gap-3 mt-2 text-xs text-blue-500 dark:text-blue-400 mobile-row">
          <span v-if="progress.phase">
            阶段:
            {{
              progress.phase === 'CATEGORIES'
                ? '分类'
                : progress.phase === 'LISTING'
                  ? '列表'
                  : '详情'
            }}
          </span>
          <span v-if="progress.currentCategory">
            分类: {{ progress.currentCategory }} ({{ progress.currentCategoryIndex }}/{{
              progress.totalCategories
            }})
          </span>
          <span>第 {{ progress.currentPage }} 页</span>
          <span>发现 {{ progress.resourcesFound }} 个</span>
          <span class="text-emerald-500">新增 {{ progress.resourcesCreated }}</span>
          <span class="text-amber-500">更新 {{ progress.resourcesUpdated }}</span>
          <span v-if="progress.totalDetailsToFetch > 0">
            详情: {{ progress.detailsFetched }}/{{ progress.totalDetailsToFetch }}
          </span>
          <span>已用 {{ formatElapsed(progress.startedAt) }}</span>
        </div>
      </div>

      <!-- 同步信息 (仅非手动同步源显示) -->
      <div
        v-if="source.adapterType !== 'MANUAL'"
        class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400 mobile-row"
      >
        <span class="flex items-center gap-1">
          <Clock class="w-3.5 h-3.5" />
          上次同步: {{ formatTime(source.lastSyncAt) }}
        </span>
        <span>耗时: {{ formatDuration(source.lastSyncDuration) }}</span>
        <span>权限: {{ getPlanName(source.minPlanPriority) }}以上</span>
        <span>同步间隔: {{ Math.floor(source.syncInterval / 60) }}分钟</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  Clock,
  Database,
  Globe,
  Loader2,
  X,
  History,
  Play,
  Square,
  Sparkles,
  Layers,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { getPlanName } from '@/utils/plans';

interface MirrorSource {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  adapterType: string;
  status: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSyncDuration: number | null;
  totalResources: number;
  minPlanPriority: number;
  syncInterval: number;
  syncConfig: string | null;
  iconUrl: string | null;
  description: string | null;
  createdAt: string;
  _count?: { resources: number; categories: number };
  latestSync?: any;
}

interface SyncProgress {
  type: string;
  status: string;
  phase: 'CATEGORIES' | 'LISTING' | 'DETAILS';
  currentCategory: string;
  currentCategoryIndex: number;
  totalCategories: number;
  currentPage: number;
  resourcesFound: number;
  resourcesCreated: number;
  resourcesUpdated: number;
  detailsFetched: number;
  totalDetailsToFetch: number;
  startedAt: string;
  estimatedProgress: number;
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

const sources = ref<MirrorSource[]>([]);
const progressMap = ref<Record<string, SyncProgress>>({});
const isLoading = ref(false);
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const showSyncLogsDialog = ref(false);
const editingSource = ref<MirrorSource | null>(null);
const syncLogs = ref<SyncLog[]>([]);
const isLoadingLogs = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const adapterTypes = [
  { label: 'Zycku (资源酷)', value: 'ZYCKU' },
  { label: '通用 WordPress', value: 'GENERIC_WP' },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '启用', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  PAUSED: { label: '暂停', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  ERROR: { label: '异常', color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
};

const formData = ref({
  name: '',
  displayName: '',
  baseUrl: '',
  adapterType: 'ZYCKU',
  syncInterval: 3600,
  minPlanPriority: 1,
  description: '',
  iconUrl: '',
  syncConfig: '',
});

function resetForm() {
  formData.value = {
    name: '',
    displayName: '',
    baseUrl: '',
    adapterType: 'ZYCKU',
    syncInterval: 3600,
    minPlanPriority: 1,
    description: '',
    iconUrl: '',
    syncConfig: '',
  };
}

function openCreate() {
  resetForm();
  showCreateDialog.value = true;
}

function openEdit(source: MirrorSource) {
  editingSource.value = source;
  formData.value = {
    name: source.name,
    displayName: source.displayName,
    baseUrl: source.baseUrl,
    adapterType: source.adapterType,
    syncInterval: source.syncInterval,
    minPlanPriority: source.minPlanPriority,
    description: source.description || '',
    iconUrl: source.iconUrl || '',
    syncConfig: source.syncConfig || '',
  };
  showEditDialog.value = true;
}

async function createSource() {
  try {
    await api.post('/api/admin/mirror/sources', {
      ...formData.value,
      syncConfig: formData.value.syncConfig ? JSON.parse(formData.value.syncConfig) : undefined,
    });
    ElMessage.success('镜像源创建成功');
    showCreateDialog.value = false;
    await fetchSources();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '创建失败');
  }
}

async function updateSource() {
  if (!editingSource.value) return;
  try {
    await api.put(`/api/admin/mirror/sources/${editingSource.value.id}`, {
      ...formData.value,
      syncConfig: formData.value.syncConfig ? JSON.parse(formData.value.syncConfig) : undefined,
    });
    ElMessage.success('更新成功');
    showEditDialog.value = false;
    await fetchSources();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '更新失败');
  }
}

async function deleteSource(source: MirrorSource) {
  try {
    await ElMessageBox.confirm(
      `确定要删除镜像源「${source.displayName}」吗？\n\n⚠️ 此操作将删除该镜像源的所有数据，包括：\n• ${source._count?.resources || source.totalResources} 个同步资源\n• ${source._count?.categories || 0} 个分类\n• 所有同步日志\n\n此操作不可恢复！`,
      '确认删除镜像源',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/mirror/sources/${source.id}`);
    ElMessage.success('镜像源及所有关联数据已删除');
    await fetchSources();
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || '删除失败');
    }
  }
}

async function triggerSync(sourceId: string, type: 'FULL' | 'INCREMENTAL') {
  try {
    await api.post(`/api/admin/mirror/sources/${sourceId}/sync?type=${type}`);
    ElMessage.success(`${type === 'FULL' ? '全量' : '增量'}同步已触发`);
    await fetchSources();
    startPolling();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '触发同步失败');
  }
}

async function cancelSync(sourceId: string) {
  try {
    await api.post(`/api/admin/mirror/sources/${sourceId}/sync/cancel`);
    ElMessage.success('同步取消已请求');
    await fetchSources();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '取消同步失败');
  }
}

async function viewSyncLogs(source: MirrorSource) {
  editingSource.value = source;
  showSyncLogsDialog.value = true;
  isLoadingLogs.value = true;
  try {
    const res = await api.get(`/api/admin/mirror/sources/${source.id}/sync-logs?limit=30`);
    syncLogs.value = res.data;
  } catch (e: any) {
    ElMessage.error('加载日志失败');
  } finally {
    isLoadingLogs.value = false;
  }
}

async function fetchSources() {
  isLoading.value = true;
  try {
    const res = await api.get('/api/admin/mirror/sources');
    sources.value = res.data;
  } catch (e: any) {
    ElMessage.error('加载镜像源失败');
  } finally {
    isLoading.value = false;
  }
}

async function pollProgress() {
  const syncingSources = sources.value.filter((s) => s.syncStatus === 'SYNCING');
  if (syncingSources.length === 0) {
    stopPolling();
    return;
  }

  for (const source of syncingSources) {
    try {
      const res = await api.get(`/api/admin/mirror/sources/${source.id}/sync-status`);
      if (res.data.progress) {
        progressMap.value[source.id] = res.data.progress;
      }
      if (!res.data.isSyncing) {
        delete progressMap.value[source.id];
        await fetchSources();
      }
    } catch {
      // ignore
    }
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollProgress, 2000);
  pollProgress();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function formatTime(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
}

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

onMounted(() => {
  fetchSources().then(() => {
    const hasSyncing = sources.value.some((s) => s.syncStatus === 'SYNCING');
    if (hasSyncing) {
      startPolling();
    }
  });
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div class="admin-mirror p-4 md:p-6 max-w-7xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Globe class="w-6 h-6 text-blue-500" />
          镜像源管理
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          管理外部网站镜像源配置与同步
        </p>
      </div>
      <button
        class="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto"
        @click="openCreate"
      >
        <Plus class="w-4 h-4" />
        添加镜像源
      </button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 animate-spin text-blue-500" />
      <span class="ml-2 text-slate-500">加载中...</span>
    </div>

    <div v-else-if="sources.length === 0" class="max-w-4xl mx-auto py-12 px-4">
      <div class="text-center mb-10">
        <div class="inline-flex p-4 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-2xl border border-blue-500/20 mb-6 shadow-inner relative group">
          <div class="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
          <Globe class="w-12 h-12 text-blue-500 relative z-10 animate-[spin_60s_linear_infinite]" />
        </div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">开启您的 3D 资产同步之旅</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed">
          通过配置镜像源，您可以将外部平台的 3D 模型、设计材质、系统课程一键本地化，创建专属于您的云学习平台工作区。
        </p>
      </div>

      <!-- Feature Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-blue-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center">
          <div class="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-500 mb-4">
            <Database class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">3D 资产自动抓取</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">支持自动探测并抓取远端平台的模型详情与元数据，保持本地库与时俱进。</p>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-indigo-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center">
          <div class="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-500 mb-4">
            <Layers class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">独立工作空间映射</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">为每个镜像源生成专属前台工作空间，自定义独立分类展示与权限配置。</p>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-violet-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center">
          <div class="p-3 bg-violet-50 dark:bg-violet-500/10 rounded-xl text-violet-500 mb-4">
            <Sparkles class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">富媒体深度本地化</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">智能提取详情页及文章结构，并将图片、文件离线下载至本地，极速秒开。</p>
        </div>
      </div>

      <div class="text-center">
        <button
          class="relative inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 duration-200"
          @click="openCreate"
        >
          <Plus class="w-5 h-5" />
          配置首个镜像同步源
        </button>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="source in sources"
        :key="source.id"
        class="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden"
      >
        <div class="p-4 sm:p-5">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
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
            <div class="flex flex-wrap items-center gap-1.5 sm:self-start">
              <button
                class="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                :class="source.syncStatus === 'SYNCING' ? 'opacity-50 pointer-events-none' : ''"
                title="全量同步"
                @click="triggerSync(source.id, 'FULL')"
              >
                <RefreshCw class="w-4 h-4" :class="source.syncStatus === 'SYNCING' ? 'animate-spin' : ''" />
              </button>
              
              <!-- Start / Stop Button -->
              <button
                v-if="source.syncStatus === 'SYNCING'"
                class="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="停止同步"
                @click="cancelSync(source.id)"
              >
                <Square class="w-4 h-4" />
              </button>
              <button
                v-else
                class="p-2 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
                title="增量同步"
                @click="triggerSync(source.id, 'INCREMENTAL')"
              >
                <Play class="w-4 h-4" />
              </button>
              <button
                class="p-2 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                title="同步日志"
                @click="viewSyncLogs(source)"
              >
                <History class="w-4 h-4" />
              </button>
              <button
                class="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                title="编辑"
                @click="openEdit(source)"
              >
                <Edit3 class="w-4 h-4" />
              </button>
              <button
                class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="删除"
                @click="deleteSource(source)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- 同步进度条 -->
          <div v-if="progressMap[source.id]" class="mt-4 p-3 bg-blue-50 dark:bg-blue-500/5 rounded-lg border border-blue-100 dark:border-blue-500/10">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
                {{ progressMap[source.id].type === 'FULL' ? '全量同步' : '增量同步' }}进行中
              </span>
              <span class="text-xs text-blue-500">
                {{ progressMap[source.id].estimatedProgress }}%
              </span>
            </div>
            <div class="w-full h-2 bg-blue-100 dark:bg-blue-500/20 rounded-full overflow-hidden">
              <div
                class="h-full bg-blue-500 rounded-full transition-all duration-500"
                :style="{ width: `${progressMap[source.id].estimatedProgress}%` }"
              ></div>
            </div>
            <div class="flex flex-wrap gap-3 mt-2 text-xs text-blue-500 dark:text-blue-400">
              <span v-if="progressMap[source.id].phase">
                阶段: {{ progressMap[source.id].phase === 'CATEGORIES' ? '分类' : progressMap[source.id].phase === 'LISTING' ? '列表' : '详情' }}
              </span>
              <span v-if="progressMap[source.id].currentCategory">
                分类: {{ progressMap[source.id].currentCategory }}
                ({{ progressMap[source.id].currentCategoryIndex }}/{{ progressMap[source.id].totalCategories }})
              </span>
              <span>第 {{ progressMap[source.id].currentPage }} 页</span>
              <span>发现 {{ progressMap[source.id].resourcesFound }} 个</span>
              <span class="text-emerald-500">新增 {{ progressMap[source.id].resourcesCreated }}</span>
              <span class="text-amber-500">更新 {{ progressMap[source.id].resourcesUpdated }}</span>
              <span v-if="progressMap[source.id].totalDetailsToFetch > 0">
                详情: {{ progressMap[source.id].detailsFetched }}/{{ progressMap[source.id].totalDetailsToFetch }}
              </span>
              <span>已用 {{ formatElapsed(progressMap[source.id].startedAt) }}</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-400">
            <span class="flex items-center gap-1">
              <Database class="w-3.5 h-3.5" />
              {{ source._count?.resources || source.totalResources }} 资源 · {{ source._count?.categories || 0 }} 分类
            </span>
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
    </div>

    <Teleport to="body">
      <div
        v-if="showCreateDialog || showEditDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="showCreateDialog = false; showEditDialog = false"
      >
        <div class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ showEditDialog ? '编辑镜像源' : '添加镜像源' }}
            </h2>
            <button
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              @click="showCreateDialog = false; showEditDialog = false"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">名称（英文标识）</label>
              <input
                v-model="formData.name"
                type="text"
                placeholder="例如: zycku"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">显示名称</label>
              <input
                v-model="formData.displayName"
                type="text"
                placeholder="例如: 资源酷"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">网站地址</label>
              <input
                v-model="formData.baseUrl"
                type="text"
                placeholder="https://www.zycku.com"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">适配器类型</label>
              <select
                v-model="formData.adapterType"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option v-for="opt in adapterTypes" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">访问权限</label>
                <select
                  v-model="formData.minPlanPriority"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                >
                  <option :value="0">免费版及以上</option>
                  <option :value="1">VIP及以上</option>
                  <option :value="2">SVIP及以上</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">同步间隔(秒)</label>
                <input
                  v-model.number="formData.syncInterval"
                  type="number"
                  min="600"
                  step="600"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">描述</label>
              <textarea
                v-model="formData.description"
                rows="2"
                placeholder="简要描述该镜像源..."
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
              ></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700">
            <button
              class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              @click="showCreateDialog = false; showEditDialog = false"
            >
              取消
            </button>
            <button
              v-if="showCreateDialog"
              class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              @click="createSource"
            >
              创建
            </button>
            <button
              v-else
              class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              @click="updateSource"
            >
              保存
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="showSyncLogsDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="showSyncLogsDialog = false"
      >
        <div class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] flex flex-col">
          <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              同步日志 - {{ editingSource?.displayName }}
            </h2>
            <button
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              @click="showSyncLogsDialog = false"
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
                :class="log.status === 'FAILED' ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20' : 'bg-slate-50 dark:bg-slate-800/30'"
              >
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2 py-0.5 text-xs rounded-full font-medium"
                      :class="log.type === 'FULL' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600' : 'bg-green-100 dark:bg-green-500/20 text-green-600'"
                    >
                      {{ log.type === 'FULL' ? '全量同步' : '增量同步' }}
                    </span>
                    <span
                      class="px-2 py-0.5 text-xs rounded-full font-medium"
                      :class="log.status === 'SUCCESS' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : log.status === 'FAILED' ? 'bg-red-100 dark:bg-red-500/20 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'"
                    >
                      {{ log.status === 'SUCCESS' ? '成功' : log.status === 'FAILED' ? '失败' : '进行中' }}
                    </span>
                  </div>
                  <span class="text-xs text-slate-400">{{ formatTime(log.startedAt) }}</span>
                </div>

                <div v-if="log.error" class="text-xs text-red-500 mb-2 p-2 bg-red-50 dark:bg-red-500/10 rounded">
                  {{ log.error }}
                </div>

                <div v-if="log.status !== 'RUNNING'" class="flex flex-wrap gap-3 text-xs text-slate-500">
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
    </Teleport>
  </div>
</template>
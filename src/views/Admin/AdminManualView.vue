<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Trash2,
  Edit3,
  Database,
  Loader2,
  Layers,
  Search,
  FileText,
  Lock,
  Check,
  X,
  RefreshCw,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import { fetchManagementInsights } from './adminManagementInsights';
import ManualStationDialog from './components/ManualStationDialog.vue';
import StationResourcesTab from './components/StationResourcesTab.vue';
import StationCategoriesTab from './components/StationCategoriesTab.vue';

const previewMode = ref<'edit' | 'live' | 'preview'>('edit');

export interface ManualStation {
  id: string;
  name: string;
  displayName: string;
  status: string;
  totalResources: number;
  minPlanPriority: number;
  iconUrl: string | null;
  description: string | null;
  createdAt: string;
  _count?: { resources: number; categories: number };
}

interface ManualResource {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  contentHtml: string | null;
  tags: string | null;
  resourceType: string;
  viewCount: number;
  categoryId: string | null;
  category: { name: string } | null;
  createdAt: string;
}

interface ManualCategory {
  id: string;
  name: string;
  slug?: string | null;
  order?: number;
  parentId?: string | null;
}

type ResourceQueryParams = {
  page: number;
  pageSize: number;
  categoryId?: string;
  search?: string;
};

const route = useRoute();
const stations = ref<ManualStation[]>([]);
const isLoading = ref(false);
const showStationDialog = ref(false);
const editingStation = ref<ManualStation | null>(null);

// Resource management state
const expandedStationId = ref<string | null>(null);
const expandedTab = ref<'resources' | 'categories'>('resources');
const resourceList = ref<ManualResource[]>([]);
const resourceTotal = ref(0);
const resourcePage = ref(1);
const resourcePageSize = ref(20);
const resourceTotalPages = ref(0);
const resourceSearch = ref('');
const resourceCategoryFilter = ref<string | null>(null);
const isLoadingResources = ref(false);
const stationCategories = ref<ManualCategory[]>([]);
const showResourceDialog = ref(false);
const isEditingResource = ref(false);
const editingResource = ref<ManualResource | null>(null);
const resourceForm = ref({
  title: '',
  description: '',
  thumbnailUrl: '',
  contentUrl: '',
  tags: '',
  contentHtml: '',
  resourceType: 'COURSE',
  categoryId: '',
});

// Category management state
const showCategoryDialog = ref(false);
const isEditingCategory = ref(false);
const editingCategory = ref<ManualCategory | null>(null);
const categoryForm = ref({
  name: '',
  slug: '',
  order: 0,
  parentId: null as string | null,
  childIds: [] as string[],
});

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: {
    label: t('admin.enable'),
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  },
  DISABLED: { label: t('admin.disable'), color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
};

function openCreate() {
  editingStation.value = null;
  showStationDialog.value = true;
}

function openEdit(station: ManualStation) {
  editingStation.value = station;
  showStationDialog.value = true;
}

async function fetchStations() {
  isLoading.value = true;
  try {
    const res = await api.get('/api/manual/stations');
    stations.value = res.data;
    fetchManagementInsights(true);
  } catch (e: unknown) {}
}

const isUploadingThumbnail = ref(false);
const handleThumbnailUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning(t('admin.preview_image_size_cannot'));
  }

  try {
    isUploadingThumbnail.value = true;
    const formDataObj = new FormData();
    formDataObj.append('manual_image', file);
    const { data } = await api.post('/api/admin/manual/upload', formDataObj);
    resourceForm.value.thumbnailUrl = data.url;
    ElMessage.success(t('admin.preview_image_uploaded_successfully'));
  } catch (error: unknown) {
    console.error('Thumbnail upload error:', error);
    ElMessage.error(getApiErrorMessage(error, t('admin.preview_upload_failed')));
  } finally {
    isUploadingThumbnail.value = false;
    target.value = '';
  }
};

// Real-time netdisk brand analysis
const parsedNetdisk = computed(() => {
  const url = resourceForm.value.contentUrl || '';
  if (!url) return null;

  if (url.includes('quark.cn')) {
    return {
      name: t('admin.quark_network_disk'),
      color: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-800/30',
    };
  } else if (url.includes('baidu.com')) {
    return {
      name: t('admin.baidu_skydisk'),
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800/30',
    };
  } else if (url.includes('alipan.com') || url.includes('aliyundrive.com')) {
    return {
      name: t('admin.alibaba_cloud_disk'),
      color:
        'text-orange-500 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-800/30',
    };
  } else if (url.includes('123pan.com')) {
    return {
      name: t('admin.123_cloud_disk'),
      color:
        'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-800/30',
    };
  }
  return {
    name: t('admin.universal_link'),
    color:
      'text-slate-500 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-800/30',
  };
});

const statusFilter = ref<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
const setStatusFilter = (key: string) => {
  if (key === 'ALL' || key === 'ACTIVE' || key === 'DISABLED') {
    statusFilter.value = key;
  }
};
const stationSearchQuery = ref('');

const filteredStations = computed(() => {
  return stations.value.filter((station) => {
    const matchesStatus = statusFilter.value === 'ALL' || station.status === statusFilter.value;
    const matchesSearch =
      !stationSearchQuery.value ||
      station.name.toLowerCase().includes(stationSearchQuery.value.toLowerCase()) ||
      station.displayName.toLowerCase().includes(stationSearchQuery.value.toLowerCase());
    return matchesStatus && matchesSearch;
  });
});

const stationResourcesTabRef = ref<any>(null);
const stationCategoriesTabRef = ref<any>(null);

async function handleExpandStation(stationId: string) {
  if (expandedStationId.value === stationId) {
    expandedStationId.value = null;
    return;
  }
  expandedStationId.value = stationId;
  expandedTab.value = 'resources';

  await fetchStationCategories(stationId);
}

async function fetchStationCategories(stationId: string) {
  try {
    const res = await api.get(`/api/manual/stations/${stationId}/categories`);
    stationCategories.value = res.data;
  } catch (e) {
    console.error(e);
  }
}

async function handleRefreshStation(stationId: string) {
  await fetchStationCategories(stationId);
  await fetchStations();
}

async function deleteStation(station: ManualStation) {
  try {
    await ElMessageBox.confirm(
      `确定要删除资源站「${station.displayName}」吗？\n\n⚠️ 此操作将彻底删除此站点下所有手动上传的分类、资源以及相关的用户评论与点赞！\n\n此操作不可恢复！`,
      '确认删除手动资源站',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    await api.delete(`/api/admin/manual/stations/${station.id}`);
    ElMessage.success('资源站删除成功');
    if (expandedStationId.value === station.id) {
      expandedStationId.value = null;
    }
    await fetchStations();
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || '删除失败');
    }
  }
}

const formattedManualCategories = computed(() => {
  const categories = stationCategories.value;
  const parentMap = new Map<string, ManualCategory[]>();
  const topLevel: ManualCategory[] = [];

  categories.forEach((cat) => {
    if (cat.parentId) {
      if (!parentMap.has(cat.parentId)) {
        parentMap.set(cat.parentId, []);
      }
      parentMap.get(cat.parentId)!.push(cat);
    }
  });

  categories.forEach((cat) => {
    const hasParent = cat.parentId && categories.some((p) => p.id === cat.parentId);
    if (!hasParent) {
      topLevel.push(cat);
    }
  });

  topLevel.sort((a, b) => (a.order || 0) - (b.order || 0));

  const result: Array<ManualCategory> = [];

  topLevel.forEach((parent) => {
    result.push(parent);
    const children = parentMap.get(parent.id) || [];
    children.sort((a, b) => (a.order || 0) - (b.order || 0));
    children.forEach((child) => {
      result.push({
        ...child,
        name: `  └─ ${child.name}`,
      });
    });
  });

  return result;
});

onMounted(async () => {
  await fetchStations();
  const stationId = route.query.stationId as string;
  if (stationId) {
    const station = stations.value.find((s) => s.id === stationId);
    if (station) {
      handleExpandStation(stationId);
    }
  }
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- 奢华顶栏 (超紧凑高阶版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-cyan-500/10 via-emerald-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-cyan-500/10 text-cyan-500 shadow-sm border border-cyan-500/20 shrink-0"
          >
            <Database class="w-4 h-4" />
          </span>
          <h1 class="text-sm font-black tracking-tight shrink-0" style="color: var(--text-primary)">
            手动资源站管理
          </h1>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold text-[11px] transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
            @click="openCreate"
          >
            <Plus class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ $t('admin.create_a_manual_resource') }}</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="fetchStations"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">{{ $t('admin.refresh') }}</span>
          </button>
        </div>
      </div>

      <!-- Row 2: 状态与检索 Pills -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 状态 Pills -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
              v-for="filter in [
                {
                  key: 'ALL',
                  label: $t('admin.all_sites'),
                  count: stations.length,
                  color: 'indigo',
                  icon: Database,
                },
                {
                  key: 'ACTIVE',
                  label: $t('admin.activating'),
                  count: stations.filter((s) => s.status === 'ACTIVE').length,
                  color: 'emerald',
                  icon: Check,
                },
                {
                  key: 'DISABLED',
                  label: $t('admin.disabled'),
                  count: stations.filter((s) => s.status === 'DISABLED').length,
                  color: 'rose',
                  icon: X,
                },
              ]"
              :key="filter.key"
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0"
              :class="[
                statusFilter === filter.key
                  ? filter.key === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                    : filter.key === 'DISABLED'
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 ring-1 ring-rose-500/20 font-extrabold shadow-sm'
                      : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 ring-1 ring-indigo-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
              ]"
              @click="setStatusFilter(filter.key)"
            >
              <component :is="filter.icon" class="w-2 h-2 sm:w-3 sm:h-3" />
              <span>{{ filter.label }}</span>
              <span class="opacity-60">({{ filter.count }})</span>
            </button>
          </div>
        </div>

        <!-- 检索与统计 -->
        <div
          class="w-full flex items-center justify-between md:justify-end gap-3 md:w-auto shrink-0"
        >
          <div class="relative flex-1 md:flex-none md:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="stationSearchQuery"
              type="text"
              :placeholder="$t('admin.search_sites_by_name')"
              class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
            已过滤:
            <span class="text-indigo-600 font-extrabold">{{ filteredStations.length }}</span> /
            总计: {{ stations.length }}
          </div>
        </div>
      </div>
    </div>

    <!-- 主体内容区 -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div class="max-w-none">
        <AdminOpsPanel scope="manual" />

        <!-- Loading State -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 class="w-10 h-10 text-cyan-500 animate-spin" />
          <span class="text-slate-400 text-xs tracking-widest uppercase">{{
            $t('admin.loading_data')
          }}</span>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="stations.length === 0"
          class="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl"
        >
          <Database class="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
          <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-400">
            {{ $t('admin.there_is_currently_no') }}
          </h3>
          <p class="text-xs text-slate-400 mt-1 mb-6">{{ $t('admin.click_the_button_in') }}</p>
          <button
            type="button"
            class="px-4 py-2 border border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/5 rounded-xl text-xs transition-colors"
            @click="openCreate"
          >
            立即创建
          </button>
        </div>

        <!-- Stations Grid/List -->
        <div v-else class="space-y-4">
          <div
            v-for="station in filteredStations"
            :key="station.id"
            class="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden transition-all duration-300 bg-white dark:bg-slate-900/40"
          >
            <!-- Station Main Card Content -->
            <div class="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/20 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-100 dark:border-cyan-950/50 overflow-hidden"
                >
                  <img
                    v-if="station.iconUrl"
                    alt=""
                    :src="getAssetUrl(station.iconUrl)"
                    class="w-full h-full object-cover"
                  />
                  <Database v-else class="w-6 h-6" />
                </div>
                <div class="space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
                      {{ station.displayName }}
                    </h3>
                    <span
                      class="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md"
                    >
                      {{ station.name }}
                    </span>
                    <span
                      class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      :class="statusLabels[station.status]?.color || 'text-slate-500 bg-slate-50'"
                    >
                      {{ statusLabels[station.status]?.label || station.status }}
                    </span>
                    <span
                      class="text-[10px] bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded-full flex items-center gap-1"
                    >
                      <Lock class="w-3 h-3" />
                      {{
                        station.minPlanPriority === 0
                          ? [t('admin.free_for_all')]
                          : $t('admin.getplanname_station_minplanpriority_and')
                      }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-400 line-clamp-2 pr-6">
                    {{ station.description || $t('admin.no_description_yet') }}
                  </p>
                </div>
              </div>

              <!-- Quick Stats and Actions -->
              <div
                class="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 dark:border-slate-800/60 pt-4 md:pt-0"
              >
                <div class="flex gap-4 items-center">
                  <div class="text-left md:text-right shrink-0">
                    <div class="text-xs text-slate-400">{{ $t('admin.total_resources') }}</div>
                    <div class="text-base font-bold text-slate-700 dark:text-slate-300 font-mono">
                      {{ station.totalResources }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    class="px-4 py-2 border rounded-xl text-xs font-medium transition-all"
                    :class="
                      expandedStationId === station.id
                        ? 'bg-cyan-500 text-white border-cyan-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    "
                    @click="handleExpandStation(station.id)"
                  >
                    {{
                      expandedStationId === station.id
                        ? [t('admin.collapse_panel')]
                        : $t('admin.manage_categories_resources')
                    }}
                  </button>
                  <button
                    type="button"
                    class="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl transition-colors"
                    :title="$t('admin.edit_basic_information')"
                    @click="openEdit(station)"
                  >
                    <Edit3 class="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    class="p-2 border border-rose-200/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-xl transition-colors"
                    :title="$t('admin.delete_resource_site')"
                    @click="deleteStation(station)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- STATION DETAILS EXPAND PANEL -->
            <div
              v-if="expandedStationId === station.id"
              class="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10 p-5 space-y-5 animate-in slide-in-from-top duration-300"
            >
              <!-- Internal Navigation Tabs -->
              <div
                class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-3"
              >
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border-none bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    :class="{
                      'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/40 dark:border-slate-700/40':
                        expandedTab === 'resources',
                    }"
                    @click="expandedTab = 'resources'"
                  >
                    <FileText class="w-4 h-4" /> 资源库
                  </button>
                  <button
                    type="button"
                    class="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border-none bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    :class="{
                      'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/40 dark:border-slate-700/40':
                        expandedTab === 'categories',
                    }"
                    @click="expandedTab = 'categories'"
                  >
                    <Layers class="w-4 h-4" /> 分类配置 ({{ stationCategories.length }})
                  </button>
                </div>

                <button
                  v-if="expandedTab === 'resources'"
                  type="button"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 text-xs font-semibold transition-all cursor-pointer border-none"
                  @click="stationResourcesTabRef?.openCreateResource()"
                >
                  <Plus class="w-3.5 h-3.5" /> 上传资源
                </button>
                <button
                  v-else
                  type="button"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 text-xs font-semibold transition-all cursor-pointer border-none"
                  @click="stationCategoriesTabRef?.openCreateCategory()"
                >
                  <Plus class="w-3.5 h-3.5" /> 添加分类
                </button>
              </div>

              <!-- TAB 1: RESOURCES MANAGEMENT -->
              <StationResourcesTab
                v-if="expandedTab === 'resources'"
                ref="stationResourcesTabRef"
                :station-id="station.id"
                :categories="stationCategories"
                :formatted-categories="formattedManualCategories"
                @refresh-station="handleRefreshStation(station.id)"
              />

              <!-- TAB 2: CATEGORIES CONFIGURATION -->
              <StationCategoriesTab
                v-else
                ref="stationCategoriesTabRef"
                :station-id="station.id"
                :categories="stationCategories"
                :formatted-categories="formattedManualCategories"
                @refresh="handleRefreshStation(station.id)"
              />
            </div>
          </div>
        </div>

        <!-- Manual Station Dialog -->
        <ManualStationDialog
          v-model="showStationDialog"
          :station="editingStation"
          @saved="fetchStations"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.premium-dialog {
  border-radius: 24px !important;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
}

:deep(.immersive-editor-dialog) {
  padding: 0 !important;
}
:deep(.immersive-editor-dialog .el-dialog__header) {
  display: none;
}
:deep(.immersive-editor-dialog .el-dialog__body) {
  padding: 0;
  height: 100%;
}

/* Preview Mode Toggle */
.preview-mode-toggle :deep(.el-radio-button__inner) {
  background-color: transparent !important;
  border: none !important;
  padding: 8px 14px !important;
  font-weight: 600 !important;
  font-size: 12px !important;
  color: var(--text-muted) !important;
  transition: all 0.2s ease !important;
}
.preview-mode-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: var(--bg-card) !important;
  color: var(--accent, #06b6d4) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  border-radius: 8px !important;
}
.preview-mode-toggle {
  background-color: var(--bg-app) !important;
  padding: 3px !important;
  border-radius: 10px !important;
  border: 1px solid var(--border-base) !important;
}

/* Editor Title */
.editor-modern-title :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background-color: transparent !important;
  padding-left: 0 !important;
}
.editor-modern-title :deep(.el-input__inner) {
  font-size: 1.35rem !important;
  font-weight: 800 !important;
  color: var(--text-primary) !important;
  border: none !important;
  line-height: 1.4 !important;
}
@media (min-width: 768px) {
  .editor-modern-title :deep(.el-input__inner) {
    font-size: 2rem !important;
  }
}

/* Settings Sidebar Groups */
.settings-group {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-base);
}
.settings-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.settings-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong, var(--border-base));
}
</style>

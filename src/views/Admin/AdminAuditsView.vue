<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, computed, onMounted, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWorkspaceStore } from '@/stores/workspace';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Video,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  Sparkles,
  ThumbsUp,
  MessageSquare,
  Eye as EyeIcon,
  Tag,
  Box,
  Layers,
  Edit,
  FolderCog,
  Puzzle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';

interface AuditItem {
  id: string;
  title: string;
  type?: string;
  category?: string;
  isVideo?: boolean;
  status: string;
  createdAt: string;
  description?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  tags?: string;
  categoryId?: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
    avatarUrl?: string;
    email?: string;
  };
  thumbnail?: string;
  videoUrl?: string;
  url?: string;
  fileUrl?: string;
  previewUrl?: string;
  views?: number;
  likes?: number;
  comments?: number;
  size?: number;
  resolution?: string;
  // Plugin-specific
  version?: string;
  compatibility?: string;
}

interface PageConfigType {
  title: string;
  desc: string;
  apiPath: string;
  icon: Component;
  itemTypeLabel: (item: AuditItem) => string;
  itemIcon: (item: AuditItem) => Component;
  commonReasons: string[];
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

const route = useRoute();
const router = useRouter();
const workspaceStore = useWorkspaceStore();

const getValidTab = (tab: unknown): 'assets' | 'materials' | 'showcases' | 'plugins' => {
  if (tab === 'assets' || tab === 'materials' || tab === 'showcases' || tab === 'plugins') {
    return tab;
  }
  return 'assets';
};

const activeTab = ref<'assets' | 'materials' | 'showcases' | 'plugins'>(
  getValidTab(route.query.tab || route.meta.auditType)
);

// 动态页面配置
const pageConfig = computed<PageConfigType>(() => {
  if (activeTab.value === 'assets') {
    return {
      title: t('admin.3d_asset_review_center'),
      desc: t('admin.centrally_review_and_control_2'),
      apiPath: '/api/admin/assets',
      icon: Box,
      itemTypeLabel: (item: AuditItem) => item.type || t('admin.model_assets'),
      itemIcon: (_item: AuditItem) => Box,
      commonReasons: [
        t('admin.the_model_has_serious'),
        t('admin.the_number_of_model'),
        t('admin.necessary_material_maps_are'),
        t('admin.asset_copyright_is_unknown'),
        t('admin.asset_description_information_is'),
      ],
    };
  } else if (activeTab.value === 'materials') {
    return {
      title: t('admin.material_review_center'),
      desc: t('admin.centrally_review_and_control_1'),
      apiPath: '/api/admin/materials',
      icon: Layers,
      itemTypeLabel: (item: AuditItem) => item.category || t('admin.material_material'),
      itemIcon: (_item: AuditItem) => Layers,
      commonReasons: [
        t('admin.the_texture_map_resolution'),
        t('admin.missing_necessary_channel_maps'),
        t('admin.there_are_obvious_seams'),
        t('admin.the_copyright_ownership_of'),
        t('admin.parameter_settings_are_unreasonable'),
      ],
    };
  } else if (activeTab.value === 'plugins') {
    return {
      title: '插件库审核中心',
      desc: '审核用户提交的插件资源',
      apiPath: '/api/admin/plugins',
      icon: Puzzle,
      itemTypeLabel: (item: AuditItem) => item.category || '插件',
      itemIcon: (_item: AuditItem) => Puzzle,
      commonReasons: [
        '插件功能描述不完整',
        '缺少安装说明',
        '文件格式不符合要求',
        '版权归属不明或存在问题',
        '插件与平台主题无关',
      ],
    };
  } else {
    return {
      title: t('admin.work_content_review_center'),
      desc: t('admin.centrally_review_and_control'),
      apiPath: '/api/admin/showcases',
      icon: Sparkles,
      itemTypeLabel: (item: AuditItem) =>
        item.isVideo || item.type === 'VIDEO' ? t('admin.video_demonstration') : t('admin.creative_graphics'),
      itemIcon: (item: AuditItem) => (item.isVideo || item.type === 'VIDEO' ? Video : ImageIcon),
      commonReasons: [
        t('admin.the_content_of_the'),
        t('admin.cover_or_media_files'),
        t('admin.the_description_of_the'),
        t('admin.the_copyright_ownership_is'),
        t('admin.insufficient_relevance_to_the'),
      ],
    };
  }
});

const items = ref<AuditItem[]>([]);
const assetCategories = ref<{ id: string; name: string }[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const statusFilter = ref('PENDING');

const selectedIds = ref<string[]>([]);
const isAllSelected = computed(() => {
  return filteredItems.value.length > 0 && selectedIds.value.length === filteredItems.value.length;
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = filteredItems.value.map((item) => item.id);
  }
};

const toggleSelection = (id: string) => {
  const index = selectedIds.value.indexOf(id);
  if (index === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(index, 1);
  }
};

const isRejectDialogOpen = ref(false);
const rejectionForm = ref({
  reason: '',
  isBatch: false,
  targetId: '',
});

const isEditOpen = ref(false);
const isSaving = ref(false);
const editForm = ref({
  id: '',
  title: '',
  description: '',
  status: 'PENDING',
  categoryId: '',
  category: '',
  tags: '',
});

const openCategoryManager = () => {
  router.push('/admin/categories');
};

const fetchItems = async () => {
  try {
    isLoading.value = true;
    selectedIds.value = [];
    const params: Record<string, string> = {};
    if (statusFilter.value) {
      params.status = statusFilter.value;
    }
    const { data } = await api.get(pageConfig.value.apiPath, { params });
    items.value = data;
  } catch (error) {
    console.error(`Fetch ${activeTab.value} error:`, error);
    ElMessage.error(t('admin.failed_to_obtain_pageconfig', { param_0: pageConfig.value.title }));
  } finally {
    isLoading.value = false;
  }
};

// 统计全部获取状态用于头部概览卡片展示
const allItemsForStats = ref<AuditItem[]>([]);
const fetchAllForStats = async () => {
  try {
    const { data } = await api.get(pageConfig.value.apiPath);
    allItemsForStats.value = data;
  } catch (_error) {
    // 忽略
  }
};

const stats = computed(() => {
  const list = allItemsForStats.value.length > 0 ? allItemsForStats.value : items.value;
  const total = list.length;
  const pending = list.filter((i) => i.status === 'PENDING').length;
  const approved = list.filter((i) => i.status === 'APPROVED').length;
  const rejected = list.filter((i) => i.status === 'REJECTED').length;
  return { total, pending, approved, rejected };
});

const filteredItems = computed(() => {
  if (!searchQuery.value) return items.value;
  const query = searchQuery.value.toLowerCase();
  return items.value.filter((item: AuditItem) => {
    const titleMatch = item.title?.toLowerCase().includes(query);
    const userMatch =
      item.user?.name?.toLowerCase().includes(query) ||
      item.user?.email?.toLowerCase().includes(query);
    const tagsMatch = item.tags?.toLowerCase().includes(query);
    const descMatch = item.description?.toLowerCase().includes(query);
    const categoryMatch = item.category?.toLowerCase().includes(query);
    return titleMatch || userMatch || tagsMatch || descMatch || categoryMatch;
  });
});

const setStatusFilter = (status: string) => {
  statusFilter.value = status;
  fetchItems();
};

const handleStatusUpdate = async (item: AuditItem, status: string) => {
  if (status === 'REJECTED') {
    rejectionForm.value = { reason: '', isBatch: false, targetId: item.id };
    isRejectDialogOpen.value = true;
    return;
  }

  try {
    await api.put(`${pageConfig.value.apiPath}/${item.id}/status`, { status });
    ElMessage.success(t('admin.review_passed'));
    fetchItems();
    fetchAllForStats();
  } catch (error) {
    const err = error as ApiError;
    ElMessage.error(err.response?.data?.error || t('admin.operation_failed'));
  }
};

const submitRejection = async () => {
  if (!rejectionForm.value.reason) {
    return ElMessage.warning(t('admin.please_provide_reason_for'));
  }

  try {
    if (rejectionForm.value.isBatch) {
      await api.put(`${pageConfig.value.apiPath}/batch-status`, {
        ids: selectedIds.value,
        status: 'REJECTED',
        rejectReason: rejectionForm.value.reason,
      });
      ElMessage.success(t('admin.selectedids_value_length_records', { param_0: selectedIds.value.length }));
    } else {
      await api.put(`${pageConfig.value.apiPath}/${rejectionForm.value.targetId}/status`, {
        status: 'REJECTED',
        rejectReason: rejectionForm.value.reason,
      });
      ElMessage.success(t('admin.the_record_has_been'));
    }
    isRejectDialogOpen.value = false;
    fetchItems();
    fetchAllForStats();
  } catch (error) {
    const err = error as ApiError;
    ElMessage.error(err.response?.data?.error || t('admin.operation_failed'));
  }
};

const handleBatchApprove = async () => {
  if (selectedIds.value.length === 0) return;

  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_21', { param_0: selectedIds.value.length }),
      t('admin.batch_operation_confirmation'),
      { confirmButtonText: t('admin.confirm_approval'), cancelButtonText: t('admin.cancel'), type: 'success' },
    );

    await api.put(`${pageConfig.value.apiPath}/batch-status`, {
      ids: selectedIds.value,
      status: 'APPROVED',
    });

    ElMessage.success(t('admin.approved_selectedids_value_length', { param_0: selectedIds.value.length }));
    fetchItems();
    fetchAllForStats();
  } catch (error) {
    if (error !== 'cancel') {
      const err = error as ApiError;
      ElMessage.error(err.response?.data?.error || t('admin.batch_operation_failed'));
    }
  }
};

const handleBatchReject = () => {
  if (selectedIds.value.length === 0) return;
  rejectionForm.value = { reason: '', isBatch: true, targetId: '' };
  isRejectDialogOpen.value = true;
};

const handleDelete = async (item: AuditItem) => {
  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_22', { itemtitle: item.title }),
      t('admin.confirmation_of_hazardous_operations'),
      {
        confirmButtonText: t('admin.confirm_deletion'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`${pageConfig.value.apiPath}/${item.id}`);
    ElMessage.success(t('admin.delete_successfully'));
    fetchItems();
    fetchAllForStats();
  } catch (error) {
    if (error !== 'cancel') {
      const err = error as ApiError;
      ElMessage.error(err.response?.data?.error || t('admin.delete_failed'));
    }
  }
};

const openEdit = (item: AuditItem) => {
  editForm.value = {
    id: item.id,
    title: item.title,
    description: item.description || '',
    status: item.status,
    categoryId: item.categoryId || '',
    category: item.category || '',
    tags: item.tags || '',
  };
  isEditOpen.value = true;
};

const handleUpdate = async () => {
  isSaving.value = true;
  try {
    const payload: {
      title: string;
      status: string;
      description?: string;
      categoryId?: string;
      category?: string;
      tags?: string;
    } = {
      title: editForm.value.title,
      status: editForm.value.status,
    };

    if (activeTab.value === 'assets') {
      payload.description = editForm.value.description;
      payload.categoryId = editForm.value.categoryId;
    } else if (activeTab.value === 'materials') {
      payload.category = editForm.value.category;
      payload.tags = editForm.value.tags;
    } else if (activeTab.value === 'showcases' || activeTab.value === 'plugins') {
      payload.description = editForm.value.description;
      payload.tags = editForm.value.tags;
    }

    await api.put(`${pageConfig.value.apiPath}/${editForm.value.id}`, payload);
    ElMessage.success(t('admin.content_details_updated_successfully'));
    isEditOpen.value = false;
    fetchItems();
    fetchAllForStats();
  } catch (error) {
    const err = error as ApiError;
    ElMessage.error(err.response?.data?.error || t('admin.update_failed'));
  } finally {
    isSaving.value = false;
  }
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString();
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING':
      return t('admin.pending_review_1');
    case 'APPROVED':
      return t('admin.approved');
    case 'REJECTED':
      return t('admin.failed_1');
    default:
      return status;
  }
};

const fetchAssetCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/asset-categories');
    assetCategories.value = data;
  } catch (error) {
    console.error('Fetch asset categories error:', error);
  }
};

// 监听 activeTab 的变化更新 URL 及其数据
watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } });
  statusFilter.value = 'PENDING';
  searchQuery.value = '';
  fetchItems();
  fetchAllForStats();
});

// 监听路由与参数变化，动态刷新表格类型
watch(
  () => [route.query.tab, route.meta.auditType],
  ([newTab, newMeta]) => {
    const target = getValidTab(newTab || newMeta);
    if (target !== activeTab.value) {
      activeTab.value = target;
    }
  }
);

const moderationTabs = computed(() => [
  { id: 'assets' as const, name: t('admin.3d_asset_review'), icon: Box, badge: workspaceStore.adminStats.pendingAssets },
  { id: 'materials' as const, name: t('admin.material_material_review'), icon: Layers, badge: workspaceStore.adminStats.pendingMaterials },
  { id: 'plugins' as const, name: '插件库审核', icon: Puzzle, badge: 0 },
  { id: 'showcases' as const, name: t('admin.work_content_review'), icon: Sparkles, badge: workspaceStore.adminStats.pendingShowcases }
]);

onMounted(() => {
  fetchItems();
  fetchAllForStats();
  fetchAssetCategories();
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
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-4 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-indigo-500/10 text-indigo-500 shadow-sm border border-indigo-500/20"
          >
            <component :is="pageConfig.icon" class="w-4 h-4" />
          </span>
          <h1 class="text-sm font-black tracking-tight" style="color: var(--text-primary)">
            内容审核中心
          </h1>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button
type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-primary)"
            @click="openCategoryManager"
          >
            <FolderCog class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ $t('admin.classification_management') }}</span>
          </button>
          <button
type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="
              fetchItems();
              fetchAllForStats();
            "
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">{{ $t('admin.refresh') }}</span>
          </button>
        </div>
      </div>

      <!-- Row 2: 选项卡 & 状态筛选项 & 动作工具栏 -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 过滤器组合 (分段选项卡 & 状态 Pills) -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <!-- 极品分段选项卡 -->
          <div class="flex flex-nowrap items-center bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg gap-0.5 shadow-inner shrink-0">
            <button
v-for="tab in moderationTabs"
              :key="tab.id"
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[8px] xs:text-[9px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 sm:gap-1.5 cursor-pointer shrink-0"
              :class="activeTab === tab.id
                ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
              @click="activeTab = tab.id"
            >
              <component :is="tab.icon" class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              <span>{{ tab.name }}</span>
              <span
                v-if="tab.badge > 0"
                class="px-1 py-0.2 sm:px-1.5 sm:py-0.5 text-[8px] font-extrabold rounded-full bg-rose-500 text-white leading-none min-w-[13px] text-center"
              >
                {{ tab.badge }}
              </span>
            </button>
          </div>

          <div class="w-[1px] h-3 bg-slate-200 dark:bg-slate-800 shrink-0 mx-1 sm:mx-3"></div>

          <!-- 紧凑状态筛选 Pills -->
          <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
v-for="filter in [
                { key: 'PENDING', label: $t('admin.pending_review_1'), count: stats.pending, color: 'amber', icon: Clock },
                { key: 'APPROVED', label: $t('admin.passed'), count: stats.approved, color: 'emerald', icon: CheckCircle2 },
                { key: 'REJECTED', label: $t('admin.called_back'), count: stats.rejected, color: 'rose', icon: XCircle },
                { key: '', label: $t('admin.all'), count: stats.total, color: 'indigo', icon: Tag }
              ]"
              :key="filter.key"
              type="button"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0 animate-in duration-200"
              :class="[
                statusFilter === filter.key
                  ? filter.key === 'PENDING'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 ring-1 ring-amber-500/20 font-extrabold shadow-sm'
                    : filter.key === 'APPROVED'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                      : filter.key === 'REJECTED'
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 ring-1 ring-rose-500/20 font-extrabold shadow-sm'
                        : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 ring-1 ring-indigo-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              ]"
              @click="setStatusFilter(filter.key)"
            >
              <component :is="filter.icon" class="w-2 h-2 sm:w-3 sm:h-3" />
              <span>{{ filter.label }}</span>
              <span class="opacity-60">({{ filter.count }})</span>
            </button>
          </div>
        </div>

        <!-- 检索与全选组合 -->
        <div class="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto shrink-0">
          <button
type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border hover:bg-slate-50 dark:hover:bg-white/5 transition-all font-bold text-[11px] shadow-sm shrink-0 cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-primary)"
            @click="toggleSelectAll"
          >
            <CheckSquare v-if="isAllSelected" class="w-3.5 h-3.5 text-indigo-600" />
            <Square v-else class="w-3.5 h-3.5 text-slate-400" />
            全选当前页
          </button>

          <div class="relative w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('admin.search_record_name_author')"
              class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>

          <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
            共 <span class="text-indigo-500 font-extrabold">{{ filteredItems.length }}</span> 个匹配记录
          </div>
        </div>

        <!-- 悬浮批量操作动作栏 -->
        <Transition
          enter-active-class="animate-in slide-in-from-top-4 duration-300"
          leave-active-class="animate-out slide-out-to-top-4 duration-300"
        >
          <div
            v-if="selectedIds.length > 0"
            class="absolute inset-0 z-20 bg-indigo-600 text-white flex items-center justify-between px-8 shadow-md rounded-b-xl"
          >
            <div class="flex items-center gap-4">
              <span class="text-xs font-black tracking-wider px-2.5 py-1 bg-white/10 rounded-lg"
                >{{ $t('admin.selectedids_length_records_have', { count: selectedIds.length }) }}</span
              >
              <button
type="button"
                class="text-xs font-bold hover:underline opacity-80 transition-opacity"
                @click="selectedIds = []"
              >
                取消勾选
              </button>
            </div>
            <div class="flex items-center gap-3">
              <button
type="button"
                class="px-5 py-2 bg-white text-indigo-600 rounded-xl font-bold text-xs shadow hover:scale-105 transition-all"
                @click="handleBatchApprove"
              >
                一键批量批准通过
              </button>
              <button
type="button"
                class="px-5 py-2 bg-rose-500 text-white border border-rose-400 rounded-xl font-bold text-xs shadow hover:scale-105 transition-all"
                @click="handleBatchReject"
              >
                一键批量打回拒绝
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 主要数据展示网格区 -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <!-- 载入状态 -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-28 gap-4">
        <div
          class="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg"
        ></div>
        <p class="text-xs font-bold text-slate-400 tracking-wider">{{ $t('admin.loading_review_queue') }}</p>
      </div>

      <!-- 空白状态 -->
      <div
        v-else-if="filteredItems.length === 0"
        class="flex flex-col items-center justify-center py-28 text-center"
      >
        <div
          class="w-16 h-16 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800"
        >
          <component :is="pageConfig.icon" class="w-8 h-8 text-slate-300" />
        </div>
        <h3 class="text-base font-bold mb-1" style="color: var(--text-primary)">
          没有需要审核的记录
        </h3>
        <p class="text-xs text-slate-400 max-w-sm">{{ $t('admin.there_are_currently_no') }}</p>
      </div>

      <!-- 极品卡片瀑布排版 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="group rounded-3xl border overflow-hidden transition-all duration-300 hover:shadow-2xl relative cursor-pointer flex flex-col"
          :class="
            selectedIds.includes(item.id)
              ? 'ring-4 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 border-indigo-500'
              : 'hover:-translate-y-1 shadow-sm'
          "
          style="background-color: var(--bg-card); border-color: var(--border-base)"
          @click="toggleSelection(item.id)"
        >
          <!-- 选中标识 -->
          <div
            v-if="selectedIds.includes(item.id)"
            class="absolute top-3 right-3 z-10 bg-indigo-600 text-white p-1 rounded-full shadow-md animate-scale-in"
          >
            <CheckCircle2 class="w-4 h-4" />
          </div>

          <!-- 视觉封面图 -->
          <div
            class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center border-b border-black/5 dark:border-white/5"
          >
            <img
v-if="
                item.thumbnailUrl || item.previewUrl || item.thumbnail || item.videoUrl || item.url
              "
              alt=""
              :src="
                item.thumbnailUrl || item.previewUrl || item.thumbnail || item.videoUrl || item.url
              "
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              @error="
                ($event.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60'
              "
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900"
            >
              <ImageIcon class="w-10 h-10 text-slate-300" />
            </div>

            <!-- 左上角分类标签 -->
            <div class="absolute top-3 left-3 flex items-center gap-1.5">
              <span
                class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-md text-white shadow-sm flex items-center gap-1"
              >
                <component :is="pageConfig.itemIcon(item)" class="w-2.5 h-2.5 text-indigo-400" />
                {{ pageConfig.itemTypeLabel(item) }}
              </span>
            </div>

            <!-- 浮层按钮：新窗口查看详情与快捷编辑 -->
            <div
              class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3"
              @click.stop
            >
              <a
                v-if="
                  item.videoUrl || item.fileUrl || item.thumbnailUrl || item.previewUrl || item.url
                "
                :href="
                  item.videoUrl || item.fileUrl || item.thumbnailUrl || item.previewUrl || item.url
                "
                target="_blank"
                rel="noopener noreferrer"
                class="p-2.5 rounded-xl bg-white text-slate-900 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-xl font-bold text-[10px] flex items-center gap-1"
              >
                <EyeIcon class="w-3.5 h-3.5" /> 查阅
              </a>
              <button
type="button"
                class="p-2.5 rounded-xl bg-white text-slate-900 hover:bg-amber-50 hover:text-amber-500 transition-all shadow-xl font-bold text-[10px] flex items-center gap-1"
                @click="openEdit(item)"
              >
                <Edit class="w-3.5 h-3.5" /> 编辑
              </button>
              <button
type="button"
                class="p-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-xl"
                :title="$t('admin.permanently_delete_records')"
                @click="handleDelete(item)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- 内部排版信息 -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div class="space-y-2">
              <div class="flex items-start justify-between gap-2">
                <h3
                  class="font-bold text-sm line-clamp-1 leading-snug"
                  style="color: var(--text-primary)"
                  :title="item.title"
                >
                  {{ item.title }}
                </h3>
                <span
                  class="px-2 py-0.5 rounded text-[9px] font-bold shrink-0 mt-0.5 shadow-sm border"
                  :class="
                    item.status === 'APPROVED'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : item.status === 'REJECTED'
                        ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  "
                >
                  {{ getStatusLabel(item.status) }}
                </span>
              </div>

              <p
                class="text-[11px] line-clamp-2 leading-relaxed"
                style="color: var(--text-secondary)"
              >
                {{ item.description || $t('admin.the_author_has_not') }}
              </p>
            </div>

            <!-- 数据维度与作者信息 -->
            <div
              class="space-y-3 pt-3 border-t border-dashed"
              style="border-color: var(--border-base)"
            >
              <div
                class="flex items-center justify-between text-[10px]"
                style="color: var(--text-muted)"
              >
                <div class="flex items-center gap-3">
                  <template v-if="activeTab === 'showcases'">
                    <span class="flex items-center gap-1 font-medium"
                      ><EyeIcon class="w-3 h-3 text-slate-400" /> {{ item.views || 0 }}</span
                    >
                    <span class="flex items-center gap-1 font-medium"
                      ><ThumbsUp class="w-3 h-3 text-slate-400" /> {{ item.likes || 0 }}</span
                    >
                    <span class="flex items-center gap-1 font-medium"
                      ><MessageSquare class="w-3 h-3 text-slate-400" />
                      {{ item.comments || 0 }}</span
                    >
                  </template>
                  <template v-else-if="activeTab === 'assets'">
                    <span class="flex items-center gap-1 font-medium"
                      ><Box class="w-3 h-3 text-slate-400" />
                      {{ item.size ? item.size + ' MB' : $t('admin.unknown_size') }}</span
                    >
                  </template>
                  <template v-else-if="activeTab === 'materials'">
                    <span class="flex items-center gap-1 font-medium"
                      ><Layers class="w-3 h-3 text-slate-400" />
                      {{ item.resolution || $t('admin.unknown_resolution') }}</span
                    >
                  </template>
                </div>
                <span class="font-medium">{{ formatDate(item.createdAt).split(' ')[0] }}</span>
              </div>

              <div
                class="flex items-center justify-between bg-slate-50 dark:bg-white/5 p-2 rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <UserAvatar :user="item.user" size="sm" />
                  <span class="text-[11px] font-bold truncate" style="color: var(--text-primary)">
                    {{ item.user?.name || item.user?.email?.split('@')[0] || $t('admin.anonymous_creator') }}
                  </span>
                </div>
              </div>

              <!-- 审核动作按钮条 -->
              <div class="flex items-center gap-2 pt-1" @click.stop>
                <button
v-if="item.status !== 'APPROVED'"
                  type="button"
                  class="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  @click="handleStatusUpdate(item, 'APPROVED')"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" /> 批准通过
                </button>
                <button
v-if="item.status !== 'REJECTED'"
                  type="button"
                  class="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  @click="handleStatusUpdate(item, 'REJECTED')"
                >
                  <XCircle class="w-3.5 h-3.5" /> 打回拒绝
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 绝美高级编辑弹窗 -->
    <el-dialog
      v-model="isEditOpen"
      :title="$t('admin.super_editor_management_pageconfig', { title: pageConfig.title.replace('中心', '').replace('Center', '') })"
      width="560px"
      class="custom-rounded-dialog"
    >
      <div class="space-y-6">
        <!-- 共同字段：标题 -->
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >{{ $t('admin.content_title') }}</label
          >
          <input
            v-model="editForm.title"
            type="text"
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs font-bold"
            style="color: var(--text-primary)"
          />
        </div>

        <!-- 针对资产和作品展示的字段：描述 -->
        <div v-if="activeTab === 'assets' || activeTab === 'showcases'" class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >{{ $t('admin.detailed_description_remarks') }}</label
          >
          <textarea
            v-model="editForm.description"
            rows="4"
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none text-xs leading-relaxed"
            style="color: var(--text-primary)"
          ></textarea>
        </div>

        <!-- 针对资产的模型类别 -->
        <div v-if="activeTab === 'assets'" class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >{{ $t('admin.asset_ownership_sector_category') }}</label
          >
          <el-select v-model="editForm.categoryId" class="w-full" size="large">
            <el-option
              v-for="cat in assetCategories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </div>

        <!-- 针对材质的单行文本类别 -->
        <div v-if="activeTab === 'materials'" class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >{{ $t('admin.material_group_manual_entry') }}</label
          >
          <input
            v-model="editForm.category"
            type="text"
            :placeholder="$t('admin.for_example_wood_grain')"
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs font-medium"
            style="color: var(--text-primary)"
          />
        </div>

        <!-- 针对材质和展示作品的附加标签 -->
        <div v-if="activeTab === 'materials' || activeTab === 'showcases'" class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >{{ $t('admin.feature_tag_combinations_comma') }}</label
          >
          <input
            v-model="editForm.tags"
            type="text"
            :placeholder="$t('admin.for_example_technology_cyberpunk')"
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs font-medium"
            style="color: var(--text-primary)"
          />
        </div>

        <!-- 共同字段：强制干预审核状态 -->
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >{{ $t('admin.administrator_forced_status_change') }}</label
          >
          <el-select v-model="editForm.status" class="w-full" size="large">
            <el-option :label="$t('admin.pending_transfer_pending')" value="PENDING" />
            <el-option :label="$t('admin.approved_1')" value="APPROVED" />
            <el-option :label="$t('admin.forced_rejection_rejected')" value="REJECTED" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
type="button"
            class="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            style="color: var(--text-secondary)"
            @click="isEditOpen = false"
          >
            取消编辑
          </button>
          <button
type="button"
            :disabled="isSaving"
            class="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
            @click="handleUpdate"
          >
            {{ isSaving ? [t('admin.writing_to_database')]: $t('admin.confirm_and_save_all') }}
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- 绝美拒绝原因反馈弹窗 -->
    <el-dialog
      v-model="isRejectDialogOpen"
      :title="$t('admin.fill_in_the_review')"
      width="460px"
      class="custom-rounded-dialog"
    >
      <div class="space-y-5">
        <div
          class="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20 shadow-sm"
        >
          <AlertTriangle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p class="text-[11px] text-rose-800 dark:text-rose-400 font-medium leading-relaxed">
            打回原因将作为系统站内信实时推送给内容发布者，清晰友好的建议有助于作者修改后再次提交。
          </p>
        </div>

        <div class="space-y-3">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >{{ $t('admin.quickly_fill_reason_template') }}</label
          >
          <div class="flex flex-wrap gap-1.5">
            <button
v-for="reason in pageConfig.commonReasons"
              :key="reason"
              type="button"
              class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all text-left"
              :class="
                rejectionForm.reason === reason
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
              "
              @click="rejectionForm.reason = reason"
            >
              {{ reason }}
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >{{ $t('admin.detailed_call_back_instructions') }}</label
          >
          <textarea
            v-model="rejectionForm.reason"
            rows="4"
            :placeholder="$t('admin.please_enter_specific_violations')"
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none text-xs shadow-inner"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-2">
          <button
type="button"
            class="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            style="color: var(--text-secondary)"
            @click="isRejectDialogOpen = false"
          >
            暂不处理
          </button>
          <button
type="button"
            class="flex-1 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-500/20 hover:bg-rose-600 transition-all"
            @click="submitRejection"
          >
            确认发送并打回
          </button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.animate-in {
  animation: animate-in 0.3s ease-out;
}
@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-scale-in {
  animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

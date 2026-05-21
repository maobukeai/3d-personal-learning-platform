<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
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
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';

const route = useRoute();
const router = useRouter();
const workspaceStore = useWorkspaceStore();

const getValidTab = (tab: any): 'assets' | 'materials' | 'showcases' => {
  if (tab === 'assets' || tab === 'materials' || tab === 'showcases') {
    return tab;
  }
  return 'assets';
};

const activeTab = ref<'assets' | 'materials' | 'showcases'>(
  getValidTab(route.query.tab || route.meta.auditType)
);

// 动态页面配置
const pageConfig = computed(() => {
  if (activeTab.value === 'assets') {
    return {
      title: '3D资产审核中心',
      desc: '集中审核与管控用户提交至模型库的所有3D模型资产',
      apiPath: '/api/admin/assets',
      icon: Box,
      itemTypeLabel: (item: any) => item.type || '模型资产',
      itemIcon: (_item: any) => Box,
      commonReasons: [
        '模型存在破面或法线错误等严重质量问题',
        '模型面数过高，未进行合理的拓扑优化',
        '未包含必要的材质贴图或贴图丢失',
        '资产版权不明或涉嫌侵权盗版',
        '资产描述信息不完善或存在误导',
      ],
    };
  } else if (activeTab.value === 'materials') {
    return {
      title: '材质材料审核中心',
      desc: '集中审核与管控用户提交至材质库的各类材质和基础材料',
      apiPath: '/api/admin/materials',
      icon: Layers,
      itemTypeLabel: (item: any) => item.category || '材质材料',
      itemIcon: (_item: any) => Layers,
      commonReasons: [
        '材质贴图分辨率过低或清晰度不足',
        '缺少必要的通道贴图（如法线、粗糙度等）',
        '无缝贴图边缘存在明显接缝或重复感过强',
        '材质版权归属不明或涉嫌未经授权搬运',
        '参数设置不合理或无法在主流引擎中正确渲染',
      ],
    };
  } else {
    return {
      title: '作品内容审核中心',
      desc: '集中审核与管控用户提交至前台展示墙的所有3D创意作品、视频及图文',
      apiPath: '/api/admin/showcases',
      icon: Sparkles,
      itemTypeLabel: (item: any) =>
        item.isVideo || item.type === 'VIDEO' ? '视频演示' : '创意图文',
      itemIcon: (item: any) => (item.isVideo || item.type === 'VIDEO' ? Video : ImageIcon),
      commonReasons: [
        '作品内容包含敏感或违规信息',
        '封面或媒体文件无法正常加载显示',
        '作品描述过于简陋或存在误导营销',
        '版权归属不明或涉嫌未经授权搬运',
        '与平台3D/创意学习主旨关联性不足',
      ],
    };
  }
});

const items = ref<any[]>([]);
const assetCategories = ref<any[]>([]);
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
    const params: any = {};
    if (statusFilter.value) {
      params.status = statusFilter.value;
    }
    const { data } = await api.get(pageConfig.value.apiPath, { params });
    items.value = data;
  } catch (error) {
    console.error(`Fetch ${activeTab.value} error:`, error);
    ElMessage.error(`获取${pageConfig.value.title}列表失败`);
  } finally {
    isLoading.value = false;
  }
};

// 统计全部获取状态用于头部概览卡片展示
const allItemsForStats = ref<any[]>([]);
const fetchAllForStats = async () => {
  try {
    const { data } = await api.get(pageConfig.value.apiPath);
    allItemsForStats.value = data;
  } catch (error) {
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
  return items.value.filter((item: any) => {
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

const handleStatusUpdate = async (item: any, status: string) => {
  if (status === 'REJECTED') {
    rejectionForm.value = { reason: '', isBatch: false, targetId: item.id };
    isRejectDialogOpen.value = true;
    return;
  }

  try {
    await api.put(`${pageConfig.value.apiPath}/${item.id}/status`, { status });
    ElMessage.success('审核已通过');
    fetchItems();
    fetchAllForStats();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败');
  }
};

const submitRejection = async () => {
  if (!rejectionForm.value.reason) {
    return ElMessage.warning('请提供拒绝原因');
  }

  try {
    if (rejectionForm.value.isBatch) {
      await api.put(`${pageConfig.value.apiPath}/batch-status`, {
        ids: selectedIds.value,
        status: 'REJECTED',
        rejectReason: rejectionForm.value.reason,
      });
      ElMessage.success(`已批量拒绝 ${selectedIds.value.length} 项记录`);
    } else {
      await api.put(`${pageConfig.value.apiPath}/${rejectionForm.value.targetId}/status`, {
        status: 'REJECTED',
        rejectReason: rejectionForm.value.reason,
      });
      ElMessage.success('已打回该记录');
    }
    isRejectDialogOpen.value = false;
    fetchItems();
    fetchAllForStats();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败');
  }
};

const handleBatchApprove = async () => {
  if (selectedIds.value.length === 0) return;

  try {
    await ElMessageBox.confirm(
      `确定要批量批准选中的 ${selectedIds.value.length} 项记录吗？`,
      '批量操作确认',
      { confirmButtonText: '确定批准', cancelButtonText: '取消', type: 'success' },
    );

    await api.put(`${pageConfig.value.apiPath}/batch-status`, {
      ids: selectedIds.value,
      status: 'APPROVED',
    });

    ElMessage.success(`已批准 ${selectedIds.value.length} 项记录`);
    fetchItems();
    fetchAllForStats();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '批量操作失败');
    }
  }
};

const handleBatchReject = () => {
  if (selectedIds.value.length === 0) return;
  rejectionForm.value = { reason: '', isBatch: true, targetId: '' };
  isRejectDialogOpen.value = true;
};

const handleDelete = async (item: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除记录 "${item.title}" 吗？此操作不可撤销。`,
      '危险操作确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`${pageConfig.value.apiPath}/${item.id}`);
    ElMessage.success('删除成功');
    fetchItems();
    fetchAllForStats();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败');
    }
  }
};

const openEdit = (item: any) => {
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
    const payload: any = {
      title: editForm.value.title,
      status: editForm.value.status,
    };

    if (activeTab.value === 'assets') {
      payload.description = editForm.value.description;
      payload.categoryId = editForm.value.categoryId;
    } else if (activeTab.value === 'materials') {
      payload.category = editForm.value.category;
      payload.tags = editForm.value.tags;
    } else if (activeTab.value === 'showcases') {
      payload.description = editForm.value.description;
      payload.tags = editForm.value.tags;
    }

    await api.put(`${pageConfig.value.apiPath}/${editForm.value.id}`, payload);
    ElMessage.success('内容详情更新成功');
    isEditOpen.value = false;
    fetchItems();
    fetchAllForStats();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新失败');
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
      return '待审核';
    case 'APPROVED':
      return '已批准';
    case 'REJECTED':
      return '未通过';
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
  { id: 'assets' as const, name: '3D资产审核', icon: Box, badge: workspaceStore.adminStats.pendingAssets },
  { id: 'materials' as const, name: '材质材料审核', icon: Layers, badge: workspaceStore.adminStats.pendingMaterials },
  { id: 'showcases' as const, name: '作品内容审核', icon: Sparkles, badge: workspaceStore.adminStats.pendingShowcases }
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
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-primary)"
            @click="openCategoryManager"
          >
            <FolderCog class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">分类管理</span>
          </button>
          <button
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="
              fetchItems();
              fetchAllForStats();
            "
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">刷新</span>
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
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[8px] xs:text-[9px] sm:text-[11px] font-bold transition-all flex items-center gap-0.5 sm:gap-1.5 cursor-pointer shrink-0"
              :class="activeTab === tab.id
                ? 'bg-white dark:bg-white/10 shadow text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
              @click="activeTab = tab.id"
            >
              <component :is="tab.icon" class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              <span>{{ tab.name.replace('审核', '') }}</span>
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
                { key: 'PENDING', label: '待审核', count: stats.pending, color: 'amber', icon: Clock },
                { key: 'APPROVED', label: '已通过', count: stats.approved, color: 'emerald', icon: CheckCircle2 },
                { key: 'REJECTED', label: '已打回', count: stats.rejected, color: 'rose', icon: XCircle },
                { key: '', label: '全部', count: stats.total, color: 'indigo', icon: Tag }
              ]"
              :key="filter.key"
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
              placeholder="检索记录名称、作者..."
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
                >已勾选 {{ selectedIds.length }} 项记录</span
              >
              <button
                class="text-xs font-bold hover:underline opacity-80 transition-opacity"
                @click="selectedIds = []"
              >
                取消勾选
              </button>
            </div>
            <div class="flex items-center gap-3">
              <button
                class="px-5 py-2 bg-white text-indigo-600 rounded-xl font-bold text-xs shadow hover:scale-105 transition-all"
                @click="handleBatchApprove"
              >
                一键批量批准通过
              </button>
              <button
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
        <p class="text-xs font-bold text-slate-400 tracking-wider">正在加载审核队列...</p>
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
        <p class="text-xs text-slate-400 max-w-sm">当前分类及搜索条件下暂无匹配的用户提交记录。</p>
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
                class="p-2.5 rounded-xl bg-white text-slate-900 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-xl font-bold text-[10px] flex items-center gap-1"
              >
                <EyeIcon class="w-3.5 h-3.5" /> 查阅
              </a>
              <button
                class="p-2.5 rounded-xl bg-white text-slate-900 hover:bg-amber-50 hover:text-amber-500 transition-all shadow-xl font-bold text-[10px] flex items-center gap-1"
                @click="openEdit(item)"
              >
                <Edit class="w-3.5 h-3.5" /> 编辑
              </button>
              <button
                class="p-2 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-xl"
                title="永久删除记录"
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
                {{ item.description || '作者未填写详细描述信息。' }}
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
                      {{ item.size ? item.size + ' MB' : '未知大小' }}</span
                    >
                  </template>
                  <template v-else-if="activeTab === 'materials'">
                    <span class="flex items-center gap-1 font-medium"
                      ><Layers class="w-3 h-3 text-slate-400" />
                      {{ item.resolution || '未知分辨率' }}</span
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
                    {{ item.user?.name || item.user?.email?.split('@')[0] || '匿名创作者' }}
                  </span>
                </div>
              </div>

              <!-- 审核动作按钮条 -->
              <div class="flex items-center gap-2 pt-1" @click.stop>
                <button
                  v-if="item.status !== 'APPROVED'"
                  class="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-sm"
                  @click="handleStatusUpdate(item, 'APPROVED')"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" /> 批准通过
                </button>
                <button
                  v-if="item.status !== 'REJECTED'"
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
      :title="`超级编辑管理 - ${pageConfig.title.replace('中心', '')}`"
      width="560px"
      class="custom-rounded-dialog"
    >
      <div class="space-y-6">
        <!-- 共同字段：标题 -->
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >内容标题</label
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
            >详细描述 / 备注</label
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
            >资产归属板块 / 类别</label
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
            >材质组别 (手动录入)</label
          >
          <input
            v-model="editForm.category"
            type="text"
            placeholder="例如: 木纹, 金属..."
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs font-medium"
            style="color: var(--text-primary)"
          />
        </div>

        <!-- 针对材质和展示作品的附加标签 -->
        <div v-if="activeTab === 'materials' || activeTab === 'showcases'" class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >特征标签组合 (逗号分隔)</label
          >
          <input
            v-model="editForm.tags"
            type="text"
            placeholder="例如: 科技, cyberpunk, 游戏场景..."
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-xs font-medium"
            style="color: var(--text-primary)"
          />
        </div>

        <!-- 共同字段：强制干预审核状态 -->
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
            >管理员强制状态变更</label
          >
          <el-select v-model="editForm.status" class="w-full" size="large">
            <el-option label="待审核流转 (PENDING)" value="PENDING" />
            <el-option label="强制核准通过 (APPROVED)" value="APPROVED" />
            <el-option label="强制打回退稿 (REJECTED)" value="REJECTED" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            class="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            style="color: var(--text-secondary)"
            @click="isEditOpen = false"
          >
            取消编辑
          </button>
          <button
            :disabled="isSaving"
            class="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
            @click="handleUpdate"
          >
            {{ isSaving ? '正在写入数据库...' : '确认并保存全部更改' }}
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- 绝美拒绝原因反馈弹窗 -->
    <el-dialog
      v-model="isRejectDialogOpen"
      title="填写审核打回通知"
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
            >快捷填充原因模板</label
          >
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="reason in pageConfig.commonReasons"
              :key="reason"
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
            >详细打回说明 (必填)</label
          >
          <textarea
            v-model="rejectionForm.reason"
            rows="4"
            placeholder="请输入具体的违规或优化建议..."
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none text-xs shadow-inner"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-2">
          <button
            class="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            style="color: var(--text-secondary)"
            @click="isRejectDialogOpen = false"
          >
            暂不处理
          </button>
          <button
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

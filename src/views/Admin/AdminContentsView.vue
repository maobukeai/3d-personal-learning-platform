<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Edit3,
  Layers,
  Plus,
  Puzzle,
  RefreshCw,
  Sparkles,
  Trash2,
  LayoutGrid,
  List,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import Card from '@/components/ui/Card.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import AdminContentStatusBadge from './components/AdminContentStatusBadge.vue';
import AdminHeader from './components/AdminHeader.vue';
import AdminContentEditModal from './components/AdminContentEditModal.vue';
import AdminContentDetailDrawer from './components/AdminContentDetailDrawer.vue';
import {
  useAdminContents,
  pageConfigs,
  type ContentItem,
  type StatusFilter,
  type ContentTab,
} from './composables/useAdminContents';

const {
  activeTab,
  statusFilter,
  searchQuery,
  items,
  assetCategories,
  isLoading,
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  activeItem,
  isDetailSplitOpen,
  selectedItemIds,
  viewMode,
  pageConfig,
  handleResize,
  openDetail,
  closeDetail,
  clearSelection,
  fetchItems,
  fetchAssetCategories,
  handleTabChange,
  handleSearch,
  handleStatusFilterChange,
  setPage,
  toggleSelectItem,
  toggleSelectAll,
} = useAdminContents();

const isModalOpen = ref(false);
const modalMode = ref<'create' | 'edit'>('create');
const editItemTarget = ref<ContentItem | null>(null);

const openCreateModal = () => {
  modalMode.value = 'create';
  editItemTarget.value = null;
  isModalOpen.value = true;
};

const openEditModal = (item: ContentItem) => {
  modalMode.value = 'edit';
  editItemTarget.value = item;
  isModalOpen.value = true;
};

const handleApprove = async (item: ContentItem) => {
  try {
    await api.put(`${pageConfig.value.apiPath}/${item.id}`, { status: 'APPROVED' });
    ElMessage.success('已审核通过');
    item.status = 'APPROVED';
    fetchItems(true);
  } catch (err) {
    ElMessage.error(getApiErrorMessage(err, '操作失败'));
  }
};

const handleReject = async (item: ContentItem) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入退回理由：', '退回审核', {
      confirmButtonText: '确定退回',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '理由不能为空',
    });
    await api.put(`${pageConfig.value.apiPath}/${item.id}`, {
      status: 'REJECTED',
      rejectReason: value,
    });
    ElMessage.success('资源已被打回');
    item.status = 'REJECTED';
    item.rejectReason = value;
    fetchItems(true);
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(getApiErrorMessage(err, '退回失败'));
  }
};

const handleDelete = async (item: ContentItem) => {
  try {
    await ElMessageBox.confirm(`确认删除资源「${item.title}」？`, '警告', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`${pageConfig.value.apiPath}/${item.id}`);
    ElMessage.success('删除成功');
    if (activeItem.value?.id === item.id) closeDetail();
    fetchItems();
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(getApiErrorMessage(err, '删除失败'));
  }
};

const tabsListOptions = [
  { label: pageConfigs.assets.label, value: 'assets' as const, icon: pageConfigs.assets.icon },
  {
    label: pageConfigs.materials.label,
    value: 'materials' as const,
    icon: pageConfigs.materials.icon,
  },
  {
    label: pageConfigs.showcases.label,
    value: 'showcases' as const,
    icon: pageConfigs.showcases.icon,
  },
  { label: pageConfigs.plugins.label, value: 'plugins' as const, icon: pageConfigs.plugins.icon },
];

const statusFilterOptions = [
  { label: '全部', value: 'ALL' as const },
  { label: '待审核', value: 'PENDING' as const },
  { label: '已通过', value: 'APPROVED' as const },
  { label: '已打回', value: 'REJECTED' as const },
];

onMounted(() => {
  fetchItems();
  fetchAssetCategories();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div
    class="admin-contents-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 flex flex-col overflow-hidden p-3 gap-3">
      <!-- Header -->
      <AdminHeader
        :title="pageConfig.title"
        subtitle="平台管理 · 资源清单"
        v-model="searchQuery"
        placeholder="搜索关键字或创作者..."
      >
        <UiButton
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchItems(false)"
        >
          刷新
        </UiButton>
        <UiButton variant="primary" size="sm" :icon="Plus" @click="openCreateModal">
          发布{{ pageConfig.label }}
        </UiButton>
      </AdminHeader>

      <!-- Filters & Toolbar -->
      <Card padding="sm">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex flex-wrap items-center gap-3">
            <Tabs
              v-model="activeTab"
              :options="tabsListOptions"
              variant="solid"
              @change="(val: any) => handleTabChange(val)"
            />
            <Tabs
              v-model="statusFilter"
              :options="statusFilterOptions"
              variant="solid"
              @change="(val: any) => handleStatusFilterChange(val)"
            />
          </div>

          <div class="flex items-center gap-3">
            <div
              class="flex items-center border border-slate-100 dark:border-white/5 bg-slate-100/50 dark:bg-white/5 rounded-lg p-0.5"
            >
              <button
                type="button"
                :class="[
                  'p-1 rounded-md transition-colors cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-white dark:bg-white/10 text-accent shadow-sm'
                    : 'text-[var(--text-secondary)]',
                ]"
                @click="viewMode = 'list'"
              >
                <List class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :class="[
                  'p-1 rounded-md transition-colors cursor-pointer',
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-white/10 text-accent shadow-sm'
                    : 'text-[var(--text-secondary)]',
                ]"
                @click="viewMode = 'grid'"
              >
                <LayoutGrid class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      <!-- Split Layout Area -->
      <div class="flex-1 flex overflow-hidden min-h-0 relative gap-3">
        <!-- Main List / Grid -->
        <div class="flex-1 flex flex-col overflow-hidden min-w-0">
          <Card padding="none" class="flex-1 flex flex-col overflow-hidden">
            <div class="flex-1 overflow-y-auto p-3">
              <div
                v-if="viewMode === 'grid'"
                class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3"
              >
                <div
                  v-for="item in items"
                  :key="item.id"
                  class="p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-white/50 dark:bg-white/5 hover:border-accent/40 transition-all cursor-pointer flex flex-col justify-between"
                  @click="openDetail(item)"
                >
                  <div class="space-y-2">
                    <div class="w-full h-32 rounded-lg bg-slate-950 overflow-hidden relative">
                      <img
                        v-if="item.thumbnail || item.thumbnailUrl"
                        :src="item.thumbnail || item.thumbnailUrl || ''"
                        class="w-full h-full object-cover"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center text-xs text-slate-500"
                      >
                        无图
                      </div>
                      <div class="absolute top-2 right-2">
                        <AdminContentStatusBadge :status="item.status" />
                      </div>
                    </div>
                    <div class="font-bold text-xs truncate">{{ item.title }}</div>
                  </div>
                  <div
                    class="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-[var(--text-muted)]"
                  >
                    <div class="flex items-center gap-1.5">
                      <UserAvatar :user="item.user" size="xs" />
                      <span class="truncate max-w-[80px]">{{ item.user?.name || '未知' }}</span>
                    </div>
                    <div>{{ item.createdAt.split('T')[0] }}</div>
                  </div>
                </div>
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="item in items"
                  :key="item.id"
                  class="p-2.5 rounded-lg border border-slate-100 dark:border-white/5 bg-white/50 dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  @click="openDetail(item)"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-lg bg-slate-950 overflow-hidden shrink-0">
                      <img
                        v-if="item.thumbnail || item.thumbnailUrl"
                        :src="item.thumbnail || item.thumbnailUrl || ''"
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs font-bold truncate">{{ item.title }}</div>
                      <div class="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                        {{ item.description || '无描述' }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-3 shrink-0">
                    <AdminContentStatusBadge :status="item.status" />
                    <UiButton
                      variant="secondary"
                      size="sm"
                      :icon="Edit3"
                      @click.stop="openEditModal(item)"
                      >编辑</UiButton
                    >
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer Pagination -->
            <div
              class="p-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs"
            >
              <div class="text-[var(--text-muted)]">
                共 {{ totalItems }} 条，第 {{ currentPage }}/{{ totalPages }} 页
              </div>
              <div class="flex items-center gap-1">
                <UiButton
                  variant="secondary"
                  size="sm"
                  :disabled="currentPage <= 1"
                  @click="setPage(currentPage - 1)"
                  >上一页</UiButton
                >
                <UiButton
                  variant="secondary"
                  size="sm"
                  :disabled="currentPage >= totalPages"
                  @click="setPage(currentPage + 1)"
                  >下一页</UiButton
                >
              </div>
            </div>
          </Card>
        </div>

        <!-- Detail Drawer / Split Pane -->
        <AdminContentDetailDrawer
          :open="isDetailSplitOpen"
          :item="activeItem"
          :pageConfig="pageConfig"
          @close="closeDetail"
          @edit="openEditModal"
          @delete="handleDelete"
          @approve="handleApprove"
          @reject="handleReject"
        />
      </div>
    </main>

    <!-- Create/Edit Modal -->
    <AdminContentEditModal
      v-model:open="isModalOpen"
      :mode="modalMode"
      :activeTab="activeTab"
      :pageConfig="pageConfig"
      :editItem="editItemTarget"
      :assetCategories="assetCategories"
      :usersList="[]"
      @success="fetchItems(true)"
    />
  </div>
</template>

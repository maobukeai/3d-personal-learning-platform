import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { useLabel } from '@/utils/i18n';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import type { UseSoftwaresQueryReturn } from './useSoftwaresQuery';
import {
  type SoftwareItem,
  type SoftwareStatus,
  normalizeSoftware,
  CATEGORY_ALL,
} from './softwaresSchema';

export function useSoftwaresMutations(query: UseSoftwaresQueryReturn) {
  const authStore = useAuthStore();
  const label = useLabel();

  const selectedSoftware = query.selectedSoftware;
  const isDetailDialogOpen = query.isDetailDialogOpen;

  const isUploadDialogOpen = ref(false);
  const isSearchOpen = ref(false);
  const initialPublishData = ref<any>(null);
  const isSavingReview = ref(false);
  const isBatchMode = ref(false);
  const selectedSoftwareIds = ref<Set<string>>(new Set());
  const isFilterOpen = ref(false);
  const isFilterCollapsed = ref(false);

  const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
  const currentUserId = computed(() => authStore.user?.id);

  function isSoftwareOwner(software: SoftwareItem) {
    return Boolean(
      currentUserId.value &&
      (software.user?.id === currentUserId.value ||
        (software as any).userId === currentUserId.value),
    );
  }

  function canEditSoftware(software: SoftwareItem) {
    return isAdmin.value || isSoftwareOwner(software);
  }

  const handleContainerClick = (e: MouseEvent) => {
    if (!isBatchMode.value) return;
    const target = e.target as HTMLElement;
    if (!target) return;
    if (
      target.closest(
        'article, .unified-card, button, input, .select-trigger, .glass-popover, [data-radix-popper-content-wrapper], a, select',
      )
    ) {
      return;
    }
    isBatchMode.value = false;
    selectedSoftwareIds.value = new Set();
  };

  const handleUploadClickSoftware = () => {
    isUploadDialogOpen.value = true;
  };

  const toggleSoftwareSelect = (id: string) => {
    const next = new Set(selectedSoftwareIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedSoftwareIds.value = next;
  };

  const selectAllSoftwares = () => {
    if (
      selectedSoftwareIds.value.size === query.visibleSoftwares.value.length &&
      query.visibleSoftwares.value.length > 0
    ) {
      selectedSoftwareIds.value = new Set();
    } else {
      selectedSoftwareIds.value = new Set(query.visibleSoftwares.value.map((p) => p.id));
    }
  };

  const handleBulkDeleteSoftwares = async () => {
    if (selectedSoftwareIds.value.size === 0) {
      ElMessage.warning(label('请选择要删除的插件', 'Please select softwares to delete'));
      return;
    }

    try {
      await ElMessageBox.confirm(
        label(
          `确定要物理删除选中的 ${selectedSoftwareIds.value.size} 个插件/草稿吗？关联文件也将被同步清除，此操作不可撤销！`,
          `Are you sure you want to delete ${selectedSoftwareIds.value.size} selected softwares? Associated files will also be deleted!`,
        ),
        label('批量删除确认', 'Confirm Bulk Delete'),
        {
          confirmButtonText: label('确定删除', 'Delete'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'warning',
        },
      );

      const ids = Array.from(selectedSoftwareIds.value);
      await api.post('/api/softwares/bulk-delete', { ids });

      ElMessage.success(
        label(`成功删除 ${ids.length} 个插件`, `Successfully deleted ${ids.length} softwares`),
      );
      selectedSoftwareIds.value = new Set();
      query.fetchSoftwares();
      query.fetchInsights();
    } catch (err: any) {
      if (err !== 'cancel') {
        ElMessage.error(
          getApiErrorMessage(err, label('批量删除失败', 'Failed to bulk delete softwares')),
        );
      }
    }
  };

  const handleBulkUnfavoriteSoftwares = async () => {
    if (selectedSoftwareIds.value.size === 0) {
      ElMessage.warning(label('请选择要取消收藏的插件', 'Please select softwares to unfavorite'));
      return;
    }

    try {
      await ElMessageBox.confirm(
        label(
          `确定要批量取消收藏选中的 ${selectedSoftwareIds.value.size} 个插件吗？`,
          `Are you sure you want to unfavorite ${selectedSoftwareIds.value.size} selected softwares?`,
        ),
        label('批量取消收藏确认', 'Confirm Bulk Unfavorite'),
        {
          confirmButtonText: label('确定', 'Confirm'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'warning',
        },
      );

      const ids = Array.from(selectedSoftwareIds.value);
      await api.post('/api/softwares/bulk/favorite', { ids, favorite: false });

      ElMessage.success(
        label(
          `成功取消收藏 ${ids.length} 个插件`,
          `Successfully unfavorited ${ids.length} softwares`,
        ),
      );
      selectedSoftwareIds.value = new Set();
      isBatchMode.value = false;
      query.fetchSoftwares();
      query.fetchInsights();
      query.fetchFavorites();
    } catch (err: any) {
      if (err !== 'cancel') {
        ElMessage.error(
          getApiErrorMessage(err, label('批量取消收藏失败', 'Failed to bulk unfavorite softwares')),
        );
      }
    }
  };

  const openDetail = (software: SoftwareItem) => {
    if (isBatchMode.value) {
      toggleSoftwareSelect(software.id);
      return;
    }
    selectedSoftware.value = software;
    isDetailDialogOpen.value = true;
  };

  const toggleFavorite = async (pluginId: string, event?: Event) => {
    event?.stopPropagation();
    try {
      const { data } = await api.post(`/api/softwares/${pluginId}/favorite`);
      query.favoritedIds.value = data.favoriteIds || [];
      ElMessage.success(
        data.isFavorited
          ? label('已收藏插件', 'Software saved')
          : label('已取消收藏', 'Favorite removed'),
      );
      query.fetchInsights();
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, label('收藏失败', 'Favorite failed')));
    }
  };

  const handleDownload = async (software: SoftwareItem, event?: Event) => {
    event?.stopPropagation();
    if (query.downloadingIds.value[software.id]) return;

    try {
      query.downloadingIds.value[software.id] = true;
      const { data } = await api.post(`/api/softwares/${software.id}/download`);
      const fileUrl = data.fileUrl || software.fileUrl;
      if (!fileUrl) {
        ElMessage.warning(
          label('该插件暂未提供下载文件', 'This software has no download file yet'),
        );
        return;
      }
      software.downloads += 1;
      window.open(getAssetUrl(fileUrl), '_blank', 'noopener,noreferrer');
      query.fetchInsights();
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, label('下载失败', 'Download failed')));
    } finally {
      delete query.downloadingIds.value[software.id];
    }
  };

  const resetFilters = () => {
    query.searchQuery.value = '';
    query.activeCategory.value = CATEGORY_ALL;
    query.selectedTag.value = 'all';
    query.showFavoritesOnly.value = false;
    query.fetchSoftwares();
  };

  const clearFilter = (key: string) => {
    if (key === 'category') query.activeCategory.value = CATEGORY_ALL;
    if (key === 'tag') query.selectedTag.value = 'all';
    if (key === 'favorites') query.showFavoritesOnly.value = false;
    if (key === 'search') query.searchQuery.value = '';
    query.fetchSoftwares();
  };

  const downloadSelectedSoftware = () => {
    if (selectedSoftware.value) handleDownload(selectedSoftware.value);
  };

  const deleteSoftware = async (software: SoftwareItem) => {
    try {
      await ElMessageBox.confirm(
        label(
          `确认删除插件「${software.title}」？此操作不可恢复。`,
          `Are you sure you want to delete software "${software.title}"? This action cannot be undone.`,
        ),
        label('删除插件', 'Delete Software'),
        {
          confirmButtonText: label('删除', 'Delete'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'warning',
        },
      );

      const oldSoftwares = [...query.visibleSoftwares.value];
      // Note: we can't directly assign to visibleSoftwares as it is computed.
      // But query.fetchSoftwares will update the source softwaresList.

      ElMessage.success(label('插件已删除', 'Software deleted'));
      isDetailDialogOpen.value = false;

      api
        .delete(`/api/softwares/${software.id}`)
        .then(() => {
          query.fetchSoftwares();
          query.fetchInsights();
        })
        .catch((error) => {
          ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
        });
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
      }
    }
  };

  const handleReviewApproved = async (software: SoftwareItem) => {
    try {
      await ElMessageBox.confirm(
        label(
          `确认通过插件「${software.title}」的发布申请？`,
          `Approve software "${software.title}"?`,
        ),
        label('审核插件', 'Review Software'),
        {
          confirmButtonText: label('通过', 'Approve'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'success',
        },
      );

      isSavingReview.value = true;
      const { data } = await api.put(`/api/admin/softwares/${software.id}/status`, {
        status: 'APPROVED',
      });

      ElMessage.success(label('插件已通过审核并发布', 'Software approved and published'));
      if (selectedSoftware.value && selectedSoftware.value.id === software.id) {
        selectedSoftware.value = normalizeSoftware(data, label);
      }
      query.fetchSoftwares();
      query.fetchInsights();
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getApiErrorMessage(error, label('审核失败', 'Review failed')));
      }
    } finally {
      isSavingReview.value = false;
    }
  };

  const handleReviewRejected = async (software: SoftwareItem) => {
    try {
      const { value } = await ElMessageBox.prompt(
        label('驳回原因', 'Rejection Reason'),
        label(`驳回「${software.title}」`, `Reject "${software.title}"`),
        {
          inputValue:
            software.rejectReason ||
            label(
              '安装指南、描述信息需要补充或测试不通过。',
              'Installation guide or description needs more information, or validation failed.',
            ),
          confirmButtonText: label('驳回', 'Reject'),
          cancelButtonText: label('取消', 'Cancel'),
          inputValidator: (val: string | null) => {
            if (!val?.trim()) return label('请输入驳回原因', 'Please enter rejection reason');
            return true;
          },
        },
      );

      isSavingReview.value = true;
      const { data } = await api.put(`/api/admin/softwares/${software.id}/status`, {
        status: 'REJECTED',
        rejectReason: value,
      });

      ElMessage.warning(label('已驳回该插件的发布申请', 'Software request rejected'));
      if (selectedSoftware.value && selectedSoftware.value.id === software.id) {
        selectedSoftware.value = normalizeSoftware(data, label);
      }
      query.fetchSoftwares();
      query.fetchInsights();
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getApiErrorMessage(error, label('操作失败', 'Action failed')));
      }
    } finally {
      isSavingReview.value = false;
    }
  };

  const handleSoftwareUpdate = async () => {
    query.fetchSoftwares();
    query.fetchInsights();
    if (selectedSoftware.value) {
      try {
        const { data } = await api.get(`/api/softwares/${selectedSoftware.value.id}`);
        selectedSoftware.value = normalizeSoftware(data, label);
      } catch (err) {
        logError(err, { operation: 'refresh software detail' });
      }
    }
  };

  const openLinkedSoftware = (pluginId: string) => {
    // Linked request handle
    const software = query.visibleSoftwares.value.find((item) => item.id === pluginId);
    if (software) {
      openDetail(software);
    } else {
      window.location.hash = `#/softwares?software=${pluginId}`;
      window.location.reload();
    }
  };

  return {
    selectedSoftware,
    isDetailDialogOpen,
    isUploadDialogOpen,
    isSearchOpen,
    initialPublishData,
    isSavingReview,
    isBatchMode,
    selectedSoftwareIds,
    isFilterOpen,
    isFilterCollapsed,
    isAdmin,
    handleContainerClick,
    handleUploadClickSoftware,
    selectAllSoftwares,
    handleBulkDeleteSoftwares,
    handleBulkUnfavoriteSoftwares,
    openDetail,
    toggleSoftwareSelect,
    toggleFavorite,
    handleDownload,
    resetFilters,
    clearFilter,
    downloadSelectedSoftware,
    deleteSoftware,
    handleReviewApproved,
    handleReviewRejected,
    handleSoftwareUpdate,
    openLinkedSoftware,
    canEditSoftware,
  };
}
export type UseSoftwaresMutationsReturn = ReturnType<typeof useSoftwaresMutations>;

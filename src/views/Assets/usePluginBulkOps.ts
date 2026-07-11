/* eslint-disable @typescript-eslint/no-explicit-any */
import api from '@/utils/api';
import { toast, messageBox } from '@/utils/feedbackAdapter';
import { getApiErrorMessage } from '@/utils/error';
import { useLabel } from '@/utils/i18n';
import type { usePluginsQuery } from './usePluginsQuery'; /** Bulk delete / unfavorite operations for the plugin library. * Extracted from the container to keep `PluginsView.vue` under 200 lines. */
export function usePluginBulkOps(q: ReturnType<typeof usePluginsQuery>) {
  const label = useLabel();
  const bulkDelete = async () => {
    if (q.selectedPluginIds.value.size === 0) {
      toast.warning(label('请选择要删除的插件', 'Please select plugins to delete'));
      return;
    }
    try {
      await messageBox.confirm(
        label(
          `确定要物理删除选中的 ${q.selectedPluginIds.value.size} 个插件/草稿吗？关联文件也将被同步清除，此操作不可撤销！`,
          `Are you sure you want to delete ${q.selectedPluginIds.value.size} selected plugins? Associated files will also be deleted!`,
        ),
        label('批量删除确认', 'Confirm Bulk Delete'),
        {
          confirmButtonText: label('确定删除', 'Delete'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'warning',
        },
      );
      const ids = Array.from(q.selectedPluginIds.value);
      await api.post('/api/plugins/bulk-delete', { ids });
      toast.success(
        label(`成功删除 ${ids.length} 个插件`, `Successfully deleted ${ids.length} plugins`),
      );
      q.selectedPluginIds.value = new Set();
      q.fetchPlugins();
      q.fetchInsights();
    } catch (err: any) {
      if (err !== 'cancel')
        toast.error(
          getApiErrorMessage(err, label('批量删除失败', 'Failed to bulk delete plugins')),
        );
    }
  };
  const bulkUnfavorite = async () => {
    if (q.selectedPluginIds.value.size === 0) {
      toast.warning(label('请选择要取消收藏的插件', 'Please select plugins to unfavorite'));
      return;
    }
    try {
      await messageBox.confirm(
        label(
          `确定要批量取消收藏选中的 ${q.selectedPluginIds.value.size} 个插件吗？`,
          `Are you sure you want to unfavorite ${q.selectedPluginIds.value.size} selected plugins?`,
        ),
        label('批量取消收藏确认', 'Confirm Bulk Unfavorite'),
        {
          confirmButtonText: label('确定', 'Confirm'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'warning',
        },
      );
      const ids = Array.from(q.selectedPluginIds.value);
      await api.post('/api/plugins/bulk/favorite', { ids, favorite: false });
      toast.success(
        label(
          `成功取消收藏 ${ids.length} 个插件`,
          `Successfully unfavorited ${ids.length} plugins`,
        ),
      );
      q.selectedPluginIds.value = new Set();
      q.isBatchMode.value = false;
      q.fetchPlugins();
      q.fetchInsights();
      q.fetchFavorites();
    } catch (err: any) {
      if (err !== 'cancel')
        toast.error(
          getApiErrorMessage(err, label('批量取消收藏失败', 'Failed to bulk unfavorite plugins')),
        );
    }
  };
  return { bulkDelete, bulkUnfavorite };
}

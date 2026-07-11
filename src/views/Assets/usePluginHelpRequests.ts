import { onMounted, ref, watch, type Ref } from 'vue';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import type {
  HelpRequest,
  LibraryTab,
} from './pluginsSchema'; /** * Forum-list state for the plugin help-requests tab. The detail / reply / * resolve interactions are owned locally by `PluginsGrid` (which renders the * forum and its detail modal); this composable only keeps the shared list + * count that the page tabs and forum both consume. */
export function usePluginHelpRequests(activeTab: Ref<LibraryTab>) {
  const helpRequests = ref<HelpRequest[]>([]);
  const helpRequestsCount = ref(0);
  const isHelpRequestsLoading = ref(false);
  const fetchHelpRequests = async () => {
    try {
      isHelpRequestsLoading.value = true;
      const { data } = await api.get('/api/plugins/requests');
      helpRequests.value = data.requests || [];
      helpRequestsCount.value = data.pagination?.total || helpRequests.value.length;
    } catch (err) {
      logError(err, { operation: 'fetch help requests' });
    } finally {
      isHelpRequestsLoading.value = false;
    }
  };
  watch(activeTab, () => {
    if (activeTab.value === 'requests') fetchHelpRequests();
  });
  onMounted(() => {
    fetchHelpRequests();
  });
  return { helpRequests, helpRequestsCount, isHelpRequestsLoading, fetchHelpRequests };
}

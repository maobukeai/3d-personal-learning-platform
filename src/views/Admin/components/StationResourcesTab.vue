<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Search, Loader2, FileText, Eye, Calendar, Edit3, Trash2, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import ManualResourceDialog from './ManualResourceDialog.vue';

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

const props = defineProps<{
  stationId: string;
  categories: ManualCategory[];
  formattedCategories: ManualCategory[];
}>();

const emit = defineEmits<{
  (e: 'refresh-station'): void;
}>();

const resourceList = ref<ManualResource[]>([]);
const resourceTotal = ref(0);
const resourcePage = ref(1);
const resourcePageSize = ref(20);
const resourceTotalPages = ref(0);
const resourceSearch = ref('');
const resourceCategoryFilter = ref<string | null>(null);
const isLoadingResources = ref(false);

const manualResourceDialogRef = ref<any>(null);

const fetchStationResources = async () => {
  if (!props.stationId) return;
  isLoadingResources.value = true;
  try {
    const params: any = {
      page: resourcePage.value,
      pageSize: resourcePageSize.value,
    };
    if (resourceCategoryFilter.value) {
      params.categoryId = resourceCategoryFilter.value;
    }
    if (resourceSearch.value) {
      params.search = resourceSearch.value;
    }

    const res = await api.get(`/api/manual/stations/${props.stationId}/resources`, { params });
    resourceList.value = res.data.resources;
    resourceTotal.value = res.data.total;
    resourceTotalPages.value = res.data.totalPages;
  } catch (_e) {
    ElMessage.error('拉取资源失败');
  } finally {
    isLoadingResources.value = false;
  }
};

const handleResourceSearch = () => {
  resourcePage.value = 1;
  fetchStationResources();
};

const handleCategoryFilterChange = () => {
  resourcePage.value = 1;
  fetchStationResources();
};

const handlePageChange = (newPage: number) => {
  resourcePage.value = newPage;
  fetchStationResources();
};

const deleteResource = async (resource: ManualResource) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除资源「${resource.title}」吗？`,
      '确认删除资源',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await api.delete(`/api/admin/manual/resources/${resource.id}`);
    ElMessage.success('资源删除成功');
    fetchStationResources();
    emit('refresh-station');
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除资源失败');
    }
  }
};

onMounted(() => {
  fetchStationResources();
});

watch(
  () => props.stationId,
  () => {
    resourcePage.value = 1;
    resourceSearch.value = '';
    resourceCategoryFilter.value = null;
    fetchStationResources();
  }
);

defineExpose({
  fetchStationResources,
  openCreateResource: () => manualResourceDialogRef.value?.openCreate(),
});
</script>

<template>
  <div class="space-y-4">
    <!-- Search & Filters -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          v-model="resourceSearch"
          type="text"
          placeholder="输入关键字回车检索..."
          class="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:border-cyan-500 outline-none bg-white dark:bg-slate-900/60"
          style="color: var(--text-primary);"
          @keydown.enter="handleResourceSearch"
        />
      </div>
      <select
        v-model="resourceCategoryFilter"
        class="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:border-cyan-500 outline-none bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 min-w-[150px]"
        @change="handleCategoryFilterChange"
      >
        <option :value="null">所有分类</option>
        <option v-for="cat in props.formattedCategories" :key="cat.id" :value="cat.id">
          {{ cat.name }}
        </option>
      </select>
    </div>

    <!-- Resource List Loading -->
    <div v-if="isLoadingResources" class="flex justify-center py-10">
      <Loader2 class="w-8 h-8 text-cyan-500 animate-spin" />
    </div>

    <!-- Empty Resources -->
    <div
      v-else-if="resourceList.length === 0"
      class="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800 rounded-2xl"
    >
      <FileText class="w-8 h-8 text-slate-300 mb-2" />
      <p class="text-xs text-slate-400">在此资源站中未检索到任何资源...</p>
    </div>

    <!-- Resources List -->
    <div v-else class="space-y-2">
      <div
        v-for="res in resourceList"
        :key="res.id"
        class="flex items-center justify-between p-3 bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/55 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all gap-4"
      >
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div
            v-if="res.thumbnailUrl"
            class="w-12 h-8 rounded bg-slate-100 dark:bg-slate-800 shrink-0 bg-cover bg-center border border-slate-100 dark:border-slate-800"
            :style="{ backgroundImage: `url(${getAssetUrl(res.thumbnailUrl)})` }"
          ></div>
          <div
            v-else
            class="w-12 h-8 rounded bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400"
          >
            <FileText class="w-4 h-4" />
          </div>
          <div class="min-w-0 flex-1 space-y-0.5 text-left">
            <h4 class="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
              {{ res.title }}
            </h4>
            <div class="flex items-center gap-2 text-[10px] text-slate-400">
              <span class="font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20 px-1.5 py-0.2 rounded">
                {{ res.category?.name || '未分类' }}
              </span>
              <span class="flex items-center gap-0.5"><Eye class="w-3 h-3" /> {{ res.viewCount }}</span>
              <span class="flex items-center gap-0.5"><Calendar class="w-3 h-3" /> {{ new Date(res.createdAt).toLocaleDateString() }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button type="button" class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg transition-colors border border-slate-200/40 dark:border-slate-700/40 bg-transparent cursor-pointer" title="编辑资源" @click="manualResourceDialogRef?.openEdit(res)">
            <Edit3 class="w-3.5 h-3.5" />
          </button>
          <button type="button" class="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg transition-colors border border-rose-200/20 bg-transparent cursor-pointer" title="删除资源" @click="deleteResource(res)">
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div v-if="resourceTotalPages > 1" class="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800 pt-4 mt-2">
        <span class="text-[10px] text-slate-400">显示 {{ (resourcePage - 1) * resourcePageSize + 1 }} 到 {{ Math.min(resourcePage * resourcePageSize, resourceTotal) }}，共 {{ resourceTotal }} 个资源</span>
        <div class="flex items-center gap-2">
          <button type="button" :disabled="resourcePage === 1" class="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-40 bg-transparent cursor-pointer text-slate-500" @click="handlePageChange(resourcePage - 1)">
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-xs font-medium px-2" style="color: var(--text-primary);">{{ resourcePage }} / {{ resourceTotalPages }}</span>
          <button type="button" :disabled="resourcePage === resourceTotalPages" class="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-40 bg-transparent cursor-pointer text-slate-500" @click="handlePageChange(resourcePage + 1)">
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Unified markdown resource dialog -->
    <ManualResourceDialog
      ref="manualResourceDialogRef"
      :station-id="props.stationId"
      :categories="props.categories"
      :formatted-categories="props.formattedCategories"
      @refresh="fetchStationResources(); emit('refresh-station');"
    />
  </div>
</template>

<script setup lang="ts">
import { Loader2, Globe, Database, Layers, Sparkles, Plus } from 'lucide-vue-next';
import type {
  MirrorSource,
  SyncProgress,
  MirrorResource,
  MirrorCategory,
} from '../AdminMirrorView.vue';
import MirrorSourceCard from './MirrorSourceCard.vue';
import MirrorResourcePanel from './MirrorResourcePanel.vue';

defineProps<{
  sources: MirrorSource[];
  filteredSources: MirrorSource[];
  isLoading: boolean;
  expandedSourceId: string | null;
  progressMap: Record<string, SyncProgress>;
  resourceList: MirrorResource[];
  resourceTotal: number;
  resourcePage: number;
  resourceTotalPages: number;
  isLoadingResources: boolean;
  sourceCategories: MirrorCategory[];
  formattedMirrorCategories: MirrorCategory[];
}>();

const expandedTab = defineModel<'resources' | 'categories'>('expandedTab', { required: true });
const resourceSearch = defineModel<string>('resourceSearch', { required: true });
const resourceCategoryFilter = defineModel<string | null>('resourceCategoryFilter', {
  required: true,
});

const emit = defineEmits<{
  sync: [sourceId: string, type: 'FULL' | 'INCREMENTAL'];
  cancelSync: [sourceId: string];
  viewLogs: [source: MirrorSource];
  matchLinks: [source: MirrorSource];
  toggleResources: [source: MirrorSource];
  cleanup: [source: MirrorSource];
  export: [source: MirrorSource];
  edit: [source: MirrorSource];
  delete: [source: MirrorSource];
  resourceSearch: [];
  changeResourcePage: [page: number];
  createResource: [];
  editResource: [resource: MirrorResource];
  deleteResource: [resource: MirrorResource];
  createCategory: [];
  editCategory: [category: MirrorCategory];
  deleteCategory: [category: MirrorCategory];
  createSource: [];
}>();
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 animate-spin text-blue-500" />
      <span class="ml-2 text-slate-500">加载中...</span>
    </div>

    <div v-else-if="sources.length === 0" class="max-w-4xl mx-auto py-12 px-4">
      <div class="text-center mb-10">
        <div
          class="inline-flex p-4 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-2xl border border-blue-500/20 mb-6 shadow-inner relative group"
        >
          <div
            class="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"
          ></div>
          <Globe class="w-12 h-12 text-blue-500 relative z-10 animate-[spin_60s_linear_infinite]" />
        </div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          开启您的 3D 资产同步之旅
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed">
          通过配置镜像源，您可以将外部平台的 3D
          模型、设计材质、系统课程一键本地化，创建专属于您的云学习平台工作区。
        </p>
      </div>

      <!-- Feature Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 mobile-grid">
        <div
          class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-blue-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center"
        >
          <div class="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-500 mb-4">
            <Database class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            3D 资产自动抓取
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            支持自动探测并抓取远端平台的模型详情与元数据，保持本地库与时俱进。
          </p>
        </div>

        <div
          class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-indigo-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center"
        >
          <div class="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-500 mb-4">
            <Layers class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            独立工作空间映射
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            为每个镜像源生成专属前台工作空间，自定义独立分类展示与权限配置。
          </p>
        </div>

        <div
          class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-violet-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center"
        >
          <div class="p-3 bg-violet-50 dark:bg-violet-500/10 rounded-xl text-violet-500 mb-4">
            <Sparkles class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            富媒体深度本地化
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            智能提取详情页及文章结构，并将图片、文件离线下载至本地，极速秒开。
          </p>
        </div>
      </div>

      <div class="text-center">
        <button
          type="button"
          class="relative inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 duration-200"
          @click="emit('createSource')"
        >
          <Plus class="w-5 h-5" />
          配置首个镜像同步源
        </button>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div v-for="source in filteredSources" :key="source.id">
        <MirrorSourceCard
          :source="source"
          :progress="progressMap[source.id]"
          :expanded="expandedSourceId === source.id"
          @sync-full="emit('sync', source.id, 'FULL')"
          @sync-incremental="emit('sync', source.id, 'INCREMENTAL')"
          @cancel-sync="emit('cancelSync', source.id)"
          @view-logs="emit('viewLogs', source)"
          @match-links="emit('matchLinks', source)"
          @toggle-resources="emit('toggleResources', source)"
          @cleanup="emit('cleanup', source)"
          @export="emit('export', source)"
          @edit="emit('edit', source)"
          @delete="emit('delete', source)"
        />

        <MirrorResourcePanel
          v-if="expandedSourceId === source.id"
          v-model:tab="expandedTab"
          v-model:resource-search="resourceSearch"
          v-model:resource-category-filter="resourceCategoryFilter"
          :source-id="source.id"
          :resources="resourceList"
          :resource-total="resourceTotal"
          :resource-page="resourcePage"
          :resource-total-pages="resourceTotalPages"
          :is-loading-resources="isLoadingResources"
          :source-categories="sourceCategories"
          :formatted-mirror-categories="formattedMirrorCategories"
          @resource-search="emit('resourceSearch')"
          @change-resource-page="emit('changeResourcePage', $event)"
          @create-resource="emit('createResource')"
          @edit-resource="emit('editResource', $event)"
          @delete-resource="emit('deleteResource', $event)"
          @create-category="emit('createCategory')"
          @edit-category="emit('editCategory', $event)"
          @delete-category="emit('deleteCategory', $event)"
        />
      </div>
    </div>
  </div>
</template>

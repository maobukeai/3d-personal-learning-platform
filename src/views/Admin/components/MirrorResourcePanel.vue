<script setup lang="ts">
import {
  Search,
  Plus,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  Database,
  Loader2,
} from 'lucide-vue-next';
import type { MirrorResource, MirrorCategory } from '../AdminMirrorView.vue';

const props = defineProps<{
  sourceId: string;
  resources: MirrorResource[];
  resourceTotal: number;
  resourcePage: number;
  resourceTotalPages: number;
  isLoadingResources: boolean;
  sourceCategories: MirrorCategory[];
  formattedMirrorCategories: MirrorCategory[];
}>();

const tab = defineModel<'resources' | 'categories'>('tab', { required: true });
const resourceSearch = defineModel<string>('resourceSearch', { required: true });
const resourceCategoryFilter = defineModel<string | null>('resourceCategoryFilter', {
  required: true,
});

const emit = defineEmits<{
  resourceSearch: [];
  changeResourcePage: [page: number];
  createResource: [];
  editResource: [resource: MirrorResource];
  deleteResource: [resource: MirrorResource];
  createCategory: [];
  editCategory: [category: MirrorCategory];
  deleteCategory: [category: MirrorCategory];
}>();

function onSearchEnter() {
  emit('resourceSearch');
}

function onCategoryChange() {
  emit('resourceSearch');
}

function changePage(page: number) {
  emit('changeResourcePage', page);
}
</script>

<template>
  <div
    class="border-t border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/10"
  >
    <div class="p-4 sm:p-5">
      <!-- Tab Navigation for Mirror Sources -->
      <div class="flex border-b border-slate-200 dark:border-slate-700/60 mb-5 gap-6">
        <button
          type="button"
          class="pb-2.5 text-sm font-semibold transition-all border-b-2 px-1 focus:outline-none flex items-center gap-1.5"
          :class="
            tab === 'resources'
              ? 'text-cyan-500 border-cyan-500'
              : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
          "
          @click="tab = 'resources'"
        >
          <FileText class="w-4 h-4" />
          资源管理
        </button>
        <button
          type="button"
          class="pb-2.5 text-sm font-semibold transition-all border-b-2 px-1 focus:outline-none flex items-center gap-1.5"
          :class="
            tab === 'categories'
              ? 'text-cyan-500 border-cyan-500'
              : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
          "
          @click="tab = 'categories'"
        >
          <Layers class="w-4 h-4" />
          分类管理
        </button>
      </div>

      <!-- Resource Management Content -->
      <div v-if="tab === 'resources'" class="space-y-4">
        <!-- Header -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mobile-row"
        >
          <h4
            class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
          >
            <FileText class="w-4 h-4 text-cyan-500" />
            资源管理
            <span class="text-xs text-slate-400 font-normal">共 {{ resourceTotal }} 个</span>
          </h4>
          <div class="flex items-center gap-2 mobile-row">
            <div class="relative min-w-0">
              <Search
                class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                v-model="resourceSearch"
                type="text"
                placeholder="搜索资源..."
                class="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 w-full max-w-[12rem]"
                @keyup.enter="onSearchEnter"
              />
            </div>
            <select
              v-model="resourceCategoryFilter"
              class="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              @change="onCategoryChange"
            >
              <option :value="null">全部分类</option>
              <option v-for="cat in formattedMirrorCategories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
            <button
              type="button"
              class="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors"
              @click="emit('createResource')"
            >
              <Plus class="w-3.5 h-3.5" />
              新增资源
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="isLoadingResources" class="flex items-center justify-center py-10">
          <Loader2 class="w-5 h-5 animate-spin text-cyan-500" />
          <span class="ml-2 text-sm text-slate-500">加载资源...</span>
        </div>

        <!-- Empty -->
        <div v-else-if="resources.length === 0" class="text-center py-10">
          <Database class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p class="text-sm text-slate-400">暂无资源数据</p>
        </div>

        <!-- Resource Table -->
        <div v-else class="overflow-x-auto mobile-table">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700">
                <th class="text-left py-2 px-2 text-slate-500 font-medium">标题</th>
                <th class="text-left py-2 px-2 text-slate-500 font-medium hidden md:table-cell">
                  分类
                </th>
                <th class="text-left py-2 px-2 text-slate-500 font-medium hidden sm:table-cell">
                  类型
                </th>
                <th class="text-center py-2 px-2 text-slate-500 font-medium hidden sm:table-cell">
                  浏览
                </th>
                <th class="text-center py-2 px-2 text-slate-500 font-medium hidden lg:table-cell">
                  链接
                </th>
                <th class="text-right py-2 px-2 text-slate-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="res in resources"
                :key="res.id"
                class="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td class="py-2.5 px-2">
                  <div class="flex items-center gap-2 max-w-xs">
                    <img
                      v-if="res.thumbnailUrl"
                      alt=""
                      :src="res.thumbnailUrl"
                      class="w-8 h-8 rounded object-cover flex-shrink-0 bg-slate-100 dark:bg-slate-700"
                    />
                    <div
                      v-else
                      class="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0"
                    >
                      <FileText class="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <span class="text-slate-800 dark:text-slate-200 font-medium truncate">{{
                      res.title
                    }}</span>
                  </div>
                </td>
                <td class="py-2.5 px-2 text-slate-500 hidden md:table-cell">
                  {{ res.category?.name || '-' }}
                </td>
                <td class="py-2.5 px-2 hidden sm:table-cell">
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500"
                    >{{ res.resourceType }}</span
                  >
                </td>
                <td class="py-2.5 px-2 text-center text-slate-500 hidden sm:table-cell">
                  {{ res.viewCount }}
                </td>
                <td class="py-2.5 px-2 text-center hidden lg:table-cell">
                  <span v-if="res.contentUrl" class="text-emerald-500">✓</span>
                  <span v-else class="text-slate-300">-</span>
                </td>
                <td class="py-2.5 px-2">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                      title="编辑"
                      @click="emit('editResource', res)"
                    >
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      class="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="删除"
                      @click="emit('deleteResource', res)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div
            v-if="resourceTotalPages > 1"
            class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/30"
          >
            <span class="text-xs text-slate-400"
              >第 {{ resourcePage }}/{{ resourceTotalPages }} 页，共 {{ resourceTotal }} 条</span
            >
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                :disabled="resourcePage <= 1"
                @click="changePage(resourcePage - 1)"
              >
                <ChevronLeft class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                :disabled="resourcePage >= resourceTotalPages"
                @click="changePage(resourcePage + 1)"
              >
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Management View -->
      <div v-if="tab === 'categories'" class="space-y-4">
        <div class="flex items-center justify-between mobile-row">
          <h4
            class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
          >
            <Layers class="w-4 h-4 text-cyan-500" />
            分类管理
            <span class="text-xs text-slate-400 font-normal"
              >共 {{ sourceCategories.length }} 个分类</span
            >
          </h4>
          <button
            type="button"
            class="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors"
            @click="emit('createCategory')"
          >
            <Plus class="w-3.5 h-3.5" />
            新增分类
          </button>
        </div>

        <div v-if="sourceCategories.length === 0" class="text-center py-10">
          <Layers class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p class="text-sm text-slate-400">暂无分类数据，请先创建分类</p>
        </div>

        <div v-else class="overflow-x-auto mobile-table">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700">
                <th class="text-left py-2 px-2 text-slate-500 font-medium">名称</th>
                <th class="text-left py-2 px-2 text-slate-500 font-medium">父级分类</th>
                <th class="text-left py-2 px-2 text-slate-500 font-medium">Slug (别名)</th>
                <th class="text-center py-2 px-2 text-slate-500 font-medium">排序权重 (Order)</th>
                <th class="text-right py-2 px-2 text-slate-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="cat in sourceCategories"
                :key="cat.id"
                class="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td class="py-2.5 px-2 font-medium text-slate-800 dark:text-slate-200">
                  {{ cat.name }}
                </td>
                <td class="py-2.5 px-2 text-slate-500">
                  {{
                    cat.parentExternalId
                      ? sourceCategories.find((c) => c.externalId === cat.parentExternalId)?.name ||
                        '-'
                      : '-'
                  }}
                </td>
                <td class="py-2.5 px-2 text-slate-500">{{ cat.slug || '-' }}</td>
                <td class="py-2.5 px-2 text-center text-slate-500">{{ cat.order ?? 0 }}</td>
                <td class="py-2.5 px-2">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                      title="编辑"
                      @click="emit('editCategory', cat)"
                    >
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      class="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="删除"
                      @click="emit('deleteCategory', cat)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

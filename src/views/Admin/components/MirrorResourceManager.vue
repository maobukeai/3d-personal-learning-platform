<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { getApiErrorMessage } from '@/utils/error';
import { ref, computed, watch } from 'vue';
import {
  FileText,
  Layers,
  Search,
  Plus,
  Loader2,
  Database,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';

interface MirrorResource {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  contentHtml: string | null;
  tags: string | null;
  resourceType: string;
  viewCount: number;
  publishedAt: string | null;
  categoryId: string | null;
  category: { name: string } | null;
  externalId: string;
  createdAt: string;
}

interface MirrorCategory {
  id: string;
  name: string;
  slug?: string;
  order?: number;
  externalId: string;
  parentExternalId?: string | null;
}

type ResourceQueryParams = {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
};

const props = defineProps<{
  sourceId: string;
}>();

const emit = defineEmits<{
  (e: 'update-counts'): void;
}>();

const expandedTab = ref<'resources' | 'categories'>('resources');
const resourceList = ref<MirrorResource[]>([]);
const resourceTotal = ref(0);
const resourcePage = ref(1);
const resourcePageSize = ref(20);
const resourceTotalPages = ref(0);
const resourceSearch = ref('');
const resourceCategoryFilter = ref<string | null>(null);
const isLoadingResources = ref(false);
const sourceCategories = ref<MirrorCategory[]>([]);

// Resource dialog state
const showResourceDialog = ref(false);
const isEditingResource = ref(false);
const editingResource = ref<MirrorResource | null>(null);
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

// Category dialog state
const showCategoryDialog = ref(false);
const isEditingCategory = ref(false);
const editingCategory = ref<MirrorCategory | null>(null);
const categoryForm = ref({
  name: '',
  slug: '',
  order: 0,
  parentExternalId: null as string | null,
  childExternalIds: [] as string[],
});

const parentCategoryOptions = computed(() => {
  return sourceCategories.value.filter((cat) => {
    if (editingCategory.value && cat.id === editingCategory.value.id) return false;
    return !cat.parentExternalId;
  });
});

const eligibleSubcategories = computed(() => {
  const categories = sourceCategories.value;
  const currentExternalId = editingCategory.value?.externalId;
  const parentExternalIds = new Set<string>();
  categories.forEach((c) => {
    if (c.parentExternalId && c.parentExternalId !== currentExternalId) {
      parentExternalIds.add(c.parentExternalId);
    }
  });
  return categories.filter((c) => {
    if (currentExternalId && c.externalId === currentExternalId) return false;
    if (parentExternalIds.has(c.externalId)) return false;
    return true;
  });
});

const formattedMirrorCategories = computed(() => {
  const categories = sourceCategories.value;
  const parentMap = new Map<string, MirrorCategory[]>();
  const topLevel: MirrorCategory[] = [];

  categories.forEach((cat) => {
    if (cat.parentExternalId) {
      if (!parentMap.has(cat.parentExternalId)) {
        parentMap.set(cat.parentExternalId, []);
      }
      parentMap.get(cat.parentExternalId)!.push(cat);
    }
  });

  categories.forEach((cat) => {
    const hasParent =
      cat.parentExternalId && categories.some((p) => p.externalId === cat.parentExternalId);
    if (!hasParent) {
      topLevel.push(cat);
    }
  });

  topLevel.sort((a, b) => (a.order || 0) - (b.order || 0));

  const result: Array<MirrorCategory> = [];

  topLevel.forEach((parent) => {
    result.push(parent);
    const children = parentMap.get(parent.externalId) || [];
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

function getParentCategoryName(cat: MirrorCategory) {
  if (!cat.parentExternalId) return '-';
  const parent = sourceCategories.value.find((c) => c.externalId === cat.parentExternalId);
  return parent ? parent.name : '-';
}

async function fetchResources(sourceId: string) {
  isLoadingResources.value = true;
  try {
    const params: ResourceQueryParams = { page: resourcePage.value, pageSize: resourcePageSize.value };
    if (resourceSearch.value) params.search = resourceSearch.value;
    if (resourceCategoryFilter.value) params.categoryId = resourceCategoryFilter.value;
    const res = await api.get(`/api/admin/mirror/sources/${sourceId}/resources`, { params });
    resourceList.value = res.data.resources;
    resourceTotal.value = res.data.total;
    resourceTotalPages.value = res.data.totalPages;
  } catch (_e) {
    ElMessage.error(t('admin.failed_to_load_resource'));
  } finally {
    isLoadingResources.value = false;
  }
}

async function fetchCategories(sourceId: string) {
  try {
    const res = await api.get(`/api/mirror/sources/${sourceId}/categories`);
    sourceCategories.value = res.data;
  } catch {
    sourceCategories.value = [];
  }
}

watch(
  () => props.sourceId,
  (newId) => {
    if (newId) {
      resourcePage.value = 1;
      resourceSearch.value = '';
      resourceCategoryFilter.value = null;
      fetchResources(newId);
      fetchCategories(newId);
    }
  },
  { immediate: true },
);

function doResourceSearch() {
  resourcePage.value = 1;
  fetchResources(props.sourceId);
}

function changeResourcePage(page: number) {
  resourcePage.value = page;
  fetchResources(props.sourceId);
}

function resetResourceForm() {
  resourceForm.value = {
    title: '',
    description: '',
    thumbnailUrl: '',
    contentUrl: '',
    tags: '',
    contentHtml: '',
    resourceType: 'COURSE',
    categoryId: '',
  };
}

function openCreateResource() {
  isEditingResource.value = false;
  editingResource.value = null;
  resetResourceForm();
  showResourceDialog.value = true;
}

async function openEditResource(res: MirrorResource) {
  isEditingResource.value = true;
  editingResource.value = res;
  try {
    const detail = await api.get(`/api/admin/mirror/resources/${res.id}`);
    const r = detail.data;
    resourceForm.value = {
      title: r.title || '',
      description: r.description || '',
      thumbnailUrl: r.thumbnailUrl || '',
      contentUrl: r.contentUrl || '',
      tags: r.tags || '',
      contentHtml: r.contentHtml || '',
      resourceType: r.resourceType || 'COURSE',
      categoryId: r.categoryId || '',
    };
  } catch {
    resourceForm.value = {
      title: res.title || '',
      description: res.description || '',
      thumbnailUrl: res.thumbnailUrl || '',
      contentUrl: res.contentUrl || '',
      tags: res.tags || '',
      contentHtml: res.contentHtml || '',
      resourceType: res.resourceType || 'COURSE',
      categoryId: res.categoryId || '',
    };
  }
  showResourceDialog.value = true;
}

async function saveResource() {
  if (!resourceForm.value.title.trim()) {
    ElMessage.warning(t('admin.please_enter_a_resource'));
    return;
  }
  try {
    const payload = {
      ...resourceForm.value,
      categoryId: resourceForm.value.categoryId || null,
    };

    if (isEditingResource.value && editingResource.value) {
      await api.put(`/api/admin/mirror/resources/${editingResource.value.id}`, payload);
      ElMessage.success(t('admin.resource_updated_successfully'));
    } else {
      await api.post(`/api/admin/mirror/sources/${props.sourceId}/resources`, payload);
      ElMessage.success(t('admin.resource_created_successfully_1'));
    }
    showResourceDialog.value = false;
    await fetchResources(props.sourceId);
    emit('update-counts');
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } } };
    ElMessage.error(getApiErrorMessage(err, t('admin.operation_failed')));
  }
}

async function deleteResource(res: MirrorResource) {
  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_9', { restitle: res.title }),
      t('admin.confirm_resource_deletion'),
      {
        confirmButtonText: t('admin.confirm_deletion_1'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/mirror/resources/${res.id}`);
    ElMessage.success(t('admin.resource_deleted'));
    await fetchResources(props.sourceId);
    emit('update-counts');
  } catch (e) {
    if (e !== 'cancel') {
      const err = e as { response?: { data?: { error?: string } } };
      ElMessage.error(getApiErrorMessage(err, t('admin.delete_failed')));
    }
  }
}

function resetCategoryForm() {
  categoryForm.value = {
    name: '',
    slug: '',
    order: 0,
    parentExternalId: null,
    childExternalIds: [],
  };
}

function openCreateCategory() {
  isEditingCategory.value = false;
  editingCategory.value = null;
  resetCategoryForm();
  showCategoryDialog.value = true;
}

function openEditCategory(cat: MirrorCategory) {
  isEditingCategory.value = true;
  editingCategory.value = cat;
  const currentChildExternalIds = sourceCategories.value
    .filter((c) => c.parentExternalId === cat.externalId)
    .map((c) => c.externalId);
  categoryForm.value = {
    name: cat.name,
    slug: cat.slug || '',
    order: cat.order || 0,
    parentExternalId: cat.parentExternalId || null,
    childExternalIds: currentChildExternalIds,
  };
  showCategoryDialog.value = true;
}

async function saveCategory() {
  if (!categoryForm.value.name.trim()) {
    ElMessage.warning(t('admin.please_enter_the_category'));
    return;
  }
  try {
    const payload = {
      name: categoryForm.value.name,
      slug: categoryForm.value.slug || undefined,
      order: categoryForm.value.order,
      parentExternalId: categoryForm.value.parentExternalId || null,
      childExternalIds: categoryForm.value.childExternalIds,
    };

    if (isEditingCategory.value && editingCategory.value) {
      await api.put(`/api/admin/mirror/categories/${editingCategory.value.id}`, payload);
      ElMessage.success(t('admin.classification_updated_successfully'));
    } else {
      await api.post(`/api/admin/mirror/sources/${props.sourceId}/categories`, payload);
      ElMessage.success(t('admin.category_created_successfully'));
    }
    showCategoryDialog.value = false;
    await fetchCategories(props.sourceId);
    emit('update-counts');
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } } };
    ElMessage.error(getApiErrorMessage(err, t('admin.operation_failed')));
  }
}

async function deleteCategory(cat: MirrorCategory) {
  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_5', { catname: cat.name }),
      t('admin.confirm_category_deletion'),
      {
        confirmButtonText: t('admin.confirm_deletion_1'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/mirror/categories/${cat.id}`);
    ElMessage.success(t('admin.category_deleted'));
    await fetchCategories(props.sourceId);
    await fetchResources(props.sourceId);
    emit('update-counts');
  } catch (e) {
    if (e !== 'cancel') {
      const err = e as { response?: { data?: { error?: string } } };
      ElMessage.error(getApiErrorMessage(err, t('admin.delete_failed')));
    }
  }
}
</script>

<template>
  <div class="border-t border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/10">
    <div class="p-4 sm:p-5">
      <!-- Tab Navigation for Mirror Sources -->
      <div class="flex border-b border-slate-200 dark:border-slate-700/60 mb-5 gap-6">
        <button
type="button" class="pb-2.5 text-sm font-semibold transition-all border-b-2 px-1 focus:outline-none flex items-center gap-1.5 cursor-pointer" :class="
            expandedTab === 'resources'
              ? 'text-cyan-500 border-cyan-500'
              : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
          " @click="expandedTab = 'resources'">
          <FileText class="w-4 h-4" />
          资源管理
        </button>
        <button
type="button" class="pb-2.5 text-sm font-semibold transition-all border-b-2 px-1 focus:outline-none flex items-center gap-1.5 cursor-pointer" :class="
            expandedTab === 'categories'
              ? 'text-cyan-500 border-cyan-500'
              : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
          " @click="expandedTab = 'categories'">
          <Layers class="w-4 h-4" />
          分类管理
        </button>
      </div>

      <!-- Resource Management Content -->
      <div v-if="expandedTab === 'resources'" class="space-y-4">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h4
            class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
          >
            <FileText class="w-4 h-4 text-cyan-500" />
            资源管理
            <span class="text-xs text-slate-400 font-normal">{{ $t('admin.total_resourcetotal') }}</span>
          </h4>
          <div class="flex items-center gap-2">
            <div class="relative">
              <Search
                class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                v-model="resourceSearch"
                type="text"
                :placeholder="$t('admin.search_resources')"
                class="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 w-48"
                @keyup.enter="doResourceSearch"
              />
            </div>
            <select
              v-model="resourceCategoryFilter"
              class="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              @change="doResourceSearch"
            >
              <option :value="null">{{ $t('admin.all_categories') }}</option>
              <option
                v-for="cat in formattedMirrorCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
            <button type="button" class="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer" @click="openCreateResource">
              <Plus class="w-3.5 h-3.5" />
              {{ $t('admin.add_new_resources') }}
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="isLoadingResources" class="flex items-center justify-center py-10">
          <Loader2 class="w-5 h-5 animate-spin text-cyan-500" />
          <span class="ml-2 text-sm text-slate-500">{{ $t('admin.loading_resources') }}</span>
        </div>

        <!-- Empty -->
        <div v-else-if="resourceList.length === 0" class="text-center py-10">
          <Database class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p class="text-sm text-slate-400">{{ $t('admin.no_resource_data_yet') }}</p>
        </div>

        <!-- Resource Table -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700">
                <th class="text-left py-2 px-2 text-slate-500 font-medium">{{ $t('admin.title') }}</th>
                <th
                  class="text-left py-2 px-2 text-slate-500 font-medium hidden md:table-cell"
                >
                  分类
                </th>
                <th
                  class="text-left py-2 px-2 text-slate-500 font-medium hidden sm:table-cell"
                >
                  类型
                </th>
                <th
                  class="text-center py-2 px-2 text-slate-500 font-medium hidden sm:table-cell"
                >
                  浏览
                </th>
                <th
                  class="text-center py-2 px-2 text-slate-500 font-medium hidden lg:table-cell"
                >
                  链接
                </th>
                <th class="text-right py-2 px-2 text-slate-500 font-medium">{{ $t('admin.operation') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="res in resourceList"
                :key="res.id"
                class="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors animate-none"
              >
                <td class="py-2.5 px-2">
                  <div class="flex items-center gap-2 max-w-xs">
                    <img v-if="res.thumbnailUrl" alt="" :src="res.thumbnailUrl" class="w-8 h-8 rounded object-cover flex-shrink-0 bg-slate-100 dark:bg-slate-700" />
                    <div
                      v-else
                      class="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0"
                    >
                      <FileText class="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <span
                      class="text-slate-800 dark:text-slate-200 font-medium truncate"
                      >{{ res.title }}</span
                    >
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
                    <button type="button" class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer" :title="$t('admin.edit')" @click="openEditResource(res)">
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>
                    <button type="button" class="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer" :title="$t('admin.delete')" @click="deleteResource(res)">
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
              >第 {{ resourcePage }}/{{ resourceTotalPages }} 页，共
              {{ resourceTotal }} 条</span
            >
            <div class="flex items-center gap-1">
              <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer" :disabled="resourcePage <= 1" @click="changeResourcePage(resourcePage - 1)">
                <ChevronLeft class="w-4 h-4" />
              </button>
              <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer" :disabled="resourcePage >= resourceTotalPages" @click="changeResourcePage(resourcePage + 1)">
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Management View -->
      <div v-if="expandedTab === 'categories'" class="space-y-4">
        <div class="flex items-center justify-between">
          <h4
            class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
          >
            <Layers class="w-4 h-4 text-cyan-500" />
            分类管理
            <span class="text-xs text-slate-400 font-normal">{{ $t('admin.total_sourcecategories_length_categories') }}</span>
          </h4>
          <button type="button" class="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer" @click="openCreateCategory">
            <Plus class="w-3.5 h-3.5" />
            {{ $t('admin.add_new_category') }}
          </button>
        </div>

        <div v-if="sourceCategories.length === 0" class="text-center py-10">
          <Layers class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p class="text-sm text-slate-400">{{ $t('admin.there_is_no_classification') }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700">
                <th class="text-left py-2 px-2 text-slate-500 font-medium">{{ $t('admin.name') }}</th>
                <th class="text-left py-2 px-2 text-slate-500 font-medium">{{ $t('admin.parent_category') }}</th>
                <th class="text-left py-2 px-2 text-slate-500 font-medium">
                  Slug (别名)
                </th>
                <th class="text-center py-2 px-2 text-slate-500 font-medium">
                  排序权重 (Order)
                </th>
                <th class="text-right py-2 px-2 text-slate-500 font-medium">{{ $t('admin.operation') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="cat in sourceCategories"
                :key="cat.id"
                class="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors animate-none"
              >
                <td class="py-2.5 px-2 font-medium text-slate-800 dark:text-slate-200">
                  {{ cat.name }}
                </td>
                <td class="py-2.5 px-2 text-slate-500">
                  {{ getParentCategoryName(cat) }}
                </td>
                <td class="py-2.5 px-2 text-slate-500">{{ cat.slug || '-' }}</td>
                <td class="py-2.5 px-2 text-center text-slate-500">
                  {{ cat.order ?? 0 }}
                </td>
                <td class="py-2.5 px-2">
                  <div class="flex items-center justify-end gap-1">
                    <button type="button" class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer" :title="$t('admin.edit')" @click="openEditCategory(cat)">
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>
                    <button type="button" class="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer" :title="$t('admin.delete')" @click="deleteCategory(cat)">
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

    <!-- Resource Create/Edit Dialog -->
    <Teleport to="body">
      <div
        v-if="showResourceDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="showResourceDialog = false"
      >
        <div
          class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div
            class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
          >
            <h2
              class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <FileText class="w-5 h-5 text-cyan-500" />
              {{ isEditingResource ? t('admin.edit_resources') : $t('admin.add_new_resources') }}
            </h2>
            <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="showResourceDialog = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >{{ $t('admin.title') }} <span class="text-red-400">*</span></label
              >
              <input
                v-model="resourceForm.title"
                type="text"
                :placeholder="$t('admin.resource_title')"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >{{ $t('admin.description') }}</label
              >
              <textarea
                v-model="resourceForm.description"
                rows="2"
                :placeholder="$t('admin.resource_description')"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 resize-none"
              ></textarea>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >{{ $t('admin.classification') }}</label
                >
                <select
                  v-model="resourceForm.categoryId"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="">{{ $t('admin.uncategorized') }}</option>
                  <option
                    v-for="cat in formattedMirrorCategories"
                    :key="cat.id"
                    :value="cat.id"
                  >
                    {{ cat.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >{{ $t('admin.resource_type') }}</label
                >
                <input
                  v-model="resourceForm.resourceType"
                  type="text"
                  placeholder="COURSE"
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >{{ $t('admin.thumbnail_url') }}</label
              >
              <input
                v-model="resourceForm.thumbnailUrl"
                type="text"
                placeholder="https://..."
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >{{ $t('admin.network_disk_link_contenturl') }}</label
              >
              <input
                v-model="resourceForm.contentUrl"
                type="text"
                :placeholder="$t('admin.network_disk_download_link')"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >{{ $t('admin.label') }}</label
              >
              <input
                v-model="resourceForm.tags"
                type="text"
                :placeholder="$t('admin.json_array_format_such')"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >{{ $t('admin.text_html') }}</label
              >
              <textarea
                v-model="resourceForm.contentHtml"
                rows="6"
                :placeholder="$t('admin.html_content')"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 resize-none font-mono text-xs"
              ></textarea>
            </div>
          </div>

          <div
            class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700"
          >
            <button type="button" class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="showResourceDialog = false">
              取消
            </button>
            <button type="button" class="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors cursor-pointer" @click="saveResource">
              {{ isEditingResource ? t('admin.save') : $t('admin.create') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Category Create/Edit Dialog -->
      <div
        v-if="showCategoryDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="showCategoryDialog = false"
      >
        <div
          class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md mx-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          <div
            class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
          >
            <h2
              class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <Layers class="w-5 h-5 text-cyan-500" />
              {{ isEditingCategory ? t('admin.edit_category') : $t('admin.add_new_category') }}
            </h2>
            <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="showCategoryDialog = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >{{ $t('admin.category_name') }} <span class="text-red-400">*</span></label
              >
              <input
                v-model="categoryForm.name"
                type="text"
                :placeholder="$t('admin.for_example_3d_model')"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >父级分类
                <span class="text-xs text-slate-400 font-normal"
                  >{{ $t('admin.optional_for_sidebar_grouping') }}</span
                ></label
              >
              <select
                v-model="categoryForm.parentExternalId"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option :value="null">{{ $t('admin.none_as_a_first_1') }}</option>
                <option
                  v-for="cat in parentCategoryOptions"
                  :key="cat.id"
                  :value="cat.externalId"
                >
                  {{ cat.name }}
                </option>
              </select>
            </div>
            <div
              v-if="!categoryForm.parentExternalId && eligibleSubcategories.length > 0"
              class="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1"
            >
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >分配子分类
                <span class="text-xs text-slate-400 font-normal"
                  >{{ $t('admin.select_from_existing_categories') }}</span
                ></label
              >
              <div
                class="max-h-36 overflow-y-auto border border-slate-200/60 dark:border-slate-800/80 rounded-lg p-2.5 bg-slate-50/50 dark:bg-slate-900/30 space-y-1.5 scrollbar-hide"
              >
                <div
                  v-for="cat in eligibleSubcategories"
                  :key="cat.id"
                  class="flex items-center gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 p-1 rounded-lg transition-colors"
                >
                  <input
                    :id="'subcat-' + cat.id"
                    v-model="categoryForm.childExternalIds"
                    type="checkbox"
                    :value="cat.externalId"
                    class="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
                  />
                  <label
                    :for="'subcat-' + cat.id"
                    class="text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none flex-1"
                  >
                    {{ cat.name }}
                    <span
                      v-if="cat.parentExternalId"
                      class="text-[9px] text-slate-400 dark:text-slate-500 ml-1"
                    >
                      (当前父: {{ getParentCategoryName(cat) }})
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >Slug (别名)
                <span class="text-xs text-slate-400 font-normal">{{ $t('admin.optional') }}</span></label
              >
              <input
                v-model="categoryForm.slug"
                type="text"
                :placeholder="$t('admin.for_example_3d_models')"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >排序权重 (Order)
                <span class="text-xs text-slate-400 font-normal">{{ $t('admin.the_smaller_it_is') }}</span></label
              >
              <input
                v-model.number="categoryForm.order"
                type="number"
                placeholder="0"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              />
            </div>
          </div>

          <div
            class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
          >
            <button type="button" class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer" @click="showCategoryDialog = false">
              取消
            </button>
            <button type="button" class="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors cursor-pointer" @click="saveCategory">
              {{ isEditingCategory ? t('admin.save') : $t('admin.create') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

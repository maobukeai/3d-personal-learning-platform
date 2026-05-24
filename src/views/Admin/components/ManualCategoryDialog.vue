<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

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
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const showDialog = ref(false);
const isEdit = ref(false);
const editingCategory = ref<ManualCategory | null>(null);

const categoryForm = ref({
  name: '',
  slug: '',
  order: 0,
  parentId: null as string | null,
  childIds: [] as string[],
});

const openCreate = () => {
  isEdit.value = false;
  editingCategory.value = null;
  categoryForm.value = {
    name: '',
    slug: '',
    order: 0,
    parentId: null,
    childIds: [],
  };
  showDialog.value = true;
};

const openEdit = (category: ManualCategory) => {
  isEdit.value = true;
  editingCategory.value = category;
  const currentChildIds = props.categories
    .filter(c => c.parentId === category.id)
    .map(c => c.id);
  categoryForm.value = {
    name: category.name,
    slug: category.slug || '',
    order: category.order || 0,
    parentId: category.parentId || null,
    childIds: currentChildIds,
  };
  showDialog.value = true;
};

const parentCategoryOptions = computed(() => {
  return props.categories.filter(cat => {
    if (editingCategory.value && cat.id === editingCategory.value.id) return false;
    return !cat.parentId;
  });
});

const eligibleSubcategories = computed(() => {
  const currentId = editingCategory.value?.id;
  const parentIds = new Set<string>();
  props.categories.forEach(c => {
    if (c.parentId && c.parentId !== currentId) {
      parentIds.add(c.parentId);
    }
  });
  return props.categories.filter(c => {
    if (currentId && c.id === currentId) return false;
    if (parentIds.has(c.id)) return false;
    return true;
  });
});

function getParentCategoryName(cat: ManualCategory) {
  if (!cat.parentId) return '-';
  const parent = props.categories.find(c => c.id === cat.parentId);
  return parent ? parent.name : '-';
}

const saveCategory = async () => {
  if (!props.stationId) return;

  if (!categoryForm.value.name.trim()) {
    ElMessage.warning('请输入分类名称');
    return;
  }

  try {
    if (isEdit.value && editingCategory.value) {
      await api.put(`/api/admin/manual/categories/${editingCategory.value.id}`, categoryForm.value);
      ElMessage.success('更新分类成功');
    } else {
      await api.post(`/api/admin/manual/stations/${props.stationId}/categories`, categoryForm.value);
      ElMessage.success('创建分类成功');
    }
    showDialog.value = false;
    emit('refresh');
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, '操作分类失败'));
  }
};

watch(
  () => categoryForm.value.name,
  (newName) => {
    if (isEdit.value) return;
    
    const trimName = newName.trim();
    if (!trimName) {
      categoryForm.value.slug = '';
      return;
    }

    const cnMap: Record<string, string> = {
      '3d模型': '3d-models',
      '模型': 'models',
      '贴图': 'textures',
      '材质': 'materials',
      '教程': 'courses',
      '课程': 'courses',
      '视频教程': 'video-courses',
      '插件': 'plugins',
      '软件': 'software',
      '预设': 'presets',
      '平面': 'design',
      '摄影': 'photography',
      '插画': 'illustrations',
    };

    for (const key in cnMap) {
      if (trimName.toLowerCase().includes(key)) {
        categoryForm.value.slug = cnMap[key];
        return;
      }
    }

    const safeSlug = trimName
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    categoryForm.value.slug = safeSlug || '';
  }
);

defineExpose({
  openCreate,
  openEdit,
});
</script>

<template>
  <!-- DIALOG: MANAGE CATEGORY -->
  <el-dialog
    v-model="showDialog"
    :title="isEdit ? '编辑分类名称' : '添加资源分类'"
    width="400px"
    custom-class="premium-dialog"
  >
    <div class="space-y-4 py-2">
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">分类显示名称</label>
        <input
          v-model="categoryForm.name"
          type="text"
          placeholder="如: 精品材质包"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary);"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">父级分类 (可选，用于侧边栏分组)</label>
        <select
          v-model="categoryForm.parentId"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none text-slate-600 dark:text-slate-300"
        >
          <option :value="null">无 (作为一级分类/大类)</option>
          <option
            v-for="cat in parentCategoryOptions"
            :key="cat.id"
            :value="cat.id"
          >
            {{ cat.name }}
          </option>
        </select>
      </div>
      <div v-if="!categoryForm.parentId && eligibleSubcategories.length > 0" class="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1">
        <label class="text-xs font-semibold text-slate-500 block">分配子分类 (从现有分类中选择归属于本大类)</label>
        <div class="max-h-36 overflow-y-auto border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-900/30 space-y-1.5 scrollbar-hide">
          <div
            v-for="cat in eligibleSubcategories"
            :key="cat.id"
            class="flex items-center gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 p-1 rounded-lg transition-colors"
          >
            <input
              :id="'subcat-' + cat.id"
              v-model="categoryForm.childIds"
              type="checkbox"
              :value="cat.id"
              class="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
            />
            <label :for="'subcat-' + cat.id" class="text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none flex-1">
              {{ cat.name }}
              <span v-if="cat.parentId" class="text-[9px] text-slate-400 dark:text-slate-500 ml-1">
                (当前父: {{ getParentCategoryName(cat) }})
              </span>
            </label>
          </div>
        </div>
      </div>
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">Slug 缩写 (可选，如: materials)</label>
        <input
          v-model="categoryForm.slug"
          type="text"
          placeholder="用于路由辅助缩写..."
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary);"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">排序权重 (小号排在前面)</label>
        <input
          v-model="categoryForm.order"
          type="number"
          placeholder="0"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary);"
        />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="px-4 py-2 border rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-transparent border-slate-200 dark:border-slate-800 cursor-pointer" style="color: var(--text-secondary);" @click="showDialog = false">
          取消
        </button>
        <button type="button" class="px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-500 text-xs font-semibold transition-colors border-none cursor-pointer" @click="saveCategory">
          保存分类
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Layers, Edit3, Trash2 } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import ManualCategoryDialog from './ManualCategoryDialog.vue';

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
  (e: 'refresh'): void;
}>();

const manualCategoryDialogRef = ref<any>(null);

function getParentCategoryName(cat: ManualCategory) {
  if (!cat.parentId) return '-';
  const parent = props.categories.find(c => c.id === cat.parentId);
  return parent ? parent.name : '-';
}

const deleteCategory = async (category: ManualCategory) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类「${category.name}」吗？\n\n⚠️ 删除分类不会删除其项下的资源（它们会转为未分类状态）。`,
      '确认删除分类',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await api.delete(`/api/admin/manual/categories/${category.id}`);
    ElMessage.success('分类删除成功');
    emit('refresh');
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除分类失败');
    }
  }
};

defineExpose({
  openCreateCategory: () => manualCategoryDialogRef.value?.openCreate(),
});
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="props.categories.length === 0"
      class="flex flex-col items-center justify-center py-10 bg-white dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800 rounded-2xl"
    >
      <Layers class="w-8 h-8 text-slate-300 mb-2" />
      <p class="text-xs text-slate-400">此资源站暂未配置任何分类...</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        v-for="cat in props.categories"
        :key="cat.id"
        class="flex items-center justify-between p-3 bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 rounded-xl hover:border-slate-300 dark:hover:border-slate-700/60 transition-all"
      >
        <div class="text-left">
          <div class="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">
            {{ cat.name }}
            <span v-if="cat.slug" class="text-[9px] font-mono bg-slate-100 dark:bg-slate-800 px-1 text-slate-400 rounded">
              {{ cat.slug }}
            </span>
            <span v-if="cat.parentId" class="text-[9px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded font-semibold">
              子分类 (父: {{ getParentCategoryName(cat) }})
            </span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">排序权重: {{ cat.order || 0 }}</div>
        </div>

        <div class="flex items-center gap-1.5">
          <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded transition-colors bg-transparent border-none cursor-pointer" @click="manualCategoryDialogRef?.openEdit(cat)">
            <Edit3 class="w-3.5 h-3.5" />
          </button>
          <button type="button" class="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded transition-colors bg-transparent border-none cursor-pointer" @click="deleteCategory(cat)">
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Unified category dialog -->
    <ManualCategoryDialog
      ref="manualCategoryDialogRef"
      :station-id="props.stationId"
      :categories="props.categories"
      @refresh="emit('refresh');"
    />
  </div>
</template>

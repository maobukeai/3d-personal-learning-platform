<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';

interface EditableCategory {
  id: string;
  name?: string | null;
  order?: number | null;
}

const props = defineProps<{
  categoriesCount: number;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const visible = ref(false);
const currentCategory = ref<EditableCategory | null>(null);

const categoryForm = ref({
  name: '',
  order: 0,
});

const open = (category: EditableCategory | null = null) => {
  currentCategory.value = category;
  if (category) {
    categoryForm.value = {
      name: category.name || '',
      order: category.order || 0,
    };
  } else {
    categoryForm.value = {
      name: '',
      order: props.categoriesCount + 1,
    };
  }
  visible.value = true;
};

const handleSaveCategory = async () => {
  if (!categoryForm.value.name.trim()) {
    ElMessage.warning(t('admin.please_enter_the_category'));
    return;
  }
  try {
    if (currentCategory.value) {
      await api.put(`/api/admin/course-categories/${currentCategory.value.id}`, categoryForm.value);
      ElMessage.success(t('admin.classification_updated_successfully'));
    } else {
      await api.post('/api/admin/course-categories', categoryForm.value);
      ElMessage.success(t('admin.category_created_successfully'));
    }
    visible.value = false;
    emit('saved');
  } catch (_error) {
    ElMessage.error(t('admin.failed_to_save_category'));
  }
};

defineExpose({ open });
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
  >
    <div
      class="w-full max-w-md rounded-3xl p-5 sm:p-8 shadow-2xl transition-colors duration-300 animate-fade-in"
      style="background-color: var(--bg-card)"
    >
      <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">
        {{ currentCategory ? t('admin.edit_category') : $t('admin.new_category') }}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >{{ $t('admin.category_name') }}</label
          >
          <input
            v-model="categoryForm.name"
            type="text"
            :placeholder="$t('admin.enter_category_name')"
            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >{{ $t('admin.sort') }}</label
          >
          <input
            v-model="categoryForm.order"
            type="number"
            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none font-bold"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
      </div>
      <div class="flex items-center gap-4 mt-8">
        <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer" @click="visible = false">
          取消
        </button>
        <button type="button" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20 cursor-pointer" @click="handleSaveCategory">
          保存分类
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>

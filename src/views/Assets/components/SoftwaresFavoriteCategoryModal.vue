<script setup lang="ts">
import { computed, ref } from 'vue';
import { getApiErrorMessage } from '@/utils/error';
import { messageBox, toast } from '@/utils/feedbackAdapter';
import { useLabel } from '@/utils/i18n';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue'; /** * Owns the favorite-category create / rename / delete modal. * * Triggered imperatively via the exposed `openCreateCategory`, * `openRenameCategory`, and `handleDeleteFavoriteCategory` methods * (called by the container when SoftwareFiltersPanel emits the * matching events). */
const props = defineProps<{ favoriteCategories: string[]; selectedFavoriteCategory: string }>();
const emit = defineEmits<{
  (e: 'update:selectedFavoriteCategory', value: string): void;
  (e: 'refresh-favorites'): void;
}>();
const label = useLabel();
const showCategoryModal = ref(false);
const categoryModalType = ref<'create' | 'rename'>('create');
const categoryModalInputValue = ref('');
const categoryModalOldValue = ref('');
const categoryModalError = ref('');
const categoryModalTitle = computed(() =>
  categoryModalType.value === 'create'
    ? label('新建分类', 'New Category')
    : label('重命名分类', 'Rename Category'),
);
const categoryModalLabel = computed(() =>
  categoryModalType.value === 'create'
    ? label('请输入新建收藏夹分类的名称', 'Please enter a name for the new favorite folder')
    : label(
        `请输入「${categoryModalOldValue.value}」的新名称`,
        `Please enter a new name for "${categoryModalOldValue.value}"`,
      ),
);
const openCreateCategory = () => {
  categoryModalType.value = 'create';
  categoryModalInputValue.value = '';
  categoryModalOldValue.value = '';
  categoryModalError.value = '';
  showCategoryModal.value = true;
};
const openRenameCategory = (cat: string) => {
  categoryModalType.value = 'rename';
  categoryModalInputValue.value = cat;
  categoryModalOldValue.value = cat;
  categoryModalError.value = '';
  showCategoryModal.value = true;
};
const handleCategoryModalSubmit = async () => {
  const val = categoryModalInputValue.value.trim();
  if (!val) {
    categoryModalError.value = label('请输入分类名称', 'Please enter category name');
    return;
  }
  if (val === '默认') {
    categoryModalError.value = label('不能命名为默认分类', 'Cannot name as default');
    return;
  }
  if (categoryModalType.value === 'create') {
    if (props.favoriteCategories.includes(val)) {
      categoryModalError.value = label('分类已存在', 'Category already exists');
      return;
    }
    try {
      const api = (await import('@/utils/api')).default;
      await api.post('/api/softwares/favorites/categories', { category: val });
      toast.success(label('分类创建成功', 'Category created successfully'));
      emit('update:selectedFavoriteCategory', val);
      showCategoryModal.value = false;
      emit('refresh-favorites');
    } catch (error) {
      toast.error(getApiErrorMessage(error, label('创建分类失败', 'Failed to create category')));
    }
  } else {
    if (val === categoryModalOldValue.value) {
      showCategoryModal.value = false;
      return;
    }
    try {
      const api = (await import('@/utils/api')).default;
      await api.put('/api/softwares/favorites/categories', {
        oldCategory: categoryModalOldValue.value,
        newCategory: val,
      });
      toast.success(label('分类重命名成功', 'Category renamed successfully'));
      if (props.selectedFavoriteCategory === categoryModalOldValue.value) {
        emit('update:selectedFavoriteCategory', val);
      }
      showCategoryModal.value = false;
      emit('refresh-favorites');
    } catch (error) {
      toast.error(getApiErrorMessage(error, label('重命名失败', 'Rename failed')));
    }
  }
};
const handleDeleteFavoriteCategory = async (cat: string) => {
  try {
    await messageBox.confirm(
      label(
        `确认删除收藏夹分类「${cat}」？此操作将取消该分类下所有软件的收藏。`,
        `Delete favorite folder "${cat}"? This will remove all favorites inside this folder.`,
      ),
      label('删除分类', 'Delete Category'),
      {
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );
    const api = (await import('@/utils/api')).default;
    await api.delete(`/api/softwares/favorites/categories/${encodeURIComponent(cat)}`);
    toast.success(label('分类删除成功', 'Category deleted successfully'));
    if (props.selectedFavoriteCategory === cat) {
      emit('update:selectedFavoriteCategory', 'all');
    }
    emit('refresh-favorites');
  } catch (error) {
    if (error !== 'cancel')
      toast.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
  }
};
defineExpose({ openCreateCategory, openRenameCategory, handleDeleteFavoriteCategory });
</script>
<template>
  <!-- Favorite Category Create/Rename Modal -->
  <Modal :show="showCategoryModal" size="sm" @close="showCategoryModal = false">
    <template #header>
      <h3 class="text-sm font-bold text-[var(--text-primary)]">{{ categoryModalTitle }}</h3>
    </template>
    <div class="flex flex-col gap-4 text-left">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
        >
          {{ categoryModalLabel }}
        </label>
        <Input
          v-model="categoryModalInputValue"
          type="text"
          :placeholder="label('例如：实用工具、烘焙辅助', 'e.g., Utility Tools, Baking Helpers')"
          required
          @input="categoryModalError = ''"
          @keyup.enter="handleCategoryModalSubmit"
        />
        <p v-if="categoryModalError" class="text-xs text-rose-500 mt-1.5 ml-1">
          {{ categoryModalError }}
        </p>
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <Button variant="secondary" size="sm" @click="showCategoryModal = false">
          {{ label('取消', 'Cancel') }}
        </Button>
        <Button
          variant="primary"
          size="sm"
          :disabled="!categoryModalInputValue.trim()"
          @click="handleCategoryModalSubmit"
        >
          {{ label('确定', 'Confirm') }}
        </Button>
      </div>
    </div>
  </Modal>
</template>

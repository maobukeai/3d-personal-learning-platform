<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Layers } from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import FormDialog from '@/components/FormDialog.vue';
import Modal from '@/components/ui/Modal.vue';

// Define the modes supported by our unified component
type DialogMode = 'course' | 'manual' | 'mirror' | 'ai';

interface Props {
  mode: DialogMode;
  // Common
  title?: string;

  // Course-specific
  categoriesCount?: number;

  // Manual-specific
  stationId?: string;
  categories?: any[]; // Shared for manual & mirror calculations

  // Mirror-specific
  parentCategoryOptions?: any[];
  eligibleSubcategories?: any[];
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  categoriesCount: 0,
  stationId: '',
  categories: () => [],
  parentCategoryOptions: () => [],
  eligibleSubcategories: () => [],
});

// Emits
const emit = defineEmits<{
  (e: 'saved'): void;
  (e: 'submit'): void;
  (e: 'save'): void;
  (e: 'close'): void;
}>();

// Visibility Model (used in AI, Mirror, or externally controlled modes)
const show = defineModel<boolean>('show', { default: false });

// Name Model (used specifically for AI category dialog)
const nameModel = defineModel<string>('name', { default: '' });

// Form Model (used in Mirror mode to bind fields directly from parent)
interface MirrorForm {
  name: string;
  slug: string;
  order: number;
  parentExternalId: string | null;
  childExternalIds: string[];
}
const formModel = defineModel<MirrorForm>('form');

// Local Visibility State (used for exposed methods in Course & Manual modes)
const localVisible = ref(false);
const isEditing = ref(false);
const editingCategory = ref<any | null>(null);

// Combined visibility computed property
const isVisible = computed({
  get: () => {
    if (props.mode === 'mirror' || props.mode === 'ai') {
      return show.value;
    }
    return localVisible.value;
  },
  set: (val) => {
    if (props.mode === 'mirror' || props.mode === 'ai') {
      show.value = val;
    } else {
      localVisible.value = val;
    }
    if (!val) {
      emit('close');
    }
  },
});

// Local Form State (used for Course & Manual modes)
const localForm = ref({
  name: '',
  slug: '',
  order: 0,
  parentId: null as string | null,
  childIds: [] as string[],
});

const { t } = useI18n();

// ------------------------------------
// Mode-specific actions and calculations
// ------------------------------------

// Course mode open method
const openCourse = (category: any | null = null) => {
  isEditing.value = !!category;
  editingCategory.value = category;
  if (category) {
    localForm.value = {
      name: category.name || '',
      slug: '',
      order: category.order || 0,
      parentId: null,
      childIds: [],
    };
  } else {
    localForm.value = {
      name: '',
      slug: '',
      order: props.categoriesCount + 1,
      parentId: null,
      childIds: [],
    };
  }
  isVisible.value = true;
};

// Manual mode open methods
const openManualCreate = () => {
  isEditing.value = false;
  editingCategory.value = null;
  localForm.value = {
    name: '',
    slug: '',
    order: 0,
    parentId: null,
    childIds: [],
  };
  isVisible.value = true;
};

const openManualEdit = (category: any) => {
  isEditing.value = true;
  editingCategory.value = category;
  const currentChildIds = props.categories
    .filter((c) => c.parentId === category.id)
    .map((c) => c.id);
  localForm.value = {
    name: category.name,
    slug: category.slug || '',
    order: category.order || 0,
    parentId: category.parentId || null,
    childIds: currentChildIds,
  };
  isVisible.value = true;
};

// -------------------
// Manual Custom Helpers
// -------------------
const manualParentOptions = computed(() => {
  return props.categories.filter((cat) => {
    if (editingCategory.value && cat.id === editingCategory.value.id) return false;
    return !cat.parentId;
  });
});

const manualEligibleSubcategories = computed(() => {
  const currentId = editingCategory.value?.id;
  const parentIds = new Set<string>();
  props.categories.forEach((c) => {
    if (c.parentId && c.parentId !== currentId) {
      parentIds.add(c.parentId);
    }
  });
  return props.categories.filter((c) => {
    if (currentId && c.id === currentId) return false;
    if (parentIds.has(c.id)) return false;
    return true;
  });
});

function getParentCategoryName(cat: any) {
  if (props.mode === 'mirror') {
    if (!cat.parentExternalId) return '-';
    const parent = props.categories.find((c) => c.externalId === cat.parentExternalId);
    return parent ? parent.name : '-';
  } else {
    if (!cat.parentId) return '-';
    const parent = props.categories.find((c) => c.id === cat.parentId);
    return parent ? parent.name : '-';
  }
}

// Watch category name in manual mode to generate slug
watch(
  () => localForm.value.name,
  (newName) => {
    if (props.mode !== 'manual' || isEditing.value) return;

    const trimName = newName.trim();
    if (!trimName) {
      localForm.value.slug = '';
      return;
    }

    const cnMap: Record<string, string> = {
      [t('admin.3d_model_1')]: '3d-models',
      [t('admin.model')]: 'models',
      [t('admin.stickers')]: 'textures',
      [t('admin.material')]: 'materials',
      [t('admin.tutorial')]: 'courses',
      [t('admin.courses')]: 'courses',
      [t('admin.video_tutorial')]: 'video-courses',
      [t('admin.plug_in')]: 'plugins',
      [t('admin.software')]: 'software',
      [t('admin.default_1')]: 'presets',
      [t('admin.plane')]: 'design',
      [t('admin.photography')]: 'photography',
      [t('admin.illustration')]: 'illustrations',
    };

    for (const key in cnMap) {
      if (trimName.toLowerCase().includes(key)) {
        localForm.value.slug = cnMap[key];
        return;
      }
    }

    const safeSlug = trimName
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    localForm.value.slug = safeSlug || '';
  },
);

// -----------------
// Form Submission
// -----------------
const handleSave = async () => {
  // 1. AI Mode
  if (props.mode === 'ai') {
    emit('submit');
    return;
  }

  // 2. Mirror Mode
  if (props.mode === 'mirror') {
    emit('save');
    return;
  }

  // Validation
  const nameToSave = localForm.value.name.trim();
  if (!nameToSave) {
    ElMessage.warning(t('admin.please_enter_the_category'));
    return;
  }

  // 3. Course Mode
  if (props.mode === 'course') {
    try {
      const payload = { name: nameToSave, order: localForm.value.order };
      if (editingCategory.value) {
        await api.put(`/api/admin/course-categories/${editingCategory.value.id}`, payload);
        ElMessage.success(t('admin.classification_updated_successfully'));
      } else {
        await api.post('/api/admin/course-categories', payload);
        ElMessage.success(t('admin.category_created_successfully'));
      }
      isVisible.value = false;
      emit('saved');
    } catch {
      ElMessage.error(t('admin.failed_to_save_category'));
    }
  }

  // 4. Manual Mode
  if (props.mode === 'manual') {
    try {
      if (isEditing.value && editingCategory.value) {
        await api.put(`/api/admin/manual/categories/${editingCategory.value.id}`, localForm.value);
        ElMessage.success(t('admin.classification_updated_successfully_1'));
      } else {
        await api.post(`/api/admin/manual/stations/${props.stationId}/categories`, localForm.value);
        ElMessage.success(t('admin.classification_created_successfully'));
      }
      isVisible.value = false;
      emit('saved');
    } catch (e) {
      ElMessage.error(getApiErrorMessage(e, t('admin.operation_classification_failed')));
    }
  }
};

// Expose methods for backwards compatibility
defineExpose({
  open: openCourse,
  openCreate: openManualCreate,
  openEdit: openManualEdit,
});
</script>

<template>
  <!-- MIRROR MODE DIALOG (Premium custom modal layout) -->
  <Modal
    v-if="mode === 'mirror' && formModel"
    :show="isVisible"
    size="sm"
    glass-card
    padding="md"
    @close="isVisible = false"
  >
    <template #header>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Layers class="w-5 h-5 text-cyan-500" />
        {{ title || (isEditing ? '编辑分类' : '新增分类') }}
      </h2>
    </template>

    <div class="space-y-4 text-left">
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          分类名称 <span class="text-red-400">*</span>
        </label>
        <input
          v-model="formModel.name"
          type="text"
          placeholder="例如: 3D模型"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          父级分类 <span class="text-xs text-slate-400 font-normal">（可选，用于侧边栏分组）</span>
        </label>
        <select
          v-model="formModel.parentExternalId"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
        >
          <option :value="null">无（作为一级分类/大类）</option>
          <option v-for="cat in parentCategoryOptions" :key="cat.id" :value="cat.externalId">
            {{ cat.name }}
          </option>
        </select>
      </div>
      <div
        v-if="!formModel.parentExternalId && eligibleSubcategories.length > 0"
        class="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1"
      >
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          分配子分类
          <span class="text-xs text-slate-400 font-normal">（从现有分类中选择归属于本大类）</span>
        </label>
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
              v-model="formModel.childExternalIds"
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
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Slug (别名) <span class="text-xs text-slate-400 font-normal">（可选）</span>
        </label>
        <input
          v-model="formModel.slug"
          type="text"
          placeholder="例如: 3d-models"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          排序权重 (Order) <span class="text-xs text-slate-400 font-normal">（越小越靠前）</span>
        </label>
        <input
          v-model.number="formModel.order"
          type="number"
          placeholder="0"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
        />
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        @click="isVisible = false"
      >
        取消
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
        @click="handleSave"
      >
        {{ isEditing ? '保存' : '创建' }}
      </button>
    </template>
  </Modal>

  <!-- AI MODE DIALOG -->
  <FormDialog
    v-else-if="mode === 'ai'"
    :visible="isVisible"
    :title="title"
    confirm-text="common.confirm"
    @update:visible="isVisible = $event"
    @submit="handleSave"
    @cancel="isVisible = false"
  >
    <div class="space-y-4">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
        >
          分类名称
        </label>
        <input
          v-model="nameModel"
          type="text"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
          @keyup.enter="handleSave"
        />
      </div>
    </div>
  </FormDialog>

  <!-- COURSE & MANUAL MODE DIALOGS -->
  <FormDialog
    v-else
    :visible="isVisible"
    :title="isEditing ? t('admin.edit_category') : t('admin.new_category')"
    confirm-text="admin.save_category"
    @update:visible="isVisible = $event"
    @submit="handleSave"
    @cancel="isVisible = false"
  >
    <div class="space-y-4 py-2 text-left">
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">
          {{ mode === 'manual' ? t('admin.category_display_name') : t('admin.category_name') }}
        </label>
        <input
          v-model="localForm.name"
          type="text"
          :placeholder="
            mode === 'manual' ? t('admin.such_as_premium_texture') : t('admin.enter_category_name')
          "
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary)"
        />
      </div>

      <!-- Manual Parent Category selection -->
      <div v-if="mode === 'manual'" class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">
          {{ t('admin.parent_category_optional_used') }}
        </label>
        <select
          v-model="localForm.parentId"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none text-slate-600 dark:text-slate-300"
        >
          <option :value="null">{{ t('admin.none_as_a_first') }}</option>
          <option v-for="cat in manualParentOptions" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
      </div>

      <!-- Manual Assign subcategories checkbox list -->
      <div
        v-if="mode === 'manual' && !localForm.parentId && manualEligibleSubcategories.length > 0"
        class="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1"
      >
        <label class="text-xs font-semibold text-slate-500 block">
          {{ t('admin.assign_subcategories_select_from') }}
        </label>
        <div
          class="max-h-36 overflow-y-auto border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-900/30 space-y-1.5 scrollbar-hide"
        >
          <div
            v-for="cat in manualEligibleSubcategories"
            :key="cat.id"
            class="flex items-center gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 p-1 rounded-lg transition-colors"
          >
            <input
              :id="'subcat-' + cat.id"
              v-model="localForm.childIds"
              type="checkbox"
              :value="cat.id"
              class="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
            />
            <label
              :for="'subcat-' + cat.id"
              class="text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none flex-1"
            >
              {{ cat.name }}
              <span v-if="cat.parentId" class="text-[9px] text-slate-400 dark:text-slate-500 ml-1">
                (当前父: {{ getParentCategoryName(cat) }})
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Manual Slug alias -->
      <div v-if="mode === 'manual'" class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">
          {{ t('admin.slug_abbreviation_optional_such') }}
        </label>
        <input
          v-model="localForm.slug"
          type="text"
          :placeholder="t('admin.used_for_routing_auxiliary')"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary)"
        />
      </div>

      <!-- Common Order weight input -->
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-500">
          {{ mode === 'manual' ? t('admin.sorting_weight_small_number') : t('admin.sort') }}
        </label>
        <input
          v-model.number="localForm.order"
          type="number"
          placeholder="0"
          class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          style="color: var(--text-primary)"
        />
      </div>
    </div>
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast, messageBox } from '@/utils/feedbackAdapter';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Modal from '@/components/ui/Modal.vue';
import ContentSection from '@/components/skeleton/ContentSection.vue';
import { useLabel } from '@/utils/i18n';
import PluginFiltersPanel from '../components/PluginFiltersPanel.vue';
import PluginCatalog from '../components/PluginCatalog.vue';
import HelpRequestsForum from '../components/HelpRequestsForum.vue';
import {
  CATEGORY_ALL,
  ENGLISH_CATEGORY_LABELS,
  getCategoryIcon,
  getCategoryTone,
  ALL_CATEGORY_ICON,
  type HelpRequest,
  type LibraryTab,
  type PluginInsights,
  type PluginItem,
  type StatusFilter,
  type ViewMode,
} from '../pluginsSchema';
interface Props {
  activeTab: LibraryTab;
  activeCategory: string;
  myStatusFilter: StatusFilter;
  selectedTag: string;
  isFilterOpen: boolean;
  isFilterCollapsed: boolean;
  selectedFavoriteCategory: string;
  favoriteCategoriesList: string[];
  visiblePlugins: PluginItem[];
  isLoading: boolean;
  viewMode: ViewMode;
  favoritedIds: string[];
  downloadingIds: Record<string, boolean>;
  activeFilterChips: Array<{ key: string; label: string }>;
  stats: { total: number; downloads: number; favorites: number; categories: number };
  insights: PluginInsights | null;
  pluginsList: PluginItem[];
  statusTabOptions: { label: string; value: string }[];
  selectedPluginIds: Set<string>;
  helpRequests: HelpRequest[];
  isHelpRequestsLoading: boolean;
  configuredCategories: string[];
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:activeCategory', value: string): void;
  (e: 'update:myStatusFilter', value: StatusFilter): void;
  (e: 'update:selectedTag', value: string): void;
  (e: 'update:selectedFavoriteCategory', value: string): void;
  (e: 'update:isFilterCollapsed', value: boolean): void;
  (e: 'update:isFilterOpen', value: boolean): void;
  (e: 'fetch-plugins'): void;
  (e: 'open-detail', plugin: PluginItem): void;
  (e: 'toggle-favorite', pluginId: string, event?: Event): void;
  (e: 'download', plugin: PluginItem, event?: Event): void;
  (e: 'select', id: string): void;
  (e: 'reset-filters'): void;
  (e: 'clear-filter', key: string): void;
  (e: 'upload'): void;
  (e: 'refresh'): void;
  (e: 'open-help-request', request: HelpRequest): void;
  (e: 'create-help-request'): void;
}>();
const { locale } = useI18n();
const label = useLabel();
const categoryLabel = (category?: string | null) => {
  const normalized = category || CATEGORY_ALL;
  return locale.value === 'en-US' ? ENGLISH_CATEGORY_LABELS[normalized] || normalized : normalized;
};
const availableCategories = computed(() => {
  const configured = (props.configuredCategories || []).filter((name) => name !== CATEGORY_ALL);
  const fromData = [
    ...props.pluginsList.map((p) => p.category).filter(Boolean),
    ...(props.insights?.categories || []).map((c) => c.name),
  ].filter((name) => name !== CATEGORY_ALL);
  return [CATEGORY_ALL, ...Array.from(new Set([...configured, ...fromData]))];
});
const categoryTiles = computed(() => {
  const insightMap = new Map((props.insights?.categories || []).map((c) => [c.name, c]));
  return availableCategories.value.map((category) => {
    const isAll = category === CATEGORY_ALL;
    const fromInsights = insightMap.get(category);
    const pluginsInCategory = props.pluginsList.filter((p) => p.category === category);
    const count = isAll ? props.stats.total : (fromInsights?.count ?? pluginsInCategory.length);
    const downloads = isAll
      ? props.stats.downloads
      : (fromInsights?.downloads ?? pluginsInCategory.reduce((sum, p) => sum + p.downloads, 0));
    return {
      name: category,
      count,
      downloads,
      Icon: isAll ? ALL_CATEGORY_ICON : getCategoryIcon(category),
      tone: isAll ? 'tone-slate' : getCategoryTone(category),
    };
  });
});
const categoryTabOptions = computed(() =>
  categoryTiles.value.map((c) => ({ label: categoryLabel(c.name), badge: c.count, value: c.name })),
); // ── Favorite Category Modal ──
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
const handleCreateFavoriteCategory = () => {
  categoryModalType.value = 'create';
  categoryModalInputValue.value = '';
  categoryModalOldValue.value = '';
  categoryModalError.value = '';
  showCategoryModal.value = true;
};
const handleRenameFavoriteCategory = (cat: string) => {
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
    if (props.favoriteCategoriesList.includes(val)) {
      categoryModalError.value = label('分类已存在', 'Category already exists');
      return;
    }
    try {
      await api.post('/api/plugins/favorites/categories', { category: val });
      toast.success(label('分类创建成功', 'Category created successfully'));
      emit('update:selectedFavoriteCategory', val);
      showCategoryModal.value = false;
      emit('refresh');
    } catch (error) {
      toast.error(getApiErrorMessage(error, label('创建分类失败', 'Failed to create category')));
    }
  } else {
    if (val === categoryModalOldValue.value) {
      showCategoryModal.value = false;
      return;
    }
    try {
      await api.put('/api/plugins/favorites/categories', {
        oldCategory: categoryModalOldValue.value,
        newCategory: val,
      });
      toast.success(label('分类重命名成功', 'Category renamed successfully'));
      if (props.selectedFavoriteCategory === categoryModalOldValue.value) {
        emit('update:selectedFavoriteCategory', val);
      }
      showCategoryModal.value = false;
      emit('refresh');
    } catch (error) {
      toast.error(getApiErrorMessage(error, label('重命名失败', 'Rename failed')));
    }
  }
};
const handleDeleteFavoriteCategory = async (cat: string) => {
  try {
    await messageBox.confirm(
      label(
        `确认删除收藏夹分类「${cat}」？此操作将取消该分类下所有插件的收藏。`,
        `Delete favorite folder "${cat}"? This will remove all favorites inside this folder.`,
      ),
      label('删除分类', 'Delete Category'),
      {
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );
    await api.delete(`/api/plugins/favorites/categories/${encodeURIComponent(cat)}`);
    toast.success(label('分类删除成功', 'Category deleted successfully'));
    if (props.selectedFavoriteCategory === cat) {
      emit('update:selectedFavoriteCategory', 'all');
    }
    emit('refresh');
  } catch (error) {
    if (error !== 'cancel') {
      toast.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  }
};
const selectedIdsArray = computed(() => Array.from(props.selectedPluginIds));
</script>
<template>
  <div class="plugins-region plugins-content">
    <ContentSection surface="plain">
      <div
        class="workspace-shell"
        :class="{ 'single-col': activeTab === 'requests', 'collapsed-shell': isFilterCollapsed }"
      >
        <PluginFiltersPanel
          v-if="activeTab !== 'requests'"
          :collapsed="isFilterCollapsed"
          :is-open="isFilterOpen"
          :active-category="activeCategory"
          :active-tab="activeTab"
          :my-status-filter="myStatusFilter"
          :selected-tag="selectedTag"
          :category-tab-options="categoryTabOptions"
          :status-tab-options="statusTabOptions"
          :hot-tags="insights?.hotTags || []"
          :favorite-categories="favoriteCategoriesList"
          :selected-favorite-category="selectedFavoriteCategory"
          @update:collapsed="emit('update:isFilterCollapsed', $event)"
          @update:active-category="emit('update:activeCategory', $event)"
          @update:my-status-filter="emit('update:myStatusFilter', $event)"
          @update:selected-tag="emit('update:selectedTag', $event)"
          @update:selected-favorite-category="emit('update:selectedFavoriteCategory', $event)"
          @fetch-plugins="emit('fetch-plugins')"
          @rename-category="handleRenameFavoriteCategory"
          @delete-category="handleDeleteFavoriteCategory"
          @create-category="handleCreateFavoriteCategory"
        />
        <main class="content-panel">
          <HelpRequestsForum
            v-if="activeTab === 'requests'"
            :forum-title="label('插件求助论坛', 'Plugin Help Requests Forum')"
            :forum-desc="
              label(
                '找不到需要的插件？发布求助帖，让社区开发者和爱好者来帮助您！',
                'Can\'t find a plugin? Ask the community for help.',
              )
            "
            :requests="helpRequests"
            :is-loading="isHelpRequestsLoading"
            @open-detail="emit('open-help-request', $event)"
            @create-request="emit('create-help-request')"
          />
          <PluginCatalog
            v-else
            :plugins="visiblePlugins"
            :is-loading="isLoading"
            :view-mode="viewMode"
            :active-tab="activeTab"
            :favorited-ids="favoritedIds"
            :downloading-ids="downloadingIds"
            :active-filter-chips="activeFilterChips"
            :total-count="stats.total || visiblePlugins.length"
            :selected-ids="selectedIdsArray"
            @open-detail="emit('open-detail', $event)"
            @select="emit('select', $event)"
            @toggle-favorite="emit('toggle-favorite', $event)"
            @download="emit('download', $event)"
            @reset-filters="emit('reset-filters')"
            @clear-filter="emit('clear-filter', $event)"
            @upload="emit('upload')"
          />
        </main>
      </div>
    </ContentSection>
  </div>
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
          placeholder="例如：实用工具、烘焙辅助"
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
<style scoped>
.plugins-region {
  padding-inline: var(--page-gutter);
}
.plugins-content {
  flex: 1;
  min-height: 0;
}
.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 12px;
  transition: grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.workspace-shell.collapsed-shell {
  grid-template-columns: 1fr;
}
.workspace-shell.single-col {
  grid-template-columns: 1fr;
}
.content-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
@media (max-width: 980px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .plugins-region {
    padding-inline: var(--page-gutter-mobile);
  }
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Grid3X3, LayoutList, X } from 'lucide-vue-next';
import { messageBox, toast } from '@/utils/feedbackAdapter';
import { useLabel } from '@/utils/i18n';
import PageFrame from '@/components/skeleton/PageFrame.vue';
import PageToolbar from '@/components/skeleton/PageToolbar.vue';
import AsyncState from '@/components/skeleton/AsyncState.vue';
import PageHeader from '@/components/PageHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import Button from '@/components/ui/Button.vue';
import Pagination from '@/components/ui/Pagination.vue';
import Select from '@/components/ui/Select.vue';
import ResourceGrid from './ResourceGrid.vue';
import ResourceFilters from './ResourceFilters.vue';
import { useResourceList } from '@/composables/useResourceList';
import type {
  FilterType,
  ResourceAction,
  ResourceAdapter,
  ResourceFilterConfig,
  ResourceItem,
} from './types';

const props = withDefaults(
  defineProps<{
    adapter: ResourceAdapter;
    pageSize?: number;
    embedded?: boolean;
    defaultViewMode?: 'grid' | 'list';
  }>(),
  {
    pageSize: 24,
    embedded: false,
    defaultViewMode: 'grid',
  },
);

const emit = defineEmits<{
  (e: 'item-click', item: ResourceItem): void;
  (e: 'action', payload: { action: ResourceAction; items: ResourceItem[] }): void;
  (e: 'selection-change', ids: Set<string | number>): void;
}>();

const route = useRoute();
const router = useRouter();
const adapter = props.adapter;
const label = useLabel();

/* ------------------------------------------------------------------
 * View mode (grid / list) — local preference, not URL-synced
 * ------------------------------------------------------------------ */
const viewMode = ref<'grid' | 'list'>(props.defaultViewMode);

/* ------------------------------------------------------------------
 * URL <-> state sync
 * ------------------------------------------------------------------ */
const managedFilterKeys = computed(() => (adapter.filters ?? []).map((f) => f.key));

const coerceQuery = (raw: unknown): string | undefined => {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : undefined;
  return String(raw);
};

const decodeFilterValue = (raw: string): unknown => {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

const encodeFilterValue = (v: unknown): string | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
};

const buildInitialStateFromQuery = () => {
  const q = route.query;
  const initial: {
    page?: number;
    search?: string;
    sort?: string;
    filters?: Record<string, unknown>;
  } = {};

  const pageRaw = coerceQuery(q.page);
  if (pageRaw !== undefined) {
    const n = Number(pageRaw);
    if (Number.isFinite(n) && n >= 1) initial.page = Math.floor(n);
  }

  const searchRaw = coerceQuery(q.search);
  if (searchRaw) initial.search = searchRaw;

  const sortRaw = coerceQuery(q.sort);
  if (sortRaw) initial.sort = sortRaw;
  else if (adapter.defaultSort) initial.sort = adapter.defaultSort;

  const filtersInit: Record<string, unknown> = {};
  for (const cfg of adapter.filters ?? []) {
    const raw = coerceQuery(q[cfg.key]);
    if (raw !== undefined) {
      filtersInit[cfg.key] = decodeFilterValue(raw);
    } else if (cfg.defaultValue !== undefined) {
      filtersInit[cfg.key] = cfg.defaultValue;
    }
  }
  if (Object.keys(filtersInit).length) initial.filters = filtersInit;

  return initial;
};

const syncToUrl = () => {
  const next: Record<string, string> = {};
  // Preserve unmanaged params (e.g. detail id) so we don't clobber them.
  for (const [k, v] of Object.entries(route.query)) {
    if (k === 'page' || k === 'search' || k === 'sort' || managedFilterKeys.value.includes(k)) {
      continue;
    }
    if (typeof v === 'string') next[k] = v;
  }

  if (page.value > 1) next.page = String(page.value);
  if (search.value.trim()) next.search = search.value.trim();
  if (sort.value && sort.value !== adapter.defaultSort) next.sort = sort.value;

  for (const cfg of adapter.filters ?? []) {
    const val = filters.value[cfg.key];
    if (val === undefined || val === null || val === '') continue;
    if (cfg.defaultValue !== undefined && val === cfg.defaultValue) continue;
    const encoded = encodeFilterValue(val);
    if (encoded !== undefined) next[cfg.key] = encoded;
  }

  router.replace({ query: next });
};

/* ------------------------------------------------------------------
 * Data + selection
 * ------------------------------------------------------------------ */
const {
  status,
  items,
  total,
  page,
  pageSize,
  search,
  filters,
  sort,
  selectedIds,
  selectedItems,
  error,
  fetch,
  retry,
  toggleSelection,
  clearSelection,
  deleteSelected,
  resetFilters,
} = useResourceList(adapter, {
  pageSize: props.pageSize,
  immediate: false,
  initial: buildInitialStateFromQuery(),
});

onMounted(() => {
  fetch();
});

// Sync state -> URL query (replace, no history spam).
watch(
  [page, search, sort, filters],
  () => {
    syncToUrl();
  },
  { deep: true },
);

const isBulkMode = computed(() => selectedIds.value.size > 0);

/* ------------------------------------------------------------------
 * Active filters → removable tags (results bar)
 * ------------------------------------------------------------------ */
const defaultForType = (type: FilterType): unknown => {
  switch (type) {
    case 'text':
      return '';
    case 'select':
      return undefined;
    case 'multiselect':
      return [];
    case 'date-range':
      return { start: '', end: '' };
    case 'toggle':
      return false;
  }
};

const isFilterDefault = (cfg: ResourceFilterConfig): boolean => {
  const current = filters.value[cfg.key];
  const def = cfg.defaultValue ?? defaultForType(cfg.type);

  if (Array.isArray(def)) {
    if (!Array.isArray(current) || current.length !== def.length) return false;
    return current.every((v) => (def as unknown[]).includes(v));
  }

  if (typeof def === 'object' && def !== null) {
    if (typeof current !== 'object' || current === null) return false;
    const d = def as Record<string, unknown>;
    const c = current as Record<string, unknown>;
    return Object.keys(d).every((k) => d[k] === c[k]);
  }

  return current === def;
};

interface FilterTag {
  key: string;
  label: string;
}

const activeFilterTags = computed<FilterTag[]>(() => {
  const tags: FilterTag[] = [];
  for (const cfg of adapter.filters ?? []) {
    if (isFilterDefault(cfg)) continue;
    const v = filters.value[cfg.key];

    if (cfg.type === 'select') {
      const opt = cfg.options?.find((o) => String(o.value) === String(v));
      tags.push({ key: cfg.key, label: `${cfg.label}: ${opt?.label ?? String(v)}` });
    } else if (cfg.type === 'multiselect' && Array.isArray(v)) {
      for (const val of v) {
        const opt = cfg.options?.find((o) => String(o.value) === String(val));
        tags.push({ key: cfg.key, label: `${cfg.label}: ${opt?.label ?? String(val)}` });
      }
    } else if (cfg.type === 'toggle' && v) {
      tags.push({ key: cfg.key, label: cfg.label });
    } else if (cfg.type === 'text' && typeof v === 'string' && v.trim()) {
      tags.push({ key: cfg.key, label: `${cfg.label}: ${v.trim()}` });
    } else if (v != null && v !== '') {
      tags.push({ key: cfg.key, label: cfg.label });
    }
  }
  return tags;
});

const hasActiveFilters = computed(
  () => search.value.trim() !== '' || activeFilterTags.value.length > 0,
);

const removeFilterTag = (key: string) => {
  const cfg = (adapter.filters ?? []).find((f) => f.key === key);
  if (!cfg) return;
  filters.value = {
    ...filters.value,
    [key]: cfg.defaultValue ?? defaultForType(cfg.type),
  };
};

const clearSearch = () => {
  search.value = '';
};

const clearAllFilters = () => {
  search.value = '';
  resetFilters();
};

/* ------------------------------------------------------------------
 * Permissions + actions
 * ------------------------------------------------------------------ */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

const toButtonVariant = (v?: ResourceAction['variant']): ButtonVariant => {
  if (v === 'primary') return 'primary';
  if (v === 'danger') return 'danger';
  if (v === 'ghost') return 'outline';
  return 'secondary';
};

const isActionAllowed = (action: ResourceAction) => {
  if (!action.permission) return true;
  return adapter.can ? adapter.can(action.permission) : true;
};

const visibleActions = computed(() => (adapter.actions ?? []).filter(isActionAllowed));
const visibleBulkActions = computed(() => (adapter.bulkActions ?? []).filter(isActionAllowed));

const onPageAction = (action: ResourceAction) => {
  emit('action', { action, items: [] });
  action.handler([]);
};

const handleBulkDelete = async () => {
  const count = selectedIds.value.size;
  try {
    await messageBox.confirm(
      label(
        `确定删除选中的 ${count} 个${adapter.singularTitle}？此操作不可撤销。`,
        `Delete ${count} selected ${adapter.singularTitle.toLowerCase()}${count > 1 ? 's' : ''}? This action cannot be undone.`,
      ),
      label('确认删除', 'Confirm Delete'),
      {
        type: 'warning',
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
      },
    );
  } catch {
    return; // user cancelled
  }

  try {
    await deleteSelected();
    toast.success(
      label(
        `已删除 ${count} 个${adapter.title}`,
        `Deleted ${count} ${adapter.title.toLowerCase()}`,
      ),
    );
  } catch (err) {
    toast.error(err instanceof Error ? err.message : label('删除失败', 'Failed to delete'));
  }
};

const onBulkAction = async (action: ResourceAction) => {
  const selected = selectedItems.value;
  emit('action', { action, items: selected });
  if (action.id === 'delete' && adapter.delete) {
    await handleBulkDelete();
    return;
  }
  await Promise.resolve(action.handler(selected));
};

/* ------------------------------------------------------------------
 * Grid / toolbar event handlers
 * ------------------------------------------------------------------ */
const onItemClick = (item: ResourceItem) => {
  if (isBulkMode.value) {
    onToggleSelect(item.id);
    return;
  }
  emit('item-click', item);
};

const onToggleSelect = (id: string | number) => {
  toggleSelection(id);
  emit('selection-change', selectedIds.value);
};

const onSearchUpdate = (value: string) => {
  search.value = value;
};

const onFiltersUpdate = (value: Record<string, unknown>) => {
  filters.value = { ...value };
};

const onFiltersReset = () => {
  resetFilters();
};

const onSortUpdate = (value: unknown) => {
  sort.value = String(value);
};

const onPageChange = (value: number) => {
  page.value = value;
};

/* ------------------------------------------------------------------
 * i18n labels
 * ------------------------------------------------------------------ */
const resultsCountLabel = computed(() =>
  label(`${total.value} 项结果`, `${total.value} result${total.value === 1 ? '' : 's'}`),
);

const searchPlaceholder = computed(() =>
  label(`搜索${adapter.title}…`, `Search ${adapter.title.toLowerCase()}...`),
);
</script>

<template>
  <!-- Embedded: pure region (Toolbar → Results → Content → Pagination) -->
  <div v-if="embedded" class="resource-list">
    <PageToolbar
      :search-value="search"
      :search-placeholder="searchPlaceholder"
      :bulk-mode="isBulkMode"
      @update:search-value="onSearchUpdate"
    >
      <template #filters>
        <ResourceFilters
          v-if="adapter.filters && adapter.filters.length"
          :filters="adapter.filters ?? []"
          :model-value="filters"
          @update:model-value="onFiltersUpdate"
        />
      </template>
      <template #view-switch>
        <div class="view-toggle" role="group" :aria-label="label('视图切换', 'View toggle')">
          <button
            type="button"
            class="view-toggle__btn"
            :class="{ active: viewMode === 'grid' }"
            :aria-pressed="viewMode === 'grid'"
            :aria-label="label('网格视图', 'Grid view')"
            @click="viewMode = 'grid'"
          >
            <Grid3X3 class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="view-toggle__btn"
            :class="{ active: viewMode === 'list' }"
            :aria-pressed="viewMode === 'list'"
            :aria-label="label('列表视图', 'List view')"
            @click="viewMode = 'list'"
          >
            <LayoutList class="w-4 h-4" />
          </button>
        </div>
        <Select
          v-if="adapter.sortOptions && adapter.sortOptions.length"
          :model-value="sort"
          :options="adapter.sortOptions"
          size="small"
          :aria-label="label('排序', 'Sort')"
          @update:model-value="onSortUpdate"
        />
      </template>
      <template #bulk-actions>
        <span class="bulk-count typo-body">
          {{ label(`${selectedItems.length} 项已选`, `${selectedItems.length} selected`) }}
        </span>
        <Button
          v-for="action in visibleBulkActions"
          :key="action.id"
          :variant="toButtonVariant(action.variant)"
          size="sm"
          :icon="action.icon ?? undefined"
          @click="onBulkAction(action)"
        >
          {{ action.label }}
        </Button>
        <Button variant="outline" size="sm" @click="clearSelection">{{
          label('取消', 'Cancel')
        }}</Button>
      </template>
    </PageToolbar>

    <!-- Results bar: count + active filter tags + clear-all -->
    <div class="results-bar" role="status" aria-live="polite">
      <span class="results-bar__count typo-body">{{ resultsCountLabel }}</span>
      <div v-if="activeFilterTags.length || search.trim()" class="results-bar__tags">
        <span v-if="search.trim()" class="filter-tag">
          <span class="filter-tag__label">{{ label('搜索', 'Search') }}: {{ search.trim() }}</span>
          <button
            type="button"
            class="filter-tag__x"
            :aria-label="label('清除搜索', 'Clear search')"
            @click="clearSearch"
          >
            <X class="w-3 h-3" />
          </button>
        </span>
        <span v-for="tag in activeFilterTags" :key="tag.key" class="filter-tag">
          <span class="filter-tag__label">{{ tag.label }}</span>
          <button
            type="button"
            class="filter-tag__x"
            :aria-label="label(`移除筛选 ${tag.label}`, `Remove filter ${tag.label}`)"
            @click="removeFilterTag(tag.key)"
          >
            <X class="w-3 h-3" />
          </button>
        </span>
      </div>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="results-bar__clear"
        @click="clearAllFilters"
      >
        {{ label('清除全部', 'Clear all') }}
      </button>
    </div>

    <!-- Content -->
    <AsyncState :status="status" :error="error || ''" :skeleton-count="12" @retry="retry">
      <ResourceGrid
        :items="items"
        :card="adapter.card"
        :selected-ids="selectedIds"
        :selectable="isBulkMode"
        :view-mode="viewMode"
        @item-click="onItemClick"
        @toggle-select="onToggleSelect"
      />
      <template #empty>
        <EmptyState
          :title="label(`没有找到${adapter.title}`, `No ${adapter.title.toLowerCase()} found`)"
          :description="label('试试调整搜索或筛选条件。', 'Try adjusting your search or filters.')"
          :action-label="hasActiveFilters ? label('清除筛选', 'Clear filters') : ''"
          @action="onFiltersReset"
        />
      </template>
    </AsyncState>

    <!-- Pagination -->
    <div v-if="total > 0" class="pagination-row">
      <Pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @update:current-page="onPageChange"
      />
    </div>
  </div>

  <!-- Standalone: own PageFrame + PageHeader (one h1) -->
  <PageFrame v-else>
    <div class="resource-list">
      <PageHeader
        :title="adapter.title"
        :subtitle="
          label(`浏览并管理${adapter.title}`, `Browse and manage ${adapter.title.toLowerCase()}`)
        "
      >
        <Button
          v-for="action in visibleActions"
          :key="action.id"
          :variant="toButtonVariant(action.variant)"
          size="sm"
          :icon="action.icon ?? undefined"
          @click="onPageAction(action)"
        >
          {{ action.label }}
        </Button>
      </PageHeader>

      <PageToolbar
        :search-value="search"
        :search-placeholder="searchPlaceholder"
        :bulk-mode="isBulkMode"
        @update:search-value="onSearchUpdate"
      >
        <template #filters>
          <ResourceFilters
            v-if="adapter.filters && adapter.filters.length"
            :filters="adapter.filters ?? []"
            :model-value="filters"
            @update:model-value="onFiltersUpdate"
          />
        </template>
        <template #view-switch>
          <div class="view-toggle" role="group" :aria-label="label('视图切换', 'View toggle')">
            <button
              type="button"
              class="view-toggle__btn"
              :class="{ active: viewMode === 'grid' }"
              :aria-pressed="viewMode === 'grid'"
              :aria-label="label('网格视图', 'Grid view')"
              @click="viewMode = 'grid'"
            >
              <Grid3X3 class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="view-toggle__btn"
              :class="{ active: viewMode === 'list' }"
              :aria-pressed="viewMode === 'list'"
              :aria-label="label('列表视图', 'List view')"
              @click="viewMode = 'list'"
            >
              <LayoutList class="w-4 h-4" />
            </button>
          </div>
          <Select
            v-if="adapter.sortOptions && adapter.sortOptions.length"
            :model-value="sort"
            :options="adapter.sortOptions"
            size="small"
            :aria-label="label('排序', 'Sort')"
            @update:model-value="onSortUpdate"
          />
        </template>
        <template #bulk-actions>
          <span class="bulk-count typo-body">
            {{ label(`${selectedItems.length} 项已选`, `${selectedItems.length} selected`) }}
          </span>
          <Button
            v-for="action in visibleBulkActions"
            :key="action.id"
            :variant="toButtonVariant(action.variant)"
            size="sm"
            :icon="action.icon ?? undefined"
            @click="onBulkAction(action)"
          >
            {{ action.label }}
          </Button>
          <Button variant="outline" size="sm" @click="clearSelection">{{
            label('取消', 'Cancel')
          }}</Button>
        </template>
      </PageToolbar>

      <!-- Results bar -->
      <div class="results-bar" role="status" aria-live="polite">
        <span class="results-bar__count typo-body">{{ resultsCountLabel }}</span>
        <div v-if="activeFilterTags.length || search.trim()" class="results-bar__tags">
          <span v-if="search.trim()" class="filter-tag">
            <span class="filter-tag__label"
              >{{ label('搜索', 'Search') }}: {{ search.trim() }}</span
            >
            <button
              type="button"
              class="filter-tag__x"
              :aria-label="label('清除搜索', 'Clear search')"
              @click="clearSearch"
            >
              <X class="w-3 h-3" />
            </button>
          </span>
          <span v-for="tag in activeFilterTags" :key="tag.key" class="filter-tag">
            <span class="filter-tag__label">{{ tag.label }}</span>
            <button
              type="button"
              class="filter-tag__x"
              :aria-label="label(`移除筛选 ${tag.label}`, `Remove filter ${tag.label}`)"
              @click="removeFilterTag(tag.key)"
            >
              <X class="w-3 h-3" />
            </button>
          </span>
        </div>
        <button
          v-if="hasActiveFilters"
          type="button"
          class="results-bar__clear"
          @click="clearAllFilters"
        >
          {{ label('清除全部', 'Clear all') }}
        </button>
      </div>

      <!-- Content -->
      <AsyncState :status="status" :error="error || ''" :skeleton-count="12" @retry="retry">
        <ResourceGrid
          :items="items"
          :card="adapter.card"
          :selected-ids="selectedIds"
          :selectable="isBulkMode"
          :view-mode="viewMode"
          @item-click="onItemClick"
          @toggle-select="onToggleSelect"
        />
        <template #empty>
          <EmptyState
            :title="label(`没有找到${adapter.title}`, `No ${adapter.title.toLowerCase()} found`)"
            :description="
              label('试试调整搜索或筛选条件。', 'Try adjusting your search or filters.')
            "
            :action-label="hasActiveFilters ? label('清除筛选', 'Clear filters') : ''"
            @action="onFiltersReset"
          />
        </template>
      </AsyncState>

      <!-- Pagination -->
      <div v-if="total > 0" class="pagination-row">
        <Pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @update:current-page="onPageChange"
        />
      </div>
    </div>
  </PageFrame>
</template>

<style scoped>
.resource-list {
  display: flex;
  flex-direction: column;
  gap: var(--page-rhythm-gap);
  padding-block: var(--space-2);
  min-width: 0;
}

/* ── View toggle (grid / list) — segmented control ── */
.view-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-control);
  background: var(--surface-solid);
}

.view-toggle__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--text-on-solid-secondary);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);
}

.view-toggle__btn:hover {
  color: var(--text-on-solid-primary);
  background: var(--bg-hover);
}

.view-toggle__btn.active {
  color: var(--accent);
  background: var(--accent-subtle);
}

.view-toggle__btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* ── Results bar — count + active filter tags + clear-all ── */
.results-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-height: 32px;
}

.results-bar__count {
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  white-space: nowrap;
}

.results-bar__tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 24px;
  padding: 0 var(--space-1) 0 var(--space-2);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-control);
  background: var(--surface-solid);
  color: var(--text-secondary);
  font-size: var(--typo-caption-font-size);
  line-height: 1.4;
}

.filter-tag__label {
  white-space: nowrap;
}

.filter-tag__x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-standard);
}

.filter-tag__x:hover {
  color: var(--danger);
}

.filter-tag__x:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.results-bar__clear {
  height: 24px;
  padding: 0 var(--space-2);
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--typo-caption-font-size);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-standard);
}

.results-bar__clear:hover {
  color: var(--danger);
}

.results-bar__clear:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.bulk-count {
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ── Pagination row ── */
.pagination-row {
  display: flex;
  justify-content: center;
  padding-top: var(--space-2);
}

@media (max-width: 767px) {
  .results-bar {
    gap: var(--space-1);
  }
  .pagination-row {
    justify-content: stretch;
  }
}
</style>

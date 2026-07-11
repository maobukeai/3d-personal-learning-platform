<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  X,
} from 'lucide-vue-next';
import { messageBox, toast } from '@/utils/feedbackAdapter';
import PageFrame from '@/components/skeleton/PageFrame.vue';
import PageHeader from '@/components/PageHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Switch from '@/components/ui/Switch.vue';
import Table from '@/components/ui/Table.vue';
import TableColumn from '@/components/ui/TableColumn.vue';
import Pagination from '@/components/ui/Pagination.vue';
import BulkActionBar from './BulkActionBar.vue';
import CrudDialog from './CrudDialog.vue';
import { useAdminTable } from '@/composables/useAdminTable';
import type {
  AdminTableAdapter,
  AdminFormField,
  AdminAction,
  AdminFilterConfig,
  AdminBulkAction,
} from './types';
const props = withDefaults(
  defineProps<{ adapter: AdminTableAdapter; formFields?: AdminFormField[] }>(),
  { formFields: () => [] },
);
const emit = defineEmits<{
  (e: 'row-click', row: Record<string, unknown>): void;
  (
    e: 'action',
    payload: { action: AdminAction | AdminBulkAction; items: Record<string, unknown>[] },
  ): void;
}>();
const route = useRoute();
const router = useRouter();
const adapter = props.adapter;
const rowKeyField = adapter.rowKey ?? 'id';
/* ------------------------------------------------------------------ * * URL <-> state sync * ------------------------------------------------------------------ */ const managedFilterKeys =
  computed(() => (adapter.filters ?? []).map((f) => f.key));
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
    order?: 'asc' | 'desc';
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
  const orderRaw = coerceQuery(q.order);
  if (orderRaw === 'asc' || orderRaw === 'desc') initial.order = orderRaw;
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
  for (const [k, v] of Object.entries(route.query)) {
    if (
      k === 'page' ||
      k === 'search' ||
      k === 'sort' ||
      k === 'order' ||
      managedFilterKeys.value.includes(k)
    ) {
      continue;
    }
    if (typeof v === 'string') next[k] = v;
  }
  if (page.value > 1) next.page = String(page.value);
  if (search.value.trim()) next.search = search.value.trim();
  if (sort.value && sort.value !== adapter.defaultSort) next.sort = sort.value;
  if (order.value !== 'desc') next.order = order.value;
  for (const cfg of adapter.filters ?? []) {
    const val = filters.value[cfg.key];
    if (val === undefined || val === null || val === '') continue;
    if (cfg.defaultValue !== undefined && val === cfg.defaultValue) continue;
    const encoded = encodeFilterValue(val);
    if (encoded !== undefined) next[cfg.key] = encoded;
  }
  router.replace({ query: next });
};
/* ------------------------------------------------------------------ * * Data + selection * ------------------------------------------------------------------ */ const {
  status,
  items,
  total,
  page,
  pageSize,
  search,
  filters,
  sort,
  order,
  selectedIds,
  selectedItems,
  loading,
  error,
  fetch,
  retry,
  toggleSelection,
  selectAll,
  clearSelection,
  deleteSelected,
  resetFilters,
} = useAdminTable(adapter, {
  pageSize: adapter.pageSize ?? 20,
  immediate: false,
  initial: buildInitialStateFromQuery(),
});
onMounted(() => {
  fetch();
});
watch(
  [page, search, sort, order, filters],
  () => {
    syncToUrl();
  },
  { deep: true },
);
const isBulkMode = computed(() => selectedIds.value.size > 0);
const hasActiveFilters = computed(
  () => search.value.trim() !== '' || Object.keys(filters.value).length > 0,
);
/* ------------------------------------------------------------------ * * Row helpers * ------------------------------------------------------------------ */ const rowIdOf =
  (row: Record<string, unknown>): string | number => {
    const v = row[rowKeyField];
    return (v === undefined || v === null ? '' : v) as string | number;
  };
const isRowSelected = (row: Record<string, unknown>): boolean => {
  return selectedIds.value.has(rowIdOf(row));
};
const allSelected = computed(() => {
  if (items.value.length === 0) return false;
  return items.value.every((item) => selectedIds.value.has(rowIdOf(item)));
});
const onToggleRow = (row: Record<string, unknown>) => {
  toggleSelection(rowIdOf(row));
};
const onToggleSelectAll = () => {
  if (allSelected.value) {
    clearSelection();
  } else {
    selectAll();
  }
};
/* ------------------------------------------------------------------ * * Sorting * ------------------------------------------------------------------ */ const onSort =
  (key: string) => {
    if (sort.value === key) {
      order.value = order.value === 'asc' ? 'desc' : 'asc';
    } else {
      sort.value = key;
      order.value = 'desc';
    }
  };
const isSortedBy = (key: string): boolean => sort.value === key;
/* ------------------------------------------------------------------ * * Column helpers * ------------------------------------------------------------------ */ const dataColumns =
  computed(() => adapter.columns);
const parseWidth = (w?: string): number | undefined => {
  if (!w) return undefined;
  const n = parseInt(w, 10);
  return isNaN(n) ? undefined : n;
};
const formatCell = (
  col: (typeof adapter.columns)[number],
  row: Record<string, unknown>,
): string => {
  const value = row[col.key];
  if (col.formatter) return col.formatter(value, row);
  if (value === null || value === undefined) return '';
  return String(value);
};
const hasRowActions = computed(() => !!adapter.crud?.edit || !!adapter.crud?.delete);
/* ------------------------------------------------------------------ * * Filters * ------------------------------------------------------------------ */ const VISIBLE_FILTER_COUNT = 3;
const showAdvanced = ref(false);
const visibleFilters = computed(() => (adapter.filters ?? []).slice(0, VISIBLE_FILTER_COUNT));
const advancedFilters = computed(() => (adapter.filters ?? []).slice(VISIBLE_FILTER_COUNT));
const hasAdvancedFilters = computed(() => advancedFilters.value.length > 0);
const defaultForFilterType = (type: AdminFilterConfig['type']): unknown => {
  switch (type) {
    case 'text':
      return '';
    case 'select':
      return undefined;
    case 'multiselect':
      return [];
    case 'date':
      return '';
    case 'date-range':
      return { start: '', end: '' };
    case 'toggle':
      return false;
  }
};
const updateFilter = (key: string, value: unknown) => {
  filters.value = { ...filters.value, [key]: value };
};
const dateRangeValue = (filter: AdminFilterConfig, bound: 'start' | 'end'): string => {
  const v = filters.value[filter.key];
  if (v && typeof v === 'object') {
    return String((v as Record<string, unknown>)[bound] ?? '');
  }
  return '';
};
const updateDateRange = (filter: AdminFilterConfig, bound: 'start' | 'end', value: string) => {
  const current = (filters.value[filter.key] as { start?: string; end?: string } | undefined) ?? {};
  updateFilter(filter.key, { ...current, [bound]: value });
};
const onClearFilters = () => {
  resetFilters();
  showAdvanced.value = false;
};
const activeFilterCount = computed(() => {
  if (!adapter.filters) return 0;
  return adapter.filters.filter((f) => {
    const current = filters.value[f.key];
    const def = f.defaultValue ?? defaultForFilterType(f.type);
    if (Array.isArray(def)) {
      if (!Array.isArray(current) || current.length !== def.length) return true;
      return !current.every((v) => (def as unknown[]).includes(v));
    }
    return current !== def;
  }).length;
});
/* ------------------------------------------------------------------ * * Permissions + actions * ------------------------------------------------------------------ */ type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'danger';
const toButtonVariant = (v?: AdminAction['variant']): ButtonVariant => {
  if (v === 'primary') return 'primary';
  if (v === 'danger') return 'danger';
  if (v === 'ghost') return 'outline';
  return 'secondary';
};
const onPageAction = (action: AdminAction) => {
  emit('action', { action, items: [] });
  if (action.handler) action.handler([]);
};
const onBulkAction = async (actionId: string) => {
  const action = adapter.bulkActions?.find((a) => a.id === actionId);
  if (!action) return;
  const selected = selectedItems.value;
  if (action.confirm) {
    try {
      await messageBox.confirm(action.confirm, 'Confirm', {
        type: action.variant === 'danger' ? 'error' : 'warning',
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
      });
    } catch {
      return;
    }
  }
  emit('action', { action, items: selected });
  if (action.id === 'delete' && adapter.delete) {
    try {
      await deleteSelected();
      toast.success(`Deleted ${selected.length} item(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
    return;
  }
  if (action.handler) await Promise.resolve(action.handler(selected));
};
/* ------------------------------------------------------------------ * * CRUD dialog * ------------------------------------------------------------------ */ const crudVisible =
  ref(false);
const crudMode = ref<'create' | 'edit'>('create');
const crudRow = ref<Record<string, unknown> | null>(null);
const crudLoading = ref(false);
const resolvedFormFields = computed<AdminFormField[]>(() => {
  if (props.formFields.length > 0) return props.formFields;
  return adapter.columns
    .filter((col) => col.key !== 'actions')
    .map((col) => ({ key: col.key, label: col.label, type: 'text' as const }));
});
const crudTitle = computed(() => {
  if (crudMode.value === 'edit') return adapter.crud?.edit?.label ?? 'Edit';
  return adapter.crud?.create?.label ?? 'Create';
});
const crudInitialData = computed(() => crudRow.value ?? {});
const canCreate = computed(() => !!adapter.crud?.create && !!adapter.create);
const canEdit = computed(() => !!adapter.crud?.edit && !!adapter.update);
const canDelete = computed(() => !!adapter.crud?.delete && !!adapter.delete);
const onCreate = () => {
  crudMode.value = 'create';
  crudRow.value = null;
  crudVisible.value = true;
};
const onEdit = (row: Record<string, unknown>) => {
  crudMode.value = 'edit';
  crudRow.value = { ...row };
  crudVisible.value = true;
};
const onDeleteRow = async (row: Record<string, unknown>) => {
  if (!adapter.crud?.delete || !adapter.delete) return;
  const confirmMsg = adapter.crud.delete.confirm;
  try {
    await messageBox.confirm(
      confirmMsg || 'Are you sure you want to delete this row?',
      'Confirm Delete',
      {
        type: 'error',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
      },
    );
  } catch {
    return;
  }
  try {
    await adapter.delete([rowIdOf(row)]);
    toast.success('Deleted successfully');
    await fetch();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to delete');
  }
};
const onCrudSubmit = async (data: Record<string, unknown>) => {
  crudLoading.value = true;
  try {
    if (crudMode.value === 'create' && adapter.create) {
      await adapter.create(data);
      toast.success('Created successfully');
    } else if (crudMode.value === 'edit' && adapter.update && crudRow.value) {
      await adapter.update(rowIdOf(crudRow.value), data);
      toast.success('Updated successfully');
    }
    crudVisible.value = false;
    await fetch();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Operation failed');
  } finally {
    crudLoading.value = false;
  }
};
/* ------------------------------------------------------------------ * * Pagination * ------------------------------------------------------------------ */ const onPageChange =
  (value: number) => {
    page.value = value;
  };
const onRowClick = (row: Record<string, unknown>) => {
  emit('row-click', row);
};
const getRowClassName = (row: Record<string, unknown>): string => {
  return isRowSelected(row) ? 'row-selected' : '';
};
</script>
<template>
  <PageFrame>
    <div class="data-table-page flex flex-col gap-4 py-4">
      <PageHeader :title="adapter.title" :subtitle="`Manage ${adapter.title.toLowerCase()}`">
        <template #center>
          <Input
            :model-value="search"
            :icon="Search"
            placeholder="Search..."
            clearable
            @update:model-value="(v: string) => (search = v)"
          />
        </template>
        <Button
          v-for="action in adapter.actions ?? []"
          :key="action.id"
          :variant="toButtonVariant(action.variant)"
          size="sm"
          :icon="action.icon ?? undefined"
          @click="onPageAction(action)"
        >
          {{ action.label }}
        </Button>
        <Button
          v-if="canCreate"
          variant="primary"
          size="sm"
          :icon="adapter.crud?.create?.icon ?? Plus"
          @click="onCreate"
        >
          {{ adapter.crud?.create?.label ?? 'Create' }}
        </Button>
      </PageHeader>
      <!-- Filter Bar (collapsible) -->
      <div
        v-if="adapter.filters && adapter.filters.length > 0"
        class="filter-bar rounded-xl border border-border bg-card p-3 flex flex-col gap-2"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <template v-for="filter in visibleFilters" :key="filter.key">
            <!-- text -->
            <Input
              v-if="filter.type === 'text'"
              :model-value="String(filters[filter.key] ?? '')"
              :placeholder="filter.label"
              @update:model-value="(v: string) => updateFilter(filter.key, v)"
            />
            <!-- select -->
            <Select
              v-else-if="filter.type === 'select'"
              :model-value="filters[filter.key]"
              :options="filter.options"
              :placeholder="filter.label"
              size="small"
              @update:model-value="(v: unknown) => updateFilter(filter.key, v)"
            />
            <!-- multiselect -->
            <Select
              v-else-if="filter.type === 'multiselect'"
              :model-value="filters[filter.key]"
              :options="filter.options"
              :placeholder="filter.label"
              size="small"
              multiple
              @update:model-value="(v: unknown) => updateFilter(filter.key, v)"
            >
              <SelectOption
                v-for="opt in filter.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </Select>
            <!-- date -->
            <div v-else-if="filter.type === 'date'" class="filter-field">
              <DatePicker
                :model-value="(filters[filter.key] as string | Date | null) ?? null"
                :placeholder="filter.label"
                @update:model-value="(v: any) => updateFilter(filter.key, v)"
              />
            </div>
            <!-- date-range -->
            <div
              v-else-if="filter.type === 'date-range'"
              class="filter-field inline-flex items-center gap-2"
            >
              <input
                type="date"
                class="date-input"
                :value="dateRangeValue(filter, 'start')"
                @input="updateDateRange(filter, 'start', ($event.target as HTMLInputElement).value)"
              />
              <span class="text-muted-foreground text-sm">–</span>
              <input
                type="date"
                class="date-input"
                :value="dateRangeValue(filter, 'end')"
                @input="updateDateRange(filter, 'end', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <!-- toggle -->
            <Switch
              v-else-if="filter.type === 'toggle'"
              :model-value="Boolean(filters[filter.key])"
              @update:model-value="(v: boolean) => updateFilter(filter.key, v)"
            >
              {{ filter.label }}
            </Switch>
          </template>
          <button
            v-if="hasAdvancedFilters"
            type="button"
            class="advanced-toggle inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
            @click="showAdvanced = !showAdvanced"
          >
            <SlidersHorizontal class="w-3.5 h-3.5" /> <span>Advanced</span>
            <span v-if="activeFilterCount > 0" class="advanced-badge">{{ activeFilterCount }}</span>
          </button>
          <button
            v-if="activeFilterCount > 0"
            type="button"
            class="clear-btn inline-flex items-center gap-1 h-9 px-3 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
            @click="onClearFilters"
          >
            <X class="w-3 h-3" /> <span>Clear</span>
          </button>
        </div>
        <!-- Advanced filters (expandable) -->
        <div
          v-if="showAdvanced && hasAdvancedFilters"
          class="advanced-section flex items-center gap-2 flex-wrap pt-2 border-t border-border"
        >
          <template v-for="filter in advancedFilters" :key="filter.key">
            <Input
              v-if="filter.type === 'text'"
              :model-value="String(filters[filter.key] ?? '')"
              :placeholder="filter.label"
              @update:model-value="(v: string) => updateFilter(filter.key, v)"
            />
            <Select
              v-else-if="filter.type === 'select'"
              :model-value="filters[filter.key]"
              :options="filter.options"
              :placeholder="filter.label"
              size="small"
              @update:model-value="(v: unknown) => updateFilter(filter.key, v)"
            />
            <Select
              v-else-if="filter.type === 'multiselect'"
              :model-value="filters[filter.key]"
              :options="filter.options"
              :placeholder="filter.label"
              size="small"
              multiple
              @update:model-value="(v: unknown) => updateFilter(filter.key, v)"
            >
              <SelectOption
                v-for="opt in filter.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </Select>
            <div v-else-if="filter.type === 'date'" class="filter-field">
              <DatePicker
                :model-value="(filters[filter.key] as string | Date | null) ?? null"
                :placeholder="filter.label"
                @update:model-value="(v: any) => updateFilter(filter.key, v)"
              />
            </div>
            <div
              v-else-if="filter.type === 'date-range'"
              class="filter-field inline-flex items-center gap-2"
            >
              <input
                type="date"
                class="date-input"
                :value="dateRangeValue(filter, 'start')"
                @input="updateDateRange(filter, 'start', ($event.target as HTMLInputElement).value)"
              />
              <span class="text-muted-foreground text-sm">–</span>
              <input
                type="date"
                class="date-input"
                :value="dateRangeValue(filter, 'end')"
                @input="updateDateRange(filter, 'end', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <Switch
              v-else-if="filter.type === 'toggle'"
              :model-value="Boolean(filters[filter.key])"
              @update:model-value="(v: boolean) => updateFilter(filter.key, v)"
            >
              {{ filter.label }}
            </Switch>
          </template>
        </div>
      </div>
      <!-- Bulk Action Bar -->
      <BulkActionBar
        v-if="isBulkMode"
        :selected-count="selectedIds.size"
        :actions="adapter.bulkActions ?? []"
        @action="onBulkAction"
        @clear="clearSelection"
      />
      <!-- Error state -->
      <div
        v-if="status === 'error'"
        class="error-state rounded-xl border border-border bg-card p-8"
      >
        <p class="text-sm font-semibold text-destructive mb-2">
          {{ error || 'Something went wrong' }}
        </p>
        <Button variant="outline" size="sm" @click="retry">Retry</Button>
      </div>
      <!-- Table -->
      <div v-else class="table-shell rounded-xl border border-border bg-card overflow-hidden">
        <Table
          :data="items as any[]"
          :loading="loading"
          :row-key="rowKeyField"
          :row-class-name="getRowClassName"
          class="admin-table w-full"
          @row-click="onRowClick"
        >
          <!-- Selection column -->
          <TableColumn width="48" align="center">
            <template #header>
              <Checkbox
                :model-value="allSelected"
                aria-label="Select all rows"
                @change="onToggleSelectAll"
              />
            </template>
            <template #default="{ row }">
              <Checkbox
                :model-value="isRowSelected(row)"
                :aria-label="`Select row ${rowIdOf(row)}`"
                @change="onToggleRow(row)"
              />
            </template>
          </TableColumn>
          <!-- Data columns -->
          <template v-for="col in dataColumns" :key="col.key">
            <TableColumn
              :label="col.label"
              :width="parseWidth(col.width)"
              :align="(col.align as any) ?? 'left'"
            >
              <template v-if="col.sortable" #header>
                <button
                  type="button"
                  class="sort-header inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  @click.stop="onSort(col.key)"
                >
                  <span>{{ col.label }}</span>
                  <ChevronUp
                    v-if="isSortedBy(col.key) && order === 'asc'"
                    class="w-3.5 h-3.5 text-accent"
                  />
                  <ChevronDown
                    v-else-if="isSortedBy(col.key) && order === 'desc'"
                    class="w-3.5 h-3.5 text-accent"
                  />
                  <ChevronDown v-else class="w-3.5 h-3.5 opacity-30" />
                </button>
              </template>
              <template #default="{ row }">
                <component
                  :is="col.component"
                  v-if="col.component"
                  :row="row"
                  :value="row[col.key]"
                />
                <span v-else>{{ formatCell(col, row) }}</span>
              </template>
            </TableColumn>
          </template>
          <!-- Row actions column -->
          <TableColumn v-if="hasRowActions" label="Actions" width="100" align="right">
            <template #default="{ row }">
              <div class="flex items-center justify-end gap-1" @click.stop>
                <button
                  v-if="canEdit"
                  type="button"
                  class="row-action"
                  :aria-label="adapter.crud?.edit?.label ?? 'Edit'"
                  :title="adapter.crud?.edit?.label ?? 'Edit'"
                  @click="onEdit(row)"
                >
                  <Edit3 class="w-4 h-4" />
                </button>
                <button
                  v-if="canDelete"
                  type="button"
                  class="row-action row-action--danger"
                  :aria-label="adapter.crud?.delete?.label ?? 'Delete'"
                  :title="adapter.crud?.delete?.label ?? 'Delete'"
                  @click="onDeleteRow(row)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </template>
          </TableColumn>
          <!-- Empty state -->
          <template #empty>
            <EmptyState
              :title="`No ${adapter.title.toLowerCase()} found`"
              description="Try adjusting your search or filters."
              :action-label="hasActiveFilters ? 'Clear filters' : ''"
              @action="onClearFilters"
            />
          </template>
        </Table>
      </div>
      <!-- Pagination -->
      <div v-if="total > 0" class="flex justify-center pt-2">
        <Pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @update:current-page="onPageChange"
        />
      </div>
    </div>
    <!-- CRUD Dialog -->
    <CrudDialog
      :visible="crudVisible"
      :title="crudTitle"
      :fields="resolvedFormFields"
      :initial-data="crudInitialData"
      :loading="crudLoading"
      @update:visible="crudVisible = $event"
      @submit="onCrudSubmit"
    />
  </PageFrame>
</template>
<style scoped>
.data-table-page {
  min-height: 0;
}
.filter-bar {
  background-color: var(--surface-solid);
  border: 1px solid var(--surface-solid-border);
  border-radius: var(--radius-section);
}
.filter-field {
  display: inline-flex;
  align-items: center;
}
.date-input {
  height: 38px;
  padding: 0 8px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-field);
  background: var(--surface-solid);
  color: var(--text-primary);
  font-size: var(--typo-body-font-size);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.date-input:focus {
  border-color: var(--accent);
}
.advanced-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9999px;
  background: var(--accent);
  color: var(--accent-on);
  font-size: var(--typo-caption-font-size);
  font-weight: var(--font-bold);
  line-height: 1;
}
.advanced-section {
  border-color: var(--border-base);
}
.table-shell {
  background-color: var(--surface-solid);
  border: 1px solid var(--surface-solid-border);
  border-radius: var(--radius-section);
  overflow: hidden;
}
.clear-btn {
  border: none;
  background: transparent;
  cursor: pointer;
}
.row-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1);
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--text-on-solid-muted);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}
.row-action:hover {
  background: var(--bg-hover);
  color: var(--accent);
}
.row-action--danger:hover {
  color: var(--danger);
}
.row-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
} /* Selected-row treatment: var(--bg-active) background + 2px accent left indicator. Uses inset box-shadow to avoid layout shift from border changes. */
:deep(.row-selected) {
  background-color: var(--bg-active);
  box-shadow: inset 2px 0 0 var(--accent);
}
:deep(.row-selected:hover) {
  background-color: var(--bg-active);
}
</style>

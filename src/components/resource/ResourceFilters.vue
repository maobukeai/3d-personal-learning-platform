<script setup lang="ts">
import { computed, ref } from 'vue';
import { Filter, X } from 'lucide-vue-next';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Switch from '@/components/ui/Switch.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Drawer from '@/components/ui/Drawer.vue';
import GlassPopover from '@/components/ui/GlassPopover.vue';
import { useLabel } from '@/utils/i18n';
import type { FilterType, ResourceFilterConfig } from './types';
const props = withDefaults(
  defineProps<{
    filters: ResourceFilterConfig[];
    modelValue: Record<string, unknown>;
    mobileDrawer?: boolean;
  }>(),
  { mobileDrawer: true },
);
const label = useLabel();
const filtersLabel = label('筛选', 'Filters');
const clearAllLabel = label('清除全部', 'Clear all');
const emit = defineEmits<{ (e: 'update:modelValue', value: Record<string, unknown>): void }>();
const drawerOpen = ref(false);
const desktopFilters = computed(() => props.filters.filter((f) => !f.mobileOnly));
const mobileFilters = computed(() => props.filters.filter((f) => !f.desktopOnly));
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
const update = (key: string, value: unknown) => {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
};
const toggleMulti = (filter: ResourceFilterConfig, optionValue: string | number) => {
  const current = Array.isArray(props.modelValue[filter.key])
    ? [...(props.modelValue[filter.key] as (string | number)[])]
    : [];
  const idx = current.indexOf(optionValue);
  if (idx === -1) current.push(optionValue);
  else current.splice(idx, 1);
  update(filter.key, current);
};
const multiSelected = (filter: ResourceFilterConfig, optionValue: string | number): boolean => {
  const v = props.modelValue[filter.key];
  return Array.isArray(v) && v.includes(optionValue);
};
const multiCount = (filter: ResourceFilterConfig): number => {
  const v = props.modelValue[filter.key];
  return Array.isArray(v) ? v.length : 0;
};
const multiLabel = (filter: ResourceFilterConfig): string => {
  if (!filter.options) return filter.label;
  const v = props.modelValue[filter.key];
  if (!Array.isArray(v) || v.length === 0) return filter.label;
  const labels = v
    .map((val) => filter.options?.find((o) => o.value === val)?.label)
    .filter(Boolean);
  return labels.length ? labels.join(', ') : filter.label;
};
const dateValue = (filter: ResourceFilterConfig, bound: 'start' | 'end'): string => {
  const v = props.modelValue[filter.key];
  if (v && typeof v === 'object') {
    return String((v as Record<string, unknown>)[bound] ?? '');
  }
  return '';
};
const updateDate = (filter: ResourceFilterConfig, bound: 'start' | 'end', value: string) => {
  const current =
    (props.modelValue[filter.key] as { start?: string; end?: string } | undefined) ?? {};
  update(filter.key, { ...current, [bound]: value });
};
const isDefault = (filter: ResourceFilterConfig): boolean => {
  const current = props.modelValue[filter.key];
  const def = filter.defaultValue ?? defaultForType(filter.type);
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
const activeCount = computed(() => props.filters.filter((f) => !isDefault(f)).length);
const clearAll = () => {
  const next: Record<string, unknown> = {};
  for (const f of props.filters) {
    next[f.key] = f.defaultValue ?? defaultForType(f.type);
  }
  emit('update:modelValue', next);
  drawerOpen.value = false;
};
</script>
<template>
  <div class="resource-filters">
    <!-- Inline bar (desktop, or always when mobileDrawer is off) -->
    <div class="filters-bar" :class="{ 'always-inline': !mobileDrawer }">
      <div class="filters-row">
        <template v-for="filter in desktopFilters" :key="filter.key">
          <!-- text -->
          <Input
            v-if="filter.type === 'text'"
            :model-value="String(modelValue[filter.key] ?? '')"
            :placeholder="filter.label"
            @update:model-value="(v: string) => update(filter.key, v)"
          />
          <!-- select -->
          <Select
            v-else-if="filter.type === 'select'"
            :model-value="modelValue[filter.key]"
            :options="filter.options"
            :placeholder="filter.label"
            @update:model-value="(v) => update(filter.key, v)"
          />
          <!-- multiselect -->
          <GlassPopover
            v-else-if="filter.type === 'multiselect'"
            placement="bottom-start"
            class="ms-trigger"
          >
            <template #reference>
              <button type="button" class="ms-btn" :class="{ active: multiCount(filter) > 0 }">
                <span class="ms-btn-label">{{ multiLabel(filter) }}</span>
                <span v-if="multiCount(filter) > 0" class="ms-count">{{ multiCount(filter) }}</span>
              </button>
            </template>
            <div class="ms-list">
              <div v-for="opt in filter.options" :key="opt.value" class="ms-option">
                <Checkbox
                  :model-value="multiSelected(filter, opt.value)"
                  @update:model-value="toggleMulti(filter, opt.value)"
                  >{{ opt.label }}</Checkbox
                >
              </div>
            </div>
          </GlassPopover>
          <!-- date-range -->
          <div v-else-if="filter.type === 'date-range'" class="date-range">
            <input
              type="date"
              class="date-input"
              :value="dateValue(filter, 'start')"
              @input="updateDate(filter, 'start', ($event.target as HTMLInputElement).value)"
            />
            <span class="date-sep">–</span>
            <input
              type="date"
              class="date-input"
              :value="dateValue(filter, 'end')"
              @input="updateDate(filter, 'end', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <!-- toggle -->
          <Switch
            v-else-if="filter.type === 'toggle'"
            :model-value="Boolean(modelValue[filter.key])"
            @update:model-value="(v: boolean) => update(filter.key, v)"
            >{{ filter.label }}</Switch
          >
        </template>
        <slot name="extra" />
        <button v-if="activeCount > 0" type="button" class="clear-btn" @click="clearAll">
          <X class="w-3 h-3" /> <span>{{ clearAllLabel }}</span>
        </button>
      </div>
    </div>
    <!-- Mobile trigger -->
    <button
      v-if="mobileDrawer"
      type="button"
      class="filters-trigger"
      :aria-label="filtersLabel"
      @click="drawerOpen = true"
    >
      <Filter class="w-4 h-4" /> <span>{{ filtersLabel }}</span>
      <span v-if="activeCount > 0" class="trigger-badge">{{ activeCount }}</span>
    </button>
    <!-- Mobile drawer -->
    <Drawer
      v-if="mobileDrawer"
      v-model="drawerOpen"
      :title="filtersLabel"
      direction="rtl"
      size="320px"
    >
      <div class="drawer-filters">
        <template v-for="filter in mobileFilters" :key="filter.key">
          <!-- text -->
          <Input
            v-if="filter.type === 'text'"
            :model-value="String(modelValue[filter.key] ?? '')"
            :placeholder="filter.label"
            @update:model-value="(v: string) => update(filter.key, v)"
          />
          <!-- select -->
          <Select
            v-else-if="filter.type === 'select'"
            :model-value="modelValue[filter.key]"
            :options="filter.options"
            :placeholder="filter.label"
            @update:model-value="(v) => update(filter.key, v)"
          />
          <!-- multiselect -->
          <div v-else-if="filter.type === 'multiselect'" class="drawer-field">
            <p class="drawer-field-label">{{ filter.label }}</p>
            <div class="ms-list stacked">
              <div v-for="opt in filter.options" :key="opt.value" class="ms-option">
                <Checkbox
                  :model-value="multiSelected(filter, opt.value)"
                  @update:model-value="toggleMulti(filter, opt.value)"
                  >{{ opt.label }}</Checkbox
                >
              </div>
            </div>
          </div>
          <!-- date-range -->
          <div v-else-if="filter.type === 'date-range'" class="drawer-field">
            <p class="drawer-field-label">{{ filter.label }}</p>
            <div class="date-range stacked">
              <input
                type="date"
                class="date-input"
                :value="dateValue(filter, 'start')"
                @input="updateDate(filter, 'start', ($event.target as HTMLInputElement).value)"
              />
              <span class="date-sep">–</span>
              <input
                type="date"
                class="date-input"
                :value="dateValue(filter, 'end')"
                @input="updateDate(filter, 'end', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
          <!-- toggle -->
          <div v-else-if="filter.type === 'toggle'" class="drawer-field">
            <Switch
              :model-value="Boolean(modelValue[filter.key])"
              @update:model-value="(v: boolean) => update(filter.key, v)"
              >{{ filter.label }}</Switch
            >
          </div>
        </template>
        <slot name="extra" />
      </div>
      <div class="drawer-footer">
        <span v-if="activeCount > 0" class="drawer-count"
          >{{ activeCount }} {{ label('项已启用', 'active') }}</span
        >
        <button v-if="activeCount > 0" type="button" class="clear-btn" @click="clearAll">
          <X class="w-3 h-3" /> <span>{{ clearAllLabel }}</span>
        </button>
      </div>
    </Drawer>
  </div>
</template>
<style scoped>
.resource-filters {
  display: flex;
  align-items: center;
  width: 100%;
} /* Inline bar */
.filters-bar {
  display: none;
  width: 100%;
}
.filters-bar.always-inline {
  display: block;
}
@media (min-width: 640px) {
  .filters-bar {
    display: block;
  }
}
.filters-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
} /* Mobile trigger */
.filters-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);
}
.filters-trigger:hover {
  border-color: var(--accent-subtle);
  background: var(--bg-hover);
}
@media (min-width: 640px) {
  .filters-trigger {
    display: none;
  }
}
.trigger-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-control);
  background: var(--accent);
  color: var(--accent-on);
  font-size: var(--typo-caption-font-size);
  font-weight: var(--font-semibold);
  line-height: 1;
} /* Multiselect trigger button */
.ms-trigger {
  display: inline-flex;
}
.ms-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);
}
.ms-btn:hover {
  border-color: var(--accent-subtle);
  background: var(--bg-hover);
}
.ms-btn.active {
  border-color: var(--accent);
  color: var(--accent);
}
.ms-btn-label {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ms-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-control);
  background: var(--accent);
  color: var(--accent-on);
  font-size: var(--typo-caption-font-size);
  font-weight: var(--font-semibold);
  line-height: 1;
}
.ms-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 180px;
  max-height: 260px;
  overflow-y: auto;
}
.ms-list.stacked {
  min-width: 0;
}
.ms-option {
  padding: var(--space-1) 0;
} /* Date range */
.date-range {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.date-range.stacked {
  width: 100%;
}
.date-input {
  height: 40px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-standard);
}
.date-input:focus {
  border-color: var(--accent);
}
.date-sep {
  color: var(--text-muted);
  font-size: var(--text-sm);
} /* Clear button */
.clear-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px dashed transparent;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-standard);
}
.clear-btn:hover {
  color: var(--danger);
} /* Drawer contents */
.drawer-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}
.drawer-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.drawer-field-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-base);
}
.drawer-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}
</style>

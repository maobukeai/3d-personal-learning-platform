<script setup lang="ts">
import { computed, useSlots, provide, ref } from 'vue';
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from 'radix-vue';
import { ChevronDown, X, Check } from 'lucide-vue-next';
import GlassPopover from './GlassPopover.vue';

interface Option {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface Props {
  modelValue: any;
  options?: Option[];
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  size?: 'large' | 'default' | 'small';
  loading?: boolean;
  class?: any;
  // ElSelect 兼容 props
  popperClass?: string;
  teleported?: boolean;
  collapseTags?: boolean;
  collapseTagsTooltip?: boolean;
  filterable?: boolean;
  multiple?: boolean;
  remote?: boolean;
  allowCreate?: boolean;
  noDataText?: string;
  noMatchText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  options: () => [],
  placeholder: '请选择',
  disabled: false,
  clearable: false,
  size: 'default',
  loading: false,
  class: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void;
  (e: 'change', value: any): void;
  (e: 'clear'): void;
  (e: 'visible-change', val: boolean): void;
}>();

const slots = useSlots();

const val = computed({
  get: () => {
    if (props.modelValue === undefined || props.modelValue === null) return undefined;
    const stringVal = String(props.modelValue);
    return stringVal === '' ? '____EMPTY_VALUE____' : stringVal;
  },
  set: (v) => {
    if (v === '____EMPTY_VALUE____' || v === '') {
      emit('update:modelValue', '');
      emit('change', '');
      return;
    }
    if (v === undefined || v === null) {
      emit('update:modelValue', undefined);
      emit('change', undefined);
      return;
    }
    const originalOption = props.options.find((opt) => {
      const optStr = String(opt.value);
      const comparisonVal = optStr === '' ? '____EMPTY_VALUE____' : optStr;
      return comparisonVal === v;
    });
    const finalValue = originalOption ? originalOption.value : v;
    emit('update:modelValue', finalValue);
    emit('change', finalValue);
  },
});

const handleOpenChange = (val: boolean) => {
  emit('visible-change', val);
};

const handleClear = (e: MouseEvent) => {
  e.stopPropagation();
  const emptyValue = props.multiple ? [] : undefined;
  emit('update:modelValue', emptyValue);
  emit('change', emptyValue);
  emit('clear');
};

const showClear = computed(() => {
  if (!props.clearable || props.disabled) return false;
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.length > 0;
  }
  return props.modelValue !== undefined && props.modelValue !== null && props.modelValue !== '';
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'large':
      return 'h-11 px-4 text-base';
    case 'small':
      return 'h-8 px-2 text-xs';
    case 'default':
    default:
      return 'h-10 px-3 text-sm';
  }
});

// ── 多选（Multiple）支持逻辑 ──
const optionsRegistry = ref(new Map<string, string>());

const multipleIsSelected = (value: any) => {
  return Array.isArray(props.modelValue) && props.modelValue.includes(value);
};

const toggleMultipleOption = (value: any) => {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
  const index = current.indexOf(value);
  if (index === -1) {
    current.push(value);
  } else {
    current.splice(index, 1);
  }
  emit('update:modelValue', current);
  emit('change', current);
};

provide(
  'custom-select-multiple',
  props.multiple
    ? {
        isSelected: multipleIsSelected,
        toggle: toggleMultipleOption,
        registerOption: (value: any, label: string) => {
          optionsRegistry.value.set(String(value), label);
          optionsRegistry.value = new Map(optionsRegistry.value);
        },
        unregisterOption: (value: any) => {
          optionsRegistry.value.delete(String(value));
          optionsRegistry.value = new Map(optionsRegistry.value);
        },
      }
    : null,
);

const selectedLabels = computed(() => {
  if (!props.multiple || !Array.isArray(props.modelValue)) return '';
  const labels = props.modelValue.map((val) => {
    const labelFromRegistry = optionsRegistry.value.get(String(val));
    if (labelFromRegistry) return labelFromRegistry;
    const opt = props.options.find((o) => String(o.value) === String(val));
    return opt ? opt.label : String(val);
  });
  return labels.join(', ');
});
const hasDefaultSlot = computed(() => !!slots.default);

const singleSelectedLabel = computed(() => {
  if (props.multiple) return '';
  if (props.modelValue === undefined || props.modelValue === null || props.modelValue === '')
    return '';
  const labelFromRegistry = optionsRegistry.value.get(String(props.modelValue));
  if (labelFromRegistry) return labelFromRegistry;
  const opt = props.options.find((o) => String(o.value) === String(props.modelValue));
  return opt ? opt.label : '';
});
</script>

<template>
  <!-- Single Select using radix-vue SelectRoot -->
  <SelectRoot v-if="!multiple" v-model="val" :disabled="disabled" @update:open="handleOpenChange">
    <SelectTrigger
      aria-haspopup="listbox"
      class="select-trigger inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white/10 dark:bg-black/20 backdrop-blur-md text-[var(--text-primary)] hover:bg-white/20 dark:hover:bg-black/30 transition-all outline-none focus:border-[var(--accent)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 w-full"
      :class="[sizeClasses, props.class]"
    >
      <span class="truncate text-left flex-1 min-w-0 pr-2">
        <template v-if="singleSelectedLabel">{{ singleSelectedLabel }}</template>
        <SelectValue v-else :placeholder="placeholder" />
      </span>
      <div class="flex items-center gap-1 ml-2 shrink-0">
        <X
          v-if="showClear"
          class="w-3.5 h-3.5 opacity-50 hover:opacity-100 transition-opacity"
          @click="handleClear"
        />
        <ChevronDown class="w-4 h-4 opacity-50 shrink-0" />
      </div>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        class="z-[var(--z-popover)] min-w-[var(--radix-select-trigger-width)] glass-popover shadow-lg overflow-hidden"
        position="popper"
        :side-offset="4"
      >
        <SelectViewport class="p-1 max-h-60 overflow-y-auto">
          <slot />
          <template v-if="!hasDefaultSlot && options && options.length > 0">
            <SelectItem
              v-for="opt in options"
              :key="opt.value"
              :value="String(opt.value) === '' ? '____EMPTY_VALUE____' : String(opt.value)"
              :disabled="opt.disabled"
              class="relative flex items-center justify-between px-8 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer outline-none select-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:text-[var(--accent)] font-medium"
            >
              <SelectItemText>{{ opt.label }}</SelectItemText>
              <SelectItemIndicator class="absolute left-2 inline-flex items-center justify-center">
                <Check class="w-4 h-4 text-[var(--accent)]" />
              </SelectItemIndicator>
            </SelectItem>
          </template>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>

  <!-- Multiple Select using custom GlassPopover -->
  <GlassPopover
    v-else
    placement="bottom-start"
    class="w-full"
    popperClass="min-w-[var(--radix-select-trigger-width)] !p-1"
    :disabled="disabled"
  >
    <template #reference>
      <button
        type="button"
        class="inline-flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white/10 dark:bg-black/20 backdrop-blur-md text-[var(--text-primary)] hover:bg-white/20 dark:hover:bg-black/30 transition-all outline-none focus:border-[var(--accent)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 w-full text-left"
        :class="[sizeClasses, props.class]"
        :disabled="disabled"
      >
        <span class="truncate pr-4">
          {{ selectedLabels || placeholder }}
        </span>
        <div class="flex items-center gap-1 ml-auto shrink-0">
          <X
            v-if="showClear"
            class="w-3.5 h-3.5 opacity-50 hover:opacity-100 transition-opacity"
            @click="handleClear"
          />
          <ChevronDown class="w-4 h-4 opacity-50 shrink-0" />
        </div>
      </button>
    </template>

    <div class="p-1 max-h-60 overflow-y-auto min-w-[var(--radix-select-trigger-width)]">
      <slot />
      <template v-if="!hasDefaultSlot && options && options.length > 0">
        <div
          v-for="opt in options"
          :key="opt.value"
          @click="toggleMultipleOption(opt.value)"
          class="relative flex items-center justify-between px-8 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer outline-none select-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:text-[var(--accent)] font-medium"
          :data-state="multipleIsSelected(opt.value) ? 'checked' : 'unchecked'"
        >
          <span>{{ opt.label }}</span>
          <span
            v-if="multipleIsSelected(opt.value)"
            class="absolute left-2 inline-flex items-center justify-center"
          >
            <Check class="w-4 h-4 text-[var(--accent)]" />
          </span>
        </div>
      </template>
    </div>
  </GlassPopover>
</template>

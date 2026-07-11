<script setup lang="ts">
import { SelectItem, SelectItemText, SelectItemIndicator } from 'radix-vue';
import { Check } from 'lucide-vue-next';
import { useSlots, inject, onMounted, onBeforeUnmount } from 'vue';

interface Props {
  label?: string;
  value: string | number | boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  disabled: false,
});

const slots = useSlots();
const hasSlot = Boolean(slots.default);

const multipleContext = inject<any>('custom-select-multiple', null);

onMounted(() => {
  if (multipleContext?.registerOption) {
    multipleContext.registerOption(props.value, props.label);
  }
});

onBeforeUnmount(() => {
  if (multipleContext?.unregisterOption) {
    multipleContext.unregisterOption(props.value);
  }
});
</script>

<template>
  <!-- Render custom div if multiple selection context is active -->
  <div
    v-if="multipleContext"
    @click="multipleContext.toggle(value)"
    class="relative flex items-center justify-between px-8 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer outline-none select-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:text-[var(--accent)] font-medium"
    :data-state="multipleContext.isSelected(value) ? 'checked' : 'unchecked'"
  >
    <span>
      <slot v-if="hasSlot" />
      <span v-else>{{ label }}</span>
    </span>
    <span
      v-if="multipleContext.isSelected(value)"
      class="absolute left-2 inline-flex items-center justify-center"
    >
      <Check class="w-4 h-4 text-[var(--accent)]" />
    </span>
  </div>

  <!-- Otherwise fall back to radix-vue SelectItem for single select -->
  <SelectItem
    v-else
    :value="String(value)"
    :disabled="disabled"
    class="relative flex items-center justify-between px-8 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer outline-none select-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:text-[var(--accent)] font-medium"
  >
    <SelectItemText>
      <slot v-if="hasSlot" />
      <span v-else>{{ label }}</span>
    </SelectItemText>
    <SelectItemIndicator class="absolute left-2 inline-flex items-center justify-center">
      <Check class="w-4 h-4 text-[var(--accent)]" />
    </SelectItemIndicator>
  </SelectItem>
</template>

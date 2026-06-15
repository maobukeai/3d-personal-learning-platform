<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUpdate } from 'vue';

interface TabOption {
  label?: string;
  value: any;
  icon?: any;
  badge?: number | string;
}

interface Props {
  options: readonly TabOption[];
  modelValue: any;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'solid';
  direction?: 'horizontal' | 'vertical';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default',
  direction: 'horizontal',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void;
  (e: 'change', value: any): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const activeTabRef = ref<HTMLElement[]>([]);
const sliderStyle = ref({
  width: '0px',
  height: '0px',
  left: '0px',
  top: '0px',
  opacity: 0,
});

const selectTab = (value: any, index: number) => {
  emit('update:modelValue', value);
  emit('change', value);
  updateSlider(index);
};

const updateSlider = (index?: number) => {
  const activeIdx =
    index !== undefined ? index : props.options.findIndex((o) => o.value === props.modelValue);
  if (activeIdx === -1) {
    sliderStyle.value.opacity = 0;
    return;
  }

  const el = activeTabRef.value[activeIdx];
  if (el && containerRef.value) {
    const containerRect = containerRef.value.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    if (props.direction === 'vertical') {
      sliderStyle.value = {
        width: '',
        left: '',
        top: `${elRect.top - containerRect.top}px`,
        height: `${elRect.height}px`,
        opacity: 1,
      };
    } else {
      sliderStyle.value = {
        width: `${elRect.width}px`,
        left: `${elRect.left - containerRect.left}px`,
        top: '',
        height: '',
        opacity: 1,
      };
    }
  }
};

onBeforeUpdate(() => {
  activeTabRef.value = [];
});

watch(
  [() => props.modelValue, () => props.options],
  () => {
    // Let the DOM update first
    setTimeout(() => updateSlider(), 50);
  },
  { deep: true },
);

onMounted(() => {
  setTimeout(() => updateSlider(), 100);
});
</script>

<template>
  <div
    ref="containerRef"
    class="relative p-0.5 rounded-xl glass-panel border border-white/20 dark:border-white/10 select-none overflow-hidden"
    :class="
      direction === 'vertical'
        ? 'flex flex-col gap-0.5 w-full'
        : 'relative inline-flex items-center gap-0.5'
    "
  >
    <!-- Sliding pill background -->
    <div
      class="absolute rounded-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-0 pointer-events-none"
      :class="[
        variant === 'solid'
          ? 'bg-accent shadow-md shadow-accent/20'
          : 'bg-white/60 dark:bg-white/10 shadow-sm border border-white/40 dark:border-white/5',
        direction === 'vertical' ? 'left-0.5 right-0.5' : 'top-0.5 bottom-0.5',
      ]"
      :style="sliderStyle"
    ></div>

    <!-- Tab buttons -->
    <button
      v-for="(option, index) in options"
      :key="option.value"
      ref="activeTabRef"
      type="button"
      class="relative z-10 flex items-center gap-1.5 font-bold tracking-tight rounded-lg transition-colors duration-200 outline-none focus:outline-none"
      :class="[
        size === 'sm'
          ? 'px-2.5 py-1 text-xs'
          : size === 'lg'
            ? 'px-4 py-2 text-base'
            : 'px-3 py-1.5 text-sm',
        modelValue === option.value
          ? variant === 'solid'
            ? 'text-white'
            : 'text-accent dark:text-white'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
        direction === 'vertical' ? 'w-full justify-between' : 'shrink-0 justify-center',
      ]"
      @click="selectTab(option.value, index)"
    >
      <div class="flex items-center gap-1.5">
        <component :is="option.icon" v-if="option.icon" class="w-4 h-4 shrink-0" />
        <span v-if="option.label">{{ option.label }}</span>
      </div>
      <span
        v-if="
          option.badge !== undefined &&
          option.badge !== null &&
          option.badge !== 0 &&
          option.badge !== '0'
        "
        class="px-1.5 py-0.5 text-[10px] font-black leading-none rounded-full min-w-[16px] h-4 inline-flex items-center justify-center shrink-0 transition-colors"
        :class="
          modelValue === option.value
            ? 'bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-foreground'
            : 'bg-black/5 dark:bg-white/10 text-[var(--text-secondary)]'
        "
      >
        {{ option.badge }}
      </span>
    </button>
  </div>
</template>

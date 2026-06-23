<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, type Component } from 'vue';

type SegmentValue = string | number | null;

interface SegmentOption {
  id?: SegmentValue;
  value?: SegmentValue;
  label: string;
  icon?: Component;
  textColor?: string;
}

interface Props {
  options: readonly SegmentOption[];
  modelValue: SegmentValue;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  fullWidth: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: SegmentValue): void;
  (e: 'change', value: SegmentValue): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const activeTabRef = ref<HTMLElement[]>([]);
const sliderStyle = ref({
  width: '0px',
  left: '0px',
  opacity: 0,
});

let resizeObserver: ResizeObserver | null = null;

const getOptionValue = (option: SegmentOption): SegmentValue | undefined => {
  return option.id !== undefined ? option.id : option.value;
};

const selectTab = (value: SegmentValue | undefined, index: number) => {
  if (value === undefined) return;
  emit('update:modelValue', value);
  emit('change', value);
  updateSlider(index);
};

const setTabRef = (el: unknown, index: number) => {
  if (el) {
    const node = (el as Element & { $el?: Element })?.$el ?? (el as Element);
    if (node) {
      activeTabRef.value[index] = node as HTMLElement;
    }
  }
};

const updateSlider = (index?: number) => {
  const activeIdx =
    index !== undefined
      ? index
      : props.options.findIndex((o) => getOptionValue(o) === props.modelValue);

  if (activeIdx === -1) {
    sliderStyle.value.opacity = 0;
    return;
  }

  nextTick(() => {
    const el = activeTabRef.value[activeIdx];
    const container = containerRef.value;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      // Calculate left offset relative to container border box
      // Subtracting 1px for border alignment if needed, matching Tabs.vue layout
      sliderStyle.value = {
        width: `${elRect.width}px`,
        left: `${elRect.left - containerRect.left}px`,
        opacity: 1,
      };
    }
  });
};

watch(
  () => props.modelValue,
  () => {
    // Let the DOM update first
    setTimeout(() => updateSlider(), 50);
  },
);

watch(
  () => props.options,
  () => {
    activeTabRef.value = [];
    setTimeout(() => updateSlider(), 50);
  },
  { deep: true },
);

onMounted(() => {
  setTimeout(() => {
    updateSlider();

    // Set up ResizeObserver to handle width changes
    if (containerRef.value && typeof window !== 'undefined' && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        updateSlider();
      });
      resizeObserver.observe(containerRef.value);
    }
  }, 100);
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<template>
  <div
    ref="containerRef"
    class="relative items-center p-0.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/30 select-none overflow-x-auto scrollbar-hide shrink-0"
    :class="fullWidth ? 'flex w-full' : 'inline-flex'"
  >
    <!-- Sliding pill background -->
    <div
      class="absolute top-0.5 bottom-0.5 bg-white dark:bg-slate-700 rounded-md shadow-sm border border-slate-200/40 dark:border-slate-600/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-0 pointer-events-none"
      :style="sliderStyle"
    ></div>

    <!-- Segment buttons -->
    <button
      v-for="(option, index) in options"
      :key="getOptionValue(option) === null ? 'null' : (getOptionValue(option) ?? index)"
      :ref="(el) => setTabRef(el, index)"
      type="button"
      class="relative z-10 flex items-center justify-center gap-1 font-semibold rounded-md transition-colors duration-200 outline-none focus:outline-none cursor-pointer"
      :class="[
        size === 'sm'
          ? 'px-2.5 py-0.5 text-[10px] sm:text-xs'
          : size === 'lg'
            ? 'px-4 py-2 text-sm sm:text-base'
            : 'px-3 py-1.5 text-xs sm:text-sm',
        fullWidth ? 'flex-1' : 'shrink-0',
        modelValue === getOptionValue(option)
          ? option.textColor || 'text-purple-600 dark:text-purple-300'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
      ]"
      @click="selectTab(getOptionValue(option), index)"
    >
      <component
        :is="option.icon"
        v-if="option.icon"
        class="w-3.5 h-3.5 shrink-0 transition-colors"
        :class="
          modelValue === getOptionValue(option)
            ? option.textColor || 'text-purple-600 dark:text-purple-300'
            : 'text-slate-400 dark:text-slate-500'
        "
      />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
/* Ensure no tap highlight color on mobile devices */
button {
  -webkit-tap-highlight-color: transparent;
}
</style>

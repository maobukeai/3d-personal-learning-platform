<script setup lang="ts">
import { computed } from 'vue';
import { BookOpen, ChevronRight } from 'lucide-vue-next';
import BaseCard from '@/components/BaseCard.vue';

interface RoadmapCardItem {
  id: string;
  title?: string;
  description?: string | null;
  steps?: unknown[];
}

const props = withDefaults(
  defineProps<{
    roadmap: RoadmapCardItem;
    active?: boolean;
    progress?: number;
  }>(),
  {
    active: false,
    progress: 0,
  },
);

defineEmits<{
  (e: 'click'): void;
}>();

const circumference = 2 * Math.PI * 16;

const progressOffset = computed(() => {
  return circumference - (props.progress / 100) * circumference;
});
</script>

<template>
  <BaseCard
    clickable
    :hoverable="!active"
    padding="none"
    class="group p-1.5 md:p-4 shrink-0 w-32 sm:w-48 md:w-full !overflow-hidden"
    :class="
      active
        ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-lg shadow-emerald-500/5'
        : 'border-transparent'
    "
    @click="$emit('click')"
  >
    <div class="relative z-10">
      <div class="flex items-start justify-between mb-0.5 md:mb-2">
        <h3
          class="text-[9px] md:text-sm font-bold truncate md:whitespace-normal"
          :class="
            active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
          "
        >
          {{ roadmap.title }}
        </h3>
        <!-- Progress Ring -->
        <div class="relative w-3.5 h-3.5 md:w-8 md:h-8 shrink-0 ml-1 md:ml-2">
          <svg class="w-3.5 h-3.5 md:w-8 md:h-8 -rotate-90" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              class="text-slate-100 dark:text-white/10"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              :class="progress === 100 ? 'text-emerald-500' : 'text-accent'"
              class="transition-all duration-700"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="progressOffset"
            />
          </svg>
          <span
            class="absolute inset-0 flex items-center justify-center text-[4px] md:text-[7px] font-black"
            :class="progress === 100 ? 'text-emerald-600' : 'text-accent'"
          >
            {{ progress }}
          </span>
        </div>
      </div>

      <p
        class="hidden sm:block text-[7px] md:text-[10px] line-clamp-1 md:line-clamp-2 mb-1 md:mb-3"
        style="color: var(--text-secondary)"
      >
        {{ roadmap.description }}
      </p>

      <div class="flex items-center justify-between">
        <div
          class="flex items-center gap-1 text-[7px] md:text-[10px] font-bold"
          style="color: var(--text-muted)"
        >
          <BookOpen class="w-2 h-2 md:w-3 md:h-3" />
          {{ roadmap.steps?.length || 0 }}
          <span class="hidden xs:inline">个阶段</span>
        </div>
      </div>

      <div
        class="mt-1.5 md:mt-3 w-full h-0.5 md:h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden"
      >
        <div
          class="h-full rounded-full transition-all duration-700"
          :class="progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
    </div>

    <ChevronRight
      class="absolute top-1/2 -translate-y-1/2 -right-2 w-6 h-6 md:w-12 md:h-12 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors"
    />
  </BaseCard>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

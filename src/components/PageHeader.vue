<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    icon?: any; // Lucide icon component
    iconClass?: string;
    iconContainerClass?: string;
  }>(),
  {
    iconClass: 'text-accent',
    iconContainerClass: 'p-2.5 bg-accent-subtle rounded-xl shrink-0',
  }
);

const hasIcon = computed(() => !!props.icon);
</script>

<template>
  <div
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 sm:py-4 px-4 sm:px-6 lg:px-8 shrink-0 border-b transition-colors duration-300"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div class="flex items-center gap-3">
      <div v-if="hasIcon" :class="iconContainerClass">
        <component :is="icon" class="w-5 h-5" :class="iconClass" />
      </div>
      <div>
        <h1
          class="text-lg md:text-xl font-bold leading-tight"
          style="color: var(--text-primary)"
        >
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="text-[10px] font-medium mt-0.5"
          style="color: var(--text-muted)"
        >
          {{ subtitle }}
        </p>
      </div>
    </div>

    <!-- Actions / Filters slot -->
    <div class="flex flex-row items-center gap-2 sm:gap-3">
      <slot />
    </div>
  </div>
</template>

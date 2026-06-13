<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    icon?: Component;
    iconClass?: string;
    iconContainerClass?: string;
  }>(),
  {
    subtitle: '',
    icon: undefined,
    iconClass: 'text-accent',
    iconContainerClass: 'p-2 bg-accent-subtle rounded-lg shrink-0 border border-accent/10',
  }
);

const hasIcon = computed(() => !!props.icon);
</script>

<template>
  <div
    class="enterprise-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8 shrink-0 transition-colors duration-300"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div class="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
      <div v-if="hasIcon" :class="iconContainerClass" class="shrink-0">
        <component :is="icon" class="w-3.5 h-3.5 sm:w-4 sm:h-4" :class="iconClass" />
      </div>
      <div class="min-w-0">
        <h1
          class="text-sm sm:text-lg font-bold leading-tight truncate"
          style="color: var(--text-primary)"
        >
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="block text-[10px] sm:text-xs font-medium mt-0.5 line-clamp-1"
          style="color: var(--text-muted)"
        >
          {{ subtitle }}
        </p>
      </div>
    </div>

    <!-- Actions / Filters slot -->
    <div class="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto scrollbar-hide">
      <slot />
    </div>
  </div>
</template>

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
    iconContainerClass: 'p-1.5 bg-accent-subtle rounded-xl shrink-0 border border-accent/10',
  }
);

const hasIcon = computed(() => !!props.icon);
</script>

<template>
  <div
    class="flex flex-row items-center justify-between gap-2 py-1.5 sm:py-2 px-3 sm:px-6 lg:px-8 shrink-0 border-b transition-colors duration-300"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div class="flex items-center gap-2 sm:gap-3 min-w-0">
      <div v-if="hasIcon" :class="iconContainerClass" class="shrink-0">
        <component :is="icon" class="w-3.5 h-3.5 sm:w-4 sm:h-4" :class="iconClass" />
      </div>
      <div class="min-w-0">
        <h1
          class="text-xs sm:text-md font-bold leading-tight truncate"
          style="color: var(--text-primary)"
        >
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="hidden sm:block text-[9px] sm:text-[10px] font-medium mt-0.5"
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

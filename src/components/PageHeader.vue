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
    variant?: 'flat' | 'card';
  }>(),
  {
    subtitle: '',
    icon: undefined,
    iconClass: 'text-accent',
    iconContainerClass: 'p-2 bg-accent-subtle rounded-lg shrink-0 border border-accent/10',
    variant: 'flat',
  },
);

const hasIcon = computed(() => !!props.icon);
</script>

<template>
  <div
    v-if="variant === 'flat'"
    class="enterprise-toolbar h-auto sm:h-13 px-4 sm:px-6 lg:px-8 py-3 sm:py-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b transition-colors duration-300"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div class="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
      <div v-if="hasIcon" :class="iconContainerClass" class="shrink-0">
        <component :is="icon" class="w-3.5 h-3.5 sm:w-4 sm:h-4" :class="iconClass" />
      </div>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1
            class="text-sm sm:text-lg font-bold leading-tight truncate"
            style="color: var(--text-primary)"
          >
            {{ title }}
          </h1>
          <slot name="title-badge" />
        </div>
        <p
          v-if="subtitle"
          class="block text-[10px] sm:text-xs font-medium mt-0.5 line-clamp-1"
          style="color: var(--text-muted)"
        >
          {{ subtitle }}
        </p>
      </div>
    </div>

    <!-- Center: Optional Center Content (e.g. Search Box) -->
    <div
      v-if="$slots.center"
      class="flex-1 w-full sm:max-w-xs md:max-w-md mx-auto flex items-center justify-center sm:px-4"
    >
      <slot name="center" />
    </div>

    <!-- Actions / Filters slot -->
    <div
      class="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto scrollbar-hide"
    >
      <slot />
    </div>
  </div>

  <div
    v-else-if="variant === 'card'"
    class="premium-card rounded-xl border bg-card border-base shadow-card p-3 sm:py-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0"
  >
    <div class="flex items-center gap-3 min-w-0 sm:flex-1">
      <div class="min-w-0">
        <p
          v-if="subtitle"
          class="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1"
          style="color: var(--text-muted)"
        >
          {{ subtitle }}
        </p>
        <div class="flex items-center gap-2">
          <h1
            class="text-sm sm:text-lg font-bold leading-tight truncate text-[var(--text-primary)]"
          >
            {{ title }}
          </h1>
          <slot name="title-badge" />
        </div>
      </div>
    </div>

    <!-- Center: Optional Center Content (e.g. Search Box) -->
    <div
      v-if="$slots.center"
      class="flex-1 w-full sm:max-w-xs md:max-w-md mx-auto flex items-center justify-center sm:px-4"
    >
      <slot name="center" />
    </div>

    <!-- Actions / Filters slot -->
    <div
      class="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto scrollbar-hide sm:flex-1 justify-end"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.premium-card {
  box-sizing: border-box;
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
    var(--shadow-card);
}

.dark .premium-card {
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.05),
    var(--shadow-card);
}

/* Overrides to prevent mobile-compact.css from squishing header components */
.enterprise-toolbar,
.enterprise-toolbar > *,
.enterprise-toolbar .shrink-0,
.premium-card,
.premium-card > *,
.premium-card .shrink-0 {
  flex-shrink: 0 !important;
}

.enterprise-toolbar :deep(button),
.enterprise-toolbar :deep(a),
.premium-card :deep(button),
.premium-card :deep(a) {
  flex-shrink: 0 !important;
}

.enterprise-toolbar .min-w-0,
.premium-card .min-w-0 {
  flex-shrink: 1 !important;
}
</style>

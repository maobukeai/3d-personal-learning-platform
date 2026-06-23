<script setup lang="ts">
import { type Component } from 'vue';

defineProps<{
  icon: Component;
  title: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="flex-1 flex flex-col items-center justify-center p-6 text-center mobile-adaptive"
    style="background-color: var(--bg-app)"
  >
    <div class="w-16 h-16 bg-accent/5 rounded-full flex items-center justify-center mb-4 shrink-0">
      <component :is="icon" class="w-8 h-8 text-accent opacity-20" />
    </div>
    <h2 class="text-lg font-bold mb-1.5" style="color: var(--text-primary)">
      {{ title }}
    </h2>
    <p
      v-if="description"
      class="text-xs max-w-xs mx-auto mb-6"
      style="color: var(--text-secondary)"
    >
      {{ description }}
    </p>
    <div class="flex gap-3 justify-center mobile-row">
      <slot />
    </div>
  </div>
</template>

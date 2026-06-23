<script setup lang="ts">
import type { Component } from 'vue';

interface Props {
  icon: Component;
  title: string;
  description?: string;
  actionText?: string;
  actionDisabled?: boolean;
  size?: 'default' | 'small';
}

withDefaults(defineProps<Props>(), {
  description: '',
  actionText: '',
  actionDisabled: false,
  size: 'default',
});

const emit = defineEmits<{
  (e: 'action'): void;
}>();
</script>

<template>
  <div
    class="empty-state flex flex-col items-center justify-center rounded-2xl border text-center"
    :class="{
      'py-20': size === 'default',
      'py-12 px-4': size === 'small',
      'py-16': size === 'default',
    }"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div
      class="empty-icon rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4"
      :class="{ 'w-16 h-16': size === 'default', 'w-12 h-12': size === 'small' }"
    >
      <component
        :is="icon"
        :class="{
          'w-8 h-8': size === 'default',
          'w-6 h-6': size === 'small',
        }"
        class="text-slate-300 dark:text-slate-600"
      />
    </div>
    <p
      class="font-bold text-slate-400 mb-1"
      :class="{ 'text-sm': size === 'default', 'text-xs': size === 'small' }"
    >
      {{ title }}
    </p>
    <p v-if="description" class="text-xs text-slate-400 mb-4">{{ description }}</p>
    <button
      v-if="actionText"
      type="button"
      :disabled="actionDisabled"
      class="empty-action flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      @click="emit('action')"
    >
      {{ actionText }}
    </button>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .empty-state {
    margin: 0 0.75rem 0.75rem;
    padding: 1.5rem 0.75rem !important;
    border-radius: 12px;
  }

  .empty-icon {
    width: 2.75rem;
    height: 2.75rem;
    margin-bottom: 0.75rem;
  }
}
</style>

<script setup lang="ts">
import type { Component } from 'vue';
import { AlertTriangle, Inbox, LockKeyhole, RefreshCw } from 'lucide-vue-next';
import { computed } from 'vue';

interface Props {
  icon?: Component;
  title: string;
  description?: string;
  actionText?: string;
  actionDisabled?: boolean;
  size?: 'default' | 'small';
  state?: 'empty' | 'loading' | 'error' | 'forbidden';
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  actionText: '',
  actionDisabled: false,
  size: 'default',
  state: 'empty',
});

const stateIcon = computed(() => {
  if (props.icon) return props.icon;
  if (props.state === 'loading') return RefreshCw;
  if (props.state === 'error') return AlertTriangle;
  if (props.state === 'forbidden') return LockKeyhole;
  return Inbox;
});

const emit = defineEmits<{
  (e: 'action'): void;
}>();
</script>

<template>
  <div
    class="empty-state flex flex-col items-center justify-center rounded-[var(--radius-section)] border text-center"
    :class="{
      'py-20': size === 'default',
      'py-12 px-4': size === 'small',
      'py-16': size === 'default',
      'empty-state--loading': state === 'loading',
      'empty-state--error': state === 'error',
      'empty-state--forbidden': state === 'forbidden',
    }"
    role="status"
    :aria-live="state === 'loading' ? 'polite' : 'off'"
  >
    <div
      class="empty-icon rounded-[var(--radius-field)] bg-[var(--bg-subtle)] border border-[var(--border-base)] flex items-center justify-center mb-4"
      :class="{ 'w-16 h-16': size === 'default', 'w-12 h-12': size === 'small' }"
    >
      <component
        :is="stateIcon"
        :class="{
          'w-8 h-8': size === 'default',
          'w-6 h-6': size === 'small',
          'animate-spin': state === 'loading',
        }"
        class="text-[var(--text-muted)]"
      />
    </div>
    <p
      class="font-semibold text-[var(--text-primary)] mb-1"
      :class="{ 'text-sm': size === 'default', 'text-xs': size === 'small' }"
    >
      {{ title }}
    </p>
    <p v-if="description" class="text-xs text-[var(--text-muted)] mb-4">{{ description }}</p>
    <button
      v-if="actionText"
      type="button"
      :disabled="actionDisabled"
      class="empty-action flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-[var(--radius-field)] text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      @click="emit('action')"
    >
      {{ actionText }}
    </button>
  </div>
</template>

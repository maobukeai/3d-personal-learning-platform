<script setup lang="ts">
import type { Component } from 'vue';
import { AlertCircle, RefreshCw } from 'lucide-vue-next';
interface Props {
  message?: string;
  detail?: string;
  icon?: Component;
}
const props = withDefaults(defineProps<Props>(), {
  message: 'Something went wrong',
  detail: '',
  icon: AlertCircle,
});
const emit = defineEmits<{ (e: 'retry'): void }>();
</script>
<template>
  <div
    class="error-state flex flex-col items-center justify-center rounded-2xl border text-center py-16 px-4"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
    role="alert"
    aria-live="assertive"
  >
    <div
      class="error-icon rounded-2xl flex items-center justify-center mb-4 w-16 h-16"
      style="background-color: color-mix(in srgb, var(--danger) 10%, transparent)"
    >
      <component :is="props.icon" class="w-8 h-8" :style="{ color: 'var(--danger)' }" />
    </div>
    <p class="font-bold text-base mb-1" style="color: var(--text-primary)">{{ props.message }}</p>
    <p v-if="props.detail" class="text-xs mb-4 max-w-md" style="color: var(--text-muted)">
      {{ props.detail }}
    </p>
    <button
      type="button"
      class="error-retry inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all"
      @click="emit('retry')"
    >
      <RefreshCw class="w-3.5 h-3.5" /> Try again
    </button>
  </div>
</template>

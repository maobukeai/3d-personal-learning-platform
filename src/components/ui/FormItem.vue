<script setup lang="ts">
interface Props {
  label?: string;
  required?: boolean;
  error?: string;
}

withDefaults(defineProps<Props>(), { label: '', required: false, error: '' });
</script>

<template>
  <div class="mb-4">
    <label v-if="label" class="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
      {{ label }}<span v-if="required" class="ml-1 text-[var(--danger)]">*</span>
    </label>
    <slot />
    <p v-if="error" class="mt-1 text-xs text-[var(--danger)]">{{ error }}</p>
  </div>
</template>

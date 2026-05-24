<script setup lang="ts">
import { computed } from 'vue';
import { sanitizeHtml } from '@/utils/sanitize';

interface Props {
  html: string;
  tag?: string;
}

const props = withDefaults(defineProps<Props>(), {
  tag: 'div',
});

const sanitized = computed(() => sanitizeHtml(props.html || ''));
</script>

<!-- eslint-disable vue/no-v-html -->
<template>
  <span v-if="tag === 'span'" v-html="sanitized" />
  <p v-else-if="tag === 'p'" v-html="sanitized" />
  <div v-else-if="tag === 'div'" v-html="sanitized" />
  <!-- Fallback to div for other tags to avoid v-html on dynamic component -->
  <div v-else v-html="sanitized" />
</template>

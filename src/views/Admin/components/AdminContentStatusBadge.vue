<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue';

type ContentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const props = defineProps<{
  status: ContentStatus | string;
}>();

const LABELS: Record<ContentStatus, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已打回',
};

const VARIANTS: Record<ContentStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const normalized = () =>
  (props.status as ContentStatus) in LABELS ? (props.status as ContentStatus) : null;
</script>

<template>
  <Badge v-if="normalized()" :variant="VARIANTS[normalized()!]">
    {{ LABELS[normalized()!] }}
  </Badge>
  <Badge v-else variant="info">{{ status }}</Badge>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { SoftwareItem } from '../softwaresSchema';
const UnifiedDetailModal = defineAsyncComponent(() => import('./UnifiedDetailModal.vue'));
defineProps<{
  show: boolean;
  item: SoftwareItem | null;
  isFavorited: boolean;
  isDownloading: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  isSavingReview: boolean;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'favorite'): void;
  (e: 'download'): void;
  (e: 'edit', software: SoftwareItem): void;
  (e: 'delete', software: SoftwareItem): void;
  (e: 'review-approved', software: SoftwareItem): void;
  (e: 'review-rejected', software: SoftwareItem): void;
  (e: 'update'): void;
}>();
</script>
<template>
  <UnifiedDetailModal
    v-if="show"
    :show="show"
    :item="item"
    kind="software"
    :is-favorited="isFavorited"
    :is-downloading="isDownloading"
    :is-admin="isAdmin"
    :can-edit="canEdit"
    :is-saving-review="isSavingReview"
    @close="emit('close')"
    @favorite="emit('favorite')"
    @download="emit('download')"
    @edit="emit('edit', $event)"
    @delete="emit('delete', $event)"
    @review-approved="emit('review-approved', $event)"
    @review-rejected="emit('review-rejected', $event)"
    @update="emit('update')"
  />
</template>

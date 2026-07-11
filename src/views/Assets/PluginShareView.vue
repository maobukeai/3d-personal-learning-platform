<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import BaseShareView from './components/BaseShareView.vue';
const UnifiedDetailModal = defineAsyncComponent(
  () => import('./components/UnifiedDetailModal.vue'),
);
</script>

<template>
  <BaseShareView resource-type="plugins">
    <template #default="{ resource }">
      <UnifiedDetailModal :item="resource" kind="plugin" inline />
    </template>
  </BaseShareView>
</template>

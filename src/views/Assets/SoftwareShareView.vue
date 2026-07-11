<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import BaseShareView from './components/BaseShareView.vue';
const UnifiedDetailModal = defineAsyncComponent(
  () => import('./components/UnifiedDetailModal.vue'),
);
</script>

<template>
  <BaseShareView resource-type="softwares">
    <template #default="{ resource }">
      <UnifiedDetailModal :item="resource" kind="software" inline />
    </template>
  </BaseShareView>
</template>

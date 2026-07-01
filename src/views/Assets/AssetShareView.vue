<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import BaseShareView from './components/BaseShareView.vue';
const AssetDetailModal = defineAsyncComponent(() => import('./components/AssetDetailModal.vue'));
</script>

<template>
  <BaseShareView resource-type="assets" track-expires-at>
    <template #default="{ resource }">
      <AssetDetailModal :preloaded-asset="resource" inline />
    </template>
  </BaseShareView>
</template>

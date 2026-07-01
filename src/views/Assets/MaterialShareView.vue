<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import BaseShareView from './components/BaseShareView.vue';
const MaterialDetailPanel = defineAsyncComponent(
  () => import('./components/MaterialDetailPanel.vue'),
);
</script>

<template>
  <BaseShareView resource-type="materials" responsive-row>
    <template #default="{ resource, loading }">
      <MaterialDetailPanel :material="resource" :loading="loading" inline />
    </template>
  </BaseShareView>
</template>

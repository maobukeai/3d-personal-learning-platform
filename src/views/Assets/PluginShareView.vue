<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import BaseShareView from './components/BaseShareView.vue';
const PluginDetailModal = defineAsyncComponent(() => import('./components/PluginDetailModal.vue'));
</script>

<template>
  <BaseShareView resource-type="plugins">
    <template #default="{ resource }">
      <PluginDetailModal :plugin="resource" inline />
    </template>
  </BaseShareView>
</template>

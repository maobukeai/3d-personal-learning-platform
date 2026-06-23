<script setup lang="ts">
import { ChevronDown, Download, PackageCheck } from 'lucide-vue-next';
import UiButton from '@/components/ui/Button.vue';

const emit = defineEmits<{
  download: [];
  openInBlender: [];
}>();
</script>

<template>
  <div class="detail-actions">
    <UiButton variant="primary" :icon="Download" @click="emit('download')">下载资源</UiButton>
    <UiButton variant="secondary" :icon="PackageCheck" @click="emit('openInBlender')">
      在 Blender 中打开
      <ChevronDown class="h-4 w-4" />
    </UiButton>
  </div>
</template>

<style scoped>
.detail-actions {
  display: grid;
  gap: 12px;
}
</style>

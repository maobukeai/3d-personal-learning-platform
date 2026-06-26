<script setup lang="ts">
import { ChevronDown, Download, PackageCheck } from 'lucide-vue-next';
import UiButton from '@/components/ui/Button.vue';

defineProps<{
  hasPackage?: boolean;
}>();

const emit = defineEmits<{
  download: [];
  downloadPackage: [];
  openInBlender: [];
}>();
</script>

<template>
  <div class="detail-actions">
    <UiButton variant="primary" :icon="Download" @click="emit('download')">
      下载预览模型 (.glb)
    </UiButton>
    <UiButton
      v-if="hasPackage"
      variant="primary"
      class="!bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600"
      :icon="Download"
      @click="emit('downloadPackage')"
    >
      下载完整资源包 (.zip)
    </UiButton>
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

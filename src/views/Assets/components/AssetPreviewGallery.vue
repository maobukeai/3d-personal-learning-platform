<script setup lang="ts">
defineProps<{
  previewItems: Array<{ id: string; label: string; url: string }>;
}>();
</script>

<template>
  <div class="preview-panel">
    <article v-for="item in previewItems" :key="item.id">
      <img :src="item.url" :alt="item.label" />
      <strong>{{ item.label }}</strong>
    </article>
  </div>
</template>

<style scoped>
.preview-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.preview-panel article {
  overflow: hidden;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
}

.preview-panel img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.preview-panel strong {
  display: block;
  padding: 10px;
  font-size: 13px;
}

@media (max-width: 760px) {
  .preview-panel {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { Globe, Lock, Layers, Trash2 } from 'lucide-vue-next';
import UiButton from '@/components/ui/Button.vue';

const props = defineProps<{
  selectedCount: number;
}>();

const emit = defineEmits<{
  (e: 'set-public'): void;
  (e: 'set-private'): void;
  (e: 'set-category'): void;
  (e: 'delete'): void;
}>();
</script>

<template>
  <section class="batch-bar">
    <span>已选择 {{ props.selectedCount }} 个团队</span>
    <div class="batch-actions mobile-row">
      <UiButton variant="secondary" :icon="Globe" @click="emit('set-public')">设为公开</UiButton>
      <UiButton variant="secondary" :icon="Lock" @click="emit('set-private')">设为私有</UiButton>
      <UiButton variant="secondary" :icon="Layers" @click="emit('set-category')">分类</UiButton>
      <UiButton variant="danger" :icon="Trash2" @click="emit('delete')">解散</UiButton>
    </div>
  </section>
</template>

<style scoped>
.batch-bar {
  min-height: 46px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #334155;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>

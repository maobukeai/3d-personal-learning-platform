<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue';

interface Props {
  show: boolean;
  imageUrl: string;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();
</script>

<template>
  <Modal :show="show" size="xl" padding="none" @close="emit('update:show', false)">
    <div class="flex items-center justify-center p-2">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        class="max-w-full max-h-[80vh] rounded-xl object-contain"
      />
    </div>
  </Modal>
</template>

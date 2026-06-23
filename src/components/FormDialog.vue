<script setup lang="ts">
import { computed } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';

interface Props {
  visible: boolean;
  title?: string;
  width?: string | number;
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
  showFooter?: boolean;
  closeOnClickModal?: boolean;
  confirmDisabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '560px',
  loading: false,
  confirmText: 'common.save',
  cancelText: 'common.cancel',
  showFooter: true,
  closeOnClickModal: false,
  confirmDisabled: false,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit'): void;
  (e: 'cancel'): void;
}>();

const modalSize = computed(() => {
  if (!props.width) return 'md';
  const w = typeof props.width === 'number' ? props.width : parseInt(props.width, 10);
  if (isNaN(w)) return 'md';
  if (w <= 450) return 'sm';
  if (w <= 650) return 'md';
  if (w <= 900) return 'lg';
  if (w <= 1200) return 'xl';
  return 'xxl';
});
</script>

<template>
  <Modal
    :show="visible"
    :title="title"
    :size="modalSize"
    :close-on-outside-click="closeOnClickModal"
    @close="emit('cancel'); emit('update:visible', false)"
  >
    <div class="py-1">
      <slot />
    </div>

    <template v-if="showFooter" #footer>
      <div class="flex items-center justify-end gap-3 w-full">
        <slot name="extra-actions" />
        <button
          type="button"
          class="px-5 py-2.5 rounded-xl text-xs font-bold border transition-colors hover:bg-[var(--bg-hover)] cursor-pointer"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          :disabled="loading"
          @click="emit('cancel'); emit('update:visible', false)"
        >
          {{ $t(cancelText) }}
        </button>
        <button
          type="button"
          class="px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-white transition-all hover:shadow-lg hover:shadow-accent/20 disabled:opacity-60 flex items-center justify-center cursor-pointer"
          :disabled="loading || confirmDisabled"
          @click="emit('submit')"
        >
          <Loader2 v-if="loading" class="w-3.5 h-3.5 spinning inline mr-1.5" />
          {{ $t(confirmText) }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

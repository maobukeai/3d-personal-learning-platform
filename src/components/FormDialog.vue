<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';

interface Props {
  visible: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen' | 'presentation';
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
  showFooter?: boolean;
  closeOnClickModal?: boolean;
  confirmDisabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: '',
  size: 'md',
  loading: false,
  confirmText: 'common.save',
  cancelText: 'common.cancel',
  showFooter: true,
  closeOnClickModal: true,
  confirmDisabled: false,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit'): void;
  (e: 'cancel'): void;
}>();
</script>

<template>
  <Modal
    :show="visible"
    :title="title"
    :size="size"
    :close-on-outside-click="closeOnClickModal"
    @close="
      emit('cancel');
      emit('update:visible', false);
    "
  >
    <div class="py-1">
      <slot />
    </div>

    <template v-if="showFooter || $slots.footer" #footer>
      <slot name="footer">
        <div class="flex items-center justify-end gap-3 w-full">
          <slot name="extra-actions" />
          <button
            type="button"
            class="px-5 py-2.5 rounded-xl text-xs font-bold border transition-colors hover:bg-[var(--bg-hover)] cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            :disabled="loading"
            @click="
              emit('cancel');
              emit('update:visible', false);
            "
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
      </slot>
    </template>
  </Modal>
</template>

<style scoped>
/* .spinning + @keyframes spin provided globally by src/styles/layout.css */
</style>

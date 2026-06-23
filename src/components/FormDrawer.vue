<script setup lang="ts">
import { Loader2, X } from 'lucide-vue-next';

interface Props {
  visible: boolean;
  title?: string;
  size?: string | number;
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
  showFooter?: boolean;
  closeOnClickModal?: boolean;
  confirmDisabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: '',
  size: '480px',
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
</script>

<template>
  <el-drawer
    :model-value="visible"
    :size="size"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="!loading"
    :show-close="false"
    class="form-drawer"
    @update:model-value="emit('update:visible', $event)"
    @close="emit('cancel')"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <h3 class="text-sm font-bold" style="color: var(--text-primary)">{{ title }}</h3>
        <button
          v-if="!loading"
          type="button"
          class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          style="color: var(--text-muted)"
          @click="emit('cancel')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </template>

    <slot />

    <template v-if="showFooter" #footer>
      <div class="flex justify-end gap-2">
        <slot name="extra-actions" />
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold border transition-colors"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          :disabled="loading"
          @click="emit('cancel')"
        >
          {{ $t(cancelText) }}
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-white transition-all hover:shadow-lg hover:shadow-accent/20 disabled:opacity-60"
          :disabled="loading || confirmDisabled"
          @click="emit('submit')"
        >
          <Loader2 v-if="loading" class="w-3.5 h-3.5 spinning inline mr-1" />
          {{ $t(confirmText) }}
        </button>
      </div>
    </template>
  </el-drawer>
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

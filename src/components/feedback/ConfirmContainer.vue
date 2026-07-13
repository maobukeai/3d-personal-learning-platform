<script setup lang="ts">
import { confirms, removeConfirm, type ConfirmItem } from '@/utils/feedbackStore';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-vue-next';
import { ref, computed, watch } from 'vue';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'radix-vue';

const iconMap = { success: CheckCircle2, warning: AlertCircle, info: Info, error: XCircle };
const colorMap = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  error: 'text-red-500',
};

const activeItem = computed(() => confirms.value[confirms.value.length - 1]);
const isOpen = computed(() => !!activeItem.value);

const localActiveItem = ref<ConfirmItem | null>(null);
watch(
  activeItem,
  (newItem) => {
    if (newItem) {
      localActiveItem.value = newItem;
    }
  },
  { immediate: true },
);

const onOpenChange = (open: boolean) => {
  if (!open && activeItem.value) {
    handleCancel(activeItem.value);
  }
};

const inputValues = ref<Record<number, string>>({});
watch(
  activeItem,
  (item) => {
    if (item && item.showInput && !(item.id in inputValues.value)) {
      inputValues.value[item.id] = item.inputValue || '';
    }
  },
  { immediate: true },
);

const handleConfirm = (item: ConfirmItem) => {
  if (item.showInput) {
    item.resolve(inputValues.value[item.id] || '');
  } else {
    item.resolve(undefined);
  }
  removeConfirm(item.id);
};

const handleCancel = (item: ConfirmItem) => {
  item.reject('cancel');
  removeConfirm(item.id);
};

// Destructive confirms render the confirm button in the destructive color
const isDestructive = (item: ConfirmItem) => item.type === 'error';
const confirmButtonClasses = (item: ConfirmItem) =>
  isDestructive(item)
    ? 'px-4 py-2 rounded-lg text-sm font-semibold text-white bg-destructive hover:bg-destructive/90 transition-colors'
    : 'px-4 py-2 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-accent-hover transition-colors';
</script>

<template>
  <DialogRoot :open="isOpen" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="modal-overlay !z-[4000]" />
      <DialogContent
        class="modal-content !z-[4000] focus:outline-none"
        @interact-outside.prevent
        @escape-key-down="activeItem && handleCancel(activeItem)"
      >
        <div
          v-if="localActiveItem"
          class="relative bg-card border border-base shadow-lg w-full max-w-md p-6 rounded-2xl"
        >
          <div class="flex items-start gap-3 mb-4">
            <component
              :is="iconMap[localActiveItem.type || 'warning']"
              v-if="localActiveItem.type"
              class="w-6 h-6 shrink-0 mt-0.5"
              :class="colorMap[localActiveItem.type || 'warning']"
            />
            <div class="flex-1">
              <DialogTitle class="font-bold text-base text-[var(--text-primary)] mb-1">
                {{ localActiveItem.title }}
              </DialogTitle>
              <DialogDescription as-child>
                <div class="text-sm text-[var(--text-secondary)]">
                  <div v-if="typeof localActiveItem.message === 'string'">
                    {{ localActiveItem.message }}
                  </div>
                  <component :is="() => localActiveItem!.message" v-else />
                </div>
              </DialogDescription>
            </div>
          </div>
          <input
            v-if="localActiveItem.showInput"
            v-model="inputValues[localActiveItem.id]"
            :placeholder="localActiveItem.inputPlaceholder"
            class="w-full px-3 py-2 mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/10 dark:bg-black/20 text-[var(--text-primary)] outline-none focus:border-[var(--accent)] text-sm"
            @keyup.enter="handleConfirm(localActiveItem)"
          />
          <div class="flex justify-end gap-2">
            <button
              v-if="localActiveItem.cancelButtonText"
              class="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border-0 bg-transparent cursor-pointer"
              @click="handleCancel(localActiveItem)"
            >
              {{ localActiveItem.cancelButtonText }}
            </button>
            <button
              class="border-0 cursor-pointer"
              :class="confirmButtonClasses(localActiveItem)"
              @click="handleConfirm(localActiveItem)"
            >
              {{ localActiveItem.confirmButtonText }}
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Animated natively via global .modal-overlay / .modal-content state triggers */
</style>

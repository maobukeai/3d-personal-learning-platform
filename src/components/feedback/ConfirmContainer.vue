<script setup lang="ts">
import { confirms, removeConfirm, type ConfirmItem } from '@/utils/feedbackStore';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-vue-next';
import { ref, watch } from 'vue';
const iconMap = { success: CheckCircle2, warning: AlertCircle, info: Info, error: XCircle };
const colorMap = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  error: 'text-red-500',
};
const inputValues = ref<Record<number, string>>({});
watch(
  confirms,
  (newConfirms) => {
    newConfirms.forEach((c) => {
      if (c.showInput && !(c.id in inputValues.value)) {
        inputValues.value[c.id] = c.inputValue || '';
      }
    });
  },
  { deep: true },
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
}; // Destructive confirms render the confirm button in the destructive color
const isDestructive = (item: ConfirmItem) => item.type === 'error';
const confirmButtonClasses = (item: ConfirmItem) =>
  isDestructive(item)
    ? 'px-4 py-2 rounded-lg text-sm font-semibold text-white bg-destructive hover:bg-destructive/90 transition-colors'
    : 'px-4 py-2 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-accent-hover transition-colors';
</script>
<template>
  <Teleport to="body">
    <transition-group name="confirm">
      <div
        v-for="item in confirms"
        :key="item.id"
        class="fixed inset-0 z-[4000] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0"
          style="background-color: var(--glass-overlay-bg)"
          @pointerdown="handleCancel(item)"
        />
        <div class="relative bg-card border border-base shadow-lg w-full max-w-md p-6 rounded-2xl">
          <div class="flex items-start gap-3 mb-4">
            <component
              :is="iconMap[item.type]"
              v-if="item.type"
              class="w-6 h-6 shrink-0 mt-0.5"
              :class="colorMap[item.type]"
            />
            <div class="flex-1">
              <h3 class="font-bold text-base text-[var(--text-primary)] mb-1">{{ item.title }}</h3>
              <div
                v-if="typeof item.message === 'string'"
                class="text-sm text-[var(--text-secondary)]"
              >
                {{ item.message }}
              </div>
              <component
                :is="() => item.message"
                v-else
                class="text-sm text-[var(--text-secondary)]"
              />
            </div>
          </div>
          <input
            v-if="item.showInput"
            v-model="inputValues[item.id]"
            :placeholder="item.inputPlaceholder"
            class="w-full px-3 py-2 mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/10 dark:bg-black/20 text-[var(--text-primary)] outline-none focus:border-[var(--accent)] text-sm"
            @keyup.enter="handleConfirm(item)"
          />
          <div class="flex justify-end gap-2">
            <button
              v-if="item.cancelButtonText"
              class="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              @click="handleCancel(item)"
            >
              {{ item.cancelButtonText }}
            </button>
            <button :class="confirmButtonClasses(item)" @click="handleConfirm(item)">
              {{ item.confirmButtonText }}
            </button>
          </div>
        </div>
      </div>
    </transition-group>
  </Teleport>
</template>
<style scoped>
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.15s linear;
  will-change: opacity;
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

.confirm-enter-active .bg-card,
.confirm-leave-active .bg-card {
  transition:
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.15s ease;
  will-change: transform, opacity;
}
.confirm-enter-from .bg-card,
.confirm-leave-to .bg-card {
  transform: scale(0.96);
  opacity: 0;
}
</style>

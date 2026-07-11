<script setup lang="ts">
import { toasts, removeToast } from '@/utils/feedbackStore';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-vue-next';
const iconMap = { success: CheckCircle2, warning: AlertCircle, info: Info, error: XCircle };
const colorMap = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  error: 'text-red-500',
};
</script>
<template>
  <Teleport to="body">
    <div
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[3000] flex flex-col items-center gap-2 pointer-events-none"
    >
      <transition-group name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="glass-panel flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 min-w-[280px] max-w-[480px] pointer-events-auto"
          :class="toast.customClass"
        >
          <component
            :is="iconMap[toast.type]"
            class="w-4 h-4 shrink-0"
            :class="colorMap[toast.type]"
          />
          <span
            v-if="typeof toast.message === 'string'"
            class="text-sm text-[var(--text-primary)] flex-1"
            >{{ toast.message }}</span
          >
          <component
            :is="() => toast.message"
            v-else
            class="text-sm text-[var(--text-primary)] flex-1"
          />
          <button
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
            @click="removeToast(toast.id)"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>
<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.toast-move {
  transition: transform 0.3s ease;
}
</style>

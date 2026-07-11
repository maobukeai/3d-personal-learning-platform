<script setup lang="ts">
import { notifications, removeNotification } from '@/utils/feedbackStore';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-vue-next';
const iconMap = { success: CheckCircle2, warning: AlertCircle, info: Info, error: XCircle };
const colorMap = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  error: 'text-red-500',
};
const handleClick = (id: number, onClick?: () => void) => {
  if (onClick) onClick();
  removeNotification(id);
};
</script>
<template>
  <Teleport to="body">
    <div
      class="fixed top-4 right-4 z-[3000] flex flex-col gap-2 pointer-events-none w-80 max-w-[calc(100vw-32px)]"
    >
      <transition-group name="notification">
        <div
          v-for="notif in notifications"
          :key="notif.id"
          class="glass-panel flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 pointer-events-auto cursor-pointer"
          :class="notif.customClass"
          @click="handleClick(notif.id, notif.onClick)"
        >
          <component
            :is="iconMap[notif.type]"
            class="w-5 h-5 shrink-0 mt-0.5"
            :class="colorMap[notif.type]"
          />
          <div class="flex-1 min-w-0">
            <div v-if="notif.title" class="font-semibold text-sm text-[var(--text-primary)] mb-0.5">
              {{ notif.title }}
            </div>
            <div
              v-if="typeof notif.message === 'string'"
              class="text-xs text-[var(--text-secondary)]"
            >
              {{ notif.message }}
            </div>
            <component
              :is="() => notif.message"
              v-else
              class="text-xs text-[var(--text-secondary)]"
            />
          </div>
          <button
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
            @click.stop="removeNotification(notif.id)"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>
<style>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}
.notification-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.notification-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
.notification-move {
  transition: transform 0.3s ease;
}
</style>

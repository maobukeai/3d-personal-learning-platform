<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Activity, ChevronRight } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import type { DashboardActivity } from '../types';

defineProps<{
  activityLog: DashboardActivity[];
}>();

const { t } = useI18n();
const router = useRouter();

const formatTime = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return t('dashboard.time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('dashboard.time.hoursAgo', { n: hours });
  return then.toLocaleDateString();
};

const handleActivityClick = (log: DashboardActivity) => {
  const [prefix] = log.id.split('-');
  if (prefix === 'a') router.push('/assets');
  else if (prefix === 'd') router.push('/discussions');
  else if (prefix === 'e') router.push('/academy');
};
</script>

<template>
  <div class="blender-card overflow-hidden">
    <div class="p-4 sm:p-5 border-b flex items-center justify-between" style="border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <Activity class="w-4 h-4 text-emerald-500" />
        <h3 class="font-bold text-sm" style="color: var(--text-primary)">社区动态</h3>
      </div>
      <div class="flex items-center gap-2">
        <span class="live-dot"></span>
        <span class="text-[10px] font-bold text-emerald-500 uppercase">实时</span>
      </div>
    </div>

    <div class="divide-y" style="border-color: var(--border-base)">
      <div
        v-for="log in activityLog.slice(0, 5)"
        :key="log.id"
        class="activity-item flex gap-3 px-4 sm:px-5 py-3 cursor-pointer transition-colors"
        @click="handleActivityClick(log)"
      >
        <UserAvatar :user="log.user" size="sm" class="shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <p class="text-xs leading-relaxed" style="color: var(--text-secondary)">
            <span class="font-bold" style="color: var(--text-primary)">{{ log.user.name }}</span>
            {{ log.action }}
            <span class="text-accent font-bold">#{{ log.target }}</span>
          </p>
          <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
            {{ formatTime(log.createdAt) }}
          </p>
        </div>
      </div>

      <div v-if="activityLog.length === 0" class="px-4 sm:px-5 py-8 text-center">
        <Activity class="w-8 h-8 mx-auto mb-2 opacity-20" style="color: var(--text-muted)" />
        <p class="text-xs font-bold" style="color: var(--text-muted)">暂无动态</p>
      </div>
    </div>

    <button
      type="button"
      class="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-t transition-colors hover:bg-[var(--bg-subtle)] cursor-pointer"
      style="color: var(--text-secondary); border-color: var(--border-base)"
      @click="router.push('/discussions')"
    >
      进入社区交流 <ChevronRight class="w-3.5 h-3.5" />
    </button>
  </div>
</template>

<style scoped>
.activity-item:hover {
  background-color: var(--bg-subtle);
}

.live-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
</style>

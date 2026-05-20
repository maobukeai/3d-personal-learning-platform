<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import UserAvatar from '@/components/UserAvatar.vue';

defineProps<{
  activityLog: any[];
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

const handleActivityClick = (log: any) => {
  const [prefix] = log.id.split('-');
  if (prefix === 'a') router.push('/assets');
  else if (prefix === 'd') router.push('/discussions');
  else if (prefix === 'e') router.push('/academy');
};
</script>

<template>
  <div class="glass-card overflow-hidden">
    <div
      class="p-4 sm:p-6 border-b flex items-center justify-between"
      style="border-color: var(--border-base)"
    >
      <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">
        团队动态
      </h3>
      <span class="text-[8px] sm:text-[9px] font-black uppercase text-emerald-500 animate-pulse">
        实时
      </span>
    </div>
    <div class="p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div
        v-for="log in activityLog"
        :key="log.id"
        class="flex gap-3 sm:gap-4 group cursor-pointer"
        @click="handleActivityClick(log)"
      >
        <UserAvatar :user="log.user" size="sm" class="shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-[11px] sm:text-xs leading-relaxed" style="color: var(--text-secondary)">
            <span
              class="font-bold group-hover:text-accent transition-colors"
              style="color: var(--text-primary)"
            >
              {{ log.user.name }}
            </span>
            {{ log.action }}
            <span class="text-accent font-bold">#{{ log.target }}</span>
          </p>
          <p class="text-[9px] sm:text-[10px] mt-1" style="color: var(--text-muted)">
            {{ formatTime(log.createdAt) }}
          </p>
        </div>
      </div>
      <div v-if="activityLog.length === 0" class="py-10 sm:py-12 text-center text-slate-400">
        <p class="text-xs sm:text-sm font-bold">暂无动态</p>
      </div>
    </div>
    <button
      class="w-full py-3 sm:py-4 text-[11px] sm:text-xs font-bold border-t transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      style="color: var(--text-secondary); border-color: var(--border-base)"
      @click="router.push('/discussions')"
    >
      进入社区交流
    </button>
  </div>
</template>

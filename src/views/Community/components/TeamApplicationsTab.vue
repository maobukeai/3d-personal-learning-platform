<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ClipboardList, XCircle, CheckCheck } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';

interface TeamUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  email?: string;
  role?: string;
}

interface DetailedApplication {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  user: TeamUser;
  createdAt: string;
  message?: string | null;
}

defineProps<{
  pendingApplications: DetailedApplication[];
}>();

const emit = defineEmits<{
  (e: 'respond-application', id: string, approve: boolean, name: string): void;
}>();

const { t: i18nT, locale } = useI18n();

const t = (key: string, ...args: unknown[]) => {
  const prefixes = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  if (prefixes.some((p) => key.startsWith(p))) {
    return (i18nT as (key: string, ...args: unknown[]) => string)(`community.${key}`, ...args);
  }
  return (i18nT as (key: string, ...args: unknown[]) => string)(key, ...args);
};
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mobile-adaptive">
    <div>
      <h2 class="text-2xl font-black mb-1" style="color: var(--text-primary)">
        {{ t('teamDetail.applicationsReview') }}
      </h2>
      <p class="text-xs text-slate-400 font-medium">
        {{ t('teamDetail.applicationsReviewDesc') }}
      </p>
    </div>

    <div
      v-if="pendingApplications.length === 0"
      class="flex flex-col items-center justify-center py-20 rounded-[2rem] border-2 border-dashed"
      style="border-color: var(--border-base)"
    >
      <ClipboardList class="w-12 h-12 mb-4 opacity-10" style="color: var(--text-muted)" />
      <p class="text-slate-400 font-bold">{{ t('teamDetail.noApplications') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="app in pendingApplications"
        :key="app.id"
        class="flex items-center gap-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border transition-all hover:shadow-lg mobile-row"
        style="border-color: var(--border-base)"
      >
        <UserAvatar :user="app.user" size="lg" />
        <div class="flex-1 min-w-0 text-left">
          <h4 class="font-bold text-base" style="color: var(--text-primary)">
            {{ app.user.name || app.user.email }}
          </h4>
          <p class="text-xs text-slate-400">{{ app.user.email }}</p>
          <p v-if="app.message" class="text-xs text-slate-500 mt-2 italic">"{{ app.message }}"</p>
          <p class="text-[10px] text-slate-300 mt-1">
            {{
              t('teamDetail.appliedAt', {
                date: new Date(app.createdAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US'),
              })
            }}
          </p>
        </div>
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            class="app-action-btn flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-xl font-bold text-xs sm:text-sm hover:bg-rose-50 hover:text-rose-600 transition-all border-none cursor-pointer"
            @click="emit('respond-application', app.id, false, app.user.name)"
          >
            <XCircle class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {{ t('teamDetail.reject') }}
          </button>
          <button
            type="button"
            class="app-action-btn flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-emerald-500 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 border-none cursor-pointer"
            @click="emit('respond-application', app.id, true, app.user.name)"
          >
            <CheckCheck class="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {{ t('teamDetail.approve') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

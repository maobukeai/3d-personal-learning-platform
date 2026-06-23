<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Users, UserPlus, LogOut, Camera, Sparkles, Clock, Globe } from 'lucide-vue-next';
import type { DetailedTeam } from './teamDetailTypes';

const props = defineProps<{
  team: DetailedTeam;
  isOwnerOrAdmin: boolean;
  canManageTeam: boolean;
  canLeaveTeam: boolean;
  isMember: boolean;
}>();

const emit = defineEmits<{
  (e: 'avatar-change', event: Event): void;
  (e: 'cover-change', event: Event): void;
  (e: 'open-ai-avatar-generator'): void;
  (e: 'open-ai-cover-generator'): void;
  (e: 'add-member'): void;
  (e: 'apply-join'): void;
  (e: 'leave-team'): void;
}>();

const { t: i18nT } = useI18n();
const t = (key: string, ...args: unknown[]) => {
  const prefixes = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  if (prefixes.some((p) => key.startsWith(p))) {
    return (i18nT as (key: string, ...args: unknown[]) => string)(`community.${key}`, ...args);
  }
  return (i18nT as (key: string, ...args: unknown[]) => string)(key, ...args);
};

const avatarInput = ref<HTMLInputElement | null>(null);
const coverInput = ref<HTMLInputElement | null>(null);

const triggerAvatarUpload = () => {
  avatarInput.value?.click();
};

const triggerCoverUpload = () => {
  coverInput.value?.click();
};

const getCategoryLabel = (cat?: string | null) => {
  if (!cat) return '';
  const mapping: Record<string, string> = {
    modeling: '建模',
    rendering: '渲染',
    animation: '动画',
    materials: '材质',
    gameEngine: '游戏引擎',
  };
  return mapping[cat] || cat;
};
</script>

<template>
  <div
    class="glass-card rounded-2xl border border-white/20 dark:border-slate-800/50 shadow-xl bg-white/40 dark:bg-slate-900/30 backdrop-blur-md relative overflow-hidden"
  >
    <!-- Cover Image Banner -->
    <div
      class="h-40 sm:h-60 relative overflow-hidden select-none group/cover border-b border-white/10"
    >
      <img
        v-if="team.coverUrl"
        :src="team.coverUrl"
        class="w-full h-full object-cover object-[center_35%] select-none pointer-events-none"
        alt="Team Cover"
      />
      <div
        v-else
        class="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 opacity-80"
      ></div>
      <div class="absolute inset-0 bg-gradient-to-b from-transparent to-black/40"></div>

      <!-- Upload and AI generation buttons for Cover (Owner/Admin only) -->
      <div
        v-if="isOwnerOrAdmin"
        class="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover/cover:opacity-100 transition-opacity z-20"
      >
        <input
          ref="coverInput"
          type="file"
          class="hidden"
          accept="image/*"
          @change="$emit('cover-change', $event)"
        />
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/75 text-white rounded-lg text-xs backdrop-blur-sm transition-all border border-white/10 cursor-pointer"
          @click="triggerCoverUpload"
        >
          <Camera class="w-3.5 h-3.5" />
          更换封面
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs transition-all border border-white/10 cursor-pointer shadow-md"
          @click="$emit('open-ai-cover-generator')"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>AI 生成</span>
        </button>
      </div>
    </div>

    <div
      class="px-6 pb-4 pt-10 lg:pt-12 relative z-10 flex flex-col lg:flex-row items-center gap-4 -mt-10 lg:-mt-12"
    >
      <!-- Team Avatar -->
      <div class="relative group shrink-0">
        <input
          ref="avatarInput"
          type="file"
          class="hidden"
          accept="image/*"
          @change="$emit('avatar-change', $event)"
        />
        <div
          class="w-16 h-16 lg:w-20 lg:h-20 rounded-xl overflow-hidden shadow-md border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-800 transition-transform group-hover:scale-105 duration-500"
        >
          <img
            v-if="team.avatarUrl"
            alt=""
            :src="team.avatarUrl"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-xl lg:text-3xl font-black"
          >
            {{ team.name.charAt(0).toUpperCase() }}
          </div>
        </div>
        <div v-if="isOwnerOrAdmin" class="absolute -bottom-1 -right-1 flex items-center gap-1">
          <button
            type="button"
            class="p-1.5 bg-accent text-white rounded-lg shadow-lg hover:scale-110 active:scale-95 transition-all border border-white/10 cursor-pointer"
            :title="t('teamDetail.changeAvatar')"
            @click="triggerAvatarUpload"
          >
            <Camera class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            class="p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg hover:scale-110 active:scale-95 transition-all border border-white/10 cursor-pointer"
            title="AI 生成头像"
            @click="$emit('open-ai-avatar-generator')"
          >
            <Sparkles class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Team Text Info -->
      <div class="flex-1 text-center lg:text-left pt-1">
        <div
          class="flex flex-col lg:flex-row lg:items-center gap-2 mb-1 justify-center lg:justify-start"
        >
          <h1
            class="text-xl lg:text-2xl font-black tracking-tight"
            style="color: var(--text-primary)"
          >
            {{ team.name }}
          </h1>
          <div class="flex items-center gap-1.5 justify-center">
            <div
              class="px-2 py-0.5 bg-accent/10 text-accent text-[9px] sm:text-xs font-black rounded-md uppercase tracking-wider border border-accent/20"
            >
              {{ t('teamDetail.spaceLabel') }}
            </div>
            <div
              v-if="team.visibility"
              class="px-2 py-0.5 rounded text-[9px] font-bold border"
              :class="
                team.visibility === 'PUBLIC'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
              "
            >
              {{ team.visibility === 'PUBLIC' ? '公开' : '私有' }}
            </div>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-bold text-slate-500 dark:text-slate-400 mt-1"
        >
          <div class="flex items-center gap-1.5">
            <Users class="w-4 h-4 text-slate-400" />
            <span>{{ team.members.length }} {{ t('teams.members') }}</span>
          </div>
          <div v-if="team.invitations?.length" class="flex items-center gap-1.5">
            <Clock class="w-4 h-4 text-slate-400" />
            <span>{{ team.invitations.length }} {{ t('teamDetail.pendingBadge') }}</span>
          </div>
          <div v-if="team.category" class="flex items-center gap-1.5">
            <Globe class="w-4 h-4 text-slate-400" />
            <span>{{ getCategoryLabel(team.category) }}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div
        class="flex flex-row flex-wrap justify-center items-center gap-2 w-full lg:w-auto shrink-0"
      >
        <template v-if="canManageTeam">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/95 text-white rounded-lg font-bold text-xs shadow-md shadow-accent/20 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer border-none"
            @click="$emit('add-member')"
          >
            <UserPlus class="w-4 h-4" />
            {{ t('teamDetail.manageMembers') }}
          </button>
        </template>
        <template v-if="!isMember && team?.visibility === 'PUBLIC'">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-accent hover:bg-accent/95 text-white rounded-xl font-bold text-xs shadow-md shadow-accent/20 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer border-none"
            @click="$emit('apply-join')"
          >
            <UserPlus class="w-4 h-4" />
            {{ t('teams.applyJoin') }}
          </button>
        </template>
        <button
          v-if="canLeaveTeam"
          type="button"
          class="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200/50 dark:border-rose-500/20 rounded-xl font-bold text-xs transition-all cursor-pointer"
          @click="$emit('leave-team')"
        >
          <LogOut class="w-4 h-4" />
          {{ t('teamDetail.leaveBtn') }}
        </button>
      </div>
    </div>
  </div>
</template>

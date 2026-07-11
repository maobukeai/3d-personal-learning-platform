<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronLeft, Hash, Info, Languages, Mic, Search, Users } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';

import type { ChatConversation } from './chatTypes';

const props = defineProps<{
  activeConversation: ChatConversation;
  isInfoPanelOpen: boolean;
  isRecording: boolean;
  recordingDuration: number;
  isAllPeerTranslated: boolean;
  searchQuery: string;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'toggle-info-panel'): void;
  (e: 'start-recording'): void;
  (e: 'stop-recording'): void;
  (e: 'translate-all-peer'): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'open-profile', userId: string): void;
}>();

const { t } = useI18n();
const authStore = useAuthStore();

const otherParticipant = computed(() => {
  const participants = props.activeConversation.participants || [];
  return participants.find((p) => p.id !== authStore.user?.id) || participants[0] || null;
});

const conversationName = computed(() => {
  if (props.activeConversation.isGroup) {
    return props.activeConversation.name || t('community.chat.unnamedGroup');
  }
  const other = otherParticipant.value;
  return other?.name || other?.email || t('community.chat.unknownUser');
});

const isOtherOnline = computed(() => {
  return authStore.isUserOnline(otherParticipant.value?.id || '');
});

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
</script>

<template>
  <div
    class="h-13 border-b px-4 flex items-center justify-between shrink-0 animate-none mobile-adaptive"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div class="flex items-center gap-2 md:gap-2.5">
      <button
        type="button"
        class="lg:hidden p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all text-slate-500 cursor-pointer"
        @click="emit('back')"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>

      <template v-if="activeConversation.isGroup">
        <div
          class="w-6 h-6 rounded-full flex items-center justify-center bg-indigo-500/10 shrink-0"
        >
          <img
            v-if="activeConversation.avatarUrl"
            alt=""
            :src="activeConversation.avatarUrl"
            class="w-6 h-6 rounded-full object-cover"
          />
          <Users v-else class="w-3.5 h-3.5 text-indigo-500" />
        </div>
      </template>
      <template v-else>
        <UserAvatar
          :user="otherParticipant"
          size="sm"
          class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
          @click="otherParticipant?.id && emit('open-profile', otherParticipant.id)"
        />
      </template>
      <div class="min-w-0">
        <p
          class="text-xs font-bold flex items-center gap-1 mobile-row"
          style="color: var(--text-primary)"
        >
          <Hash v-if="activeConversation.isGroup" class="w-3 h-3 text-indigo-400 shrink-0" />
          <span class="truncate">{{ conversationName }}</span>
          <span
            v-if="activeConversation.isGroup"
            class="text-[9px] font-medium text-slate-400 ml-1 shrink-0"
            >{{ activeConversation.participants?.length || 0
            }}{{ t('messages.groupParticipants') }}</span
          >
        </p>
        <p
          v-if="!activeConversation.isGroup"
          class="text-[9px] font-bold flex items-center gap-1 truncate"
          :class="isOtherOnline ? 'text-emerald-500' : 'text-slate-400'"
        >
          <span
            class="w-1.5 h-1.5 rounded-full animate-none shrink-0"
            :class="isOtherOnline ? 'bg-emerald-500' : 'bg-slate-300'"
          ></span>
          <span class="truncate">{{
            isOtherOnline ? t('messages.online') : t('messages.offline')
          }}</span>
        </p>
      </div>
    </div>

    <div class="flex items-center gap-1 md:gap-2 mobile-row">
      <GlassPopover
        placement="bottom-end"
        :width="280"
        trigger="click"
        popper-class="!glass-panel !backdrop-blur-xl !rounded-2xl !p-3 !border-strong/10 shadow-[0_12px_30px_rgba(0,0,0,0.15)]"
      >
        <template #reference>
          <button
            type="button"
            class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all text-slate-400 sm:mr-2 cursor-pointer"
          >
            <Search class="w-4 h-4" />
          </button>
        </template>
        <div class="relative">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            :value="searchQuery"
            type="text"
            :placeholder="t('messages.searchMessages')"
            class="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="color: var(--text-primary)"
            @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </GlassPopover>
      <button
        type="button"
        class="hidden sm:block p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer"
        :class="
          isRecording
            ? 'text-rose-500 animate-pulse bg-rose-50 dark:bg-rose-900/20'
            : 'text-slate-400'
        "
        :title="t('messages.voiceMessage')"
        @click="isRecording ? emit('stop-recording') : emit('start-recording')"
      >
        <Mic class="w-4 h-4" />
      </button>
      <span
        v-if="isRecording"
        class="hidden sm:inline text-[10px] font-black text-rose-500 animate-pulse"
        >{{ formatDuration(recordingDuration) }}</span
      >
      <button
        type="button"
        class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer"
        :class="isAllPeerTranslated ? 'text-accent' : 'text-slate-400'"
        :style="!isAllPeerTranslated ? 'color: var(--text-muted)' : ''"
        :title="t('messages.translate')"
        @click="emit('translate-all-peer')"
      >
        <Languages class="w-4 h-4" />
      </button>
      <div class="w-px h-4 mx-1 sm:mx-2" style="background-color: var(--border-base)"></div>
      <button
        type="button"
        class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer"
        :class="isInfoPanelOpen ? 'text-accent' : ''"
        :style="!isInfoPanelOpen ? 'color: var(--text-muted)' : ''"
        @click="emit('toggle-info-panel')"
      >
        <Info class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

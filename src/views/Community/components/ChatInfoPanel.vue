<script setup lang="ts">
import { ref } from 'vue';
import { X, Users, LogOut, Image as ImageIcon, Paperclip, Download } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';

const _props = defineProps<{
  modelValue: boolean;
  activeConversation: any;
  sharedPhotos: any[];
  sharedFiles: any[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'open-profile', userId: string): void;
  (e: 'leave-group'): void;
}>();

const authStore = useAuthStore();
const infoTab = ref<'info' | 'photos' | 'files'>('info');

const getOtherParticipant = (conv: any) => {
  if (!conv) return null;
  return conv.participants?.find((p: any) => p.id !== authStore.user?.id) || conv.participants?.[0];
};

const formatDateSeparator = (date: string | Date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';

  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
};

const openLink = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};
</script>

<template>
  <div
    v-if="modelValue && activeConversation"
    class="absolute right-0 top-0 bottom-0 w-full md:w-80 md:relative border-l flex flex-col shrink-0 overflow-hidden z-30 shadow-2xl md:shadow-none"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div
      class="p-3.5 sm:p-4 border-b flex items-center justify-between shrink-0"
      style="border-color: var(--border-base)"
    >
      <h3 class="text-xs font-bold" style="color: var(--text-primary)">会话详情</h3>
      <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-all cursor-pointer" @click="emit('update:modelValue', false)">
        <X class="w-3.5 h-3.5" style="color: var(--text-muted)" />
      </button>
    </div>

    <!-- Tabs Header -->
    <div class="flex p-0.5 gap-0.5 mx-3 mt-3 rounded-lg bg-[var(--bg-app)] shrink-0">
      <button v-for="tab in ['info', 'photos', 'files']" :key="tab" type="button" class="flex-1 py-1 rounded-md text-[10px] font-bold transition-all uppercase tracking-wider cursor-pointer" :class="infoTab === tab ? 'bg-[var(--bg-card)] shadow-sm' : 'text-[var(--text-muted)]'" :style="infoTab === tab ? 'color: var(--text-primary)' : ''" @click="infoTab = tab as any">
        {{ tab === 'info' ? '信息' : tab === 'photos' ? '照片' : '文件' }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto scrollbar-hide">
      <!-- Info Tab -->
      <div v-if="infoTab === 'info'">
        <!-- Group Info -->
        <div
          v-if="activeConversation.isGroup"
          class="p-4 text-center border-b"
          style="border-color: var(--border-base)"
        >
          <div
            class="w-14 h-14 rounded-xl mx-auto mb-2 flex items-center justify-center bg-[var(--bg-app)]"
            :class="activeConversation.avatarUrl ? '' : 'bg-indigo-500/10'"
            style="border-color: var(--border-base)"
          >
            <img v-if="activeConversation.avatarUrl" alt="" :src="activeConversation.avatarUrl" class="w-14 h-14 rounded-xl object-cover" />
            <Users v-else class="w-6 h-6 text-indigo-500" />
          </div>
          <h3 class="text-sm sm:text-base font-bold mb-0.5" style="color: var(--text-primary)">
            {{ activeConversation.name || '未命名群聊' }}
          </h3>
          <p class="text-[11px]" style="color: var(--text-muted)">
            群聊 · {{ activeConversation.participants?.length || 0 }} 位成员
          </p>
        </div>

        <!-- 1:1 User Info -->
        <div v-else class="p-4 text-center border-b" style="border-color: var(--border-base)">
          <UserAvatar
            :user="getOtherParticipant(activeConversation)"
            size="lg"
            class="mx-auto mb-2"
          />
          <h3
            class="text-sm sm:text-base font-bold mb-0.5 cursor-pointer hover:text-accent transition-colors"
            style="color: var(--text-primary)"
            @click="emit('open-profile', getOtherParticipant(activeConversation)?.id)"
          >
            {{ getOtherParticipant(activeConversation)?.name || '未知用户' }}
          </h3>
          <p
            class="text-[11px] flex items-center justify-center gap-1"
            :class="
              authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                ? 'text-emerald-500'
                : 'text-slate-400'
            "
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="
                authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                  ? 'bg-emerald-500'
                  : 'bg-slate-300'
              "
            ></span>
            {{
              authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                ? '在线'
                : '离线'
            }}
          </p>
        </div>

        <!-- Members List -->
        <div class="p-4">
          <h4
            class="text-[10px] font-bold uppercase tracking-wider mb-2"
            style="color: var(--text-muted)"
          >
            {{ activeConversation.isGroup ? '群成员' : '共享群聊' }}
          </h4>
          <div class="space-y-1.5">
            <div
              v-for="participant in activeConversation.participants"
              :key="participant.id"
              class="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
              @click="participant.id !== authStore.user?.id && emit('open-profile', participant.id)"
            >
              <div class="relative shrink-0">
                <UserAvatar :user="participant" size="sm" />
                <div
                  v-if="authStore.isUserOnline(participant.id)"
                  class="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border rounded-full z-40"
                  style="border-color: var(--bg-card)"
                ></div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium truncate" style="color: var(--text-primary)">
                  {{ participant.name || '未命名用户' }}
                  <span
                    v-if="participant.id === authStore.user?.id"
                    class="text-[9px] text-slate-400 ml-1"
                    >(你)</span
                  >
                </p>
                <p class="text-[9px] truncate" style="color: var(--text-muted)">
                  {{ participant.email }}
                </p>
              </div>
            </div>
          </div>

          <!-- Group Actions -->
          <div v-if="activeConversation.isGroup" class="mt-4 space-y-1.5">
            <button type="button" class="w-full py-2 px-3 flex items-center gap-2.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all text-xs font-medium cursor-pointer" @click="emit('leave-group')">
              <LogOut class="w-3.5 h-3.5" />
              退出群聊
            </button>
          </div>
        </div>
      </div>

      <!-- Photos Tab -->
      <div v-else-if="infoTab === 'photos'" class="p-3">
        <div v-if="sharedPhotos.length === 0" class="py-16 text-center opacity-40">
          <ImageIcon class="w-8 h-8 mx-auto mb-1.5" />
          <p class="text-xs">暂无共享照片</p>
        </div>
        <div v-else class="grid grid-cols-3 gap-1.5">
          <div
            v-for="photo in sharedPhotos"
            :key="photo.id"
            class="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-all border border-[var(--border-base)]"
            @click="openLink(api.defaults.baseURL + photo.url)"
          >
            <img alt="" :src="api.defaults.baseURL + photo.url" class="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      <!-- Files Tab -->
      <div v-else-if="infoTab === 'files'" class="p-3">
        <div v-if="sharedFiles.length === 0" class="py-16 text-center opacity-40">
          <Paperclip class="w-8 h-8 mx-auto mb-1.5" />
          <p class="text-xs">暂无共享文件</p>
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="file in sharedFiles"
            :key="file.id"
            class="p-2 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-2 group"
          >
            <div
              class="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0"
            >
              <Paperclip class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-bold truncate" style="color: var(--text-primary)">
                {{ file.name }}
              </p>
              <p class="text-[9px]" style="color: var(--text-muted)">
                {{ formatDateSeparator(file.createdAt) }}
              </p>
            </div>
            <a
              :href="api.defaults.baseURL + file.url"
              target="_blank"
              rel="noopener noreferrer"
              class="p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:text-accent"
            >
              <Download class="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sparkles, Plus, Search, Trash2 } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  time: string;
  createdAt: string;
}

const props = defineProps<{
  isMobile: boolean;
  showMobileSidebar: boolean;
  currentSessionId: string;
  recentPrompts: ChatSession[];
  chatSessions: ChatSession[];
  isVip: boolean;
  vipPlanName: string;
  historySearch: string;
}>();

const emit = defineEmits<{
  (e: 'update:showMobileSidebar', val: boolean): void;
  (e: 'update:historySearch', val: string): void;
  (e: 'new-session'): void;
  (e: 'select-session', id: string): void;
  (e: 'delete-session', id: string): void;
  (e: 'fetch-usage'): void;
  (e: 'go-to-billing'): void;
}>();
</script>

<template>
  <!-- Mobile Sidebar Backdrop -->
  <div
    v-if="isMobile && showMobileSidebar"
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs pointer-events-auto"
    @click="emit('update:showMobileSidebar', false)"
  ></div>

  <aside
    :class="[
      'ai-sidebar shrink-0 border-r border-slate-200 dark:border-slate-800 md:flex md:flex-col',
      isMobile
        ? showMobileSidebar
          ? 'fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] transition-transform duration-300 shadow-2xl pointer-events-auto'
          : 'hidden'
        : 'hidden w-[300px]',
    ]"
  >
    <div class="border-b border-slate-200 dark:border-slate-800 px-4 pb-3 pt-4">
      <div class="flex items-center gap-3">
        <div class="ai-logo">
          <Sparkles class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">AI 助手</p>
          <p class="truncate text-xs text-slate-500">智能学习与项目协作</p>
        </div>
      </div>

      <button
        type="button"
        class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-pink-400/10 dark:border-pink-400/5 bg-white/75 dark:bg-white/5 text-slate-800 dark:text-slate-200 px-3 py-2 text-xs font-medium transition hover:-translate-y-0.5 hover:bg-white/95 dark:hover:bg-white/10"
        @click="emit('new-session')"
      >
        <Plus class="h-4 w-4 text-accent" />
        <span>新建对话</span>
      </button>
    </div>

    <div class="px-4 pt-3">
      <div
        class="flex items-center gap-2 rounded-xl border border-slate-400/10 dark:border-slate-400/5 bg-white/70 dark:bg-white/5 px-3 py-1.5"
      >
        <Search class="h-4 w-4 text-slate-400" />
        <input
          :value="historySearch"
          type="text"
          class="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
          placeholder="搜索历史会话"
          @input="emit('update:historySearch', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="min-h-0 flex-1 px-3 pb-2 pt-3">
      <div class="mb-1.5 px-2 text-xs font-medium text-slate-400">历史会话</div>
      <div class="h-full space-y-1 overflow-y-auto pr-1 ai-scrollbar">
        <div
          v-for="item in recentPrompts"
          :key="item.id"
          role="button"
          tabindex="0"
          class="group relative w-full rounded-xl px-2.5 py-2 text-left transition border focus:outline-none cursor-pointer"
          :class="
            currentSessionId === item.id
              ? 'bg-white dark:bg-white/10 border-slate-200/50 dark:border-white/10 shadow-[0_10px_20px_rgba(244,114,182,0.04)]'
              : 'border-transparent hover:bg-white/60 dark:hover:bg-white/5'
          "
          @click="emit('select-session', item.id)"
          @keydown.enter="emit('select-session', item.id)"
          @keydown.space.prevent="emit('select-session', item.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <p class="line-clamp-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              {{ item.title }}
            </p>
            <span class="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{{
              item.time
            }}</span>
          </div>
          <p class="mt-0.5 line-clamp-1 text-xs leading-4 text-slate-500 dark:text-slate-400 pr-6">
            {{ item.preview }}
          </p>
          <button
            type="button"
            class="absolute bottom-2 right-2.5 hidden group-hover:block p-1 text-slate-400 hover:text-rose-500 rounded transition focus:outline-none"
            title="删除会话"
            @click.stop="emit('delete-session', item.id)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          v-if="chatSessions.length === 0"
          class="rounded-2xl border border-dashed px-4 py-6 text-center text-xs text-slate-400"
          style="border-color: rgba(148, 163, 184, 0.18)"
        >
          还没有历史对话，开始发起聊天吧。
        </div>

        <div
          v-else-if="recentPrompts.length === 0"
          class="rounded-2xl border border-dashed px-4 py-6 text-center text-xs text-slate-400"
          style="border-color: rgba(148, 163, 184, 0.18)"
        >
          没有找到匹配的会话。
        </div>
      </div>
    </div>

    <div class="border-t px-4 pb-4 pt-3" style="border-color: rgba(148, 163, 184, 0.14)">
      <div class="subscription-card rounded-[24px] border p-4">
        <p class="text-sm font-semibold text-slate-900 dark:text-white">
          {{ isVip ? `当前订阅：${vipPlanName}` : '升级专业版' }}
        </p>
        <p class="subscription-desc mt-1 text-xs leading-5">
          {{
            isVip
              ? '您已解锁更长上下文、更强模型 and 更多协作能力。'
              : '解锁更长上下文、更强模型和更多协作能力。'
          }}
        </p>
        <button
          type="button"
          class="subscription-btn mt-3 w-full rounded-2xl px-3 py-2.5 text-sm font-medium transition hover:opacity-90"
          @click="emit('go-to-billing')"
        >
          {{ isVip ? '管理订阅' : '立即升级' }}
        </button>
      </div>

      <div
        class="mt-3 flex items-center gap-3 rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 px-3 py-3 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all select-none"
        title="查看 AI 使用额度"
        @click="emit('fetch-usage')"
      >
        <UserAvatar :user="authStore.user ?? undefined" size="sm" />
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
            {{ authStore.user?.name || '访客用户' }}
          </p>
          <p class="truncate text-xs text-slate-400 dark:text-slate-500">
            {{ authStore.user?.email || '当前会话' }}
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>

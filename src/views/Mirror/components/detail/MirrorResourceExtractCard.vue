<script setup lang="ts">
import { Link2, Lock, ExternalLink, Loader2, Heart, ShieldCheck, Sparkles } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  resource: any;
  extractedLinks: Array<{ name: string; type: string }>;
  isExtracting: boolean;
  likeStatus: { liked: boolean; count: number };
  isTogglingLike: boolean;
}>();

const emit = defineEmits<{
  (e: 'extract', link: { name: string; type: string }): void;
  (e: 'toggle-like'): void;
}>();

const authStore = useAuthStore();

function getLinkTypeColor(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('baidu') || t.includes('百度')) return 'bg-blue-500';
  if (t.includes('quark') || t.includes('夸克')) return 'bg-amber-500';
  if (t.includes('ali') || t.includes('阿里')) return 'bg-indigo-500';
  if (t.includes('xunlei') || t.includes('迅雷')) return 'bg-sky-500';
  return 'bg-emerald-500';
}
</script>

<template>
  <div
    class="bg-white/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-5 backdrop-blur-md shadow-xs space-y-4"
  >
    <!-- Header with Live Status Pulse -->
    <div
      class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3.5"
    >
      <div class="flex items-center gap-2.5">
        <span class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-inner">
          <Link2 class="w-4 h-4" />
        </span>
        <div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white tracking-tight">
            提取资源链接
          </h3>
          <p class="text-[10px] text-slate-400">官方镜像高速同步节点</p>
        </div>
      </div>

      <div
        class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
        <span>极速通道</span>
      </div>
    </div>

    <!-- Download Links List -->
    <div class="space-y-3">
      <div
        v-if="extractedLinks.length === 0"
        class="text-slate-400 text-xs text-center py-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800"
      >
        暂未提取下载链接
      </div>

      <div
        v-for="(link, idx) in extractedLinks"
        :key="idx"
        class="p-3.5 rounded-2xl bg-gradient-to-b from-slate-50/90 to-slate-100/50 dark:from-slate-900/60 dark:to-slate-900/40 border border-slate-200/70 dark:border-slate-700/60 space-y-3 shadow-inner"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :class="getLinkTypeColor(link.type)"
            ></span>
            <span class="text-xs md:text-sm font-black text-slate-800 dark:text-slate-200 truncate">
              {{ link.name }}
            </span>
          </div>
          <span
            class="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs"
          >
            {{ link.type }}
          </span>
        </div>

        <button
          type="button"
          class="w-full py-3 px-4 rounded-xl font-black text-xs text-center flex items-center justify-center gap-2 transition-all duration-300 shadow-md cursor-pointer active:scale-98"
          :class="[
            !authStore.isAuthenticated
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25'
              : resource.hasAccess === undefined
                ? 'bg-slate-400 dark:bg-slate-700 text-white cursor-not-allowed'
                : resource.hasAccess === false
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/25'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/30',
          ]"
          :disabled="
            isExtracting || (authStore.isAuthenticated && resource.hasAccess === undefined)
          "
          @click="emit('extract', link)"
        >
          <Loader2
            v-if="isExtracting || (authStore.isAuthenticated && resource.hasAccess === undefined)"
            class="w-4 h-4 animate-spin"
          />
          <Lock
            v-else-if="authStore.isAuthenticated && resource.hasAccess === false"
            class="w-4 h-4"
          />
          <ExternalLink v-else class="w-4 h-4" />

          <span v-if="isExtracting">正在验证与提取...</span>
          <span v-else-if="!authStore.isAuthenticated">登录后安全提取</span>
          <span v-else-if="resource.hasAccess === undefined">核对权限中...</span>
          <span v-else-if="resource.hasAccess === false">升级会员后提取</span>
          <span v-else class="flex items-center gap-1">
            <span>安全提取资源</span>
            <ShieldCheck class="w-3.5 h-3.5 opacity-80" />
          </span>
        </button>
      </div>
    </div>

    <!-- Integrated Like & Social Interaction Foot -->
    <div
      class="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between"
    >
      <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Sparkles class="w-3.5 h-3.5 text-amber-500" />
        <span>{{ likeStatus.count }} 人觉得很棒</span>
      </div>

      <button
        type="button"
        :disabled="isTogglingLike"
        class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all duration-300 border cursor-pointer active:scale-95 text-xs font-bold shadow-2xs"
        :class="
          likeStatus.liked
            ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-500 border-rose-500/30 shadow-rose-500/10'
            : 'bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 hover:border-slate-300'
        "
        @click="emit('toggle-like')"
      >
        <Heart
          class="w-3.5 h-3.5"
          :class="{ 'fill-current animate-bounce text-rose-500': likeStatus.liked }"
        />
        <span>{{ likeStatus.liked ? '已点赞' : '点赞' }}</span>
      </button>
    </div>
  </div>
</template>

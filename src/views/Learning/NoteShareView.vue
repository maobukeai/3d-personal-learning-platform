<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Info,
  Sparkles,
  Home,
  Clock,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { useSystemStore } from '@/stores/system';
import { useAuthStore } from '@/stores/auth';
import Button from '@/components/ui/Button.vue';
import GlassCard from '@/components/ui/GlassCard.vue';
const NoteDetailDialog = defineAsyncComponent(() => import('./components/NoteDetailDialog.vue'));
import { applyThemeToDocument } from '@/composables/useAppearance';
import { preferences } from '@/utils/preferences';
import { formatDate } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const systemStore = useSystemStore();
const authStore = useAuthStore();

const logoLoadFailed = ref(false);
const goHome = () => {
  router.push('/dashboard');
};

watch(
  () => systemStore.settings.PLATFORM_LOGO_URL,
  () => {
    logoLoadFailed.value = false;
  },
);

const shareId = route.params.shareId as string;
const note = ref<any | null>(null);
const expiresAt = ref<string | null>(null);
const customText = ref<string | null>(null);
const loading = ref(true);
const errorMsg = ref('');
const isExpired = ref(false);
const readProgress = ref(0);

const onWindowScroll = () => {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;
  const totalScroll = scrollHeight - clientHeight;
  if (totalScroll > 0) {
    readProgress.value = Math.min(Math.round((scrollTop / totalScroll) * 100), 100);
  } else {
    readProgress.value = 0;
  }
};

const loadSharedNote = async () => {
  loading.value = true;
  errorMsg.value = '';
  isExpired.value = false;
  try {
    const res = await api.get(`/api/notes/share/${shareId}?t=${Date.now()}`);
    note.value = res.data.note;
    expiresAt.value = res.data.expiresAt;
    customText.value = res.data.customText;

    // Set dynamic browser tab title
    document.title = `${res.data.note.title} | ${systemStore.settings.PLATFORM_NAME || '3D 学习平台'}`;
  } catch (error: any) {
    if (error.response?.status === 410) {
      isExpired.value = true;
      errorMsg.value = '该分享链接已过期失效';
    } else {
      errorMsg.value = error.response?.data?.error || '无法加载分享的笔记，链接可能不存在或已被取消';
    }
    document.title = `分享链接已失效 | ${systemStore.settings.PLATFORM_NAME || '3D 学习平台'}`;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  applyThemeToDocument('glass-light');
  void loadSharedNote();
  window.addEventListener('scroll', onWindowScroll);
});

onUnmounted(() => {
  window.removeEventListener('scroll', onWindowScroll);
});
</script>

<template>
  <div
    class="mobile-adaptive min-h-screen flex flex-col font-sans antialiased share-page-bg text-[var(--text-primary)] overflow-x-hidden relative"
  >
    <!-- Sticky Top Reading Progress -->
    <div class="fixed top-0 left-0 right-0 z-[110] h-0.5 bg-transparent">
      <div
        class="h-full bg-gradient-to-r from-purple-500 via-accent to-indigo-500 transition-all duration-75"
        :style="{ width: readProgress + '%' }"
      />
    </div>

    <!-- Enterprise grid background decoration -->
    <div class="enterprise-canvas absolute inset-0 overflow-hidden pointer-events-none z-0"></div>
    
    <!-- Clean Minimalist Header -->
    <header
      class="mobile-row fixed top-0 left-0 right-0 z-[100] backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between border-b shadow-xs transition-colors bg-[var(--bg-card)]/80 border-[var(--border-base)]"
    >
      <div class="flex items-center gap-2 cursor-pointer select-none" @click="goHome">
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden"
          :class="
            systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed
              ? 'bg-transparent'
              : 'bg-gradient-to-tr from-purple-500 to-indigo-600 shadow-sm'
          "
        >
          <img
            v-if="systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed"
            alt=""
            :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
            class="w-full h-full object-contain"
            @error="logoLoadFailed = true"
          />
          <Sparkles v-else class="w-4 h-4 text-white" />
        </div>
        <span
          class="text-xs font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400"
        >
          {{ systemStore.settings.PLATFORM_NAME }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="authStore.isAuthenticated"
          variant="secondary"
          size="sm"
          class="font-bold flex items-center gap-1"
          @click="goHome"
        >
          <Home class="w-3.5 h-3.5" />
        </Button>
        <Button v-else variant="primary" size="sm" class="font-bold" @click="router.push('/login')">
          登录 / 注册
        </Button>
      </div>
    </header>
    <div class="h-[57px] shrink-0 w-full"></div>

    <!-- Custom Greeting Banner if provided -->
    <div
      v-if="customText"
      class="bg-gradient-to-r from-purple-500/[0.04] to-indigo-500/[0.04] border-b border-purple-500/10 px-6 py-2.5 text-center text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center justify-center gap-2 shrink-0"
    >
      <Sparkles class="w-3.5 h-3.5 animate-pulse shrink-0" />
      <span>作者寄语: “{{ customText }}”</span>
    </div>

    <!-- Main Content Container -->
    <main
      class="flex-1 max-w-[1440px] w-full mx-auto px-2 sm:px-6 py-6 lg:py-10 flex flex-col gap-6 relative z-10 items-stretch"
    >
      <!-- Skeleton Loading State -->
      <div
        v-if="loading"
        class="w-full bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl p-6 md:p-10 shadow-sm"
      >
        <div class="space-y-4 animate-pulse">
          <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2"></div>
          <div class="space-y-2 pt-4">
            <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
            <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
            <div class="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-5/6"></div>
          </div>
        </div>
      </div>

      <!-- Error / Expired States -->
      <div
        v-else-if="errorMsg || isExpired"
        class="w-full flex flex-col items-center justify-center text-center py-16 sm:py-24 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl shadow-sm"
      >
        <div
          class="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center mb-5"
        >
          <Info class="w-7 h-7 text-rose-500" />
        </div>
        <h2 class="text-lg sm:text-xl font-black mb-2 text-[var(--text-primary)]">
          {{ isExpired ? '分享链接已失效' : '无法找到当前分享' }}
        </h2>
        <p class="text-xs text-[var(--text-secondary)] max-w-sm mb-6 leading-relaxed">
          {{ errorMsg || '该文章共享可能已到期，或已被作者停止公共访问。' }}
        </p>
        <Button variant="primary" size="md" class="font-bold shadow-xs" @click="goHome">
          返回主页
        </Button>
      </div>

      <!-- Loaded Content -->
      <template v-else-if="note">
        <!-- Floating status info for expiresAt -->
        <div
          v-if="expiresAt"
          class="rounded-2xl px-4 py-2.5 flex items-center gap-1.5 text-xs sm:text-sm font-bold border bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-500/20 text-amber-600 shadow-sm animate-fade-in"
        >
          <Clock class="w-3.5 h-3.5 animate-pulse" />
          <span>临时共享文章，失效时间：{{ formatDate(expiresAt) }}</span>
        </div>

        <GlassCard padding="none" class="shadow-xl p-3 sm:p-6">
          <NoteDetailDialog :note="note" inline />
        </GlassCard>
      </template>
    </main>

    <!-- Clean Footer -->
    <footer
      class="mt-auto py-6 text-center text-xs text-[var(--text-muted)] border-t bg-[var(--bg-card)]/50 select-none border-[var(--border-base)]"
    >
      <p class="mb-1">
        © {{ new Date().getFullYear() }} {{ systemStore.settings.PLATFORM_NAME }}. All rights reserved.
      </p>
      <p>由公共分享密钥浏览 • 支持免登直接访问</p>
    </footer>
  </div>
</template>

<style scoped>
.enterprise-canvas {
  background-image:
    linear-gradient(var(--border-base) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-base) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.15;
}

.share-page-bg {
  position: relative;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-app) 75%, white) 0, var(--bg-app) 180px),
    var(--bg-app);
}

.dark .share-page-bg {
  background: var(--bg-app);
}

.theme-glass .share-page-bg {
  background: transparent !important;
}
</style>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Info,
  Sparkles,
  Home,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import { useSystemStore } from '@/stores/system';
import { useAuthStore } from '@/stores/auth';
import Button from '@/components/ui/Button.vue';
import GlassCard from '@/components/ui/GlassCard.vue';
import AssetDetailModal from './components/AssetDetailModal.vue';
import { applyThemeToDocument } from '@/composables/useAppearance';
import { preferences } from '@/utils/preferences';

const route = useRoute();
const router = useRouter();
const systemStore = useSystemStore();
const label = useLabel();
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
const asset = ref<any | null>(null);
const expiresAt = ref<string | null>(null);
const customText = ref<string | null>(null);
const loading = ref(true);
const errorMsg = ref('');
const isExpired = ref(false);

const loadSharedAsset = async () => {
  loading.value = true;
  errorMsg.value = '';
  isExpired.value = false;
  try {
    const res = await api.get(`/api/assets/share/${shareId}?t=${Date.now()}`);
    asset.value = res.data.asset;
    expiresAt.value = res.data.expiresAt;
    customText.value = res.data.customText;

    // Set dynamic browser tab title
    document.title = `${res.data.asset.title} | ${systemStore.settings.PLATFORM_NAME || '3D 学习平台'}`;
  } catch (error: any) {
    if (error.response?.status === 410) {
      isExpired.value = true;
      errorMsg.value = '该分享链接已过期失效';
    } else {
      errorMsg.value = error.response?.data?.error || '无法加载分享的资源，链接可能不存在或已被取消';
    }
    document.title = `分享链接已失效 | ${systemStore.settings.PLATFORM_NAME || '3D 学习平台'}`;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  const currentTheme = preferences.getTheme();
  applyThemeToDocument(currentTheme);
  void loadSharedAsset();
});
</script>

<template>
  <div
    class="mobile-adaptive min-h-screen flex flex-col font-sans antialiased share-page-bg text-[var(--text-primary)] overflow-x-hidden relative"
  >
    <!-- Enterprise grid background decoration -->
    <div class="enterprise-canvas absolute inset-0 overflow-hidden pointer-events-none z-0"></div>
    <!-- Clean Minimalist Header (exact NoteShareView clone) -->
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
          {{ errorMsg || '该资源共享可能已到期，或已被作者停止公共访问。' }}
        </p>
        <Button variant="primary" size="md" class="font-bold shadow-xs" @click="goHome">
          返回主页
        </Button>
      </div>

      <!-- Loaded Content -->
      <template v-else-if="asset">
        <GlassCard padding="none" class="shadow-xl p-3 sm:p-6">
          <AssetDetailModal :preloadedAsset="asset" inline />
        </GlassCard>
      </template>
    </main>
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

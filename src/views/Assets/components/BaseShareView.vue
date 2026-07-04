<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Sparkles, Home, Info } from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { useSystemStore } from '@/stores/system';
import { useAuthStore } from '@/stores/auth';
import Button from '@/components/ui/Button.vue';
import GlassCard from '@/components/ui/GlassCard.vue';
import { applyThemeToDocument } from '@/composables/useAppearance';

type ResourceType = 'assets' | 'materials' | 'plugins' | 'softwares';

interface Props {
  // Drives API path, response field, theme colors and resource noun.
  resourceType: ResourceType;
  // Whether to read expiresAt from the share response (assets only).
  trackExpiresAt?: boolean;
  // Whether the main layout uses a responsive row (materials only).
  responsiveRow?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  trackExpiresAt: false,
  responsiveRow: false,
});

// Per-resource derivation: response field, Chinese noun, and theme colors.
const responseFieldMap: Record<ResourceType, string> = {
  assets: 'asset',
  materials: 'material',
  plugins: 'plugin',
  softwares: 'software',
};
const nounMap: Record<ResourceType, string> = {
  assets: '资源',
  materials: '材质',
  plugins: '插件',
  softwares: '软件',
};
const themeMap: Record<
  ResourceType,
  {
    logoGradient: string;
    nameGradient: string;
    bannerBg: string;
    bannerBorder: string;
    bannerText: string;
  }
> = {
  assets: {
    logoGradient: 'from-purple-500 to-indigo-600',
    nameGradient: 'from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400',
    bannerBg: 'from-purple-500/[0.04] to-indigo-500/[0.04]',
    bannerBorder: 'border-purple-500/10',
    bannerText: 'text-purple-600 dark:text-purple-400',
  },
  materials: {
    logoGradient: 'from-indigo-500 to-cyan-500',
    nameGradient: 'from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400',
    bannerBg: 'from-indigo-500/[0.04] to-cyan-500/[0.04]',
    bannerBorder: 'border-indigo-500/10',
    bannerText: 'text-indigo-600 dark:text-indigo-400',
  },
  plugins: {
    logoGradient: 'from-amber-500 to-orange-500',
    nameGradient: 'from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400',
    bannerBg: 'from-amber-500/[0.04] to-orange-500/[0.04]',
    bannerBorder: 'border-amber-500/10',
    bannerText: 'text-amber-600 dark:text-amber-400',
  },
  softwares: {
    logoGradient: 'from-blue-500 to-sky-500',
    nameGradient: 'from-blue-600 to-sky-600 dark:from-blue-400 dark:to-sky-400',
    bannerBg: 'from-blue-500/[0.04] to-sky-500/[0.04]',
    bannerBorder: 'border-blue-500/10',
    bannerText: 'text-blue-600 dark:text-blue-400',
  },
};

const responseField = computed(() => responseFieldMap[props.resourceType]);
const noun = computed(() => nounMap[props.resourceType]);
const theme = computed(() => themeMap[props.resourceType]);
const errorLoadMessage = computed(() => `无法加载分享的${noun.value}，链接可能不存在或已被取消`);
const errorFallbackMessage = computed(
  () => `该${noun.value}共享可能已到期，或已被作者停止公共访问。`,
);

// Layout class variants controlled by the responsiveRow flag.
const mainClass = computed(() =>
  props.responsiveRow
    ? 'flex-1 max-w-[1440px] w-full mx-auto px-2 sm:px-6 py-6 lg:py-10 flex flex-col lg:flex-row gap-6 relative z-10 items-stretch'
    : 'flex-1 max-w-[1440px] w-full mx-auto px-2 sm:px-6 py-6 lg:py-10 flex flex-col gap-6 relative z-10 items-stretch',
);
const skeletonClass = computed(() =>
  props.responsiveRow
    ? 'flex-1 w-full bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl p-6 md:p-10 shadow-sm'
    : 'w-full bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl p-6 md:p-10 shadow-sm',
);
const errorClass = computed(() =>
  props.responsiveRow
    ? 'flex-1 w-full flex flex-col items-center justify-center text-center py-16 sm:py-24 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl shadow-sm'
    : 'w-full flex flex-col items-center justify-center text-center py-16 sm:py-24 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl shadow-sm',
);
const cardClass = computed(() =>
  props.responsiveRow ? 'shadow-xl p-3 sm:p-6 w-full' : 'shadow-xl p-3 sm:p-6',
);

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
const resource = ref<any | null>(null);
const expiresAt = ref<string | null>(null);
const customText = ref<string | null>(null);
const loading = ref(true);
const errorMsg = ref('');
const isExpired = ref(false);

const loadShared = async () => {
  loading.value = true;
  errorMsg.value = '';
  isExpired.value = false;
  try {
    const res = await api.get(`/api/${props.resourceType}/share/${shareId}?t=${Date.now()}`);
    resource.value = res.data[responseField.value];
    customText.value = res.data.customText;
    if (props.trackExpiresAt) {
      expiresAt.value = res.data.expiresAt;
    }

    // Set dynamic browser tab title
    document.title = `${res.data[responseField.value].title} | ${systemStore.settings.PLATFORM_NAME || '3D 学习平台'}`;
  } catch (error: any) {
    if (error.response?.status === 410) {
      isExpired.value = true;
      errorMsg.value = '该分享链接已过期失效';
    } else {
      errorMsg.value = error.response?.data?.error || errorLoadMessage.value;
    }
    document.title = `分享链接已失效 | ${systemStore.settings.PLATFORM_NAME || '3D 学习平台'}`;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  applyThemeToDocument('glass-light');
  void loadShared();
});
</script>

<template>
  <div
    class="mobile-adaptive min-h-screen flex flex-col font-sans antialiased share-page-bg text-[var(--text-primary)] overflow-x-hidden relative"
  >
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
              : `bg-gradient-to-tr ${theme.logoGradient} shadow-sm`
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
          class="text-xs font-black bg-clip-text text-transparent bg-gradient-to-r"
          :class="theme.nameGradient"
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
      class="bg-gradient-to-r border-b px-6 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2 shrink-0"
      :class="[theme.bannerBg, theme.bannerBorder, theme.bannerText]"
    >
      <Sparkles class="w-3.5 h-3.5 animate-pulse shrink-0" />
      <span>作者寄语: “{{ customText }}”</span>
    </div>

    <!-- Main Content Container -->
    <main :class="mainClass">
      <!-- Skeleton Loading State -->
      <div v-if="loading" :class="skeletonClass">
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
      <div v-else-if="errorMsg || isExpired" :class="errorClass">
        <div
          class="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center mb-5"
        >
          <Info class="w-7 h-7 text-rose-500" />
        </div>
        <h2 class="text-lg sm:text-xl font-black mb-2 text-[var(--text-primary)]">
          {{ isExpired ? '分享链接已失效' : '无法找到当前分享' }}
        </h2>
        <p class="text-xs text-[var(--text-secondary)] max-w-sm mb-6 leading-relaxed">
          {{ errorMsg || errorFallbackMessage }}
        </p>
        <Button variant="primary" size="md" class="font-bold shadow-xs" @click="goHome">
          返回主页
        </Button>
      </div>

      <!-- Loaded Content -->
      <template v-else-if="resource">
        <GlassCard padding="none" :class="cardClass">
          <slot :resource="resource" :loading="loading" />
        </GlassCard>
      </template>
    </main>
  </div>
</template>

<style scoped>
/* .custom-scrollbar / .enterprise-canvas / .share-page-bg / .dark .share-page-bg /
   .theme-glass .share-page-bg provided globally by src/styles/components.css */
</style>

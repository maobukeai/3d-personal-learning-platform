<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { Chrome, Github, Eye, EyeOff } from 'lucide-vue-next';
import api from '@/utils/api';

const props = defineProps<{
  settings: {
    OAUTH_GOOGLE_ENABLED: boolean;
    OAUTH_GOOGLE_CLIENT_ID: string;
    OAUTH_GOOGLE_CLIENT_SECRET: string;
    OAUTH_GITHUB_ENABLED: boolean;
    OAUTH_GITHUB_CLIENT_ID: string;
    OAUTH_GITHUB_CLIENT_SECRET: string;
  };
}>();

const emit = defineEmits<{
  (e: 'update:settings', val: typeof props.settings): void;
}>();

const localSettings = reactive({ ...props.settings });

watch(
  () => props.settings,
  (newVal) => {
    Object.assign(localSettings, newVal);
  },
  { deep: true },
);

watch(
  localSettings,
  (newVal) => {
    emit('update:settings', { ...props.settings, ...newVal });
  },
  { deep: true },
);

const showGooglePassword = ref(false);
const showGithubPassword = ref(false);
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <section
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 mb-8">
        <Chrome class="w-5 h-5 text-accent" />
        <h2 class="text-lg font-bold" style="color: var(--text-primary)">Google OAuth 配置</h2>
      </div>

      <div class="space-y-6">
        <div
          class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
        >
          <div class="flex items-center gap-3">
            <Chrome class="w-4 h-4 text-accent" />
            <div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                $t('admin.turn_on_google_sign')
              }}</span>
              <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                允许用户使用 Google 账号直接登录平台
              </p>
            </div>
          </div>
          <el-switch v-model="localSettings.OAUTH_GOOGLE_ENABLED" active-color="#4f46e5" />
        </div>

        <div
          v-if="localSettings.OAUTH_GOOGLE_ENABLED"
          class="grid grid-cols-1 gap-6 animate-in fade-in duration-300 mobile-grid"
        >
          <div class="space-y-2">
            <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
              >Client ID</label
            >
            <input
              v-model="localSettings.OAUTH_GOOGLE_CLIENT_ID"
              type="text"
              class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
              >Client Secret</label
            >
            <div class="relative">
              <input
                v-model="localSettings.OAUTH_GOOGLE_CLIENT_SECRET"
                :type="showGooglePassword ? 'text' : 'password'"
                class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 bg-transparent border-none cursor-pointer"
                @click="showGooglePassword = !showGooglePassword"
              >
                <Eye v-if="!showGooglePassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div class="p-4 rounded-xl bg-slate-100 dark:bg-white/5 space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Google 回调地址 (Authorized Redirect URI)
            </p>
            <code class="text-xs break-all text-accent font-mono"
              >{{ api.defaults.baseURL }}/api/auth/google/callback</code
            >
          </div>
        </div>
      </div>
    </section>

    <section
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 mb-8">
        <Github class="w-5 h-5 text-slate-800 dark:text-white" />
        <h2 class="text-lg font-bold" style="color: var(--text-primary)">GitHub OAuth 配置</h2>
      </div>

      <div class="space-y-6">
        <div
          class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
        >
          <div class="flex items-center gap-3">
            <Github class="w-4 h-4 text-slate-800 dark:text-white" />
            <div>
              <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                $t('admin.enable_github_login')
              }}</span>
              <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                允许用户使用 GitHub 账号直接登录平台
              </p>
            </div>
          </div>
          <el-switch v-model="localSettings.OAUTH_GITHUB_ENABLED" active-color="#000" />
        </div>

        <div
          v-if="localSettings.OAUTH_GITHUB_ENABLED"
          class="grid grid-cols-1 gap-6 animate-in fade-in duration-300 mobile-grid"
        >
          <div class="space-y-2">
            <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
              >Client ID</label
            >
            <input
              v-model="localSettings.OAUTH_GITHUB_CLIENT_ID"
              type="text"
              class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
              >Client Secret</label
            >
            <div class="relative">
              <input
                v-model="localSettings.OAUTH_GITHUB_CLIENT_SECRET"
                :type="showGithubPassword ? 'text' : 'password'"
                class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 bg-transparent border-none cursor-pointer"
                @click="showGithubPassword = !showGithubPassword"
              >
                <Eye v-if="!showGithubPassword" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div class="p-4 rounded-xl bg-slate-100 dark:bg-white/5 space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              GitHub 回调地址 (Authorization callback URL)
            </p>
            <code class="text-xs break-all text-accent font-mono"
              >{{ api.defaults.baseURL }}/api/auth/github/callback</code
            >
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, Eye, EyeOff, Chrome, Github, ArrowRight } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import api, { getAssetUrl } from '@/utils/api';

const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const showPassword = ref(false);
const isLoading = ref(false);
const is2FARequired = ref(false);
const tempUserId = ref('');
const twoFactorCode = ref('');
const rememberDevice = ref(true);

const loginForm = ref({
  email: '',
  password: '',
  remember: false,
});

onMounted(async () => {
  // Handle OAuth callback tokens from URL
  const query = router.currentRoute.value.query;
  const token = query.token as string;
  const refreshToken = query.refreshToken as string;
  const error = query.error as string;

  if (error) {
    ElMessage.error(error === 'oauth_failed' ? '社交登录失败，请重试' : '认证过程中出现错误');
    // Clear URL
    router.replace({ query: {} });
  } else if (token && refreshToken) {
    isLoading.value = true;
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      await authStore.fetchMe();
      ElMessage.success('社交登录成功！');
      router.push('/dashboard');
    } catch (err) {
      ElMessage.error('获取用户信息失败');
    } finally {
      isLoading.value = false;
      router.replace({ query: {} });
    }
  }
  
  if (!systemStore.isInitialized) {
    await systemStore.fetchSettings();
  }
});

const handleSocialLogin = (provider: 'google' | 'github') => {
  window.location.href = `${api.defaults.baseURL}/api/auth/${provider}`;
};

const handleLogin = async () => {
  if (!loginForm.value.email || !loginForm.value.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }

  isLoading.value = true;

  try {
    const data = await authStore.login({
      email: loginForm.value.email,
      password: loginForm.value.password,
    });

    if (data.twoFactorRequired) {
      is2FARequired.value = true;
      tempUserId.value = data.userId;
      ElMessage.info('请输入两步验证码');
    } else {
      ElMessage.success('欢迎回来！');
      const redirect = router.currentRoute.value.query.redirect as string;
      if (router.currentRoute.value.query.onboarding === 'true') {
        router.push('/onboarding');
      } else if (redirect) {
        router.push(redirect);
      } else {
        router.push('/dashboard');
      }
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '登录失败，请检查账号密码');
  } finally {
    isLoading.value = false;
  }
};

const handle2FAVerify = async () => {
  if (!twoFactorCode.value) return;
  isLoading.value = true;
  try {
    await authStore.login2FA(tempUserId.value, twoFactorCode.value, rememberDevice.value);
    ElMessage.success('欢迎回来！');
    const redirect = router.currentRoute.value.query.redirect as string;
    if (redirect) {
      router.push(redirect);
    } else {
      router.push('/dashboard');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '验证码错误');
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center font-sans overflow-hidden relative" style="background-color: var(--bg-app)">
    <!-- Background Abstract Shapes -->
    <div class="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
      <div
        class="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-accent/20 blur-[120px] rounded-full"
      ></div>
      <div
        class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[100px] rounded-full"
      ></div>
    </div>

    <!-- Center Section: Login Form -->
    <div
class="w-full max-w-md relative z-10 p-8 md:p-10 mx-4 rounded-[2rem] shadow-2xl border"
         style="background-color: var(--bg-card); border-color: var(--border-base);">
      <div class="w-full">
        <!-- Logo -->
        <div class="mb-8 flex items-center justify-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
            :class="systemStore.settings.PLATFORM_LOGO_URL ? 'bg-transparent' : 'bg-accent shadow-lg shadow-accent/30'"
          >
            <img
              v-if="systemStore.settings.PLATFORM_LOGO_URL"
              :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
              class="w-full h-full object-contain"
            />
            <span v-else class="text-white font-bold text-xl">{{
              systemStore.settings.PLATFORM_NAME.substring(0, 2).toUpperCase()
            }}</span>
          </div>
          <span class="font-bold text-xl tracking-tight" style="color: var(--text-primary)">{{
            systemStore.settings.PLATFORM_NAME
          }}</span>
        </div>

        <div class="mb-8 text-center">
          <h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary)">
            {{ is2FARequired ? '两步验证' : '欢迎回来' }}
          </h1>
          <p style="color: var(--text-secondary)" class="text-sm">
            {{
              is2FARequired
                ? '请输入 Google Authenticator 中的 6 位验证码'
                : systemStore.settings.PLATFORM_DESCRIPTION || '请输入你的账号信息以登录平台'
            }}
          </p>
        </div>

        <div v-if="!is2FARequired" class="space-y-6">
          <!-- Social Logins -->
          <div v-if="systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED" class="grid grid-cols-2 gap-4">
            <button
              v-if="systemStore.settings.OAUTH_GOOGLE_ENABLED"
              class="flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-bold transition-all hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95"
              style="
                border-color: var(--border-base);
                background-color: var(--bg-app);
                color: var(--text-primary);
              "
              @click="handleSocialLogin('google')"
            >
              <Chrome class="w-4 h-4" /> Google
            </button>
            <button
              v-if="systemStore.settings.OAUTH_GITHUB_ENABLED"
              class="flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-bold transition-all hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95"
              style="
                border-color: var(--border-base);
                background-color: var(--bg-app);
                color: var(--text-primary);
              "
              @click="handleSocialLogin('github')"
            >
              <Github class="w-4 h-4" /> GitHub
            </button>
          </div>

          <div v-if="systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED" class="relative py-2 flex items-center">
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
            <span
              class="flex-shrink mx-4 text-xs font-bold uppercase tracking-widest"
              style="color: var(--text-muted)"
              >或者使用邮箱</span
            >
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
          </div>

          <!-- Input Fields -->
          <div class="space-y-4">
            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >电子邮箱</label
              >
              <div class="relative">
                <Mail
                  class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                  style="color: var(--text-secondary)"
                />
                <input
                  v-model="loginForm.email"
                  type="email"
                  placeholder="name@company.com"
                  class="w-full pl-11 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2 ml-1">
                <label
                  class="block text-xs font-bold uppercase"
                  style="color: var(--text-secondary)"
                  >密码</label
                >
                <RouterLink
                  to="/forgot-password"
                  class="text-xs font-bold text-accent hover:text-accent transition-colors"
                  >忘记密码？</RouterLink
                >
              </div>
              <div class="relative">
                <Lock
                  class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                  style="color: var(--text-secondary)"
                />
                <input
                  v-model="loginForm.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="请输入你的密码"
                  class="w-full pl-11 pr-12 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  @keydown.enter="handleLogin"
                />
                <button
                  class="absolute right-4 top-1/2 -translate-y-1/2 hover:text-accent transition-colors"
                  style="color: var(--text-secondary)"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex items-center">
            <el-checkbox v-model="loginForm.remember" label="记住我的登录状态" />
          </div>

          <button
            :disabled="isLoading"
            class="w-full bg-accent text-white py-3.5 rounded-xl font-bold shadow-lg shadow-accent/30 hover:bg-accent hover:shadow-accent/40 transition-all flex items-center justify-center gap-2 group"
            @click="handleLogin"
          >
            <span v-if="!isLoading">进入平台</span>
            <span
              v-else
              class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
            <ArrowRight
              v-if="!isLoading"
              class="w-4 h-4 group-hover:translate-x-1 transition-transform"
            />
          </button>

          <p class="text-center text-sm mt-6" style="color: var(--text-secondary)">
            还没有账号？
            <RouterLink
              to="/register"
              class="font-bold text-accent hover:text-accent transition-colors"
              >立即免费注册</RouterLink
            >
          </p>
        </div>

        <!-- 2FA Input State -->
        <div v-else class="space-y-6">
          <div class="flex justify-center mb-8">
            <div class="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center">
              <Lock class="w-10 h-10 text-accent" />
            </div>
          </div>

          <div>
            <label
              class="block text-xs font-bold uppercase mb-2 ml-1 text-center"
              style="color: var(--text-secondary)"
              >动态验证码</label
            >
            <input
              v-model="twoFactorCode"
              type="text"
              maxlength="6"
              placeholder="000000"
              autocomplete="one-time-code"
              class="w-full text-center text-2xl tracking-[0.5em] font-bold py-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              @keydown.enter="handle2FAVerify"
            />
          </div>

          <div class="flex items-center justify-center">
            <el-checkbox v-model="rememberDevice" label="记住此浏览器 (下次登录免验证)" />
          </div>

          <button
            :disabled="isLoading || twoFactorCode.length < 6"
            class="w-full bg-accent text-white py-3.5 rounded-xl font-bold shadow-lg shadow-accent/30 hover:bg-accent transition-all flex items-center justify-center gap-2"
            @click="handle2FAVerify"
          >
            <span v-if="!isLoading">确认验证</span>
            <span
              v-else
              class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
          </button>

          <button
            class="w-full text-sm font-bold hover:text-accent transition-colors mt-4"
            style="color: var(--text-secondary)"
            @click="is2FARequired = false"
          >
            返回登录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: background animation could go here */
</style>

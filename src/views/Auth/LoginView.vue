<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, Eye, EyeOff, Chrome, Github, ArrowRight } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import api, { getAssetUrl } from '@/utils/api';

const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const { locale } = useI18n();
const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);
const showPassword = ref(false);
const isLoading = ref(false);
const is2FARequired = ref(false);
const tempUserId = ref('');
const twoFactorCode = ref('');
const rememberDevice = ref(true);
const logoLoadFailed = ref(false);

const loginForm = ref({
  email: '',
  password: '',
  remember: false,
});

onMounted(async () => {
  // Handle OAuth callback state. Auth cookies are set by the API callback.
  const query = router.currentRoute.value.query;
  const error = query.error as string;
  const oauth = query.oauth as string;

  if (error) {
    ElMessage.error(error === 'oauth_failed' ? label('社交登录失败，请重试', 'Social login failed, please try again') : label('认证过程中出现错误', 'An authentication error occurred'));
    // Clear URL
    router.replace({ query: {} });
  } else if (oauth === 'success') {
    isLoading.value = true;
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      await authStore.fetchMe();
      ElMessage.success(label('社交登录成功！', 'Social login successful'));
      router.replace('/dashboard');
    } catch (_err) {
      ElMessage.error(label('获取用户信息失败', 'Failed to load user profile'));
      router.replace({ query: {} });
    } finally {
      isLoading.value = false;
    }
  }

  if (!systemStore.isInitialized) {
    await systemStore.fetchSettings();
  }
});

const handleSocialLogin = (provider: 'google' | 'github') => {
  window.location.href = `${api.defaults.baseURL}/api/auth/${provider}`;
};

watch(
  () => systemStore.settings.PLATFORM_LOGO_URL,
  () => {
    logoLoadFailed.value = false;
  },
);

const handleLogoError = () => {
  logoLoadFailed.value = true;
};

const handleLogin = async () => {
  if (!loginForm.value.email || !loginForm.value.password) {
    ElMessage.warning(label('请输入账号和密码', 'Please enter your email and password'));
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
      ElMessage.info(label('请输入两步验证码', 'Please enter your two-factor code'));
    } else {
      ElMessage.success(label('欢迎回来！', 'Welcome back'));
      const redirect = router.currentRoute.value.query.redirect as string;
      if (router.currentRoute.value.query.onboarding === 'true') {
        router.push('/onboarding');
      } else if (redirect) {
        router.push(redirect);
      } else {
        router.push('/dashboard');
      }
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('登录失败，请检查账号密码', 'Login failed, please check your credentials')));
  } finally {
    isLoading.value = false;
  }
};

const handle2FAVerify = async () => {
  if (!twoFactorCode.value) return;
  isLoading.value = true;
  try {
    await authStore.login2FA(tempUserId.value, twoFactorCode.value, rememberDevice.value);
    ElMessage.success(label('欢迎回来！', 'Welcome back'));
    const redirect = router.currentRoute.value.query.redirect as string;
    if (redirect) {
      router.push(redirect);
    } else {
      router.push('/dashboard');
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('验证码错误', 'Invalid verification code')));
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="auth-shell min-h-screen flex items-center justify-center font-sans overflow-hidden relative p-6"
    style="background-color: var(--bg-app)"
  >
    <!-- Center Section: Login Form -->
    <div
      class="auth-panel w-full max-w-[440px] relative z-10 p-6 md:p-8"
    >
      <div class="w-full">
        <!-- Logo -->
        <div class="mb-8 flex items-center justify-center gap-3">
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
            :class="
              systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed
                ? 'bg-transparent'
                : 'bg-accent shadow-sm'
            "
          >
            <img
              v-if="systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed"
              alt=""
              :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
              class="w-full h-full object-contain"
              @error="handleLogoError"
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
            {{ is2FARequired ? label('两步验证', 'Two-Factor Verification') : label('欢迎回来', 'Welcome Back') }}
          </h1>
          <p style="color: var(--text-secondary)" class="text-sm">
            {{
              is2FARequired
                ? label('请输入 Google Authenticator 中的 6 位验证码', 'Enter the 6-digit code from Google Authenticator')
                : systemStore.settings.PLATFORM_DESCRIPTION || label('请输入你的账号信息以登录平台', 'Enter your account details to sign in')
            }}
          </p>
        </div>

        <div v-if="!is2FARequired" class="space-y-6">
          <!-- Social Logins -->
          <div
            v-if="
              systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED
            "
            class="grid grid-cols-2 gap-4"
          >
            <button
              v-if="systemStore.settings.OAUTH_GOOGLE_ENABLED"
              type="button"
              class="flex items-center justify-center gap-2 py-2.5 border rounded-lg text-sm font-bold transition-colors hover:bg-[var(--bg-subtle)]"
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
              type="button"
              class="flex items-center justify-center gap-2 py-2.5 border rounded-lg text-sm font-bold transition-colors hover:bg-[var(--bg-subtle)]"
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

          <div
            v-if="
              systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED
            "
            class="relative py-2 flex items-center"
          >
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
            <span
              class="flex-shrink mx-4 text-xs font-bold uppercase tracking-widest"
              style="color: var(--text-muted)"
              >{{ label('或者使用邮箱', 'Or use email') }}</span
            >
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
          </div>

          <!-- Input Fields -->
          <div class="space-y-4">
            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ label('电子邮箱', 'Email') }}</label
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
                  class="w-full pl-11 pr-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
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
                  >{{ label('密码', 'Password') }}</label
                >
                <RouterLink
                  to="/forgot-password"
                  class="text-xs font-bold text-accent hover:text-accent transition-colors"
                  >{{ label('忘记密码？', 'Forgot password?') }}</RouterLink
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
                  :placeholder="label('请输入你的密码', 'Enter your password')"
                  class="w-full pl-11 pr-12 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  @keydown.enter="handleLogin"
                />
                <button
                  type="button"
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
            <el-checkbox v-model="loginForm.remember" :label="label('记住我的登录状态', 'Remember my sign-in')" />
          </div>

          <button
            type="button"
            :disabled="isLoading"
            class="w-full btn-premium py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            @click="handleLogin"
          >
            <span v-if="!isLoading">{{ label('进入平台', 'Sign In') }}</span>
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
            {{ label('还没有账号？', 'No account yet?') }}
            <RouterLink
              to="/register"
              class="font-bold text-accent hover:text-accent transition-colors"
              >{{ label('立即免费注册', 'Create one') }}</RouterLink
            >
          </p>
        </div>

        <!-- 2FA Input State -->
        <div v-else class="space-y-6">
          <div class="flex justify-center mb-8">
            <div class="w-16 h-16 bg-accent/10 rounded-lg flex items-center justify-center">
              <Lock class="w-10 h-10 text-accent" />
            </div>
          </div>

          <div>
            <label
              class="block text-xs font-bold uppercase mb-2 ml-1 text-center"
              style="color: var(--text-secondary)"
              >{{ label('动态验证码', 'Authenticator Code') }}</label
            >
            <input
              v-model="twoFactorCode"
              type="text"
              maxlength="8"
              placeholder="000000"
              autocomplete="one-time-code"
              class="w-full text-center text-2xl tracking-[0.5em] font-bold py-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              @keydown.enter="handle2FAVerify"
            />
            <p class="text-[11px] text-center mt-2" style="color: var(--text-muted)">
              {{ label('提示：若手机丢失，在此处直接输入 8 位恢复码即可登录', 'Tip: If phone lost, enter your 8-character recovery code here to login') }}
            </p>
          </div>

          <div class="flex items-center justify-center">
            <el-checkbox v-model="rememberDevice" :label="label('记住此浏览器 (下次登录免验证)', 'Trust this browser next time')" />
          </div>

          <button
            type="button"
            :disabled="isLoading || twoFactorCode.length < 6"
            class="w-full bg-accent text-white py-3.5 rounded-lg font-bold shadow-sm hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
            @click="handle2FAVerify"
          >
            <span v-if="!isLoading">{{ label('确认验证', 'Verify') }}</span>
            <span
              v-else
              class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
          </button>

          <button
            type="button"
            class="w-full text-sm font-bold hover:text-accent transition-colors mt-4"
            style="color: var(--text-secondary)"
            @click="is2FARequired = false"
          >
            {{ label('返回登录', 'Back to Login') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: background animation could go here */
</style>

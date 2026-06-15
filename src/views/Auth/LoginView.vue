<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, Chrome, Github, ArrowRight } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import api, { getAssetUrl } from '@/utils/api';

import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Checkbox from '@/components/ui/Checkbox.vue';

const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const { locale } = useI18n();
const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);
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
    ElMessage.error(
      error === 'oauth_failed'
        ? label('社交登录失败，请重试', 'Social login failed, please try again')
        : label('认证过程中出现错误', 'An authentication error occurred'),
    );
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
    ElMessage.error(
      getApiErrorMessage(
        error,
        label('登录失败，请检查账号密码', 'Login failed, please check your credentials'),
      ),
    );
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
    class="auth-shell min-h-screen flex items-center justify-center font-sans overflow-hidden relative p-6 bg-[var(--bg-app)]"
  >
    <!-- Abstract blurred background elements for premium organic depth -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      <div
        class="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[120px] dark:bg-accent/5"
      ></div>
      <div
        class="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[var(--blender-orange)]/10 blur-[120px] dark:bg-[var(--blender-orange)]/5"
      ></div>
    </div>

    <!-- Center Section: Login Form -->
    <Card
      glass
      padding="lg"
      class="auth-panel w-full max-w-[440px] relative z-10 !bg-card/75 dark:!bg-card/40 border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl rounded-2xl"
    >
      <div class="w-full">
        <!-- Logo -->
        <div class="mb-6 flex items-center justify-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300"
            :class="
              systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed
                ? 'bg-transparent'
                : 'bg-accent shadow-[0_4px_12px_rgba(var(--accent-rgb),0.3)]'
            "
          >
            <img
              v-if="systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed"
              alt=""
              :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
              class="w-full h-full object-contain"
              @error="handleLogoError"
            />
            <span v-else class="text-white font-bold text-lg">{{
              systemStore.settings.PLATFORM_NAME.substring(0, 2).toUpperCase()
            }}</span>
          </div>
          <span class="font-bold text-xl tracking-tight text-[var(--text-primary)]">{{
            systemStore.settings.PLATFORM_NAME
          }}</span>
        </div>

        <div class="mb-6 text-center">
          <h1 class="text-xl sm:text-2xl font-bold mb-1.5 text-[var(--text-primary)]">
            {{
              is2FARequired
                ? label('两步验证', 'Two-Factor Verification')
                : label('欢迎回来', 'Welcome Back')
            }}
          </h1>
          <p class="text-[var(--text-secondary)] text-xs sm:text-sm">
            {{
              is2FARequired
                ? label(
                    '请输入 Google Authenticator 中的 6 位验证码',
                    'Enter the 6-digit code from Google Authenticator',
                  )
                : systemStore.settings.PLATFORM_DESCRIPTION ||
                  label('请输入你的账号信息以登录平台', 'Enter your account details to sign in')
            }}
          </p>
        </div>

        <div v-if="!is2FARequired" class="space-y-5">
          <!-- Social Logins -->
          <div
            v-if="
              systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED
            "
            class="grid grid-cols-2 gap-4"
          >
            <Button
              v-if="systemStore.settings.OAUTH_GOOGLE_ENABLED"
              variant="outline"
              :icon="Chrome"
              full-width
              class="!bg-card/30 hover:!bg-card/70 border-white/20 dark:border-white/10 text-[var(--text-primary)] font-bold text-sm h-11"
              @click="handleSocialLogin('google')"
            >
              Google
            </Button>
            <Button
              v-if="systemStore.settings.OAUTH_GITHUB_ENABLED"
              variant="outline"
              :icon="Github"
              full-width
              class="!bg-card/30 hover:!bg-card/70 border-white/20 dark:border-white/10 text-[var(--text-primary)] font-bold text-sm h-11"
              @click="handleSocialLogin('github')"
            >
              GitHub
            </Button>
          </div>

          <div
            v-if="
              systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED
            "
            class="relative py-2 flex items-center"
          >
            <div class="flex-grow border-t border-white/10 dark:border-white/5"></div>
            <span
              class="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
              >{{ label('或者使用邮箱', 'Or use email') }}</span
            >
            <div class="flex-grow border-t border-white/10 dark:border-white/5"></div>
          </div>

          <!-- Input Fields -->
          <div class="space-y-4">
            <Input
              v-model="loginForm.email"
              type="email"
              :label="label('电子邮箱', 'Email')"
              placeholder="name@company.com"
              :icon="Mail"
              glass
              required
            />

            <div>
              <div class="flex items-center justify-between mb-2 ml-1">
                <label
                  class="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]"
                >
                  {{ label('密码', 'Password') }}
                </label>
                <RouterLink
                  to="/forgot-password"
                  class="text-xs font-bold text-accent hover:text-accent-hover transition-colors"
                >
                  {{ label('忘记密码？', 'Forgot password?') }}
                </RouterLink>
              </div>
              <Input
                v-model="loginForm.password"
                type="password"
                :placeholder="label('请输入你的密码', 'Enter your password')"
                :icon="Lock"
                glass
                required
                @keydown.enter="handleLogin"
              />
            </div>
          </div>

          <div class="flex items-center ml-1">
            <Checkbox v-model="loginForm.remember">
              {{ label('记住我的登录状态', 'Remember my sign-in') }}
            </Checkbox>
          </div>

          <Button
            variant="primary"
            :loading="isLoading"
            full-width
            class="h-11 font-bold text-sm group"
            @click="handleLogin"
          >
            <span class="flex items-center justify-center gap-2">
              {{ label('进入平台', 'Sign In') }}
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Button>

          <p class="text-center text-sm mt-4 text-[var(--text-secondary)]">
            {{ label('还没有账号？', 'No account yet?') }}
            <RouterLink
              to="/register"
              class="font-bold text-accent hover:text-accent-hover transition-colors ml-1"
              >{{ label('立即免费注册', 'Create one') }}</RouterLink
            >
          </p>
        </div>

        <!-- 2FA Input State -->
        <div v-else class="space-y-6">
          <div class="flex justify-center mb-6">
            <div
              class="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20"
            >
              <Lock class="w-8 h-8 text-accent animate-pulse" />
            </div>
          </div>

          <div>
            <label
              class="block text-xs font-bold uppercase mb-2 ml-1 text-center tracking-wider text-[var(--text-secondary)]"
            >
              {{ label('动态验证码', 'Authenticator Code') }}
            </label>
            <input
              v-model="twoFactorCode"
              type="text"
              maxlength="8"
              placeholder="000000"
              autocomplete="one-time-code"
              class="w-full text-center text-2xl tracking-[0.5em] font-bold py-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all glass-input"
              @keydown.enter="handle2FAVerify"
            />
            <p class="text-[11px] text-center mt-3 text-[var(--text-muted)] leading-relaxed">
              {{
                label(
                  '提示：若手机丢失，在此处直接输入 8 位恢复码即可登录',
                  'Tip: If phone lost, enter your 8-character recovery code here to login',
                )
              }}
            </p>
          </div>

          <div class="flex items-center justify-center">
            <Checkbox v-model="rememberDevice">
              {{ label('记住此浏览器 (下次登录免验证)', 'Trust this browser next time') }}
            </Checkbox>
          </div>

          <Button
            variant="primary"
            :disabled="twoFactorCode.length < 6"
            :loading="isLoading"
            full-width
            class="h-11 font-bold text-sm"
            @click="handle2FAVerify"
          >
            {{ label('确认验证', 'Verify') }}
          </Button>

          <Button
            variant="link"
            full-width
            class="text-sm font-bold text-[var(--text-secondary)] hover:text-accent-hover h-auto py-0"
            @click="is2FARequired = false"
          >
            {{ label('返回登录', 'Back to Login') }}
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
/* Animated transitions for elements inside card */
.auth-panel {
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.08);
}
</style>

<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, User, Eye, EyeOff, Chrome, Github, ArrowRight } from 'lucide-vue-next';
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
const verificationCode = ref('');
const isSendingCode = ref(false);
const countdown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
const logoLoadFailed = ref(false);

onMounted(async () => {
  if (!systemStore.isInitialized) {
    await systemStore.fetchSettings();
  }
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
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

const startCountdown = () => {
  countdown.value = 60;
  timer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--;
    } else {
      if (timer) {
        clearInterval(timer);
      }
    }
  }, 1000);
};

const sendVerificationCode = async () => {
  if (!registerForm.value.email) {
    return ElMessage.warning(label('请输入邮箱地址', 'Please enter your email'));
  }
  if (countdown.value > 0) return;

  try {
    isSendingCode.value = true;
    await authStore.sendPublicVerificationCode(registerForm.value.email);
    ElMessage.success(label('验证码已发送', 'Verification code sent'));
    startCountdown();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('发送失败', 'Failed to send code')));
  } finally {
    isSendingCode.value = false;
  }
};

const registerForm = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  terms: false,
});

const handleRegister = async () => {
  if (
    !registerForm.value.name ||
    !registerForm.value.email ||
    !registerForm.value.password ||
    !verificationCode.value
  ) {
    ElMessage.warning(label('请填写所有字段，包括验证码', 'Please complete all fields, including the code'));
    return;
  }

  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    ElMessage.error(label('两次输入的密码不一致', 'Passwords do not match'));
    return;
  }

  if (!registerForm.value.terms) {
    ElMessage.warning(label('请阅读并同意服务条款', 'Please read and agree to the terms'));
    return;
  }

  isLoading.value = true;

  try {
    // Implicitly verifies code during register on backend
    await authStore.register({
      name: registerForm.value.name,
      email: registerForm.value.email,
      password: registerForm.value.password,
      verificationCode: verificationCode.value,
    });
    ElMessage.success(label('账号创建成功，请登录！', 'Account created. Please sign in.'));
    router.push({ path: '/login', query: { onboarding: 'true' } });
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('注册失败，验证码可能错误或已过期', 'Registration failed. The code may be invalid or expired.')));
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="auth-shell min-h-screen flex items-center justify-center font-sans overflow-hidden relative p-6 py-10"
    style="background-color: var(--bg-app)"
  >
    <!-- Center Section: Register Form -->
    <div
      class="auth-panel w-full max-w-[480px] relative z-10 p-6 md:p-8"
    >
      <div class="w-full">
        <!-- Logo -->
        <div
          class="mb-8 flex items-center justify-center gap-3 cursor-pointer"
          @click="router.push('/login')"
        >
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
          <h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary)">{{ label('创建新账号', 'Create Account') }}</h1>
          <p style="color: var(--text-secondary)" class="text-sm">
            {{ systemStore.settings.PLATFORM_DESCRIPTION || label('立即开始你的设计师成长之路', 'Start your designer growth path today') }}
          </p>
        </div>

        <!-- Registration Closed Notice -->
        <div
          v-if="systemStore.settings.ALLOW_REGISTRATION === false"
          class="mb-8 p-4 rounded-lg bg-rose-50 border border-rose-100 flex items-center gap-3"
        >
          <div
            class="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center shrink-0 shadow-sm"
          >
            <Lock class="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-rose-600">{{ label('注册已暂停', 'Registration Paused') }}</h3>
            <p class="text-xs text-rose-400 font-medium">
              {{ label('抱歉，目前平台已关闭新用户注册，请联系管理员或稍后再试。', 'New registrations are currently closed. Please contact an administrator or try again later.') }}
            </p>
          </div>
        </div>

        <div v-if="systemStore.settings.ALLOW_REGISTRATION !== false" class="space-y-5">
          <!-- Input Fields -->
          <div class="space-y-4">
            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ label('显示名称', 'Display Name') }}</label
              >
              <div class="relative">
                <User
                  class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                  style="color: var(--text-secondary)"
                />
                <input
                  v-model="registerForm.name"
                  type="text"
                  :placeholder="label('设计师小王', 'Designer Alex')"
                  autocomplete="off"
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
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ label('电子邮箱', 'Email') }}</label
              >
              <div class="flex gap-3">
                <div class="relative flex-1">
                  <Mail
                    class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                    style="color: var(--text-secondary)"
                  />
                  <input
                    v-model="registerForm.email"
                    type="email"
                    placeholder="name@company.com"
                    autocomplete="off"
                    class="w-full pl-11 pr-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>
                <button
                  type="button"
                  :disabled="isSendingCode || countdown > 0"
                  class="px-4 py-3 bg-accent/10 text-accent font-bold rounded-lg text-xs hover:bg-accent hover:text-white transition-colors disabled:opacity-50 shrink-0"
                  @click="sendVerificationCode"
                >
                  {{ isSendingCode ? label('发送中...', 'Sending...') : countdown > 0 ? `${countdown}s` : label('获取验证码', 'Get Code') }}
                </button>
              </div>
            </div>

            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ label('验证码', 'Code') }}</label
              >
              <input
                v-model="verificationCode"
                type="text"
                maxlength="6"
                :placeholder="label('请输入 6 位验证码', 'Enter 6-digit code')"
                autocomplete="one-time-code"
                class="w-full px-4 py-3 border rounded-lg text-sm text-center font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>

            <div class="grid grid-cols-1 gap-4">
              <div>
                <label
                  class="block text-xs font-bold uppercase mb-2 ml-1"
                  style="color: var(--text-secondary)"
                  >{{ label('密码', 'Password') }}</label
                >
                <div class="relative">
                  <Lock
                    class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                    style="color: var(--text-secondary)"
                  />
                  <input
                    v-model="registerForm.password"
                    :type="showPassword ? 'text' : 'password'"
                    :placeholder="label('请输入密码', 'Enter password')"
                    autocomplete="new-password"
                    class="w-full pl-11 pr-12 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
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
              <div>
                <label
                  class="block text-xs font-bold uppercase mb-2 ml-1"
                  style="color: var(--text-secondary)"
                  >{{ label('确认密码', 'Confirm Password') }}</label
                >
                <div class="relative">
                  <Lock
                    class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                    style="color: var(--text-secondary)"
                  />
                  <input
                    v-model="registerForm.confirmPassword"
                    :type="showPassword ? 'text' : 'password'"
                    :placeholder="label('请再次输入', 'Enter again')"
                    autocomplete="new-password"
                    class="w-full pl-11 pr-12 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
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
          </div>

          <div class="flex items-start gap-2 pt-2">
            <el-checkbox v-model="registerForm.terms" class="mt-0.5" />
            <span class="text-xs leading-relaxed" style="color: var(--text-secondary)">
              {{ label('我已阅读并同意平台', 'I have read and agree to the') }}
              <a href="#" class="text-accent font-bold hover:underline">{{ label('服务协议', 'Terms') }}</a>
              {{ label('与', 'and') }}
              <a href="#" class="text-accent font-bold hover:underline">{{ label('隐私政策', 'Privacy Policy') }}</a>
            </span>
          </div>

          <button
            type="button"
            :disabled="isLoading"
            class="w-full btn-premium py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            @click="handleRegister"
          >
            <span v-if="!isLoading">{{ label('立即注册', 'Create Account') }}</span>
            <span
              v-else
              class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
            <ArrowRight
              v-if="!isLoading"
              class="w-4 h-4 group-hover:translate-x-1 transition-transform"
            />
          </button>

          <div
            v-if="
              systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED
            "
            class="relative py-2 flex items-center"
          >
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
            <span
              class="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest"
              style="color: var(--text-muted)"
              >{{ label('或者使用', 'Or use') }}</span
            >
            <div class="flex-grow border-t" style="border-color: var(--border-base)"></div>
          </div>

          <div
            v-if="
              systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED
            "
            class="grid grid-cols-2 gap-4"
          >
            <button
              v-if="systemStore.settings.OAUTH_GOOGLE_ENABLED"
              type="button"
              class="flex items-center justify-center gap-2 py-2.5 border rounded-lg text-xs font-bold transition-colors hover:bg-[var(--bg-subtle)]"
              style="
                border-color: var(--border-base);
                background-color: var(--bg-app);
                color: var(--text-primary);
              "
              @click="handleSocialLogin('google')"
            >
              <Chrome class="w-3.5 h-3.5" /> Google
            </button>
            <button
              v-if="systemStore.settings.OAUTH_GITHUB_ENABLED"
              type="button"
              class="flex items-center justify-center gap-2 py-2.5 border rounded-lg text-xs font-bold transition-colors hover:bg-[var(--bg-subtle)]"
              style="
                border-color: var(--border-base);
                background-color: var(--bg-app);
                color: var(--text-primary);
              "
              @click="handleSocialLogin('github')"
            >
              <Github class="w-3.5 h-3.5" /> GitHub
            </button>
          </div>

          <p class="text-center text-sm mt-4" style="color: var(--text-secondary)">
            {{ label('已有账号？', 'Already have an account?') }}
            <RouterLink
              to="/login"
              class="font-bold text-accent hover:text-accent transition-colors"
              >{{ label('点此登录', 'Sign in') }}</RouterLink
            >
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, User, Eye, EyeOff, Chrome, Github, ArrowRight } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import api, { getAssetUrl } from '@/utils/api';

const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
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
    return ElMessage.warning('请输入邮箱地址');
  }
  if (countdown.value > 0) return;

  try {
    isSendingCode.value = true;
    await authStore.sendPublicVerificationCode(registerForm.value.email);
    ElMessage.success('验证码已发送');
    startCountdown();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发送失败'));
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
    ElMessage.warning('请填写所有字段，包括验证码');
    return;
  }

  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    ElMessage.error('两次输入的密码不一致');
    return;
  }

  if (!registerForm.value.terms) {
    ElMessage.warning('请阅读并同意服务条款');
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
    ElMessage.success('账号创建成功，请登录！');
    router.push({ path: '/login', query: { onboarding: 'true' } });
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '注册失败，验证码可能错误或已过期'));
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
          <h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary)">创建新账号</h1>
          <p style="color: var(--text-secondary)" class="text-sm">
            {{ systemStore.settings.PLATFORM_DESCRIPTION || '立即开始你的设计师成长之路' }}
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
            <h3 class="text-sm font-bold text-rose-600">注册已暂停</h3>
            <p class="text-xs text-rose-400 font-medium">
              抱歉，目前平台已关闭新用户注册，请联系管理员或稍后再试。
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
                >显示名称</label
              >
              <div class="relative">
                <User
                  class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                  style="color: var(--text-secondary)"
                />
                <input
                  v-model="registerForm.name"
                  type="text"
                  placeholder="设计师小王"
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
                >电子邮箱</label
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
                  {{ isSendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码' }}
                </button>
              </div>
            </div>

            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >验证码</label
              >
              <input
                v-model="verificationCode"
                type="text"
                maxlength="6"
                placeholder="请输入 6 位验证码"
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
                  >密码</label
                >
                <div class="relative">
                  <Lock
                    class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                    style="color: var(--text-secondary)"
                  />
                  <input
                    v-model="registerForm.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="请输入密码"
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
                  >确认密码</label
                >
                <div class="relative">
                  <Lock
                    class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2"
                    style="color: var(--text-secondary)"
                  />
                  <input
                    v-model="registerForm.confirmPassword"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="请再次输入"
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
              我已阅读并同意平台
              <a href="#" class="text-accent font-bold hover:underline">服务协议</a> 与
              <a href="#" class="text-accent font-bold hover:underline">隐私政策</a>
            </span>
          </div>

          <button
            type="button"
            :disabled="isLoading"
            class="w-full btn-premium py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            @click="handleRegister"
          >
            <span v-if="!isLoading">立即注册</span>
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
              >或者使用</span
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
            已有账号？
            <RouterLink
              to="/login"
              class="font-bold text-accent hover:text-accent transition-colors"
              >点此登录</RouterLink
            >
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

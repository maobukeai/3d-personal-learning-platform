<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, Lock, User, Chrome, Github, ArrowRight } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useLabel } from '@/utils/i18n';
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
const label = useLabel();
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
    ElMessage.warning(
      label('请填写所有字段，包括验证码', 'Please complete all fields, including the code'),
    );
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
    ElMessage.error(
      getApiErrorMessage(
        error,
        label(
          '注册失败，验证码可能错误或已过期',
          'Registration failed. The code may be invalid or expired.',
        ),
      ),
    );
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="auth-shell mobile-adaptive min-h-screen flex items-center justify-center font-sans overflow-hidden relative p-6 py-10 bg-[var(--bg-app)]"
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

    <!-- Center Section: Register Form -->
    <Card
      glass
      padding="lg"
      class="auth-panel w-full max-w-[480px] relative z-10 !bg-card/75 dark:!bg-card/40 border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl rounded-2xl"
    >
      <div class="w-full">
        <!-- Logo -->
        <div
          class="mb-6 flex items-center justify-center gap-3 cursor-pointer"
          @click="router.push('/login')"
        >
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
            {{ label('创建新账号', 'Create Account') }}
          </h1>
          <p class="text-[var(--text-secondary)] text-xs sm:text-sm">
            {{
              systemStore.settings.PLATFORM_DESCRIPTION ||
              label('立即开始你的设计师成长之路', 'Start your designer growth path today')
            }}
          </p>
        </div>

        <!-- Registration Closed Notice -->
        <div
          v-if="systemStore.settings.ALLOW_REGISTRATION === false"
          class="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
        >
          <div
            class="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0 shadow-md"
          >
            <Lock class="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-red-500">
              {{ label('注册已暂停', 'Registration Paused') }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] font-medium mt-0.5 leading-relaxed">
              {{
                label(
                  '抱歉，目前平台已关闭新用户注册，请联系管理员或稍后再试。',
                  'New registrations are currently closed. Please contact an administrator or try again later.',
                )
              }}
            </p>
          </div>
        </div>

        <div v-if="systemStore.settings.ALLOW_REGISTRATION !== false" class="space-y-5">
          <!-- Input Fields -->
          <div class="space-y-4">
            <Input
              v-model="registerForm.name"
              type="text"
              :label="label('显示名称', 'Display Name')"
              :placeholder="label('设计师小王', 'Designer Alex')"
              :icon="User"
              glass
              required
            />

            <Input
              v-model="registerForm.email"
              type="email"
              placeholder="name@company.com"
              :label="label('电子邮箱', 'Email')"
              :icon="Mail"
              glass
              required
            >
              <template #suffix>
                <button
                  type="button"
                  :disabled="isSendingCode || countdown > 0"
                  class="px-3 py-1.5 bg-accent/15 hover:bg-accent hover:text-white text-accent font-bold rounded-lg text-xs transition-colors disabled:opacity-50 shrink-0 select-none mr-1 cursor-pointer"
                  @click="sendVerificationCode"
                >
                  {{
                    isSendingCode
                      ? label('发送中...', 'Sending...')
                      : countdown > 0
                        ? `${countdown}s`
                        : label('获取验证码', 'Get Code')
                  }}
                </button>
              </template>
            </Input>

            <Input
              v-model="verificationCode"
              type="text"
              maxlength="6"
              :label="label('验证码', 'Code')"
              :placeholder="label('请输入 6 位验证码', 'Enter 6-digit code')"
              glass
              required
              input-class="text-center font-black tracking-[0.3em] text-lg"
            />

            <div class="grid grid-cols-2 gap-4">
              <Input
                v-model="registerForm.password"
                type="password"
                :label="label('密码', 'Password')"
                :placeholder="label('请输入密码', 'Password')"
                :icon="Lock"
                glass
                required
              />

              <Input
                v-model="registerForm.confirmPassword"
                type="password"
                :label="label('确认密码', 'Confirm Password')"
                :placeholder="label('请再次输入', 'Confirm')"
                :icon="Lock"
                glass
                required
              />
            </div>
          </div>

          <div class="flex items-start gap-2.5 pt-1 ml-1">
            <Checkbox v-model="registerForm.terms" class="mt-0.5" />
            <span class="text-xs leading-relaxed text-[var(--text-secondary)]">
              {{ label('我已阅读并同意平台', 'I have read and agree to the') }}
              <a
                href="#"
                class="text-accent font-bold hover:text-accent-hover transition-colors underline"
                >{{ label('服务协议', 'Terms') }}</a
              >
              {{ label('与', 'and') }}
              <a
                href="#"
                class="text-accent font-bold hover:text-accent-hover transition-colors underline"
                >{{ label('隐私政策', 'Privacy Policy') }}</a
              >
            </span>
          </div>

          <Button
            variant="primary"
            :loading="isLoading"
            full-width
            class="h-11 font-bold text-sm group"
            @click="handleRegister"
          >
            <span class="flex items-center justify-center gap-2">
              {{ label('立即注册', 'Create Account') }}
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Button>

          <div
            v-if="
              systemStore.settings.OAUTH_GOOGLE_ENABLED || systemStore.settings.OAUTH_GITHUB_ENABLED
            "
            class="relative py-2 flex items-center"
          >
            <div class="flex-grow border-t border-white/10 dark:border-white/5"></div>
            <span
              class="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]"
              >{{ label('或者使用社交账号', 'Or use social login') }}</span
            >
            <div class="flex-grow border-t border-white/10 dark:border-white/5"></div>
          </div>

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
              class="!bg-card/30 hover:!bg-card/70 border-white/20 dark:border-white/10 text-[var(--text-primary)] font-bold text-xs h-10"
              @click="handleSocialLogin('google')"
            >
              Google
            </Button>
            <Button
              v-if="systemStore.settings.OAUTH_GITHUB_ENABLED"
              variant="outline"
              :icon="Github"
              full-width
              class="!bg-card/30 hover:!bg-card/70 border-white/20 dark:border-white/10 text-[var(--text-primary)] font-bold text-xs h-10"
              @click="handleSocialLogin('github')"
            >
              GitHub
            </Button>
          </div>

          <p class="text-center text-sm mt-4 text-[var(--text-secondary)]">
            {{ label('已有账号？', 'Already have an account?') }}
            <RouterLink
              to="/login"
              class="font-bold text-accent hover:text-accent-hover transition-colors ml-1"
              >{{ label('点此登录', 'Sign in') }}</RouterLink
            >
          </p>
        </div>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.auth-panel {
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.08);
}
</style>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import {
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  User as UserIcon,
  KeyRound,
  Loader2,
} from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import { useAuthStore } from '@/stores/auth';
import { getApiErrorMessage } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const authStore = useAuthStore();
const authMode = ref<'login' | 'register'>('login');
const isLoading = ref(false);
const isSendingCode = ref(false);
const countdown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const is2FARequired = ref(false);
const tempUserId = ref('');
const twoFactorCode = ref('');
const rememberDevice = ref(true);

const loginForm = ref({
  email: '',
  password: '',
});

const registerForm = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  verificationCode: '',
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const handleClose = () => {
  authStore.showLoginModal = false;
  // Reset state
  is2FARequired.value = false;
  tempUserId.value = '';
  twoFactorCode.value = '';
  loginForm.value.email = '';
  loginForm.value.password = '';
  registerForm.value.name = '';
  registerForm.value.email = '';
  registerForm.value.password = '';
  registerForm.value.confirmPassword = '';
  registerForm.value.verificationCode = '';
  authMode.value = 'login';
};

const handleLogin = async () => {
  if (!loginForm.value.email || !loginForm.value.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }

  isLoading.value = true;
  try {
    const data = await authStore.login({
      email: loginForm.value.email.trim(),
      password: loginForm.value.password,
    });

    if (data.twoFactorRequired) {
      is2FARequired.value = true;
      tempUserId.value = data.userId;
      ElMessage.info('请输入两步验证码');
    } else {
      ElMessage.success('登录成功，欢迎回来！');
      handleClose();
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '登录失败，请检查账号密码'));
  } finally {
    isLoading.value = false;
  }
};

const handleSendVerificationCode = async () => {
  if (!registerForm.value.email) {
    ElMessage.warning('请先输入电子邮箱');
    return;
  }
  isSendingCode.value = true;
  try {
    await authStore.sendPublicVerificationCode(registerForm.value.email.trim());
    ElMessage.success('验证码已发送至您的邮箱，请注意查收！');
    countdown.value = 60;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0 && timer) {
        clearInterval(timer);
      }
    }, 1000);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发送验证码失败'));
  } finally {
    isSendingCode.value = false;
  }
};

const handleRegister = async () => {
  if (
    !registerForm.value.name.trim() ||
    !registerForm.value.email.trim() ||
    !registerForm.value.password ||
    !registerForm.value.verificationCode.trim()
  ) {
    ElMessage.warning('请完整填写所有注册信息，包括邮箱验证码');
    return;
  }

  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    ElMessage.error('两次输入的密码不一致');
    return;
  }

  isLoading.value = true;
  try {
    await authStore.register({
      name: registerForm.value.name.trim(),
      email: registerForm.value.email.trim(),
      password: registerForm.value.password,
      verificationCode: registerForm.value.verificationCode.trim(),
    });

    ElMessage.success('🎉 账号注册成功！正在为您自动登录...');

    // Auto login immediately
    await authStore.login({
      email: registerForm.value.email.trim(),
      password: registerForm.value.password,
    });

    handleClose();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '注册失败，验证码可能错误或已过期'));
  } finally {
    isLoading.value = false;
  }
};

const handle2FAVerify = async () => {
  if (!twoFactorCode.value) {
    ElMessage.warning('请输入两步验证码');
    return;
  }
  isLoading.value = true;
  try {
    await authStore.login2FA(tempUserId.value, twoFactorCode.value, rememberDevice.value);
    ElMessage.success('登录成功，欢迎回来！');
    handleClose();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '验证码错误'));
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <Modal
    :show="authStore.showLoginModal"
    :title="authMode === 'login' ? '账号登录' : '快速注册账号'"
    size="sm"
    @close="handleClose"
  >
    <div class="flex flex-col items-center justify-center text-center mb-5">
      <div class="logo-badge mb-3">
        <Sparkles class="h-6 w-6 text-blue-500 animate-pulse" />
      </div>
      <h2 class="text-lg font-black text-slate-900 dark:text-white">
        {{ authMode === 'login' ? '快捷登录' : '创建新账号' }}
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        {{
          authMode === 'login'
            ? '登录后解锁收藏、编辑、上传与每日网盘高速提取'
            : '快速注册加入，享受会员专属权益与海量资源'
        }}
      </p>

      <!-- Mode Switcher Tab -->
      <div
        class="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mt-4 w-full border border-slate-200 dark:border-slate-700"
      >
        <button
          type="button"
          class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
          :class="
            authMode === 'login'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          "
          @click="authMode = 'login'"
        >
          账号登录
        </button>
        <button
          type="button"
          class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
          :class="
            authMode === 'register'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          "
          @click="authMode = 'register'"
        >
          快速注册
        </button>
      </div>
    </div>

    <!-- 2FA Verification Form -->
    <form v-if="is2FARequired" class="space-y-4" @submit.prevent="handle2FAVerify">
      <div class="space-y-1">
        <label class="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >两步验证码 (2FA)</label
        >
        <Input
          v-model="twoFactorCode"
          type="text"
          placeholder="请输入 6 位验证码"
          required
          autofocus
          maxlength="6"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        class="w-full flex justify-center items-center font-bold bg-blue-600 hover:bg-blue-700 text-white"
        :loading="isLoading"
      >
        <span>确认验证</span>
        <ArrowRight class="ml-2 w-4 h-4" />
      </Button>
    </form>

    <!-- Normal Login Form -->
    <form v-else-if="authMode === 'login'" class="space-y-3.5" @submit.prevent="handleLogin">
      <div class="space-y-1">
        <label class="text-xs font-bold text-slate-700 dark:text-slate-300">电子邮箱</label>
        <Input
          v-model="loginForm.email"
          type="email"
          placeholder="name@example.com"
          :icon="Mail"
          required
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs font-bold text-slate-700 dark:text-slate-300">密码</label>
        <Input
          v-model="loginForm.password"
          type="password"
          placeholder="请输入您的密码"
          :icon="Lock"
          required
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        class="w-full flex justify-center items-center font-bold bg-blue-600 hover:bg-blue-700 text-white"
        :loading="isLoading"
      >
        <span>立即登录</span>
        <ArrowRight class="ml-2 w-4 h-4" />
      </Button>

      <div class="text-center pt-1">
        <span class="text-xs text-slate-500 dark:text-slate-400">
          还没有账号？
          <button
            type="button"
            class="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline font-bold cursor-pointer inline"
            @click="authMode = 'register'"
          >
            立即快速注册
          </button>
        </span>
      </div>
    </form>

    <!-- In-Place Register Form -->
    <form v-else class="space-y-3" @submit.prevent="handleRegister">
      <div class="space-y-1">
        <label class="text-xs font-bold text-slate-700 dark:text-slate-300">用户昵称</label>
        <Input
          v-model="registerForm.name"
          type="text"
          placeholder="起一个响亮的昵称"
          :icon="UserIcon"
          required
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs font-bold text-slate-700 dark:text-slate-300">电子邮箱</label>
        <Input
          v-model="registerForm.email"
          type="email"
          placeholder="name@example.com"
          :icon="Mail"
          required
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs font-bold text-slate-700 dark:text-slate-300">邮箱验证码</label>
        <div class="flex items-center gap-2">
          <Input
            v-model="registerForm.verificationCode"
            type="text"
            placeholder="6位验证码"
            :icon="KeyRound"
            class="flex-1"
            required
          />
          <button
            type="button"
            class="h-9 px-3 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-1"
            :disabled="isSendingCode || countdown > 0 || !registerForm.email"
            @click="handleSendVerificationCode"
          >
            <Loader2 v-if="isSendingCode" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ countdown > 0 ? `${countdown}s 后重新获取` : '获取验证码' }}</span>
          </button>
        </div>
      </div>

      <div class="space-y-1">
        <label class="text-xs font-bold text-slate-700 dark:text-slate-300">设置密码</label>
        <Input
          v-model="registerForm.password"
          type="password"
          placeholder="请输入至少6位密码"
          :icon="Lock"
          required
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs font-bold text-slate-700 dark:text-slate-300">确认密码</label>
        <Input
          v-model="registerForm.confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          :icon="Lock"
          required
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        class="w-full flex justify-center items-center font-bold bg-blue-600 hover:bg-blue-700 text-white mt-2"
        :loading="isLoading"
      >
        <span>立即注册并登录</span>
        <ArrowRight class="ml-2 w-4 h-4" />
      </Button>

      <div class="text-center pt-1">
        <span class="text-xs text-slate-500 dark:text-slate-400">
          已有账号？
          <button
            type="button"
            class="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline font-bold cursor-pointer inline"
            @click="authMode = 'login'"
          >
            返回直接登录
          </button>
        </span>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.logo-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  width: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.25);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.15);
}
</style>

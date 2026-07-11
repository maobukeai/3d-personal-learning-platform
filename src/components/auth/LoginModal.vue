<script setup lang="ts">
import { ref } from 'vue';
import { Mail, Lock, Sparkles, ArrowRight } from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import { useAuthStore } from '@/stores/auth';
import { getApiErrorMessage } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const authStore = useAuthStore();
const isLoading = ref(false);
const is2FARequired = ref(false);
const tempUserId = ref('');
const twoFactorCode = ref('');
const rememberDevice = ref(true);

const loginForm = ref({
  email: '',
  password: '',
});

const handleClose = () => {
  authStore.showLoginModal = false;
  // Reset state
  is2FARequired.value = false;
  tempUserId.value = '';
  twoFactorCode.value = '';
  loginForm.value.email = '';
  loginForm.value.password = '';
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
      ElMessage.success('登录成功，欢迎回来！');
      handleClose();
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '登录失败，请检查账号密码'));
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
  <Modal :show="authStore.showLoginModal" title="登录账号" size="sm" @close="handleClose">
    <div class="flex flex-col items-center justify-center text-center mb-6">
      <div class="logo-badge mb-3">
        <Sparkles class="h-6 w-6 text-accent animate-pulse" />
      </div>
      <h2 class="text-xl font-extrabold text-[var(--text-primary)]">快捷登录</h2>
      <p class="text-xs text-[var(--text-secondary)] mt-1">
        登录后可解锁收藏、编辑、上传和 AI 助手功能
      </p>
    </div>

    <!-- 2FA Verification Form -->
    <form v-if="is2FARequired" @submit.prevent="handle2FAVerify" class="space-y-4">
      <div class="space-y-1">
        <label class="text-xs font-semibold text-[var(--text-secondary)]">两步验证码 (2FA)</label>
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
        class="w-full flex justify-center items-center font-bold"
        :loading="isLoading"
      >
        <span>确认验证</span>
        <ArrowRight class="ml-2 w-4 h-4" />
      </Button>
    </form>

    <!-- Normal Login Form -->
    <form v-else @submit.prevent="handleLogin" class="space-y-4">
      <div class="space-y-1">
        <label class="text-xs font-semibold text-[var(--text-secondary)]">电子邮箱</label>
        <Input
          v-model="loginForm.email"
          type="email"
          placeholder="name@example.com"
          :icon="Mail"
          required
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs font-semibold text-[var(--text-secondary)]">密码</label>
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
        class="w-full flex justify-center items-center font-bold"
        :loading="isLoading"
      >
        <span>立即登录</span>
        <ArrowRight class="ml-2 w-4 h-4" />
      </Button>

      <div class="text-center pt-2">
        <span class="text-xs text-[var(--text-secondary)]">
          没有账号？
          <router-link
            to="/register"
            class="text-accent hover:underline font-bold"
            @click="handleClose"
          >
            去注册
          </router-link>
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
  background: linear-gradient(135deg, rgba(244, 114, 182, 0.1), rgba(96, 165, 250, 0.1));
  border: 1px solid rgba(244, 114, 182, 0.25);
  box-shadow: 0 8px 24px rgba(244, 114, 182, 0.15);
}
</style>

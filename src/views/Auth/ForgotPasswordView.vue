<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, Lock, Shield } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

const router = useRouter();
const authStore = useAuthStore();
const { locale } = useI18n();
const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);

const email = ref('');
const isLoading = ref(false);
const step = ref(1); // 1: Email, 2: 2FA & New Password, 3: Success

const forgotForm = ref({
  resetCode: '',
  twoFactorCode: '',
  newPassword: '',
  confirmPassword: '',
});

const handleCheckEmail = async () => {
  if (!email.value) {
    ElMessage.warning(label('请输入你的注册邮箱', 'Please enter your registered email'));
    return;
  }

  isLoading.value = true;
  try {
    const data = await authStore.forgotPasswordCheck(email.value);
    if (data.twoFactorEnabled) {
      step.value = 2;
      ElMessage.info(
        label(
          '验证码已发送，请同时输入邮箱验证码和 2FA 验证码',
          'Code sent. Enter both the email code and 2FA code.',
        ),
      );
    } else {
      ElMessage.warning(
        label(
          '该账户未启用两步验证，邮箱验证功能开发中，请联系管理员',
          'This account has no 2FA. Email-only recovery is not ready; please contact an administrator.',
        ),
      );
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('无法验证邮箱', 'Unable to verify email')));
  } finally {
    isLoading.value = false;
  }
};

const handleResetWith2FA = async () => {
  if (
    !forgotForm.value.resetCode ||
    !forgotForm.value.twoFactorCode ||
    !forgotForm.value.newPassword
  ) {
    ElMessage.warning(label('请填写所有必填项', 'Please complete all required fields'));
    return;
  }

  if (forgotForm.value.newPassword !== forgotForm.value.confirmPassword) {
    ElMessage.error(label('两次输入的密码不一致', 'Passwords do not match'));
    return;
  }

  isLoading.value = true;
  try {
    await authStore.resetPasswordWith2FA({
      email: email.value,
      resetCode: forgotForm.value.resetCode,
      twoFactorCode: forgotForm.value.twoFactorCode,
      newPassword: forgotForm.value.newPassword,
    });
    step.value = 3;
    ElMessage.success(label('密码已成功重置', 'Password reset successfully'));
  } catch (error) {
    ElMessage.error(
      getApiErrorMessage(
        error,
        label('重置失败，验证码可能不正确', 'Reset failed. The code may be incorrect.'),
      ),
    );
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="auth-shell min-h-screen flex font-sans items-center justify-center p-6 relative overflow-hidden bg-[var(--bg-app)]"
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

    <div class="w-full max-w-md relative z-10 animate-fade-in">
      <Card
        glass
        padding="lg"
        class="auth-panel !bg-card/75 dark:!bg-card/40 border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl rounded-2xl"
      >
        <div class="flex flex-col items-center text-center">
          <div
            class="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-6 border border-accent/20"
          >
            <Mail v-if="step === 1" class="w-7 h-7 text-accent" />
            <Shield v-else-if="step === 2" class="w-7 h-7 text-accent animate-pulse" />
            <CheckCircle2 v-else class="w-7 h-7 text-emerald-500" />
          </div>

          <!-- Step 1: Input Email -->
          <div v-if="step === 1" class="w-full">
            <h1 class="text-xl sm:text-2xl font-bold mb-2 text-[var(--text-primary)]">
              {{ label('忘记密码了？', 'Forgot Password?') }}
            </h1>
            <p class="text-xs sm:text-sm mb-6 leading-relaxed text-[var(--text-secondary)]">
              {{
                label(
                  '请输入你的注册邮箱。目前支持通过',
                  'Enter your registered email. Recovery currently uses',
                )
              }}
              <span class="text-accent font-bold">{{
                label('两步验证 (2FA)', 'two-factor verification (2FA)')
              }}</span>
              {{ label('找回密码。', 'to reset your password.') }}
            </p>

            <div class="w-full space-y-5">
              <Input
                v-model="email"
                type="email"
                :label="label('注册邮箱', 'Registered Email')"
                placeholder="name@company.com"
                :icon="Mail"
                glass
                required
                @keydown.enter="handleCheckEmail"
              />

              <Button
                variant="primary"
                :loading="isLoading"
                full-width
                class="h-11 font-bold text-sm group"
                @click="handleCheckEmail"
              >
                <span class="flex items-center justify-center gap-2">
                  {{ label('继续', 'Continue') }}
                  <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Button>
            </div>
          </div>

          <!-- Step 2: 2FA and New Password -->
          <div v-else-if="step === 2" class="w-full">
            <h1 class="text-xl sm:text-2xl font-bold mb-2 text-[var(--text-primary)]">
              {{ label('身份验证', 'Verify Identity') }}
            </h1>
            <p class="text-xs sm:text-sm mb-6 leading-relaxed text-[var(--text-secondary)]">
              {{
                label(
                  '请输入身份验证器中的 6 位动态验证码，并设置你的新密码。',
                  'Enter the 6-digit authenticator code and set your new password.',
                )
              }}
            </p>

            <div class="w-full space-y-4">
              <Input
                v-model="forgotForm.resetCode"
                type="text"
                maxlength="6"
                :label="label('邮箱验证码', 'Email Code')"
                placeholder="000000"
                glass
                required
                input-class="text-center font-bold tracking-[0.3em]"
              />

              <Input
                v-model="forgotForm.twoFactorCode"
                type="text"
                maxlength="6"
                :label="label('2FA 验证码', '2FA Code')"
                placeholder="000000"
                glass
                required
                input-class="text-center font-bold tracking-[0.3em]"
              />

              <div class="grid grid-cols-2 gap-4">
                <Input
                  v-model="forgotForm.newPassword"
                  type="password"
                  :label="label('新密码', 'New Password')"
                  :placeholder="label('至少 8 位字符', 'At least 8 chars')"
                  :icon="Lock"
                  glass
                  required
                />

                <Input
                  v-model="forgotForm.confirmPassword"
                  type="password"
                  :label="label('确认新密码', 'Confirm Password')"
                  :placeholder="label('请再次输入', 'Confirm')"
                  :icon="Lock"
                  glass
                  required
                />
              </div>

              <Button
                variant="primary"
                :loading="isLoading"
                full-width
                class="h-11 font-bold text-sm mt-2"
                @click="handleResetWith2FA"
              >
                {{ label('重置密码', 'Reset Password') }}
              </Button>

              <Button
                variant="link"
                full-width
                class="text-xs font-bold text-[var(--text-secondary)] hover:text-accent-hover h-auto py-0"
                @click="step = 1"
              >
                {{ label('返回修改邮箱', 'Change Email') }}
              </Button>
            </div>
          </div>

          <!-- Step 3: Success State -->
          <div v-else class="w-full">
            <h1 class="text-xl sm:text-2xl font-bold mb-2 text-[var(--text-primary)]">
              {{ label('重置成功！', 'Reset Complete') }}
            </h1>
            <p class="text-xs sm:text-sm mb-6 leading-relaxed text-[var(--text-secondary)]">
              {{
                label(
                  '你的账号密码已成功更新。现在你可以使用新密码重新登录平台了。',
                  'Your password has been updated. You can now sign in with the new password.',
                )
              }}
            </p>
            <Button
              variant="primary"
              full-width
              class="h-11 font-bold text-sm group"
              @click="router.push('/login')"
            >
              <span class="flex items-center justify-center gap-2">
                {{ label('前往登录', 'Go to Login') }}
                <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
          </div>

          <div class="mt-6 pt-5 border-t border-white/10 dark:border-white/5 w-full">
            <RouterLink
              to="/login"
              class="flex items-center justify-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-accent-hover transition-colors group"
            >
              <ArrowLeft class="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              {{ label('返回登录页面', 'Back to Login') }}
            </RouterLink>
          </div>
        </div>
      </Card>

      <p class="text-center mt-6 text-xs text-[var(--text-secondary)]">
        {{ label('需要更多帮助？', 'Need more help?') }}
        <a href="#" class="text-accent hover:text-accent-hover font-bold ml-1 transition-colors">{{
          label('联系技术支持', 'Contact support')
        }}</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-panel {
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.08);
}
</style>

<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  AtSign,
  CheckCircle2,
  Copy,
  Fingerprint,
  KeyRound,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Trash2,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { getApiErrorMessage } from '@/utils/error';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import {
  type TrustedDevice,
  changeEmail,
  fetchRecoveryCodes as fetchRecoveryCodesRequest,
  fetchTrustedDevices as fetchTrustedDevicesRequest,
  regenerateRecoveryCodes as regenerateRecoveryCodesRequest,
  revokeTrustedDevice,
  sendEmailChangeCode as sendEmailChangeCodeRequest,
} from '@/services/account.service';

const authStore = useAuthStore();

const emailChangeForm = ref({
  newEmail: '',
  code: '',
  step: 1 as 1 | 2,
});
const isSendingEmailCode = ref(false);
const isConfirmingEmail = ref(false);
const emailCodeCountdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const isChangingPassword = ref(false);

const is2FALoading = ref(false);
const qrCodeUrl = ref('');
const secretKey = ref('');
const tfaCode = ref('');
const tfaPassword = ref('');
const setupRecoveryCodes = ref<string[]>([]);
const show2FASetup = ref(false);
const recoveryCodeCount = ref(0);
const regeneratePassword = ref('');
const regenerateCode = ref('');
const regeneratedRecoveryCodes = ref<string[]>([]);
const isRegeneratingCodes = ref(false);
const disable2FACode = ref('');
const disablePassword = ref('');
const isDisabling2FA = ref(false);

const trustedDevices = ref<TrustedDevice[]>([]);
const isLoadingDevices = ref(false);
const trustedDevicesLoaded = ref(false);

const passwordStrength = computed(() => {
  const value = passwordForm.value.newPassword;
  let score = 0;
  if (value.length >= 8) score += 25;
  if (/[A-Z]/.test(value)) score += 20;
  if (/[a-z]/.test(value)) score += 15;
  if (/\d/.test(value)) score += 20;
  if (/[^A-Za-z0-9]/.test(value)) score += 20;
  const normalized = Math.min(score, 100);
  if (normalized >= 80) return { value: normalized, label: '强', tone: 'green' };
  if (normalized >= 50) return { value: normalized, label: '中', tone: 'amber' };
  return { value: normalized, label: '弱', tone: 'red' };
});

const securityScore = computed(() => {
  let score = 45;
  if (authStore.user?.emailVerified) score += 20;
  if (authStore.user?.twoFactorEnabled) score += 25;
  if (trustedDevicesLoaded.value) score += 10;
  return Math.min(score, 100);
});

const securityChecks = computed(() => [
  { label: '邮箱已验证', done: !!authStore.user?.emailVerified },
  { label: '双重验证已开启', done: !!authStore.user?.twoFactorEnabled },
  { label: '受信设备可管理', done: trustedDevicesLoaded.value },
]);

const startEmailCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  emailCodeCountdown.value = 60;
  countdownTimer = setInterval(() => {
    if (emailCodeCountdown.value > 0) {
      emailCodeCountdown.value--;
    } else if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
};

const sendEmailChangeCode = async () => {
  if (!emailChangeForm.value.newEmail) {
    ElMessage.warning('请输入新邮箱地址');
    return;
  }
  if (emailCodeCountdown.value > 0) return;

  try {
    isSendingEmailCode.value = true;
    await sendEmailChangeCodeRequest(emailChangeForm.value.newEmail);
    ElMessage.success('验证码已发送到新邮箱');
    emailChangeForm.value.step = 2;
    startEmailCountdown();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发送验证码失败'));
  } finally {
    isSendingEmailCode.value = false;
  }
};

const confirmEmailChange = async () => {
  if (emailChangeForm.value.code.length !== 6) {
    ElMessage.warning('请输入 6 位验证码');
    return;
  }
  try {
    isConfirmingEmail.value = true;
    await changeEmail(emailChangeForm.value.newEmail, emailChangeForm.value.code);
    ElMessage.success('邮箱已成功更换');
    emailChangeForm.value = { newEmail: '', code: '', step: 1 };
    await authStore.fetchMe();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '更换邮箱失败'));
  } finally {
    isConfirmingEmail.value = false;
  }
};

const handleChangePassword = async () => {
  if (!passwordForm.value.currentPassword) {
    ElMessage.warning('请输入当前密码');
    return;
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致');
    return;
  }
  if (passwordForm.value.newPassword.length < 6) {
    ElMessage.warning('新密码长度至少为 6 位');
    return;
  }

  try {
    isChangingPassword.value = true;
    await authStore.changePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    ElMessage.success('密码已更新');
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '修改密码失败'));
  } finally {
    isChangingPassword.value = false;
  }
};

const start2FASetup = async () => {
  is2FALoading.value = true;
  try {
    const data = await authStore.setup2FA();
    qrCodeUrl.value = data.qrCodeUrl;
    secretKey.value = data.secret || '';
    setupRecoveryCodes.value = data.recoveryCodes || [];
    show2FASetup.value = true;
  } catch {
    ElMessage.error('无法启动双重验证设置');
  } finally {
    is2FALoading.value = false;
  }
};

const confirm2FA = async () => {
  if (!tfaPassword.value) {
    ElMessage.warning('请输入当前密码');
    return;
  }
  if (tfaCode.value.length !== 6) {
    ElMessage.warning('请输入 6 位动态验证码');
    return;
  }

  try {
    is2FALoading.value = true;
    await authStore.enable2FA(tfaCode.value, tfaPassword.value);
    ElMessage.success('双重验证已启用');
    show2FASetup.value = false;
    tfaCode.value = '';
    tfaPassword.value = '';
    recoveryCodeCount.value = setupRecoveryCodes.value.length;
    await authStore.fetchMe();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '启用双重验证失败'));
  } finally {
    is2FALoading.value = false;
  }
};

const fetchRecoveryCodes = async () => {
  if (!authStore.user?.twoFactorEnabled) return;
  try {
    const summary = await fetchRecoveryCodesRequest();
    recoveryCodeCount.value = summary.count;
  } catch {
    recoveryCodeCount.value = 0;
  }
};

const regenerateRecoveryCodes = async () => {
  if (!regeneratePassword.value && !regenerateCode.value) {
    ElMessage.warning('请输入当前密码或 2FA 验证码');
    return;
  }
  try {
    isRegeneratingCodes.value = true;
    regeneratedRecoveryCodes.value = await regenerateRecoveryCodesRequest({
      password: regeneratePassword.value || undefined,
      code: regenerateCode.value || undefined,
    });
    regeneratePassword.value = '';
    regenerateCode.value = '';
    recoveryCodeCount.value = regeneratedRecoveryCodes.value.length;
    ElMessage.success('恢复码已重新生成');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '重新生成恢复码失败'));
  } finally {
    isRegeneratingCodes.value = false;
  }
};

const copyRecoveryCodes = async (codes: string[]) => {
  try {
    await navigator.clipboard.writeText(codes.join('\n'));
    ElMessage.success('恢复码已复制');
  } catch {
    ElMessage.warning('当前浏览器不支持自动复制，请手动保存恢复码');
  }
};

const copySecret = async () => {
  if (!secretKey.value) return;
  try {
    await navigator.clipboard.writeText(secretKey.value);
    ElMessage.success('2FA 密钥已复制');
  } catch {
    ElMessage.warning('当前浏览器不支持自动复制，请手动复制密钥');
  }
};

const disable2FA = async () => {
  if (!disable2FACode.value && !disablePassword.value) {
    ElMessage.warning('请输入 2FA 验证码或当前密码');
    return;
  }
  try {
    await ElMessageBox.confirm('关闭后，登录时将不再要求动态验证码。', '关闭双重验证', {
      confirmButtonText: '确认关闭',
      cancelButtonText: '取消',
      type: 'warning',
    });

    isDisabling2FA.value = true;
    await authStore.disable2FA({
      code: disable2FACode.value || undefined,
      password: disablePassword.value || undefined,
    });
    disable2FACode.value = '';
    disablePassword.value = '';
    recoveryCodeCount.value = 0;
    regeneratedRecoveryCodes.value = [];
    ElMessage.success('双重验证已关闭');
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '关闭双重验证失败'));
    }
  } finally {
    isDisabling2FA.value = false;
  }
};

const fetchTrustedDevices = async () => {
  isLoadingDevices.value = true;
  try {
    trustedDevices.value = await fetchTrustedDevicesRequest();
    trustedDevicesLoaded.value = true;
  } catch {
    trustedDevices.value = [];
    trustedDevicesLoaded.value = false;
  } finally {
    isLoadingDevices.value = false;
  }
};

const revokeDevice = async (deviceId: string) => {
  try {
    await ElMessageBox.confirm('移除后，该设备下次登录需要重新验证。', '移除受信设备', {
      confirmButtonText: '确认移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await revokeTrustedDevice(deviceId);
    ElMessage.success('设备已移除');
    fetchTrustedDevices();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('移除设备失败');
    }
  }
};

onMounted(() => {
  fetchTrustedDevices();
  fetchRecoveryCodes();
});

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
</script>

<template>
  <div class="settings-layout-container mobile-adaptive">
    <section class="settings-overview mobile-row">
      <div class="settings-overview-info min-w-0">
        <p class="settings-kicker">账号安全</p>
        <h3 class="settings-card-title truncate">{{ securityScore }}% 安全评分</h3>
        <span class="settings-card-subtitle truncate">{{
          authStore.user?.twoFactorEnabled
            ? '双重验证已保护你的登录流程。'
            : '建议开启双重验证并定期更新密码。'
        }}</span>
      </div>
      <div class="check-strip mobile-row">
        <span v-for="item in securityChecks" :key="item.label" :class="{ done: item.done }">
          <CheckCircle2 />
          {{ item.label }}
        </span>
      </div>
    </section>

    <div class="security-layout-main">
      <div class="security-left-col">
        <div class="settings-card security-panel">
          <header class="settings-card-header flex items-center justify-between">
            <h3 class="settings-card-title flex items-center gap-2">
              <span>邮箱地址</span>
              <Mail class="w-4 h-4 text-[var(--text-muted)]" />
            </h3>
          </header>
          <div class="panel-body p-4">
            <p class="current-email truncate">当前邮箱：{{ authStore.user?.email }}</p>

            <div v-if="emailChangeForm.step === 1" class="form-stack">
              <Input
                v-model="emailChangeForm.newEmail"
                type="email"
                label="新邮箱地址"
                placeholder="new@example.com"
                :icon="AtSign"
              />
              <Button
                variant="secondary"
                :disabled="isSendingEmailCode || emailCodeCountdown > 0"
                :loading="isSendingEmailCode"
                @click="sendEmailChangeCode"
              >
                {{ emailCodeCountdown > 0 ? `重新发送 ${emailCodeCountdown}s` : '发送验证码' }}
              </Button>
            </div>

            <div v-else class="form-stack">
              <div class="notice-box">验证码已发送至 {{ emailChangeForm.newEmail }}</div>
              <Input
                v-model="emailChangeForm.code"
                type="text"
                label="邮箱验证码"
                maxlength="6"
                inputmode="numeric"
                placeholder="000000"
                input-class="text-center font-bold tracking-widest text-lg"
              />
              <div class="inline-actions mobile-row">
                <Button variant="secondary" @click="emailChangeForm.step = 1"> 返回 </Button>
                <Button
                  variant="primary"
                  :disabled="isConfirmingEmail"
                  :loading="isConfirmingEmail"
                  @click="confirmEmailChange"
                >
                  确认更换
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-card security-panel">
          <header class="settings-card-header">
            <h3 class="settings-card-title flex items-center gap-2">
              <span>登录密码</span>
              <Lock class="w-4 h-4 text-[var(--text-muted)]" />
            </h3>
          </header>
          <div class="panel-body p-4">
            <div class="form-stack">
              <Input
                v-model="passwordForm.currentPassword"
                type="password"
                label="当前密码"
                autocomplete="current-password"
                :icon="KeyRound"
              />
              <div class="field-grid gap-2 grid grid-cols-2">
                <Input
                  v-model="passwordForm.newPassword"
                  type="password"
                  label="新密码"
                  autocomplete="new-password"
                />
                <Input
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  label="确认新密码"
                  autocomplete="new-password"
                />
              </div>
              <div class="strength-row">
                <span>强度：{{ passwordStrength.label }}</span>
                <i :class="passwordStrength.tone" :style="{ width: `${passwordStrength.value}%` }"></i>
              </div>
              <Button
                variant="primary"
                :disabled="isChangingPassword"
                :loading="isChangingPassword"
                @click="handleChangePassword"
              >
                更新密码
              </Button>
            </div>
          </div>
        </div>
      </div>

      <section class="settings-card security-panel two-factor-panel">
        <header class="settings-card-header flex items-center justify-between">
          <div class="min-w-0">
            <h3 class="settings-card-title flex items-center gap-2">
              <span>双重验证</span>
              <Fingerprint class="w-4 h-4 text-[var(--text-muted)]" />
            </h3>
            <p class="settings-card-subtitle truncate">
              {{
                authStore.user?.twoFactorEnabled
                  ? '登录时需要动态验证码或恢复码。'
                  : '使用 Authenticator 应用保护登录。'
              }}
            </p>
          </div>
          <em :class="{ enabled: authStore.user?.twoFactorEnabled }" class="two-factor-status shrink-0">
            {{ authStore.user?.twoFactorEnabled ? '已启用' : '未启用' }}
          </em>
        </header>

        <div class="panel-body p-4">
          <div v-if="!authStore.user?.twoFactorEnabled" class="two-factor-setup">
            <button
              v-if="!show2FASetup"
              type="button"
              class="setup-button"
              :disabled="is2FALoading"
              @click="start2FASetup"
            >
              <Plus />
              {{ is2FALoading ? '准备中...' : '开始启用双重验证' }}
            </button>

            <div v-else class="setup-grid">
              <div class="qr-box">
                <img :src="qrCodeUrl" alt="2FA QR Code" />
                <div v-if="secretKey" class="secret-key-display">
                  <span class="secret-key-title">手动录入密钥</span>
                  <code class="secret-key-value">{{ secretKey }}</code>
                  <button type="button" class="secret-key-copy" @click="copySecret">
                    <Copy />
                    <span>复制密钥</span>
                  </button>
                </div>
              </div>
              <div class="form-stack">
                <div class="notice-box">扫描二维码后，输入当前密码和应用中的 6 位验证码完成启用。</div>
                <div v-if="setupRecoveryCodes.length > 0" class="recovery-box">
                  <div class="panel-title flex justify-between items-center mb-2">
                    <span class="text-xs font-bold">初始恢复码</span>
                    <button type="button" class="secret-key-copy" @click="copyRecoveryCodes(setupRecoveryCodes)">
                      <Copy />
                      复制
                    </button>
                  </div>
                  <div class="code-grid">
                    <code v-for="code in setupRecoveryCodes" :key="code">{{ code }}</code>
                  </div>
                </div>
                <div class="field-grid gap-2 grid grid-cols-2">
                  <Input
                    v-model="tfaPassword"
                    type="password"
                    label="当前密码"
                    autocomplete="current-password"
                  />
                  <Input
                    v-model="tfaCode"
                    type="text"
                    label="动态验证码"
                    maxlength="6"
                    inputmode="numeric"
                    placeholder="000000"
                  />
                </div>
                <div class="inline-actions mobile-row">
                  <Button variant="secondary" @click="show2FASetup = false"> 取消 </Button>
                  <Button
                    variant="primary"
                    :disabled="is2FALoading"
                    :loading="is2FALoading"
                    @click="confirm2FA"
                  >
                    验证并启用
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="enabled-grid">
            <div class="recovery-box">
              <div class="panel-title flex justify-between items-center mb-2">
                <span class="text-xs font-bold">恢复码</span>
                <strong class="text-xs text-[var(--text-muted)]">{{ recoveryCodeCount }} 枚可用</strong>
              </div>
              <p class="text-xs text-[var(--text-muted)] mb-3">恢复码只会在生成时完整显示，请保存到安全的位置。</p>
              <div class="field-grid gap-2 grid grid-cols-2 mb-3">
                <Input
                  v-model="regeneratePassword"
                  type="password"
                  label="当前密码"
                  autocomplete="current-password"
                />
                <Input
                  v-model="regenerateCode"
                  type="text"
                  label="或 2FA 验证码"
                  maxlength="6"
                  inputmode="numeric"
                  placeholder="000000"
                />
              </div>
              <Button
                variant="secondary"
                class="w-full mb-3"
                :disabled="isRegeneratingCodes"
                :loading="isRegeneratingCodes"
                :icon="RefreshCw"
                @click="regenerateRecoveryCodes"
              >
                重新生成恢复码
              </Button>
              <div v-if="regeneratedRecoveryCodes.length > 0" class="code-grid mb-2">
                <code v-for="code in regeneratedRecoveryCodes" :key="code">{{ code }}</code>
              </div>
              <button
                v-if="regeneratedRecoveryCodes.length > 0"
                type="button"
                class="secret-key-copy"
                @click="copyRecoveryCodes(regeneratedRecoveryCodes)"
              >
                <Copy />
                复制新恢复码
              </button>
            </div>

            <div class="disable-box">
              <div class="panel-title flex justify-between items-center mb-2">
                <span class="text-xs font-bold">关闭双重验证</span>
                <ShieldAlert class="w-4 h-4 text-rose-500" />
              </div>
              <p class="text-xs text-[var(--text-muted)] mb-3">需要当前密码或 2FA 验证码。关闭后，账号登录安全等级会下降。</p>
              <Input
                v-model="disable2FACode"
                type="text"
                label="2FA 验证码"
                maxlength="6"
                inputmode="numeric"
                placeholder="000000"
                class="mb-2"
              />
              <Input
                v-model="disablePassword"
                type="password"
                label="或当前密码"
                autocomplete="current-password"
                class="mb-3"
              />
              <Button
                variant="danger"
                class="w-full"
                :disabled="isDisabling2FA"
                :loading="isDisabling2FA"
                @click="disable2FA"
              >
                关闭双重验证
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="settings-card security-panel">
      <header class="settings-card-header flex items-center justify-between">
        <h3 class="settings-card-title flex items-center gap-2">
          <span>受信设备</span>
          <Smartphone class="w-4 h-4 text-[var(--text-muted)]" />
        </h3>
        <Button
          size="sm"
          variant="secondary"
          :icon="RefreshCw"
          :loading="isLoadingDevices"
          @click="fetchTrustedDevices"
        >
          刷新
        </Button>
      </header>

      <div class="panel-body p-4">
        <div v-if="isLoadingDevices" class="device-skeletons">
          <i v-for="item in 2" :key="item"></i>
        </div>

        <div v-else-if="trustedDevices.length > 0" class="device-list">
          <article v-for="(device, index) in trustedDevices" :key="device.id" class="device-row">
            <Smartphone />
            <div>
              <strong>受信设备 #{{ index + 1 }}</strong>
              <span>添加时间：{{ formatDate(device.createdAt) }}</span>
            </div>
            <button type="button" title="移除设备" @click="revokeDevice(device.id)">
              <Trash2 />
            </button>
          </article>
        </div>

        <div v-else class="empty-devices">
          <Smartphone />
          <span>暂无受信设备</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.security-layout-main {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.security-left-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.current-email {
  margin: 0 0 10px;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-stack label span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.notice-box {
  border-radius: 8px;
  padding: 9px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
}

.strength-row {
  position: relative;
  height: 26px;
  display: grid;
  align-items: end;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.strength-row::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 12%, transparent);
}

.strength-row i {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 1;
  height: 6px;
  border-radius: 999px;
}

.strength-row i.green {
  background: #10b981;
}

.strength-row i.amber {
  background: #f59e0b;
}

.strength-row i.red {
  background: #ef4444;
}

.two-factor-panel {
  display: grid;
  gap: 10px;
}

.two-factor-status {
  height: 24px;
  border-radius: 999px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
}

.two-factor-status.enabled {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.2);
  color: #10b981;
  font-weight: 600;
}

.setup-button {
  width: 100%;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed color-mix(in srgb, var(--accent) 50%, var(--border-base));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
}

.setup-grid,
.enabled-grid {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
}

.enabled-grid {
  grid-template-columns: minmax(0, 1fr) 280px;
}

.qr-box {
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--bg-app);
  padding: 10px;
}

.qr-box img {
  width: 130px;
  height: 130px;
}

.recovery-box,
.disable-box {
  display: grid;
  gap: 9px;
  border-radius: 8px;
  padding: 10px;
  background: var(--bg-app);
}

.disable-box {
  background: rgba(239, 68, 68, 0.09);
}

.code-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.code-grid code {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 6px;
  background: var(--bg-card);
  text-align: center;
  font-size: 11.5px;
}

.device-list,
.device-skeletons {
  display: grid;
  gap: 9px;
}

.device-skeletons i {
  height: 46px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
  animation: pulse 1.1s ease-in-out infinite;
}

.device-row {
  min-height: 46px;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 6px 8px;
  background: var(--bg-app);
}

.device-row > svg {
  width: 16px;
  height: 16px;
  color: var(--accent);
}

.device-row strong {
  font-size: 13px;
  font-weight: 900;
}

.device-row span {
  font-size: 12px;
  color: var(--text-muted);
}

.device-row button {
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.device-row button:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.empty-devices {
  min-height: 90px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

.empty-devices svg {
  width: 24px;
  height: 24px;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 980px) {
  .security-layout-main,
  .setup-grid,
  .enabled-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .code-grid {
    grid-template-columns: 1fr;
  }

  .inline-actions {
    flex-direction: column;
  }
}

.secret-key-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  width: 100%;
}

.secret-key-title {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.secret-key-value {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
  padding: 4px 8px;
  border-radius: 4px;
  word-break: break-all;
  text-align: center;
  max-width: 150px;
  user-select: all;
}

.secret-key-copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-weight: 600;
}

.secret-key-copy:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.secret-key-copy svg {
  width: 12px;
  height: 12px;
}
</style>

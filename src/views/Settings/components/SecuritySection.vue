<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  AtSign,
  Lock,
  Fingerprint,
  Plus,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  Trash2,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { getApiErrorMessage } from '@/utils/error';
import {
  changeEmail,
  fetchRecoveryCodes as fetchRecoveryCodesRequest,
  fetchTrustedDevices as fetchTrustedDevicesRequest,
  regenerateRecoveryCodes as regenerateRecoveryCodesRequest,
  revokeTrustedDevice,
  sendEmailChangeCode as sendEmailChangeCodeRequest,
} from '@/services/account.service';

const authStore = useAuthStore();

// Email Change State
const emailChangeForm = ref({
  newEmail: '',
  code: '',
  step: 1 as 1 | 2,
});
const isSendingEmailCode = ref(false);
const isConfirmingEmail = ref(false);
const emailCodeCountdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const startEmailCountdown = () => {
  emailCodeCountdown.value = 60;
  countdownTimer = setInterval(() => {
    if (emailCodeCountdown.value > 0) {
      emailCodeCountdown.value--;
    } else {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    }
  }, 1000);
};

const sendEmailChangeCode = async () => {
  if (!emailChangeForm.value.newEmail) {
    return ElMessage.warning('请输入新邮箱地址');
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
  if (!emailChangeForm.value.code) {
    return ElMessage.warning('请输入验证码');
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

// Password Change State
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const handleChangePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致');
    return;
  }
  if (passwordForm.value.newPassword.length < 6) {
    ElMessage.warning('新密码长度至少为 6 位');
    return;
  }
  try {
    await authStore.changePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    ElMessage.success('密码已成功修改');
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '修改密码失败'));
  }
};

// Two Factor Auth State
const is2FALoading = ref(false);
const qrCodeUrl = ref('');
const tfaCode = ref('');
const show2FASetup = ref(false);
const recoveryCodes = ref<string[]>([]);
const showRecoveryCodes = ref(false);

const start2FASetup = async () => {
  is2FALoading.value = true;
  try {
    const data = await authStore.setup2FA();
    qrCodeUrl.value = data.qrCodeUrl;
    recoveryCodes.value = data.recoveryCodes || [];
    show2FASetup.value = true;
  } catch {
    ElMessage.error('无法启动两步验证设置');
  } finally {
    is2FALoading.value = false;
  }
};

const fetchRecoveryCodes = async () => {
  try {
    recoveryCodes.value = await fetchRecoveryCodesRequest();
    showRecoveryCodes.value = true;
  } catch {
    ElMessage.error('无法获取恢复代码');
  }
};

const regenerateRecoveryCodes = async () => {
  try {
    recoveryCodes.value = await regenerateRecoveryCodesRequest();
    ElMessage.success('已重新生成恢复代码');
  } catch {
    ElMessage.error('重新生成失败');
  }
};

const confirm2FA = async () => {
  try {
    await authStore.enable2FA(tfaCode.value);
    ElMessage.success('两步验证已成功启用');
    show2FASetup.value = false;
    tfaCode.value = '';
  } catch {
    ElMessage.error('验证码错误');
  }
};

const disable2FA = async () => {
  try {
    await authStore.disable2FA();
    ElMessage.success('两步验证已禁用');
  } catch {
    ElMessage.error('禁用失败');
  }
};

// Trusted Devices State
interface TrustedDevice {
  id: string;
  deviceName?: string | null;
  browser?: string | null;
  os?: string | null;
  ip?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string | null;
}

const trustedDevices = ref<TrustedDevice[]>([]);
const isLoadingDevices = ref(false);

const fetchTrustedDevices = async () => {
  isLoadingDevices.value = true;
  try {
    trustedDevices.value = await fetchTrustedDevicesRequest();
  } catch (error) {
    console.error('Fetch trusted devices error:', error);
  } finally {
    isLoadingDevices.value = false;
  }
};

const revokeDevice = async (deviceId: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要移除此受信任设备吗？移除后该设备登录时需要重新验证。',
      '移除设备',
      {
        confirmButtonText: '确认移除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await revokeTrustedDevice(deviceId);
    ElMessage.success('设备已移除');
    fetchTrustedDevices();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('移除设备失败');
    }
  }
};

onMounted(() => {
  fetchTrustedDevices();
});

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
</script>

<template>
  <div class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Email Change -->
    <div class="p-4 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-violet-600">
          <AtSign class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-lg font-bold" style="color: var(--text-primary)">邮箱地址</h3>
          <p class="text-[10px] font-medium text-slate-400 mt-0.5">
            当前邮箱: {{ authStore.user?.email }}
          </p>
        </div>
      </div>

      <div v-if="emailChangeForm.step === 1" class="space-y-4">
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">新邮箱地址</label>
          <input
            v-model="emailChangeForm.newEmail"
            type="email"
            class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
            placeholder="newemail@example.com"
          />
        </div>
        <button type="button" :disabled="isSendingEmailCode || emailCodeCountdown > 0" class="px-6 py-2.5 bg-accent text-white font-bold rounded-xl text-xs hover:scale-105 transition-all disabled:opacity-50" @click="sendEmailChangeCode">
          {{
            isSendingEmailCode
              ? '正在发送...'
              : emailCodeCountdown > 0
                ? `重试 (${emailCodeCountdown}s)`
                : '发送验证码'
          }}
        </button>
      </div>

      <div v-else class="space-y-4">
        <div class="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-2xl border border-violet-100 dark:border-violet-900/20">
          <p class="text-xs text-violet-700 dark:text-violet-300 font-medium">
            验证码已发送至 {{ emailChangeForm.newEmail }}
          </p>
        </div>
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">验证码</label>
          <div class="flex gap-3">
            <input
              v-model="emailChangeForm.code"
              type="text"
              maxlength="6"
              autocomplete="one-time-code"
              class="flex-1 px-4 py-3 rounded-2xl border text-center font-black tracking-[0.5em] transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="000000"
            />
            <button type="button" :disabled="isConfirmingEmail || emailChangeForm.code.length !== 6" class="px-6 py-3 bg-accent text-white font-bold rounded-2xl text-xs disabled:opacity-50" @click="confirmEmailChange">
              {{ isConfirmingEmail ? '更换中...' : '确认更换' }}
            </button>
          </div>
        </div>
        <button type="button" class="text-xs text-slate-400 hover:text-slate-600" @click="emailChangeForm.step = 1">
          返回上一步
        </button>
      </div>
    </div>

    <!-- Password Change -->
    <div class="p-4 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
          <Lock class="w-5 h-5" />
        </div>
        <h3 class="text-lg font-bold" style="color: var(--text-primary)">修改密码</h3>
      </div>

      <div class="space-y-6">
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">当前密码</label>
          <input
            v-model="passwordForm.currentPassword"
            type="password"
            class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">新密码</label>
            <input
              v-model="passwordForm.newPassword"
              type="password"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">确认新密码</label>
            <input
              v-model="passwordForm.confirmPassword"
              type="password"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
        </div>
        <div class="pt-2">
          <button type="button" class="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:opacity-80 transition-all" @click="handleChangePassword">
            更新密码
          </button>
        </div>
      </div>
    </div>

    <!-- Two Factor Auth -->
    <div class="p-4 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
            <Fingerprint class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-lg font-bold" style="color: var(--text-primary)">
              两步验证 (2FA)
            </h3>
            <p class="text-[10px] font-medium text-slate-400 mt-0.5">
              为你的账号增加额外安全屏障
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="text-[10px] font-bold px-2 py-0.5 rounded-full"
            :class="
              authStore.user?.twoFactorEnabled
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-400'
            "
          >
            {{ authStore.user?.twoFactorEnabled ? '已启用' : '未启用' }}
          </span>
        </div>
      </div>

      <div v-if="!authStore.user?.twoFactorEnabled">
        <p class="text-xs leading-relaxed mb-6" style="color: var(--text-secondary)">
          启用两步验证后，在登录时除了输入密码，还需要输入手机身份验证器（如 Google
          Authenticator）生成的动态验证码。
        </p>
        <button v-if="!show2FASetup" type="button" class="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-500 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2" @click="start2FASetup">
          <Plus class="w-4 h-4" /> 开启两步验证
        </button>

        <div v-else class="space-y-6 animate-in zoom-in-95 duration-300">
          <div class="flex flex-col md:flex-row gap-8 items-center bg-slate-50 dark:bg-white/5 p-6 rounded-2xl">
            <div class="p-2 bg-white rounded-xl shadow-lg">
              <img alt="" :src="qrCodeUrl" class="w-32 h-32" />
            </div>
            <div class="flex-1 space-y-3">
              <p class="text-xs font-bold">1. 扫描二维码</p>
              <p class="text-[10px] text-slate-500 leading-relaxed">
                使用手机上的 Authenticator App
                扫描左侧二维码。如果无法扫描，可以手动输入密钥。
              </p>

              <div v-if="recoveryCodes.length > 0" class="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl space-y-2">
                <p class="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <ShieldAlert class="w-3 h-3" /> 请保存这些恢复代码
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
                  <code
                    v-for="code in recoveryCodes"
                    :key="code"
                    class="text-[10px] bg-white dark:bg-slate-900 px-2 py-1 rounded border border-amber-200 dark:border-amber-900/30 text-center"
                  >{{ code }}</code>
                </div>
                <p class="text-[9px] text-amber-600/70 dark:text-amber-500/50">
                  如果丢失手机，您可以使用这些代码登录。每个代码只能使用一次。
                </p>
              </div>

              <div class="flex gap-2">
                <input
                  v-model="tfaCode"
                  type="text"
                  maxlength="6"
                  autocomplete="one-time-code"
                  class="flex-1 px-4 py-2 rounded-xl border text-sm text-center font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="000000"
                />
                <button type="button" class="px-6 py-2 bg-accent text-white font-bold rounded-xl text-xs" @click="confirm2FA">
                  验证并启用
                </button>
              </div>
            </div>
          </div>
          <button type="button" class="text-xs text-slate-400 hover:text-slate-600" @click="show2FASetup = false">
            取消设置
          </button>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
          <CheckCircle2 class="w-5 h-5 text-emerald-500" />
          <p class="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
            您的账号正在受到两步验证的保护。
          </p>
        </div>

        <div class="space-y-4">
          <div
            v-if="showRecoveryCodes"
            class="p-6 bg-slate-50 dark:bg-white/5 border rounded-2xl space-y-4 animate-in zoom-in-95 duration-300"
            style="border-color: var(--border-base)"
          >
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold" style="color: var(--text-primary)">恢复代码</h4>
              <button type="button" class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1" @click="regenerateRecoveryCodes">
                <RefreshCw class="w-3 h-3" /> 重新生成
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
              <code
                v-for="code in recoveryCodes"
                :key="code"
                class="text-xs bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-center font-mono tracking-wider"
              >{{ code }}</code>
            </div>
            <p class="text-[10px] text-slate-400 leading-relaxed">
              这些代码可以用于在丢失身份验证器时找回账号。请将它们保存在安全的地方。
            </p>
          </div>

          <div class="flex items-center gap-4">
            <button type="button" class="text-xs font-bold text-accent hover:underline" @click="showRecoveryCodes ? (showRecoveryCodes = false) : fetchRecoveryCodes()">
              {{ showRecoveryCodes ? '隐藏恢复代码' : '查看恢复代码' }}
            </button>
            <span class="w-1 h-1 rounded-full bg-slate-300"></span>
            <button type="button" class="text-xs font-bold text-rose-500 hover:underline" @click="disable2FA">
              关闭两步验证
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Trusted Devices -->
    <div class="p-4 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600">
          <Smartphone class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-lg font-bold" style="color: var(--text-primary)">受信任设备</h3>
          <p class="text-[10px] font-medium text-slate-400 mt-0.5">
            这些设备在两步验证时被标记为信任，登录时无需再次验证
          </p>
        </div>
      </div>

      <div v-if="isLoadingDevices" class="space-y-3">
        <div
          v-for="i in 2"
          :key="i"
          class="h-14 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse"
        ></div>
      </div>

      <div v-else-if="trustedDevices.length > 0" class="space-y-3">
        <div
          v-for="device in trustedDevices"
          :key="device.id"
          class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5"
        >
          <div class="flex items-center gap-3">
            <Smartphone class="w-4 h-4 text-slate-400" />
            <div>
              <p class="text-xs font-bold" style="color: var(--text-primary)">受信任设备</p>
              <p class="text-[10px] text-slate-400">
                添加于 {{ device.createdAt ? new Date(device.createdAt).toLocaleDateString() : '-' }}
              </p>
            </div>
          </div>
          <button type="button" class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-all" @click="revokeDevice(device.id)">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div v-else class="text-center py-8">
        <p class="text-xs text-slate-400">暂无受信任设备</p>
      </div>
    </div>
  </div>
</template>

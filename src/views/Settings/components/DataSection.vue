<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Download, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { preferences } from '@/utils/preferences';
import { exportAccountData, deleteAccount } from '@/services/account.service';

const router = useRouter();
const authStore = useAuthStore();

const deleteAccountConfirm = ref('');
const delete2FACode = ref('');
const showDelete2FAStep = ref(false);
const isDeletingAccount = ref(false);

const exportData = async () => {
  try {
    ElMessage.info('正在准备数据导出...');
    const exportObj = await exportAccountData();
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('数据导出成功');
  } catch {
    ElMessage.error('数据导出失败');
  }
};

const handleDeleteAccount = async () => {
  if (deleteAccountConfirm.value !== 'DELETE') {
    return ElMessage.warning('请输入 DELETE 以确认删除');
  }

  if (authStore.user?.twoFactorEnabled && !showDelete2FAStep.value) {
    showDelete2FAStep.value = true;
    return;
  }

  if (authStore.user?.twoFactorEnabled && !delete2FACode.value) {
    return ElMessage.warning('请输入两步验证码');
  }

  try {
    isDeletingAccount.value = true;
    await deleteAccount(authStore.user?.twoFactorEnabled ? delete2FACode.value : undefined);
    ElMessage.success('账号已成功注销');
    preferences.clearLegacyAuthTokens();
    router.push('/login');
  } catch (error) {
    const errData = (error as { response?: { data?: { twoFactorRequired?: boolean; error?: string } } }).response?.data;
    if (errData?.twoFactorRequired) {
      showDelete2FAStep.value = true;
      ElMessage.warning('此账号已启用两步验证，请输入验证码');
    } else {
      ElMessage.error(errData?.error || '注销账号失败');
    }
  } finally {
    isDeletingAccount.value = false;
  }
};
</script>

<template>
  <div class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="p-5 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
          <Download class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-lg font-bold" style="color: var(--text-primary)">数据导出</h3>
          <p class="text-[10px] font-medium text-slate-400 mt-0.5">下载您的个人数据副本</p>
        </div>
      </div>
      <p class="text-xs leading-relaxed mb-6" style="color: var(--text-secondary)">
        您可以随时导出您的个人资料、团队信息等数据。导出文件为 JSON
        格式，包含您在平台上的所有个人数据。
      </p>
      <button type="button" class="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:scale-105 transition-all flex items-center gap-2" @click="exportData">
        <Download class="w-4 h-4" />
        导出我的数据
      </button>
    </div>

    <div class="p-5 lg:p-8 rounded-2xl lg:rounded-3xl border border-rose-200 dark:border-rose-900/50 transition-colors duration-300" style="background-color: var(--bg-card)">
      <div class="flex items-center gap-3 mb-8">
        <div class="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600">
          <ShieldAlert class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-lg font-bold text-rose-600">危险区域</h3>
          <p class="text-[10px] font-medium text-slate-400 mt-0.5">
            以下操作不可逆，请谨慎操作
          </p>
        </div>
      </div>

      <div class="space-y-6">
        <div class="p-6 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
          <h4 class="text-sm font-bold text-rose-700 dark:text-rose-400 mb-2">注销账号</h4>
          <p class="text-xs text-rose-600/70 dark:text-rose-400/70 leading-relaxed mb-4">
            注销后，您的所有数据将被永久删除且无法恢复，包括个人资料、资产、讨论、团队关系等。此操作不可逆。
          </p>
          <div class="space-y-3">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-rose-500 ml-1">请输入 DELETE 以确认</label>
              <input
                v-model="deleteAccountConfirm"
                type="text"
                class="w-full px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                placeholder="DELETE"
              />
            </div>
            <div
              v-if="showDelete2FAStep && authStore.user?.twoFactorEnabled"
              class="space-y-2 animate-in zoom-in-95 duration-300"
            >
              <div class="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30">
                <ShieldCheck class="w-4 h-4 text-amber-600 shrink-0" />
                <p class="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                  此账号已启用两步验证，请输入验证器中的动态验证码
                </p>
              </div>
              <div class="flex gap-3">
                <input
                  v-model="delete2FACode"
                  type="text"
                  maxlength="6"
                  class="flex-1 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-rose-950/30 text-center font-black tracking-[0.5em] text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  placeholder="000000"
                />
              </div>
            </div>
            <button
type="button" :disabled="
                isDeletingAccount ||
                deleteAccountConfirm !== 'DELETE' ||
                (showDelete2FAStep && authStore.user?.twoFactorEnabled && !delete2FACode)
              " class="px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2" @click="handleDeleteAccount">
              <Trash2 class="w-3.5 h-3.5" />
              {{
                isDeletingAccount
                  ? '正在注销...'
                  : showDelete2FAStep
                    ? '验证并注销账号'
                    : '永久注销账号'
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

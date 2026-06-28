<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';

// Subcomponents
import GoogleWarmingConsoleTab from './components/GoogleWarmingConsoleTab.vue';
import GoogleAccountsTab from './components/GoogleAccountsTab.vue';
import GoogleWarmingHeader from './components/GoogleWarmingHeader.vue';
import GoogleWarmingAccountList from './components/GoogleWarmingAccountList.vue';
import GoogleWarmingImportDialog from './components/GoogleWarmingImportDialog.vue';
import GoogleWarmingEditDialog from './components/GoogleWarmingEditDialog.vue';
import GoogleWarmingPasswordGenDialog from './components/GoogleWarmingPasswordGenDialog.vue';

interface GoogleAccount {
  id: string;
  email: string;
  password?: string;
  recoveryEmail?: string;
  twoFASecret?: string;
  country?: string;
  note?: string;
  backupCodes?: string;
  category?: string;
  status: 'warming' | 'completed' | 'paused';
  currentDay: number;
  lastWarmedAt?: string;
  createdAt: string;
}

const { t } = useI18n();
const accounts = ref<GoogleAccount[]>([]);
const selectedAccountId = ref<string>('');
const isLoading = ref<boolean>(false);
const isImporting = ref<boolean>(false);
const testMode = ref<boolean>(true); // Dev test mode: allows consecutive check-ins
const activeMobileView = ref<'list' | 'detail'>('list');

const openImportDialog = () => {
  isImporting.value = true;
};

// Edit account modal
const isEditDialogVisible = ref<boolean>(false);
const editingAccount = ref<Partial<GoogleAccount>>({});

// Search and status filters (Warming workspace list)
const searchQuery = ref<string>('');
const statusFilter = ref<'all' | 'warming' | 'completed' | 'paused'>('all');

// Batch selection
const selectedAccountIds = ref<string[]>([]);

// Tabs
const activeTab = ref<'warming' | 'manage'>('warming');
const categoriesListBackend = ref<string[]>([]);

// Compute categories list dynamically
const categoriesList = computed(() => {
  const cats = new Set<string>(categoriesListBackend.value);
  accounts.value.forEach((a) => {
    if (a.category && a.category !== '未分类') {
      cats.add(a.category);
    }
  });
  const list = Array.from(cats).filter((c) => c !== '未分类' && c.trim() !== '');
  return ['all', '未分类', ...list];
});

const fetchCategories = async () => {
  try {
    const res = await api.get('/api/google-warming/accounts/categories');
    if (res.data && res.data.categories) {
      categoriesListBackend.value = res.data.categories;
    }
  } catch (e: unknown) {
    logError(e, { operation: 'fetchCategories', view: 'GoogleWarmingView' });
  }
};

const handleAddCategory = async (cat: string) => {
  try {
    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/categories/add', {
      category: cat,
    });
    if (res.data && res.data.success) {
      ElMessage.success(`添加分类「${cat}」成功！`);
      await fetchCategories();
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '添加分类失败'));
  } finally {
    isLoading.value = false;
  }
};

const selectedAccount = computed(() => {
  return accounts.value.find((a) => a.id === selectedAccountId.value) || null;
});

// Fetch accounts on mount
onMounted(async () => {
  await fetchCategories();
  await fetchAccounts();
  if (filteredAccounts.value.length > 0) {
    selectAccount(filteredAccounts.value[0].id);
  }
  startTotpTimer();
});

const fetchAccounts = async () => {
  isLoading.value = true;
  try {
    const res = await api.get('/api/google-warming/accounts');
    accounts.value = res.data || [];
    await fetchCategories();
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('tools.googleWarming.fetch_accounts_failed')));
  } finally {
    isLoading.value = false;
  }
};

const selectAccount = (id: string) => {
  selectedAccountId.value = id;
  if (window.innerWidth < 1024) {
    activeMobileView.value = 'detail';
  }
};

// Filtered accounts computed (Warming workspace list)
const filteredAccounts = computed(() => {
  return accounts.value.filter((acc) => {
    const query = searchQuery.value.trim().toLowerCase();
    const matchQuery =
      !query ||
      acc.email.toLowerCase().includes(query) ||
      (acc.note && acc.note.toLowerCase().includes(query)) ||
      (acc.country && acc.country.toLowerCase().includes(query));

    const matchStatus = statusFilter.value === 'all' || acc.status === statusFilter.value;
    return matchQuery && matchStatus;
  });
});

// Batch Action handlers
const handleBatchWarm = async (customIds?: string[]) => {
  const targetIds = customIds || selectedAccountIds.value;
  if (targetIds.length === 0) return;
  try {
    if (!customIds) {
      await ElMessageBox.confirm(
        `确定要对已选的 ${targetIds.length} 个账号进行一键打卡吗？`,
        '批量打卡提示',
        {
          confirmButtonText: '确定打卡',
          cancelButtonText: '取消',
          type: 'success',
          customClass: 'dark:bg-slate-900 border-none',
        },
      );
    }

    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/batch-warm', {
      ids: targetIds,
    });

    if (res.data && res.data.success) {
      ElMessage.success(`成功打卡 ${res.data.count} 个账号！`);
      selectedAccountIds.value = [];
      await fetchAccounts();
    }
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, '批量打卡失败'));
    }
  } finally {
    isLoading.value = false;
  }
};

const handleBatchDelete = async (customIds?: string[]) => {
  const targetIds = customIds || selectedAccountIds.value;
  if (targetIds.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确定要删除已选的 ${targetIds.length} 个账号吗？此操作将永久清除养号进度且不可逆！`,
      '批量删除警告',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'dark:bg-slate-900 border-none',
      },
    );

    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/batch-delete', {
      ids: targetIds,
    });

    if (res.data && res.data.success) {
      ElMessage.success(`成功批量删除 ${res.data.count} 个账号！`);
      selectedAccountIds.value = [];
      await fetchAccounts();
      if (filteredAccounts.value.length > 0) {
        selectAccount(filteredAccounts.value[0].id);
      } else {
        selectedAccountId.value = '';
      }
    }
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, '批量删除失败'));
    }
  } finally {
    isLoading.value = false;
  }
};

const handleBatchStatus = async (payload: {
  ids: string[];
  status: 'warming' | 'completed' | 'paused';
}) => {
  const { ids, status } = payload;
  if (ids.length === 0) return;
  try {
    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/batch-status', {
      ids,
      status,
    });

    if (res.data && res.data.success) {
      ElMessage.success(`成功更新 ${res.data.count} 个账号状态！`);
      selectedAccountIds.value = [];
      await fetchAccounts();
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '批量更新状态失败'));
  } finally {
    isLoading.value = false;
  }
};

const handleBatchCommand = (cmd: string) => {
  if (cmd === 'warm') {
    handleBatchWarm();
  } else if (cmd === 'delete') {
    handleBatchDelete();
  } else if (cmd === 'status-warming') {
    handleBatchStatus({ ids: selectedAccountIds.value, status: 'warming' });
  } else if (cmd === 'status-paused') {
    handleBatchStatus({ ids: selectedAccountIds.value, status: 'paused' });
  } else if (cmd === 'status-completed') {
    handleBatchStatus({ ids: selectedAccountIds.value, status: 'completed' });
  }
};

// Submit bulk imports
const submitImport = async (accountsToImport: Array<Partial<GoogleAccount>>) => {
  if (accountsToImport.length === 0) return;

  try {
    const res = await api.post('/api/google-warming/accounts/import', {
      accounts: accountsToImport,
    });
    if (res.data && res.data.success) {
      ElMessage.success(`导入成功，共录入 ${res.data.count} 个谷歌账号`);
      isImporting.value = false;
      await fetchAccounts();
      if (accounts.value.length > 0) {
        selectAccount(accounts.value[0].id);
      }
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '导入账号失败'));
  }
};

// Complete warming task
const handleWarmStep = async () => {
  const account = selectedAccount.value;
  if (!account) return;

  try {
    const res = await api.post(`/api/google-warming/accounts/${account.id}/warm`);
    if (res.data) {
      const idx = accounts.value.findIndex((a) => a.id === account.id);
      if (idx > -1) {
        accounts.value[idx] = res.data;
      }
      ElMessage.success(`恭喜！第 ${account.currentDay} 天养号任务已打卡完成！`);
      selectAccount(account.id);
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '打卡失败，请重试'));
  }
};

// Check if already warmed today
const isWarmedToday = computed(() => {
  const account = selectedAccount.value;
  if (!account || !account.lastWarmedAt) return false;

  if (testMode.value) return false; // Dev test mode ignores date checks

  const lastWarmed = new Date(account.lastWarmedAt);
  const today = new Date();
  return lastWarmed.toDateString() === today.toDateString();
});

// Edit account details
const startEditAccount = (account: GoogleAccount) => {
  editingAccount.value = { ...account };
  isEditDialogVisible.value = true;
};

const saveAccountEdit = async () => {
  const account = editingAccount.value;
  if (!account.id) return;

  try {
    const res = await api.put(`/api/google-warming/accounts/${account.id}`, account);
    if (res.data) {
      const idx = accounts.value.findIndex((a) => a.id === account.id);
      if (idx > -1) {
        accounts.value[idx] = res.data;
      }
      ElMessage.success('更新账号详情成功');
      isEditDialogVisible.value = false;
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '保存失败'));
  }
};

// Inline category editing helpers
const handleInlineCategory = async (payload: { row: GoogleAccount; cmd: string }) => {
  const { row, cmd } = payload;
  await updateAccountCategory(row, cmd);
};

const updateAccountCategory = async (row: GoogleAccount, category: string) => {
  try {
    isLoading.value = true;
    const res = await api.put(`/api/google-warming/accounts/${row.id}`, {
      ...row,
      category,
    });
    if (res.data) {
      const idx = accounts.value.findIndex((a) => a.id === row.id);
      if (idx > -1) {
        accounts.value[idx] = res.data;
      }
      ElMessage.success(`已将该账号分类修改为「${category}」`);
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '修改分类失败'));
  } finally {
    isLoading.value = false;
  }
};

// Category Management (Rename & Delete)
const handleRenameCategory = async (payload: { oldCategory: string; newCategory: string }) => {
  const { oldCategory, newCategory } = payload;
  try {
    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/category/rename', {
      oldCategory,
      newCategory,
    });
    if (res.data && res.data.success) {
      ElMessage.success(`重命名分类成功！已更新 ${res.data.count} 个账号。`);
      await fetchAccounts();
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '重命名分类失败'));
  } finally {
    isLoading.value = false;
  }
};

const handleDeleteCategory = async (cat: string) => {
  try {
    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/category/delete', {
      category: cat,
    });
    if (res.data && res.data.success) {
      ElMessage.success(`删除分类成功！已重置 ${res.data.count} 个账号至「未分类」。`);
      await fetchAccounts();
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '删除分类失败'));
  } finally {
    isLoading.value = false;
  }
};

const handleBatchCategory = async (payload: { ids: string[]; category: string }) => {
  const { ids, category } = payload;
  try {
    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/batch-category', {
      ids,
      category,
    });
    if (res.data && res.data.success) {
      ElMessage.success(`成功移动 ${ids.length} 个账号至分类「${category}」`);
      await fetchAccounts();
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '移动账号分类失败'));
  } finally {
    isLoading.value = false;
  }
};

// Delete account
const deleteAccount = (account: GoogleAccount) => {
  ElMessageBox.confirm(
    t('tools.googleWarming.deleteConfirmText', { email: account.email }),
    t('tools.googleWarming.deleteConfirmTitle'),
    {
      confirmButtonText: t('tools.googleWarming.deleteConfirmBtn'),
      cancelButtonText: t('tools.googleWarming.cancel_btn'),
      type: 'warning',
      customClass: 'dark:bg-slate-900 border-none',
    },
  )
    .then(async () => {
      try {
        await api.delete(`/api/google-warming/accounts/${account.id}`);
        ElMessage.success(t('tools.googleWarming.deleteSuccess'));
        await fetchAccounts();
        if (accounts.value.length > 0) {
          selectAccount(accounts.value[0].id);
        } else {
          selectedAccountId.value = '';
        }
      } catch (e: unknown) {
        ElMessage.error(getApiErrorMessage(e, '删除失败'));
      }
    })
    .catch(() => {});
};

const saveCountryInline = async (country: string) => {
  const account = selectedAccount.value;
  if (!account) return;
  try {
    const res = await api.put(`/api/google-warming/accounts/${account.id}`, {
      ...account,
      country,
    });
    if (res.data) {
      const idx = accounts.value.findIndex((a) => a.id === account.id);
      if (idx > -1) {
        accounts.value[idx] = res.data;
      }
      ElMessage.success('国家地址修改成功');
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '国家地址修改失败'));
  }
};

// --- 2FA / TOTP Generator Logic ---
function decodeBase32(secret: string): Uint8Array {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanSecret = secret.replace(/[\s=]/g, '').toUpperCase();
  const len = cleanSecret.length;
  if (len === 0) return new Uint8Array(0);

  const buffer = new Uint8Array(Math.floor((len * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;

  for (let i = 0; i < len; i++) {
    const val = base32chars.indexOf(cleanSecret[i]);
    if (val === -1) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

async function generateTOTP(secret: string): Promise<{ code: string; timeLeft: number }> {
  try {
    const keyBytes = decodeBase32(secret);
    if (keyBytes.length === 0) {
      return { code: '------', timeLeft: 0 };
    }
    const epoch = Math.round(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    const timeLeft = 30 - (epoch % 30);

    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(0, 0, false);
    counterView.setUint32(4, counter, false);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes as BufferSource,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false,
      ['sign'],
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);

    const hmacResult = new Uint8Array(signature);
    const offset = hmacResult[hmacResult.length - 1] & 0xf;

    const codeInt =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const otp = codeInt % 1000000;
    const code = otp.toString().padStart(6, '0');

    return { code, timeLeft };
  } catch (error) {
    logError(error, { operation: 'generateTOTP', view: 'GoogleWarmingView' });
    return { code: 'ERR!', timeLeft: 0 };
  }
}

const currentTotpCode = ref<string>('------');
const totpTimeLeft = ref<number>(30);
let totpTimer: ReturnType<typeof setInterval> | null = null;

const listTotpCodes = ref<Record<string, { code: string; timeLeft: number }>>({});

const updateAllListTotps = async () => {
  const promises = accounts.value.map(async (acc) => {
    if (acc.twoFASecret) {
      try {
        const result = await generateTOTP(acc.twoFASecret);
        listTotpCodes.value[acc.id] = result;
      } catch {
        listTotpCodes.value[acc.id] = { code: 'ERR!', timeLeft: 0 };
      }
    }
  });
  await Promise.all(promises);
};

const updateTotp = async () => {
  const account = selectedAccount.value;
  if (!account || !account.twoFASecret) {
    currentTotpCode.value = '------';
    totpTimeLeft.value = 0;
    return;
  }

  const { code, timeLeft } = await generateTOTP(account.twoFASecret);
  currentTotpCode.value = code;
  totpTimeLeft.value = timeLeft;
};

const startTotpTimer = () => {
  stopTotpTimer();
  updateTotp();
  updateAllListTotps();
  totpTimer = setInterval(() => {
    updateTotp();
    updateAllListTotps();
  }, 1000);
};

const stopTotpTimer = () => {
  if (totpTimer) {
    clearInterval(totpTimer);
    totpTimer = null;
  }
};

watch(
  () => selectedAccount.value?.twoFASecret,
  () => {
    startTotpTimer();
  },
  { immediate: true },
);

onUnmounted(() => {
  stopTotpTimer();
});

// ── Password Generator ────────────────────────────────────────────────────────
const generateRandomPassword = (targetRef: Partial<GoogleAccount>) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  // Guarantee complexity: select at least one character from each character category
  const guaranteed = [
    chars[Math.floor(Math.random() * 26)],           // Lowercase
    chars[26 + Math.floor(Math.random() * 26)],      // Uppercase
    chars[52 + Math.floor(Math.random() * 10)],      // Digit
    chars[62 + Math.floor(Math.random() * 12)],      // Symbol
  ];
  let password = guaranteed.join('');
  for (let i = 4; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  const shuffled = password
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');
  targetRef.password = shuffled;
  ElMessage.success(t('googleWarming.passwordGenerated'));
};

const isPasswordGenVisible = ref(false);

const openPasswordGenerator = () => {
  isPasswordGenVisible.value = true;
};

// ── Export / Import ──────────────────────────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null);

function handleExportAccounts() {
  if (accounts.value.length === 0) {
    ElMessage.warning(t('googleWarming.noDataToExport'));
    return;
  }
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    total: accounts.value.length,
    accounts: accounts.value.map((acc) => ({
      id: acc.id,
      email: acc.email,
      password: acc.password ?? '',
      recoveryEmail: acc.recoveryEmail ?? '',
      twoFASecret: acc.twoFASecret ?? '',
      country: acc.country ?? '',
      note: acc.note ?? '',
      status: acc.status,
      currentDay: acc.currentDay,
      lastWarmedAt: acc.lastWarmedAt ?? '',
      createdAt: acc.createdAt,
    })),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `google-warming-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success(`已导出 ${accounts.value.length} 个账号`);
}

function triggerImportFile() {
  fileInputRef.value?.click();
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  let parsed: unknown;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    ElMessage.error('文件格式错误，请选择有效的 JSON 备份文件');
    return;
  }

  const list: Partial<GoogleAccount>[] = Array.isArray(parsed)
    ? (parsed as Partial<GoogleAccount>[])
    : ((parsed as { accounts?: Partial<GoogleAccount>[] })?.accounts ?? []);
  if (!list.length) {
    ElMessage.warning('备份文件中没有账号数据');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `即将导入 ${list.length} 个账号，已存在同邮箱的账号将被跳过，是否继续？`,
      '确认导入',
      { confirmButtonText: '确认导入', cancelButtonText: '取消', type: 'info' },
    );
  } catch {
    return;
  }

  let successCount = 0;
  let skipCount = 0;
  const existingEmails = new Set(accounts.value.map((a) => a.email.toLowerCase()));

  for (const acc of list) {
    if (!acc.email) {
      skipCount++;
      continue;
    }
    if (existingEmails.has(acc.email.toLowerCase())) {
      skipCount++;
      continue;
    }
    try {
      await api.post('/api/google-warming/accounts', {
        email: acc.email,
        password: acc.password || undefined,
        recoveryEmail: acc.recoveryEmail || undefined,
        twoFASecret: acc.twoFASecret || undefined,
        country: acc.country || undefined,
        note: acc.note || undefined,
        status: acc.status || 'warming',
        currentDay: acc.currentDay ?? 0,
      });
      existingEmails.add(acc.email.toLowerCase());
      successCount++;
    } catch {
      skipCount++;
    }
  }

  await fetchAccounts();
  ElMessage.success(
    `导入完成：成功 ${successCount} 个${skipCount > 0 ? `，跳过 ${skipCount} 个（重复或错误）` : ''}`,
  );
}
</script>

<template>
  <div class="gw-page mobile-adaptive">
    <div class="w-full space-y-3">
      <GoogleWarmingHeader
        v-model:active-tab="activeTab"
        v-model:test-mode="testMode"
        @export="handleExportAccounts"
        @import-trigger="triggerImportFile"
        @password-gen="openPasswordGenerator"
        @add-account="openImportDialog"
      />

      <input
        ref="fileInputRef"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleImportFile"
      />

      <!-- Tab 1: Interactive Warming Workspace -->
      <div
        v-if="activeTab === 'warming'"
        class="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start"
      >
        <GoogleWarmingAccountList
          v-model:selected-account-ids="selectedAccountIds"
          v-model:search-query="searchQuery"
          v-model:status-filter="statusFilter"
          :class="[activeMobileView === 'list' ? 'flex' : 'hidden lg:flex']"
          :accounts="accounts"
          :filtered-accounts="filteredAccounts"
          :selected-account-id="selectedAccountId"
          :is-loading="isLoading"
          :list-totp-codes="listTotpCodes"
          @select="selectAccount"
          @refresh="fetchAccounts"
          @batch-command="handleBatchCommand"
        />

        <!-- Right Tracking Console Panel -->
        <GoogleWarmingConsoleTab
          :selected-account="selectedAccount"
          :is-warmed-today="isWarmedToday"
          :current-totp-code="currentTotpCode"
          :totp-time-left="totpTimeLeft"
          :test-mode="testMode"
          :active-mobile-view="activeMobileView"
          @back-to-list="activeMobileView = 'list'"
          @warm-step="handleWarmStep"
          @edit="startEditAccount"
          @delete="deleteAccount"
          @update-country="saveCountryInline"
        />
      </div>

      <!-- Tab 2: Account Management Table -->
      <div v-else>
        <GoogleAccountsTab
          :accounts="accounts"
          :is-loading="isLoading"
          :list-totp-codes="listTotpCodes"
          :categories-list="categoriesList"
          @edit="startEditAccount"
          @delete="deleteAccount"
          @inline-category="handleInlineCategory"
          @batch-status="handleBatchStatus"
          @batch-delete="handleBatchDelete"
          @batch-warm="handleBatchWarm"
          @batch-category="handleBatchCategory"
          @add-category="handleAddCategory"
          @rename-category="handleRenameCategory"
          @delete-category="handleDeleteCategory"
        />
      </div>

      <GoogleWarmingImportDialog
        v-model:show="isImporting"
        :categories-list="categoriesList"
        @submit="submitImport"
      />

      <GoogleWarmingEditDialog
        v-model:show="isEditDialogVisible"
        v-model:account="editingAccount"
        :categories-list="categoriesList"
        @save="saveAccountEdit"
        @generate-password="generateRandomPassword"
      />

      <GoogleWarmingPasswordGenDialog v-model:show="isPasswordGenVisible" />
    </div>
  </div>
</template>

<style>
/* =====================================================
   Google Warming View — Theme-Aware Styles
   Uses CSS variables so light/dark themes both work
   ===================================================== */

.gw-page {
  min-height: 100vh;
  background: transparent !important;
  color: var(--text-primary);
  padding: 12px 16px;
}

/* Header */
.gw-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-base);
}
@media (min-width: 768px) {
  .gw-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.gw-title {
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  background: linear-gradient(to right, #a78bfa, #f472b6, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Cards */
.gw-card {
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 16px;
  padding: 24px;
}

/* Text helpers */
.gw-muted-text {
  color: var(--text-muted);
}
.gw-label-bold {
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--text-primary);
}
.gw-section-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}
.gw-icon-muted {
  color: var(--text-muted);
}
.gw-icon-btn {
  color: var(--text-muted);
  background: none;
  border: none;
  padding: 4px;
  border-radius: 6px;
  transition: color 0.2s;
}
.gw-icon-btn:hover {
  color: var(--text-primary);
}

/* Account items */
.gw-account-item {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-base);
  transition: all 0.15s;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: var(--bg-elevated, var(--bg-card));
}
.gw-account-item:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}
.gw-account-item--active {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.12);
}

/* Empty state */
.gw-empty-state {
  padding: 48px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 400px;
}

/* Account detail card */
.gw-account-detail-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
  background: var(--bg-elevated, var(--bg-app));
  border: 1px solid var(--border-base);
  padding: 16px;
  border-radius: 12px;
}
@media (min-width: 640px) {
  .gw-account-detail-card {
    flex-direction: row;
  }
}
.gw-code {
  background: var(--bg-app);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-base);
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}
.gw-icon-action-btn {
  padding: 8px;
  color: var(--text-muted);
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  transition: all 0.15s;
}
.gw-icon-action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.gw-icon-danger-btn {
  padding: 8px;
  color: #f87171;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  transition: all 0.15s;
}
.gw-icon-danger-btn:hover {
  background: rgba(239, 68, 68, 0.08);
  color: #fca5a5;
}

/* Badge */
.gw-badge-indigo {
  font-size: 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  color: #818cf8;
  padding: 4px 12px;
  border-radius: 9999px;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

/* Day circles */
.gw-day-circle {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  border: 1px solid;
  transition: all 0.15s;
  user-select: none;
}
.gw-day-done {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}
.gw-day-current {
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  border-color: #818cf8;
  color: #fff;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
}
.gw-day-future {
  background: var(--bg-elevated, var(--bg-app));
  border-color: var(--border-base);
  color: var(--text-muted);
}

/* Checklist */
.gw-checklist-card {
  background: var(--bg-elevated, var(--bg-app));
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.gw-checklist-header {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-base);
}
.gw-checklist-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary);
}
.gw-check-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--border-base);
  transition: all 0.15s;
  background: var(--bg-card);
}
.gw-check-item:hover {
  border-color: var(--border-strong);
}
.gw-check-item--done {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.2);
}
.gw-check-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}
.gw-action-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border-base);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@media (min-width: 640px) {
  .gw-action-footer {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.gw-btn-disabled {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-elevated, var(--bg-app));
  color: var(--text-muted);
  border: 1px solid var(--border-base);
  font-weight: 600;
  font-size: 0.875rem;
  padding: 10px 20px;
  border-radius: 12px;
}
.gw-btn-secondary {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated, var(--bg-card));
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.75rem;
  transition: all 0.15s;
}
.gw-btn-secondary:hover {
  background: var(--bg-hover);
}

/* Border helpers */
.gw-border-top {
  border-top: 1px solid var(--border-base);
  padding-top: 12px;
}

/* Form fields */
.gw-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gw-field-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
}
.gw-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
}
.gw-input:focus {
  border-color: rgba(139, 92, 246, 0.5);
}

/* Import hint box */
.gw-import-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;
  background: var(--bg-app);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-base);
}

/* Textarea */
.gw-textarea {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: monospace;
  outline: none;
  transition: border-color 0.15s;
  resize: vertical;
}
.gw-textarea:focus {
  border-color: rgba(139, 92, 246, 0.4);
}

/* Table */
.gw-table-wrapper {
  border: 1px solid var(--border-base);
  border-radius: 12px;
  overflow: hidden;
}
.gw-table-head {
  background: var(--bg-app);
  border-bottom: 1px solid var(--border-base);
  color: var(--text-secondary);
  font-weight: 600;
}
.gw-table-row {
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-card);
  transition: background 0.15s;
}
.gw-table-row:hover {
  background: var(--bg-hover);
}
.gw-table-row:last-child {
  border-bottom: none;
}
.gw-table-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 11px;
  color: var(--text-primary);
}
.gw-table-input:focus {
  background: var(--bg-app);
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.3);
}

.custom-el-table {
  --el-table-border-color: var(--border-base);
  --el-table-header-bg-color: var(--bg-app);
  --el-table-row-hover-bg-color: var(--bg-hover);
  background-color: transparent !important;
}
.custom-el-table tr {
  background-color: var(--bg-card) !important;
}
.custom-el-table th {
  color: var(--text-secondary) !important;
  font-weight: 650 !important;
  border-bottom: 1px solid var(--border-base) !important;
}
.custom-el-table td {
  border-bottom: 1px solid var(--border-base) !important;
}
</style>

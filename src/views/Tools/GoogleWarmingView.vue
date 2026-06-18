<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Shield,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  RefreshCw,
  Copy,
  Download,
  Upload,
  Key,
  Search,
  FileText,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';

// Subcomponents
import GoogleWarmingConsoleTab from './components/GoogleWarmingConsoleTab.vue';
import GoogleAccountsTab from './components/GoogleAccountsTab.vue';

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
const isAiParsing = ref<boolean>(false);
const testMode = ref<boolean>(true); // Dev test mode: allows consecutive check-ins
const activeMobileView = ref<'list' | 'detail'>('list');

// Import form state
const importText = ref<string>('');
const parsedAccounts = ref<Array<Partial<GoogleAccount>>>([]);
const importDefaultCategory = ref<string>('未分类');
const autoTranslateCountry = ref<boolean>(true);

// Watch default category change to update parsed accounts in preview in real-time
watch(importDefaultCategory, (newVal) => {
  if (newVal && parsedAccounts.value.length > 0) {
    parsedAccounts.value.forEach((acc) => {
      acc.category = newVal;
    });
  }
});

const openImportDialog = () => {
  importText.value = '';
  parsedAccounts.value = [];
  importDefaultCategory.value = '未分类';
  autoTranslateCountry.value = true;
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
    console.error('获取分类列表失败:', e);
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

// Batch selection helpers (Warming workspace list)
const isAllSelected = computed(() => {
  const ids = filteredAccounts.value.map((a) => a.id);
  return ids.length > 0 && ids.every((id) => selectedAccountIds.value.includes(id));
});

const toggleSelectAll = () => {
  const ids = filteredAccounts.value.map((a) => a.id);
  if (isAllSelected.value) {
    selectedAccountIds.value = selectedAccountIds.value.filter((id) => !ids.includes(id));
  } else {
    ids.forEach((id) => {
      if (!selectedAccountIds.value.includes(id)) {
        selectedAccountIds.value.push(id);
      }
    });
  }
};

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

// Client-side auto-delimiter parse
const handleStandardParse = () => {
  if (!importText.value.trim()) {
    ElMessage.warning(t('tools.email.import_warning_empty'));
    return;
  }

  const lines = importText.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const tempParsed: Array<Partial<GoogleAccount>> = [];
  const delimiters = ['----', '|', '\t', ',', ';'];

  let bestDelimiter = '----';
  let maxParts = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find best delimiter for the first few lines
    if (i < 5) {
      for (const d of delimiters) {
        const parts = line.split(d);
        if (parts.length > maxParts) {
          maxParts = parts.length;
          bestDelimiter = d;
        }
      }
    }

    const parts = line.split(bestDelimiter).map((p) => p.trim());
    if (parts.length < 2) continue;

    const email = parts[0] || '';
    const password = parts[1] || '';
    const recoveryEmail = parts[2] || '';
    const twoFASecret = parts[3] || '';
    const country = parts[4] || '';
    let backupCodes = '';
    let note = '';
    let parsedCategory = '未分类';

    if (parts.length >= 8) {
      backupCodes = parts[5] || '';
      parsedCategory = parts[6] || '未分类';
      note = parts[7] || '';
    } else if (parts.length === 7) {
      backupCodes = parts[5] || '';
      note = parts[6] || '';
    } else if (parts.length === 6) {
      note = parts[5] || '';
    }

    tempParsed.push({
      email,
      password,
      recoveryEmail,
      twoFASecret,
      country,
      backupCodes,
      category:
        importDefaultCategory.value && importDefaultCategory.value !== '未分类'
          ? importDefaultCategory.value
          : parsedCategory,
      note,
      status: 'warming',
      currentDay: 1,
    });
  }

  if (tempParsed.length === 0) {
    ElMessage.error('快速解析失败，请检查分隔符');
  } else {
    parsedAccounts.value = tempParsed;
    ElMessage.success(
      `成功解析出 ${tempParsed.length} 个账号 (使用分隔符: "${bestDelimiter === '\t' ? '\\t' : bestDelimiter}")`,
    );
  }
};

// AI-based parsing
const handleAiParse = async () => {
  if (!importText.value.trim()) {
    ElMessage.warning(t('tools.email.import_warning_empty'));
    return;
  }

  isAiParsing.value = true;
  try {
    const res = await api.post('/api/google-warming/accounts/ai-parse', {
      text: importText.value,
      translateCountry: autoTranslateCountry.value,
    });
    if (res.data && res.data.success && Array.isArray(res.data.accounts)) {
      parsedAccounts.value = res.data.accounts.map((acc: Partial<GoogleAccount>) => ({
        ...acc,
        category:
          importDefaultCategory.value && importDefaultCategory.value !== '未分类'
            ? importDefaultCategory.value
            : acc.category || '未分类',
        status: acc.status || 'warming',
        currentDay: 1,
      }));
      ElMessage.success(`AI 智能解析成功，提取出 ${parsedAccounts.value.length} 个账号`);
    } else {
      throw new Error('AI 返回数据异常');
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, 'AI 解析失败，请重试或使用快速解析'));
  } finally {
    isAiParsing.value = false;
  }
};

// Submit bulk imports
const submitImport = async () => {
  if (parsedAccounts.value.length === 0) return;

  try {
    const res = await api.post('/api/google-warming/accounts/import', {
      accounts: parsedAccounts.value,
    });
    if (res.data && res.data.success) {
      ElMessage.success(`导入成功，共录入 ${res.data.count} 个谷歌账号`);
      parsedAccounts.value = [];
      importText.value = '';
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

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return t('tools.googleWarming.statusCompleted');
    case 'paused':
      return t('tools.googleWarming.statusPaused');
    default:
      return t('tools.googleWarming.statusWarming');
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'paused':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    default:
      return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
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
      keyBytes as any,
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
    console.error('Failed to generate TOTP:', error);
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
      } catch (e) {
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

const copyText = (text: string, message: string = '已复制到剪贴板') => {
  if (!text) return;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success(message);
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
};

// ── Password Generator ────────────────────────────────────────────────────────
const generateRandomPassword = (targetRef: Partial<GoogleAccount>) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let password = '';
  const poolLower = 'abcdefghijklmnopqrstuvwxyz';
  const poolUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const poolDigit = '0123456789';
  const poolSymbol = '!@#$%^&*()_+';

  password += poolLower[Math.floor(Math.random() * poolLower.length)];
  password += poolUpper[Math.floor(Math.random() * poolUpper.length)];
  password += poolDigit[Math.floor(Math.random() * poolDigit.length)];
  password += poolSymbol[Math.floor(Math.random() * poolSymbol.length)];

  for (let i = 4; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  const shuffled = password
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');
  targetRef.password = shuffled;
  ElMessage.success('已自动生成并填充复杂密码！');
};

// ── Password Generator Dialog States ──────────────────────────────────────────
const isPasswordGenVisible = ref(false);
const passGenLength = ref(16);
const passGenUpper = ref(true);
const passGenLower = ref(true);
const passGenNumbers = ref(true);
const passGenSymbols = ref(false);
const passGenResult = ref('');

const generateDialogPassword = () => {
  const poolLower = 'abcdefghijklmnopqrstuvwxyz';
  const poolUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const poolDigit = '0123456789';
  const poolSymbol = '!@#$%^&*()_+~[]{}:;.,?';

  let allowedPool = '';
  let guaranteed: string[] = [];

  if (passGenLower.value) {
    allowedPool += poolLower;
    guaranteed.push(poolLower[Math.floor(Math.random() * poolLower.length)]);
  }
  if (passGenUpper.value) {
    allowedPool += poolUpper;
    guaranteed.push(poolUpper[Math.floor(Math.random() * poolUpper.length)]);
  }
  if (passGenNumbers.value) {
    allowedPool += poolDigit;
    guaranteed.push(poolDigit[Math.floor(Math.random() * poolDigit.length)]);
  }
  if (passGenSymbols.value) {
    allowedPool += poolSymbol;
    guaranteed.push(poolSymbol[Math.floor(Math.random() * poolSymbol.length)]);
  }

  if (allowedPool.length === 0) {
    passGenLower.value = true;
    passGenUpper.value = true;
    passGenNumbers.value = true;
    allowedPool = poolLower + poolUpper + poolDigit;
    guaranteed.push(poolLower[Math.floor(Math.random() * poolLower.length)]);
    guaranteed.push(poolUpper[Math.floor(Math.random() * poolUpper.length)]);
    guaranteed.push(poolDigit[Math.floor(Math.random() * poolDigit.length)]);
  }

  let password = guaranteed.join('');
  const remainingLength = passGenLength.value - password.length;

  for (let i = 0; i < remainingLength; i++) {
    password += allowedPool[Math.floor(Math.random() * allowedPool.length)];
  }

  passGenResult.value = password
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');
};

const openPasswordGenerator = () => {
  isPasswordGenVisible.value = true;
  generateDialogPassword();
};

watch([passGenLength, passGenUpper, passGenLower, passGenNumbers, passGenSymbols], () => {
  if (isPasswordGenVisible.value) {
    generateDialogPassword();
  }
});

// ── Export / Import ──────────────────────────────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null);

function handleExportAccounts() {
  if (accounts.value.length === 0) {
    ElMessage.warning('暂无账号数据可导出');
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
  <div class="gw-page">
    <div class="w-full space-y-3">
      <!-- Top header (compact) -->
      <div
        class="gw-header !py-2 !mb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-200 dark:border-slate-800/80"
      >
        <div class="flex flex-col gap-0.5">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="gw-title !text-sm sm:!text-base font-bold">
              {{ t('tools.googleWarming.title') }}
            </h1>
            <span class="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
            <p class="hidden sm:inline text-[10.5px] text-slate-500 max-w-md line-clamp-1">
              {{ t('tools.googleWarming.description') }}
            </p>
          </div>
        </div>

        <div
          class="flex items-center justify-between sm:justify-end gap-1.5 w-full md:w-auto shrink-0 flex-wrap"
        >
          <!-- Dev Test Mode toggle -->
          <label
            class="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 text-[10px] font-semibold text-slate-600 dark:text-slate-350 cursor-pointer select-none"
          >
            <input
              v-model="testMode"
              type="checkbox"
              class="w-3 h-3 rounded accent-violet-500 cursor-pointer"
            />
            <span>测试打卡</span>
          </label>

          <div class="flex items-center gap-1.5">
            <!-- Export -->
            <button
              class="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700/50 text-[11px] font-semibold hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
              title="导出全部账号为 JSON（包含密码、辅助邮箱、地区、状态等完整信息）"
              @click="handleExportAccounts"
            >
              <Download class="w-3.5 h-3.5" />
              <span>导出</span>
            </button>

            <!-- Import -->
            <button
              class="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700/50 text-[11px] font-semibold hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
              title="从 JSON 备份文件导入，完整还原所有字段"
              @click="triggerImportFile"
            >
              <Upload class="w-3.5 h-3.5" />
              <span>导入</span>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".json"
              class="hidden"
              @change="handleImportFile"
            />

            <!-- Password Generator -->
            <button
              class="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700/50 text-[11px] font-semibold hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
              title="生成随机复杂密码"
              @click="openPasswordGenerator"
            >
              <Key class="w-3.5 h-3.5" />
              <span>密码生成</span>
            </button>

            <!-- Add account -->
            <button
              class="bg-violet-600 hover:bg-violet-500 border-none font-semibold px-2.5 py-1.5 rounded transition-all flex items-center gap-0.5 cursor-pointer text-[11px] text-white"
              @click="openImportDialog"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>{{ t('tools.googleWarming.addAccount') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Switcher -->
      <div class="flex border-b border-slate-200 dark:border-slate-800/80 mb-2 gap-1">
        <button
          :class="[
            'px-3 py-1.5 border-b-2 font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5',
            activeTab === 'warming'
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          ]"
          @click="activeTab = 'warming'"
        >
          <Calendar class="w-3.5 h-3.5" />
          <span>{{ t('tools.googleWarming.tabWarmingWorkspace') }}</span>
        </button>
        <button
          :class="[
            'px-3 py-1.5 border-b-2 font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5',
            activeTab === 'manage'
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          ]"
          @click="activeTab = 'manage'"
        >
          <Shield class="w-3.5 h-3.5" />
          <span>{{ t('tools.googleWarming.tabAccountManage') }}</span>
        </button>
      </div>

      <!-- Tab 1: Interactive Warming Workspace -->
      <div
        v-if="activeTab === 'warming'"
        class="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start"
      >
        <!-- Left Account List -->
        <div
          :class="[
            'lg:col-span-4 xl:col-span-3 gw-card !p-3 flex flex-col gap-2 max-h-[800px] w-full',
            activeMobileView === 'list' ? 'flex' : 'hidden lg:flex',
          ]"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold" style="color: var(--text-primary)"
              >{{ t('tools.googleWarming.accountsList') }}
              <span class="text-slate-500 font-normal">({{ accounts.length }})</span></span
            >
            <button class="gw-icon-btn cursor-pointer !p-1" @click="fetchAccounts">
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            </button>
          </div>

          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('tools.googleWarming.searchPlaceholder')"
              class="gw-input !py-1.5 !text-xs !pl-8"
            />
            <Search
              class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          <div class="flex gap-0.5 p-0.5 rounded-lg text-[11px]" style="background: var(--bg-app)">
            <button
              v-for="status in ['all', 'warming', 'paused', 'completed']"
              :key="status"
              :class="[
                'flex-1 py-1 rounded-md font-medium transition-all text-center cursor-pointer',
                statusFilter === status
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
              ]"
              @click="statusFilter = status as 'all' | 'warming' | 'completed' | 'paused'"
            >
              {{ status === 'all' ? t('tools.googleWarming.statusAll') : getStatusLabel(status) }}
            </button>
          </div>

          <div
            v-if="filteredAccounts.length > 0"
            class="flex items-center justify-between text-[11px]"
          >
            <label
              class="flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400 select-none"
            >
              <input
                type="checkbox"
                :checked="isAllSelected"
                class="w-3 h-3 rounded accent-violet-500"
                @change="toggleSelectAll"
              />
              <span>全选 ({{ selectedAccountIds.length }})</span>
            </label>
            <el-dropdown
              trigger="click"
              :disabled="selectedAccountIds.length === 0"
              @command="handleBatchCommand"
            >
              <button
                :disabled="selectedAccountIds.length === 0"
                :class="[
                  'px-2 py-1 rounded border font-medium transition-all flex items-center gap-1 text-[10px] cursor-pointer',
                  selectedAccountIds.length > 0
                    ? 'bg-violet-600/10 border-violet-500/30 text-violet-700 dark:text-violet-400 hover:bg-violet-600/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed',
                ]"
              >
                {{ t('tools.googleWarming.batchActions') }}
              </button>
              <template #dropdown>
                <el-dropdown-menu class="dark:bg-slate-900 border-none">
                  <el-dropdown-item
                    command="warm"
                    class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >一键打卡</el-dropdown-item
                  >
                  <el-dropdown-item
                    command="status-warming"
                    class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >设为 养号中</el-dropdown-item
                  >
                  <el-dropdown-item
                    command="status-paused"
                    class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >设为 已暂停</el-dropdown-item
                  >
                  <el-dropdown-item
                    command="status-completed"
                    class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >设为 已毕业</el-dropdown-item
                  >
                  <el-dropdown-item
                    command="delete"
                    divided
                    class="text-red-650 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >批量删除</el-dropdown-item
                  >
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <div
            v-if="filteredAccounts.length === 0"
            class="py-6 text-center flex flex-col items-center justify-center gap-2"
          >
            <FileText class="w-8 h-8 gw-icon-muted" />
            <p class="gw-muted-text text-xs max-w-[180px]">
              {{
                searchQuery || statusFilter !== 'all'
                  ? '未找到符合条件的账号'
                  : t('tools.googleWarming.noAccounts')
              }}
            </p>
          </div>

          <div v-else class="flex flex-col gap-1.5 overflow-y-auto pr-1">
            <div
              v-for="acc in filteredAccounts"
              :key="acc.id"
              :class="[
                'gw-account-item group/item',
                selectedAccountId === acc.id ? 'gw-account-item--active' : '',
              ]"
              @click="selectAccount(acc.id)"
            >
              <div class="flex items-center gap-2">
                <input
                  v-model="selectedAccountIds"
                  type="checkbox"
                  :value="acc.id"
                  class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer shrink-0"
                  @click.stop
                />
                <span
                  class="text-[12px] font-semibold flex-1 truncate"
                  style="color: var(--text-primary)"
                  :title="acc.email"
                  >{{ acc.email }}</span
                >
                <span
                  :class="[
                    'text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0',
                    getStatusBadgeClass(acc.status),
                  ]"
                >
                  {{ getStatusLabel(acc.status) }}
                </span>
              </div>

              <div class="flex items-center gap-2 pl-5">
                <span
                  v-if="acc.note"
                  class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                  style="
                    background: var(--bg-app);
                    color: var(--text-muted);
                    border: 1px solid var(--border-base);
                  "
                  >{{ acc.note }}</span
                >
                <span class="text-[10px] shrink-0" style="color: var(--text-muted)"
                  >第 {{ acc.currentDay }} 天</span
                >
                <div class="flex-1"></div>
                <span
                  v-if="acc.twoFASecret && listTotpCodes[acc.id]"
                  class="flex items-center gap-1 shrink-0"
                >
                  <span
                    class="font-mono text-[11px] text-violet-600 dark:text-violet-400 font-bold tracking-widest"
                    >{{ listTotpCodes[acc.id].code.slice(0, 3) }}
                    {{ listTotpCodes[acc.id].code.slice(3) }}</span
                  >
                  <span class="text-[9px] font-mono" style="color: var(--text-muted)"
                    >{{ listTotpCodes[acc.id].timeLeft }}s</span
                  >
                  <button
                    class="opacity-0 group-hover/item:opacity-100 hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-all text-slate-500 dark:text-slate-400 cursor-pointer"
                    title="复制验证码"
                    @click.stop="copyText(listTotpCodes[acc.id].code, '验证码已复制')"
                  >
                    <Copy class="w-2.5 h-2.5" />
                  </button>
                </span>
              </div>

              <div class="flex items-center gap-2 pl-5">
                <div
                  class="flex-1 h-1 rounded-full overflow-hidden"
                  style="background: var(--border-base)"
                >
                  <div
                    class="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    :style="{ width: `${(acc.currentDay / 14) * 100}%` }"
                  ></div>
                </div>
                <span
                  class="text-[9px] font-mono shrink-0 w-6 text-right"
                  style="color: var(--text-muted)"
                  >{{ Math.round((acc.currentDay / 14) * 100) }}%</span
                >
              </div>
            </div>
          </div>
        </div>

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

      <!-- Bulk Import dialog -->
      <Modal
        :show="isImporting"
        :title="t('tools.googleWarming.bulkImport')"
        size="lg"
        @close="isImporting = false"
      >
        <div class="space-y-4">
          <div class="gw-import-hint">
            {{ t('tools.googleWarming.importPlaceholder') }}
          </div>

          <textarea
            v-model="importText"
            rows="6"
            placeholder="粘贴账号数据，每行一个..."
            class="gw-textarea"
          ></textarea>

          <div
            class="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ t('tools.googleWarming.importDefaultCategory') }}:
              </span>
              <el-select
                v-model="importDefaultCategory"
                filterable
                allow-create
                default-first-option
                :placeholder="t('tools.googleWarming.defaultCategoryPlaceholder')"
                size="small"
                style="width: 160px"
              >
                <el-option
                  v-for="cat in categoriesList.filter((c) => c !== 'all')"
                  :key="cat"
                  :label="cat === '未分类' ? '未分类 (无分类)' : cat"
                  :value="cat"
                />
              </el-select>
              <span class="text-[11px] text-slate-400 dark:text-slate-500">
                {{ t('tools.googleWarming.realtimeApplyTip') }}
              </span>
            </div>

            <div class="flex items-center">
              <el-checkbox v-model="autoTranslateCountry" size="small">
                {{ t('tools.googleWarming.autoTranslateCountry') }}
              </el-checkbox>
            </div>
          </div>

          <div class="flex justify-between items-center gap-3">
            <div class="flex items-center gap-2">
              <button class="gw-btn-secondary text-xs cursor-pointer" @click="handleStandardParse">
                {{ t('tools.googleWarming.standardParseBtn') }}
              </button>
              <button
                :disabled="isAiParsing"
                class="flex items-center gap-1.5 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 dark:from-violet-600/30 dark:to-indigo-600/30 hover:from-violet-600/20 hover:to-indigo-600/20 dark:hover:from-violet-600/50 dark:hover:to-indigo-600/50 text-violet-700 dark:text-violet-400 text-xs px-3.5 py-2 rounded-lg border border-violet-500/30 dark:border-violet-500/20 transition-all cursor-pointer"
                @click="handleAiParse"
              >
                <Sparkles class="w-3.5 h-3.5" :class="{ 'animate-pulse': isAiParsing }" />
                {{ t('tools.googleWarming.aiParseBtn') }}
              </button>
            </div>

            <span
              v-if="isAiParsing"
              class="gw-muted-text text-xs flex items-center gap-1.5 animate-pulse"
            >
              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
              AI 正在努力识别和解析格式，请稍候...
            </span>
          </div>

          <!-- Preview Table -->
          <div v-if="parsedAccounts.length > 0" class="space-y-3 pt-3 gw-border-top">
            <h4 class="gw-label-bold flex items-center justify-between">
              <span>解析预览 ({{ parsedAccounts.length }} 个账号)</span>
              <span class="gw-muted-text text-xs font-normal"
                >双击或直接修改单元格可以校正错误数据</span
              >
            </h4>

            <div class="overflow-x-auto gw-table-wrapper">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="gw-table-head">
                    <th class="p-3">邮箱</th>
                    <th class="p-3">密码</th>
                    <th class="p-3">辅助邮箱</th>
                    <th class="p-3">2FA密钥</th>
                    <th class="p-3">国家</th>
                    <th class="p-3">备用密码</th>
                    <th class="p-3">分类</th>
                    <th class="p-3">状态</th>
                    <th class="p-3">备注</th>
                    <th class="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(acc, idx) in parsedAccounts" :key="idx" class="gw-table-row">
                    <td class="p-2"><input v-model="acc.email" class="gw-table-input" /></td>
                    <td class="p-2"><input v-model="acc.password" class="gw-table-input" /></td>
                    <td class="p-2">
                      <input v-model="acc.recoveryEmail" class="gw-table-input" />
                    </td>
                    <td class="p-2"><input v-model="acc.twoFASecret" class="gw-table-input" /></td>
                    <td class="p-2"><input v-model="acc.country" class="gw-table-input" /></td>
                    <td class="p-2">
                      <input
                        v-model="acc.backupCodes"
                        class="gw-table-input"
                        placeholder="备用密码"
                      />
                    </td>
                    <td class="p-2">
                      <input v-model="acc.category" class="gw-table-input" placeholder="未分类" />
                    </td>
                    <td class="p-2">
                      <select
                        v-model="acc.status"
                        class="gw-table-input cursor-pointer"
                        style="
                          background: var(--bg-app);
                          border: 1px solid var(--border-base);
                          border-radius: 4px;
                          padding: 2px 4px;
                          font-size: 11px;
                        "
                      >
                        <option value="warming">养号中</option>
                        <option value="completed">已毕业</option>
                        <option value="paused">已暂停</option>
                      </select>
                    </td>
                    <td class="p-2"><input v-model="acc.note" class="gw-table-input" /></td>
                    <td class="p-2 text-right">
                      <button
                        class="text-red-400 hover:text-red-300 p-1 transition-colors cursor-pointer"
                        @click="parsedAccounts.splice(idx, 1)"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex justify-end gap-3 pt-3">
              <button
                class="gw-btn-secondary text-xs cursor-pointer"
                @click="
                  isImporting = false;
                  parsedAccounts = [];
                "
              >
                {{ t('tools.googleWarming.cancel_btn') }}
              </button>
              <button
                class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs px-5 py-2.5 rounded-lg transition-all font-semibold cursor-pointer"
                @click="submitImport"
              >
                {{ t('tools.googleWarming.importConfirm', { count: parsedAccounts.length }) }}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <!-- Edit details dialog -->
      <Modal
        :show="isEditDialogVisible"
        :title="t('tools.googleWarming.editAccountTitle')"
        size="md"
        @close="isEditDialogVisible = false"
      >
        <div class="space-y-2.5">
          <div class="gw-field !gap-1">
            <label class="gw-field-label !text-[10px]">邮箱账号</label>
            <input v-model="editingAccount.email" type="text" class="gw-input !py-1.5 !text-xs" />
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div class="gw-field !gap-1">
              <div class="flex items-center justify-between w-full">
                <label class="gw-field-label !text-[10px]">密码</label>
                <button
                  type="button"
                  class="text-[9px] text-violet-600 dark:text-violet-400 hover:text-violet-500 font-semibold cursor-pointer border-none bg-transparent"
                  @click="generateRandomPassword(editingAccount)"
                >
                  一键生成复杂密码
                </button>
              </div>
              <input
                v-model="editingAccount.password"
                type="text"
                class="gw-input !py-1.5 !text-xs"
              />
            </div>
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">辅助邮箱</label>
              <input
                v-model="editingAccount.recoveryEmail"
                type="text"
                class="gw-input !py-1.5 !text-xs"
              />
            </div>
          </div>

          <div class="gw-field !gap-1">
            <label class="gw-field-label !text-[10px]">2FA 密钥</label>
            <input
              v-model="editingAccount.twoFASecret"
              type="text"
              class="gw-input !py-1.5 !text-xs font-mono"
            />
          </div>

          <div class="gw-field !gap-1">
            <label class="gw-field-label !text-[10px]">备用密码 (空格分隔的8位验证码)</label>
            <input
              v-model="editingAccount.backupCodes"
              type="text"
              class="gw-input !py-1.5 !text-xs font-mono"
              placeholder="例如: 3191 6344 6829 7625..."
            />
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">国家地区</label>
              <input
                v-model="editingAccount.country"
                type="text"
                class="gw-input !py-1.5 !text-xs"
              />
            </div>
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">当前天数</label>
              <input
                v-model.number="editingAccount.currentDay"
                type="number"
                min="1"
                max="14"
                class="gw-input !py-1.5 !text-xs"
              />
            </div>
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">分类</label>
              <input
                v-model="editingAccount.category"
                type="text"
                placeholder="例如: GCP, AdSense"
                class="gw-input !py-1.5 !text-xs"
              />
            </div>
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">状态</label>
              <select v-model="editingAccount.status" class="gw-input !py-1.5 !text-xs">
                <option value="warming">养号中</option>
                <option value="completed">已毕业</option>
                <option value="paused">已暂停</option>
              </select>
            </div>
            <div class="gw-field col-span-2 !gap-1">
              <label class="gw-field-label !text-[10px]">备注/描述</label>
              <input v-model="editingAccount.note" type="text" class="gw-input !py-1.5 !text-xs" />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2 gw-border-top">
            <button
              class="gw-btn-secondary text-xs cursor-pointer"
              @click="isEditDialogVisible = false"
            >
              {{ t('tools.googleWarming.cancel_btn') }}
            </button>
            <button
              class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs px-4 py-1.5 rounded-lg transition-all font-semibold cursor-pointer"
              @click="saveAccountEdit"
            >
              保存修改
            </button>
          </div>
        </div>
      </Modal>

      <!-- Password Generator Dialog -->
      <Modal
        :show="isPasswordGenVisible"
        title="密码生成器"
        size="md"
        @close="isPasswordGenVisible = false"
      >
        <div class="space-y-4">
          <div
            class="flex items-center gap-2 p-3 rounded-xl border relative group"
            style="border-color: var(--border-base); background: var(--bg-app)"
          >
            <input
              type="text"
              readonly
              :value="passGenResult"
              class="w-full bg-transparent border-none outline-none font-mono text-base font-semibold tracking-wider text-violet-655 dark:text-violet-400 select-all pr-12"
            />
            <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
                title="复制密码"
                @click="copyText(passGenResult, '密码已复制')"
              >
                <Copy class="w-4 h-4" />
              </button>
              <button
                class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
                title="重新生成"
                @click="generateDialogPassword"
              >
                <RefreshCw class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="space-y-3.5">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-semibold">
                <span class="text-slate-655 dark:text-slate-300"
                  >密码长度 ({{ passGenLength }}位)</span
                >
              </div>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="passGenLength"
                  type="range"
                  min="6"
                  max="32"
                  class="flex-1 accent-violet-600 dark:accent-violet-500 cursor-pointer h-1.5 rounded-lg bg-slate-250 dark:bg-slate-800"
                />
                <span
                  class="font-mono text-xs font-bold w-6 text-right text-slate-700 dark:text-slate-350"
                  >{{ passGenLength }}</span
                >
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs font-medium">
              <label
                class="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-500/5 transition-all cursor-pointer"
                style="border-color: var(--border-base)"
              >
                <input
                  v-model="passGenLower"
                  type="checkbox"
                  class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
                />
                <span style="color: var(--text-primary)">小写字母 (a-z)</span>
              </label>

              <label
                class="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-500/5 transition-all cursor-pointer"
                style="border-color: var(--border-base)"
              >
                <input
                  v-model="passGenUpper"
                  type="checkbox"
                  class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
                />
                <span style="color: var(--text-primary)">大写字母 (A-Z)</span>
              </label>

              <label
                class="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-500/5 transition-all cursor-pointer"
                style="border-color: var(--border-base)"
              >
                <input
                  v-model="passGenNumbers"
                  type="checkbox"
                  class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
                />
                <span style="color: var(--text-primary)">数字字符 (0-9)</span>
              </label>

              <label
                class="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-500/5 transition-all cursor-pointer"
                style="border-color: var(--border-base)"
              >
                <input
                  v-model="passGenSymbols"
                  type="checkbox"
                  class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
                />
                <span style="color: var(--text-primary)">特殊符号 (!@#$)</span>
              </label>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-between items-center w-full pt-1.5">
            <span class="text-[10px] text-slate-400 dark:text-slate-500">
              安全提示：请妥善保存您的密码
            </span>
            <div class="flex gap-2">
              <button
                class="gw-btn-secondary text-xs cursor-pointer"
                @click="isPasswordGenVisible = false"
              >
                关闭
              </button>
              <button
                class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                @click="generateDialogPassword"
              >
                <Sparkles class="w-3.5 h-3.5" />
                <span>重新生成</span>
              </button>
            </div>
          </div>
        </template>
      </Modal>
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
  background: var(--bg-app);
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

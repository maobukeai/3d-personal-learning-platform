<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  QrCode,
  Edit,
  Search,
  FileText,
  Clock,
  Sparkles,
  Pin,
  PinOff,
  Upload,
  Download,
  RefreshCw,
  LayoutGrid,
  List,
  FolderOpen,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Github,
  Chrome,
  Lock,
  Cpu,
  TrendingUp,
  Globe,
  Briefcase,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { generateTOTP } from '@/utils/totp';
import TwoFactorAddDialog from './components/TwoFactorAddDialog.vue';
import TwoFactorEditDialog from './components/TwoFactorEditDialog.vue';
import TwoFactorQrDialog from './components/TwoFactorQrDialog.vue';
import TwoFactorSecurityDialog from './components/TwoFactorSecurityDialog.vue';
import type { TwoFactorAccount } from '@/types';

interface LiveTotp {
  code: string;
  timeLeft: number;
}

const accounts = ref<TwoFactorAccount[]>([]);
const liveCodes = ref<Record<string, LiveTotp>>({});
const isLoading = ref<boolean>(false);
const searchQuery = ref<string>('');

// Modal visibility & form states
const isAddDialogVisible = ref<boolean>(false);
const isEditDialogVisible = ref<boolean>(false);
const isQrDialogVisible = ref<boolean>(false);

// Security Dialog state
const isSecurityDialogVisible = ref<boolean>(false);
const securityDialogTab = ref<'calibration' | 'export' | 'import'>('calibration');

function openSecurityCenter(tab: 'calibration' | 'export' | 'import') {
  securityDialogTab.value = tab;
  isSecurityDialogVisible.value = true;
}

const isCategoryManagerVisible = ref<boolean>(false);

const selectedEditAccount = ref<TwoFactorAccount | null>(null);

// Drag & drop states
const draggingAccountId = ref<string | null>(null);
const dragOverCategory = ref<string | null>(null);

// Add ref states for grouping, privacy and sorting
const selectedCategory = ref<string>('all');
const sortBy = ref<string>('pinned_first');
const isPrivacyMode = ref<boolean>(false);

// Clock offset states
const clockDrift = ref<number | null>(null);

const lastBackupTime = ref<string | null>(localStorage.getItem('two_factor_last_backup'));

const categories = computed(() => {
  const set = new Set<string>();
  accounts.value.forEach((acc) => {
    if (acc.category && acc.category.trim()) {
      set.add(acc.category.trim());
    }
  });
  return Array.from(set);
});

const uncategorizedCount = computed(() => {
  return accounts.value.filter((a) => !a.category || !a.category.trim()).length;
});

// Secrets visibility map
const revealedSecrets = ref<Record<string, boolean>>({});

// Pinning state
const pinnedAccountIds = ref<string[]>(JSON.parse(localStorage.getItem('two_factor_pins') || '[]'));

// Layout Mode state
const layoutMode = ref<'grid' | 'list'>(
  (localStorage.getItem('2fa_layout_mode') as any) === 'list' ? 'list' : 'grid',
);

function changeLayoutMode(mode: 'grid' | 'list') {
  layoutMode.value = mode;
  localStorage.setItem('2fa_layout_mode', mode);
}

// Copy feedback states
const copiedStates = ref<Record<string, boolean>>({});

// File input ref for backup importing
const fileInput = ref<HTMLInputElement | null>(null);

// QR code generation state
const qrCodeAccount = ref<TwoFactorAccount | null>(null);

// Timer for dynamic code refresh
let totpTimer: NodeJS.Timeout | null = null;

// Load saved 2FA accounts
async function fetchAccounts() {
  isLoading.value = true;
  try {
    const res = await api.get('/api/two-factor/accounts');
    accounts.value = res.data || [];
    await updateAllCodes();
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '加载2FA账号列表失败'));
  } finally {
    isLoading.value = false;
  }
}

// Generate TOTP code for a single secret key
async function updateCode(id: string, secret: string) {
  const result = await generateTOTP(secret);
  liveCodes.value[id] = result;
}

// Update all codes in the list
async function updateAllCodes() {
  const promises = accounts.value.map((acc) => updateCode(acc.id, acc.secret));
  await Promise.all(promises);
}

// Start second-interval timer to refresh codes and sync progress ring
function startTotpTimer() {
  totpTimer = setInterval(async () => {
    // Update list codes
    const promises = accounts.value.map(async (acc) => {
      const result = await generateTOTP(acc.secret);
      liveCodes.value[acc.id] = result;
    });
    await Promise.all(promises);
  }, 1000);
}

function stopTotpTimer() {
  if (totpTimer) {
    clearInterval(totpTimer);
    totpTimer = null;
  }
}

// Edit accounts
function openEditDialog(acc: TwoFactorAccount) {
  selectedEditAccount.value = acc;
  isEditDialogVisible.value = true;
}

// Delete account
async function deleteAccount(acc: TwoFactorAccount) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 2FA 记录 “${acc.label}” 吗？此操作不可撤销！`,
      '删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );

    await api.delete(`/api/two-factor/accounts/${acc.id}`);
    ElMessage.success('删除成功');
    await fetchAccounts();
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, '删除2FA记录失败'));
    }
  }
}

// Show standard QR Code for Authenticator App scanning
function showQrCode(acc: TwoFactorAccount) {
  qrCodeAccount.value = acc;
  isQrDialogVisible.value = true;
}

// Secrets toggles
function toggleSecret(id: string) {
  revealedSecrets.value[id] = !revealedSecrets.value[id];
}

// Pinning toggle
function togglePin(id: string) {
  const idx = pinnedAccountIds.value.indexOf(id);
  if (idx > -1) {
    pinnedAccountIds.value.splice(idx, 1);
  } else {
    pinnedAccountIds.value.push(id);
  }
  localStorage.setItem('two_factor_pins', JSON.stringify(pinnedAccountIds.value));
}

// Trigger copy floating feedback animation
function triggerCopyFeedback(id: string) {
  copiedStates.value[id] = true;
  setTimeout(() => {
    copiedStates.value[id] = false;
  }, 2000);
}

// Copy to clipboard
async function copyToClipboard(text: string, id: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(successMessage);
    triggerCopyFeedback(id);
  } catch (err) {
    ElMessage.error('复制失败，请手动选择复制');
  }
}

// Copy dynamic code
function copyCode(id: string) {
  const code = liveCodes.value[id]?.code;
  if (code && code !== '------') {
    copyToClipboard(code, id, '验证码已复制到剪贴板');
  }
}

// No-op for files import since they are handled inside security dialog

// Clock Drift Checker
const clockSyncStatus = computed(() => {
  if (clockDrift.value === null)
    return { text: '未检测', color: 'text-slate-400', status: 'unknown' };
  const absDrift = Math.abs(clockDrift.value);
  if (absDrift < 1500)
    return { text: '时间同步: 良好', color: 'text-emerald-400', status: 'perfect' };
  if (absDrift < 3000)
    return {
      text: `时间微偏 (${(absDrift / 1000).toFixed(1)}秒)`,
      color: 'text-amber-400',
      status: 'warning',
    };
  return {
    text: `时间漂移 (${(absDrift / 1000).toFixed(1)}秒)`,
    color: 'text-rose-400',
    status: 'critical',
  };
});

async function checkClockSync() {
  try {
    const startTime = Date.now();
    const res = await api.get('/api/two-factor/accounts', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    const endTime = Date.now();
    const roundTripTime = endTime - startTime;
    const serverDateHeader = res.headers?.date || res.headers?.Date;
    if (serverDateHeader) {
      const serverTime = new Date(serverDateHeader).getTime();
      const estimatedServerTime = serverTime + roundTripTime / 2;
      clockDrift.value = endTime - estimatedServerTime;
    } else {
      clockDrift.value = 0;
    }
  } catch (e) {
    console.error('Time sync check failed:', e);
    clockDrift.value = null;
  }
}

// Security Audit
/*interface AuditWarning {
  id: string;
  type: 'weak' | 'duplicate' | 'backup' | 'uncategorized';
  title: string;
  desc: string;
  actionText?: string;
  accountId?: string;
  duplicateIds?: string[];
}*/

/*const securityScore = computed(() => {
  if (accounts.value.length === 0) return 100;
  let score = 100;
  
  const weakCount = accounts.value.filter(a => {
    const clean = a.secret.replace(/[\s=]/g, '');
    return clean.length < 16;
  }).length;
  score -= Math.min(weakCount * 15, 30);

  const keyGroups: Record<string, string[]> = {};
  accounts.value.forEach(a => {
    const clean = a.secret.replace(/[\s=]/g, '').toUpperCase();
    if (clean) {
      if (!keyGroups[clean]) keyGroups[clean] = [];
      keyGroups[clean].push(a.label);
    }
  });
  let duplicateGroupsCount = 0;
  Object.values(keyGroups).forEach(group => {
    if (group.length > 1) duplicateGroupsCount++;
  });
  score -= Math.min(duplicateGroupsCount * 20, 40);

  const uncategorizedPct = uncategorizedCount.value / accounts.value.length;
  if (uncategorizedPct > 0.3) {
    score -= 10;
  }

  if (!lastBackupTime.value) {
    score -= 20;
  } else {
    const daysSinceBackup = (Date.now() - new Date(lastBackupTime.value).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceBackup > 30) {
      score -= 15;
    }
  }

  return Math.max(score, 10);
});*/

/*const auditWarnings = computed<AuditWarning[]>(() => {
  const warnings: AuditWarning[] = [];
  
  accounts.value.forEach(a => {
    const clean = a.secret.replace(/[\s=]/g, '');
    if (clean.length < 16) {
      warnings.push({
        id: `weak-${a.id}`,
        type: 'weak',
        title: `密钥较短 (${a.label})`,
        desc: `该账户的密钥长度小于 16 位，存在被破解风险，建议更换更高强度密钥。`,
        actionText: '编辑账户',
        accountId: a.id
      });
    }
  });

  const secretMap: Record<string, TwoFactorAccount[]> = {};
  accounts.value.forEach(a => {
    const clean = a.secret.replace(/[\s=]/g, '').toUpperCase();
    if (clean) {
      if (!secretMap[clean]) secretMap[clean] = [];
      secretMap[clean].push(a);
    }
  });
  Object.values(secretMap).forEach(list => {
    if (list.length > 1) {
      const labels = list.map(a => a.label).join(' 与 ');
      const ids = list.map(a => a.id);
      warnings.push({
        id: `dup-${ids.join('-')}`,
        type: 'duplicate',
        title: '检测到密钥复用',
        desc: `账户 [${labels}] 使用了相同的 2FA 密钥，这破坏了双重验证的隔离安全性。`,
        duplicateIds: ids
      });
    }
  });

  if (!lastBackupTime.value) {
    warnings.push({
      id: 'backup-none',
      type: 'backup',
      title: '未创建安全备份',
      desc: '您未曾在本设备导出过安全备份，若清理浏览器缓存或遭遇设备故障可能会导致数据丢失。',
      actionText: '立即备份'
    });
  } else {
    const days = (Date.now() - new Date(lastBackupTime.value).getTime()) / (1000 * 60 * 60 * 24);
    if (days > 30) {
      warnings.push({
        id: 'backup-old',
        type: 'backup',
        title: '备份数据过旧',
        desc: `上一次安全备份是 ${Math.floor(days)} 天前，近期可能有新增修改，建议立即导出最新备份。`,
        actionText: '立即备份'
      });
    }
  }

  if (uncategorizedCount.value > 0) {
    warnings.push({
      id: 'uncategorized',
      type: 'uncategorized',
      title: '存在未分类账户',
      desc: `目前有 ${uncategorizedCount.value} 个账户未归类，可以拖拽卡片至顶部分组，或一键自动整理。`,
      actionText: '一键归档'
    });
  }

  return warnings;
});*/

/*async function autoCategorizeAll() {
  const uncategorized = accounts.value.filter(a => !a.category || !a.category.trim());
  if (uncategorized.length === 0) return;
  
  isLoading.value = true;
  try {
    const promises = uncategorized.map(acc => 
      api.put(`/api/two-factor/accounts/${acc.id}`, {
        label: acc.label,
        email: acc.email,
        note: acc.note,
        category: '待整理'
      })
    );
    await Promise.all(promises);
    ElMessage.success('成功将未分类账号归档至 “待整理” 分组');
    await fetchAccounts();
  } catch (err) {
    ElMessage.error('一键归类失败');
  } finally {
    isLoading.value = false;
  }
}*/

// Drag and Drop
function onDragStart(event: DragEvent, acc: TwoFactorAccount) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', acc.id);
  }
  draggingAccountId.value = acc.id;
}

function onDragEnd() {
  draggingAccountId.value = null;
  dragOverCategory.value = null;
}

function onDragOver(event: DragEvent, categoryName: string) {
  event.preventDefault();
  dragOverCategory.value = categoryName;
}

function onDragLeave() {
  dragOverCategory.value = null;
}

async function onDrop(event: DragEvent, targetCategory: string) {
  event.preventDefault();
  const accId = event.dataTransfer?.getData('text/plain') || draggingAccountId.value;
  if (!accId) return;

  const account = accounts.value.find((a) => a.id === accId);
  if (!account) return;

  const categoryValue = targetCategory === 'uncategorized' ? '' : targetCategory;

  if (
    account.category === categoryValue ||
    (targetCategory === 'uncategorized' && (!account.category || !account.category.trim()))
  ) {
    dragOverCategory.value = null;
    draggingAccountId.value = null;
    return;
  }

  try {
    isLoading.value = true;
    await api.put(`/api/two-factor/accounts/${account.id}`, {
      label: account.label,
      email: account.email,
      note: account.note,
      category: categoryValue,
    });

    ElMessage.success(
      `已成功将 "${account.label}" 移动到 "${targetCategory === 'uncategorized' ? '未分类' : targetCategory}" 分组`,
    );
    await fetchAccounts();
  } catch (err) {
    ElMessage.error('移动分组失败');
  } finally {
    isLoading.value = false;
    dragOverCategory.value = null;
    draggingAccountId.value = null;
  }
}

// Category Management
const newCategoryName = ref<string>('');

async function createCategory() {
  const name = newCategoryName.value.trim();
  if (!name) {
    ElMessage.warning('请输入分组名称');
    return;
  }
  if (categories.value.includes(name)) {
    ElMessage.warning(`分组 "${name}" 已存在`);
    return;
  }
  // Category is created when at least one account is assigned to it.
  // Here we just close and set selectedCategory so user can assign accounts.
  newCategoryName.value = '';
  ElMessage.success(`分组 "${name}" 已创建，您可以在添加/编辑账号时选择它，或将账号拖入该分组`);
  // Add it as a pending category visible in filter bar by temporarily storing in localStorage
  const pending = JSON.parse(localStorage.getItem('two_factor_pending_categories') || '[]');
  if (!pending.includes(name)) {
    pending.push(name);
    localStorage.setItem('two_factor_pending_categories', JSON.stringify(pending));
  }
  pendingCategories.value = pending;
}

const pendingCategories = ref<string[]>(
  JSON.parse(localStorage.getItem('two_factor_pending_categories') || '[]'),
);

const allCategories = computed(() => {
  const set = new Set<string>(categories.value);
  pendingCategories.value.forEach((p) => set.add(p));
  return Array.from(set);
});

function removePendingCategory(name: string) {
  pendingCategories.value = pendingCategories.value.filter((p) => p !== name);
  localStorage.setItem('two_factor_pending_categories', JSON.stringify(pendingCategories.value));
}

async function renameCategory(oldName: string) {
  try {
    const { value: newName } = await ElMessageBox.prompt(
      `请输入 "${oldName}" 分组的新名称：`,
      '重命名分组',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: oldName,
        inputPattern: /\S+/,
        inputErrorMessage: '分组名称不能为空',
      },
    );

    if (!newName || newName.trim() === oldName) return;

    isLoading.value = true;
    const targets = accounts.value.filter((a) => a.category === oldName);
    const promises = targets.map((acc) =>
      api.put(`/api/two-factor/accounts/${acc.id}`, {
        label: acc.label,
        email: acc.email,
        note: acc.note,
        category: newName.trim(),
      }),
    );
    await Promise.all(promises);
    ElMessage.success(`成功将分组 "${oldName}" 重命名为 "${newName.trim()}"`);
    if (selectedCategory.value === oldName) {
      selectedCategory.value = newName.trim();
    }
    await fetchAccounts();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('重命名分组失败');
    }
  } finally {
    isLoading.value = false;
  }
}

async function deleteCategory(categoryName: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分组 "${categoryName}" 吗？该分组下的所有账号将变更为“未分类”，账号数据不会丢失。`,
      '删除分组确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );

    isLoading.value = true;
    const targets = accounts.value.filter((a) => a.category === categoryName);
    const promises = targets.map((acc) =>
      api.put(`/api/two-factor/accounts/${acc.id}`, {
        label: acc.label,
        email: acc.email,
        note: acc.note,
        category: '',
      }),
    );
    await Promise.all(promises);
    ElMessage.success(`分组 "${categoryName}" 已删除，相关账号已变更为未分类`);
    if (selectedCategory.value === categoryName) {
      selectedCategory.value = 'all';
    }
    removePendingCategory(categoryName);
    await fetchAccounts();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除分组失败');
    }
  } finally {
    isLoading.value = false;
  }
}

// Brand recognition helper
function getBrandInfo(label: string, email?: string | null) {
  const name = (label + ' ' + (email || '')).toLowerCase();

  if (name.includes('github')) {
    return {
      name: 'GitHub',
      gradient: 'from-zinc-900 via-neutral-900 to-zinc-950 border-neutral-700/60',
      text: 'text-slate-200',
      accentColor: '#24292f',
      tagBg: 'bg-white/10 text-white border-white/5',
      icon: 'Github',
    };
  }
  if (name.includes('google') || name.includes('gmail') || name.includes('chrome')) {
    return {
      name: 'Google',
      gradient: 'from-rose-500/10 via-amber-500/5 to-blue-500/10 border-rose-500/20',
      text: 'text-rose-400',
      accentColor: '#ea4335',
      tagBg: 'bg-rose-500/15 text-rose-400 border-rose-500/10',
      icon: 'Chrome',
    };
  }
  if (
    name.includes('microsoft') ||
    name.includes('outlook') ||
    name.includes('azure') ||
    name.includes('office')
  ) {
    return {
      name: 'Microsoft',
      gradient: 'from-blue-600/10 via-indigo-600/5 to-transparent border-blue-500/20',
      text: 'text-blue-400',
      accentColor: '#00a4ef',
      tagBg: 'bg-blue-500/15 text-blue-400 border-blue-500/10',
      icon: 'Lock',
    };
  }
  if (name.includes('aws') || name.includes('amazon')) {
    return {
      name: 'Amazon AWS',
      gradient: 'from-amber-600/15 via-orange-500/10 to-transparent border-amber-500/20',
      text: 'text-amber-500',
      accentColor: '#ff9900',
      tagBg: 'bg-amber-500/15 text-amber-500 border-amber-500/10',
      icon: 'Cpu',
    };
  }
  if (name.includes('openai') || name.includes('chatgpt')) {
    return {
      name: 'OpenAI',
      gradient: 'from-emerald-600/15 via-teal-500/10 to-transparent border-emerald-500/20',
      text: 'text-emerald-400',
      accentColor: '#10a37f',
      tagBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/10',
      icon: 'Sparkles',
    };
  }
  if (name.includes('apple') || name.includes('icloud')) {
    return {
      name: 'Apple',
      gradient: 'from-neutral-200/10 to-neutral-400/5 border-neutral-700/60',
      text: 'text-neutral-300',
      accentColor: '#a3a3a3',
      tagBg: 'bg-white/10 text-neutral-300 border-white/5',
      icon: 'ShieldCheck',
    };
  }
  if (name.includes('steam')) {
    return {
      name: 'Steam',
      gradient: 'from-cyan-900/20 via-sky-800/10 to-slate-900/5 border-cyan-500/20',
      text: 'text-cyan-400',
      accentColor: '#171a21',
      tagBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/10',
      icon: 'Lock',
    };
  }
  if (
    name.includes('binance') ||
    name.includes('crypto') ||
    name.includes('okx') ||
    name.includes('coinbase') ||
    name.includes('wallet') ||
    name.includes('metamask')
  ) {
    return {
      name: 'Crypto',
      gradient: 'from-yellow-600/15 via-amber-500/10 to-transparent border-yellow-500/20',
      text: 'text-yellow-400',
      accentColor: '#f3ba2f',
      tagBg: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/10',
      icon: 'TrendingUp',
    };
  }
  if (name.includes('facebook') || name.includes('meta') || name.includes('instagram')) {
    return {
      name: 'Meta',
      gradient: 'from-blue-600/15 via-sky-500/10 to-transparent border-blue-500/20',
      text: 'text-blue-400',
      accentColor: '#0668e1',
      tagBg: 'bg-blue-500/15 text-blue-400 border-blue-500/10',
      icon: 'Globe',
    };
  }

  // Fallback custom color based on first char code
  const charCode = label.charCodeAt(0) || 65;
  const hue = (charCode * 23) % 360;
  return {
    name: 'Generic',
    gradient: `from-hsl(${hue},45%,15%)/15 via-hsl(${hue},30%,8%)/10 to-transparent border-slate-700/60`,
    text: `text-slate-350`,
    accentColor: `hsl(${hue},50%,50%)`,
    tagBg: `bg-slate-800 text-slate-400 border-slate-700/40`,
    icon: 'KeyRound',
  };
}

// Filter accounts (with category filter, search highlight and pinning sort)
const filteredAccounts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let list = accounts.value;

  // 1. Filter by category
  if (selectedCategory.value !== 'all') {
    if (selectedCategory.value === 'uncategorized') {
      list = list.filter((acc) => !acc.category || !acc.category.trim());
    } else {
      // Also clean pending categories that now have real accounts
      list = list.filter((acc) => acc.category === selectedCategory.value);
    }
  }

  // 2. Filter by search query
  if (query) {
    list = list.filter(
      (acc) =>
        acc.label.toLowerCase().includes(query) ||
        (acc.email && acc.email.toLowerCase().includes(query)) ||
        (acc.note && acc.note.toLowerCase().includes(query)) ||
        (acc.category && acc.category.toLowerCase().includes(query)),
    );
  }

  // 3. Sort
  return [...list].sort((a, b) => {
    if (sortBy.value === 'label_asc') {
      return a.label.localeCompare(b.label, 'zh-CN');
    }
    if (sortBy.value === 'created_desc') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    // Default: pinned_first
    const aPinned = pinnedAccountIds.value.includes(a.id) ? 1 : 0;
    const bPinned = pinnedAccountIds.value.includes(b.id) ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

function getBrandIconComponent(acc: TwoFactorAccount) {
  const brand = getBrandInfo(acc.label, acc.email);
  switch (brand.icon) {
    case 'Github':
      return Github;
    case 'Chrome':
      return Chrome;
    case 'Lock':
      return Lock;
    case 'Cpu':
      return Cpu;
    case 'TrendingUp':
      return TrendingUp;
    case 'Globe':
      return Globe;
    case 'Briefcase':
      return Briefcase;
    case 'ShieldCheck':
      return ShieldCheck;
    case 'Sparkles':
      return Sparkles;
    default:
      return KeyRound;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Search highlight helper
function highlightText(text: string | null, query: string): string {
  if (!text) return '';
  const escapedText = escapeHtml(text);
  if (!query) return escapedText;

  const escapedQuery = query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapedText.replace(
    regex,
    '<mark class="bg-violet-500/35 text-white rounded px-0.5 font-semibold">$1</mark>',
  );
}

onMounted(() => {
  fetchAccounts();
  startTotpTimer();
  checkClockSync();
});

onUnmounted(() => {
  stopTotpTimer();
});
</script>

<template>
  <div
    class="two-fa-container min-h-screen p-4 sm:p-6"
    style="background-color: var(--bg-app); color: var(--text-primary)"
  >
    <!-- Unified Compact Header -->
    <div
      class="two-fa-header bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-transparent border rounded-xl p-3 mb-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 animate-fade-in"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2.5 w-full lg:w-auto">
        <div
          class="p-1.5 rounded-lg shrink-0"
          style="background-color: rgba(99, 102, 241, 0.1); color: var(--accent, #6366f1)"
        >
          <KeyRound class="h-4 w-4" />
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
          <h1 class="text-sm font-bold tracking-tight shrink-0" style="color: var(--text-primary)">
            2FA 验证码管理器
          </h1>
          <!-- Compact Stats Capsule -->
          <div
            class="flex items-center gap-1.5 text-[10.5px] bg-slate-100 dark:bg-slate-800/60 border px-2 py-0.5 rounded-full select-none w-max max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
            style="border-color: var(--border-base)"
          >
            <span class="text-slate-600 dark:text-slate-350"
              >账号
              <b class="text-indigo-600 dark:text-indigo-300 font-bold ml-0.5">{{
                accounts.length
              }}</b></span
            >
            <span class="text-slate-350 dark:text-slate-650">|</span>
            <span class="text-slate-600 dark:text-slate-350"
              >分组
              <b class="text-emerald-600 dark:text-emerald-300 font-bold ml-0.5">{{
                allCategories.length
              }}</b></span
            >
            <span class="text-slate-350 dark:text-slate-650">|</span>
            <span
              v-if="lastBackupTime"
              class="text-emerald-600 dark:text-emerald-300 font-semibold flex items-center gap-0.5 animate-fade-in"
              :title="'上次备份时间: ' + new Date(lastBackupTime).toLocaleString()"
            >
              <Clock class="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />
              <span>{{
                new Date(lastBackupTime).toLocaleDateString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                })
              }}</span>
            </span>
            <span
              v-else
              class="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-0.5"
              title="尚未进行数据备份"
            >
              <ShieldAlert class="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />
              <span>未备份</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Actions Group -->
      <div
        class="flex items-center justify-between sm:justify-end gap-1.5 w-full lg:w-auto shrink-0 flex-wrap"
      >
        <!-- Time Sync status check -->
        <button
          class="hover:bg-slate-700/40 border font-semibold px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[10px] bg-transparent"
          style="border-color: var(--border-base)"
          title="点击校对本地时钟与服务器时间"
          @click="openSecurityCenter('calibration')"
        >
          <span class="relative flex h-1.5 w-1.5">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              :class="
                clockSyncStatus.status === 'perfect'
                  ? 'bg-emerald-400'
                  : clockSyncStatus.status === 'warning'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
              "
            ></span>
            <span
              class="relative inline-flex rounded-full h-1.5 w-1.5"
              :class="
                clockSyncStatus.status === 'perfect'
                  ? 'bg-emerald-500'
                  : clockSyncStatus.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              "
            ></span>
          </span>
          <span :class="clockSyncStatus.color" class="text-[10px]">{{ clockSyncStatus.text }}</span>
        </button>

        <div class="flex items-center gap-1.5">
          <!-- Export button -->
          <button
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:text-indigo-400"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-secondary);
            "
            title="导出全部数据（账号 + 分组 + 备注），支持密码加密"
            @click="openSecurityCenter('export')"
          >
            <Download class="h-3 w-3" />
            <span>导出</span>
          </button>

          <!-- Import button -->
          <button
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border hover:bg-emerald-550/10 hover:border-emerald-550/40 hover:text-emerald-450"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-secondary);
            "
            title="从备份 JSON 文件导入，自动还原账号与分组"
            @click="openSecurityCenter('import')"
          >
            <Upload class="h-3 w-3" />
            <span>导入</span>
          </button>

          <el-button
            type="primary"
            class="bg-indigo-600 hover:bg-indigo-500 border-none font-semibold px-2.5 py-1 rounded-lg transition-all flex items-center gap-0.5 cursor-pointer text-[11px]"
            @click="isAddDialogVisible = true"
          >
            <Plus class="h-3.5 w-3.5" />
            <span>添加</span>
          </el-button>
        </div>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2 w-full">
      <div class="flex items-center gap-2 w-full sm:w-auto flex-1 sm:flex-initial">
        <div class="relative flex-1 sm:w-60 md:w-72">
          <el-input
            v-model="searchQuery"
            placeholder="搜索标签、邮箱或备注..."
            clearable
            class="custom-search-input"
          >
            <template #prefix>
              <Search class="h-3.5 w-3.5 text-slate-400" />
            </template>
          </el-input>

          <!-- Floating Filter Result Badge (compact & only visible when filtered) -->
          <transition name="el-fade-in-linear">
            <span
              v-if="filteredAccounts.length !== accounts.length"
              class="absolute -top-2 -right-1.5 px-1.5 py-0.5 text-[8.5px] font-bold rounded bg-indigo-650 text-white border border-slate-900 shadow-md select-none shrink-0"
            >
              已过滤 {{ filteredAccounts.length }}
            </span>
          </transition>
        </div>

        <div class="shrink-0 w-24 sm:w-28">
          <el-select v-model="sortBy" placeholder="排序方式" class="custom-sort-select">
            <el-option label="默认排序" value="pinned_first" />
            <el-option label="名称 A-Z" value="label_asc" />
            <el-option label="最新添加" value="created_desc" />
          </el-select>
        </div>
      </div>

      <!-- Layout Switcher & Privacy Buttons -->
      <div
        class="flex items-center gap-1 bg-slate-800/20 border border-slate-700/60 p-0.5 rounded-lg shrink-0"
        style="border-color: var(--border-base)"
      >
        <Tabs
          v-model="layoutMode"
          :options="[
            { value: 'grid', label: '', icon: LayoutGrid },
            { value: 'list', label: '', icon: List },
          ]"
          size="sm"
          class="!bg-transparent border-none shrink-0"
        />

        <div class="w-px h-3 bg-slate-700/60 mx-0.5"></div>

        <button
          type="button"
          class="p-1 px-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer border-none bg-transparent"
          :class="
            isPrivacyMode
              ? '!bg-amber-600/25 !text-amber-400 border border-amber-500/20'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          "
          :title="isPrivacyMode ? '关闭隐私遮罩' : '开启隐私遮罩'"
          @click="isPrivacyMode = !isPrivacyMode"
        >
          <ShieldAlert v-if="isPrivacyMode" class="h-3.5 w-3.5 text-amber-400" />
          <ShieldCheck v-else class="h-3.5 w-3.5 text-emerald-400" />
          <span class="hidden md:inline">隐私模糊</span>
        </button>
      </div>
    </div>

    <!-- Droppable Category Tabs Filter Bar -->
    <div
      class="flex items-center justify-between gap-2 mb-3 px-1 border-b pb-2 animate-fade-in"
      style="border-color: var(--border-base)"
    >
      <div
        class="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 -mr-2 pr-2 py-0.5 select-none"
      >
        <span
          class="text-[10px] uppercase font-bold tracking-wider mr-1 text-slate-500 flex items-center gap-1 shrink-0"
        >
          <Tag class="h-3 w-3" style="color: var(--accent, #6366f1)" />
          <span>分组:</span>
        </span>

        <!-- All accounts pill -->
        <button
          class="px-2.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-all border font-semibold shrink-0"
          :style="{
            backgroundColor:
              selectedCategory === 'all' ? 'var(--accent, #6366f1)' : 'rgba(148, 163, 184, 0.08)',
            borderColor: selectedCategory === 'all' ? 'transparent' : 'transparent',
            color: selectedCategory === 'all' ? '#fff' : 'var(--text-secondary)',
          }"
          @click="selectedCategory = 'all'"
        >
          全部 ({{ accounts.length }})
        </button>

        <!-- Real category pills (with drag-drop target) -->
        <button
          v-for="cat in allCategories"
          :key="cat"
          class="px-2.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-all border font-semibold relative shrink-0"
          :class="{
            'scale-105 !border-indigo-500 !bg-indigo-500/25 shadow-lg': dragOverCategory === cat,
          }"
          :style="{
            backgroundColor:
              selectedCategory === cat ? 'var(--accent, #6366f1)' : 'rgba(148, 163, 184, 0.08)',
            borderColor: selectedCategory === cat ? 'transparent' : 'transparent',
            color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
          }"
          @click="selectedCategory = cat"
          @dragover.prevent="onDragOver($event, cat)"
          @dragleave="onDragLeave"
          @drop="onDrop($event, cat)"
        >
          {{ cat }}
          <span class="ml-0.5 opacity-70">{{
            accounts.filter((a) => a.category === cat).length
          }}</span>
          <!-- indicator that category is empty/pending -->
          <span
            v-if="
              pendingCategories.includes(cat) &&
              accounts.filter((a) => a.category === cat).length === 0
            "
            class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 border border-slate-900"
            title="空分组（可拖入账号激活）"
          ></span>
        </button>

        <!-- Uncategorized pill -->
        <button
          v-if="uncategorizedCount > 0"
          class="px-2.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-all border font-semibold shrink-0"
          :class="{
            'scale-105 !border-indigo-500 !bg-indigo-500/25 shadow-lg':
              dragOverCategory === 'uncategorized',
          }"
          :style="{
            backgroundColor:
              selectedCategory === 'uncategorized' ? '#f59e0b' : 'rgba(245,158,11,0.10)',
            borderColor: 'transparent',
            color: selectedCategory === 'uncategorized' ? '#fff' : '#f59e0b',
          }"
          @click="selectedCategory = 'uncategorized'"
          @dragover.prevent="onDragOver($event, 'uncategorized')"
          @dragleave="onDragLeave"
          @drop="onDrop($event, 'uncategorized')"
        >
          未分类 ({{ uncategorizedCount }})
        </button>
      </div>

      <!-- Manage groups button -->
      <button
        class="px-2.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-all border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 font-semibold flex items-center gap-0.5 shrink-0 ml-2"
        title="新建分组 / 重命名 / 删除"
        @click="isCategoryManagerVisible = true"
      >
        <Edit class="h-3 w-3" />
        <span>管理</span>
      </button>
    </div>

    <!-- Loader -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 gap-3">
      <el-icon class="is-loading text-3xl text-indigo-500"><RefreshCw /></el-icon>
      <span class="text-slate-400 text-sm">正在加载安全凭据...</span>
    </div>

    <!-- Empty view -->
    <div
      v-else-if="filteredAccounts.length === 0"
      class="flex flex-col items-center justify-center py-20 border border-dashed rounded-2xl bg-slate-900/10"
      style="border-color: var(--border-base)"
    >
      <div class="p-4 bg-slate-800/30 text-slate-500 rounded-full mb-4">
        <FolderOpen class="h-10 w-10 text-indigo-400" />
      </div>
      <p class="text-sm font-semibold mb-1" style="color: var(--text-primary)">
        未找到任何 2FA 安全账号
      </p>
      <p class="text-xs" style="color: var(--text-secondary)">
        可尝试更换筛选分组或修改搜索条件后再试
      </p>
    </div>

    <!-- Main Content Layouts -->
    <div v-else class="animate-fade-in">
      <!-- 1. Grid View (Compact Cards) -->
      <div
        v-if="layoutMode === 'grid'"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
      >
        <div
          v-for="acc in filteredAccounts"
          :key="acc.id"
          draggable="true"
          class="acc-card rounded-xl p-3 border transition-all duration-300 flex flex-col justify-between shadow-sm group/item relative overflow-hidden cursor-grab active:cursor-grabbing"
          :class="{
            'animate-border-pulse border-rose-500/50 shadow-rose-950/20':
              liveCodes[acc.id]?.timeLeft <= 5,
          }"
          :style="{
            backgroundColor: 'var(--bg-card)',
            borderColor: pinnedAccountIds.includes(acc.id)
              ? 'var(--accent, #6366f1)'
              : liveCodes[acc.id]?.timeLeft <= 5
                ? '#f43f5e'
                : 'var(--border-base)',
            boxShadow: pinnedAccountIds.includes(acc.id)
              ? '0 2px 8px rgba(99, 102, 241, 0.12)'
              : 'none',
          }"
          @dragstart="onDragStart($event, acc)"
          @dragend="onDragEnd"
        >
          <!-- Background light effect -->
          <div
            class="absolute -right-16 -top-16 w-32 h-32 rounded-full blur-3xl group-hover/item:bg-indigo-500/10 transition-all duration-500 pointer-events-none"
            style="background-color: rgba(99, 102, 241, 0.02)"
          ></div>

          <div class="flex flex-col gap-2">
            <!-- Header: Label & Email & Category tag -->
            <div class="flex justify-between items-start gap-1.5">
              <!-- Avatar or Dynamic Brand Logo icon -->
              <div
                class="w-6.5 h-6.5 rounded-lg shrink-0 flex items-center justify-center border text-[10px] font-bold bg-gradient-to-br"
                :class="[
                  getBrandInfo(acc.label, acc.email).gradient,
                  getBrandInfo(acc.label, acc.email).text,
                ]"
              >
                <component :is="getBrandIconComponent(acc)" class="h-3.5 w-3.5" />
              </div>

              <div class="min-w-0 flex-1 ml-0.5">
                <h3
                  class="text-xs font-bold truncate flex items-center gap-1"
                  :title="acc.label"
                  style="color: var(--text-primary)"
                >
                  <span v-html="highlightText(acc.label, searchQuery)"></span>
                  <span
                    v-if="acc.category"
                    class="text-[7.5px] font-black uppercase tracking-wider px-1 py-0.25 rounded shrink-0"
                    :class="getBrandInfo(acc.label, acc.email).tagBg"
                  >
                    {{ acc.category }}
                  </span>
                </h3>
                <p
                  class="text-[9px] truncate mt-0.25"
                  :title="acc.email || ''"
                  style="color: var(--text-secondary)"
                >
                  <span v-html="highlightText(acc.email || '未绑定账号', searchQuery)"></span>
                </p>
              </div>

              <!-- Hover Actions -->
              <div
                class="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity duration-200"
              >
                <button
                  class="p-0.5 rounded transition-colors cursor-pointer bg-transparent border-none text-slate-500 hover:text-amber-400"
                  :class="pinnedAccountIds.includes(acc.id) ? '!text-amber-400 !opacity-100' : ''"
                  :title="pinnedAccountIds.includes(acc.id) ? '取消置顶' : '置顶'"
                  @click="togglePin(acc.id)"
                >
                  <Pin v-if="pinnedAccountIds.includes(acc.id)" class="h-3 w-3 fill-amber-400" />
                  <PinOff v-else class="h-3 w-3" />
                </button>
                <button
                  class="p-0.5 text-slate-500 hover:text-indigo-400 rounded transition-colors cursor-pointer bg-transparent border-none"
                  title="二维码"
                  @click="showQrCode(acc)"
                >
                  <QrCode class="h-3 w-3" />
                </button>
                <button
                  class="p-0.5 text-slate-500 hover:text-amber-400 rounded transition-colors cursor-pointer bg-transparent border-none"
                  title="编辑"
                  @click="openEditDialog(acc)"
                >
                  <Edit class="h-3 w-3" />
                </button>
                <button
                  class="p-0.5 text-slate-500 hover:text-rose-500 rounded transition-colors cursor-pointer bg-transparent border-none"
                  title="删除"
                  @click="deleteAccount(acc)"
                >
                  <Trash2 class="h-3 w-3" />
                </button>
              </div>
            </div>

            <!-- OTP Code Display (with Privacy Blur option) -->
            <div
              class="code-box border rounded-lg p-1.5 px-2 flex items-center justify-between gap-1.5"
              style="background-color: var(--bg-app); border-color: var(--border-base)"
            >
              <div class="flex flex-col min-w-0 w-full">
                <div class="flex items-center gap-1">
                  <span class="text-[8px] font-bold tracking-wider uppercase text-slate-500"
                    >动态码</span
                  >
                  <span
                    v-if="copiedStates[acc.id]"
                    class="text-[8px] text-emerald-400 font-bold bg-emerald-500/10 px-0.5 rounded animate-pulse"
                    >已复制</span
                  >
                </div>
                <div
                  class="text-base font-extrabold tracking-widest font-mono cursor-pointer select-all transition-colors flex items-center gap-1.5 hover:text-indigo-400"
                  style="color: var(--accent, #6366f1)"
                  :class="{
                    'blur-[5px] hover:blur-none transition-all duration-300': isPrivacyMode,
                  }"
                  @click="copyCode(acc.id)"
                >
                  <span class="truncate">
                    {{
                      liveCodes[acc.id]
                        ? liveCodes[acc.id].code.slice(0, 3) + ' ' + liveCodes[acc.id].code.slice(3)
                        : '------'
                    }}
                  </span>
                  <Copy
                    class="h-3 w-3 text-slate-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                  />
                </div>
              </div>

              <!-- SVG Progress Ring -->
              <div class="flex items-center justify-center relative shrink-0">
                <svg class="w-6 h-6 transform -rotate-90">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="rgba(71, 85, 105, 0.15)"
                    stroke-width="2"
                    fill="transparent"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    :stroke="
                      liveCodes[acc.id]?.timeLeft <= 5 ? '#ef4444' : 'var(--accent, #6366f1)'
                    "
                    stroke-width="2"
                    fill="transparent"
                    :stroke-dasharray="2 * Math.PI * 9"
                    :stroke-dashoffset="
                      2 * Math.PI * 9 * (1 - (liveCodes[acc.id]?.timeLeft || 30) / 30)
                    "
                    class="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span
                  class="absolute text-[7px] font-bold font-mono"
                  :class="
                    liveCodes[acc.id]?.timeLeft <= 5
                      ? 'text-rose-500 animate-pulse'
                      : 'text-slate-400'
                  "
                >
                  {{ liveCodes[acc.id]?.timeLeft ?? 30 }}
                </span>
              </div>
            </div>
          </div>

          <!-- Secret Key & Notes -->
          <div
            class="border-t pt-1.5 mt-2 flex flex-col gap-1"
            style="border-color: var(--border-base)"
          >
            <div
              class="flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded border"
              style="background-color: var(--bg-app); border-color: var(--border-base)"
            >
              <span
                class="font-mono flex items-center gap-1 truncate max-w-[70%]"
                style="color: var(--text-secondary)"
              >
                <KeyRound class="h-2.5 w-2.5 shrink-0" style="color: var(--accent, #6366f1)" />
                <span
                  class="truncate"
                  :class="{
                    'blur-[4px] hover:blur-none transition-all duration-300': isPrivacyMode,
                  }"
                >
                  {{ revealedSecrets[acc.id] ? acc.secret : '••••••••••••' }}
                </span>
              </span>
              <div class="flex items-center gap-0.5 shrink-0">
                <button
                  class="text-slate-500 hover:text-slate-355 transition-colors cursor-pointer border-none bg-transparent p-0.5"
                  title="隐藏/显示"
                  @click="toggleSecret(acc.id)"
                >
                  <EyeOff v-if="revealedSecrets[acc.id]" class="h-3 w-3" />
                  <Eye v-else class="h-3 w-3" />
                </button>
                <button
                  class="text-slate-500 hover:text-slate-355 transition-colors cursor-pointer border-none bg-transparent p-0.5"
                  title="复制"
                  @click="copyToClipboard(acc.secret, acc.id, '密钥已复制')"
                >
                  <Copy class="h-3 w-3" />
                </button>
              </div>
            </div>

            <!-- Notes -->
            <div
              v-if="acc.note"
              class="flex items-center gap-1 text-[9px] px-0.5"
              style="color: var(--text-secondary)"
            >
              <FileText class="h-2.5 w-2.5 shrink-0 text-slate-500" />
              <span class="truncate text-slate-500" :title="acc.note">
                <span v-html="highlightText(acc.note, searchQuery)"></span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Column List View -->
      <div v-else class="flex flex-col gap-2">
        <!-- List Header -->
        <div
          class="hidden lg:flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 border-b"
          style="border-color: var(--border-base)"
        >
          <div class="w-[260px]">账号信息</div>
          <div class="w-[180px]">双重验证动态码</div>
          <div class="w-[220px]">安全密钥</div>
          <div class="flex-1 px-2">备注说明</div>
          <div class="w-[110px] text-right">操作</div>
        </div>

        <!-- List Items -->
        <div
          v-for="acc in filteredAccounts"
          :key="acc.id"
          draggable="true"
          class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 px-4 border rounded-xl hover:shadow-md transition-all duration-300 relative overflow-hidden group/listitem cursor-grab active:cursor-grabbing"
          :class="{ 'border-rose-500/40 shadow-rose-950/10': liveCodes[acc.id]?.timeLeft <= 5 }"
          :style="{
            backgroundColor: 'var(--bg-card)',
            borderColor: pinnedAccountIds.includes(acc.id)
              ? 'var(--accent, #6366f1)'
              : liveCodes[acc.id]?.timeLeft <= 5
                ? '#f43f5e'
                : 'var(--border-base)',
            boxShadow: pinnedAccountIds.includes(acc.id)
              ? '0 2px 8px rgba(99, 102, 241, 0.08)'
              : 'none',
          }"
          @dragstart="onDragStart($event, acc)"
          @dragend="onDragEnd"
        >
          <!-- Column 1: Info (Label / User Email / Category tag) -->
          <div class="flex items-center gap-3 w-full lg:w-[260px] shrink-0 min-w-0">
            <button
              class="p-1 rounded transition-colors cursor-pointer bg-transparent border-none text-slate-500 hover:text-slate-350 shrink-0"
              :title="pinnedAccountIds.includes(acc.id) ? '取消置顶' : '置顶'"
              @click="togglePin(acc.id)"
            >
              <Pin
                v-if="pinnedAccountIds.includes(acc.id)"
                class="h-4 w-4 fill-amber-400 text-amber-400"
              />
              <PinOff v-else class="h-4 w-4" />
            </button>

            <!-- Brand Icon representation -->
            <div
              class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border text-sm font-bold bg-gradient-to-br"
              :class="[
                getBrandInfo(acc.label, acc.email).gradient,
                getBrandInfo(acc.label, acc.email).text,
              ]"
            >
              <component :is="getBrandIconComponent(acc)" class="h-4 w-4" />
            </div>

            <div class="min-w-0">
              <h4
                class="text-sm font-bold truncate flex items-center gap-1.5"
                :title="acc.label"
                style="color: var(--text-primary)"
              >
                <span v-html="highlightText(acc.label, searchQuery)"></span>
                <span
                  v-if="acc.category"
                  class="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                  :class="getBrandInfo(acc.label, acc.email).tagBg"
                >
                  {{ acc.category }}
                </span>
              </h4>
              <p
                class="text-[11px] truncate mt-0.5"
                :title="acc.email || ''"
                style="color: var(--text-secondary)"
              >
                <span v-html="highlightText(acc.email || '未绑定邮箱/账号', searchQuery)"></span>
              </p>
            </div>
          </div>

          <!-- Column 2: Dynamic Code & Countdown (with Privacy Blur) -->
          <div class="flex items-center gap-3 w-full lg:w-[180px] shrink-0">
            <div
              class="border rounded-lg px-3 py-1.5 flex items-center justify-between gap-2.5 w-full"
              style="background-color: var(--bg-app); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-2 cursor-pointer w-full" @click="copyCode(acc.id)">
                <span
                  class="text-base font-extrabold font-mono tracking-wider"
                  style="color: var(--accent, #6366f1)"
                  :class="{
                    'blur-[5px] hover:blur-none transition-all duration-300': isPrivacyMode,
                  }"
                >
                  {{
                    liveCodes[acc.id]
                      ? liveCodes[acc.id].code.slice(0, 3) + ' ' + liveCodes[acc.id].code.slice(3)
                      : '------'
                  }}
                </span>
                <Copy
                  class="h-3 w-3 text-slate-500 opacity-0 group-hover/listitem:opacity-100 transition-opacity ml-auto"
                />
              </div>

              <!-- SVG Progress Ring (Very Small) -->
              <div class="flex items-center justify-center relative shrink-0">
                <svg class="w-6 h-6 transform -rotate-90">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="rgba(71, 85, 105, 0.15)"
                    stroke-width="2"
                    fill="transparent"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    :stroke="
                      liveCodes[acc.id]?.timeLeft <= 5 ? '#ef4444' : 'var(--accent, #6366f1)'
                    "
                    stroke-width="2"
                    fill="transparent"
                    :stroke-dasharray="2 * Math.PI * 9"
                    :stroke-dashoffset="
                      2 * Math.PI * 9 * (1 - (liveCodes[acc.id]?.timeLeft || 30) / 30)
                    "
                    class="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span
                  class="absolute text-[7px] font-bold font-mono"
                  :class="
                    liveCodes[acc.id]?.timeLeft <= 5
                      ? 'text-rose-500 animate-pulse'
                      : 'text-slate-400'
                  "
                >
                  {{ liveCodes[acc.id]?.timeLeft ?? 30 }}
                </span>
              </div>
            </div>
          </div>

          <!-- Column 3: Secret Key (with Privacy Blur) -->
          <div
            class="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border w-full lg:w-[220px] shrink-0"
            style="background-color: var(--bg-app); border-color: var(--border-base)"
          >
            <span
              class="font-mono truncate"
              style="color: var(--text-secondary); max-width: 130px"
              :class="{ 'blur-[4px] hover:blur-none transition-all duration-300': isPrivacyMode }"
            >
              {{ revealedSecrets[acc.id] ? acc.secret : '••••••••••••••••' }}
            </span>
            <div class="flex items-center gap-1.5 shrink-0 ml-1">
              <button
                class="text-slate-500 hover:text-slate-350 transition-colors cursor-pointer border-none bg-transparent"
                @click="toggleSecret(acc.id)"
              >
                <EyeOff v-if="revealedSecrets[acc.id]" class="h-3.5 w-3.5" />
                <Eye v-else class="h-3.5 w-3.5" />
              </button>
              <button
                class="text-slate-500 hover:text-slate-355 transition-colors cursor-pointer border-none bg-transparent"
                @click="copyToClipboard(acc.secret, acc.id, '密钥已复制')"
              >
                <Copy class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <!-- Column 4: Notes/Remark -->
          <div
            class="flex items-center gap-1.5 text-xs min-w-0 w-full lg:w-auto flex-1 px-1 lg:px-2"
          >
            <FileText v-if="acc.note" class="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span class="truncate text-slate-400 italic" :title="acc.note || ''">
              <span v-if="acc.note" v-html="highlightText(acc.note, searchQuery)"></span>
              <span v-else>—</span>
            </span>
          </div>

          <!-- Column 5: Action Buttons -->
          <div class="flex items-center gap-0.5 shrink-0 ml-auto lg:ml-0">
            <button
              class="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
              title="手机扫码添加"
              @click="showQrCode(acc)"
            >
              <QrCode class="h-4 w-4" />
            </button>
            <button
              class="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
              title="编辑"
              @click="openEditDialog(acc)"
            >
              <Edit class="h-4 w-4" />
            </button>
            <button
              class="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
              title="删除"
              @click="deleteAccount(acc)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Security Dialog -->
    <TwoFactorSecurityDialog
      v-model="isSecurityDialogVisible"
      :accounts="accounts"
      :initial-tab="securityDialogTab"
      @exported="(dateStr) => (lastBackupTime = dateStr)"
      @imported="fetchAccounts"
    />

    <!-- Modal Dialog: Category Manager -->
    <el-dialog
      v-model="isCategoryManagerVisible"
      title="管理分组"
      width="90%"
      style="max-width: 480px"
      destroy-on-close
      class="custom-el-dialog"
    >
      <div class="space-y-4">
        <!-- Create new category -->
        <div
          class="rounded-xl border p-3.5 space-y-2.5"
          style="background-color: var(--bg-app); border-color: var(--border-base)"
        >
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">新建分组</p>
          <div class="flex items-center gap-2">
            <el-input
              v-model="newCategoryName"
              placeholder="输入新分组名称，如: 工作、金融、游戏..."
              class="custom-dialog-input flex-1"
              clearable
              @keyup.enter="createCategory"
            />
            <el-button
              type="primary"
              class="bg-indigo-600 hover:bg-indigo-500 border-none font-bold px-4 rounded-xl shrink-0"
              @click="createCategory"
            >
              <Plus class="h-3.5 w-3.5 mr-1" />
              创建
            </el-button>
          </div>
          <p class="text-[10px] text-slate-500">
            创建后可在添加/编辑账号时选择，或直接将账号卡片拖入分组标签来分配。
          </p>
        </div>

        <!-- Existing categories list -->
        <div class="rounded-xl border overflow-hidden" style="border-color: var(--border-base)">
          <div
            class="flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b"
            style="border-color: var(--border-base); background-color: rgba(15, 23, 42, 0.3)"
          >
            <span>分组名称</span>
            <span>账号数</span>
            <span>操作</span>
          </div>

          <div v-if="allCategories.length === 0" class="py-8 text-center text-xs text-slate-500">
            <Tag class="h-8 w-8 mx-auto mb-2 text-slate-700" />
            <p>暂无分组，在上方输入框创建第一个分组</p>
          </div>

          <div
            v-else
            class="divide-y max-h-72 overflow-y-auto"
            style="border-color: var(--border-base)"
          >
            <div
              v-for="cat in allCategories"
              :key="cat"
              class="flex items-center justify-between px-3 py-2.5 text-xs hover:bg-slate-800/20 transition-colors group"
            >
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></div>
                <span class="font-bold text-slate-800 dark:text-slate-200 truncate">{{ cat }}</span>
                <span
                  v-if="
                    pendingCategories.includes(cat) &&
                    accounts.filter((a) => a.category === cat).length === 0
                  "
                  class="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full font-bold shrink-0"
                  >空</span
                >
              </div>
              <span class="text-slate-500 font-mono text-[11px] shrink-0 mx-4">
                {{ accounts.filter((a) => a.category === cat).length }} 个账号
              </span>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  class="px-2 py-1 rounded-lg bg-transparent border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300 cursor-pointer font-bold text-[10px] transition-colors"
                  @click="renameCategory(cat)"
                >
                  重命名
                </button>
                <button
                  class="px-2 py-1 rounded-lg bg-transparent border border-rose-500/20 text-rose-500 hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer font-bold text-[10px] transition-colors"
                  @click="deleteCategory(cat)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>

        <p class="text-[10px] text-slate-500 leading-relaxed">
          💡 重命名会同步修改该分组下所有账号；删除分组后账号变为「未分类」，数据不会丢失。
        </p>
      </div>

      <template #footer>
        <div class="flex justify-end pt-2">
          <el-button
            style="
              background-color: var(--bg-app);
              border: 1px solid var(--border-base);
              color: var(--text-secondary);
            "
            class="px-4 py-1.5 rounded-xl text-xs font-bold"
            @click="isCategoryManagerVisible = false"
          >
            关闭
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Modal Dialog: Add 2FA Account -->
    <TwoFactorAddDialog
      v-model="isAddDialogVisible"
      :all-categories="allCategories"
      @saved="fetchAccounts"
    />

    <!-- Modal Dialog: Edit 2FA Account -->
    <TwoFactorEditDialog
      v-model="isEditDialogVisible"
      :account="selectedEditAccount"
      :all-categories="allCategories"
      @saved="fetchAccounts"
    />

    <!-- Modal Dialog: Mobile QR Code Scanner View -->
    <TwoFactorQrDialog v-model="isQrDialogVisible" :account="qrCodeAccount" />
  </div>
</template>

<style>
/* Custom dialog style overrides for a dark slate visual vibe */
.custom-el-dialog {
  background-color: var(--bg-card) !important;
  border-radius: 1rem !important; /* rounded-2xl */
  border: 1px solid var(--border-base) !important;
}

.custom-el-dialog .el-dialog__title {
  color: var(--text-primary) !important;
  font-weight: 800 !important;
}

.custom-el-dialog .el-dialog__headerbtn .el-dialog__close {
  color: var(--text-secondary) !important;
}

.custom-el-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: var(--accent, #6366f1) !important;
}

/* Custom Input Visual Styles for Element Plus */
.custom-search-input .el-input__wrapper {
  background-color: var(--bg-card) !important;
  box-shadow: 0 0 0 1px var(--border-base) inset !important;
  border-radius: 0.75rem !important; /* rounded-xl */
}

.custom-search-input .el-input__inner {
  color: var(--text-primary) !important;
}

.custom-search-input .el-input__wrapper.is-focus {
  box-shadow:
    0 0 0 1px var(--accent, #6366f1) inset,
    0 0 0 3px rgba(99, 102, 241, 0.15) !important;
}

.custom-dialog-input .el-input__wrapper,
.custom-dialog-input .el-textarea__inner {
  background-color: var(--bg-app) !important;
  box-shadow: 0 0 0 1px var(--border-base) inset !important;
  border-radius: 0.75rem !important;
  color: var(--text-primary) !important;
}

.custom-dialog-input .el-input__inner,
.custom-dialog-input .el-textarea__inner {
  color: var(--text-primary) !important;
}

.custom-dialog-input .el-input__wrapper.is-focus,
.custom-dialog-input .el-textarea__inner:focus {
  box-shadow:
    0 0 0 1px var(--accent, #6366f1) inset,
    0 0 0 3px rgba(99, 102, 241, 0.15) !important;
}

/* Scrollbars */
.custom-el-dialog ::-webkit-scrollbar {
  width: 6px;
}
.custom-el-dialog ::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 10px;
}
.custom-el-dialog ::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.4);
}

.animate-fade-in {
  animation: fadeIn 0.35s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Custom styling for sort dropdown */
.custom-sort-select .el-input__wrapper {
  background-color: var(--bg-card) !important;
  box-shadow: 0 0 0 1px var(--border-base) inset !important;
  border-radius: 0.75rem !important; /* rounded-xl */
}

.custom-sort-select .el-input__inner {
  color: var(--text-primary) !important;
  font-size: 11px !important;
  font-weight: 650 !important;
}

.custom-sort-select .el-input__wrapper.is-focus {
  box-shadow:
    0 0 0 1px var(--accent, #6366f1) inset,
    0 0 0 3px rgba(99, 102, 241, 0.15) !important;
}

/* Dark theme for el-select inside dialogs */
.custom-dialog-input.el-select .el-input__wrapper,
.custom-dialog-input.w-full.el-select .el-input__wrapper {
  background-color: var(--bg-app) !important;
  box-shadow: 0 0 0 1px var(--border-base) inset !important;
  border-radius: 0.75rem !important;
}

.custom-dialog-input.el-select .el-input__inner {
  color: var(--text-primary) !important;
}

.custom-dialog-input.el-select .el-input__wrapper.is-focus {
  box-shadow:
    0 0 0 1px var(--accent, #6366f1) inset,
    0 0 0 3px rgba(99, 102, 241, 0.15) !important;
}

.animate-border-pulse {
  animation: borderPulse 1.2s infinite alternate;
}

@keyframes borderPulse {
  from {
    border-color: rgba(244, 63, 94, 0.3);
    box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.05);
  }
  to {
    border-color: rgba(244, 63, 94, 0.85);
    box-shadow: 0 0 10px 1px rgba(244, 63, 94, 0.25);
  }
}

/* =====================================================
   Mobile Responsive Adjustments
   ===================================================== */
/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

@media (max-width: 640px) {
  .two-fa-container {
    padding: 10px 12px !important;
  }
  .two-fa-header {
    padding: 10px !important;
    gap: 8px !important;
    margin-bottom: 10px !important;
  }

  /* Filters & search adjustments */
  .two-fa-container .custom-search-input {
    width: 100% !important;
  }
  .two-fa-container .custom-sort-select {
    width: 90px !important;
  }
  .two-fa-container .custom-sort-select .el-input__inner {
    font-size: 11px !important;
  }

  /* Grid card adjustments */
  .acc-card {
    padding: 10px !important;
    border-radius: 10px !important;
    gap: 6px !important;
  }
  .acc-card .text-base.font-extrabold {
    font-size: 13px !important;
    letter-spacing: 0.08em !important;
  }
  .acc-card .code-box {
    padding: 4px 6px !important;
    border-radius: 6px !important;
  }

  /* List item adjustments */
  .two-fa-container .flex-col.lg\:flex-row {
    padding: 10px !important;
    gap: 8px !important;
  }
  .two-fa-container .flex-col.lg\:flex-row > div {
    margin: 0 !important;
  }
}
</style>

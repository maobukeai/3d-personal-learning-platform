<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Shield,
  Plus,
  Trash2,
  Check,
  ExternalLink,
  Edit,
  FileText,
  Calendar,
  Sparkles,
  Info,
  CheckCircle,
  RefreshCw,
  Copy,
  Key,
  Search,
  Download,
  Upload,
  ArrowLeft,
  Settings,
  GripVertical
} from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

interface GoogleAccount {
  id: string;
  email: string;
  password?: string;
  recoveryEmail?: string;
  twoFASecret?: string;
  country?: string;
  note?: string;
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
    parsedAccounts.value.forEach(acc => {
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
const isCategoryManagerVisible = ref<boolean>(false);

// Search and status filters
const searchQuery = ref<string>('');
const statusFilter = ref<'all' | 'warming' | 'completed' | 'paused'>('all');

// Batch selection
const selectedAccountIds = ref<string[]>([]);

// Tabs & Categories
const activeTab = ref<'warming' | 'manage'>('warming');
const selectedCategory = ref<string>('all');
const categoriesListBackend = ref<string[]>([]);
const newCategoryName = ref<string>('');

// Compute categories list dynamically
const categoriesList = computed(() => {
  const cats = new Set<string>(categoriesListBackend.value);
  accounts.value.forEach(a => {
    if (a.category && a.category !== '未分类') {
      cats.add(a.category);
    }
  });
  const list = Array.from(cats).filter(c => c !== '未分类' && c.trim() !== '');
  return ['all', '未分类', ...list];
});

const fetchCategories = async () => {
  try {
    const res = await api.get('/api/google-warming/accounts/categories');
    if (res.data && res.data.categories) {
      categoriesListBackend.value = res.data.categories;
    }
  } catch (e: any) {
    console.error('获取分类列表失败:', e);
  }
};

const handleAddCategory = async () => {
  if (!newCategoryName.value.trim()) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  const cat = newCategoryName.value.trim();
  if (cat === '未分类' || cat === 'all') {
    ElMessage.warning('无效的分类名称');
    return;
  }
  if (categoriesList.value.includes(cat)) {
    ElMessage.warning('分类已存在');
    return;
  }
  try {
    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/categories/add', {
      category: cat
    });
    if (res.data && res.data.success) {
      ElMessage.success(`添加分类「${cat}」成功！`);
      newCategoryName.value = '';
      await fetchCategories();
    }
  } catch (e: any) {
    ElMessage.error(getApiErrorMessage(e, '添加分类失败'));
  } finally {
    isLoading.value = false;
  }
};

// Category count helper
const getCategoryCount = (category: string) => {
  if (category === 'all') return accounts.value.length;
  if (category === '未分类') {
    return accounts.value.filter(a => !a.category || a.category === '未分类').length;
  }
  return accounts.value.filter(a => a.category === category).length;
};

// Filtered and categorized accounts for the management table
const filteredAndCategorizedAccounts = computed(() => {
  return accounts.value.filter(acc => {
    // Search query filter
    const query = searchQuery.value.trim().toLowerCase();
    const matchQuery = !query ||
      acc.email.toLowerCase().includes(query) ||
      (acc.note && acc.note.toLowerCase().includes(query)) ||
      (acc.country && acc.country.toLowerCase().includes(query)) ||
      (acc.category && acc.category.toLowerCase().includes(query));

    // Category filter
    let matchCategory = true;
    if (selectedCategory.value === '未分类') {
      matchCategory = !acc.category || acc.category === '未分类';
    } else if (selectedCategory.value !== 'all') {
      matchCategory = acc.category === selectedCategory.value;
    }

    return matchQuery && matchCategory;
  });
});

// selection handler for el-table
const handleSelectionChange = (selection: GoogleAccount[]) => {
  selectedAccountIds.value = selection.map(item => item.id);
};

// Drag & Drop account categorization
const draggedAccount = ref<GoogleAccount | null>(null);
const draggingOverCategory = ref<string | null>(null);

const handleDragStart = (event: DragEvent, row: GoogleAccount) => {
  draggedAccount.value = row;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.id);
  }
};

const handleDragEnter = (category: string) => {
  draggingOverCategory.value = category;
};

const handleDragLeave = () => {
  draggingOverCategory.value = null;
};

const handleDrop = async (event: DragEvent, targetCategory: string) => {
  event.preventDefault();
  draggingOverCategory.value = null;

  const row = draggedAccount.value;
  if (!row) return;

  const actualCategory = targetCategory === 'all' ? '未分类' : targetCategory;

  // Determine if we should perform a batch drop or single drop
  const isBatch = selectedAccountIds.value.includes(row.id);
  const targetIds = isBatch ? selectedAccountIds.value : [row.id];

  try {
    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/batch-category', {
      ids: targetIds,
      category: actualCategory
    });
    if (res.data && res.data.success) {
      ElMessage.success(`成功移动 ${isBatch ? targetIds.length : 1} 个账号至分类「${actualCategory}」`);
      selectedAccountIds.value = [];
      await fetchAccounts();
    }
  } catch (e: any) {
    ElMessage.error(getApiErrorMessage(e, '移动账号分类失败'));
  } finally {
    isLoading.value = false;
    draggedAccount.value = null;
  }
};

// Compute selected account
const selectedAccount = computed(() => {
  return accounts.value.find(a => a.id === selectedAccountId.value) || null;
});

// Recommended IP sites list
const ipSites = [
  {
    name: 'Whoer.net',
    url: 'https://whoer.net',
    descKey: 'tools.googleWarming.whoerDesc',
    iconColor: 'text-emerald-500 bg-emerald-500/10'
  },
  {
    name: 'Scamalytics',
    url: 'https://scamalytics.com',
    descKey: 'tools.googleWarming.scamalyticsDesc',
    iconColor: 'text-amber-500 bg-amber-500/10'
  },
  {
    name: 'ip.ping0.cc',
    url: 'https://ip.ping0.cc',
    descKey: 'tools.googleWarming.ping0Desc',
    iconColor: 'text-violet-500 bg-violet-500/10'
  },
  {
    name: 'BrowserScan',
    url: 'https://www.browserscan.net',
    descKey: 'tools.googleWarming.browserscanDesc',
    iconColor: 'text-sky-500 bg-sky-500/10'
  },
  {
    name: 'Pixelscan',
    url: 'https://pixelscan.net',
    descKey: 'tools.googleWarming.pixelscanDesc',
    iconColor: 'text-rose-500 bg-rose-500/10'
  }
];

// Checklist states for current day
const dayChecklist = ref<{ [key: string]: boolean }>({
  action1: false,
  action2: false,
  action3: false,
  action4: false
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
  // Reset checklist
  dayChecklist.value = {
    action1: false,
    action2: false,
    action3: false,
    action4: false
  };
  if (window.innerWidth < 1024) {
    activeMobileView.value = 'detail';
  }
};

// Filtered accounts computed
const filteredAccounts = computed(() => {
  return accounts.value.filter(acc => {
    const query = searchQuery.value.trim().toLowerCase();
    const matchQuery = !query ||
      acc.email.toLowerCase().includes(query) ||
      (acc.note && acc.note.toLowerCase().includes(query)) ||
      (acc.country && acc.country.toLowerCase().includes(query));

    const matchStatus = statusFilter.value === 'all' || acc.status === statusFilter.value;
    return matchQuery && matchStatus;
  });
});

// Batch selection helpers
const isAllSelected = computed(() => {
  const ids = filteredAccounts.value.map(a => a.id);
  return ids.length > 0 && ids.every(id => selectedAccountIds.value.includes(id));
});

const toggleSelectAll = () => {
  const ids = filteredAccounts.value.map(a => a.id);
  if (isAllSelected.value) {
    selectedAccountIds.value = selectedAccountIds.value.filter(id => !ids.includes(id));
  } else {
    ids.forEach(id => {
      if (!selectedAccountIds.value.includes(id)) {
        selectedAccountIds.value.push(id);
      }
    });
  }
};

// Batch Action handlers
const handleBatchWarm = async () => {
  if (selectedAccountIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确定要对已选的 ${selectedAccountIds.value.length} 个账号进行一键打卡吗？`,
      '批量打卡提示',
      {
        confirmButtonText: '确定打卡',
        cancelButtonText: '取消',
        type: 'success',
        customClass: 'dark:bg-slate-900 border-none'
      }
    );

    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/batch-warm', {
      ids: selectedAccountIds.value
    });

    if (res.data && res.data.success) {
      ElMessage.success(`成功打卡 ${res.data.count} 个账号！`);
      selectedAccountIds.value = [];
      await fetchAccounts();
    }
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, '批量打卡失败'));
    }
  } finally {
    isLoading.value = false;
  }
};

const handleBatchDelete = async () => {
  if (selectedAccountIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确定要删除已选的 ${selectedAccountIds.value.length} 个账号吗？此操作将永久清除养号进度且不可逆！`,
      '批量删除警告',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'dark:bg-slate-900 border-none'
      }
    );

    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/batch-delete', {
      ids: selectedAccountIds.value
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
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, '批量删除失败'));
    }
  } finally {
    isLoading.value = false;
  }
};

const handleBatchStatus = async (status: 'warming' | 'completed' | 'paused') => {
  if (selectedAccountIds.value.length === 0) return;
  try {
    isLoading.value = true;
    const res = await api.post('/api/google-warming/accounts/batch-status', {
      ids: selectedAccountIds.value,
      status
    });

    if (res.data && res.data.success) {
      ElMessage.success(`成功更新 ${res.data.count} 个账号状态！`);
      selectedAccountIds.value = [];
      await fetchAccounts();
    }
  } catch (e: any) {
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
    handleBatchStatus('warming');
  } else if (cmd === 'status-paused') {
    handleBatchStatus('paused');
  } else if (cmd === 'status-completed') {
    handleBatchStatus('completed');
  }
};


// Client-side auto-delimiter parse
const handleStandardParse = () => {
  if (!importText.value.trim()) {
    ElMessage.warning(t('tools.email.import_warning_empty'));
    return;
  }

  const lines = importText.value.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
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

    const parts = line.split(bestDelimiter).map(p => p.trim());
    if (parts.length < 2) continue;

    const isSevenParts = parts.length >= 7;
    const parsedCategory = isSevenParts ? (parts[5] || '未分类') : '未分类';
    tempParsed.push({
      email: parts[0] || '',
      password: parts[1] || '',
      recoveryEmail: parts[2] || '',
      twoFASecret: parts[3] || '',
      country: parts[4] || '',
      category: (importDefaultCategory.value && importDefaultCategory.value !== '未分类')
        ? importDefaultCategory.value
        : parsedCategory,
      note: isSevenParts ? (parts[6] || '') : (parts[5] || ''),
      status: 'warming',
      currentDay: 1
    });
  }

  if (tempParsed.length === 0) {
    ElMessage.error('快速解析失败，请检查分隔符');
  } else {
    parsedAccounts.value = tempParsed;
    ElMessage.success(`成功解析出 ${tempParsed.length} 个账号 (使用分隔符: "${bestDelimiter === '\t' ? '\\t' : bestDelimiter}")`);
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
      translateCountry: autoTranslateCountry.value
    });
    if (res.data && res.data.accounts) {
      parsedAccounts.value = res.data.accounts.map((acc: any) => ({
        ...acc,
        category: (importDefaultCategory.value && importDefaultCategory.value !== '未分类')
          ? importDefaultCategory.value
          : (acc.category || '未分类'),
        status: acc.status || 'warming',
        currentDay: 1
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
      accounts: parsedAccounts.value
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
      // Find and update local account
      const idx = accounts.value.findIndex(a => a.id === account.id);
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
      const idx = accounts.value.findIndex(a => a.id === account.id);
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
const handleInlineCategory = async (row: GoogleAccount, cmd: string) => {
  if (cmd === 'custom-new-category') {
    ElMessageBox.prompt('请输入新的分类名称', '修改分类', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入新分类名称...',
      customClass: 'dark:bg-slate-900 border-none'
    }).then(async ({ value }) => {
      const newCat = value ? value.trim() : '未分类';
      await updateAccountCategory(row, newCat);
    }).catch(() => {});
  } else {
    await updateAccountCategory(row, cmd);
  }
};

const updateAccountCategory = async (row: GoogleAccount, category: string) => {
  try {
    isLoading.value = true;
    const res = await api.put(`/api/google-warming/accounts/${row.id}`, {
      ...row,
      category
    });
    if (res.data) {
      const idx = accounts.value.findIndex(a => a.id === row.id);
      if (idx > -1) {
        accounts.value[idx] = res.data;
      }
      ElMessage.success(`已将该账号分类修改为「${category}」`);
    }
  } catch (e: any) {
    ElMessage.error(getApiErrorMessage(e, '修改分类失败'));
  } finally {
    isLoading.value = false;
  }
};

// Category Management (Rename & Delete)
const handleRenameCategory = async (oldCat: string) => {
  ElMessageBox.prompt(`请输入「${oldCat}」的新分类名称`, '重命名分类', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPlaceholder: '新分类名称...',
    inputValue: oldCat,
    customClass: 'dark:bg-slate-900 border-none'
  }).then(async ({ value }) => {
    const newCat = value ? value.trim() : '未分类';
    if (newCat === oldCat) return;
    try {
      isLoading.value = true;
      const res = await api.post('/api/google-warming/accounts/category/rename', {
        oldCategory: oldCat,
        newCategory: newCat
      });
      if (res.data && res.data.success) {
        ElMessage.success(`重命名分类成功！已更新 ${res.data.count} 个账号。`);
        if (selectedCategory.value === oldCat) {
          selectedCategory.value = newCat;
        }
        await fetchAccounts();
      }
    } catch (e: any) {
      ElMessage.error(getApiErrorMessage(e, '重命名分类失败'));
    } finally {
      isLoading.value = false;
    }
  }).catch(() => {});
};

const handleDeleteCategory = async (cat: string) => {
  ElMessageBox.confirm(
    `确定要删除分类「${cat}」吗？该分类下的所有账号将变回「未分类」。`,
    '删除分类',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'dark:bg-slate-900 border-none'
    }
  ).then(async () => {
    try {
      isLoading.value = true;
      const res = await api.post('/api/google-warming/accounts/category/delete', {
        category: cat
      });
      if (res.data && res.data.success) {
        ElMessage.success(`删除分类成功！已重置 ${res.data.count} 个账号至「未分类」。`);
        if (selectedCategory.value === cat) {
          selectedCategory.value = 'all';
        }
        await fetchAccounts();
      }
    } catch (e: any) {
      ElMessage.error(getApiErrorMessage(e, '删除分类失败'));
    } finally {
      isLoading.value = false;
    }
  }).catch(() => {});
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
      customClass: 'dark:bg-slate-900 border-none'
    }
  ).then(async () => {
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
  }).catch(() => {});
};

// Get step details for dynamic UI rendering
const getStepDetails = (dayNum: number) => {
  switch (dayNum) {
    case 1:
      return {
        title: t('tools.googleWarming.questDays.day1'),
        desc: t('tools.googleWarming.questDays.day1Desc'),
        actions: [
          { key: 'action1', text: '在新设备或独立指纹浏览器中完成首次安全登录' },
          { key: 'action2', text: '进入 Gmail 收件箱，浏览点击 2-3 封未读邮件' }
        ]
      };
    case 2:
      return {
        title: t('tools.googleWarming.questDays.day2'),
        desc: t('tools.googleWarming.questDays.day2Desc'),
        actions: [
          { key: 'action1', text: '进入谷歌安全中心，查看并登出所有不认识的陌生设备' },
          { key: 'action2', text: '打开 Gmail 浏览收件箱垃圾邮件和收信' },
          { key: 'action3', text: '打开 YouTube 浏览或随机播放视频 10-15 分钟' }
        ]
      };
    case 3:
      return {
        title: t('tools.googleWarming.questDays.day3'),
        desc: t('tools.googleWarming.questDays.day3Desc'),
        actions: [
          { key: 'action1', text: '设置并绑定辅助邮箱（恢复邮箱）以增强信誉' },
          { key: 'action2', text: '正常收发几封 Gmail 邮件' },
          { key: 'action3', text: '在 YouTube 观看视频并随机点击喜欢或订阅' },
          { key: 'action4', text: '打开 Gemini AI，随便发送 2-3 句话进行 AI 对话互动' }
        ]
      };
    case 4:
      return {
        title: t('tools.googleWarming.questDays.day4'),
        desc: t('tools.googleWarming.questDays.day4Desc'),
        actions: [
          { key: 'action1', text: '管理两步验证 (2FA) 或其他安全辅助设置' },
          { key: 'action2', text: '阅读 Gmail 邮件，清理垃圾邮件分类' },
          { key: 'action3', text: '打开 YouTube 观看视频，搜索感兴趣的内容' },
          { key: 'action4', text: '用 Gemini AI 随机生成一段关于学习路线的文本' }
        ]
      };
    case 5:
      return {
        title: t('tools.googleWarming.questDays.day5'),
        desc: t('tools.googleWarming.questDays.day5Desc'),
        actions: [
          { key: 'action1', text: '绑定密保手机号（建议长期养号使用以防异常风控）' },
          { key: 'action2', text: '正常浏览接收邮件，向外部发一封邮件' },
          { key: 'action3', text: '观看 YouTube 视频，建立正常的视频推流推荐' },
          { key: 'action4', text: '向 Gemini AI 提问一些日常开发或 3D 建模命令' }
        ]
      };
    case 7:
      return {
        title: t('tools.googleWarming.questDays.day7'),
        desc: t('tools.googleWarming.questDays.day7Desc'),
        actions: [
          { key: 'action1', text: '安全更改谷歌账户的登录密码' },
          { key: 'action2', text: '浏览收发 Gmail，整理垃圾邮件' },
          { key: 'action3', text: 'YouTube 观看并对优质内容进行评论/互动' },
          { key: 'action4', text: '使用 Gemini AI 翻译一小段英文文章' }
        ]
      };
    default:
      return {
        title: t('tools.googleWarming.questDays.day8_15'),
        desc: t('tools.googleWarming.questDays.day8_15Desc'),
        actions: [
          { key: 'action1', text: '进入 Gmail，阅读最新收件，回复 1 封常规邮件' },
          { key: 'action2', text: '打开 YouTube 累计观看至少 10-15 分钟视频' },
          { key: 'action3', text: '访问 Gemini AI 体验聊天互动' }
        ]
      };
  }
};

// Check if all actions for selected account's current day are checked
const isAllActionsChecked = computed(() => {
  const account = selectedAccount.value;
  if (!account) return false;
  
  const step = getStepDetails(account.currentDay);
  return step.actions.every(act => dayChecklist.value[act.key]);
});

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
      ['sign']
    );

    const signature = await window.crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      counterBuffer
    );

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
let totpTimer: any = null;

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
  { immediate: true }
);

onUnmounted(() => {
  stopTotpTimer();
});

const copyText = (text: string, message: string = '已复制到剪贴板') => {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(message);
  }).catch(() => {
    ElMessage.error('复制失败');
  });
};
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
    accounts: accounts.value.map(acc => ({
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
      createdAt: acc.createdAt
    }))
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

  let parsed: any;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    ElMessage.error('文件格式错误，请选择有效的 JSON 备份文件');
    return;
  }

  // Support both {accounts:[]} wrapper and plain array
  const list: any[] = Array.isArray(parsed) ? parsed : (parsed.accounts ?? []);
  if (!list.length) {
    ElMessage.warning('备份文件中没有账号数据');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `即将导入 ${list.length} 个账号，已存在同邮箱的账号将被跳过，是否继续？`,
      '确认导入',
      { confirmButtonText: '确认导入', cancelButtonText: '取消', type: 'info' }
    );
  } catch {
    return;
  }

  let successCount = 0;
  let skipCount = 0;
  const existingEmails = new Set(accounts.value.map(a => a.email.toLowerCase()));

  for (const acc of list) {
    if (!acc.email) { skipCount++; continue; }
    if (existingEmails.has(acc.email.toLowerCase())) { skipCount++; continue; }
    try {
      await api.post('/api/google-warming/accounts', {
        email: acc.email,
        password: acc.password || undefined,
        recoveryEmail: acc.recoveryEmail || undefined,
        twoFASecret: acc.twoFASecret || undefined,
        country: acc.country || undefined,
        note: acc.note || undefined,
        status: acc.status || 'warming',
        currentDay: acc.currentDay ?? 0
      });
      existingEmails.add(acc.email.toLowerCase());
      successCount++;
    } catch {
      skipCount++;
    }
  }

  await fetchAccounts();
  ElMessage.success(`导入完成：成功 ${successCount} 个${skipCount > 0 ? `，跳过 ${skipCount} 个（重复或错误）` : ''}`);
}
</script>

<template>
  <div class="gw-page">
    <div class="w-full space-y-3">
      
      <!-- Top header (compact) -->
      <div class="gw-header !py-2 !mb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-200 dark:border-slate-800/80">
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
          <!-- Integrated Recommended IP Checker Sites -->
          <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] mt-0.5 text-slate-500">
            <span class="flex items-center gap-0.5 shrink-0">
              <Shield class="w-3 h-3 text-violet-500 dark:text-violet-400" />
              <span>IP 检测:</span>
            </span>
            <template v-for="(site, idx) in ipSites" :key="site.name">
              <a
                :href="site.url"
                target="_blank"
                :title="t(site.descKey)"
                class="hover:text-violet-500 dark:hover:text-violet-400 transition-all font-medium text-slate-650 dark:text-slate-300 flex items-center gap-0.5"
                style="text-decoration: none"
              >
                <span>{{ site.name }}</span>
                <ExternalLink class="w-2.5 h-2.5 opacity-60" />
              </a>
              <span v-if="idx < ipSites.length - 1" class="text-slate-300 dark:text-slate-700">•</span>
            </template>
          </div>
        </div>
        
        <div class="flex items-center justify-between sm:justify-end gap-1.5 w-full md:w-auto shrink-0 flex-wrap">
          <!-- Dev Test Mode toggle -->
          <label class="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 text-[10px] font-semibold text-slate-600 dark:text-slate-350 cursor-pointer select-none">
            <input type="checkbox" v-model="testMode" class="w-3 h-3 rounded accent-violet-500 cursor-pointer" />
            <span>测试打卡</span>
          </label>

          <div class="flex items-center gap-1.5">
            <!-- Export -->
            <button
              @click="handleExportAccounts"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700/50 text-[11px] font-semibold hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
              title="导出全部账号为 JSON（包含密码、辅助邮箱、地区、状态等完整信息）"
            >
              <Download class="w-3 h-3" />
              <span>导出</span>
            </button>

            <!-- Import -->
            <button
              @click="triggerImportFile"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700/50 text-[11px] font-semibold hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 transition-all text-slate-600 dark:text-slate-300 cursor-pointer"
              title="从 JSON 备份文件导入，完整还原所有字段"
            >
              <Upload class="w-3 h-3" />
              <span>导入</span>
            </button>
            <input ref="fileInputRef" type="file" accept=".json" class="hidden" @change="handleImportFile" />

            <!-- Add account -->
            <button
              @click="openImportDialog"
              class="bg-violet-600 hover:bg-violet-500 border-none font-semibold px-2.5 py-1.5 rounded transition-all flex items-center gap-0.5 cursor-pointer text-[11px] text-white"
            >
              <Plus class="w-3 h-3" />
              <span>{{ t('tools.googleWarming.addAccount') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Switcher -->
      <div class="flex border-b border-slate-200 dark:border-slate-800/80 mb-2 gap-1">
        <button
          @click="activeTab = 'warming'"
          :class="[
            'px-3 py-1.5 border-b-2 font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5',
            activeTab === 'warming' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          ]"
        >
          <Calendar class="w-3.5 h-3.5" />
          <span>{{ t('tools.googleWarming.tabWarmingWorkspace') }}</span>
        </button>
        <button
          @click="activeTab = 'manage'"
          :class="[
            'px-3 py-1.5 border-b-2 font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5',
            activeTab === 'manage' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          ]"
        >
          <Shield class="w-3.5 h-3.5" />
          <span>{{ t('tools.googleWarming.tabAccountManage') }}</span>
        </button>
      </div>

      <!-- Main Section: Left list, Right tracker -->
      <div v-if="activeTab === 'warming'" class="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        
        <!-- Left: Account List -->
        <div
          :class="[
            'lg:col-span-4 xl:col-span-3 gw-card !p-3 flex flex-col gap-2 max-h-[800px] w-full',
            activeMobileView === 'list' ? 'flex' : 'hidden lg:flex'
          ]"
        >
          <!-- Header -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold" style="color: var(--text-primary)">{{ t('tools.googleWarming.accountsList') }} <span class="text-slate-500 font-normal">({{ accounts.length }})</span></span>
            <button @click="fetchAccounts" class="gw-icon-btn cursor-pointer !p-1">
              <RefreshCw class="w-3.5 h-3.5" :class="{'animate-spin': isLoading}" />
            </button>
          </div>

          <!-- Search -->
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('tools.googleWarming.searchPlaceholder')"
              class="gw-input !py-1.5 !text-xs !pl-8"
            />
            <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>


          <!-- Status Filter Tabs -->
          <div class="flex gap-0.5 p-0.5 rounded-lg text-[11px]" style="background: var(--bg-app)">
            <button
              v-for="status in ['all', 'warming', 'paused', 'completed']"
              :key="status"
              @click="statusFilter = status as any"
              :class="[
                'flex-1 py-1 rounded-md font-medium transition-all text-center cursor-pointer',
                statusFilter === status
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              ]"
            >
              {{ status === 'all' ? t('tools.googleWarming.statusAll') : getStatusLabel(status) }}
            </button>
          </div>

          <!-- Batch toolbar -->
          <div v-if="filteredAccounts.length > 0" class="flex items-center justify-between text-[11px]">
            <label class="flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400 select-none">
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
                class="w-3 h-3 rounded accent-violet-500"
              />
              <span>全选 ({{ selectedAccountIds.length }})</span>
            </label>
            <el-dropdown trigger="click" @command="handleBatchCommand" :disabled="selectedAccountIds.length === 0">
              <button
                :disabled="selectedAccountIds.length === 0"
                :class="[
                  'px-2 py-1 rounded border font-medium transition-all flex items-center gap-1 text-[10px] cursor-pointer',
                  selectedAccountIds.length > 0
                    ? 'bg-violet-600/10 border-violet-500/30 text-violet-700 dark:text-violet-400 hover:bg-violet-600/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed'
                ]"
              >
                {{ t('tools.googleWarming.batchActions') }}
              </button>
              <template #dropdown>
                <el-dropdown-menu class="dark:bg-slate-900 border-none">
                  <el-dropdown-item command="warm" class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">一键打卡</el-dropdown-item>
                  <el-dropdown-item command="status-warming" class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 养号中</el-dropdown-item>
                  <el-dropdown-item command="status-paused" class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 已暂停</el-dropdown-item>
                  <el-dropdown-item command="status-completed" class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 已毕业</el-dropdown-item>
                  <el-dropdown-item command="delete" divided class="text-red-650 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800">批量删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <!-- Empty state -->
          <div v-if="filteredAccounts.length === 0" class="py-6 text-center flex flex-col items-center justify-center gap-2">
            <FileText class="w-8 h-8 gw-icon-muted" />
            <p class="gw-muted-text text-xs max-w-[180px]">
              {{ searchQuery || statusFilter !== 'all' ? '未找到符合条件的账号' : t('tools.googleWarming.noAccounts') }}
            </p>
          </div>

          <!-- Account list -->
          <div v-else class="flex flex-col gap-1.5 overflow-y-auto pr-1">

            <div
              v-for="acc in filteredAccounts"
              :key="acc.id"
              @click="selectAccount(acc.id)"
              :class="[
                'gw-account-item group/item',
                selectedAccountId === acc.id ? 'gw-account-item--active' : ''
              ]"
            >
              <!-- Row 1: checkbox + email + status -->
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :value="acc.id"
                  v-model="selectedAccountIds"
                  @click.stop
                  class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer shrink-0"
                />
                <span class="text-[12px] font-semibold flex-1 truncate" style="color: var(--text-primary)" :title="acc.email">{{ acc.email }}</span>
                <span :class="['text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0', getStatusBadgeClass(acc.status)]">
                  {{ getStatusLabel(acc.status) }}
                </span>
              </div>

              <!-- Row 2: note + day + 2FA pill + progress bar -->
              <div class="flex items-center gap-2 pl-5">
                <!-- note tag -->
                <span v-if="acc.note" class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style="background: var(--bg-app); color: var(--text-muted); border: 1px solid var(--border-base)">{{ acc.note }}</span>
                <!-- day label -->
                <span class="text-[10px] shrink-0" style="color: var(--text-muted)">第 {{ acc.currentDay }} 天</span>
                <!-- spacer -->
                <div class="flex-1"></div>
                <!-- 2FA pill -->
                <span v-if="acc.twoFASecret && listTotpCodes[acc.id]" class="flex items-center gap-1 shrink-0">
                  <span class="font-mono text-[11px] text-violet-600 dark:text-violet-400 font-bold tracking-widest">{{ listTotpCodes[acc.id].code.slice(0, 3) }} {{ listTotpCodes[acc.id].code.slice(3) }}</span>
                  <span class="text-[9px] font-mono" style="color: var(--text-muted)">{{ listTotpCodes[acc.id].timeLeft }}s</span>
                  <button
                    @click.stop="copyText(listTotpCodes[acc.id].code, '验证码已复制')"
                    class="opacity-0 group-hover/item:opacity-100 hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-all text-slate-500 dark:text-slate-400 cursor-pointer"
                    title="复制验证码"
                  >
                    <Copy class="w-2.5 h-2.5" />
                  </button>
                </span>
              </div>

              <!-- Row 3: progress bar -->
              <div class="flex items-center gap-2 pl-5">
                <div class="flex-1 h-1 rounded-full overflow-hidden" style="background: var(--border-base)">
                  <div
                    class="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    :style="{ width: `${(acc.currentDay / 15) * 100}%` }"
                  ></div>
                </div>
                <span class="text-[9px] font-mono shrink-0 w-6 text-right" style="color: var(--text-muted)">{{ Math.round((acc.currentDay / 15) * 100) }}%</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Right: Interactive Warming Tracker -->
        <div
          :class="[
            'lg:col-span-8 xl:col-span-9 space-y-4 lg:space-y-6 w-full',
            activeMobileView === 'detail' ? 'block' : 'hidden lg:block'
          ]"
        >
          <div v-if="!selectedAccount" class="gw-card gw-empty-state !p-4 lg:!p-6">
            <!-- Mobile back button in empty state -->
            <button
              @click="activeMobileView = 'list'"
              class="lg:hidden flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-400 py-1.5 px-3 rounded-lg border border-violet-500/30 dark:border-violet-500/20 bg-violet-500/10 dark:bg-violet-500/5 mb-4 cursor-pointer"
            >
              <ArrowLeft class="w-3.5 h-3.5" />
              返回账号列表
            </button>
            <Info class="w-10 h-10 gw-icon-muted" />
            <p class="gw-muted-text text-xs lg:text-sm">
              请先在左侧选择一个谷歌账号，以查看并执行每日养号打卡任务。
            </p>
          </div>

          <div v-else class="gw-card space-y-4 lg:space-y-6 !p-3 lg:!p-6">
            <!-- Mobile back button -->
            <div class="lg:hidden flex items-center justify-between mb-2">
              <button
                @click="activeMobileView = 'list'"
                class="flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 py-1 px-2.5 rounded-lg border border-violet-500/30 dark:border-violet-500/20 bg-violet-500/10 dark:bg-violet-500/5 transition-all cursor-pointer"
              >
                <ArrowLeft class="w-3.5 h-3.5" />
                返回账号列表
              </button>
            </div>
            
            <!-- Selected Account Details & 2FA Display compact row -->
            <div class="gw-account-detail-card flex items-center gap-4 py-2.5 px-3">
              <!-- Left: email + meta -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-bold truncate" style="color: var(--text-primary)" :title="selectedAccount.email">
                    {{ selectedAccount.email }}
                  </span>
                  <span :class="['text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0', getStatusBadgeClass(selectedAccount.status)]">
                    {{ getStatusLabel(selectedAccount.status) }}
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]" style="color: var(--text-secondary)">
                  <span v-if="selectedAccount.password" class="flex items-center gap-1">
                    密码: <code class="gw-code">{{ selectedAccount.password }}</code>
                    <button @click="copyText(selectedAccount.password, '密码已复制')" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-colors cursor-pointer" title="复制密码"><Copy class="w-3 h-3" /></button>
                  </span>
                  <span v-if="selectedAccount.recoveryEmail" class="flex items-center gap-1">
                    辅助邮箱: <code class="gw-code">{{ selectedAccount.recoveryEmail }}</code>
                    <button @click="copyText(selectedAccount.recoveryEmail, '辅助邮箱已复制')" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-colors cursor-pointer" title="复制辅助邮箱"><Copy class="w-3 h-3" /></button>
                  </span>
                  <span v-if="selectedAccount.country">地区: {{ selectedAccount.country }}</span>
                  <span v-if="selectedAccount.twoFASecret" class="flex items-center gap-1">
                    2FA密钥: <code class="gw-code truncate max-w-[100px]" :title="selectedAccount.twoFASecret">{{ selectedAccount.twoFASecret }}</code>
                    <button @click="copyText(selectedAccount.twoFASecret, '2FA密钥已复制')" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-colors cursor-pointer" title="复制2FA密钥"><Copy class="w-3 h-3" /></button>
                  </span>
                </div>
              </div>

              <!-- Middle: 2FA live code (if present) -->
              <div v-if="selectedAccount.twoFASecret && currentTotpCode" class="flex items-center gap-2.5 px-3 py-1.5 rounded-xl shrink-0" style="background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.15)">
                <Key class="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                <div class="flex items-baseline gap-1.5">
                  <span class="text-base font-mono font-bold tracking-widest text-violet-700 dark:text-violet-400">{{ currentTotpCode.slice(0, 3) }} {{ currentTotpCode.slice(3) }}</span>
                  <button @click="copyText(currentTotpCode, '验证码已复制')" class="p-0.5 text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 transition-colors cursor-pointer" title="复制验证码"><Copy class="w-3 h-3" /></button>
                </div>
                <div class="flex items-center gap-1.5 border-l border-violet-500/20 pl-2.5">
                  <span class="text-[10px] font-mono text-violet-600 dark:text-violet-400 font-semibold">{{ totpTimeLeft }}s</span>
                  <div class="w-5 h-5 rounded-full relative" style="border: 1.5px solid rgba(139,92,246,0.3)">
                    <svg class="w-full h-full transform -rotate-90 absolute inset-0">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" class="text-violet-500" stroke-width="2" fill="transparent"
                        :stroke-dasharray="2 * Math.PI * 8"
                        :stroke-dashoffset="2 * Math.PI * 8 * (1 - totpTimeLeft / 30)"
                        stroke-linecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- Right: action buttons -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button @click="startEditAccount(selectedAccount)" class="gw-icon-action-btn cursor-pointer" title="编辑">
                  <Edit class="w-3.5 h-3.5" />
                </button>
                <button @click="deleteAccount(selectedAccount)" class="gw-icon-danger-btn cursor-pointer" title="删除">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>




            <!-- 15-Day Golden Quest Timeline header -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <h3 class="gw-section-title flex items-center gap-2">
                  <Calendar class="w-5 h-5 text-indigo-400" />
                  {{ t('tools.googleWarming.warmingTimeline') }}
                </h3>
                <span class="gw-badge-indigo">
                  {{ t('tools.googleWarming.currentDayStatus', { day: selectedAccount.currentDay, status: getStatusLabel(selectedAccount.status) }) }}
                </span>
              </div>

              <!-- Horizontal scroll day circles -->
              <div class="flex gap-1.5 overflow-x-auto pb-2 pr-1 scrollbar-thin">
                <div
                  v-for="day in 15"
                  :key="day"
                  :class="[
                    'gw-day-circle',
                    day < selectedAccount.currentDay
                      ? 'gw-day-done'
                      : day === selectedAccount.currentDay
                        ? 'gw-day-current animate-pulse'
                        : 'gw-day-future'
                  ]"
                >
                  <span class="text-[9px] uppercase tracking-tighter opacity-60">D</span>
                  <span>{{ day }}</span>
                </div>
              </div>
            </div>

            <!-- Daily Quest Checklist -->
            <div class="gw-checklist-card">
              <div class="gw-checklist-header">
                <h4 class="gw-checklist-title">
                  {{ getStepDetails(selectedAccount.currentDay).title }}
                </h4>
                <p class="gw-muted-text text-xs mt-1">
                  {{ getStepDetails(selectedAccount.currentDay).desc }}
                </p>
              </div>

              <!-- Checkbox items -->
              <div class="flex flex-col gap-3">
                <div
                  v-for="act in getStepDetails(selectedAccount.currentDay).actions"
                  :key="act.key"
                  :class="[
                    'gw-check-item',
                    dayChecklist[act.key] ? 'gw-check-item--done' : ''
                  ]"
                >
                  <input
                    type="checkbox"
                    v-model="dayChecklist[act.key]"
                    :id="act.key"
                    :disabled="isWarmedToday"
                    class="w-4 h-4 mt-0.5 accent-emerald-500 cursor-pointer"
                  />
                  <label :for="act.key" class="gw-check-label">
                    {{ act.text }}
                  </label>
                </div>
              </div>

              <!-- Action button -->
              <div class="gw-action-footer">
                <div class="gw-muted-text text-xs">
                  <span v-if="selectedAccount.lastWarmedAt">
                    上次打卡: {{ new Date(selectedAccount.lastWarmedAt).toLocaleString() }}
                  </span>
                  <span v-else>首次养号，快开始任务吧！</span>
                </div>

                <div>
                  <button
                    v-if="isWarmedToday"
                    disabled
                    class="gw-btn-disabled cursor-not-allowed"
                  >
                    <CheckCircle class="w-4 h-4" />
                    {{ t('tools.googleWarming.alreadyWarmed') }}
                  </button>

                  <button
                    v-else
                    @click="handleWarmStep"
                    :disabled="!isAllActionsChecked"
                    :class="[
                      'flex items-center gap-2 font-semibold text-sm px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-md',
                      isAllActionsChecked
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
                        : 'gw-btn-disabled opacity-50 cursor-not-allowed'
                    ]"
                  >
                    <Check class="w-4 h-4" />
                    {{ t('tools.googleWarming.warmActionBtn', { day: selectedAccount.currentDay }) }}
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>

      <!-- Account Management View -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 items-start">
        <!-- Sidebar: Categories -->
        <div class="lg:col-span-3 gw-card !p-2 sm:!p-3 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-stretch justify-between lg:justify-start gap-2.5 max-h-[800px] w-full">
          <div class="flex flex-row lg:flex-row items-center lg:justify-between justify-start pb-0 lg:pb-2 border-b-0 lg:border-b border-slate-200 dark:border-slate-800 shrink-0 gap-1.5 lg:w-full">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Shield class="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span class="hidden sm:inline lg:inline">{{ t('tools.googleWarming.category') }}</span>
            </span>
            <button 
              @click="isCategoryManagerVisible = true" 
              class="text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors flex items-center gap-0.5 cursor-pointer bg-transparent border-none p-1"
              title="管理分类"
            >
              <Settings class="w-3 h-3" />
              <span>管理</span>
            </button>
          </div>

          <div class="flex lg:flex-col flex-row overflow-x-auto lg:overflow-x-visible no-scrollbar lg:overflow-y-auto gap-1.5 flex-1 w-full pb-0.5 lg:pb-0 select-none">
            <button
              v-for="cat in categoriesList"
              :key="cat"
              @click="selectedCategory = cat"
              @dragover.prevent
              @dragenter="handleDragEnter(cat)"
              @dragleave="handleDragLeave"
              @drop="handleDrop($event, cat)"
              :class="[
                'flex items-center justify-between px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer border w-auto lg:w-full shrink-0 lg:shrink',
                selectedCategory === cat
                  ? 'bg-violet-600/10 dark:bg-violet-600/15 border-violet-500/30 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 font-semibold shadow-sm'
                  : (draggingOverCategory === cat
                     ? 'bg-indigo-600/15 border-indigo-500 text-indigo-600 dark:text-indigo-300 scale-[1.02] shadow-sm font-semibold'
                     : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/40')
              ]"
            >
              <span class="truncate max-w-[100px] lg:max-w-none">{{ cat === 'all' ? t('tools.googleWarming.allCategories') : (cat === '未分类' ? t('tools.googleWarming.uncategorized') : cat) }}</span>
              <span 
                :class="[
                  'px-1.5 py-0.5 rounded text-[10px] transition-all font-mono ml-1.5 lg:ml-0',
                  selectedCategory === cat 
                    ? 'bg-violet-500/20 dark:bg-violet-500/30 text-violet-850 dark:text-violet-200' 
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                ]"
              >
                {{ getCategoryCount(cat) }}
              </span>
            </button>
          </div>
        </div>

        <!-- Main Account Table -->
        <div class="lg:col-span-9 gw-card !p-3 sm:!p-4 flex flex-col gap-3 min-h-[500px]">
          <!-- Actions & Search -->
          <div class="flex flex-wrap gap-2 items-center justify-between min-h-[32px]">
            <!-- Batch Actions (visible only when selectedAccountIds.length > 0) -->
            <transition name="el-zoom-in-top">
              <div v-if="selectedAccountIds.length > 0" class="flex flex-wrap gap-1.5 items-center">
                <span class="text-[11px] text-slate-500 dark:text-slate-400 mr-1">已选择 {{ selectedAccountIds.length }} 个:</span>
                
                <!-- Batch change status dropdown -->
                <el-dropdown trigger="click" @command="handleBatchStatus">
                  <button
                    class="gw-btn-secondary !py-1 !px-2 !text-[10.5px] flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>修改状态</span>
                    <ExternalLink class="w-3 h-3 opacity-60" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu class="dark:bg-slate-900 dark:border-slate-800">
                      <el-dropdown-item command="warming" class="text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 养号中</el-dropdown-item>
                      <el-dropdown-item command="paused" class="text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 已暂停</el-dropdown-item>
                      <el-dropdown-item command="completed" class="text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">设为 已毕业</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>

                <!-- Batch delete button -->
                <button
                  @click="handleBatchDelete"
                  class="gw-btn-secondary !py-1 !px-2 !text-[10.5px] !border-red-500/20 flex items-center gap-0.5 cursor-pointer hover:!bg-red-500/10 hover:!text-red-400"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>删除</span>
                </button>
              </div>
            </transition>

            <!-- Search (always visible) -->
            <div class="relative w-full sm:w-64" :class="{ 'sm:ml-auto': selectedAccountIds.length === 0 }">
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t('tools.googleWarming.searchPlaceholder')"
                class="gw-input !py-1 !text-xs !pl-8"
              />
              <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <!-- Table Wrapper -->
          <div class="overflow-x-auto border rounded-xl" style="border-color: var(--border-base); background: var(--bg-card)">
            <el-table
              v-loading="isLoading"
              :data="filteredAndCategorizedAccounts"
              @selection-change="handleSelectionChange"
              style="width: 100%;"
              class="custom-el-table !text-xs"
            >
              <el-table-column type="selection" width="45" align="center" />
              
              <!-- Email -->
              <el-table-column label="邮箱账号" min-width="210">
                <template #default="{ row }">
                  <div 
                    draggable="true" 
                    @dragstart="handleDragStart($event, row)"
                    class="flex items-center gap-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-500/5 p-1 rounded transition-all"
                    title="可拖拽该账号至左侧分类"
                  >
                    <GripVertical class="w-3.5 h-3.5 opacity-40 shrink-0 cursor-grab active:cursor-grabbing" style="color: var(--text-muted)" />
                    <span class="font-medium truncate max-w-[160px]" style="color: var(--text-primary)" :title="row.email">{{ row.email }}</span>
                    <button @click.stop="copyText(row.email)" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5" style="color: var(--text-muted)" title="复制邮箱">
                      <Copy class="w-3.5 h-3.5" />
                    </button>
                    <!-- 2FA indicator if present -->
                    <el-popover v-if="row.twoFASecret" trigger="click" width="220" placement="top" class="dark:bg-slate-900">
                      <template #reference>
                        <button @click.stop class="text-indigo-500 hover:text-indigo-400 p-0.5" title="点击获取2FA验证码">
                          <Key class="w-3.5 h-3.5" />
                        </button>
                      </template>
                      <div class="p-2 space-y-2 text-xs">
                        <p class="font-bold text-slate-700 dark:text-slate-200">2FA 实时动态密码</p>
                        <div class="flex items-center justify-between bg-slate-100 dark:bg-slate-950/50 p-2 rounded border border-slate-200 dark:border-slate-800">
                          <span class="font-mono text-base font-bold text-indigo-400">
                            {{ listTotpCodes[row.id]?.code || '------' }}
                          </span>
                          <span class="text-[10px] text-slate-500">
                            {{ listTotpCodes[row.id]?.timeLeft || 30 }}s
                          </span>
                        </div>
                      </div>
                    </el-popover>
                  </div>
                </template>
              </el-table-column>

              <!-- Password -->
              <el-table-column label="密码" width="100">
                <template #default="{ row }">
                  <div class="flex items-center gap-1 justify-between">
                    <span class="font-mono truncate max-w-[70px]" style="color: var(--text-muted)">******</span>
                    <button @click="copyText(row.password)" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5" style="color: var(--text-muted)" title="复制密码">
                      <Copy class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </template>
              </el-table-column>

              <!-- Recovery Email -->
              <el-table-column label="辅助邮箱" width="160">
                <template #default="{ row }">
                  <div v-if="row.recoveryEmail" class="flex items-center gap-1 justify-between">
                    <span class="truncate max-w-[120px]" style="color: var(--text-secondary)" :title="row.recoveryEmail">{{ row.recoveryEmail }}</span>
                    <button @click="copyText(row.recoveryEmail)" class="hover:text-violet-600 dark:hover:text-violet-400 p-0.5" style="color: var(--text-muted)" title="复制辅助邮箱">
                      <Copy class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span v-else style="color: var(--text-muted)">-</span>
                </template>
              </el-table-column>

              <!-- Region/Country -->
              <el-table-column label="地区" width="110" align="center">
                <template #default="{ row }">
                  <span style="color: var(--text-primary)">{{ row.country || '-' }}</span>
                </template>
              </el-table-column>

              <!-- Status -->
              <el-table-column label="状态" width="120" align="center">
                <template #default="{ row }">
                  <span
                    v-if="row.status === 'warming'"
                    class="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/10 text-violet-500 border border-violet-500/20"
                  >
                    {{ t('tools.googleWarming.statusWarming') }} (D{{ row.currentDay }})
                  </span>
                  <span
                    v-else-if="row.status === 'completed'"
                    class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  >
                    {{ t('tools.googleWarming.statusCompleted') }}
                  </span>
                  <span
                    v-else
                    class="px-1.5 py-0.5 rounded text-[10px] bg-slate-500/10 text-slate-500 border border-slate-500/20"
                  >
                    {{ t('tools.googleWarming.statusPaused') }}
                  </span>
                </template>
              </el-table-column>

              <!-- Category -->
              <el-table-column label="分类" width="100">
                <template #default="{ row }">
                  <el-dropdown trigger="click" @command="(cmd) => handleInlineCategory(row, cmd)">
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-medium inline-block max-w-[90px] truncate border cursor-pointer hover:opacity-80 transition-opacity"
                      :style="row.category && row.category !== '未分类' 
                        ? 'background: rgba(99, 102, 241, 0.1); color: #6366f1; border-color: rgba(99, 102, 241, 0.2);' 
                        : 'background: var(--bg-app); color: var(--text-muted); border-color: var(--border-base);'"
                      :title="row.category || '未分类'"
                    >
                      {{ row.category || '未分类' }}
                    </span>
                    <template #dropdown>
                      <el-dropdown-menu class="dark:bg-slate-900 dark:border-slate-800">
                        <el-dropdown-item 
                          v-for="cat in categoriesList.filter(c => c !== 'all')" 
                          :key="cat" 
                          :command="cat"
                          class="text-xs hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                          :disabled="row.category === cat || (!row.category && cat === '未分类')"
                        >
                          {{ cat === '未分类' ? t('tools.googleWarming.uncategorized') : cat }}
                        </el-dropdown-item>
                        <el-dropdown-item divided command="custom-new-category" class="text-xs hover:bg-slate-800 text-slate-700 dark:text-slate-200">
                          自定义新分类...
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </template>
              </el-table-column>

              <!-- Note -->
              <el-table-column label="备注" min-width="110">
                <template #default="{ row }">
                  <span class="truncate max-w-[150px] inline-block" style="color: var(--text-muted)" :title="row.note">{{ row.note || '-' }}</span>
                </template>
              </el-table-column>

              <!-- Actions -->
              <el-table-column label="操作" width="90" align="right">
                <template #default="{ row }">
                  <div class="flex items-center justify-end gap-1">
                    <button @click="startEditAccount(row)" class="hover:text-violet-600 dark:hover:text-violet-400 p-1 transition-colors cursor-pointer" style="color: var(--text-muted)">
                      <Edit class="w-3.5 h-3.5" />
                    </button>
                    <button @click="deleteAccount(row)" class="hover:text-red-600 dark:hover:text-red-400 p-1 transition-colors cursor-pointer" style="color: var(--text-muted)">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>

      <!-- Bulk Import dialog -->
      <el-dialog
        v-model="isImporting"
        :title="t('tools.googleWarming.bulkImport')"
        width="90%"
        style="max-width: 800px"
        align-center
        class="gw-dialog"
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

          <!-- Import settings for Category and AI Translation -->
          <div class="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
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
                  v-for="cat in categoriesList.filter(c => c !== 'all')"
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
              <button
                @click="handleStandardParse"
                class="gw-btn-secondary text-xs cursor-pointer"
              >
                {{ t('tools.googleWarming.standardParseBtn') }}
              </button>
              <button
                @click="handleAiParse"
                :disabled="isAiParsing"
                class="flex items-center gap-1.5 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 dark:from-violet-600/30 dark:to-indigo-600/30 hover:from-violet-600/20 hover:to-indigo-600/20 dark:hover:from-violet-600/50 dark:hover:to-indigo-600/50 text-violet-700 dark:text-violet-400 text-xs px-3.5 py-2 rounded-lg border border-violet-500/30 dark:border-violet-500/20 transition-all cursor-pointer"
              >
                <Sparkles class="w-3.5 h-3.5" :class="{'animate-pulse': isAiParsing}" />
                {{ t('tools.googleWarming.aiParseBtn') }}
              </button>
            </div>

            <span v-if="isAiParsing" class="gw-muted-text text-xs flex items-center gap-1.5 animate-pulse">
              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
              AI 正在努力识别和解析格式，请稍候...
            </span>
          </div>

          <!-- Preview Table -->
          <div v-if="parsedAccounts.length > 0" class="space-y-3 pt-3 gw-border-top">
            <h4 class="gw-label-bold flex items-center justify-between">
              <span>解析预览 ({{ parsedAccounts.length }} 个账号)</span>
              <span class="gw-muted-text text-xs font-normal">双击或直接修改单元格可以校正错误数据</span>
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
                    <td class="p-2"><input v-model="acc.recoveryEmail" class="gw-table-input" /></td>
                    <td class="p-2"><input v-model="acc.twoFASecret" class="gw-table-input" /></td>
                    <td class="p-2"><input v-model="acc.country" class="gw-table-input" /></td>
                    <td class="p-2"><input v-model="acc.category" class="gw-table-input" placeholder="未分类" /></td>
                    <td class="p-2">
                      <select v-model="acc.status" class="gw-table-input cursor-pointer" style="background: var(--bg-app); border: 1px solid var(--border-base); border-radius: 4px; padding: 2px 4px; font-size: 11px;">
                        <option value="warming">养号中</option>
                        <option value="completed">已毕业</option>
                        <option value="paused">已暂停</option>
                      </select>
                    </td>
                    <td class="p-2"><input v-model="acc.note" class="gw-table-input" /></td>
                    <td class="p-2 text-right">
                      <button @click="parsedAccounts.splice(idx, 1)" class="text-red-400 hover:text-red-300 p-1 transition-colors cursor-pointer">
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex justify-end gap-3 pt-3">
              <button
                @click="isImporting = false; parsedAccounts = []"
                class="gw-btn-secondary text-xs cursor-pointer"
              >
                {{ t('tools.googleWarming.cancel_btn') }}
              </button>
              <button
                @click="submitImport"
                class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs px-5 py-2.5 rounded-lg transition-all font-semibold cursor-pointer"
              >
                {{ t('tools.googleWarming.importConfirm', { count: parsedAccounts.length }) }}
              </button>
            </div>
          </div>
        </div>
      </el-dialog>

      <!-- Edit details dialog -->
      <el-dialog
        v-model="isEditDialogVisible"
        :title="t('tools.googleWarming.editAccountTitle')"
        width="90%"
        style="max-width: 520px"
        align-center
        class="gw-dialog"
      >
        <div class="space-y-2.5">
          <!-- Email (full width) -->
          <div class="gw-field !gap-1">
            <label class="gw-field-label !text-[10px]">邮箱账号</label>
            <input v-model="editingAccount.email" type="text" class="gw-input !py-1.5 !text-xs" />
          </div>

          <!-- Password + Recovery Email (2 columns) -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">密码</label>
              <input v-model="editingAccount.password" type="text" class="gw-input !py-1.5 !text-xs" />
            </div>
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">辅助邮箱</label>
              <input v-model="editingAccount.recoveryEmail" type="text" class="gw-input !py-1.5 !text-xs" />
            </div>
          </div>

          <!-- 2FA Secret (full width) -->
          <div class="gw-field !gap-1">
            <label class="gw-field-label !text-[10px]">2FA 密钥</label>
            <input v-model="editingAccount.twoFASecret" type="text" class="gw-input !py-1.5 !text-xs font-mono" />
          </div>

          <!-- Country + CurrentDay + Status + Note + Category (grid) -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">国家地区</label>
              <input v-model="editingAccount.country" type="text" class="gw-input !py-1.5 !text-xs" />
            </div>
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">当前天数</label>
              <input v-model.number="editingAccount.currentDay" type="number" min="1" max="15" class="gw-input !py-1.5 !text-xs" />
            </div>
            <div class="gw-field !gap-1">
              <label class="gw-field-label !text-[10px]">分类</label>
              <input v-model="editingAccount.category" type="text" placeholder="例如: GCP, AdSense" class="gw-input !py-1.5 !text-xs" />
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
              @click="isEditDialogVisible = false"
              class="gw-btn-secondary text-xs cursor-pointer"
            >
              {{ t('tools.googleWarming.cancel_btn') }}
            </button>
            <button
              @click="saveAccountEdit"
              class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs px-4 py-1.5 rounded-lg transition-all font-semibold cursor-pointer"
            >
              保存修改
            </button>
          </div>
        </div>
      </el-dialog>

      <!-- Category Manager Dialog -->
      <el-dialog
        v-model="isCategoryManagerVisible"
        title="分类管理"
        width="90%"
        style="max-width: 460px"
        align-center
        class="gw-dialog"
      >
        <div class="space-y-3">
          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            在此处管理您的自定义分类。重命名会批量更新所有属于该分类的账号；删除分类会将该分类下的账号重置为“未分类”。
          </p>

          <!-- Add category section -->
          <div class="flex items-center gap-2 pb-1">
            <input 
              v-model="newCategoryName" 
              type="text" 
              placeholder="新增分类名称，例如: GCP" 
              class="gw-input flex-1 !py-1.5 !text-xs"
              @keyup.enter="handleAddCategory"
            />
            <button 
              @click="handleAddCategory"
              class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs px-3.5 py-1.5 rounded-lg transition-all font-semibold cursor-pointer flex items-center gap-1"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>新增</span>
            </button>
          </div>

          <div class="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto" style="border-color: var(--border-base)">
            <table class="w-full text-xs text-left">
              <thead class="text-xs border-b font-medium" style="background: var(--bg-app); border-color: var(--border-base); color: var(--text-secondary)">
                <tr>
                  <th class="p-2.5">分类名称</th>
                  <th class="p-2.5 text-center" width="80">账号数量</th>
                  <th class="p-2.5 text-right" width="120">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y" style="border-color: var(--border-base); background: var(--bg-card)">
                <tr 
                  v-for="cat in categoriesList.filter(c => c !== 'all' && c !== '未分类')" 
                  :key="cat"
                  class="hover:bg-slate-500/5"
                  style="border-color: var(--border-base)"
                >
                  <td class="p-2.5 font-medium truncate max-w-[180px]" style="color: var(--text-primary)" :title="cat">
                    {{ cat }}
                  </td>
                  <td class="p-2.5 text-center font-semibold font-mono" style="color: var(--text-muted)">
                    {{ getCategoryCount(cat) }}
                  </td>
                  <td class="p-2.5 text-right space-x-2.5">
                    <button 
                      @click="handleRenameCategory(cat)"
                      class="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer font-medium bg-transparent border-none p-0"
                    >
                      重命名
                    </button>
                    <button 
                      @click="handleDeleteCategory(cat)"
                      class="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 cursor-pointer font-medium bg-transparent border-none p-0"
                    >
                      删除
                    </button>
                  </td>
                </tr>
                <tr v-if="categoriesList.filter(c => c !== 'all' && c !== '未分类').length === 0">
                  <td colspan="3" class="p-6 text-center italic" style="color: var(--text-muted)">
                    暂无自定义分类，可以在账号列表的“分类”标签直接创建。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end pt-1">
            <button
              @click="isCategoryManagerVisible = false"
              class="gw-btn-secondary text-xs cursor-pointer"
            >
              关闭
            </button>
          </div>
        </template>
      </el-dialog>


    </div>
  </div>
</template>

<style scoped>
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
  .gw-header { flex-direction: row; align-items: center; justify-content: space-between; }
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
.gw-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 4px;
}
.gw-testmode-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.gw-btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(to right, #7c3aed, #4f46e5);
  color: #fff;
  font-weight: 500;
  font-size: 0.875rem;
  padding: 10px 16px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.25);
  transition: all 0.2s;
  cursor: pointer;
}
.gw-btn-primary:hover { opacity: 0.9; }

/* Cards */
.gw-card {
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 16px;
  padding: 24px;
}

/* IP site cards */
.gw-ip-site-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-elevated, var(--bg-card));
  border: 1px solid var(--border-base);
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.2s;
}
.gw-ip-site-card:hover {
  border-color: rgba(139, 92, 246, 0.4);
  background: var(--bg-hover);
}
.gw-ip-site-name {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: color 0.2s;
}
.gw-ip-site-card:hover .gw-ip-site-name { color: #8b5cf6; }

/* Text helpers */
.gw-muted-text { color: var(--text-muted); }
.gw-label-bold { font-weight: 700; font-size: 0.875rem; color: var(--text-primary); }
.gw-section-title { font-size: 1.125rem; font-weight: 700; color: var(--text-primary); }
.gw-icon-muted { color: var(--text-muted); }

/* Account list panel */
.gw-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-base);
}
.gw-icon-btn {
  color: var(--text-muted);
  background: none;
  border: none;
  padding: 4px;
  border-radius: 6px;
  transition: color 0.2s;
}
.gw-icon-btn:hover { color: var(--text-primary); }

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
.gw-account-email {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gw-account-note {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gw-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
}
.gw-progress-track {
  width: 100%;
  background: var(--bg-app);
  height: 6px;
  border-radius: 9999px;
  overflow: hidden;
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
  .gw-account-detail-card { flex-direction: row; }
}
.gw-account-title {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 1.125rem;
  display: flex;
  align-items: center;
  gap: 8px;
}
.gw-account-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 8px;
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
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
.gw-icon-action-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
.gw-icon-danger-btn {
  padding: 8px;
  color: #f87171;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  transition: all 0.15s;
}
.gw-icon-danger-btn:hover { background: rgba(239, 68, 68, 0.08); color: #fca5a5; }

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
.gw-check-item:hover { border-color: var(--border-strong); }
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
  .gw-action-footer { flex-direction: row; align-items: center; justify-content: space-between; }
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
.gw-btn-secondary:hover { background: var(--bg-hover); }

/* Border helpers */
.gw-border-top { border-top: 1px solid var(--border-base); padding-top: 12px; }

/* Dialog */
.gw-dialog :deep(.el-dialog) {
  --el-dialog-bg-color: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 16px;
}
.gw-dialog :deep(.el-dialog__title) {
  color: var(--text-primary);
  font-weight: 700;
}
.gw-dialog :deep(.el-dialog__body) {
  color: var(--text-secondary);
}

/* Form fields */
.gw-field { display: flex; flex-direction: column; gap: 6px; }
.gw-field-label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
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
.gw-input:focus { border-color: rgba(139, 92, 246, 0.5); }

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
.gw-textarea:focus { border-color: rgba(139, 92, 246, 0.4); }

/* Table */
.gw-table-wrapper {
  border: 1px solid var(--border-base);
  border-radius: 12px;
  overflow: hidden;
}
.gw-table-head {
  background: var(--bg-app);
  border-bottom: 1px solid var(--border-base);
  color: var(--text-muted);
  font-weight: 700;
}
.gw-table-row {
  border-bottom: 1px solid var(--border-base);
  transition: background 0.1s;
}
.gw-table-row:last-child { border-bottom: none; }
.gw-table-row:hover { background: var(--bg-hover); }
.gw-table-input {
  background: transparent;
  width: 100%;
  border: none;
  color: var(--text-primary);
  padding: 4px;
  border-radius: 4px;
  font-size: 0.75rem;
  outline: none;
}
.gw-table-input:focus { background: var(--bg-app); }

/* Scrollbar */
.scrollbar-thin::-webkit-scrollbar { height: 4px; width: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: var(--border-base);
  border-radius: 9999px;
}
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }

/* 2FA Card Styling */
.gw-2fa-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(79, 70, 229, 0.08) 100%);
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.05);
}

.gw-2fa-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(124, 58, 237, 0.15);
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: 10px;
}

.pl-9 {
  padding-left: 36px !important;
}

/* =====================================================
   Mobile Responsive Adjustments
   ===================================================== */
@media (max-width: 1023px) {
  .gw-page {
    padding: 8px 10px;
  }
}
@media (max-width: 640px) {
  .gw-header {
    padding-bottom: 8px;
    gap: 10px;
  }
  .gw-header > div:last-child {
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
  }
  .gw-btn-primary, .gw-btn-secondary {
    padding: 6px 10px !important;
    font-size: 10px !important;
    border-radius: 8px !important;
  }
  .gw-card {
    padding: 12px !important;
    border-radius: 12px !important;
  }
  .gw-account-detail-card {
    padding: 10px 12px !important;
    gap: 10px !important;
    border-radius: 10px !important;
  }
  .gw-day-circle {
    width: 38px !important;
    height: 38px !important;
    border-radius: 8px !important;
    font-size: 0.75rem !important;
  }
  .gw-checklist-card {
    padding: 12px !important;
    gap: 10px !important;
    border-radius: 12px !important;
  }
  .gw-checklist-header {
    padding-bottom: 8px !important;
  }
  .gw-checklist-title {
    font-size: 0.875rem !important;
  }
  .gw-check-item {
    padding: 10px !important;
    gap: 8px !important;
    border-radius: 8px !important;
  }
  .gw-check-label {
    font-size: 0.75rem !important;
  }
  .gw-action-footer {
    padding-top: 12px !important;
    gap: 10px !important;
  }
  .gw-empty-state {
    min-height: 250px !important;
    padding: 24px !important;
  }
}

:deep(.custom-el-table) {
  --el-table-bg-color: transparent !important;
  --el-table-tr-bg-color: transparent !important;
  --el-table-row-hover-bg-color: var(--bg-hover) !important;
  --el-table-border-color: var(--border-base) !important;
  --el-table-header-text-color: var(--text-secondary) !important;
  --el-table-text-color: var(--text-primary) !important;
  background-color: transparent !important;
}
:deep(.custom-el-table th.el-table__cell) {
  background-color: var(--bg-app) !important;
  color: var(--text-secondary) !important;
  font-weight: 700 !important;
  border-bottom: 1px solid var(--border-base) !important;
}
:deep(.custom-el-table td.el-table__cell) {
  border-bottom: 1px solid var(--border-base) !important;
  color: var(--text-primary) !important;
}
</style>

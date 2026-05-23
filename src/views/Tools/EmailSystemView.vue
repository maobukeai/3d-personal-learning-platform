<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';
import {
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Send,
  Inbox,
  AlertTriangle,
  FolderOpen,
  CheckCircle,
  Shield,
  Sliders,
  Search,
  Eye,
  FileText,
  ChevronRight,
  Globe
} from 'lucide-vue-next';
import api from '@/utils/api';

// Account structure definition
interface EmailAccount {
  id: string;
  email: string;
  password?: string;
  clientId: string;
  refreshToken: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ERROR';
  statusMessage?: string;
  proxy?: string;
  userAgent?: string;
  dailyLimit: number;
  sentCountToday: number;
  minDelay: number;
  maxDelay: number;
  createdAt: string;
}

// Mail message structure definition
interface MailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  hasAttachments: boolean;
  isRead: boolean;
}

// State variables
const accounts = ref<EmailAccount[]>([]);
const selectedAccountId = ref<string>('');
const currentFolder = ref<string>('inbox');
const messages = ref<MailMessage[]>([]);
const selectedMessage = ref<MailMessage | null>(null);
const searchQuery = ref<string>('');
const isMessagesLoading = ref<boolean>(false);
const isAccountsLoading = ref<boolean>(false);

// Dialogs state
const isImportDialogVisible = ref<boolean>(false);
const isAddDialogVisible = ref<boolean>(false);

// Multi-select state
const isMultiSelectMode = ref<boolean>(false);
const selectedAccountIds = ref<string[]>([]);
const isBatchTesting = ref<boolean>(false);
const isBatchDeleting = ref<boolean>(false);

const isAllSelected = computed(() => {
  return accounts.value.length > 0 && selectedAccountIds.value.length === accounts.value.length;
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedAccountIds.value = [];
  } else {
    selectedAccountIds.value = accounts.value.map((a) => a.id);
  }
};

const toggleSelectAccount = (id: string) => {
  const idx = selectedAccountIds.value.indexOf(id);
  if (idx > -1) {
    selectedAccountIds.value.splice(idx, 1);
  } else {
    selectedAccountIds.value.push(id);
  }
};

watch(isMultiSelectMode, (newVal: boolean) => {
  if (!newVal) {
    selectedAccountIds.value = [];
  }
});

// Bulk import raw text input state
const importText = ref<string>('');
const importProxy = ref<string>('');
const importMinDelay = ref<number>(5);
const importMaxDelay = ref<number>(15);
const importDailyLimit = ref<number>(50);

// Single account form state
const singleAccount = ref({
  email: '',
  password: '',
  clientId: '',
  refreshToken: '',
  proxy: '',
  minDelay: 5,
  maxDelay: 15,
  dailyLimit: 50,
});

// Outbox Compose mail state
const isComposeMode = ref<boolean>(false);
const composeForm = ref({
  accountId: 'round-robin', // Default is round-robin sending
  to: '',
  subject: '',
  content: '',
});
const isSending = ref<boolean>(false);
const currentSendingAccount = ref<string>('');
const sendingStatusText = ref<string>('');

// Folders definitions matching MS Graph folders
const foldersList = [
  { id: 'inbox', name: '收件箱', icon: Inbox },
  { id: 'sentitems', name: '已发送', icon: Send },
  { id: 'drafts', name: '草稿箱', icon: FileText },
  { id: 'junkemail', name: '垃圾邮件', icon: AlertTriangle },
  { id: 'deleteditems', name: '已删除', icon: Trash2 },
];

// Computed counts

const filteredMessages = computed(() => {
  if (!searchQuery.value) return messages.value;
  const q = searchQuery.value.toLowerCase();
  return messages.value.filter(
    msg =>
      msg.subject?.toLowerCase().includes(q) ||
      msg.from?.emailAddress?.name?.toLowerCase().includes(q) ||
      msg.from?.emailAddress?.address?.toLowerCase().includes(q) ||
      msg.bodyPreview?.toLowerCase().includes(q)
  );
});

// Initializers
onMounted(async () => {
  await fetchAccounts();
  if (accounts.value.length > 0) {
    selectedAccountId.value = accounts.value[0].id;
    await fetchMessages();
  }
});

// Methods
const fetchAccounts = async () => {
  isAccountsLoading.value = true;
  try {
    const res = await api.get('/api/email/accounts');
    accounts.value = res.data || [];
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '获取邮箱账号列表失败');
  } finally {
    isAccountsLoading.value = false;
  }
};

const selectAccount = async (id: string) => {
  selectedAccountId.value = id;
  selectedMessage.value = null;
  isComposeMode.value = false;
  await fetchMessages();
};

const fetchMessages = async () => {
  if (!selectedAccountId.value) return;
  isMessagesLoading.value = true;
  selectedMessage.value = null;
  try {
    const res = await api.get(`/api/email/accounts/${selectedAccountId.value}/messages`, {
      params: {
        folderId: currentFolder.value,
        limit: 30,
      },
    });
    messages.value = res.data || [];
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '同步邮件失败，请确认令牌有效性');
    messages.value = [];
  } finally {
    isMessagesLoading.value = false;
  }
};

const changeFolder = async (folderId: string) => {
  currentFolder.value = folderId;
  await fetchMessages();
};

const testConnection = async (account: EmailAccount) => {
  const loading = ElNotification({
    title: '连接测试中',
    message: `正在验证 ${account.email} 微软令牌...`,
    type: 'info',
    duration: 0,
  });

  try {
    await api.post(`/api/email/accounts/${account.id}/test`);
    loading.close();
    ElNotification({
      title: '测试成功',
      message: `${account.email} 连接成功并已激活！`,
      type: 'success',
    });
    await fetchAccounts();
  } catch (e: any) {
    loading.close();
    ElNotification({
      title: '连接测试失败',
      message: `${account.email}: ${e.response?.data?.details || e.message}`,
      type: 'error',
    });
    await fetchAccounts();
  }
};

const deleteAccount = async (account: EmailAccount) => {
  try {
    await ElMessageBox.confirm(`确定要移除账号 ${account.email} 吗？此操作不会影响微软服务器上的邮件。`, '安全移除提示', {
      confirmButtonText: '确定移除',
      cancelButtonText: '取消',
      type: 'warning',
    });

    await api.delete(`/api/email/accounts/${account.id}`);
    ElMessage.success('账号移除成功');
    await fetchAccounts();
    
    if (selectedAccountId.value === account.id) {
      if (accounts.value.length > 0) {
        selectedAccountId.value = accounts.value[0].id;
        await fetchMessages();
      } else {
        selectedAccountId.value = '';
        messages.value = [];
      }
    }
  } catch (e) {
    // cancelled
  }
};

// Batch Import Submission
const handleBatchImport = async () => {
  if (!importText.value.trim()) {
    ElMessage.warning('请先粘贴令牌数据');
    return;
  }

  isAccountsLoading.value = true;
  try {
    const res = await api.post('/api/email/accounts/import', {
      importData: importText.value,
      proxy: importProxy.value || undefined,
      minDelay: importMinDelay.value,
      maxDelay: importMaxDelay.value,
      dailyLimit: importDailyLimit.value,
    });

    ElMessage.success(res.data.message);
    isImportDialogVisible.value = false;
    importText.value = '';
    await fetchAccounts();
    if (accounts.value.length > 0 && !selectedAccountId.value) {
      selectedAccountId.value = accounts.value[0].id;
      await fetchMessages();
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '导入失败，请检查数据格式');
  } finally {
    isAccountsLoading.value = false;
  }
};

// Add Single Account Submission
const handleAddSingle = async () => {
  const { email, password, clientId, refreshToken } = singleAccount.value;
  if (!email || !clientId || !refreshToken) {
    ElMessage.warning('请填写邮箱、Client ID 和 令牌内容');
    return;
  }

  const rawLine = `${email}----${password || ''}----${clientId}----${refreshToken}`;
  isAccountsLoading.value = true;
  try {
    await api.post('/api/email/accounts/import', {
      importData: rawLine,
      proxy: singleAccount.value.proxy || undefined,
      minDelay: singleAccount.value.minDelay,
      maxDelay: singleAccount.value.maxDelay,
      dailyLimit: singleAccount.value.dailyLimit,
    });

    ElMessage.success('账号添加成功！');
    isAddDialogVisible.value = false;
    // reset form
    singleAccount.value = {
      email: '',
      password: '',
      clientId: '',
      refreshToken: '',
      proxy: '',
      minDelay: 5,
      maxDelay: 15,
      dailyLimit: 50,
    };
    await fetchAccounts();
    if (accounts.value.length > 0 && !selectedAccountId.value) {
      selectedAccountId.value = accounts.value[0].id;
      await fetchMessages();
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '添加账号失败');
  } finally {
    isAccountsLoading.value = false;
  }
};

// Mail Operations
const viewMessage = async (msg: MailMessage) => {
  selectedMessage.value = msg;
  isComposeMode.value = false;
  
  if (!msg.isRead) {
    try {
      await api.patch(`/api/email/accounts/${selectedAccountId.value}/messages/${msg.id}`, {
        isRead: true,
      });
      // update state
      msg.isRead = true;
    } catch (e) {
      console.error('Mark read failed', e);
    }
  }
};

const toggleMessageReadStatus = async (msg: MailMessage) => {
  const targetState = !msg.isRead;
  try {
    await api.patch(`/api/email/accounts/${selectedAccountId.value}/messages/${msg.id}`, {
      isRead: targetState,
    });
    msg.isRead = targetState;
    ElMessage.success(targetState ? '邮件已标记为已读' : '邮件已标记为未读');
  } catch (e: any) {
    ElMessage.error('操作失败: ' + e.message);
  }
};

const deleteMessage = async (msg: MailMessage) => {
  try {
    await ElMessageBox.confirm('确定要删除这封邮件吗？此操作会将其移动至微软邮箱的已删除文件夹中。', '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    });

    await api.delete(`/api/email/accounts/${selectedAccountId.value}/messages/${msg.id}`);
    ElMessage.success('邮件已删除');
    messages.value = messages.value.filter(m => m.id !== msg.id);
    if (selectedMessage.value?.id === msg.id) {
      selectedMessage.value = null;
    }
  } catch (e) {
    // cancelled
  }
};

const handleBatchTest = async () => {
  if (selectedAccountIds.value.length === 0) {
    ElMessage.warning('请先选择要测试的账号');
    return;
  }
  isBatchTesting.value = true;
  let successCount = 0;
  let failCount = 0;

  ElMessage.info(`开始批量校验 ${selectedAccountIds.value.length} 个账号，请稍候...`);

  const promises = selectedAccountIds.value.map(async (id) => {
    try {
      await api.post(`/api/email/accounts/${id}/test`);
      successCount++;
    } catch (e) {
      failCount++;
    }
  });

  await Promise.all(promises);
  ElMessage.success(`批量测试校验完成！成功: ${successCount} 个，失败: ${failCount} 个。`);
  isMultiSelectMode.value = false;
  await fetchAccounts();
  isBatchTesting.value = false;
};

const handleBatchDelete = async () => {
  if (selectedAccountIds.value.length === 0) {
    ElMessage.warning('请先选择要解绑的账号');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定要批量解绑这 ${selectedAccountIds.value.length} 个邮箱账号吗？该操作不可撤销。`,
      '批量解绑确认',
      {
        confirmButtonText: '确定解绑',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    isBatchDeleting.value = true;
    let deletedCount = 0;

    const promises = selectedAccountIds.value.map(async (id) => {
      try {
        await api.delete(`/api/email/accounts/${id}`);
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete account ${id}:`, e);
      }
    });

    await Promise.all(promises);
    ElMessage.success(`批量操作完成，成功解绑 ${deletedCount} 个邮箱账号！`);

    if (selectedAccountId.value && selectedAccountIds.value.includes(selectedAccountId.value)) {
      selectedAccountId.value = '';
    }

    isMultiSelectMode.value = false;
    await fetchAccounts();
  } catch (e) {
    // cancelled
  } finally {
    isBatchDeleting.value = false;
  }
};

// Sending flow
const triggerCompose = () => {
  isComposeMode.value = true;
  selectedMessage.value = null;
  // If an account is active, set it in select field, else default to round-robin
  if (selectedAccountId.value) {
    composeForm.value.accountId = selectedAccountId.value;
  } else {
    composeForm.value.accountId = 'round-robin';
  }
};

const handleSendEmail = async () => {
  const { accountId, to, subject, content } = composeForm.value;
  if (!to || !subject || !content) {
    ElMessage.warning('请完整填写收件人、主题及正文内容');
    return;
  }

  isSending.value = true;
  currentSendingAccount.value = '';
  sendingStatusText.value = '正在呼叫 Microsoft Graph 安全通道...';

  try {
    const res = await api.post('/api/email/send', {
      accountId,
      to,
      subject,
      content,
    });

    ElNotification({
      title: '发送成功',
      message: `邮件已成功自 ${res.data.sender} 发送！`,
      type: 'success',
    });

    composeForm.value.to = '';
    composeForm.value.subject = '';
    composeForm.value.content = '';
    isComposeMode.value = false;

    // Refresh telemetry and messages
    await fetchAccounts();
    if (selectedAccountId.value) {
      await fetchMessages();
    }
  } catch (e: any) {
    ElMessageBox.alert(e.response?.data?.error || '邮件发送异常，请检查账号限制及代理配置', '邮件发送失败', {
      confirmButtonText: '了解',
      type: 'error',
    });
  } finally {
    isSending.value = false;
  }
};

// Formats
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<template>
  <div class="email-system flex h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
    
    <!-- LEFT COLUMN: Accounts, Folders & Controls (280px) -->
    <aside class="w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col z-10 select-none">
      
      <!-- Top Action Hub -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-900 flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Mail class="w-4 h-4" />
            </div>
            <span class="font-semibold text-slate-800 dark:text-slate-100">微软邮箱集成系统</span>
          </div>
          <el-tooltip content="刷新账号列表" placement="top">
            <button @click="fetchAccounts" class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors duration-200">
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isAccountsLoading }" />
            </button>
          </el-tooltip>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-1">
          <button
            @click="isImportDialogVisible = true"
            class="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm shadow-indigo-200 dark:shadow-none"
          >
            <Plus class="w-3.5 h-3.5" /> 批量导入
          </button>
          <button
            @click="isAddDialogVisible = true"
            class="flex items-center justify-center gap-1.5 py-1.5 px-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-xs font-medium transition-all duration-200"
          >
            <Plus class="w-3.5 h-3.5" /> 添加账号
          </button>
        </div>
      </div>

      <!-- Scrollable Accounts List -->
      <div class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4">
        <div>
          <div class="flex items-center justify-between px-2 mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <div class="flex items-center gap-1.5" v-if="isMultiSelectMode">
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
                class="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>全选 ({{ selectedAccountIds.length }}/{{ accounts.length }})</span>
            </div>
            <span v-else>已绑定账号 ({{ accounts.length }})</span>
            
            <button
              v-if="accounts.length > 0"
              @click="isMultiSelectMode = !isMultiSelectMode"
              class="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer transition-colors"
            >
              {{ isMultiSelectMode ? '取消多选' : '多选管理' }}
            </button>
          </div>

          <!-- Batch Action Buttons -->
          <div v-if="isMultiSelectMode && accounts.length > 0" class="flex gap-2 mb-3 px-1">
            <button
              @click="handleBatchTest"
              :disabled="selectedAccountIds.length === 0 || isBatchTesting"
              class="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100/80 text-indigo-600 dark:text-indigo-400 disabled:opacity-50 disabled:pointer-events-none rounded-lg text-[10px] font-bold border border-indigo-200/50 dark:border-indigo-900/40 transition-all cursor-pointer"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isBatchTesting }" />
              批量校验
            </button>
            <button
              @click="handleBatchDelete"
              :disabled="selectedAccountIds.length === 0 || isBatchDeleting"
              class="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100/80 text-rose-600 dark:text-rose-400 disabled:opacity-50 disabled:pointer-events-none rounded-lg text-[10px] font-bold border border-rose-200/50 dark:border-rose-900/40 transition-all cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
              批量解绑
            </button>
          </div>

          <div v-if="accounts.length === 0" class="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
            <Mail class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <p class="text-xs">暂无绑定邮箱账号</p>
            <p class="text-[10px] mt-1">点击上方按钮快速导入或单账号添加</p>
          </div>

          <ul v-else class="flex flex-col gap-1.5">
            <li v-for="acc in accounts" :key="acc.id">
              <div
                @click="isMultiSelectMode ? toggleSelectAccount(acc.id) : selectAccount(acc.id)"
                class="group w-full text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-1.5"
                :class="[
                  selectedAccountId === acc.id && !isMultiSelectMode
                    ? 'bg-indigo-50/70 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/40'
                    : selectedAccountIds.includes(acc.id) && isMultiSelectMode
                    ? 'bg-indigo-50/30 border-indigo-200/60 dark:bg-indigo-950/10 dark:border-indigo-900/30'
                    : 'bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-900 hover:border-slate-300 dark:hover:border-slate-800'
                ]"
              >
                <!-- Email & Connection Indicator -->
                <div class="flex items-center justify-between gap-1.5">
                  <div class="flex items-center gap-2 truncate flex-1">
                    <input
                      v-if="isMultiSelectMode"
                      type="checkbox"
                      :checked="selectedAccountIds.includes(acc.id)"
                      @click.stop="toggleSelectAccount(acc.id)"
                      class="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                    />
                    <span
                      class="font-medium text-xs truncate"
                      :class="selectedAccountId === acc.id && !isMultiSelectMode ? 'text-indigo-900 dark:text-indigo-300 font-semibold' : 'text-slate-800 dark:text-slate-200'"
                    >
                      {{ acc.email }}
                    </span>
                  </div>

                  <!-- Status Dot -->
                  <el-tooltip :content="acc.statusMessage || (acc.status === 'ACTIVE' ? '正常' : '异常')" placement="right">
                    <span class="shrink-0 flex items-center">
                      <span
                        class="w-2 h-2 rounded-full ring-2"
                        :class="[
                          acc.status === 'ACTIVE'
                            ? 'bg-emerald-500 ring-emerald-500/10'
                            : acc.status === 'EXPIRED'
                            ? 'bg-amber-500 ring-amber-500/10'
                            : 'bg-rose-500 ring-rose-500/10'
                        ]"
                      ></span>
                    </span>
                  </el-tooltip>
                </div>

                <!-- Daily sends & Limits telemetry -->
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>今日已发: {{ acc.sentCountToday }} 封</span>
                    <span>限额 {{ acc.dailyLimit }} 封</span>
                  </div>
                  <div class="w-full h-1 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      :class="acc.sentCountToday >= acc.dailyLimit ? 'bg-rose-500' : 'bg-indigo-500'"
                      :style="{ width: `${Math.min(100, (acc.sentCountToday / acc.dailyLimit) * 100)}%` }"
                    ></div>
                  </div>
                </div>

                <!-- Proxy & Quick Operations -->
                <div class="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 border-t border-slate-100/50 dark:border-slate-900 pt-1.5">
                  <span class="truncate flex items-center gap-1 max-w-[120px]" :title="acc.proxy || '未挂载代理'">
                    <Globe class="w-3 h-3 text-slate-400" />
                    {{ acc.proxy ? acc.proxy.split('@').pop() : 'Direct' }}
                  </span>
                  
                  <div class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" v-if="!isMultiSelectMode">
                    <button
                      @click.stop="testConnection(acc)"
                      class="p-0.5 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/50 text-indigo-500 rounded transition-colors"
                      title="校验微软令牌"
                    >
                      <CheckCircle class="w-3.5 h-3.5" />
                    </button>
                    <button
                      @click.stop="deleteAccount(acc)"
                      class="p-0.5 hover:bg-rose-100/50 dark:hover:bg-rose-950/50 text-rose-500 rounded transition-colors"
                      title="安全解绑账号"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Folder Lists -->
        <div v-show="selectedAccountId" class="border-t border-slate-100 dark:border-slate-900 pt-4">
          <div class="px-2 mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">邮件文件夹</div>
          <ul class="flex flex-col gap-0.5">
            <li v-for="folder in foldersList" :key="folder.id">
              <button
                @click="changeFolder(folder.id)"
                class="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 text-left"
                :class="[
                  currentFolder === folder.id
                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-slate-200'
                ]"
              >
                <div class="flex items-center gap-2">
                  <component :is="folder.icon" class="w-4 h-4 text-slate-400" />
                  <span>{{ folder.name }}</span>
                </div>
                <ChevronRight class="w-3 h-3 text-slate-300" v-show="currentFolder === folder.id" />
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Quick Banner Support -->
      <div class="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 border-t border-slate-100 dark:border-slate-900 flex items-center gap-2">
        <Shield class="w-4 h-4 text-indigo-500" />
        <div class="text-[10px] text-slate-400">
          目前适配微软 Outlook / Hotmail 账号。
        </div>
      </div>
    </aside>

    <!-- CENTER COLUMN: Mail Headers List (320px) -->
    <section class="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col z-0">
      <!-- Search and Header Controls -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-900 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span>{{ foldersList.find(f => f.id === currentFolder)?.name || '邮件列表' }}</span>
            <span v-show="messages.length > 0" class="text-xs py-0.5 px-1.5 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-full font-semibold">
              {{ filteredMessages.length }}
            </span>
          </h2>
          
          <div class="flex items-center gap-2">
            <button
              @click="triggerCompose"
              class="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all duration-200 select-none"
            >
              <Send class="w-3.5 h-3.5" /> 写信
            </button>
            <button
              @click="fetchMessages"
              :disabled="!selectedAccountId"
              class="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="拉取最新邮件"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isMessagesLoading }" />
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search class="w-3.5 h-3.5" />
          </span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索发件人、主题..."
            class="w-full text-xs pl-8.5 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
          />
        </div>
      </div>

      <!-- Messages Header Feed -->
      <div class="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-slate-950">
        <!-- Not loaded / Loading states -->
        <div v-if="!selectedAccountId" class="py-16 px-4 text-center text-slate-400 select-none">
          <FolderOpen class="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
          <p class="text-xs">请先选择左侧微软账号进行同步</p>
        </div>

        <div v-else-if="isMessagesLoading && messages.length === 0" class="py-16 px-4 text-center">
          <RefreshCw class="w-8 h-8 mx-auto mb-3 text-indigo-500 animate-spin" />
          <p class="text-xs text-slate-400">正在与微软 Graph 服务器同步数据中...</p>
        </div>

        <div v-else-if="filteredMessages.length === 0" class="py-16 px-4 text-center text-slate-400 select-none">
          <Mail class="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
          <p class="text-xs">未找到任何邮件记录</p>
        </div>

        <!-- Mail Items -->
        <ul v-else class="flex flex-col border-b border-slate-100 dark:border-slate-900">
          <li
            v-for="msg in filteredMessages"
            :key="msg.id"
            @click="viewMessage(msg)"
            class="p-3.5 border-b border-slate-100/60 dark:border-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-all duration-200 cursor-pointer text-left flex flex-col gap-1.5 relative"
            :class="[
              selectedMessage?.id === msg.id
                ? 'bg-indigo-50/30 dark:bg-indigo-950/10 border-l-2 border-l-indigo-500'
                : ''
            ]"
          >
            <!-- Unread Dot Badge -->
            <span
              v-show="!msg.isRead"
              class="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500"
            ></span>

            <!-- Sender & Date -->
            <div class="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span class="truncate font-semibold text-slate-600 dark:text-slate-300 max-w-[150px]">
                {{ msg.from?.emailAddress?.name || msg.from?.emailAddress?.address }}
              </span>
              <span class="shrink-0">{{ formatDate(msg.receivedDateTime) }}</span>
            </div>

            <!-- Subject -->
            <h3
              class="text-xs font-semibold line-clamp-1 truncate max-w-[240px]"
              :class="msg.isRead ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-950 dark:text-white font-bold'"
            >
              {{ msg.subject || '（无主题）' }}
            </h3>

            <!-- Snippet Body Preview -->
            <p class="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
              {{ msg.bodyPreview || '（无预览内容）' }}
            </p>
          </li>
        </ul>
      </div>
    </section>

    <!-- RIGHT COLUMN: Mail Detail Viewer or Mail Send Composer (Flexible) -->
    <main class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900/40 flex flex-col h-full relative">
      
      <!-- Welcome empty state -->
      <div
        v-if="!selectedMessage && !isComposeMode"
        class="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 select-none"
      >
        <div class="w-16 h-16 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-300 dark:text-slate-700 mb-4 animate-pulse">
          <Mail class="w-7 h-7" />
        </div>
        <p class="text-sm font-semibold text-slate-600 dark:text-slate-400">微软 Graph 安全邮箱管理后台</p>
        <p class="text-xs mt-1 text-slate-400 max-w-sm text-center leading-relaxed">
          您可以选择一个账号并同步邮件列表，点击邮件进行阅读；或者点击“写信”开始安全邮件群发。
        </p>
      </div>

      <!-- READ MAIL VIEW -->
      <div v-else-if="selectedMessage && !isComposeMode" class="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 min-h-0">
        <!-- Control Header -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <button
              @click="toggleMessageReadStatus(selectedMessage)"
              class="flex items-center gap-1.5 py-1.5 px-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              <Eye class="w-3.5 h-3.5" />
              <span>标记为{{ selectedMessage.isRead ? '未读' : '已读' }}</span>
            </button>
            <button
              @click="deleteMessage(selectedMessage)"
              class="flex items-center gap-1.5 py-1.5 px-3 border border-rose-100 hover:bg-rose-50 text-rose-500 rounded-lg text-xs font-semibold transition-colors"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>删除邮件</span>
            </button>
          </div>
          
          <div class="text-xs text-slate-400 font-medium">
            通过微软 API 安全调取
          </div>
        </div>

        <!-- Message Core Payload Info -->
        <div class="p-6 border-b border-slate-100 dark:border-slate-900 shrink-0 text-left bg-slate-50/50 dark:bg-slate-950">
          <h1 class="text-base font-bold text-slate-950 dark:text-white leading-snug">
            {{ selectedMessage.subject || '（无主题）' }}
          </h1>

          <div class="flex items-start gap-3 mt-4">
            <div class="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 text-xs font-bold uppercase">
              {{ selectedMessage.from?.emailAddress?.name?.charAt(0) || 'U' }}
            </div>
            
            <div class="flex-1 min-w-0 flex flex-col gap-0.5 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-800 dark:text-slate-200">
                  {{ selectedMessage.from?.emailAddress?.name || '未知发件人' }}
                </span>
                <span class="text-[11px] text-slate-400 font-medium shrink-0">
                  {{ formatDate(selectedMessage.receivedDateTime) }}
                </span>
              </div>
              
              <div class="text-[11px] text-slate-400">
                发件人: <span class="text-slate-500">{{ selectedMessage.from?.emailAddress?.address }}</span>
              </div>
              <div class="text-[11px] text-slate-400 truncate max-w-[500px]">
                收件人: <span class="text-slate-500" v-for="rec in selectedMessage.toRecipients" :key="rec.emailAddress.address">{{ rec.emailAddress.name || rec.emailAddress.address }}; </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Rendered Body Frame -->
        <div class="flex-1 overflow-y-auto p-6 min-h-0">
          <div
            v-if="selectedMessage.body?.contentType === 'html'"
            class="w-full h-full text-slate-800 dark:text-slate-200 text-sm leading-relaxed"
          >
            <!-- Standard safe iframe wrapper for rich HTML mails -->
            <iframe
              :srcdoc="`
                <html>
                  <head>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; margin: 0; padding: 10px; }
                      a { color: #4f46e5; text-decoration: none; }
                      img { max-width: 100%; height: auto; }
                    </style>
                  </head>
                  <body>
                    ${selectedMessage.body.content}
                  </body>
                </html>
              `"
              class="w-full h-full border-none bg-white"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
            ></iframe>
          </div>
          <div v-else class="whitespace-pre-wrap text-left text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900">
            {{ selectedMessage.body?.content || selectedMessage.bodyPreview }}
          </div>
        </div>
      </div>

      <!-- WRITE EMAIL COMPOSER -->
      <div v-else-if="isComposeMode" class="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 min-h-0">
        <!-- Control Header -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between shrink-0 select-none">
          <h2 class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
            <Send class="w-4 h-4 text-indigo-500" />
            <span>编写新邮件</span>
          </h2>
          <div class="flex items-center gap-2">
            <button
              @click="isComposeMode = false"
              class="py-1.5 px-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              取消发送
            </button>
            <button
              @click="handleSendEmail"
              :disabled="isSending"
              class="flex items-center gap-1.5 py-1.5 px-4.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200 dark:shadow-none"
            >
              <Send class="w-3.5 h-3.5" />
              <span>{{ isSending ? '正在发出...' : '立即发出' }}</span>
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-4 text-left">
          
          <!-- Route Selecting Box (Anti-ban Option) -->
          <div class="grid grid-cols-6 gap-3 items-center">
            <label class="col-span-1 text-xs font-semibold text-slate-400">发件账号</label>
            <div class="col-span-5 flex items-center gap-2">
              <select
                v-model="composeForm.accountId"
                class="flex-1 text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
              >
                <option value="round-robin">🚀 多账号随机轮询发送 (防封推荐)</option>
                <option v-for="acc in accounts" :key="acc.id" :value="acc.id" :disabled="acc.status !== 'ACTIVE'">
                  {{ acc.email }} {{ acc.status !== 'ACTIVE' ? `(异常:${acc.status})` : `(今日发:${acc.sentCountToday})` }}
                </option>
              </select>
            </div>
          </div>

          <!-- To recipient -->
          <div class="grid grid-cols-6 gap-3 items-center">
            <label class="col-span-1 text-xs font-semibold text-slate-400">收件人</label>
            <input
              v-model="composeForm.to"
              type="email"
              placeholder="recipient@example.com"
              class="col-span-5 text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
            />
          </div>

          <!-- Subject -->
          <div class="grid grid-cols-6 gap-3 items-center">
            <label class="col-span-1 text-xs font-semibold text-slate-400">主题</label>
            <input
              v-model="composeForm.subject"
              type="text"
              placeholder="请输入邮件主题内容"
              class="col-span-5 text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
            />
          </div>

          <!-- Content Body -->
          <div class="flex-1 flex flex-col gap-2 min-h-[250px]">
            <label class="text-xs font-semibold text-slate-400">正文内容 (支持 HTML 格式)</label>
            <textarea
              v-model="composeForm.content"
              placeholder="请在这里填写邮件详细文本，支持直接贴入 <html> 页面进行格式丰富群发。"
              class="flex-1 text-xs px-3.5 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white font-mono resize-none leading-relaxed transition-all duration-200 min-h-[200px]"
            ></textarea>
          </div>
        </div>

        <!-- Safe Status Sending Overlay (While sending) -->
        <div v-show="isSending" class="absolute inset-0 bg-white/95 dark:bg-slate-950/95 flex flex-col items-center justify-center z-50 p-8 select-none">
          <div class="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin flex items-center justify-center mb-6"></div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">系统安全通道正在发送邮件</h3>
          <p class="text-xs text-slate-400 mt-2 max-w-sm text-center leading-relaxed">
            {{ sendingStatusText || '正在通过微软 Graph 安全终点向网关推送，并应用延迟机制以防触发风控封禁...' }}
          </p>
        </div>
      </div>
    </main>

    <!-- BATCH IMPORT DIALOG -->
    <el-dialog
      v-model="isImportDialogVisible"
      title="批量导入微软邮箱账号"
      width="600px"
      append-to-body
      custom-class="dark:bg-slate-950 dark:border-slate-900"
    >
      <div class="flex flex-col gap-4 text-left">
        <div class="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-950 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed">
          <AlertTriangle class="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <p class="font-semibold">令牌导入格式要求：</p>
            <p class="mt-1 font-mono text-[11px]">邮箱----密码----client_id----令牌(即微软OAuth2 refresh_token)</p>
            <p class="mt-1">多条账号请用【换行符】进行分隔。若密码为空，可缩减成：<code class="font-mono bg-amber-100 dark:bg-amber-950/80 px-1 py-0.5 rounded text-[10px]">邮箱----client_id----令牌</code></p>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-slate-400">导入文本框</label>
          <textarea
            v-model="importText"
            placeholder="example@outlook.com----mypassword----00000000-0000-0000-0000-000000000000----MC...3u
example2@hotmail.com----00000000-0000-0000-0000-000000000000----MC...9a"
            class="w-full h-44 text-xs font-mono px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all duration-200"
          ></textarea>
        </div>

        <!-- Extra safe configs associated with this batch -->
        <div class="border-t border-slate-100 dark:border-slate-900 pt-4">
          <div class="px-1 mb-3 text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <Sliders class="w-4 h-4 text-indigo-500" />
            <span>批量账号防封安全初始配置</span>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-semibold text-slate-400">默认代理地址 (格式：http://ip:port 或 带密码)</label>
              <input
                v-model="importProxy"
                type="text"
                placeholder="http://username:password@proxy_ip:port"
                class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 transition-all duration-200"
              />
            </div>
            
            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-semibold text-slate-400">每日最高上限 (封/天)</label>
              <el-input-number
                v-model="importDailyLimit"
                :min="1"
                :max="1000"
                size="small"
                class="w-full"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-semibold text-slate-400">轮播随机延迟最小值 (秒)</label>
              <el-input-number
                v-model="importMinDelay"
                :min="1"
                :max="120"
                size="small"
                class="w-full"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-[11px] font-semibold text-slate-400">轮播随机延迟最大值 (秒)</label>
              <el-input-number
                v-model="importMaxDelay"
                :min="5"
                :max="300"
                size="small"
                class="w-full"
              />
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="isImportDialogVisible = false" size="small">取消</el-button>
          <el-button type="primary" @click="handleBatchImport" :loading="isAccountsLoading" size="small">确认解析导入</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- ADD SINGLE ACCOUNT DIALOG -->
    <el-dialog
      v-model="isAddDialogVisible"
      title="添加单微软邮箱账号"
      width="500px"
      append-to-body
      custom-class="dark:bg-slate-950"
    >
      <div class="flex flex-col gap-3.5 text-left">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-400">微软账号邮箱</label>
          <input
            v-model="singleAccount.email"
            type="email"
            placeholder="example@outlook.com"
            class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 transition-all duration-200"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-400">邮箱独立登录密码 (选填，用以作本地存档记录)</label>
          <input
            v-model="singleAccount.password"
            type="password"
            placeholder="微软网页登录密码"
            class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 transition-all duration-200"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-400">OAuth Client ID</label>
          <input
            v-model="singleAccount.clientId"
            type="text"
            placeholder="应用程序客户端ID (微软开发者后台申请)"
            class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 transition-all duration-200"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-400">OAuth 刷新令牌 (RefreshToken)</label>
          <input
            v-model="singleAccount.refreshToken"
            type="text"
            placeholder="Microsoft Graph OAuth 刷新令牌值"
            class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 transition-all duration-200"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-semibold text-slate-400">独立绑定代理配置</label>
          <input
            v-model="singleAccount.proxy"
            type="text"
            placeholder="http://username:password@proxy_host:port (空则使用服务器直连)"
            class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 transition-all duration-200"
          />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-semibold text-slate-400">每日上限(封)</label>
            <el-input-number v-model="singleAccount.dailyLimit" :min="1" :max="500" size="small" controls-position="right" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-semibold text-slate-400">延迟小值(秒)</label>
            <el-input-number v-model="singleAccount.minDelay" :min="1" :max="60" size="small" controls-position="right" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-semibold text-slate-400">延迟大值(秒)</label>
            <el-input-number v-model="singleAccount.maxDelay" :min="2" :max="300" size="small" controls-position="right" />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="isAddDialogVisible = false" size="small">取消</el-button>
          <el-button type="primary" @click="handleAddSingle" :loading="isAccountsLoading" size="small">保存并激活</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.email-system {
  height: calc(100vh - 3.5rem); /* offset MainLayout topbar height */
}

/* Custom scrolling classes */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.dark ::-webkit-scrollbar-thumb {
  background: #334155;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

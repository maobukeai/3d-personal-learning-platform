<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import EmailSidebar from './components/email/EmailSidebar.vue';
import EmailMessageList from './components/email/EmailMessageList.vue';
import EmailMessageDetail from './components/email/EmailMessageDetail.vue';
import EmailComposer from './components/email/EmailComposer.vue';
import EmailEmptyState from './components/email/EmailEmptyState.vue';
import EmailImportDialog from './components/email/EmailImportDialog.vue';
import EmailFormDialog from './components/email/EmailFormDialog.vue';
import { validateEmail } from '@/utils/validators';
import type {
  EmailAccount,
  EmailAccountUpdatePayload,
  MailMessage,
  ComposeForm,
  SingleAccountForm,
  EditAccountForm,
  ImportForm,
} from './components/email/email-types';

// State variables
const { t, locale } = useI18n();

const copyToClipboard = (text: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success(locale.value === 'en-US' ? 'Copied to clipboard' : '已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error(locale.value === 'en-US' ? 'Copy failed' : '复制失败');
    });
};

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

const toggleMultiSelect = () => {
  isMultiSelectMode.value = !isMultiSelectMode.value;
};

watch(isMultiSelectMode, (newVal: boolean) => {
  if (!newVal) {
    selectedAccountIds.value = [];
  }
});

// Import form state
const importForm = ref<ImportForm>({
  text: '',
  proxy: '',
  minDelay: 5,
  maxDelay: 15,
  dailyLimit: 50,
});

// Single account form state
const singleAccountForm = ref<SingleAccountForm>({
  email: '',
  password: '',
  clientId: '',
  refreshToken: '',
  proxy: '',
  minDelay: 5,
  maxDelay: 15,
  dailyLimit: 50,
});

const isEditDialogVisible = ref<boolean>(false);
const editingAccountForm = ref<EditAccountForm>({
  id: '',
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
const composeForm = ref<ComposeForm>({
  accountId: 'round-robin',
  to: '',
  subject: '',
  content: '',
});
const isSending = ref<boolean>(false);
const currentSendingAccount = ref<string>('');
const sendingStatusText = ref<string>('');

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
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('tools.email.fetch_accounts_failed')));
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
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('tools.email.fetch_messages_failed')));
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
    title: t('tools.email.conn_testing'),
    message: t('tools.email.verifying_token', { email: account.email }),
    type: 'info',
    duration: 0,
  });

  try {
    await api.post(`/api/email/accounts/${account.id}/test`);
    loading.close();
    ElNotification({
      title: t('tools.email.test_success'),
      message: t('tools.email.conn_success', { email: account.email }),
      type: 'success',
    });
    await fetchAccounts();
  } catch (e: unknown) {
    loading.close();
    ElNotification({
      title: t('tools.email.test_failed'),
      message: t('tools.email.test_failed_detailed', {
        email: account.email,
        error: getApiErrorMessage(e, t('tools.email.test_failed')),
      }),
      type: 'error',
    });
    await fetchAccounts();
  }
};

const deleteAccount = async (account: EmailAccount) => {
  try {
    await ElMessageBox.confirm(
      t('tools.email.unbind_confirm_text', { email: account.email }),
      t('tools.email.unbind_confirm_title'),
      {
        confirmButtonText: t('tools.email.unbind_confirm_btn'),
        cancelButtonText: t('tools.email.cancel_btn'),
        type: 'warning',
      },
    );

    await api.delete(`/api/email/accounts/${account.id}`);
    ElMessage.success(t('tools.email.unbind_success'));
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
  } catch {
    // cancelled
  }
};

const startEditAccount = (account: EmailAccount) => {
  editingAccountForm.value = {
    id: account.id,
    email: account.email,
    password: '',
    clientId: account.clientId,
    refreshToken: '',
    proxy: account.proxy || '',
    minDelay: account.minDelay,
    maxDelay: account.maxDelay,
    dailyLimit: account.dailyLimit,
  };
  isEditDialogVisible.value = true;
};

const handleSaveEdit = async () => {
  const { id, password, clientId, refreshToken, proxy, dailyLimit, minDelay, maxDelay } =
    editingAccountForm.value;
  if (!clientId) {
    ElMessage.warning('Client ID 不能为空');
    return;
  }

  isAccountsLoading.value = true;
  try {
    const payload: EmailAccountUpdatePayload = {
      clientId,
      proxy: proxy || '',
      dailyLimit,
      minDelay,
      maxDelay,
    };
    if (password) {
      payload.password = password;
    }
    if (refreshToken) {
      payload.refreshToken = refreshToken;
    }

    await api.put(`/api/email/accounts/${id}`, payload);
    ElMessage.success('更新账号成功！');
    isEditDialogVisible.value = false;
    await fetchAccounts();
    if (selectedAccountId.value === id) {
      await fetchMessages();
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '更新账号失败'));
  } finally {
    isAccountsLoading.value = false;
  }
};

// Batch Import Submission
const handleBatchImport = async () => {
  if (!importForm.value.text.trim()) {
    ElMessage.warning(t('tools.email.import_warning_empty'));
    return;
  }

  isAccountsLoading.value = true;
  try {
    const res = await api.post('/api/email/accounts/import', {
      importData: importForm.value.text,
      proxy: importForm.value.proxy || undefined,
      minDelay: importForm.value.minDelay,
      maxDelay: importForm.value.maxDelay,
      dailyLimit: importForm.value.dailyLimit,
    });

    ElMessage.success(res.data.message);
    isImportDialogVisible.value = false;
    importForm.value = {
      text: '',
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
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('tools.email.import_failed')));
  } finally {
    isAccountsLoading.value = false;
  }
};

// Add Single Account Submission
const handleAddSingle = async () => {
  const { email, password, clientId, refreshToken } = singleAccountForm.value;
  if (!email || !clientId || !refreshToken) {
    ElMessage.warning(t('tools.email.add_warning_empty'));
    return;
  }
  if (!validateEmail(email)) {
    ElMessage.warning('请输入有效的微软账号邮箱地址');
    return;
  }

  const rawLine = `${email}----${password || ''}----${clientId}----${refreshToken}`;
  isAccountsLoading.value = true;
  try {
    await api.post('/api/email/accounts/import', {
      importData: rawLine,
      proxy: singleAccountForm.value.proxy || undefined,
      minDelay: singleAccountForm.value.minDelay,
      maxDelay: singleAccountForm.value.maxDelay,
      dailyLimit: singleAccountForm.value.dailyLimit,
    });

    ElMessage.success(t('tools.email.add_success'));
    isAddDialogVisible.value = false;
    // reset form
    singleAccountForm.value = {
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
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('tools.email.add_failed')));
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
      logError(e, { operation: 'markMessageRead', view: 'EmailSystemView' });
    }
  }
};

const toggleMessageReadStatus = async () => {
  const msg = selectedMessage.value;
  if (!msg) return;
  const targetState = !msg.isRead;
  try {
    await api.patch(`/api/email/accounts/${selectedAccountId.value}/messages/${msg.id}`, {
      isRead: targetState,
    });
    msg.isRead = targetState;
    ElMessage.success(
      targetState
        ? t('tools.email.mark_read_status', { status: t('tools.email.folders.inbox') })
        : t('tools.email.mark_read_status', { status: t('tools.email.folders.drafts') }),
    );
  } catch (e: unknown) {
    ElMessage.error(
      t('tools.email.operation_failed_msg', {
        error: getApiErrorMessage(e, t('tools.email.unknown_error')),
      }),
    );
  }
};

const deleteMessage = async () => {
  const msg = selectedMessage.value;
  if (!msg) return;
  try {
    await ElMessageBox.confirm(
      t('tools.email.delete_confirm_text'),
      t('tools.email.delete_confirm_title'),
      {
        confirmButtonText: t('tools.email.delete_confirm_btn'),
        cancelButtonText: t('tools.email.cancel_btn'),
        type: 'warning',
      },
    );

    await api.delete(`/api/email/accounts/${selectedAccountId.value}/messages/${msg.id}`);
    ElMessage.success(t('tools.email.delete_success'));
    messages.value = messages.value.filter((m) => m.id !== msg.id);
    if (selectedMessage.value?.id === msg.id) {
      selectedMessage.value = null;
    }
  } catch {
    // cancelled
  }
};

const handleBatchTest = async () => {
  if (selectedAccountIds.value.length === 0) {
    ElMessage.warning(t('tools.email.batch_test_warning'));
    return;
  }
  isBatchTesting.value = true;
  let successCount = 0;
  let failCount = 0;

  ElMessage.info(t('tools.email.batch_test_start', { count: selectedAccountIds.value.length }));

  const promises = selectedAccountIds.value.map(async (id) => {
    try {
      await api.post(`/api/email/accounts/${id}/test`);
      successCount++;
    } catch {
      failCount++;
    }
  });

  await Promise.all(promises);
  ElMessage.success(
    t('tools.email.batch_test_complete', { success: successCount, fail: failCount }),
  );
  isMultiSelectMode.value = false;
  await fetchAccounts();
  isBatchTesting.value = false;
};

const handleBatchDelete = async () => {
  if (selectedAccountIds.value.length === 0) {
    ElMessage.warning(t('tools.email.batch_unbind_warning'));
    return;
  }
  try {
    await ElMessageBox.confirm(
      t('tools.email.batch_unbind_confirm_text', { count: selectedAccountIds.value.length }),
      t('tools.email.batch_unbind_confirm_title'),
      {
        confirmButtonText: t('tools.email.batch_unbind_confirm_btn'),
        cancelButtonText: t('tools.email.cancel_btn'),
        type: 'warning',
      },
    );

    isBatchDeleting.value = true;
    let deletedCount = 0;

    const promises = selectedAccountIds.value.map(async (id) => {
      try {
        await api.delete(`/api/email/accounts/${id}`);
        deletedCount++;
      } catch (e) {
        logError(e, { operation: 'deleteEmailAccount', accountId: id, view: 'EmailSystemView' });
      }
    });

    await Promise.all(promises);
    ElMessage.success(t('tools.email.batch_unbind_complete', { count: deletedCount }));

    if (selectedAccountId.value && selectedAccountIds.value.includes(selectedAccountId.value)) {
      selectedAccountId.value = '';
    }

    isMultiSelectMode.value = false;
    await fetchAccounts();
  } catch {
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
    ElMessage.warning(t('tools.email.compose_warning_empty'));
    return;
  }

  isSending.value = true;
  currentSendingAccount.value = '';
  sendingStatusText.value = t('tools.email.sending_status_channel');

  try {
    const res = await api.post('/api/email/send', {
      accountId,
      to,
      subject,
      content,
    });

    ElNotification({
      title: t('tools.email.send_success_title'),
      message: t('tools.email.send_success_msg', { sender: res.data.sender }),
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
  } catch (e: unknown) {
    ElMessageBox.alert(
      getApiErrorMessage(e, '邮件发送异常，请检查账号限制及代理配置'),
      '邮件发送失败',
      {
        confirmButtonText: t('tools.email.understand_btn'),
        type: 'error',
      },
    );
  } finally {
    isSending.value = false;
  }
};

const closeCompose = () => {
  isComposeMode.value = false;
};
</script>

<template>
  <div
    class="email-system mobile-adaptive flex h-full w-full overflow-hidden bg-transparent dark:bg-transparent text-slate-700 dark:text-slate-200"
  >
    <!-- LEFT COLUMN: Accounts, Folders & Controls -->
    <EmailSidebar
      :accounts="accounts"
      :selected-account-id="selectedAccountId"
      :current-folder="currentFolder"
      :is-accounts-loading="isAccountsLoading"
      :is-multi-select-mode="isMultiSelectMode"
      :selected-account-ids="selectedAccountIds"
      :is-batch-testing="isBatchTesting"
      :is-batch-deleting="isBatchDeleting"
      @refresh="fetchAccounts"
      @open-import="isImportDialogVisible = true"
      @open-add="isAddDialogVisible = true"
      @toggle-multi-select="toggleMultiSelect"
      @toggle-select-all="toggleSelectAll"
      @toggle-select-account="toggleSelectAccount"
      @batch-test="handleBatchTest"
      @batch-delete="handleBatchDelete"
      @select-account="selectAccount"
      @change-folder="changeFolder"
      @test-connection="testConnection"
      @edit-account="startEditAccount"
      @delete-account="deleteAccount"
      @copy-email="copyToClipboard"
    />

    <!-- CENTER COLUMN: Mail Headers List -->
    <EmailMessageList
      v-model:search-query="searchQuery"
      :messages="messages"
      :selected-message="selectedMessage"
      :selected-account-id="selectedAccountId"
      :current-folder="currentFolder"
      :is-messages-loading="isMessagesLoading"
      @refresh="fetchMessages"
      @compose="triggerCompose"
      @view-message="viewMessage"
    />

    <!-- RIGHT COLUMN: Mail Detail Viewer or Mail Send Composer -->
    <main class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900/40 flex flex-col h-full relative">
      <EmailEmptyState v-if="!selectedMessage && !isComposeMode" />

      <EmailMessageDetail
        v-else-if="selectedMessage && !isComposeMode"
        :message="selectedMessage"
        @toggle-read="toggleMessageReadStatus"
        @delete="deleteMessage"
      />

      <EmailComposer
        v-else-if="isComposeMode"
        v-model="composeForm"
        :accounts="accounts"
        :is-sending="isSending"
        :sending-status-text="sendingStatusText"
        @send="handleSendEmail"
        @cancel="closeCompose"
      />
    </main>

    <!-- BATCH IMPORT DIALOG -->
    <EmailImportDialog
      v-model="importForm"
      :show="isImportDialogVisible"
      :is-loading="isAccountsLoading"
      @close="isImportDialogVisible = false"
      @submit="handleBatchImport"
    />

    <!-- ADD SINGLE ACCOUNT DIALOG -->
    <EmailFormDialog
      v-model="singleAccountForm"
      :show="isAddDialogVisible"
      :is-edit="false"
      :is-loading="isAccountsLoading"
      @close="isAddDialogVisible = false"
      @submit="handleAddSingle"
    />

    <!-- EDIT ACCOUNT DIALOG -->
    <EmailFormDialog
      v-model="editingAccountForm"
      :show="isEditDialogVisible"
      :is-edit="true"
      :is-loading="isAccountsLoading"
      @close="isEditDialogVisible = false"
      @submit="handleSaveEdit"
    />
  </div>
</template>

<style scoped>
.email-system {
  height: calc(100vh - 3.5rem); /* offset MainLayout topbar height */
  background: transparent !important;
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

@media (max-width: 767px) {
  .email-system {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
  }

  .email-system > aside,
  .email-system > section,
  .email-system > main {
    width: 100% !important;
    min-width: 0;
    flex: none;
    border-right: 0;
  }

  .email-system > aside {
    max-height: none;
  }

  .email-system > section {
    min-height: 22rem;
    border-top: 1px solid var(--border-base);
    border-bottom: 1px solid var(--border-base);
  }

  .email-system > main {
    min-height: 28rem;
    padding-bottom: 4rem;
  }

  .email-system button {
    min-width: 2.25rem;
    min-height: 2.25rem;
  }

  .email-system input {
    min-height: 2.5rem;
  }
}
</style>

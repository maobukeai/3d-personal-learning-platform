<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { generateTOTP } from '@/utils/totp';
import TwoFactorFormDialog from './components/TwoFactorFormDialog.vue';
import TwoFactorQrDialog from './components/TwoFactorQrDialog.vue';
import TwoFactorSecurityDialog from './components/TwoFactorSecurityDialog.vue';
import TwoFactorHeader from './components/TwoFactorHeader.vue';
import TwoFactorToolbar from './components/TwoFactorToolbar.vue';
import TwoFactorCategoryTabs from './components/TwoFactorCategoryTabs.vue';
import TwoFactorAccountGrid from './components/TwoFactorAccountGrid.vue';
import TwoFactorAccountList from './components/TwoFactorAccountList.vue';
import TwoFactorCategoryManager from './components/TwoFactorCategoryManager.vue';
import TwoFactorSkeleton from './components/TwoFactorSkeleton.vue';
import TwoFactorEmptyState from './components/TwoFactorEmptyState.vue';
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
const isFormDialogVisible = ref<boolean>(false);
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
  (localStorage.getItem('2fa_layout_mode') as 'list' | 'grid' | null) === 'list' ? 'list' : 'grid',
);

watch(layoutMode, (newMode) => {
  localStorage.setItem('2fa_layout_mode', newMode);
});

// Copy feedback states
const copiedStates = ref<Record<string, boolean>>({});

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
  isFormDialogVisible.value = true;
}

function openAddDialog() {
  selectedEditAccount.value = null;
  isFormDialogVisible.value = true;
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
  } catch {
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

// Clock Drift Checker
const clockSyncStatus = computed(() => {
  if (clockDrift.value === null)
    return { text: '未检测', color: 'text-slate-400', status: 'unknown' as const };
  const absDrift = Math.abs(clockDrift.value);
  if (absDrift < 1500)
    return { text: '时间同步: 良好', color: 'text-emerald-400', status: 'perfect' as const };
  if (absDrift < 3000)
    return {
      text: `时间微偏 (${(absDrift / 1000).toFixed(1)}秒)`,
      color: 'text-amber-400',
      status: 'warning' as const,
    };
  return {
    text: `时间漂移 (${(absDrift / 1000).toFixed(1)}秒)`,
    color: 'text-rose-400',
    status: 'critical' as const,
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
    logError(e, { operation: 'syncTime', view: 'TwoFactorView' });
    clockDrift.value = null;
  }
}

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
  } catch {
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
    class="two-fa-container mobile-adaptive min-h-screen p-4 sm:p-6"
    style="background-color: var(--bg-app); color: var(--text-primary)"
  >
    <!-- Unified Compact Header -->
    <TwoFactorHeader
      v-model:search-query="searchQuery"
      :account-count="accounts.length"
      :category-count="allCategories.length"
      :last-backup-time="lastBackupTime"
      :clock-sync-status="clockSyncStatus"
      :filtered-count="filteredAccounts.length"
      :total-count="accounts.length"
      @open-security-center="openSecurityCenter"
      @add="openAddDialog"
    />

    <!-- Filters & Search Toolbar -->
    <TwoFactorToolbar
      v-model:sort-by="sortBy"
      v-model:layout-mode="layoutMode"
      v-model:is-privacy-mode="isPrivacyMode"
    />

    <!-- Droppable Category Tabs Filter Bar -->
    <TwoFactorCategoryTabs
      v-model:selected-category="selectedCategory"
      :accounts="accounts"
      :all-categories="allCategories"
      :pending-categories="pendingCategories"
      :uncategorized-count="uncategorizedCount"
      :drag-over-category="dragOverCategory"
      @manage="isCategoryManagerVisible = true"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    />

    <!-- Loader -->
    <TwoFactorSkeleton v-if="isLoading" />

    <!-- Empty view -->
    <TwoFactorEmptyState v-else-if="filteredAccounts.length === 0" />

    <!-- Main Content Layouts -->
    <div v-else class="animate-fade-in">
      <!-- 1. Grid View (Compact Cards) -->
      <TwoFactorAccountGrid
        v-if="layoutMode === 'grid'"
        :accounts="filteredAccounts"
        :live-codes="liveCodes"
        :pinned-account-ids="pinnedAccountIds"
        :revealed-secrets="revealedSecrets"
        :copied-states="copiedStates"
        :is-privacy-mode="isPrivacyMode"
        :search-query="searchQuery"
        @pin="togglePin"
        @qr="showQrCode"
        @edit="openEditDialog"
        @delete="deleteAccount"
        @copy-code="copyCode"
        @copy-secret="(secret, id) => copyToClipboard(secret, id, '密钥已复制')"
        @toggle-secret="toggleSecret"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
      />

      <!-- 2. Column List View -->
      <TwoFactorAccountList
        v-else
        :accounts="filteredAccounts"
        :live-codes="liveCodes"
        :pinned-account-ids="pinnedAccountIds"
        :revealed-secrets="revealedSecrets"
        :is-privacy-mode="isPrivacyMode"
        :search-query="searchQuery"
        @pin="togglePin"
        @qr="showQrCode"
        @edit="openEditDialog"
        @delete="deleteAccount"
        @copy-code="copyCode"
        @copy-secret="(secret, id) => copyToClipboard(secret, id, '密钥已复制')"
        @toggle-secret="toggleSecret"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
      />
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
    <TwoFactorCategoryManager
      v-model="isCategoryManagerVisible"
      v-model:new-category-name="newCategoryName"
      :all-categories="allCategories"
      :pending-categories="pendingCategories"
      :accounts="accounts"
      @create="createCategory"
      @rename="renameCategory"
      @delete="deleteCategory"
    />

    <!-- Modal Dialog: Add/Edit 2FA Account -->
    <TwoFactorFormDialog
      v-model="isFormDialogVisible"
      :account="selectedEditAccount"
      :all-categories="allCategories"
      @saved="fetchAccounts"
    />

    <!-- Modal Dialog: Mobile QR Code Scanner View -->
    <TwoFactorQrDialog v-model="isQrDialogVisible" :account="qrCodeAccount" />
  </div>
</template>

<style>
.acc-card {
  content-visibility: auto;
  contain-intrinsic-size: auto 180px;
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

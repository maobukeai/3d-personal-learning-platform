<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download, FileJson, KeyRound, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import {
  deleteAccount,
  exportAccountData,
  type AccountDataExport,
} from '@/services/account.service';
import { getApiErrorMessage } from '@/utils/error';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const authStore = useAuthStore();

const deleteAccountConfirm = ref('');
const deletePassword = ref('');
const delete2FACode = ref('');
const isDeletingAccount = ref(false);
const isExporting = ref(false);
const lastExport = ref<AccountDataExport | null>(null);

const requires2FA = computed(() => !!authStore.user?.twoFactorEnabled);

const canDelete = computed(() => {
  if (deleteAccountConfirm.value !== 'DELETE') return false;
  if (requires2FA.value) return delete2FACode.value.length === 6;
  return deletePassword.value.length > 0;
});

const formatExportCount = (key: string) => {
  if (!lastExport.value) return '-';
  const total = lastExport.value.counts?.[key] || 0;
  const exported = lastExport.value.exportedCounts?.[key] ?? total;
  return exported === total ? String(total) : `${exported}/${total}`;
};

const hasTruncatedExport = computed(() =>
  Object.values(lastExport.value?.truncated || {}).some(Boolean),
);

const exportSummary = computed(() => {
  if (!lastExport.value) {
    return [
      { label: '个人资料', value: '-' },
      { label: '团队空间', value: '-' },
      { label: '内容资产', value: '-' },
      { label: '作品展示', value: '-' },
    ];
  }
  return [
    { label: '个人资料', value: '1' },
    { label: '团队空间', value: formatExportCount('teams') },
    { label: '内容资产', value: formatExportCount('assets') },
    { label: '作品展示', value: formatExportCount('showcases') },
  ];
});

const downloadJson = (payload: AccountDataExport) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `account-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const exportData = async () => {
  try {
    isExporting.value = true;
    const data = await exportAccountData();
    lastExport.value = data;
    downloadJson(data);
    ElMessage.success('账号数据已导出');
  } catch {
    ElMessage.error('账号数据导出失败');
  } finally {
    isExporting.value = false;
  }
};

const handleDeleteAccount = async () => {
  if (!canDelete.value) {
    ElMessage.warning(
      requires2FA.value ? '请输入 DELETE 和 6 位 2FA 验证码' : '请输入 DELETE 和当前密码',
    );
    return;
  }

  try {
    await ElMessageBox.confirm(
      '账号注销后，个人资料、作品、团队关系和协作记录将被永久删除。此操作不可恢复。',
      '确认永久注销账号',
      {
        confirmButtonText: '永久注销',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );

    isDeletingAccount.value = true;
    await deleteAccount(
      requires2FA.value
        ? { twoFactorCode: delete2FACode.value }
        : { password: deletePassword.value },
    );
    ElMessage.success('账号已注销');
    await authStore.logout();
    router.push('/login');
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '注销账号失败'));
    }
  } finally {
    isDeletingAccount.value = false;
  }
};
</script>

<template>
  <div class="data-section">
    <section class="data-overview">
      <div>
        <p class="section-kicker">数据与风险</p>
        <h3>导出可追溯，注销需校验</h3>
        <span>账号级数据操作走后端接口，并保留明确的确认流程。</span>
      </div>
      <Button
        variant="primary"
        :disabled="isExporting"
        :loading="isExporting"
        :icon="Download"
        @click="exportData"
      >
        导出账号数据
      </Button>
    </section>

    <section class="export-panel">
      <div class="panel-title">
        <span>最近导出摘要</span>
        <FileJson />
      </div>
      <div class="export-grid">
        <article v-for="item in exportSummary" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      </div>
      <p>
        导出文件包含个人资料、通知偏好、外观设置、团队关系以及你的主要内容记录。敏感凭据不会出现在导出文件中。
      </p>
      <p v-if="hasTruncatedExport" class="export-warning">
        部分内容数量较多，本次每类最多导出 {{ lastExport?.exportLimits?.perCollection || 200 }} 条。
      </p>
    </section>

    <section class="danger-panel">
      <div class="danger-heading">
        <div>
          <ShieldAlert />
          <span>
            <strong>危险区域</strong>
            <small>永久删除账号和相关数据</small>
          </span>
        </div>
        <em>{{ requires2FA ? '2FA 校验' : '密码校验' }}</em>
      </div>

      <div class="danger-body">
        <div class="warning-copy">
          <Trash2 />
          <p>
            注销会删除你的登录账号、个人资料、作品、讨论、笔记、通知和团队成员关系。团队或项目中的协作数据会按后端关联规则处理。
          </p>
        </div>

        <div class="delete-form">
          <Input
            v-model="deleteAccountConfirm"
            type="text"
            label="确认短语"
            placeholder="输入 DELETE"
          />

          <Input
            v-if="requires2FA"
            v-model="delete2FACode"
            type="text"
            label="2FA 验证码"
            maxlength="6"
            inputmode="numeric"
            placeholder="000000"
            :icon="ShieldCheck"
          />

          <Input
            v-else
            v-model="deletePassword"
            type="password"
            label="当前密码"
            autocomplete="current-password"
            placeholder="输入当前登录密码"
            :icon="KeyRound"
          />

          <Button
            variant="danger"
            :disabled="!canDelete || isDeletingAccount"
            :loading="isDeletingAccount"
            :icon="Trash2"
            @click="handleDeleteAccount"
          >
            永久注销账号
          </Button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.data-section {
  display: grid;
  gap: 12px;
}

.data-overview,
.export-panel,
.danger-panel {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.data-overview {
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
}

.section-kicker,
.data-overview span,
.panel-title,
.export-grid span,
.export-panel p,
.danger-heading small,
.delete-form span {
  color: var(--text-muted);
  font-size: 12px;
}

.section-kicker,
.panel-title,
.delete-form span {
  font-size: 11px;
  font-weight: 900;
}

h3 {
  margin: 2px 0 4px;
  font-size: 20px;
  font-weight: 900;
}

.primary-action,
.danger-action {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 0 12px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
}

.primary-action {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.primary-action:disabled,
.danger-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

button svg,
.panel-title svg {
  width: 15px;
  height: 15px;
}

.export-panel,
.danger-panel {
  padding: 12px;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.export-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.export-grid article {
  min-height: 62px;
  display: grid;
  gap: 4px;
  border-radius: 8px;
  padding: 10px;
  background: var(--bg-app);
}

.export-grid strong {
  font-size: 20px;
  font-weight: 900;
}

.export-panel p {
  margin: 10px 0 0;
  line-height: 1.6;
}

.export-panel .export-warning {
  color: #b45309;
  font-weight: 800;
}

.danger-panel {
  border-color: rgba(239, 68, 68, 0.35);
}

.danger-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.danger-heading > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.danger-heading svg {
  width: 20px;
  height: 20px;
  color: #dc2626;
}

.danger-heading span {
  display: grid;
  gap: 2px;
}

.danger-heading strong {
  color: #dc2626;
  font-size: 14px;
  font-weight: 900;
}

.danger-heading em {
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.danger-body {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(280px, 1.1fr);
  gap: 12px;
}

.warning-copy {
  display: grid;
  align-content: start;
  gap: 10px;
  border-radius: 8px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #991b1b;
}

.warning-copy svg {
  width: 20px;
  height: 20px;
}

.warning-copy p {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
}

.delete-form {
  display: grid;
  gap: 10px;
}

.delete-form label {
  display: grid;
  gap: 7px;
}

.input-shell {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.input-shell,
.delete-form input {
  min-height: 40px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.input-shell input {
  min-height: auto;
  border: 0;
  border-radius: 0;
}

.input-shell svg {
  width: 15px;
  height: 15px;
  margin-left: 10px;
  color: var(--text-muted);
}

.delete-form input {
  width: 100%;
  min-width: 0;
  padding: 0 11px;
  outline: 0;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.danger-action {
  justify-content: center;
  border: 1px solid #dc2626;
  background: #dc2626;
  color: #ffffff;
}

@media (max-width: 900px) {
  .data-overview,
  .danger-body {
    grid-template-columns: 1fr;
  }

  .data-overview {
    align-items: flex-start;
    flex-direction: column;
  }

  .export-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .export-grid {
    grid-template-columns: 1fr;
  }

  .primary-action {
    justify-content: center;
    width: 100%;
  }
}
</style>

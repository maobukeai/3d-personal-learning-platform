<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { logError } from '@/utils/error';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import {
  Cloud,
  Database,
  RefreshCw,
  Play,
  CheckCircle2,
  Trash2,
  Settings,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { isAxiosError } from 'axios';
import {
  fetchBackupConfig,
  saveBackupConfig,
  testBackupConfig,
  runBackup,
  fetchBackupsList,
  restoreBackup,
  deleteBackup,
  type RemoteBackupFile,
} from '@/services/backup.service';
import { useLabel } from '@/utils/i18n';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const authStore = useAuthStore();
const label = useLabel();

const getBackupErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    return error.response?.data?.error || error.message || fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
};

// State
const url = ref('');
const username = ref('');
const password = ref('');
const dir = ref('3d-learning-platform-backups');
const retentionDays = ref(15);
const hasSavedPassword = ref(false);

const isTesting = ref(false);
const isSaving = ref(false);
const isBackingUp = ref(false);
const isRestoring = ref(false);
const isDeleting = ref<Record<string, boolean>>({});
const isLoadingList = ref(false);

const backups = ref<RemoteBackupFile[]>([]);
const lastBackupTime = ref<string | null>(null);
const lastBackupFile = ref<string | null>(null);
const lastRestoreTime = ref<string | null>(null);
const lastRestoreFile = ref<string | null>(null);

// Dialog State for selective restore
const showRestoreDialog = ref(false);
const selectedRestoreFile = ref('');
const restoreOptions = ref({
  notes: true,
  microsoftEmail: true,
  googleWarming: true,
  twoFactor: true,
  storageConfig: true,
  emailService: true,
  aiAssistant: true,
  controlCenter: true,
});

// Categories list for backup checklist
const backupSelection = ref({
  notes: true,
  microsoftEmail: true,
  googleWarming: true,
  twoFactor: true,
  storageConfig: false,
  emailService: false,
  aiAssistant: false,
  controlCenter: false,
});

const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

// Load settings and backups
const loadData = async () => {
  try {
    isLoadingList.value = true;
    const config = await fetchBackupConfig();
    url.value = config.url || '';
    username.value = config.username || '';
    dir.value = config.dir || '3d-learning-platform-backups';
    retentionDays.value = config.retentionDays || 15;
    hasSavedPassword.value = config.hasPassword || false;
    password.value = ''; // Keep password field empty unless typing new one

    // Load backup files list
    await refreshBackupsList();
  } catch (error) {
    ElMessage.error(
      label('加载备份配置失败: ', 'Failed to load backup config: ') +
        getBackupErrorMessage(error, ''),
    );
  } finally {
    isLoadingList.value = false;
  }
};

const refreshBackupsList = async () => {
  try {
    isLoadingList.value = true;
    const res = await fetchBackupsList();
    backups.value = res.backups || [];

    if (res.lastBackup) {
      const [time, file] = res.lastBackup.split('|');
      lastBackupTime.value = time || null;
      lastBackupFile.value = file || null;
    } else {
      lastBackupTime.value = null;
      lastBackupFile.value = null;
    }

    if (res.lastRestore) {
      const [time, file] = res.lastRestore.split('|');
      lastRestoreTime.value = time || null;
      lastRestoreFile.value = file || null;
    } else {
      lastRestoreTime.value = null;
      lastRestoreFile.value = null;
    }
  } catch (error) {
    // If not configured, it returns empty list silently, but if configured and fails, show error
    if (url.value) {
      logError(error, { operation: 'Failed to load remote backups list' });
    }
  } finally {
    isLoadingList.value = false;
  }
};

onMounted(loadData);

// Save configuration only
const handleSaveConfig = async () => {
  try {
    isSaving.value = true;
    await saveBackupConfig({
      url: url.value,
      username: username.value,
      password: password.value,
      dir: dir.value,
      retentionDays: retentionDays.value,
    });
    hasSavedPassword.value = hasSavedPassword.value || !!password.value;
    password.value = '';
    ElMessage.success(label('同步配置已保存', 'Sync configuration saved'));
    await refreshBackupsList();
  } catch (error) {
    ElMessage.error(
      label('保存配置失败: ', 'Failed to save config: ') + getBackupErrorMessage(error, ''),
    );
  } finally {
    isSaving.value = false;
  }
};

// Test WebDAV connection
const handleTestConfig = async () => {
  if (!url.value || !username.value) {
    ElMessage.warning(label('请填写服务地址和账号', 'Please enter service URL and account'));
    return;
  }

  try {
    isTesting.value = true;
    await testBackupConfig({
      url: url.value,
      username: username.value,
      password: password.value,
      dir: dir.value,
    });
    ElMessage.success(label('WebDAV 服务连接测试成功！', 'WebDAV connection test successful!'));

    // Automatically save config if test passes
    await handleSaveConfig();
  } catch (error) {
    ElMessage.error(
      label('连接测试失败: ', 'Connection test failed: ') + getBackupErrorMessage(error, ''),
    );
  } finally {
    isTesting.value = false;
  }
};

// Run manual backup
const handleRunBackup = async () => {
  const selectedCategories = Object.keys(backupSelection.value).filter(
    (key) => backupSelection.value[key as keyof typeof backupSelection.value],
  );

  // If not admin, filter out admin categories just in case
  const finalCategories = isAdmin.value
    ? selectedCategories
    : selectedCategories.filter((cat) =>
        ['notes', 'microsoftEmail', 'googleWarming', 'twoFactor'].includes(cat),
      );

  if (finalCategories.length === 0) {
    ElMessage.warning(
      label('请至少选择一个备份分类', 'Please select at least one backup category'),
    );
    return;
  }

  try {
    isBackingUp.value = true;
    await runBackup(finalCategories);
    ElMessage.success(label('备份打包并上传成功！', 'Backup packaged and uploaded successfully!'));
    await refreshBackupsList();
  } catch (error) {
    ElMessage.error(label('备份失败: ', 'Backup failed: ') + getBackupErrorMessage(error, ''));
  } finally {
    isBackingUp.value = false;
  }
};

// Open selective restore wizard
const openRestoreDialog = (filename: string) => {
  selectedRestoreFile.value = filename;

  // Set default checkboxes based on filename if possible (if full backup or custom)
  const isFull = filename.includes('_full_');
  restoreOptions.value = {
    notes: true,
    microsoftEmail: true,
    googleWarming: true,
    twoFactor: true,
    storageConfig: isAdmin.value && isFull,
    emailService: isAdmin.value && isFull,
    aiAssistant: isAdmin.value && isFull,
    controlCenter: isAdmin.value && isFull,
  };

  showRestoreDialog.value = true;
};

// Perform restore
const handleRestore = async () => {
  const selectedRestoreCategories = Object.keys(restoreOptions.value).filter(
    (key) => restoreOptions.value[key as keyof typeof restoreOptions.value],
  );

  const finalRestoreCategories = isAdmin.value
    ? selectedRestoreCategories
    : selectedRestoreCategories.filter((cat) =>
        ['notes', 'microsoftEmail', 'googleWarming', 'twoFactor'].includes(cat),
      );

  if (finalRestoreCategories.length === 0) {
    ElMessage.warning(
      label('请选择要恢复的模块数据', 'Please select at least one module to restore'),
    );
    return;
  }

  try {
    await ElMessageBox.confirm(
      label(
        '恢复备份将会用备份中的数据覆盖或合并当前系统对应的模块记录。此操作不可撤销，确定恢复吗？',
        'Restoring a backup will overwrite or merge data in the selected modules. This action cannot be undone. Are you sure?',
      ),
      label('确认还原备份数据', 'Confirm Restore'),
      {
        confirmButtonText: label('确认恢复', 'Restore'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    isRestoring.value = true;
    showRestoreDialog.value = false;

    await restoreBackup(selectedRestoreFile.value, finalRestoreCategories);

    ElMessage.success(label('备份数据已成功恢复！', 'Backup data successfully restored!'));
    await refreshBackupsList();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(
        label('恢复备份失败: ', 'Failed to restore backup: ') + getBackupErrorMessage(error, ''),
      );
    }
  } finally {
    isRestoring.value = false;
  }
};

// Delete a backup
const handleDeleteBackup = async (filename: string) => {
  try {
    await ElMessageBox.confirm(
      label(
        '确定要永久从 WebDAV 云端删除该备份文件吗？',
        'Are you sure you want to permanently delete this backup from WebDAV?',
      ),
      label('删除备份文件', 'Delete Backup'),
      {
        confirmButtonText: label('确定删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        confirmButtonClass: 'el-button--danger',
        type: 'error',
      },
    );

    isDeleting.value[filename] = true;
    await deleteBackup(filename);
    ElMessage.success(label('备份已从云端删除', 'Backup deleted from cloud'));
    await refreshBackupsList();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(label('删除失败: ', 'Failed to delete: ') + getBackupErrorMessage(error, ''));
    }
  } finally {
    isDeleting.value[filename] = false;
  }
};

// Helpers
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};
</script>

<template>
  <div class="backup-section mobile-adaptive">
    <!-- WebDAV Sync Configuration Card -->
    <section class="settings-card glass-panel">
      <div class="card-header">
        <div class="header-title">
          <Cloud class="text-blue" />
          <span>{{ label('WebDAV 同步配置', 'WebDAV Sync Config') }}</span>
        </div>
        <p class="header-desc">
          {{
            label(
              '配置坚果云、Nextcloud 等第三方 WebDAV 存储以实现跨平台备份与独立还原。',
              'Configure third-party WebDAV (e.g. Jianguoyun, Nextcloud) to sync backups and restore independently.',
            )
          }}
        </p>
      </div>

      <div class="form-grid">
        <div class="form-item span-full">
          <Input
            v-model="url"
            type="text"
            :label="label('服务地址', 'Service URL')"
            placeholder="https://dav.jianguoyun.com/dav/"
            :disabled="isSaving || isTesting"
          />
          <span class="input-tip">
            {{
              label(
                '坚果云默认地址：https://dav.jianguoyun.com/dav/',
                'Jianguoyun default URL: https://dav.jianguoyun.com/dav/',
              )
            }}
          </span>
        </div>

        <div class="form-item">
          <Input
            v-model="username"
            type="text"
            :label="label('账号', 'Account')"
            placeholder="example@qq.com"
            :disabled="isSaving || isTesting"
          />
          <span class="input-tip">{{
            label('第三方云盘绑定的登录邮箱账号。', 'Log in account email of your WebDAV service.')
          }}</span>
        </div>

        <div class="form-item">
          <Input
            v-model="password"
            type="password"
            :label="label('应用密码', 'App Password')"
            :placeholder="
              hasSavedPassword
                ? label('已保存，留空保持不变', 'Saved, leave blank to keep unchanged')
                : label('输入应用密码', 'Enter application password')
            "
            :disabled="isSaving || isTesting"
          />
          <span class="input-tip">{{
            label(
              '在网盘后台“第三方应用管理”中生成的独立应用密码。',
              'Specific application password generated in your cloud disk settings.',
            )
          }}</span>
        </div>

        <div class="form-item">
          <Input
            v-model="dir"
            type="text"
            :label="label('远端目录', 'Remote Directory')"
            placeholder="cockpit-tools"
            :disabled="isSaving || isTesting"
          />
          <span class="input-tip">{{
            label(
              '在 WebDAV 中管理备份文件的子文件夹目录。',
              'Subdirectory folder to manage backup files in WebDAV.',
            )
          }}</span>
        </div>

        <div class="form-item">
          <Input
            v-model="retentionDays"
            type="number"
            :min="1"
            :max="365"
            :label="label('云端保留天数', 'Cloud Retention Days')"
            placeholder="15"
            :disabled="isSaving || isTesting"
          />
          <span class="input-tip">{{
            label(
              '云端超过天数的备份会在下次同步时自动清理。',
              'Backups older than this number of days will be auto-cleaned on next sync.',
            )
          }}</span>
        </div>
      </div>

      <div class="sync-status">
        <p class="status-info">
          <strong>{{ label('同步状态：', 'Sync Status: ') }}</strong>
          <span>
            {{
              label(
                '远端恢复需要手动选择，不会静默覆盖本地数据。',
                'Remote restoration requires manual selection and does not silently overwrite data.',
              )
            }}
          </span>
        </p>
        <p v-if="lastBackupTime" class="status-details">
          {{ label('最近上传：', 'Last Upload: ') }} {{ formatDate(lastBackupTime) }} &middot;
          <code class="filename">{{ lastBackupFile }}</code>
        </p>
        <p v-if="lastRestoreTime" class="status-details text-blue">
          {{ label('最近恢复：', 'Last Restore: ') }} {{ formatDate(lastRestoreTime) }} &middot;
          <code class="filename">{{ lastRestoreFile }}</code>
        </p>
        <p v-if="!lastBackupTime && !lastRestoreTime" class="status-details">
          {{ label('最近同步：尚未同步', 'Last Sync: Not synced yet') }}
        </p>
      </div>

      <div class="actions-bar mobile-row">
        <Button
          variant="secondary"
          :loading="isTesting"
          :disabled="isSaving || isBackingUp"
          @click="handleTestConfig"
        >
          <RefreshCw class="btn-icon" :class="{ spinning: isTesting }" />
          {{ label('测试/保存配置', 'Test & Save Config') }}
        </Button>
        <Button
          variant="secondary"
          :loading="isSaving"
          :disabled="isTesting || isBackingUp"
          @click="handleSaveConfig"
        >
          <Settings class="btn-icon" />
          {{ label('同步配置', 'Sync Config') }}
        </Button>
      </div>
    </section>

    <!-- Fine-grained Backup Options -->
    <section class="settings-card glass-panel">
      <div class="card-header">
        <div class="header-title">
          <Database class="text-blue" />
          <span>{{ label('精细化数据打包', 'Fine-grained Backup') }}</span>
        </div>
        <p class="header-desc">
          {{
            label(
              '选择要立即备份的数据项，系统会自动将其打包成加密的 ZIP 压缩包并上传。',
              'Select data components to back up, and the system will zip and upload them directly.',
            )
          }}
        </p>
      </div>

      <div class="checkbox-group">
        <div class="category-block">
          <h4 class="category-title">{{ label('个人数据备份', 'Personal Data Backups') }}</h4>
          <div class="checkbox-grid">
            <label class="checkbox-item">
              <input v-model="backupSelection.notes" type="checkbox" />
              <div class="checkbox-label">
                <strong>{{ label('个人笔记备份', 'Notes Backup') }}</strong>
                <span>{{
                  label(
                    '备份您的创作笔记、评论、点赞与分享记录。',
                    'Back up user notes, comments, likes, and shares.',
                  )
                }}</span>
              </div>
            </label>

            <label class="checkbox-item">
              <input v-model="backupSelection.microsoftEmail" type="checkbox" />
              <div class="checkbox-label">
                <strong>{{ label('微软邮箱备份', 'Microsoft Emails') }}</strong>
                <span>{{
                  label(
                    '备份配置的微软邮箱账户、代理与发信限制。',
                    'Back up Outlook integration account settings & sending limits.',
                  )
                }}</span>
              </div>
            </label>

            <label class="checkbox-item">
              <input v-model="backupSelection.googleWarming" type="checkbox" />
              <div class="checkbox-label">
                <strong>{{ label('谷歌养号备份', 'Google Warming Accounts') }}</strong>
                <span>{{
                  label(
                    '备份用于养号的谷歌账户、辅助密码及状态。',
                    'Back up Google account details, passwords, and warming states.',
                  )
                }}</span>
              </div>
            </label>

            <label class="checkbox-item">
              <input v-model="backupSelection.twoFactor" type="checkbox" />
              <div class="checkbox-label">
                <strong>{{ label('2FA 验证备份', '2FA Accounts') }}</strong>
                <span>{{
                  label(
                    '备份绑定的双重身份验证（2FA）应用账户密钥。',
                    'Back up Google/GitHub Two-Factor authentication accounts.',
                  )
                }}</span>
              </div>
            </label>
          </div>
        </div>

        <div v-if="isAdmin" class="category-block border-top">
          <h4 class="category-title text-amber">
            {{ label('系统级配置备份 (管理员)', 'System Configuration Backups (Admin)') }}
          </h4>
          <div class="checkbox-grid">
            <label class="checkbox-item">
              <input v-model="backupSelection.storageConfig" type="checkbox" />
              <div class="checkbox-label">
                <strong>{{ label('云端存储配置备份', 'Cloud Storage Configurations') }}</strong>
                <span>{{
                  label(
                    '备份 S3、Cloudflare R2 等多端云存储配置信息。',
                    'Back up Cloudflare R2 / S3 storage configuration records.',
                  )
                }}</span>
              </div>
            </label>

            <label class="checkbox-item">
              <input v-model="backupSelection.emailService" type="checkbox" />
              <div class="checkbox-label">
                <strong>{{ label('邮箱服务备份', 'Email Service Settings') }}</strong>
                <span>{{
                  label(
                    '备份系统全局邮件 SMTP 网关与发信模板参数。',
                    'Back up SMTP servers and email verification body setups.',
                  )
                }}</span>
              </div>
            </label>

            <label class="checkbox-item">
              <input v-model="backupSelection.aiAssistant" type="checkbox" />
              <div class="checkbox-label">
                <strong>{{ label('AI 智能辅助备份', 'AI Assistant Settings') }}</strong>
                <span>{{
                  label(
                    '备份 AI 助理通道、API Key 与智能机器人知识库。',
                    'Back up AI models, API keys, and chatbot integrations.',
                  )
                }}</span>
              </div>
            </label>

            <label class="checkbox-item">
              <input v-model="backupSelection.controlCenter" type="checkbox" />
              <div class="checkbox-label">
                <strong>{{ label('系统控制中心备份', 'System Control Center') }}</strong>
                <span>{{
                  label(
                    '备份系统注册规则、外观配置及扩展等其他设置。',
                    'Back up platform options, branding URLs, and other settings.',
                  )
                }}</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="actions-bar mobile-row">
        <Button
          variant="primary"
          :loading="isBackingUp"
          :disabled="isSaving || isTesting"
          @click="handleRunBackup"
        >
          <Play class="btn-icon" />
          {{ label('生成并上传备份', 'Generate & Upload Backup') }}
        </Button>
      </div>
    </section>

    <!-- Remote Backups List -->
    <section class="settings-card glass-panel">
      <div class="card-header list-header mobile-row">
        <div>
          <div class="header-title">
            <Cloud class="text-blue" />
            <span>{{ label('远端备份历史', 'Remote Backups') }}</span>
          </div>
          <p class="header-desc">
            {{
              label(
                '显示匹配系统命名格式的远端备份文件，支持按模块精细化恢复。',
                'Displays remote backup files from WebDAV. Click Restore for selective recovery.',
              )
            }}
          </p>
        </div>
        <Button variant="secondary" size="sm" :disabled="isLoadingList" @click="refreshBackupsList">
          <RefreshCw class="btn-icon" :class="{ spinning: isLoadingList }" />
          {{ label('刷新列表', 'Refresh') }}
        </Button>
      </div>

      <div class="backups-list-container">
        <div v-if="backups.length === 0" class="empty-list">
          <HelpCircle />
          <p>
            {{
              label(
                '未检测到云端备份文件，请先“生成并上传备份”',
                'No remote backups found. Please configure WebDAV and run a backup.',
              )
            }}
          </p>
        </div>

        <div class="table-wrapper mobile-table">
          <table class="backups-table">
            <thead>
              <tr>
                <th>{{ label('备份文件名称', 'Filename') }}</th>
                <th>{{ label('备份大小', 'Size') }}</th>
                <th>{{ label('生成时间', 'Creation Date') }}</th>
                <th class="actions-column">{{ label('操作', 'Actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in backups" :key="file.name">
                <td class="file-cell">
                  <code class="filename">{{ file.name }}</code>
                </td>
                <td>{{ formatBytes(file.size) }}</td>
                <td>{{ formatDate(file.lastModified) }}</td>
                <td class="actions-cell mobile-row">
                  <Button
                    variant="primary"
                    size="sm"
                    :disabled="isRestoring || isBackingUp"
                    @click="openRestoreDialog(file.name)"
                  >
                    <RotateCcw class="btn-icon-sm" />
                    {{ label('恢复', 'Restore') }}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    :loading="isDeleting[file.name]"
                    :disabled="isRestoring || isBackingUp"
                    @click="handleDeleteBackup(file.name)"
                  >
                    <Trash2 class="btn-icon-sm" />
                    {{ label('删除', 'Delete') }}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Dialog for Selective Restore -->
    <div v-if="showRestoreDialog" class="modal-overlay">
      <div class="modal-card glass-panel animate-zoom">
        <div class="modal-header">
          <div class="header-title">
            <RotateCcw class="text-blue" />
            <span>{{ label('精细化数据恢复向导', 'Selective Restore Wizard') }}</span>
          </div>
          <button class="close-btn" @click="showRestoreDialog = false">&times;</button>
        </div>

        <div class="modal-body">
          <p class="modal-desc">
            {{ label('您正在从备份文件还原：', 'You are restoring from:') }}
            <br />
            <code class="filename highlight">{{ selectedRestoreFile }}</code>
          </p>

          <div class="alert-box warning-alert">
            <AlertTriangle />
            <p>
              {{
                label(
                  '重要提示：数据还原操作会将选中的模块内容与当前系统记录覆盖或合并。对于敏感凭据（如密码/Key），还原时将重新使用本地密钥加密存储。',
                  'Important: Restoration will replace or merge selected module records. Credentials will be re-encrypted using the current server key.',
                )
              }}
            </p>
          </div>

          <div class="category-block">
            <h4 class="category-title">
              {{ label('请选择要恢复的模块数据：', 'Select modules to restore:') }}
            </h4>
            <div class="checkbox-grid compact">
              <label class="checkbox-item">
                <input v-model="restoreOptions.notes" type="checkbox" />
                <div class="checkbox-label">
                  <strong>{{ label('恢复个人笔记', 'Restore Notes') }}</strong>
                </div>
              </label>

              <label class="checkbox-item">
                <input v-model="restoreOptions.microsoftEmail" type="checkbox" />
                <div class="checkbox-label">
                  <strong>{{ label('恢复微软邮箱', 'Restore Microsoft Emails') }}</strong>
                </div>
              </label>

              <label class="checkbox-item">
                <input v-model="restoreOptions.googleWarming" type="checkbox" />
                <div class="checkbox-label">
                  <strong>{{ label('恢复谷歌养号', 'Restore Google Warming') }}</strong>
                </div>
              </label>

              <label class="checkbox-item">
                <input v-model="restoreOptions.twoFactor" type="checkbox" />
                <div class="checkbox-label">
                  <strong>{{ label('恢复 2FA 验证', 'Restore 2FA Accounts') }}</strong>
                </div>
              </label>

              <label v-if="isAdmin" class="checkbox-item">
                <input v-model="restoreOptions.storageConfig" type="checkbox" />
                <div class="checkbox-label">
                  <strong class="text-amber">{{
                    label('恢复云端存储配置', 'Restore Storage Configurations')
                  }}</strong>
                </div>
              </label>

              <label v-if="isAdmin" class="checkbox-item">
                <input v-model="restoreOptions.emailService" type="checkbox" />
                <div class="checkbox-label">
                  <strong class="text-amber">{{
                    label('恢复邮箱服务配置', 'Restore Email Service')
                  }}</strong>
                </div>
              </label>

              <label v-if="isAdmin" class="checkbox-item">
                <input v-model="restoreOptions.aiAssistant" type="checkbox" />
                <div class="checkbox-label">
                  <strong class="text-amber">{{
                    label('恢复 AI 智能辅助', 'Restore AI Settings')
                  }}</strong>
                </div>
              </label>

              <label v-if="isAdmin" class="checkbox-item">
                <input v-model="restoreOptions.controlCenter" type="checkbox" />
                <div class="checkbox-label">
                  <strong class="text-amber">{{
                    label('恢复系统控制中心', 'Restore Control Center')
                  }}</strong>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="modal-footer mobile-row">
          <Button variant="secondary" @click="showRestoreDialog = false">
            {{ label('取消', 'Cancel') }}
          </Button>
          <Button variant="primary" :loading="isRestoring" @click="handleRestore">
            <CheckCircle2 class="btn-icon" />
            {{ label('立即恢复数据', 'Restore Selected Data') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backup-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.glass-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  box-shadow: var(--shadow-enterprise);
}

.settings-card {
  padding: 16px;
}

.card-header {
  margin-bottom: 14px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.header-title svg {
  width: 20px;
  height: 20px;
}

.header-desc {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.45;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.span-full {
  grid-column: span 2;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-tip {
  font-size: 11px;
  color: var(--text-muted);
}

.sync-status {
  background: rgba(var(--accent-rgb, 59, 130, 246), 0.05);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.status-info {
  margin: 0 0 6px 0;
  font-size: 12.5px;
  line-height: 1.45;
}

.status-details {
  margin: 4px 0;
  font-size: 11.5px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.filename {
  background: var(--bg-app);
  color: var(--text-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  border: 1px solid var(--border-base);
}

.actions-bar {
  display: flex;
  gap: 10px;
}

.btn-icon {
  width: 15px;
  height: 15px;
  margin-right: 5px;
}

.btn-icon-sm {
  width: 13px;
  height: 13px;
  margin-right: 4px;
}

/* .spinning provided globally by src/styles/layout.css */

/* Checklist CSS */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.category-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.border-top {
  border-top: 1px solid var(--border-base);
  padding-top: 14px;
}

.category-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.checkbox-grid.compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.checkbox-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: rgba(var(--bg-app-rgb), 0.3);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.checkbox-item:hover {
  background: rgba(var(--accent-rgb, 59, 130, 246), 0.05);
  border-color: var(--accent, #3b82f6);
}

.checkbox-item input[type='checkbox'] {
  width: 15px;
  height: 15px;
  margin-top: 2px;
  cursor: pointer;
}

.checkbox-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkbox-label strong {
  font-size: 12.5px;
  color: var(--text-primary);
}

.checkbox-label span {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.35;
}

/* Remote Backups List CSS */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.backups-list-container {
  min-height: 80px;
}

.empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  border: 1px dashed var(--border-base);
  border-radius: 8px;
}

.empty-list svg {
  width: 28px;
  height: 28px;
  margin-bottom: 10px;
}

.empty-list p {
  margin: 0;
  font-size: 12.5px;
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.backups-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 12.5px;
}

.backups-table th,
.backups-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-base);
}

.backups-table th {
  background: rgba(var(--bg-app-rgb), 0.5);
  font-weight: 700;
  color: var(--text-muted);
}

.backups-table tbody tr:last-child td {
  border-bottom: 0;
}

.backups-table tbody tr:hover td {
  background: rgba(var(--bg-app-rgb), 0.2);
}

.file-cell {
  max-width: 300px;
}

.actions-column {
  width: 180px;
  text-align: right;
}

.actions-cell {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.settings-card :deep(button > span),
.actions-bar :deep(button > span),
.actions-cell :deep(button > span),
.enterprise-page :deep(button > span) {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

/* Modal dialog CSS */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  width: 100%;
  max-width: 600px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn {
  background: none;
  border: 0;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-desc {
  margin: 0;
  font-size: 13px;
}

.highlight {
  font-weight: 700;
  color: var(--accent, #3b82f6);
  background: rgba(var(--accent-rgb, 59, 130, 246), 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
  margin-top: 4px;
}

.alert-box {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.warning-alert {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #b45309;
}

.warning-alert svg {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

.warning-alert p {
  margin: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border-base);
  padding-top: 16px;
}

/* Animations */
.animate-zoom {
  animation: zoomIn 0.25s ease-out;
}

@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* @keyframes spin provided globally by src/styles/layout.css */

.text-blue {
  color: var(--accent, #3b82f6);
}

.text-amber {
  color: #d97706;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .span-full {
    grid-column: span 1;
  }
  .checkbox-grid,
  .checkbox-grid.compact {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .table-wrapper.mobile-table {
    overflow-x: hidden;
  }

  .mobile-table .backups-table {
    font-size: 10px;
  }

  .mobile-table .backups-table th,
  .mobile-table .backups-table td {
    padding: 4px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions-cell {
    gap: 4px;
  }

  .modal-card {
    max-width: calc(100vw - 16px);
    padding: 16px;
  }
}
</style>

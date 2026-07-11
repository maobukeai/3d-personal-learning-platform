<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import StorageHeader from './StorageHeader.vue';
import StorageStrategy from './StorageStrategy.vue';
import StorageConfigList from './StorageConfigList.vue';
import StorageConfigDialog from './StorageConfigDialog.vue';
import StorageFileExplorer from './StorageFileExplorer.vue';
import type {
  StorageConfig,
  AdminSetting,
  StorageConfigForm,
  AssetTypeOption,
} from './StorageSettingsTab.types';

const { t } = useI18n();

// ─── State ────────────────────────────────────────────────────────────────────

const configs = ref<StorageConfig[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const submitting = ref(false);
const testingConnection = ref(false);

const fileDrawerVisible = ref(false);
const currentStorage = ref<StorageConfig | null>(null);

const syncingAll = ref(false);

const forceR2Storage = ref(true);
const loadingForceR2 = ref(false);

const isCleaning = ref(false);

const importFileInput = ref<HTMLInputElement | null>(null);

// ─── Form ─────────────────────────────────────────────────────────────────────

const initialForm: StorageConfigForm = {
  id: '',
  name: '',
  provider: 'CLOUDFLARE_R2',
  endpoint: '',
  accessKeyId: '',
  secretAccessKey: '',
  cloudflareApiToken: '',
  remark: '',
  bucketName: '',
  publicUrl: '',
  limitGb: 9.8,
  usedBytes: 0,
  assetType: 'ALL',
  priority: 0,
  status: 'ACTIVE',
};

const form = ref<StorageConfigForm>({ ...initialForm });
const isEdit = ref(false);

const assetTypes: AssetTypeOption[] = [
  { label: '全部文件 (ALL)', value: 'ALL' },
  { label: '3D模型 (ASSET)', value: 'ASSET' },
  { label: '材质贴图 (MATERIAL)', value: 'MATERIAL' },
  { label: '工具插件 (PLUGIN)', value: 'PLUGIN' },
  { label: '案例展示 (SHOWCASE)', value: 'SHOWCASE' },
  { label: '镜像同步资源 (MIRROR)', value: 'MIRROR' },
  { label: '临时网盘 (TEMPORARY_NETDISK)', value: 'TEMPORARY_NETDISK' },
];

// ─── Config CRUD ──────────────────────────────────────────────────────────────

const fetchConfigs = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/api/admin/storage-configs');
    configs.value = (data as StorageConfig[]).map((item) => ({ ...item, isMasked: true }));
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '获取云存储配置失败'));
  } finally {
    loading.value = false;
  }
};

const openAddDialog = () => {
  form.value = { ...initialForm };
  isEdit.value = false;
  dialogVisible.value = true;
};

const openEditDialog = (config: StorageConfig) => {
  form.value = {
    ...config,
    secretAccessKey: '',
    cloudflareApiToken: '',
    remark: config.remark || '',
  };
  isEdit.value = true;
  dialogVisible.value = true;
};

const openFileDrawer = (config: StorageConfig) => {
  currentStorage.value = config;
  fileDrawerVisible.value = true;
};

const toggleConfigMask = (config: StorageConfig) => {
  config.isMasked = !config.isMasked;
};

const testConnection = async () => {
  if (
    !form.value.endpoint ||
    !form.value.accessKeyId ||
    !form.value.secretAccessKey ||
    !form.value.bucketName ||
    !form.value.publicUrl
  ) {
    ElMessage.warning('请填写完整的连接参数以进行测试');
    return;
  }

  testingConnection.value = true;
  try {
    const { data } = await api.post('/api/admin/storage-configs/test', {
      endpoint: form.value.endpoint,
      accessKeyId: form.value.accessKeyId,
      secretAccessKey: form.value.secretAccessKey,
      bucketName: form.value.bucketName,
      publicUrl: form.value.publicUrl,
    });

    if (data.success) {
      ElMessage.success('连接测试成功！');
    } else {
      ElMessage.error(data.error || '连接测试失败');
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '连接测试失败，请检查参数'));
  } finally {
    testingConnection.value = false;
  }
};

const submitForm = async () => {
  if (
    !form.value.name ||
    !form.value.endpoint ||
    !form.value.accessKeyId ||
    !form.value.bucketName ||
    !form.value.publicUrl ||
    (!isEdit.value && !form.value.secretAccessKey)
  ) {
    ElMessage.warning('请填写所有必填字段');
    return;
  }

  submitting.value = true;
  try {
    if (isEdit.value) {
      const payload: Record<string, unknown> = { ...form.value };
      if (!form.value.secretAccessKey) delete payload.secretAccessKey;
      if (!form.value.cloudflareApiToken) delete payload.cloudflareApiToken;
      await api.put(`/api/admin/storage-configs/${form.value.id}`, payload);
      ElMessage.success('存储配置更新成功');
    } else {
      await api.post('/api/admin/storage-configs', form.value);
      ElMessage.success('存储配置添加成功');
    }
    dialogVisible.value = false;
    fetchConfigs();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存存储配置失败'));
  } finally {
    submitting.value = false;
  }
};

const deleteConfig = async (config: StorageConfig) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除存储配置 "${config.name}" 吗？此操作将使关联的文件无法再上传到该空间。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );

    await api.delete(`/api/admin/storage-configs/${config.id}`);
    ElMessage.success('配置已成功删除');
    fetchConfigs();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除配置失败'));
    }
  }
};

const toggleStatus = async (config: StorageConfig) => {
  const nextStatus = config.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  try {
    await api.put(`/api/admin/storage-configs/${config.id}`, {
      status: nextStatus,
    });
    ElMessage.success(`配置状态已变更为: ${nextStatus === 'ACTIVE' ? '启用' : '禁用'}`);
    fetchConfigs();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '修改状态失败'));
  }
};

// ─── Sync All Sizes ───────────────────────────────────────────────────────────

const syncAllSizes = async () => {
  syncingAll.value = true;
  try {
    const { data } = await api.post('/api/admin/storage-configs/sync-all-sizes');
    const { synced, skipped, failed } = data;
    ElMessage.success(`同步完成：成功 ${synced} 个，跳过 ${skipped} 个，失败 ${failed} 个`);
    fetchConfigs();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '同步全部容量失败'));
  } finally {
    syncingAll.value = false;
  }
};

// ─── Force R2 Storage ─────────────────────────────────────────────────────────

const fetchForceR2Setting = async () => {
  try {
    const { data } = await api.get('/api/admin/settings');
    if (data) {
      if (Array.isArray(data)) {
        const item = (data as AdminSetting[]).find((s) => s.key === 'FORCE_R2_STORAGE');
        if (item) {
          forceR2Storage.value = item.value === 'true' || item.value === true;
        }
      } else {
        const val = data.FORCE_R2_STORAGE;
        if (val !== undefined) {
          forceR2Storage.value = val === 'true' || val === true;
        }
      }
    }
  } catch (error) {
    logError(error, { operation: 'fetchForceR2Setting', component: 'StorageSettingsTab' });
  }
};

const handleForceR2Change = async (val: boolean) => {
  loadingForceR2.value = true;
  try {
    await api.post('/api/admin/settings', {
      settings: {
        FORCE_R2_STORAGE: val,
      },
    });
    ElMessage.success(val ? '已开启强制云端存储策略' : '已关闭强制云端存储策略');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '更新存储策略失败'));
    forceR2Storage.value = !val;
  } finally {
    loadingForceR2.value = false;
  }
};

// ─── Cleanup Storage ──────────────────────────────────────────────────────────

const handleCleanupStorage = async () => {
  try {
    await ElMessageBox.confirm(
      t('admin.this_operation_will_scan'),
      t('admin.confirm_to_clear_storage'),
      {
        confirmButtonText: t('admin.clean_up_now'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );

    isCleaning.value = true;
    const { data } = await api.post('/api/admin/settings/cleanup-storage');
    const stats = data.stats || { scanned: 0, deleted: 0, errors: 0 };

    await ElMessageBox.alert(
      `<div class="space-y-2">
        <p class="text-sm font-bold text-emerald-600">${t('admin.storage_space_cleared_successfully')}</p>
        <div class="text-xs space-y-1 bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/10 font-mono">
          <p>${t('admin.number_of_scanned_files')} <span class="font-bold text-slate-800 dark:text-slate-200">${stats.scanned}</span></p>
          <p>${t('admin.number_of_files_to')} <span class="font-bold text-emerald-600">${stats.deleted}</span></p>
          <p>${t('admin.failed_or_skipped')} <span class="font-bold text-rose-500">${stats.errors}</span></p>
        </div>
        <p class="text-[10px] text-slate-400">${t('admin.local_disk_space_has')}</p>
      </div>`,
      t('admin.clean_results'),
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: t('admin.ok'),
        type: 'success',
      },
    );

    fetchConfigs();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '清理存储空间失败'));
    }
  } finally {
    isCleaning.value = false;
  }
};

// ─── Export / Import ──────────────────────────────────────────────────────────

const triggerImport = () => {
  importFileInput.value?.click();
};

const handleExport = async () => {
  try {
    const response = await api.get('/api/admin/storage-configs/export', {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'storage_configs_export.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    ElMessage.success('配置导出成功');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '导出配置失败'));
  }
};

const handleImportFile = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0]!;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result as string;
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        throw new Error('导入的配置文件格式不正确，应为 JSON 数组');
      }

      const { data } = await api.post('/api/admin/storage-configs/import', {
        configs: parsed,
      });

      ElMessage.success(data.message || '导入配置成功');
      fetchConfigs();
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : '导入配置失败，文件格式不合法');
    } finally {
      target.value = '';
    }
  };

  reader.onerror = () => {
    ElMessage.error('读取文件失败');
    target.value = '';
  };

  reader.readAsText(file);
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────

watch(fileDrawerVisible, (val) => {
  if (!val) {
    currentStorage.value = null;
  }
});

onMounted(() => {
  fetchConfigs();
  fetchForceR2Setting();
});
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <section
      class="p-3 sm:p-5 rounded-2xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <StorageHeader
        :syncing-all="syncingAll"
        :is-cleaning="isCleaning"
        @sync-all="syncAllSizes"
        @cleanup="handleCleanupStorage"
        @import="triggerImport"
        @export="handleExport"
        @add="openAddDialog"
      />

      <StorageStrategy
        v-model="forceR2Storage"
        :loading="loadingForceR2"
        @update:model-value="handleForceR2Change"
      />

      <!-- Warning Alert -->
      <div
        class="mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-600 dark:text-amber-400 flex items-start gap-2"
      >
        <AlertCircle class="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
        <div class="text-[10px] space-y-0.5">
          <p class="font-bold">存储分发与限额策略提示</p>
          <p class="opacity-95 leading-normal text-[10px]">
            1. 数据限额满后，系统将自动顺延写入下一个拥有剩余空间的活跃云端存储账号。<br />
            2. 若希望保存未分类的通用文件，请将云配置的应用类型设为 "全部文件 (ALL)"。
          </p>
        </div>
      </div>

      <StorageConfigList
        :configs="configs"
        :loading="loading"
        :asset-types="assetTypes"
        @edit="openEditDialog"
        @delete="deleteConfig"
        @toggle-status="toggleStatus"
        @open-explorer="openFileDrawer"
        @toggle-mask="toggleConfigMask"
      />

      <input
        ref="importFileInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleImportFile"
      />
    </section>

    <StorageConfigDialog
      v-model:visible="dialogVisible"
      v-model:form="form"
      :is-edit="isEdit"
      :asset-types="assetTypes"
      :submitting="submitting"
      :testing-connection="testingConnection"
      @submit="submitForm"
      @test-connection="testConnection"
    />

    <StorageFileExplorer
      v-if="fileDrawerVisible && currentStorage"
      v-model="fileDrawerVisible"
      :current-storage="currentStorage"
      @refresh="fetchConfigs"
    />
  </div>
</template>

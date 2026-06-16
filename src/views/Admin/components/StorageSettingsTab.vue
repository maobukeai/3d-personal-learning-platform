<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Cloud,
  Plus,
  Trash2,
  Edit2,
  Database,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Play,
  Check,
  Folder,
  FolderOpen,
  Search,
  Copy,
  Download,
  Upload as UploadIcon,
  FileText,
  Eye,
  EyeOff,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

const { t } = useI18n();

interface StorageConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  limitGb: number;
  usedBytes: number;
  assetType: string;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  isMasked?: boolean;
}

const configs = ref<StorageConfig[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const submitting = ref(false);
const testingConnection = ref(false);

// File Explorer state
const fileDrawerVisible = ref(false);
const currentStorage = ref<StorageConfig | null>(null);
const bucketFiles = ref<any[]>([]);
const loadingFiles = ref(false);
const fileSearchQuery = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const uploadingFile = ref(false);

const actualBytes = ref<number | null>(null);
const loadingActualSize = ref(false);
const syncingSize = ref(false);

const initialForm = {
  id: '',
  name: '',
  provider: 'CLOUDFLARE_R2',
  endpoint: '',
  accessKeyId: '',
  secretAccessKey: '',
  bucketName: '',
  publicUrl: '',
  limitGb: 9.8,
  usedBytes: 0,
  assetType: 'ALL',
  priority: 0,
  status: 'ACTIVE',
};

const form = ref({ ...initialForm });
const isEdit = ref(false);

// Resource types mapping for display
const assetTypes = [
  { label: '全部文件 (ALL)', value: 'ALL' },
  { label: '3D模型 (ASSET)', value: 'ASSET' },
  { label: '材质贴图 (MATERIAL)', value: 'MATERIAL' },
  { label: '工具插件 (PLUGIN)', value: 'PLUGIN' },
  { label: '案例展示 (SHOWCASE)', value: 'SHOWCASE' },
  { label: '镜像同步资源 (MIRROR)', value: 'MIRROR' },
];

const fetchConfigs = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/api/admin/storage-configs');
    configs.value = data.map((item: any) => ({ ...item, isMasked: true }));
  } catch (error) {
    console.error('Failed to fetch storage configs:', error);
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
  form.value = { ...config };
  isEdit.value = true;
  dialogVisible.value = true;
};

const testConnection = async () => {
  if (!form.value.endpoint || !form.value.accessKeyId || !form.value.secretAccessKey || !form.value.bucketName || !form.value.publicUrl) {
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
    console.error('Test connection error:', error);
    ElMessage.error(getApiErrorMessage(error, '连接测试失败，请检查参数'));
  } finally {
    testingConnection.value = false;
  }
};

const submitForm = async () => {
  if (!form.value.name || !form.value.endpoint || !form.value.accessKeyId || !form.value.secretAccessKey || !form.value.bucketName || !form.value.publicUrl) {
    ElMessage.warning('请填写所有必填字段');
    return;
  }

  submitting.value = true;
  try {
    if (isEdit.value) {
      await api.put(`/api/admin/storage-configs/${form.value.id}`, form.value);
      ElMessage.success('存储配置更新成功');
    } else {
      await api.post('/api/admin/storage-configs', form.value);
      ElMessage.success('存储配置添加成功');
    }
    dialogVisible.value = false;
    fetchConfigs();
  } catch (error) {
    console.error('Submit form error:', error);
    ElMessage.error(getApiErrorMessage(error, '保存存储配置失败'));
  } finally {
    submitting.value = false;
  }
};

const deleteConfig = async (id: string, name: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除存储配置 "${name}" 吗？此操作将使关联的文件无法再上传到该空间。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    );

    await api.delete(`/api/admin/storage-configs/${id}`);
    ElMessage.success('配置已成功删除');
    fetchConfigs();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete config error:', error);
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
    console.error('Toggle status error:', error);
    ElMessage.error(getApiErrorMessage(error, '修改状态失败'));
  }
};

// Size helper functions
const getLimitInBytes = (limitGb: number) => {
  return limitGb * 1024 * 1024 * 1024;
};

const formatBytes = (bytes: number, decimals = 3) => {
  if (bytes <= 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getUsagePercentage = (usedBytes: number, limitGb: number) => {
  if (usedBytes <= 0) return 0;
  const limitBytes = getLimitInBytes(limitGb);
  const percentage = (usedBytes / limitBytes) * 100;
  return Math.min(parseFloat(percentage.toFixed(3)), 100);
};

const getAssetTypeLabel = (value: string) => {
  const matched = assetTypes.find((t) => t.value === value);
  return matched ? matched.label.split(' ')[0] : value;
};

// File Explorer functions
const openFileDrawer = async (config: StorageConfig) => {
  currentStorage.value = config;
  actualBytes.value = null;
  fileDrawerVisible.value = true;
  currentPath.value = ''; // Reset folder path to root
  fetchActualSize();
  await fetchBucketFiles();
};

const fetchActualSize = async () => {
  if (!currentStorage.value) return;
  loadingActualSize.value = true;
  try {
    const { data } = await api.get(`/api/admin/storage-configs/${currentStorage.value.id}/actual-size`);
    actualBytes.value = data.actualSize;
  } catch (error) {
    console.error('Failed to fetch actual bucket size:', error);
    actualBytes.value = null;
  } finally {
    loadingActualSize.value = false;
  }
};

const syncSize = async () => {
  if (!currentStorage.value) return;
  syncingSize.value = true;
  try {
    const { data } = await api.post(`/api/admin/storage-configs/${currentStorage.value.id}/sync-size`);
    actualBytes.value = data.usedBytes;
    if (currentStorage.value) {
      currentStorage.value.usedBytes = data.usedBytes;
    }
    ElMessage.success('系统已用容量已与 Cloudflare R2 实际占用同步！');
    fetchConfigs();
  } catch (error) {
    console.error('Failed to sync size:', error);
    ElMessage.error(getApiErrorMessage(error, '同步容量失败'));
  } finally {
    syncingSize.value = false;
  }
};

const fetchBucketFiles = async () => {
  if (!currentStorage.value) return;
  loadingFiles.value = true;
  try {
    const { data } = await api.get(`/api/admin/storage-configs/${currentStorage.value.id}/files`);
    bucketFiles.value = data;
  } catch (error) {
    console.error('Failed to fetch bucket files:', error);
    ElMessage.error(getApiErrorMessage(error, '获取存储桶文件列表失败'));
  } finally {
    loadingFiles.value = false;
  }
};

const deleteFile = async (key: string) => {
  if (!currentStorage.value) return;
  try {
    await ElMessageBox.confirm(
      `确定要从存储桶中永久删除文件 "${key}" 吗？该操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    );

    await api.delete(`/api/admin/storage-configs/${currentStorage.value.id}/files`, {
      data: { key },
    });

    ElMessage.success('文件删除成功！');
    fetchBucketFiles();
    fetchConfigs(); // Refresh configuration capacity cards
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete file error:', error);
      ElMessage.error(getApiErrorMessage(error, '删除文件失败'));
    }
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  ElMessage.success('相对路径已复制到剪贴板');
};

const triggerFileInput = () => {
  if (fileInput.value) fileInput.value.click();
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || !currentStorage.value) return;

  uploadingFile.value = true;
  const formData = new FormData();
  formData.append('file', file);

  try {
    await api.post(`/api/admin/storage-configs/${currentStorage.value.id}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    ElMessage.success('文件直接上传成功！');
    fetchBucketFiles();
    fetchConfigs(); // Refresh configuration capacity cards
  } catch (error) {
    console.error('Upload file error:', error);
    ElMessage.error(getApiErrorMessage(error, '文件上传失败'));
  } finally {
    uploadingFile.value = false;
    if (target) target.value = ''; // Clear picker input
  }
};

const isImage = (key: string) => {
  const ext = key.split('.').pop()?.toLowerCase();
  return ext && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico'].includes(ext);
};

const currentPath = ref('');

const goBack = () => {
  const parts = currentPath.value.split('/').filter(Boolean);
  if (parts.length <= 1) {
    currentPath.value = '';
  } else {
    currentPath.value = parts.slice(0, -1).join('/') + '/';
  }
};

const navigateToBreadcrumb = (index: number) => {
  const parts = currentPath.value.split('/').filter(Boolean);
  const targetParts = parts.slice(0, index + 1);
  currentPath.value = targetParts.join('/') + '/';
};

interface ExplorerItem {
  type: 'file' | 'folder';
  name: string;
  key: string;
  size?: number;
  lastModified?: string;
  url?: string;
}

const explorerItems = computed<ExplorerItem[]>(() => {
  const itemsMap = new Map<string, ExplorerItem>();
  const prefix = currentPath.value;
  
  for (const file of bucketFiles.value) {
    const key = file.key;
    if (!key.startsWith(prefix)) continue;
    
    const relative = key.slice(prefix.length);
    if (!relative) continue;
    
    const parts = relative.split('/');
    if (parts.length > 1) {
      const folderName = parts[0];
      const folderKey = prefix + folderName + '/';
      if (!itemsMap.has(folderKey)) {
        itemsMap.set(folderKey, {
          type: 'folder',
          name: folderName,
          key: folderKey,
        });
      }
    } else {
      itemsMap.set(key, {
        type: 'file',
        name: parts[0],
        key: key,
        size: file.size,
        lastModified: file.lastModified,
        url: file.url,
      });
    }
  }
  
  return Array.from(itemsMap.values());
});

const filteredItems = computed(() => {
  const query = fileSearchQuery.value.toLowerCase().trim();
  if (query) {
    return bucketFiles.value
      .filter((f) => f.key.toLowerCase().includes(query))
      .map((f) => ({
        type: 'file' as const,
        name: f.key,
        key: f.key,
        size: f.size,
        lastModified: f.lastModified,
        url: f.url,
      }));
  }
  return explorerItems.value;
});

const isCleaning = ref(false);

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
      }
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
      }
    );
    
    // Refresh configurations list to update capacity usages
    fetchConfigs();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Cleanup storage error:', error);
      ElMessage.error(getApiErrorMessage(error, '清理存储空间失败'));
    }
  } finally {
    isCleaning.value = false;
  }
};

const forceR2Storage = ref(true);
const loadingForceR2 = ref(false);

const fetchForceR2Setting = async () => {
  try {
    const { data } = await api.get('/api/admin/settings');
    if (data) {
      if (Array.isArray(data)) {
        const item = data.find((s: any) => s.key === 'FORCE_R2_STORAGE');
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
    console.error('Failed to fetch force R2 setting:', error);
  }
};
const handleForceR2Change = async (val: string | number | boolean) => {
  const isForced = val === true || val === 'true';
  loadingForceR2.value = true;
  try {
    await api.post('/api/admin/settings', {
      settings: {
        FORCE_R2_STORAGE: isForced,
      },
    });
    ElMessage.success(isForced ? '已开启强制云端存储策略' : '已关闭强制云端存储策略');
  } catch (error) {
    console.error('Failed to update force R2 setting:', error);
    ElMessage.error(getApiErrorMessage(error, '更新存储策略失败'));
    forceR2Storage.value = !isForced;
  } finally {
    loadingForceR2.value = false;
  }
};

const importFileInput = ref<HTMLInputElement | null>(null);

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
    console.error('Failed to export configs:', error);
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
    } catch (err: any) {
      console.error('Failed to import configs:', err);
      ElMessage.error(err.message || '导入配置失败，文件格式不合法');
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
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div class="flex items-center gap-2.5">
          <Cloud class="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
          <div>
            <h2 class="text-base font-bold" style="color: var(--text-primary)">
              云存储管理 (Cloudflare R2)
            </h2>
            <p class="text-[9px] mt-0.5" style="color: var(--text-muted)">
              配置多个 Cloudflare R2 账号与存储桶，并按资源类型（材质、模型、插件）分配限额。点击卡片右下角的文件夹可管理文件。
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 w-fit">
          <button
            type="button"
            :disabled="isCleaning"
            class="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50"
            @click="handleCleanupStorage"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isCleaning }" />
            <span>{{ isCleaning ? '正在清理...' : '一键扫描与清理' }}</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
            @click="triggerImport"
          >
            <UploadIcon class="w-3 h-3" />
            <span>导入配置</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
            @click="handleExport"
          >
            <Download class="w-3 h-3" />
            <span>导出配置</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] transition-all shadow-sm shadow-indigo-600/10 cursor-pointer w-fit"
            @click="openAddDialog"
          >
            <Plus class="w-3 h-3" />
            <span>添加 R2 账号</span>
          </button>

          <input
            ref="importFileInput"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleImportFile"
          />
        </div>
      </div>
      <!-- Storage Strategy Control -->
      <div
        class="mb-4 p-4 rounded-xl border flex items-center justify-between transition-colors duration-300"
        style="background-color: var(--bg-hover); border-color: var(--border-base)"
      >
        <div class="flex items-center gap-3">
          <div class="p-2 bg-indigo-500/10 rounded-lg shrink-0">
            <Database class="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h3 class="text-xs font-bold" style="color: var(--text-primary)">
              强制全站云端存储 (Force Cloud Storage)
            </h3>
            <p class="text-[9px] mt-0.5" style="color: var(--text-muted)">
              启用后，全站所有资源数据默认储存至 Cloudflare R2 云端。若没有配置可用的云存储账号，用户上传文件时将提示“暂时维护中”并禁止上传。
            </p>
          </div>
        </div>
        <el-switch
          v-model="forceR2Storage"
          :loading="loadingForceR2"
          @change="handleForceR2Change"
          active-text="已开启"
          inactive-text="已关闭"
          inline-prompt
          style="--el-switch-on-color: var(--color-indigo-600)"
        />
      </div>

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

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
        <RefreshCw class="w-8 h-8 text-indigo-500 animate-spin" />
        <span class="text-xs" style="color: var(--text-muted)">正在加载存储配置...</span>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="configs.length === 0"
        class="flex flex-col items-center justify-center py-16 px-4 border border-dashed rounded-2xl text-center"
        style="border-color: var(--border-base)"
      >
        <Database class="w-10 h-10 text-slate-300 dark:text-white/10 mb-3" />
        <span class="text-xs font-bold" style="color: var(--text-secondary)">暂未配置云存储账号</span>
        <p class="text-[10px] mt-1 max-w-xs" style="color: var(--text-muted)">
          所有上传的资源文件目前将保存在服务器本地磁盘。强烈建议配置至少一个 Cloudflare R2 云端存储账号。
        </p>
      </div>

      <!-- Config Cards List -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="config in configs"
          :key="config.id"
          class="group p-3 rounded-lg border transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
          :class="[
            config.status === 'ACTIVE'
              ? 'hover:shadow-md hover:-translate-y-0.5'
              : 'opacity-70 grayscale',
          ]"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
          "
        >
          <!-- Progress highlight bar on top -->
          <div
            class="absolute top-0 left-0 h-0.5 transition-all duration-300"
            :class="[
              getUsagePercentage(config.usedBytes, config.limitGb) >= 95
                ? 'bg-rose-500 shadow-sm shadow-rose-500/20'
                : 'bg-indigo-500 shadow-sm shadow-indigo-500/20',
            ]"
            :style="{ width: getUsagePercentage(config.usedBytes, config.limitGb) + '%' }"
          ></div>

          <div>
            <!-- Header: Title and Type -->
            <div class="flex items-start justify-between mb-1.5">
              <div class="space-y-0.5 max-w-[70%]">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-xs truncate" style="color: var(--text-primary)" :title="config.name">{{ config.name }}</span>
                  <el-switch
                    :model-value="config.status === 'ACTIVE'"
                    size="small"
                    active-text="启用"
                    inactive-text="禁用"
                    inline-prompt
                    class="shrink-0"
                    style="--el-switch-on-color: #10b981; --el-switch-off-color: #94a3b8; transform: scale(0.85); transform-origin: left center;"
                    @change="toggleStatus(config)"
                  />
                </div>
                <div class="flex items-center gap-1 text-[9px] truncate" style="color: var(--text-muted)">
                  <Database class="w-2.5 h-2.5 shrink-0" />
                  <span class="truncate" :title="config.bucketName">桶: {{ config.bucketName }}</span>
                </div>
              </div>

              <span
                class="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0"
                style="background-color: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border-base)"
              >
                {{ getAssetTypeLabel(config.assetType) }}
              </span>
            </div>

            <!-- Endpoint Detail -->
            <div class="space-y-0.5 text-[9px] mb-1.5 font-mono p-1.5 rounded-md relative group/endpoint pr-6" style="background-color: var(--bg-card); color: var(--text-secondary)">
              <div class="truncate">
                终端: <span :class="{ 'blur-[3.5px] select-none pointer-events-none transition-all duration-300': config.isMasked !== false }">{{ config.endpoint }}</span>
              </div>
              <div class="truncate flex items-center gap-1">
                <span>域名: </span>
                <span :class="{ 'blur-[3.5px] select-none pointer-events-none transition-all duration-300': config.isMasked !== false }">{{ config.publicUrl }}</span>
                <a :href="config.publicUrl" target="_blank" class="hover:text-indigo-500 shrink-0">
                  <ExternalLink class="w-2 h-2 inline" />
                </a>
              </div>

              <!-- Mask Toggle Button -->
              <button
                type="button"
                class="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                :title="config.isMasked !== false ? '显示明文' : '马赛克隐藏'"
                @click="config.isMasked = !config.isMasked"
              >
                <EyeOff v-if="config.isMasked !== false" class="w-3 h-3" />
                <Eye v-else class="w-3 h-3" />
              </button>
            </div>

            <!-- Capacity Info -->
            <div class="space-y-0.5 mb-2">
              <div class="flex items-center justify-between text-[9px]">
                <span style="color: var(--text-muted)">容量配额使用率</span>
                <span class="font-bold font-mono" style="color: var(--text-primary)">
                  {{ getUsagePercentage(config.usedBytes, config.limitGb) }}%
                </span>
              </div>
              
              <!-- Custom designed CSS progress bar -->
              <div class="w-full h-1 rounded-full overflow-hidden" style="background-color: var(--bg-card)">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="[
                    getUsagePercentage(config.usedBytes, config.limitGb) >= 95
                      ? 'bg-gradient-to-r from-red-500 to-rose-600'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-600',
                  ]"
                  :style="{ width: getUsagePercentage(config.usedBytes, config.limitGb) + '%' }"
                ></div>
              </div>

              <!-- Numerical detail precise to decimals -->
              <div class="flex items-center justify-between text-[8px]" style="color: var(--text-muted)">
                <span>已用: {{ formatBytes(config.usedBytes) }}</span>
                <span>限制: {{ config.limitGb.toFixed(3) }} GB</span>
              </div>
            </div>
          </div>

          <!-- Bottom: Action Buttons -->
          <div class="flex items-center justify-between pt-1.5 border-t" style="border-color: var(--border-base)">
            <div class="text-[8px]" style="color: var(--text-muted)">
              优先级: <span class="font-bold text-slate-800 dark:text-slate-200">#{{ config.priority }}</span>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                title="浏览/管理文件"
                @click="openFileDrawer(config)"
              >
                <FolderOpen class="w-3 h-3" />
              </button>
              <button
                type="button"
                class="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                title="编辑配置"
                @click="openEditDialog(config)"
              >
                <Edit2 class="w-3 h-3" />
              </button>
              <button
                type="button"
                class="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                title="删除配置"
                @click="deleteConfig(config.id, config.name)"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Add/Edit Storage Config Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑云端存储配置' : '添加云端存储配置'"
      width="600px"
      destroy-on-close
      class="rounded-3xl"
    >
      <div class="space-y-5 py-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1 md:col-span-2">
            <label class="text-[11px] font-bold text-slate-500">配置别名 *</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="例如：材质仓 Cloudflare R2"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">应用类型 (资源分类路由) *</label>
            <select
              v-model="form.assetType"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs appearance-none cursor-pointer"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            >
              <option v-for="type in assetTypes" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">提供商</label>
            <select
              v-model="form.provider"
              disabled
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs opacity-60"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            >
              <option value="CLOUDFLARE_R2">Cloudflare R2</option>
            </select>
          </div>

          <div class="space-y-1 md:col-span-2">
            <label class="text-[11px] font-bold text-slate-500">终端节点 (Endpoint URL) *</label>
            <input
              v-model="form.endpoint"
              type="text"
              placeholder="https://<account_id>.r2.cloudflarestorage.com"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs font-mono"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">Access Key ID *</label>
            <input
              v-model="form.accessKeyId"
              type="text"
              placeholder="R2 存取密钥 ID"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs font-mono"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">Secret Access Key *</label>
            <input
              v-model="form.secretAccessKey"
              type="text"
              placeholder="R2 机密存取密钥"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs font-mono"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">存储桶名称 (Bucket Name) *</label>
            <input
              v-model="form.bucketName"
              type="text"
              placeholder="例如: materials-bucket"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">公共访问域名 (Public URL) *</label>
            <input
              v-model="form.publicUrl"
              type="text"
              placeholder="https://pub-xxxx.r2.dev 或自定义域名"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs font-mono"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">限额容量限制 (GB) *</label>
            <input
              v-model="form.limitGb"
              type="number"
              step="0.001"
              min="0.001"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
            <p class="text-[9px] text-slate-400">精确到小数点。写满该上限后将顺延分配到其他桶。</p>
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">已用存储大小 (Bytes) *</label>
            <input
              v-model="form.usedBytes"
              type="number"
              min="0"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
            <p class="text-[9px] text-slate-400">字节数大小，可在此手动重置或调校使用量。</p>
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-500">匹配优先级 (Priority)</label>
            <input
              v-model="form.priority"
              type="number"
              class="w-full px-3.5 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
            <p class="text-[9px] text-slate-400">数字越大越先写入（可设置正/负整数）。</p>
          </div>

          <div class="space-y-1 flex flex-col justify-end pb-3 pl-2">
            <div class="flex items-center gap-2 text-xs">
              <el-checkbox v-model="form.status" true-label="ACTIVE" false-label="INACTIVE">
                启用此云存储账号
              </el-checkbox>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center w-full">
          <button
            type="button"
            :disabled="testingConnection"
            class="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            @click="testConnection"
          >
            <RefreshCw v-if="testingConnection" class="w-3.5 h-3.5 animate-spin" />
            <Play v-else class="w-3.5 h-3.5" />
            <span>测试连接</span>
          </button>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-4 py-2 border rounded-xl font-bold text-xs transition-all cursor-pointer"
              style="border-color: var(--border-base); color: var(--text-secondary)"
              @click="dialogVisible = false"
            >
              取消
            </button>
            <button
              type="button"
              :disabled="submitting"
              class="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
              @click="submitForm"
            >
              <RefreshCw v-if="submitting" class="w-3.5 h-3.5 animate-spin" />
              <Check v-else class="w-3.5 h-3.5" />
              <span>保存配置</span>
            </button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- Cloudflare R2 Bucket File Explorer Drawer -->
    <el-drawer
      v-model="fileDrawerVisible"
      :title="`云存储资源浏览器: ${currentStorage?.name || ''}`"
      size="800px"
      destroy-on-close
    >
      <!-- Hidden file input for uploading files directly -->
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        @change="handleFileUpload"
      />

      <div class="space-y-6 h-full flex flex-col justify-between">
        <div class="space-y-4 shrink-0">
          <!-- Bucket Stats & Upload Header -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl" style="background-color: var(--bg-card)">
            <div class="text-xs flex flex-wrap items-center gap-x-2.5 gap-y-1.5" style="color: var(--text-secondary)">
              <span>桶名称: <strong style="color: var(--text-primary)">{{ currentStorage?.bucketName }}</strong></span>
              <span class="text-slate-300 dark:text-white/10">|</span>
              <span>限制大小: <strong style="color: var(--text-primary)">{{ currentStorage?.limitGb.toFixed(2) }} GB</strong></span>
              <span class="text-slate-300 dark:text-white/10">|</span>
              <span class="flex items-center gap-1">
                <span>当前容量使用:</span>
                <strong :class="[
                  getUsagePercentage(currentStorage?.usedBytes || 0, currentStorage?.limitGb || 9.8) >= 95
                    ? 'text-rose-500'
                    : 'text-indigo-500'
                ]">
                  {{ formatBytes(currentStorage?.usedBytes || 0) }} ({{ getUsagePercentage(currentStorage?.usedBytes || 0, currentStorage?.limitGb || 9.8) }}%)
                </strong>
              </span>
              <span class="text-slate-300 dark:text-white/10">|</span>
              <span class="flex items-center gap-1">
                <span>R2 云端实际占用:</span>
                <span v-if="loadingActualSize" class="text-slate-400">正在计算...</span>
                <strong v-else-if="actualBytes !== null" class="text-slate-800 dark:text-slate-200">
                  {{ formatBytes(actualBytes) }}
                </strong>
                <span v-else class="text-slate-400">获取失败</span>

                <button
                  v-if="actualBytes !== null && actualBytes !== currentStorage?.usedBytes && !loadingActualSize"
                  type="button"
                  :disabled="syncingSize"
                  class="ml-1 px-1.5 py-0.5 bg-indigo-50 dark:bg-white/5 hover:bg-indigo-100 dark:hover:bg-white/10 text-indigo-600 dark:text-indigo-400 disabled:opacity-50 text-[9px] rounded font-bold cursor-pointer inline-flex items-center gap-0.5"
                  title="将 Cloudflare R2 实际用量同步到系统中以校正限额"
                  @click="syncSize"
                >
                  <RefreshCw v-if="syncingSize" class="w-2.5 h-2.5 animate-spin" />
                  <span>同步至系统配置</span>
                </button>
              </span>
            </div>

            <button
              type="button"
              :disabled="uploadingFile"
              class="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
              @click="triggerFileInput"
            >
              <RefreshCw v-if="uploadingFile" class="w-3.5 h-3.5 animate-spin" />
              <UploadIcon v-else class="w-3.5 h-3.5" />
              <span>直接上传文件</span>
            </button>
          </div>

          <!-- Search filter bar -->
          <div class="relative w-full">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="fileSearchQuery"
              type="text"
              placeholder="按文件名或键路径筛选..."
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-xs"
              style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <!-- Breadcrumbs -->
          <div v-if="!fileSearchQuery.trim()" class="flex flex-wrap items-center gap-1.5 text-[11px] font-mono py-1.5 px-3 rounded-lg border" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-secondary)">
            <button 
              type="button" 
              class="hover:text-indigo-500 font-bold cursor-pointer" 
              @click="currentPath = ''"
            >
              Root
            </button>
            <template v-for="(part, index) in currentPath.split('/').filter(Boolean)" :key="index">
              <span class="text-slate-400 dark:text-white/20">/</span>
              <button 
                type="button" 
                class="hover:text-indigo-500 font-bold cursor-pointer" 
                @click="navigateToBreadcrumb(index)"
              >
                {{ part }}
              </button>
            </template>
          </div>
        </div>

        <!-- Scrollable Files List Table -->
        <div class="grow overflow-y-auto min-h-[300px] border rounded-2xl" style="border-color: var(--border-base)">
          <div v-if="loadingFiles" class="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw class="w-8 h-8 text-indigo-500 animate-spin" />
            <span class="text-xs" style="color: var(--text-muted)">正在读取云端桶数据...</span>
          </div>

          <div
            v-else-if="filteredItems.length === 0 && !currentPath"
            class="flex flex-col items-center justify-center py-20 px-4 text-center"
          >
            <Database class="w-8 h-8 text-slate-300 dark:text-white/10 mb-2" />
            <span class="text-xs font-bold" style="color: var(--text-secondary)">没有找到相关文件</span>
            <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
              该存储桶目前可能为空，或者没有匹配当前搜索词的文件。
            </p>
          </div>

          <table v-else class="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr class="border-b" style="border-color: var(--border-base); background-color: var(--bg-card); color: var(--text-secondary)">
                <th class="p-3 font-bold">文件路径 / 键 (Key)</th>
                <th class="p-3 font-bold w-20">文件大小</th>
                <th class="p-3 font-bold w-28">修改时间</th>
                <th class="p-3 font-bold w-24 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <!-- Go Back Row -->
              <tr
                v-if="currentPath && !fileSearchQuery.trim()"
                class="border-b hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                style="border-color: var(--border-base); color: var(--text-secondary)"
                @click="goBack"
              >
                <td colspan="4" class="p-3 font-mono">
                  <div class="flex items-center gap-2">
                    <FolderOpen class="w-4 h-4 text-indigo-400" />
                    <span class="font-bold">.. (返回上一级)</span>
                  </div>
                </td>
              </tr>

              <!-- Items List -->
              <tr
                v-for="item in filteredItems"
                :key="item.key"
                class="border-b hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                :class="{ 'cursor-pointer': item.type === 'folder' }"
                style="border-color: var(--border-base); color: var(--text-primary)"
                @click="item.type === 'folder' ? currentPath = item.key : null"
              >
                <!-- Key/Name and Icon -->
                <td class="p-3 font-mono break-all max-w-xs">
                  <div class="flex items-center gap-2">
                    <!-- Icon based on type -->
                    <div class="shrink-0">
                      <Folder v-if="item.type === 'folder'" class="w-4 h-4 text-amber-400 shrink-0" />
                      <div v-else-if="isImage(item.key)" class="w-6 h-6 rounded overflow-hidden border bg-slate-100 flex items-center justify-center shrink-0">
                        <img :src="item.url" class="object-cover w-full h-full" />
                      </div>
                      <FileText v-else class="w-4 h-4 text-indigo-400 shrink-0" />
                    </div>
                    
                    <span class="truncate font-bold" v-if="item.type === 'folder'" :title="item.name">{{ item.name }}/</span>
                    <span class="truncate" v-else :title="item.name">{{ item.name }}</span>
                    
                    <button
                      v-if="item.type === 'file'"
                      type="button"
                      class="text-slate-400 hover:text-indigo-500 cursor-pointer p-0.5 rounded transition-colors shrink-0"
                      title="复制资源相对路径"
                      @click.stop="copyToClipboard(item.key)"
                    >
                      <Copy class="w-3 h-3" />
                    </button>
                  </div>
                </td>

                <!-- Size -->
                <td class="p-3 font-mono whitespace-nowrap">
                  <span v-if="item.type === 'file'">{{ formatBytes(item.size || 0) }}</span>
                  <span v-else class="text-slate-400">-</span>
                </td>

                <!-- Last Modified -->
                <td class="p-3 whitespace-nowrap" style="color: var(--text-muted)">
                  <span v-if="item.type === 'file' && item.lastModified">
                    {{ new Date(item.lastModified).toLocaleString() }}
                  </span>
                  <span v-else class="text-slate-400">-</span>
                </td>

                <!-- Actions -->
                <td class="p-3 text-right whitespace-nowrap space-x-1.5" @click.stop>
                  <template v-if="item.type === 'file'">
                    <a
                      :href="item.url"
                      target="_blank"
                      class="inline-block p-1 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-500 rounded transition-colors cursor-pointer"
                      title="新窗口打开/下载"
                    >
                      <Download class="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      class="p-1 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                      title="永久物理删除"
                      @click="deleteFile(item.key)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="p-1 hover:bg-slate-100 dark:hover:bg-white/10 text-indigo-500 rounded transition-colors cursor-pointer text-[10px] font-bold"
                      @click="currentPath = item.key"
                    >
                      打开
                    </button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

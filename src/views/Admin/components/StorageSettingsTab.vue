<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
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
  Pencil,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import {
  formatBinaryBytes,
  formatCloudflareBytes,
  getUsagePercentage,
  isOfficialCloudflareUsage,
} from '@/utils/storageBytes';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Switch from '@/components/ui/Switch.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Badge from '@/components/ui/Badge.vue';
import Skeleton from '@/components/ui/Skeleton.vue';

const { t } = useI18n();

// ─── Types ────────────────────────────────────────────────────────────────────

interface StorageConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  cloudflareApiToken?: string;
  remark?: string;
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

interface ExplorerItem {
  type: 'file' | 'folder';
  name: string;
  key: string;
  size?: number;
  lastModified?: string;
  url?: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

const configs = ref<StorageConfig[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const submitting = ref(false);
const testingConnection = ref(false);

// File Explorer state
const fileDrawerVisible = ref(false);
const currentStorage = ref<StorageConfig | null>(null);
const fileItems = ref<ExplorerItem[]>([]);
const currentPath = ref('');
const loadingFiles = ref(false);
const fileSearchQuery = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const uploadingFile = ref(false);

// Pagination
const folderHasMore = ref(false);
const folderContinuationToken = ref<string | undefined>(undefined);
const loadingMoreFiles = ref(false);
const searchTruncated = ref(false);

// Actual size
const actualBytes = ref<number | null>(null);
const actualUsageSource = ref<'cloudflare-graphql' | 'cloudflare-usage-api' | 'list-objects' | null>(null);
const actualUsageWarning = ref<string | null>(null);
const actualObjectCount = ref<number | null>(null);
const loadingActualSize = ref(false);
const syncingSize = ref(false);

// Sync all
const syncingAll = ref(false);

// Bulk delete
const selectedFileKeys = ref<string[]>([]);
const deletingSelected = ref(false);

// Rename dialog
const renameDialogVisible = ref(false);
const renameTarget = ref<ExplorerItem | null>(null);
const renameNewName = ref('');
const renamingFile = ref(false);

// Force R2 storage
const forceR2Storage = ref(true);
const loadingForceR2 = ref(false);

// Cleanup
const isCleaning = ref(false);

// Import/Export
const importFileInput = ref<HTMLInputElement | null>(null);

// ─── Form ─────────────────────────────────────────────────────────────────────

const initialForm = {
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

const form = ref({ ...initialForm });
const isEdit = ref(false);

const assetTypes = [
  { label: '全部文件 (ALL)', value: 'ALL' },
  { label: '3D模型 (ASSET)', value: 'ASSET' },
  { label: '材质贴图 (MATERIAL)', value: 'MATERIAL' },
  { label: '工具插件 (PLUGIN)', value: 'PLUGIN' },
  { label: '案例展示 (SHOWCASE)', value: 'SHOWCASE' },
  { label: '镜像同步资源 (MIRROR)', value: 'MIRROR' },
];

// ─── Config CRUD ──────────────────────────────────────────────────────────────

const fetchConfigs = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/api/admin/storage-configs');
    configs.value = data.map((item: any) => ({ ...item, isMasked: true }));
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
    cloudflareApiToken: config.cloudflareApiToken || '',
    remark: config.remark || '',
  };
  isEdit.value = true;
  dialogVisible.value = true;
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
    !form.value.secretAccessKey ||
    !form.value.bucketName ||
    !form.value.publicUrl
  ) {
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
      },
    );

    await api.delete(`/api/admin/storage-configs/${id}`);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getAssetTypeLabel = (value: string) => {
  const matched = assetTypes.find((t) => t.value === value);
  return matched ? matched.label.split(' ')[0] : value;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('已复制到剪贴板');
  } catch {
    ElMessage.error('复制失败，请手动复制');
  }
};

const copyFileUrl = async (url?: string) => {
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success('公开 URL 已复制');
  } catch {
    ElMessage.error('复制失败，请手动复制');
  }
};

const isImage = (key: string) => {
  const ext = key.split('.').pop()?.toLowerCase();
  return ext && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico'].includes(ext);
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
    } catch (err: any) {
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

// ─── File Explorer ────────────────────────────────────────────────────────────

const openFileDrawer = async (config: StorageConfig) => {
  currentStorage.value = config;
  actualBytes.value = null;
  actualUsageSource.value = null;
  actualUsageWarning.value = null;
  actualObjectCount.value = null;
  selectedFileKeys.value = [];
  fileSearchQuery.value = '';
  fileDrawerVisible.value = true;

  if (currentPath.value === '') {
    fetchBucketFiles();
  } else {
    currentPath.value = '';
  }
  fetchActualSize();
};

const fetchActualSize = async () => {
  if (!currentStorage.value) return;
  loadingActualSize.value = true;
  try {
    const { data } = await api.get(
      `/api/admin/storage-configs/${currentStorage.value.id}/actual-size`,
    );
    actualBytes.value = data.actualSize;
    actualUsageSource.value = data.source || null;
    actualUsageWarning.value = data.warning || null;
    actualObjectCount.value = data.objectCount ?? null;
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
    const { data } = await api.post(
      `/api/admin/storage-configs/${currentStorage.value.id}/sync-size`,
    );
    actualBytes.value = data.usedBytes;
    if (currentStorage.value) {
      currentStorage.value.usedBytes = data.usedBytes;
    }
    ElMessage.success('系统已用容量已与 Cloudflare R2 实际占用同步！');
    fetchConfigs();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '同步容量失败'));
  } finally {
    syncingSize.value = false;
  }
};

let fileSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const fetchBucketFiles = async (
  opts: { append?: boolean; search?: string; continuationToken?: string } = {},
) => {
  if (!currentStorage.value) return;

  if (!opts.append) {
    loadingFiles.value = true;
  } else {
    loadingMoreFiles.value = true;
  }

  try {
    const params: Record<string, string> = {
      prefix: currentPath.value,
    };

    const searchQuery = opts.search !== undefined ? opts.search : fileSearchQuery.value.trim();
    if (searchQuery) {
      params.search = searchQuery;
    }
    if (opts.continuationToken) {
      params.continuationToken = opts.continuationToken;
    }

    const { data } = await api.get(`/api/admin/storage-configs/${currentStorage.value.id}/files`, {
      params,
    });

    const newItems: ExplorerItem[] = (data.items || []).map((item: any) => ({
      type: item.type || 'file',
      name: item.name || item.key,
      key: item.key,
      size: item.size,
      lastModified: item.lastModified,
      url: item.url,
    }));

    if (opts.append) {
      fileItems.value = [...fileItems.value, ...newItems];
    } else {
      fileItems.value = newItems;
    }

    searchTruncated.value = data.truncated || false;

    if (data.search) {
      folderHasMore.value = false;
      folderContinuationToken.value = undefined;
    } else {
      folderHasMore.value = !!data.truncated;
      folderContinuationToken.value = data.nextContinuationToken || undefined;
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '获取存储桶文件列表失败'));
  } finally {
    loadingFiles.value = false;
    loadingMoreFiles.value = false;
  }
};

const loadMoreFolderItems = () => {
  if (folderContinuationToken.value) {
    fetchBucketFiles({ append: true, continuationToken: folderContinuationToken.value });
  }
};

// Watch path changes
watch(currentPath, () => {
  selectedFileKeys.value = [];
  fileSearchQuery.value = '';
  fetchBucketFiles();
});

// Debounced search
watch(fileSearchQuery, (val) => {
  if (fileSearchDebounceTimer) clearTimeout(fileSearchDebounceTimer);
  fileSearchDebounceTimer = setTimeout(() => {
    selectedFileKeys.value = [];
    fetchBucketFiles({ search: val.trim() });
  }, 350);
});

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

// ─── File Actions ─────────────────────────────────────────────────────────────

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
      },
    );

    await api.delete(`/api/admin/storage-configs/${currentStorage.value.id}/files`, {
      data: { key },
    });

    ElMessage.success('文件删除成功！');
    fetchBucketFiles();
    fetchConfigs();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除文件失败'));
    }
  }
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
  if (currentPath.value) {
    formData.append('prefix', currentPath.value);
  }

  try {
    await api.post(`/api/admin/storage-configs/${currentStorage.value.id}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    ElMessage.success(
      currentPath.value ? `文件已上传到 ${currentPath.value}` : '文件直接上传成功！',
    );
    fetchBucketFiles();
    fetchConfigs();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '文件上传失败'));
  } finally {
    uploadingFile.value = false;
    if (target) target.value = '';
  }
};

// ─── Bulk Delete ──────────────────────────────────────────────────────────────

const toggleFileSelection = (key: string) => {
  const idx = selectedFileKeys.value.indexOf(key);
  if (idx >= 0) {
    selectedFileKeys.value.splice(idx, 1);
  } else {
    selectedFileKeys.value.push(key);
  }
};

const toggleSelectAll = () => {
  const fileKeys = fileItems.value.filter((i) => i.type === 'file').map((i) => i.key);
  if (selectedFileKeys.value.length === fileKeys.length) {
    selectedFileKeys.value = [];
  } else {
    selectedFileKeys.value = [...fileKeys];
  }
};

const deleteSelectedFiles = async () => {
  if (!currentStorage.value || selectedFileKeys.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确定要批量删除 ${selectedFileKeys.value.length} 个文件吗？该操作不可撤销。`,
      '批量删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );

    deletingSelected.value = true;
    await api.post(`/api/admin/storage-configs/${currentStorage.value.id}/files/bulk-delete`, {
      keys: selectedFileKeys.value,
    });

    ElMessage.success(`成功删除 ${selectedFileKeys.value.length} 个文件`);
    selectedFileKeys.value = [];
    fetchBucketFiles();
    fetchConfigs();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '批量删除失败'));
    }
  } finally {
    deletingSelected.value = false;
  }
};

// ─── Rename ───────────────────────────────────────────────────────────────────

const openRenameDialog = (item: ExplorerItem) => {
  renameTarget.value = item;
  renameNewName.value = item.name;
  renameDialogVisible.value = true;
};

const submitRename = async () => {
  if (!currentStorage.value || !renameTarget.value) return;
  const oldKey = renameTarget.value.key;
  const newName = renameNewName.value.trim();
  if (!newName) {
    ElMessage.warning('新文件名不能为空');
    return;
  }

  // Build new key: replace the last segment of the key path
  const lastSlash = oldKey.lastIndexOf('/');
  const newKey = lastSlash >= 0 ? oldKey.substring(0, lastSlash + 1) + newName : newName;

  if (newKey === oldKey) {
    renameDialogVisible.value = false;
    return;
  }

  renamingFile.value = true;
  try {
    await api.patch(`/api/admin/storage-configs/${currentStorage.value.id}/files/rename`, {
      oldKey,
      newKey,
    });
    ElMessage.success('文件重命名成功');
    renameDialogVisible.value = false;
    fetchBucketFiles();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '重命名失败'));
  } finally {
    renamingFile.value = false;
  }
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────

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
              配置多个 Cloudflare R2
              账号与存储桶，并按资源类型（材质、模型、插件）分配限额。点击卡片右下角的文件夹可管理文件。
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 w-fit flex-wrap">
          <Button
            variant="outline"
            size="sm"
            :loading="syncingAll"
            :icon="RefreshCw"
            @click="syncAllSizes"
          >
            {{ syncingAll ? '同步中...' : '一键同步全部 R2 容量' }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            :loading="isCleaning"
            :icon="RefreshCw"
            @click="handleCleanupStorage"
          >
            {{ isCleaning ? '正在清理...' : '一键扫描与清理' }}
          </Button>

          <Button variant="outline" size="sm" :icon="UploadIcon" @click="triggerImport">
            导入配置
          </Button>

          <Button variant="outline" size="sm" :icon="Download" @click="handleExport">
            导出配置
          </Button>

          <Button variant="primary" size="sm" :icon="Plus" @click="openAddDialog">
            添加 R2 账号
          </Button>

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
              启用后，全站所有资源数据默认储存至 Cloudflare R2
              云端。若没有配置可用的云存储账号，用户上传文件时将提示"暂时维护中"并禁止上传。
            </p>
          </div>
        </div>
        <Switch
          :model-value="forceR2Storage"
          :disabled="loadingForceR2"
          @change="handleForceR2Change"
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
        <Skeleton width="32px" height="32px" circle />
        <Skeleton width="120px" height="12px" />
      </div>

      <!-- Empty State -->
      <div
        v-else-if="configs.length === 0"
        class="flex flex-col items-center justify-center py-16 px-4 border border-dashed rounded-2xl text-center"
        style="border-color: var(--border-base)"
      >
        <Database class="w-10 h-10 text-slate-300 dark:text-white/10 mb-3" />
        <span class="text-xs font-bold" style="color: var(--text-secondary)"
          >暂未配置云存储账号</span
        >
        <p class="text-[10px] mt-1 max-w-xs" style="color: var(--text-muted)">
          所有上传的资源文件目前将保存在服务器本地磁盘。强烈建议配置至少一个 Cloudflare R2
          云端存储账号。
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
          style="background-color: var(--bg-app); border-color: var(--border-base)"
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
                  <span
                    class="font-bold text-xs truncate"
                    style="color: var(--text-primary)"
                    :title="config.name"
                    >{{ config.name }}</span
                  >
                  <Switch
                    :model-value="config.status === 'ACTIVE'"
                    @change="toggleStatus(config)"
                  />
                </div>
                <div
                  class="flex items-center gap-1 text-[9px] truncate"
                  style="color: var(--text-muted)"
                >
                  <Database class="w-2.5 h-2.5 shrink-0" />
                  <span class="truncate" :title="config.bucketName"
                    >桶: {{ config.bucketName }}</span
                  >
                </div>
                <div
                  v-if="config.remark"
                  class="text-[9px] font-bold text-indigo-500/80 truncate mt-0.5"
                  :title="config.remark"
                >
                  备注: {{ config.remark }}
                </div>
              </div>

              <Badge variant="primary" outline>
                {{ getAssetTypeLabel(config.assetType) }}
              </Badge>
            </div>

            <!-- Endpoint Detail -->
            <div
              class="space-y-0.5 text-[9px] mb-1.5 font-mono p-1.5 rounded-md relative group/endpoint pr-6"
              style="background-color: var(--bg-card); color: var(--text-secondary)"
            >
              <div class="truncate">
                终端:
                <span
                  :class="{
                    'blur-[3.5px] select-none pointer-events-none transition-all duration-300':
                      config.isMasked !== false,
                  }"
                  >{{ config.endpoint }}</span
                >
              </div>
              <div class="truncate flex items-center gap-1">
                <span>域名: </span>
                <span
                  :class="{
                    'blur-[3.5px] select-none pointer-events-none transition-all duration-300':
                      config.isMasked !== false,
                  }"
                  >{{ config.publicUrl }}</span
                >
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
              <div
                class="w-full h-1 rounded-full overflow-hidden"
                style="background-color: var(--bg-card)"
              >
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
              <div
                class="flex items-center justify-between text-[8px]"
                style="color: var(--text-muted)"
              >
                <span>已用: {{ formatBinaryBytes(config.usedBytes) }}</span>
                <span>限制: {{ config.limitGb.toFixed(3) }} GB</span>
              </div>
            </div>
          </div>

          <!-- Bottom: Action Buttons -->
          <div
            class="flex items-center justify-between pt-1.5 border-t"
            style="border-color: var(--border-base)"
          >
            <div class="text-[8px]" style="color: var(--text-muted)">
              优先级:
              <span class="font-bold text-slate-800 dark:text-slate-200"
                >#{{ config.priority }}</span
              >
            </div>

            <div class="flex items-center gap-1.5">
              <Button
                variant="link"
                size="sm"
                :icon="FolderOpen"
                @click="openFileDrawer(config)"
                title="浏览/管理文件"
              />
              <Button
                variant="link"
                size="sm"
                :icon="Edit2"
                @click="openEditDialog(config)"
                title="编辑配置"
              />
              <Button
                variant="danger"
                size="sm"
                :icon="Trash2"
                @click="deleteConfig(config.id, config.name)"
                title="删除配置"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Add/Edit Storage Config Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑云端存储配置' : '添加云端存储配置'"
      width="920px"
      align-center
      destroy-on-close
      class="rounded-3xl"
    >
      <div class="space-y-4 py-1">
        <!-- Section: Basic Information -->
        <div class="border-b pb-3" style="border-color: var(--border-base)">
          <h3 class="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">基本信息</h3>
          <div class="grid grid-cols-4 gap-3">
            <div>
              <Input
                v-model="form.name"
                label="配置别名"
                placeholder="例如：材质仓 R2"
                inputClass="!py-2.5"
                required
              />
            </div>
            <div>
              <Input
                v-model="form.remark"
                label="账号备注"
                placeholder="例如：开发环境 / 主账号"
                inputClass="!py-2.5"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">
                应用类型 <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <select
                  v-model="form.assetType"
                  class="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all text-sm appearance-none cursor-pointer"
                  style="
                    background-color: var(--bg-card);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                >
                  <option v-for="type in assetTypes" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  ▼
                </div>
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">提供商</label>
              <select
                v-model="form.provider"
                disabled
                class="w-full px-4 py-2.5 rounded-xl border outline-none text-sm opacity-60 cursor-not-allowed"
                style="
                  background-color: var(--bg-card);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              >
                <option value="CLOUDFLARE_R2">Cloudflare R2</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section: Credentials -->
        <div class="border-b pb-3" style="border-color: var(--border-base)">
          <h3 class="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">连接凭证</h3>
          <div class="grid grid-cols-4 gap-3">
            <div class="col-span-2">
              <Input
                v-model="form.endpoint"
                label="终端节点 (Endpoint URL)"
                placeholder="https://<account_id>.r2.cloudflarestorage.com"
                inputClass="!py-2.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <Input
                v-model="form.accessKeyId"
                label="Access Key ID"
                placeholder="R2 存取密钥 ID"
                inputClass="!py-2.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <Input
                v-model="form.secretAccessKey"
                label="Secret Access Key"
                placeholder="R2 机密存取密钥"
                inputClass="!py-2.5 font-mono text-xs"
                required
              />
            </div>
            <div class="col-span-4">
              <Input
                v-model="form.cloudflareApiToken"
                label="Cloudflare API Token（可选，推荐）"
                placeholder="此 Cloudflare 账号的 R2 只读 API Token"
                inputClass="!py-2.5 font-mono text-xs"
              />
              <p class="text-[9px] leading-relaxed mt-1" style="color: var(--text-secondary)">
                配置 Token 后可直接读取 Cloudflare Metrics 接口，展示与官网一致的物理占用。
              </p>
            </div>
          </div>
        </div>

        <!-- Section: Bucket & Storage Config -->
        <div>
          <h3 class="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Bucket & 存储属性</h3>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <Input
                v-model="form.bucketName"
                label="存储桶名称"
                placeholder="例如: materials-bucket"
                inputClass="!py-2.5"
                required
              />
            </div>
            <div>
              <Input
                v-model="form.publicUrl"
                label="公共访问域名 (Public URL)"
                placeholder="https://pub-xxxx.r2.dev 或自定义域名"
                inputClass="!py-2.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <Input
                v-model.number="form.priority"
                type="number"
                label="匹配优先级"
                inputClass="!py-2.5"
              />
            </div>
            <div>
              <Input
                v-model.number="form.limitGb"
                type="number"
                label="配额限制 (GB)"
                inputClass="!py-2.5"
                required
              />
            </div>
            <div>
              <Input
                v-model.number="form.usedBytes"
                type="number"
                label="已用存储空间 (Bytes)"
                inputClass="!py-2.5"
                required
              />
            </div>
            <div class="flex items-center pl-2 pt-5">
              <Checkbox
                :model-value="form.status === 'ACTIVE'"
                @change="(val: boolean) => (form.status = val ? 'ACTIVE' : 'INACTIVE')"
              >
                启用此云存储账号
              </Checkbox>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center w-full">
          <Button
            variant="secondary"
            size="sm"
            :loading="testingConnection"
            :icon="testingConnection ? undefined : Play"
            @click="testConnection"
          >
            测试连接
          </Button>

          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="dialogVisible = false"> 取消 </Button>
            <Button
              variant="primary"
              size="sm"
              :loading="submitting"
              :icon="submitting ? undefined : Check"
              @click="submitForm"
            >
              保存配置
            </Button>
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
      <!-- Hidden file input for uploading files -->
      <input ref="fileInput" type="file" class="hidden" @change="handleFileUpload" />

      <div class="space-y-6 h-full flex flex-col justify-between">
        <div class="space-y-4 shrink-0">
          <!-- Bucket Stats & Upload Header -->
          <div
            class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl"
            style="background-color: var(--bg-card)"
          >
            <div
              class="text-xs flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
              style="color: var(--text-secondary)"
            >
              <span
                >桶名称:
                <strong style="color: var(--text-primary)">{{
                  currentStorage?.bucketName
                }}</strong></span
              >
              <span class="text-slate-300 dark:text-white/10">|</span>
              <span
                >限制大小:
                <strong style="color: var(--text-primary)"
                  >{{ currentStorage?.limitGb.toFixed(2) }} GB</strong
                ></span
              >
              <span class="text-slate-300 dark:text-white/10">|</span>
              <span class="flex items-center gap-1">
                <span>当前容量使用:</span>
                <strong
                  :class="[
                    getUsagePercentage(
                      currentStorage?.usedBytes || 0,
                      currentStorage?.limitGb || 9.8,
                    ) >= 95
                      ? 'text-rose-500'
                      : 'text-indigo-500',
                  ]"
                >
                  {{ formatBinaryBytes(currentStorage?.usedBytes || 0) }} ({{
                    getUsagePercentage(
                      currentStorage?.usedBytes || 0,
                      currentStorage?.limitGb || 9.8,
                    )
                  }}%)
                </strong>
              </span>
              <span class="text-slate-300 dark:text-white/10">|</span>
              <span class="flex items-center gap-1">
                <span>R2 云端实际占用:</span>
                <span v-if="loadingActualSize" class="text-slate-400">正在计算...</span>
                <template v-else-if="actualBytes !== null">
                  <strong class="text-slate-800 dark:text-slate-200">
                    {{
                      isOfficialCloudflareUsage(actualUsageSource)
                        ? formatCloudflareBytes(actualBytes)
                        : formatBinaryBytes(actualBytes)
                    }}
                  </strong>
                  <Badge
                    v-if="isOfficialCloudflareUsage(actualUsageSource)"
                    variant="success"
                    outline
                    dot
                  >
                    官方数据
                  </Badge>
                  <Badge v-else variant="warning" outline dot> 估算值 </Badge>
                  <span v-if="actualObjectCount !== null" class="text-[9px] text-slate-400">
                    ({{ actualObjectCount }} 对象)
                  </span>
                </template>
                <span v-else class="text-slate-400">获取失败</span>

                <Button
                  v-if="
                    !isOfficialCloudflareUsage(actualUsageSource) ||
                    actualBytes !== currentStorage?.usedBytes
                  "
                  variant="outline"
                  size="sm"
                  :loading="syncingSize"
                  @click="syncSize"
                >
                  同步至系统
                </Button>
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                :loading="uploadingFile"
                :icon="uploadingFile ? undefined : UploadIcon"
                @click="triggerFileInput"
              >
                {{ currentPath ? '上传到当前目录' : '上传文件' }}
              </Button>
              <Button
                v-if="selectedFileKeys.length > 0"
                variant="danger"
                size="sm"
                :loading="deletingSelected"
                :icon="Trash2"
                @click="deleteSelectedFiles"
              >
                删除选中 ({{ selectedFileKeys.length }})
              </Button>
            </div>
          </div>

          <!-- Search filter bar -->
          <Input v-model="fileSearchQuery" placeholder="按文件名或键路径筛选..." :icon="Search" />

          <!-- Breadcrumbs -->
          <div
            v-if="!fileSearchQuery.trim()"
            class="flex flex-wrap items-center gap-1.5 text-[11px] font-mono py-1.5 px-3 rounded-lg border"
            style="
              background-color: var(--bg-card);
              border-color: var(--border-base);
              color: var(--text-secondary);
            "
          >
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

          <!-- Search truncated warning -->
          <div
            v-if="searchTruncated && fileSearchQuery.trim()"
            class="text-[10px] text-amber-500 flex items-center gap-1"
          >
            <AlertCircle class="w-3 h-3" />
            搜索结果过多，仅显示前 300 条。请使用更精确的关键词缩小范围。
          </div>
        </div>

        <!-- Scrollable Files List Table -->
        <div
          class="grow overflow-y-auto min-h-[300px] border rounded-2xl"
          style="border-color: var(--border-base)"
        >
          <div v-if="loadingFiles" class="flex flex-col items-center justify-center py-24 gap-3">
            <RefreshCw class="w-8 h-8 animate-spin text-accent" />
            <span class="text-xs font-bold text-[var(--text-secondary)]">正在加载文件，请稍候...</span>
          </div>

          <div
            v-else-if="fileItems.length === 0 && !currentPath"
            class="flex flex-col items-center justify-center py-20 px-4 text-center"
          >
            <Database class="w-8 h-8 text-slate-300 dark:text-white/10 mb-2" />
            <span class="text-xs font-bold" style="color: var(--text-secondary)"
              >没有找到相关文件</span
            >
            <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
              该存储桶目前可能为空，或者没有匹配当前搜索词的文件。
            </p>
          </div>

          <table v-else class="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr
                class="border-b"
                style="
                  border-color: var(--border-base);
                  background-color: var(--bg-card);
                  color: var(--text-secondary);
                "
              >
                <th class="p-3 font-bold w-8">
                  <Checkbox
                    :model-value="
                      selectedFileKeys.length > 0 &&
                      selectedFileKeys.length === fileItems.filter((i) => i.type === 'file').length
                    "
                    @change="toggleSelectAll"
                  />
                </th>
                <th class="p-3 font-bold">文件路径 / 键 (Key)</th>
                <th class="p-3 font-bold w-20">文件大小</th>
                <th class="p-3 font-bold w-28">修改时间</th>
                <th class="p-3 font-bold w-28 text-right">操作</th>
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
                <td class="p-3"></td>
                <td colspan="4" class="p-3 font-mono">
                  <div class="flex items-center gap-2">
                    <FolderOpen class="w-4 h-4 text-indigo-400" />
                    <span class="font-bold">.. (返回上一级)</span>
                  </div>
                </td>
              </tr>

              <!-- Items List -->
              <tr
                v-for="item in fileItems"
                :key="item.key"
                class="border-b hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                :class="{
                  'cursor-pointer': item.type === 'folder',
                  'bg-indigo-500/5': item.type === 'file' && selectedFileKeys.includes(item.key),
                }"
                style="border-color: var(--border-base); color: var(--text-primary)"
                @click="item.type === 'folder' ? (currentPath = item.key) : null"
              >
                <!-- Checkbox -->
                <td class="p-3" @click.stop>
                  <Checkbox
                    v-if="item.type === 'file'"
                    :model-value="selectedFileKeys.includes(item.key)"
                    @change="toggleFileSelection(item.key)"
                  />
                </td>

                <!-- Key/Name and Icon -->
                <td class="p-3 font-mono break-all max-w-xs">
                  <div class="flex items-center gap-2">
                    <!-- Icon based on type -->
                    <div class="shrink-0">
                      <Folder
                        v-if="item.type === 'folder'"
                        class="w-4 h-4 text-amber-400 shrink-0"
                      />
                      <div
                        v-else-if="isImage(item.key)"
                        class="w-6 h-6 rounded overflow-hidden border bg-slate-100 flex items-center justify-center shrink-0"
                      >
                        <img :src="item.url" class="object-cover w-full h-full" />
                      </div>
                      <FileText v-else class="w-4 h-4 text-indigo-400 shrink-0" />
                    </div>

                    <span
                      class="truncate font-bold"
                      v-if="item.type === 'folder'"
                      :title="item.name"
                      >{{ item.name }}/</span
                    >
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
                  <span v-if="item.type === 'file'">{{ formatBinaryBytes(item.size || 0) }}</span>
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
                <td class="p-3 text-right whitespace-nowrap" @click.stop>
                  <template v-if="item.type === 'file'">
                    <button
                      type="button"
                      class="p-1 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-500 rounded transition-colors cursor-pointer"
                      title="复制公开 URL"
                      @click="copyFileUrl(item.url)"
                    >
                      <ExternalLink class="w-3.5 h-3.5" />
                    </button>
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
                      class="p-1 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-500 rounded transition-colors cursor-pointer"
                      title="重命名"
                      @click="openRenameDialog(item)"
                    >
                      <Pencil class="w-3.5 h-3.5" />
                    </button>
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

          <!-- Load More -->
          <div
            v-if="folderHasMore && !fileSearchQuery.trim()"
            class="p-3 border-t text-center"
            style="border-color: var(--border-base)"
          >
            <Button
              variant="outline"
              size="sm"
              :loading="loadingMoreFiles"
              @click="loadMoreFolderItems"
            >
              {{ loadingMoreFiles ? '加载中...' : '加载更多' }}
            </Button>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- Rename File Dialog -->
    <el-dialog v-model="renameDialogVisible" title="重命名文件" width="420px" destroy-on-close>
      <div class="space-y-3">
        <p class="text-[11px] break-all" style="color: var(--text-muted)">
          当前 Key: {{ renameTarget?.key }}
        </p>
        <Input v-model="renameNewName" placeholder="新文件名" />
      </div>
      <template #footer>
        <div class="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" @click="renameDialogVisible = false"> 取消 </Button>
          <Button variant="primary" size="sm" :loading="renamingFile" @click="submitRename">
            {{ renamingFile ? '保存中...' : '确认重命名' }}
          </Button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Database,
  RefreshCw,
  Upload as UploadIcon,
  Trash2,
  Search,
  HelpCircle,
  Folder,
  FolderOpen,
  FileText,
  ExternalLink,
  Download,
  Pencil,
  Copy,
  AlertCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import {
  formatCloudflareBytes,
  getUsagePercentage,
  isOfficialCloudflareUsage,
} from '@/utils/storageBytes';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Badge from '@/components/ui/Badge.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import StorageRenameDialog from './StorageRenameDialog.vue';
import type { StorageConfig, ExplorerItem, RawExplorerItem } from './StorageSettingsTab.types';

const props = defineProps<{
  currentStorage: StorageConfig | null;
}>();

const visible = defineModel<boolean>('modelValue', { required: true });

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const storage = ref<StorageConfig | null>(null);

watch(
  () => props.currentStorage,
  (val) => {
    storage.value = val;
  },
  { immediate: true },
);

const fileItems = ref<ExplorerItem[]>([]);
const currentPath = ref('');
const loadingFiles = ref(false);
const fileSearchQuery = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const uploadingFile = ref(false);

const folderHasMore = ref(false);
const folderContinuationToken = ref<string | undefined>(undefined);
const loadingMoreFiles = ref(false);
const searchTruncated = ref(false);

const actualBytes = ref<number | null>(null);
const actualUsageSource = ref<
  'cloudflare-graphql' | 'cloudflare-usage-api' | 'list-objects' | null
>(null);
const actualUsageWarning = ref<string | null>(null);
const actualObjectCount = ref<number | null>(null);
const scannedBytes = ref<number | null>(null);
const scannedObjectCount = ref<number | null>(null);
const loadingActualSize = ref(false);
const scanningSize = ref(false);
const syncingSize = ref(false);

const selectedFileKeys = ref<string[]>([]);
const deletingSelected = ref(false);

const renameDialogVisible = ref(false);
const renameTarget = ref<ExplorerItem | null>(null);
const renameNewName = ref('');
const renamingFile = ref(false);

let fileSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const resetState = () => {
  fileItems.value = [];
  currentPath.value = '';
  loadingFiles.value = false;
  fileSearchQuery.value = '';
  uploadingFile.value = false;
  folderHasMore.value = false;
  folderContinuationToken.value = undefined;
  loadingMoreFiles.value = false;
  searchTruncated.value = false;
  actualBytes.value = null;
  actualUsageSource.value = null;
  actualUsageWarning.value = null;
  actualObjectCount.value = null;
  scannedBytes.value = null;
  scannedObjectCount.value = null;
  loadingActualSize.value = false;
  scanningSize.value = false;
  syncingSize.value = false;
  selectedFileKeys.value = [];
  deletingSelected.value = false;
};

const fetchActualSize = async () => {
  if (!storage.value) return;
  loadingActualSize.value = true;
  try {
    const { data } = await api.get(`/api/admin/storage-configs/${storage.value.id}/actual-size`);
    actualBytes.value = data.actualSize;
    actualUsageSource.value = data.source || null;
    actualUsageWarning.value = data.warning || null;
    actualObjectCount.value = data.objectCount ?? null;
    scannedBytes.value = data.scannedBytes ?? null;
    scannedObjectCount.value = data.scannedObjectCount ?? null;
  } catch (error) {
    logError(error, { operation: 'admin.fetchActualBucketSize', component: 'StorageFileExplorer' });
    actualBytes.value = null;
  } finally {
    loadingActualSize.value = false;
  }
};

const runS3Scan = async () => {
  if (!storage.value) return;
  scanningSize.value = true;
  try {
    const { data } = await api.get(
      `/api/admin/storage-configs/${storage.value.id}/actual-size?scan=true`,
    );
    scannedBytes.value = data.scannedBytes ?? null;
    scannedObjectCount.value = data.scannedObjectCount ?? null;
  } catch (error) {
    logError(error, { operation: 'admin.runS3Scan', component: 'StorageFileExplorer' });
    ElMessage.error(getApiErrorMessage(error, '计算实时大小失败'));
  } finally {
    scanningSize.value = false;
  }
};

const syncSize = async (type: 'scanned' | 'official' = 'scanned') => {
  if (!storage.value) return;
  syncingSize.value = true;
  try {
    const { data } = await api.post(`/api/admin/storage-configs/${storage.value.id}/sync-size`, {
      type,
    });
    if (storage.value) {
      storage.value.usedBytes = data.usedBytes;
    }
    ElMessage.success(
      `系统已用容量已与 Cloudflare R2 ${type === 'official' ? '官方' : '实时扫描'}占用同步！`,
    );
    emit('refresh');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '同步容量失败'));
  } finally {
    syncingSize.value = false;
  }
};

const fetchBucketFiles = async (
  opts: { append?: boolean; search?: string; continuationToken?: string } = {},
) => {
  if (!storage.value) return;

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

    const { data } = await api.get(`/api/admin/storage-configs/${storage.value.id}/files`, {
      params,
    });

    const newItems: ExplorerItem[] = (data.items || []).map((item: RawExplorerItem) => ({
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

watch(currentPath, () => {
  selectedFileKeys.value = [];
  fileSearchQuery.value = '';
  fetchBucketFiles();
});

watch(fileSearchQuery, (val) => {
  if (fileSearchDebounceTimer) clearTimeout(fileSearchDebounceTimer);
  fileSearchDebounceTimer = setTimeout(() => {
    selectedFileKeys.value = [];
    fetchBucketFiles({ search: val.trim() });
  }, 350);
});

watch(visible, (isVisible, wasVisible) => {
  if (isVisible && !wasVisible) {
    resetState();
    fetchBucketFiles();
    fetchActualSize();
  }
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

const deleteFile = async (key: string) => {
  if (!storage.value) return;
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

    await api.delete(`/api/admin/storage-configs/${storage.value.id}/files`, {
      data: { key },
    });

    ElMessage.success('文件删除成功！');
    fetchBucketFiles();
    emit('refresh');
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
  if (!file || !storage.value) return;

  uploadingFile.value = true;
  const formData = new FormData();
  formData.append('file', file);
  if (currentPath.value) {
    formData.append('prefix', currentPath.value);
  }

  try {
    await api.post(`/api/admin/storage-configs/${storage.value.id}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    ElMessage.success(
      currentPath.value ? `文件已上传到 ${currentPath.value}` : '文件直接上传成功！',
    );
    fetchBucketFiles();
    emit('refresh');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '文件上传失败'));
  } finally {
    uploadingFile.value = false;
    if (target) target.value = '';
  }
};

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
  if (!storage.value || selectedFileKeys.value.length === 0) return;
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
    await api.post(`/api/admin/storage-configs/${storage.value.id}/files/bulk-delete`, {
      keys: selectedFileKeys.value,
    });

    ElMessage.success(`成功删除 ${selectedFileKeys.value.length} 个文件`);
    selectedFileKeys.value = [];
    fetchBucketFiles();
    emit('refresh');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '批量删除失败'));
    }
  } finally {
    deletingSelected.value = false;
  }
};

const openRenameDialog = (item: ExplorerItem) => {
  renameTarget.value = item;
  renameNewName.value = item.name;
  renameDialogVisible.value = true;
};

const submitRename = async () => {
  if (!storage.value || !renameTarget.value) return;
  const oldKey = renameTarget.value.key;
  const newName = renameNewName.value.trim();
  if (!newName) {
    ElMessage.warning('新文件名不能为空');
    return;
  }

  const lastSlash = oldKey.lastIndexOf('/');
  const newKey = lastSlash >= 0 ? oldKey.substring(0, lastSlash + 1) + newName : newName;

  if (newKey === oldKey) {
    renameDialogVisible.value = false;
    return;
  }

  renamingFile.value = true;
  try {
    await api.patch(`/api/admin/storage-configs/${storage.value.id}/files/rename`, {
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
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="`云存储资源浏览器: ${storage?.name || ''}`"
    size="800px"
    destroy-on-close
  >
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
              <strong style="color: var(--text-primary)">{{ storage?.bucketName }}</strong></span
            >
            <span class="text-slate-300 dark:text-white/10">|</span>
            <span
              >限制大小:
              <strong style="color: var(--text-primary)"
                >{{ storage?.limitGb.toFixed(2) }} GB</strong
              ></span
            >
            <span class="text-slate-300 dark:text-white/10">|</span>
            <span class="flex items-center gap-1">
              <span>当前容量使用:</span>
              <strong
                :class="[
                  getUsagePercentage(storage?.usedBytes || 0, storage?.limitGb || 9.8) >= 95
                    ? 'text-rose-500'
                    : 'text-indigo-500',
                ]"
              >
                {{ formatCloudflareBytes(storage?.usedBytes || 0) }} ({{
                  getUsagePercentage(storage?.usedBytes || 0, storage?.limitGb || 9.8)
                }}%)
              </strong>
            </span>
            <span class="text-slate-300 dark:text-white/10">|</span>
            <span v-if="loadingActualSize" class="flex items-center gap-1 text-slate-400">
              <span>R2 容量计算中...</span>
            </span>
            <template v-else-if="actualBytes !== null">
              <!-- Real-time scanned capacity -->
              <span class="flex items-center gap-1">
                <span class="text-slate-500 dark:text-slate-400 text-xs">R2 扫描(实时):</span>
                <span v-if="scanningSize" class="text-slate-400 animate-pulse text-xs"
                  >正在扫描...</span
                >
                <template v-else-if="scannedBytes !== null">
                  <strong class="text-slate-800 dark:text-slate-200">
                    {{ formatCloudflareBytes(scannedBytes) }}
                  </strong>
                  <Badge variant="primary" outline dot>实时扫描</Badge>
                  <span v-if="scannedObjectCount !== null" class="text-[9px] text-slate-400">
                    ({{ scannedObjectCount }} 对象)
                  </span>
                  <el-tooltip
                    content="通过 S3 API 实时遍历桶内对象得到的大小。推荐以此为准进行容量限制同步。"
                    placement="top"
                    effect="dark"
                  >
                    <HelpCircle class="w-3.5 h-3.5 text-slate-400 cursor-help inline-block" />
                  </el-tooltip>
                  <Button
                    v-if="scannedBytes !== storage?.usedBytes"
                    variant="outline"
                    size="sm"
                    class="ml-1 scale-90 origin-left"
                    :loading="syncingSize"
                    @click="syncSize('scanned')"
                  >
                    同步实时
                  </Button>
                </template>
                <template v-else>
                  <Button
                    variant="outline"
                    size="sm"
                    class="scale-90 origin-left"
                    @click="runS3Scan"
                  >
                    计算实时大小
                  </Button>
                  <el-tooltip
                    content="实时遍历整个 R2 存储桶文件计算大小。当文件特别多时，可能需要数秒至数十秒。"
                    placement="top"
                    effect="dark"
                  >
                    <HelpCircle class="w-3.5 h-3.5 text-slate-400 cursor-help inline-block" />
                  </el-tooltip>
                </template>
              </span>

              <!-- Official metric (if available) -->
              <span
                v-if="isOfficialCloudflareUsage(actualUsageSource)"
                class="text-slate-300 dark:text-white/10"
                >|</span
              >
              <span
                v-if="isOfficialCloudflareUsage(actualUsageSource)"
                class="flex items-center gap-1"
              >
                <span class="text-slate-500 dark:text-slate-400 text-xs">R2 官方(延迟):</span>
                <strong class="text-slate-800 dark:text-slate-200">
                  {{ formatCloudflareBytes(actualBytes) }}
                </strong>
                <Badge variant="success" outline dot>官方数据</Badge>
                <span v-if="actualObjectCount !== null" class="text-[9px] text-slate-400">
                  ({{ actualObjectCount }} 对象)
                </span>
                <el-tooltip
                  content="Cloudflare 官方计量数据，通常有 2-24 小时的统计延迟，且包含多段上传或历史版本。"
                  placement="top"
                  effect="dark"
                >
                  <HelpCircle class="w-3.5 h-3.5 text-slate-400 cursor-help inline-block" />
                </el-tooltip>
                <Button
                  v-if="actualBytes !== storage?.usedBytes"
                  variant="outline"
                  size="sm"
                  class="ml-1 scale-90 origin-left"
                  :loading="syncingSize"
                  @click="syncSize('official')"
                >
                  同步官方
                </Button>
              </span>
            </template>
            <span v-else class="text-slate-400 flex items-center gap-1">
              <span>R2 占用获取失败</span>
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
          <span class="text-xs font-bold text-[var(--text-secondary)]"
            >正在加载文件，请稍候...</span
          >
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
                  <div class="shrink-0">
                    <Folder v-if="item.type === 'folder'" class="w-4 h-4 text-amber-400 shrink-0" />
                    <div
                      v-else-if="isImage(item.key)"
                      class="w-6 h-6 rounded overflow-hidden border bg-slate-100 flex items-center justify-center shrink-0"
                    >
                      <img :src="item.url" class="object-cover w-full h-full" />
                    </div>
                    <FileText v-else class="w-4 h-4 text-indigo-400 shrink-0" />
                  </div>

                  <span v-if="item.type === 'folder'" class="truncate font-bold" :title="item.name"
                    >{{ item.name }}/</span
                  >
                  <span v-else class="truncate" :title="item.name">{{ item.name }}</span>

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
                <span v-if="item.type === 'file'">{{ formatCloudflareBytes(item.size || 0) }}</span>
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

    <StorageRenameDialog
      v-model:visible="renameDialogVisible"
      v-model:target="renameTarget"
      v-model:new-name="renameNewName"
      :loading="renamingFile"
      @confirm="submitRename"
    />
  </el-drawer>
</template>

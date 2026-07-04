<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  UploadCloud,
  File,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Box as BoxIcon,
  Video as VideoIcon,
  Trash2,
  Share2,
  Download,
  Search,
  Clock,
  HardDrive,
  Copy,
  Check,
  Loader2,
  Lock,
  Calendar,
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { useMultiThreadDownload } from '@/composables/useMultiThreadDownload';
import DownloadProgressOverlay from '@/components/ui/DownloadProgressOverlay.vue';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { ElMessage, ElMessageBox } from 'element-plus';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import FormDialog from '@/components/FormDialog.vue';
import Checkbox from '@/components/ui/Checkbox.vue';

const router = useRouter();
const { t } = useI18n();

const { isDownloading, downloadProgress, downloadSpeedStr, cancelDownload, runDownload } = useMultiThreadDownload();

const handleDownload = (file: any) => {
  const downloadUrl = `${api.defaults.baseURL || ''}/api/temporary-netdisk/files/${file.id}/download`;

  runDownload({
    url: downloadUrl,
    filename: file.name,
    totalSizeOverrideBytes: file.size,
    onError: (err) => {
      ElMessage.error(getApiErrorMessage(err, '下载启动失败，请确认该临时文件在服务端仍未失效'));
    },
  });
};

// States
const files = ref<any[]>([]);
const loading = ref(false);
const cleanupTime = ref('03:00');
const searchQuery = ref('');
const isDragging = ref(false);

const hasConfig = ref(true);
const limitGb = ref(0);
const usedBytes = ref(0);

// Uploading states
const uploadProgress = ref(0);
const isUploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Share dialog states
const shareDialogVisible = ref(false);
const selectedFile = ref<any | null>(null);
const usePassword = ref(false);
const sharePassword = ref('');
const expiresDays = ref('7');
const generatedShareUrl = ref('');
const shareCreated = ref(false);
const isCreatingShare = ref(false);

const copied = ref(false);

// Format file size
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format date
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Map file types to icons
const getFileIcon = (mime: string, filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
  if (['glb', 'gltf', 'obj', 'fbx', 'stl', 'blend'].includes(ext)) return BoxIcon;
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('video/')) return VideoIcon;
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'md'].includes(ext)) return FileText;
  return File;
};

// Map file types to color classes
const getFileIconColor = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['zip', 'rar', '7z'].includes(ext)) return 'text-amber-500 bg-amber-500/10';
  if (['glb', 'gltf', 'blend'].includes(ext)) return 'text-indigo-500 bg-indigo-500/10';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'text-emerald-500 bg-emerald-500/10';
  if (['mp4', 'mov', 'avi'].includes(ext)) return 'text-rose-500 bg-rose-500/10';
  if (['pdf', 'doc', 'txt'].includes(ext)) return 'text-sky-500 bg-sky-500/10';
  return 'text-slate-500 bg-slate-500/10';
};

// Fetch files
const fetchFiles = async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/api/temporary-netdisk/files');
    hasConfig.value = data.hasConfig !== false;
    files.value = data.files || [];
    cleanupTime.value = data.cleanupTime || '03:00';
    limitGb.value = data.limitGb || 0;
    usedBytes.value = data.usedBytes || 0;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '获取网盘文件失败'));
  } finally {
    loading.value = false;
  }
};

// Handle file upload
const handleUpload = async (fileList: FileList | null) => {
  if (!fileList || fileList.length === 0) return;
  const file = fileList[0];

  // Perform upload
  const formData = new FormData();
  formData.append('temporary_file', file);

  isUploading.value = true;
  uploadProgress.value = 0;
  uploadLoadedBytes.value = 0;
  uploadTotalBytes.value = file.size;
  uploadSpeedStr.value = '0 KB/s';
  uploadStatusText.value = '正在传输数据到服务器...';

  const uploadStartTime = Date.now();

  try {
    await api.post('/api/temporary-netdisk/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const loaded = progressEvent.loaded || 0;
        const total = progressEvent.total || file.size;
        uploadLoadedBytes.value = loaded;
        uploadTotalBytes.value = total;

        if (total > 0) {
          const rawPercent = Math.round((loaded * 100) / total);
          uploadProgress.value = Math.min(rawPercent, 99);
        }

        const now = Date.now();
        const timeElapsedSec = (now - uploadStartTime) / 1000;
        if (timeElapsedSec > 0.3) {
          const bytesPerSec = loaded / timeElapsedSec;
          if (bytesPerSec > 1024 * 1024) {
            uploadSpeedStr.value = `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
          } else {
            uploadSpeedStr.value = `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
          }
        }

        if (loaded >= total) {
          uploadProgress.value = 99;
          uploadStatusText.value = '数据传输完成，正在同步转存至 Cloudflare R2...';
        } else {
          uploadStatusText.value = '正在传输数据到服务器...';
        }
      },
    });

    uploadProgress.value = 100;
    uploadStatusText.value = '上传完成！';
    ElMessage.success('文件上传成功');
    fetchFiles();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '文件上传失败'));
  } finally {
    setTimeout(() => {
      isUploading.value = false;
      uploadProgress.value = 0;
      uploadLoadedBytes.value = 0;
      uploadTotalBytes.value = 0;
      uploadSpeedStr.value = '';
      uploadStatusText.value = '';
    }, 400);
  }
};

// Drag & drop triggers
const onDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  if (e.dataTransfer?.files) {
    handleUpload(e.dataTransfer.files);
  }
};

// Trigger file input
const triggerFileInput = () => {
  fileInput.value?.click();
};

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement;
  handleUpload(target.files);
};

// Delete file
const handleDelete = async (file: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除文件 "${file.name}" 吗？该操作将从云存储和服务器中永久删除该文件。`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );

    await api.delete(`/api/temporary-netdisk/files/${file.id}`);
    ElMessage.success('文件已删除');
    fetchFiles();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除文件失败'));
    }
  }
};

// Open share dialog
const openShareDialog = (file: any) => {
  selectedFile.value = file;
  usePassword.value = false;
  sharePassword.value = '';
  expiresDays.value = '7';
  generatedShareUrl.value = '';
  shareCreated.value = false;
  shareDialogVisible.value = true;
};

// Generate share link
const generateShare = async () => {
  if (!selectedFile.value) return;

  isCreatingShare.value = true;
  try {
    const { data } = await api.post('/api/temporary-netdisk/shares', {
      fileId: selectedFile.value.id,
      password: usePassword.value ? sharePassword.value.trim() : null,
      expiresDays: expiresDays.value,
    });

    const shareUrl = `${window.location.origin}/share/temporary/${data.id}`;
    generatedShareUrl.value = shareUrl;
    shareCreated.value = true;
    ElMessage.success('分享链接生成成功');
    fetchFiles(); // refresh list to show updated shares count
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '生成分享链接失败'));
  } finally {
    isCreatingShare.value = false;
  }
};

// Copy link
const copyShareLink = async () => {
  let textToCopy = `分享文件: ${selectedFile.value.name}\n下载链接: ${generatedShareUrl.value}`;
  if (usePassword.value && sharePassword.value) {
    textToCopy += `\n提取码: ${sharePassword.value}`;
  }

  try {
    await navigator.clipboard.writeText(textToCopy);
    copied.value = true;
    ElMessage.success('链接已复制到剪贴板');
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    ElMessage.error('复制失败，请手动选择复制');
  }
};

// Total files and size
const totalFilesCount = computed(() => files.value.length);
const totalFilesSize = computed(() => {
  const sum = files.value.reduce((acc, f) => acc + f.size, 0);
  return formatSize(sum);
});

const quotaPercentage = computed(() => {
  if (limitGb.value === 0) return 0;
  const limitBytes = limitGb.value * 1024 * 1024 * 1024;
  return Math.min(100, parseFloat(((usedBytes.value / limitBytes) * 100).toFixed(1)));
});

// Filtered files
const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) return files.value;
  const q = searchQuery.value.toLowerCase();
  return files.value.filter((f) => f.name.toLowerCase().includes(q));
});

onMounted(() => {
  fetchFiles();
});
</script>

<template>
  <div class="w-full px-4 sm:px-8 py-5 space-y-5 animate-in fade-in duration-500">
    <!-- Config Missing Screen -->
    <div v-if="!loading && !hasConfig" class="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-3xl space-y-4">
      <div class="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto shadow-sm animate-bounce">
        <Lock class="w-8 h-8" />
      </div>
      <h2 class="text-lg font-bold text-[var(--text-primary)]">临时网盘功能未启用</h2>
      <p class="text-xs text-[var(--text-muted)] max-w-[420px] leading-relaxed">
        系统管理员尚未配置或启用临时网盘专用的云端对象存储 (Cloudflare R2)。为了保证文件传输安全性，临时网盘在此环境下处于停用状态。
      </p>
      <div class="pt-2">
        <Button variant="primary" @click="router.push('/dashboard')">返回工作台概览</Button>
      </div>
    </div>

    <!-- Active Workspace -->
    <template v-else>
      <!-- Header Summary Section -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <HardDrive class="w-5 h-5 text-indigo-500" />
            临时网盘
          </h1>
          <p class="text-xs text-[var(--text-muted)] mt-1 leading-relaxed max-w-[680px]">
            临时网盘专用于便捷、短期的文件上传与公网链接分享。
            <strong class="text-rose-500">系统已设定每天 {{ cleanupTime }} 自动清空所有文件与分享</strong>，请及时下载。
          </p>
        </div>

        <!-- Quota summary card -->
        <div
          class="p-3 px-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-card)] flex flex-col gap-1.5 shadow-sm min-w-[280px]"
        >
          <div class="flex items-center gap-2">
            <div class="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              <HardDrive class="w-3.5 h-3.5" />
            </div>
            <div class="text-xs font-bold text-[var(--text-primary)]">网盘存储空间 (R2)</div>
          </div>
          <div class="w-full bg-[var(--border-base)] rounded-full h-1.5 overflow-hidden mt-0.5">
            <div
              :class="[
                'h-full transition-all duration-300',
                quotaPercentage > 90 ? 'bg-rose-500' : quotaPercentage > 70 ? 'bg-amber-500' : 'bg-indigo-500'
              ]"
              :style="{ width: `${quotaPercentage}%` }"
            ></div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
            <span>已使用: {{ formatSize(usedBytes) }}</span>
            <span>容量限制: {{ limitGb }} GB ({{ quotaPercentage }}%)</span>
          </div>
        </div>
      </div>

    <!-- Alert / Tip Box -->
    <div
      class="p-2.5 px-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-2.5 text-amber-600 dark:text-amber-400"
    >
      <Clock class="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
      <div class="text-[11px]">
        <p class="font-bold">重要提示：自动清理规则</p>
        <p class="mt-0.5 leading-relaxed opacity-95">
          此网盘属于临时中转站。每日系统在触发清理点（大约 {{ cleanupTime }}）时，会永久擦除所有文件与数据库分享记录。请务必及时下载。
        </p>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left column: Drag & Drop upload region -->
      <div class="lg:col-span-1">
        <div
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
          @click="triggerFileInput"
          :class="[
            'border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[180px]',
            isDragging
              ? 'border-indigo-500 bg-indigo-500/[0.04] scale-[1.01] shadow-lg shadow-indigo-500/5'
              : 'border-[var(--border-base)] bg-[var(--bg-card)] hover:border-indigo-400 hover:bg-slate-500/[0.01]',
          ]"
        >
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            @change="onFileSelected"
          />

          <!-- Uploading animation/progress -->
          <div v-if="isUploading" class="space-y-2.5 w-full px-2" @click.stop>
            <Loader2 class="w-7 h-7 text-indigo-500 animate-spin mx-auto" />
            <p class="text-xs font-bold text-[var(--text-primary)] truncate" :title="uploadStatusText">
              {{ uploadStatusText || '正在上传文件...' }}
            </p>
            <div class="w-full bg-[var(--border-base)] rounded-full h-2 overflow-hidden shadow-inner">
              <div
                class="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-300 rounded-full"
                :style="{ width: `${uploadProgress}%` }"
              ></div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono px-0.5">
              <span>{{ formatSize(uploadLoadedBytes) }} / {{ formatSize(uploadTotalBytes) }}</span>
              <span v-if="uploadSpeedStr && uploadProgress < 99" class="text-indigo-500 font-bold font-sans">{{ uploadSpeedStr }}</span>
              <span class="font-bold text-[var(--text-primary)]">{{ uploadProgress }}%</span>
            </div>
          </div>

          <!-- Default upload instructions -->
          <template v-else>
            <div
              class="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-2 shadow-sm"
            >
              <UploadCloud class="w-5 h-5" />
            </div>
            <h3 class="text-xs font-bold text-[var(--text-primary)]">上传新文件</h3>
            <p class="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed max-w-[200px] mx-auto">
              拖拽文件到此，或点击此处浏览上传
            </p>
          </template>
        </div>
      </div>

      <!-- Right column: File search and list -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Search bar -->
        <div class="relative">
          <Search class="absolute left-4 top-3.5 w-4 h-4 text-[var(--text-muted)]" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索临时网盘文件..."
            class="w-full pl-11 pr-4 py-3 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-card)] focus:ring-2 focus:ring-indigo-500/20 outline-none text-xs transition-all"
          />
        </div>

        <!-- Files list -->
        <div v-if="loading" class="flex items-center justify-center py-20 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-base)]">
          <Loader2 class="w-8 h-8 text-indigo-500 animate-spin" />
        </div>

        <div v-else-if="filteredFiles.length === 0" class="p-12 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border-base)] text-[var(--text-muted)] text-xs">
          <HardDrive class="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p>暂无临时文件，开始上传吧！</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="file in filteredFiles"
            :key="file.id"
            class="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-card)] hover:border-slate-300/60 dark:hover:border-white/10 transition-all flex items-center justify-between gap-4 shadow-sm"
          >
            <div class="flex items-center gap-3.5 min-w-0">
              <!-- File icon -->
              <div
                :class="[
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
                  getFileIconColor(file.name),
                ]"
              >
                <component :is="getFileIcon(file.mimeType, file.name)" class="w-5 h-5" />
              </div>
              
              <!-- File details -->
              <div class="min-w-0 text-xs">
                <h4 class="font-bold text-[var(--text-primary)] truncate" :title="file.name">
                  {{ file.name }}
                </h4>
                <div class="flex items-center gap-2.5 text-[var(--text-muted)] mt-1 font-mono text-[10px]">
                  <span>{{ formatSize(file.size) }}</span>
                  <span class="w-1 h-1 rounded-full bg-[var(--border-base)]"></span>
                  <span>{{ formatDate(file.createdAt) }}</span>
                  <span v-if="file.shares.length > 0" class="w-1 h-1 rounded-full bg-[var(--border-base)]"></span>
                  <span v-if="file.shares.length > 0" class="text-indigo-500 font-sans">
                    已生成 {{ file.shares.length }} 个分享
                  </span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 shrink-0">
              <!-- Download -->
              <button
                @click="handleDownload(file)"
                class="p-2 rounded-xl text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer border-none bg-transparent"
                title="下载文件"
              >
                <Download class="w-4 h-4" />
              </button>

              <!-- Share -->
              <button
                @click="openShareDialog(file)"
                class="p-2 rounded-xl text-[var(--text-secondary)] hover:text-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer border-none bg-transparent"
                title="分享链接"
              >
                <Share2 class="w-4 h-4" />
              </button>

              <!-- Delete -->
              <button
                @click="handleDelete(file)"
                class="p-2 rounded-xl text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-500/5 transition-all cursor-pointer border-none bg-transparent"
                title="删除文件"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Link Dialog -->
    <FormDialog
      v-model:visible="shareDialogVisible"
      title="创建分享链接"
      width="540px"
    >
      <div v-if="selectedFile" class="space-y-5 py-2 text-xs">
        <div class="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-[var(--border-base)]">
          <div :class="['w-9 h-9 rounded-xl flex items-center justify-center shrink-0', getFileIconColor(selectedFile.name)]">
            <component :is="getFileIcon(selectedFile.mimeType, selectedFile.name)" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <p class="font-bold text-[var(--text-primary)] truncate">{{ selectedFile.name }}</p>
            <p class="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">{{ formatSize(selectedFile.size) }}</p>
          </div>
        </div>

        <template v-if="!shareCreated">
          <!-- Password Protection Option -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Checkbox v-model="usePassword" />
              <label class="font-bold text-[var(--text-secondary)] cursor-pointer" @click="usePassword = !usePassword">启用密码保护 (提取码)</label>
            </div>
            
            <div v-if="usePassword" class="pl-6 animate-in slide-in-from-top-2 duration-200">
              <input
                v-model="sharePassword"
                type="text"
                maxlength="6"
                placeholder="输入 4-6 位字符密码或留空自动生成"
                class="w-full px-3 py-2 border border-[var(--border-base)] bg-[var(--bg-app)] rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-xs"
              />
            </div>
          </div>

          <!-- Expiration selection -->
          <div class="space-y-2">
            <label class="font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Calendar class="w-3.5 h-3.5" />
              有效期限
            </label>
            <el-select v-model="expiresDays" class="w-full custom-dialog-input">
              <el-option value="1" label="1天有效" />
              <el-option value="3" label="3天有效" />
              <el-option value="7" label="7天有效" />
              <el-option value="30" label="30天有效" />
              <el-option value="0" label="长期有效 (直至每日 auto-clean 清理点)" />
            </el-select>
            <p class="text-[10px] text-amber-500 flex items-center gap-1 mt-1">
              <Clock class="w-3 h-3" />
              注意：链接最长仅存活至每日 {{ cleanupTime }} 擦除时间，设置天数仅做在此之前的防刷缓存。
            </p>
          </div>

          <!-- Submit -->
          <div class="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              @click="shareDialogVisible = false"
            >取消</Button>
            <Button
              variant="primary"
              :disabled="isCreatingShare"
              @click="generateShare"
            >
              <Loader2 v-if="isCreatingShare" class="w-3.5 h-3.5 animate-spin" />
              生成链接
            </Button>
          </div>
        </template>

        <template v-else>
          <!-- Share URL generated output -->
          <div class="space-y-4">
            <div class="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <p class="font-bold">分享链接生成成功！</p>
              <p class="text-[10px] opacity-90 mt-1">可以直接复制下方配置并发给接收方。</p>
            </div>

            <div class="space-y-3 p-4 bg-slate-50 dark:bg-white/5 border border-[var(--border-base)] rounded-2xl font-mono text-[11px] leading-relaxed">
              <p>文件名称：{{ selectedFile.name }}</p>
              <p>文件大小：{{ formatSize(selectedFile.size) }}</p>
              <p>下载链接：<span class="text-indigo-500 break-all select-all">{{ generatedShareUrl }}</span></p>
              <p v-if="usePassword && sharePassword">提取密码：<strong class="text-[var(--text-primary)] font-bold text-xs select-all">{{ sharePassword }}</strong></p>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                @click="shareDialogVisible = false"
              >完成</Button>
              <Button
                variant="primary"
                @click="copyShareLink"
              >
                <component :is="copied ? Check : Copy" class="w-3.5 h-3.5" />
                复制一键口令
              </Button>
            </div>
          </div>
        </template>
      </div>
    </FormDialog>
    </template>

    <!-- Multi-threaded download overlay -->
    <DownloadProgressOverlay
      :is-downloading="isDownloading"
      :progress="downloadProgress"
      :speed-str="downloadSpeedStr"
      @cancel="cancelDownload"
    />
  </div>
</template>

<style scoped>
.custom-dialog-input :deep(.el-input__wrapper) {
  background-color: var(--bg-app) !important;
  border-color: var(--border-base) !important;
  box-shadow: none !important;
  border-radius: 12px;
  padding: 8px 12px;
}
</style>

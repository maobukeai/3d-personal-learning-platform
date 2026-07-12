<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

useHead({
  title: '公共临时网盘',
});

const config = useRuntimeConfig();

interface NetdiskFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  shares?: {
    id: string;
    password?: string | null;
  }[];
}

const files = ref<NetdiskFile[]>([]);
const usedBytes = ref(0);
const limitGb = ref(10);
const hasConfig = ref(false);
const loading = ref(false);
const searchQuery = ref('');

// Uploader states
const isDragging = ref(false);
const isUploading = ref(false);
const uploadProgress = ref(0);
const uploadStatusText = ref('');
const uploadSpeedStr = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

// Share dialog states
const shareDialogVisible = ref(false);
const usePassword = ref(false);
const sharePassword = ref('');
const shareCreated = ref(false);
const isCreatingShare = ref(false);
const generatedShareUrl = ref('');
const selectedFile = ref<NetdiskFile | null>(null);
const copyButtonText = ref('复制链接');

let activeXhr: XMLHttpRequest | null = null;

// Format file size (identical to main platform)
const formatSize = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format date (identical to main platform)
const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const fetchFiles = async () => {
  loading.value = true;
  try {
    const res = await $fetch<{
      hasConfig: boolean;
      files: NetdiskFile[];
      limitGb: number;
      usedBytes: number;
    }>(`${config.public.apiBase}/website/netdisk/files`);

    files.value = res.files || [];
    usedBytes.value = res.usedBytes || 0;
    limitGb.value = res.limitGb || 10;
    hasConfig.value = res.hasConfig;
  } catch (err) {
    console.error('Fetch netdisk files failed:', err);
  } finally {
    loading.value = false;
  }
};

const deleteFile = async (id: string) => {
  if (!confirm('确定要删除此共享文件吗？删除后所有网盘访客将无法下载。')) return;
  try {
    await $fetch(`${config.public.apiBase}/website/netdisk/files/${id}`, {
      method: 'DELETE',
    });
    fetchFiles();
  } catch (err: any) {
    alert(err.data?.error || '删除失败，请稍后重试');
  }
};

// Open share dialog
const openShareDialog = (file: NetdiskFile) => {
  selectedFile.value = file;
  usePassword.value = false;
  sharePassword.value = '';
  generatedShareUrl.value = '';
  shareCreated.value = false;
  copyButtonText.value = '复制链接';
  shareDialogVisible.value = true;
};

const closeShareDialog = () => {
  shareDialogVisible.value = false;
};

// Generate share link via backend
const generateShare = async () => {
  if (!selectedFile.value) return;
  isCreatingShare.value = true;
  try {
    const shareRes = await $fetch<{ id: string }>(
      `${config.public.apiBase}/website/netdisk/shares`,
      {
        method: 'POST',
        body: {
          fileId: selectedFile.value.id,
          password: usePassword.value ? sharePassword.value.trim() : undefined,
        },
      },
    );
    generatedShareUrl.value = `${config.public.appBase}/share/temporary/${shareRes.id}`;
    shareCreated.value = true;
    fetchFiles(); // Refresh count
  } catch (err: any) {
    alert(err.data?.error || '生成分享失败，请重试');
  } finally {
    isCreatingShare.value = false;
  }
};

// Copy share text to clipboard
const copyShareLink = async () => {
  if (!selectedFile.value) return;
  let text = `分享文件: ${selectedFile.value.name}\n下载链接: ${generatedShareUrl.value}`;
  if (usePassword.value && sharePassword.value.trim()) {
    text += `\n提取码: ${sharePassword.value.trim()}`;
  }
  try {
    await navigator.clipboard.writeText(text);
    copyButtonText.value = '已复制！';
    setTimeout(() => {
      copyButtonText.value = '复制链接';
    }, 2000);
  } catch (err) {
    alert('复制失败，请手动选择复制：\n' + text);
  }
};

// Computed property for filtering files
const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) return files.value;
  const q = searchQuery.value.toLowerCase().trim();
  return files.value.filter((f) => f.name.toLowerCase().includes(q));
});

// Quota calculations
const quotaPercent = computed(() => {
  const totalLimitBytes = limitGb.value * 1024 * 1024 * 1024;
  if (totalLimitBytes <= 0) return 0;
  const pct = (usedBytes.value / totalLimitBytes) * 100;
  return Math.min(100, parseFloat(pct.toFixed(1)));
});

// Drag and drop handlers
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
  const droppedFiles = e.dataTransfer?.files;
  if (droppedFiles && droppedFiles.length > 0) {
    handleFileUpload(droppedFiles[0]);
  }
};

const triggerFileSelect = () => {
  fileInput.value?.click();
};

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleFileUpload(target.files[0]);
  }
};

const cancelUpload = () => {
  if (activeXhr) {
    activeXhr.abort();
    activeXhr = null;
  }
  isUploading.value = false;
  uploadProgress.value = 0;
  uploadStatusText.value = '';
  uploadSpeedStr.value = '';
};

// Main file upload handler
const handleFileUpload = async (file: File) => {
  if (isUploading.value) return;

  const filename = file.name;
  const mimetype = file.type || 'application/octet-stream';
  const size = file.size;

  isUploading.value = true;
  uploadProgress.value = 0;
  uploadSpeedStr.value = '';
  uploadStatusText.value = '授权中...';

  const startTime = Date.now();
  let lastLoaded = 0;
  let lastTime = Date.now();

  try {
    const authRes = await $fetch<{
      isDirect: boolean;
      uploadUrl?: string;
      publicUrl?: string;
      key?: string;
    }>(`${config.public.apiBase}/website/netdisk/presigned-url`, {
      method: 'POST',
      body: { filename, mimetype, size },
    });

    if (authRes.isDirect && authRes.uploadUrl && authRes.key) {
      const { uploadUrl, key } = authRes;
      uploadStatusText.value = '正在上传云端存储...';

      activeXhr = new XMLHttpRequest();
      activeXhr.open('PUT', uploadUrl, true);
      activeXhr.setRequestHeader('Content-Type', mimetype);

      activeXhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const total = event.total;
          const percent = Math.min(Math.round((loaded / total) * 100), 99);
          uploadProgress.value = percent;

          const now = Date.now();
          const timeGap = (now - lastTime) / 1000;
          if (timeGap >= 0.5) {
            const bytesPerSec = (loaded - lastLoaded) / timeGap;
            if (bytesPerSec > 1024 * 1024) {
              uploadSpeedStr.value = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
            } else {
              uploadSpeedStr.value = `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
            }
            lastLoaded = loaded;
            lastTime = now;
          }
        }
      };

      activeXhr.onload = async () => {
        if (activeXhr && activeXhr.status >= 200 && activeXhr.status < 300) {
          uploadStatusText.value = '同步校验中...';
          try {
            await $fetch(`${config.public.apiBase}/website/netdisk/complete-single`, {
              method: 'POST',
              body: { filename, key, size, mimetype },
            });
            uploadProgress.value = 100;
            uploadStatusText.value = '已完成';
            setTimeout(() => {
              isUploading.value = false;
              fetchFiles();
            }, 600);
          } catch (err: any) {
            alert('同步失败: ' + (err.data?.error || err.message));
            cancelUpload();
          }
        } else {
          alert('直传失败，状态码: ' + activeXhr?.status);
          cancelUpload();
        }
      };

      activeXhr.onerror = () => {
        alert('文件直传发生网络错误');
        cancelUpload();
      };

      activeXhr.send(file);
    } else {
      // Fallback
      uploadStatusText.value = '直传服务器中...';
      const formData = new FormData();
      formData.append('temporary_file', file);

      activeXhr = new XMLHttpRequest();
      activeXhr.open('POST', `${config.public.apiBase}/website/netdisk/upload`, true);

      activeXhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const total = event.total;
          const percent = Math.min(Math.round((loaded / total) * 100), 99);
          uploadProgress.value = percent;

          const now = Date.now();
          const timeGap = (now - lastTime) / 1000;
          if (timeGap >= 0.5) {
            const bytesPerSec = (loaded - lastLoaded) / timeGap;
            if (bytesPerSec > 1024 * 1024) {
              uploadSpeedStr.value = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
            } else {
              uploadSpeedStr.value = `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
            }
            lastLoaded = loaded;
            lastTime = now;
          }
        }
      };

      activeXhr.onload = () => {
        if (activeXhr && activeXhr.status >= 200 && activeXhr.status < 300) {
          uploadProgress.value = 100;
          uploadStatusText.value = '已完成';
          setTimeout(() => {
            isUploading.value = false;
            fetchFiles();
          }, 600);
        } else {
          alert('上传失败，状态码: ' + activeXhr?.status);
          cancelUpload();
        }
      };

      activeXhr.onerror = () => {
        alert('上传发生网络错误');
        cancelUpload();
      };

      activeXhr.send(formData);
    }
  } catch (err: any) {
    alert(err.data?.error || '授权失败，请稍后重试');
    cancelUpload();
  }
};

const getDownloadUrl = (file: NetdiskFile): string => {
  return `${config.public.apiBase}/website/netdisk/files/${file.id}/download`;
};

onMounted(fetchFiles);
</script>

<template>
  <div class="netdisk-wrap page-content-wrap">
    <div class="netdisk-container glass-real-physical glass-panel-extreme">
      <!-- Minimalist apple style Header -->
      <div class="netdisk-header">
        <h1>临时云网盘</h1>
        <p>提供极简、高速的免登录共享存储空间。系统每日凌晨 3:00 自动清理所有文件。</p>
      </div>

      <!-- Storage Quota bar with unified formatSize -->
      <div class="quota-container">
        <div class="quota-info">
          <span class="quota-text"> 已使用 {{ formatSize(usedBytes) }}，共 {{ limitGb }} GB </span>
          <span class="quota-percent-label">{{ quotaPercent }}%</span>
        </div>
        <div class="quota-bar-bg">
          <div
            class="quota-bar-fill"
            :style="{ width: `${quotaPercent}%` }"
            :class="{ warning: quotaPercent > 75, danger: quotaPercent > 90 }"
          ></div>
        </div>
      </div>

      <!-- Minimal drag & drop area -->
      <div
        class="upload-dropzone"
        :class="{ dragging: isDragging, uploading: isUploading }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        @click="triggerFileSelect"
      >
        <input ref="fileInput" type="file" class="hidden" @change="onFileSelected" />

        <div v-if="!isUploading" class="dropzone-idle">
          <svg
            class="upload-arrow-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="16 16 12 12 8 16"></polyline>
            <line x1="12" y1="12" x2="12" y2="21"></line>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
          </svg>
          <span class="upload-title">拖拽文件到此处，或点击上传</span>
          <span class="upload-limit">单个文件限额 2GB</span>
        </div>

        <div v-else class="dropzone-uploading" @click.stop>
          <div class="upload-loader"></div>
          <span class="uploading-text">{{ uploadStatusText }}</span>
          <div class="upload-progress-container">
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" :style="{ width: `${uploadProgress}%` }"></div>
            </div>
            <div class="progress-details">
              <span>{{ uploadProgress }}%</span>
              <span class="upload-speed">{{ uploadSpeedStr }}</span>
            </div>
          </div>
          <button class="btn-cancel" type="button" @click="cancelUpload">取消</button>
        </div>
      </div>

      <!-- Finder style File list -->
      <div class="file-list-section">
        <div class="list-header">
          <h2 class="list-title">文件列表 ({{ filteredFiles.length }})</h2>
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索文件名"
              class="search-input"
            />
          </div>
        </div>

        <!-- Skeleton loaders -->
        <div v-if="loading && files.length === 0" class="loading-skeleton">
          <div v-for="i in 3" :key="i" class="skeleton-row">
            <div class="sk-cell sk-name"></div>
            <div class="sk-cell sk-size"></div>
            <div class="sk-cell sk-time"></div>
            <div class="sk-cell sk-action"></div>
          </div>
        </div>

        <!-- Finder Row list -->
        <div v-else-if="filteredFiles.length > 0" class="finder-list">
          <div class="finder-thead">
            <div class="col-name">文件名</div>
            <div class="col-size text-center">大小</div>
            <div class="col-date text-center">上传时间</div>
            <div class="col-actions text-right">操作</div>
          </div>

          <div class="finder-tbody">
            <div v-for="file in filteredFiles" :key="file.id" class="finder-row">
              <div class="col-name">
                <span class="file-icon">📄</span>
                <div class="file-name-container">
                  <span class="file-name" :title="file.name">{{ file.name }}</span>
                  <span v-if="file.shares && file.shares.length > 0" class="share-badge">
                    已生成 {{ file.shares.length }} 个分享
                  </span>
                </div>
              </div>
              <div class="col-size text-center">{{ formatSize(file.size) }}</div>
              <div class="col-date text-center">{{ formatDate(file.createdAt) }}</div>
              <div class="col-actions text-right">
                <button class="btn-pill" type="button" @click="openShareDialog(file)">分享</button>
                <a :href="getDownloadUrl(file)" class="btn-pill" target="_blank" rel="noopener">
                  下载
                </a>
                <button class="btn-pill btn-danger" type="button" @click="deleteFile(file.id)">
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">📁</div>
          <p>{{ searchQuery ? '未找到符合条件的文件' : '网盘中暂无任何共享文件' }}</p>
        </div>
      </div>
    </div>

    <!-- Apple style minimalist share modal -->
    <div v-if="shareDialogVisible" class="modal-overlay" @click="closeShareDialog">
      <div class="modal-card" @click.stop>
        <div class="modal-header">
          <h3>创建分享链接</h3>
          <button class="btn-close-modal" type="button" @click="closeShareDialog">✕</button>
        </div>

        <div class="modal-body">
          <template v-if="!shareCreated">
            <div class="form-group">
              <label class="checkbox-container">
                <input type="checkbox" v-model="usePassword" />
                <span class="checkbox-label">启用提取码保护</span>
              </label>
            </div>

            <div v-if="usePassword" class="form-group slide-fade">
              <input
                v-model="sharePassword"
                type="text"
                placeholder="输入 4 位自定义提取码 (可选)"
                maxlength="8"
                class="modal-input"
              />
            </div>
          </template>

          <template v-else>
            <div class="share-success-info">
              <div class="success-icon">✓</div>
              <p class="success-title">分享链接创建成功</p>
              <p class="success-desc">
                主站下载页面已对接到位，任何人均可通过此链接下载该共享文件。
              </p>
            </div>

            <div class="share-result-box">
              <div class="result-row">
                <span class="result-label">链接：</span>
                <span class="result-value select-all">{{ generatedShareUrl }}</span>
              </div>
              <div v-if="usePassword && sharePassword" class="result-row">
                <span class="result-label">提取码：</span>
                <span class="result-value font-bold">{{ sharePassword }}</span>
              </div>
            </div>
          </template>
        </div>

        <div class="modal-footer">
          <template v-if="!shareCreated">
            <button class="btn-modal-cancel" type="button" @click="closeShareDialog">取消</button>
            <button
              class="btn-modal-primary"
              type="button"
              :disabled="isCreatingShare"
              @click="generateShare"
            >
              {{ isCreatingShare ? '创建中...' : '生成链接' }}
            </button>
          </template>
          <template v-else>
            <button class="btn-modal-cancel" type="button" @click="closeShareDialog">完成</button>
            <button class="btn-modal-primary" type="button" @click="copyShareLink">
              {{ copyButtonText }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

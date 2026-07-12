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

let activeXhr: XMLHttpRequest | null = null;

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  if (!confirm('确定要永久删除此文件吗？共享容量中的文件删除后不可恢复。')) return;
  try {
    await $fetch(`${config.public.apiBase}/website/netdisk/files/${id}`, {
      method: 'DELETE',
    });
    fetchFiles();
  } catch (err: any) {
    alert(err.data?.error || '删除失败，请稍后重试');
  }
};

// Computed property for filtering files
const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) return files.value;
  const q = searchQuery.value.toLowerCase().trim();
  return files.value.filter((f) => f.name.toLowerCase().includes(q));
});

// Quota calculations
const usedGb = computed(() => (usedBytes.value / (1024 * 1024 * 1024)).toFixed(3));
const quotaPercent = computed(() => {
  const totalLimitBytes = limitGb.value * 1024 * 1024 * 1024;
  if (totalLimitBytes <= 0) return 0;
  return Math.min(Math.round((usedBytes.value / totalLimitBytes) * 100), 100);
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
  uploadStatusText.value = '申请直传授权中...';

  const startTime = Date.now();
  let lastLoaded = 0;
  let lastTime = Date.now();

  try {
    // 1. Get Upload Authorization
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

      // 2. Direct S3/R2 upload using XMLHttpRequest to track progress natively
      uploadStatusText.value = '正在直传云存储...';

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
          uploadStatusText.value = '同步数据库中...';
          try {
            await $fetch(`${config.public.apiBase}/website/netdisk/complete-single`, {
              method: 'POST',
              body: { filename, key, size, mimetype },
            });
            uploadProgress.value = 100;
            uploadStatusText.value = '上传完成！';
            setTimeout(() => {
              isUploading.value = false;
              fetchFiles();
            }, 800);
          } catch (err: any) {
            alert('文件写入记录失败: ' + (err.data?.error || err.message));
            cancelUpload();
          }
        } else {
          alert('直传失败，状态码: ' + activeXhr?.status);
          cancelUpload();
        }
      };

      activeXhr.onerror = () => {
        alert('文件传输过程中发生网络错误');
        cancelUpload();
      };

      activeXhr.send(file);
    } else {
      // 3. Fallback upload to backend server directly via FormData
      uploadStatusText.value = '正在分段传输到服务器...';
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
          uploadStatusText.value = '上传完成！';
          setTimeout(() => {
            isUploading.value = false;
            fetchFiles();
          }, 800);
        } else {
          alert('服务器上传失败，状态码: ' + activeXhr?.status);
          cancelUpload();
        }
      };

      activeXhr.onerror = () => {
        alert('文件传输过程中发生网络错误');
        cancelUpload();
      };

      activeXhr.send(formData);
    }
  } catch (err: any) {
    alert(err.data?.error || '获取直传授权失败，请稍后重试');
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
      <div class="netdisk-header">
        <h1>临时云网盘</h1>
        <p>免登录、高速公共临时共享网盘，所有上传文件将在每日凌晨 3 点自动清空。</p>
      </div>

      <!-- Quota Capacity indicator bar -->
      <div class="quota-container">
        <div class="quota-info">
          <span class="quota-text"
            >存储配额已用：<strong>{{ usedGb }} GB</strong> / {{ limitGb }} GB</span
          >
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

      <!-- Drag & Drop upload Zone -->
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
          <div class="upload-icon">☁️</div>
          <span class="upload-title">拖拽文件到此处，或点击选择文件上传</span>
          <span class="upload-limit">最大支持直传 2GB 的单文件</span>
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
          <button class="btn-cancel" type="button" @click="cancelUpload">取消上传</button>
        </div>
      </div>

      <!-- Search & File lists -->
      <div class="file-list-section">
        <div class="list-header">
          <h2 class="list-title">公共共享文件 ({{ filteredFiles.length }})</h2>
          <div class="search-box">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索文件名..."
              class="search-input"
            />
            <span class="search-icon">🔍</span>
          </div>
        </div>

        <!-- Skeleton loader -->
        <div v-if="loading && files.length === 0" class="loading-skeleton">
          <div v-for="i in 3" :key="i" class="skeleton-row">
            <div class="sk-cell sk-name"></div>
            <div class="sk-cell sk-size"></div>
            <div class="sk-cell sk-time"></div>
            <div class="sk-cell sk-action"></div>
          </div>
        </div>

        <!-- File lists table -->
        <div v-else-if="filteredFiles.length > 0" class="table-container">
          <table class="file-table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>大小</th>
                <th>上传时间</th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in filteredFiles" :key="file.id">
                <td class="file-name-cell">
                  <span class="file-icon">📄</span>
                  <span class="file-name" :title="file.name">{{ file.name }}</span>
                </td>
                <td class="file-size-cell">{{ formatSize(file.size) }}</td>
                <td class="file-date-cell">{{ formatDate(file.createdAt) }}</td>
                <td class="file-actions-cell text-right">
                  <a
                    :href="getDownloadUrl(file)"
                    class="action-btn download"
                    target="_blank"
                    rel="noopener"
                    title="下载文件"
                  >
                    下载 📥
                  </a>
                  <button
                    class="action-btn delete"
                    type="button"
                    title="删除文件"
                    @click="deleteFile(file.id)"
                  >
                    删除 🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">📁</div>
          <p>{{ searchQuery ? '未找到符合条件的文件' : '网盘里空空的，快去上传第一个文件吧' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

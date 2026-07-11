<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMultiThreadDownload } from '@/composables/useMultiThreadDownload';
import DownloadProgressOverlay from '@/components/ui/DownloadProgressOverlay.vue';
import {
  File,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Box as BoxIcon,
  Video as VideoIcon,
  Download,
  Clock,
  Lock,
  Unlock,
  Loader2,
  HardDrive,
  Copy,
  Check,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { ElMessage } from '@/utils/feedbackBridge';
import { useSystemStore } from '@/stores/system';
import Button from '@/components/ui/Button.vue';
import GlassCard from '@/components/ui/GlassCard.vue';
import { useThemeManager } from '@/layouts/composables/useThemeManager';

const { currentTheme, currentBackground, initTheme, cleanupTheme } = useThemeManager();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const systemStore = useSystemStore();

const siteTitle = computed(() => systemStore.settings.PLATFORM_NAME || '3D PLP');
const { isDownloading, downloadProgress, downloadSpeedStr, cancelDownload, runDownload } =
  useMultiThreadDownload();

const shareId = route.params.shareId as string;

// States
const loading = ref(true);
const errorMsg = ref('');
const isExpired = ref(false);
const shareInfo = ref<any | null>(null);

// Verification States
const passwordInput = ref('');
const isVerified = ref(false);
const isVerifying = ref(false);

const copied = ref(false);

// Format file size
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext))
    return 'text-emerald-500 bg-emerald-500/10';
  if (['mp4', 'mov', 'avi'].includes(ext)) return 'text-rose-500 bg-rose-500/10';
  if (['pdf', 'doc', 'txt'].includes(ext)) return 'text-sky-500 bg-sky-500/10';
  return 'text-slate-500 bg-slate-500/10';
};

// Load share details
const fetchShareInfo = async () => {
  loading.value = true;
  errorMsg.value = '';
  isExpired.value = false;
  try {
    const { data } = await api.get(`/api/temporary-netdisk/share/${shareId}`);
    shareInfo.value = data;
    if (!data.hasPassword) {
      isVerified.value = true;
    }
  } catch (error: any) {
    if (error.response?.status === 410) {
      isExpired.value = true;
      errorMsg.value = '该分享链接已过期失效';
    } else {
      errorMsg.value = getApiErrorMessage(error, '加载分享文件失败，链接可能已被取消或不存在');
    }
  } finally {
    loading.value = false;
  }
};

// Verify Password
const verifyPassword = async () => {
  if (!passwordInput.value.trim()) {
    ElMessage.warning('请输入提取码');
    return;
  }

  isVerifying.value = true;
  try {
    await api.post(`/api/temporary-netdisk/share/${shareId}/verify`, {
      password: passwordInput.value.trim(),
    });
    isVerified.value = true;
    ElMessage.success('密码提取成功，可以下载文件了！');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '提取码不正确，请重新输入'));
  } finally {
    isVerifying.value = false;
  }
};

// Trigger download
const handleDownload = () => {
  // Construct direct download endpoint URL
  let downloadUrl = `${api.defaults.baseURL || ''}/api/temporary-netdisk/share/${shareId}/download`;
  if (shareInfo.value.hasPassword) {
    downloadUrl += `?password=${encodeURIComponent(passwordInput.value.trim())}`;
  }

  runDownload({
    url: downloadUrl,
    filename: shareInfo.value.fileName,
    totalSizeOverrideBytes: shareInfo.value.fileSize,
  });
};

const copyShareUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copied.value = true;
    ElMessage.success('链接已复制');
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    ElMessage.error('复制链接失败');
  }
};

onMounted(() => {
  initTheme();
  systemStore.fetchSettings();
  fetchShareInfo();
});

onUnmounted(cleanupTheme);
</script>

<template>
  <div
    class="min-h-[100vh] w-full flex items-center justify-center bg-[var(--bg-app)] relative overflow-hidden py-12 px-4"
  >
    <!-- Enterprise canvas background decoration -->
    <div
      v-show="currentTheme.startsWith('glass')"
      :class="[
        'enterprise-canvas absolute inset-0 overflow-hidden pointer-events-none z-0',
        'bg-style-' + currentBackground,
      ]"
    ></div>

    <div class="w-full max-w-[500px] relative z-10 animate-in fade-in zoom-in-95 duration-500">
      <GlassCard
        class="p-6 sm:p-10 shadow-2xl rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)]/80 backdrop-blur-xl"
      >
        <!-- Header Brand -->
        <div class="flex items-center justify-center gap-2 mb-8">
          <div
            class="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm"
          >
            <HardDrive class="w-4 h-4" />
          </div>
          <span class="text-sm font-bold tracking-wide text-[var(--text-primary)]"
            >{{ siteTitle }} 临时中转站</span
          >
        </div>

        <!-- Loading spinner -->
        <div v-if="loading" class="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 class="w-8 h-8 text-indigo-500 animate-spin" />
          <p class="text-xs text-[var(--text-muted)]">加载分享详情中...</p>
        </div>

        <!-- Error / Expiration view -->
        <div v-else-if="errorMsg" class="text-center py-6 space-y-4 text-xs">
          <div
            class="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto shadow-sm"
          >
            <Clock class="w-6 h-6" />
          </div>
          <h2 class="text-sm font-bold text-[var(--text-primary)]">链接失效或已过期</h2>
          <p class="text-[var(--text-muted)] max-w-[280px] mx-auto leading-relaxed">
            {{ errorMsg }}。临时网盘仅供短途传输，所有文件将在每日 auto-clean 点被自动抹除。
          </p>
          <div class="pt-2">
            <Button variant="outline" @click="router.push('/dashboard')">返回工作台</Button>
          </div>
        </div>

        <!-- Share Info View -->
        <div v-else class="space-y-6 text-xs">
          <!-- File details card -->
          <div
            class="flex flex-col items-center text-center p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-[var(--border-base)]"
          >
            <div
              :class="[
                'w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-4',
                getFileIconColor(shareInfo.fileName),
              ]"
            >
              <component
                :is="getFileIcon(shareInfo.mimeType, shareInfo.fileName)"
                class="w-8 h-8"
              />
            </div>
            <h2
              class="text-sm font-bold text-[var(--text-primary)] break-all max-w-full px-2"
              :title="shareInfo.fileName"
            >
              {{ shareInfo.fileName }}
            </h2>
            <div
              class="flex items-center gap-3 text-[var(--text-muted)] font-mono text-[10px] mt-2"
            >
              <span>大小: {{ formatSize(shareInfo.fileSize) }}</span>
              <span class="w-1 h-1 rounded-full bg-[var(--border-base)]"></span>
              <span>分享者: {{ shareInfo.ownerName }}</span>
            </div>
          </div>

          <!-- Password required / verify box -->
          <div v-if="!isVerified" class="space-y-4 animate-in fade-in duration-300">
            <div class="text-center space-y-1.5 mb-2">
              <p
                class="font-bold text-[var(--text-primary)] flex items-center justify-center gap-1.5"
              >
                <Lock class="w-4 h-4 text-indigo-500" />
                提取码保护
              </p>
              <p class="text-[10px] text-[var(--text-muted)]">
                该文件已受密码保护，请输入提取密码以继续下载。
              </p>
            </div>

            <div class="flex gap-2">
              <input
                v-model="passwordInput"
                type="text"
                placeholder="请输入提取密码"
                class="flex-1 px-4 py-3 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] focus:ring-2 focus:ring-indigo-500/20 outline-none text-xs text-center font-mono tracking-widest"
                @keyup.enter="verifyPassword"
              />
              <Button
                variant="primary"
                :disabled="isVerifying"
                class="px-5 shrink-0"
                @click="verifyPassword"
              >
                <Loader2 v-if="isVerifying" class="w-4 h-4 animate-spin" />
                <span v-else>验证提取</span>
              </Button>
            </div>
          </div>

          <!-- Verified download details -->
          <div v-else class="space-y-4 animate-in fade-in duration-300">
            <div
              class="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-600 dark:text-amber-400 flex items-start gap-2.5"
            >
              <Clock class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <p class="text-[10px] leading-relaxed opacity-95">
                安全中转警告：该资源为临时资源，随时可能被每日系统自动擦除任务清理。提取后请在本地保存。
              </p>
            </div>

            <div class="flex gap-2.5">
              <Button variant="outline" class="flex-1 py-3" @click="copyShareUrl">
                <component :is="copied ? Check : Copy" class="w-3.5 h-3.5 mr-1.5" />
                复制网页链接
              </Button>

              <Button variant="primary" class="flex-1 py-3" @click="handleDownload">
                <Download class="w-3.5 h-3.5 mr-1.5" />
                立即下载
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>

    <!-- Multi-threaded download overlay -->
    <DownloadProgressOverlay
      :is-downloading="isDownloading"
      :progress="downloadProgress"
      :speed-str="downloadSpeedStr"
      @cancel="cancelDownload"
    />
  </div>
</template>

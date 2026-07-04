<script setup lang="ts">
import { ref, watch, computed, defineAsyncComponent } from 'vue';
import 'md-editor-v3/lib/preview.css';
import { logError } from '@/utils/error';
import { useThemeObserver } from '@/composables/useThemeObserver';

const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));

const { isDark } = useThemeObserver();
import {
  CheckCircle2,
  Download,
  Edit3,
  FileArchive,
  Heart,
  Trash2,
  XCircle,
  FolderOpen,
  Folder,
  Box,
  Image as ImageIcon,
  RefreshCw,
  Share2,
  Shield,
  Settings,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import { useFileTree } from '@/composables/useFileTree';
import { useResourceComments } from '@/composables/useResourceComments';
import { useMultiThreadDownload } from '@/composables/useMultiThreadDownload';
import DownloadProgressOverlay from '@/components/ui/DownloadProgressOverlay.vue';
import { useLabel } from '@/utils/i18n';
import Modal from '@/components/ui/Modal.vue';
import { useAuthStore } from '@/stores/auth';
import ShareDialog from './ShareDialog.vue';

type MaterialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface NormalizedMaterial {
  id: string;
  title: string;
  description: string;
  previewUrl?: string | null;
  fileUrl?: string | null;
  fileSize: number;
  status?: MaterialStatus;
  rejectReason?: string | null;
  downloads: number;
  userId?: string;
  teamId?: string | null;
  createdAt?: string;
  user?: {
    id?: string;
    name?: string | null;
    avatarUrl?: string | null;
  } | null;
  isFree?: boolean;
  category: string;
  preview: string;
  resolution: string;
  favorites: number;
  isFavorited?: boolean;
  originality?: string;
  originalLink?: string | null;
  license?: string;
  isProcedural?: boolean;
  tags: string[];
  bilibiliUrl?: string | null;
}

const props = withDefaults(
  defineProps<{
    material: NormalizedMaterial;
    loading?: boolean;
    myMaterials?: NormalizedMaterial[];
    isAdmin?: boolean;
    canEdit?: boolean;
    canDownload?: boolean;
    isSavingReview?: boolean;
    inline?: boolean;
  }>(),
  {
    loading: false,
    myMaterials: () => [],
    isAdmin: false,
    canEdit: false,
    canDownload: false,
    isSavingReview: false,
    inline: false,
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'favorite'): void;
  (e: 'download'): void;
  (e: 'edit', item: NormalizedMaterial): void;
  (e: 'select', item: NormalizedMaterial): void;
  (e: 'delete'): void;
  (e: 'review-approved'): void;
  (e: 'review-rejected'): void;
  (e: 'update'): void;
}>();

const label = useLabel();

// packageFiles is loaded asynchronously via a dedicated endpoint
const packageFiles = ref<string[]>([]);
const isPackageFilesLoading = ref(false);
const isFilesCollapsed = ref(true);

const parsedFileTree = computed(() => {
  const tree = buildFileTree(packageFiles.value);
  return flattenFileTree(tree);
});

const handleApprove = () => {
  console.log('MaterialDetailPanel: Emitting review-approved event for material', props.material);
  emit('review-approved');
};

const handleReject = () => {
  console.log('MaterialDetailPanel: Emitting review-rejected event for material', props.material);
  emit('review-rejected');
};

const handleDelete = () => {
  console.log('MaterialDetailPanel: Emitting delete event for material', props.material);
  emit('delete');
};

const { expandedFolders, toggleFolder, visibleFileNodes, resetExpansion } =
  useFileTree(parsedFileTree);

const fetchPackageFiles = async (id: string) => {
  if (!id) return;
  isPackageFilesLoading.value = true;
  try {
    const { data } = await api.get(`/api/materials/${id}/package-files`);
    if (props.material?.id === id) {
      packageFiles.value = data.packageFiles || [];
    }
  } catch (err) {
    logError(err, { operation: 'fetch material package files' });
    if (props.material?.id === id) {
      packageFiles.value = [];
    }
  } finally {
    if (props.material?.id === id) {
      isPackageFilesLoading.value = false;
    }
  }
};

// Watcher moved to the bottom of setup to prevent early initialization reference error

const pbrChannels = computed(() => {
  const files = packageFiles.value || [];

  const channelsList = [
    {
      name: label('基础颜色 (Base Color / Albedo)', 'Albedo / Diffuse'),
      key: 'albedo',
      patterns: ['albedo', 'diffuse', 'color', 'basecolor', 'col', 'diff'],
      matchedFile: null as string | null,
    },
    {
      name: label('法线贴图 (Normal GL/DX)', 'Normal Map'),
      key: 'normal',
      patterns: ['normal', 'nor', 'nrm', 'gl', 'dx'],
      matchedFile: null as string | null,
    },
    {
      name: label('粗糙度 (Roughness)', 'Roughness'),
      key: 'roughness',
      patterns: ['roughness', 'rough', 'rgh'],
      matchedFile: null as string | null,
    },
    {
      name: label('金属感 (Metallic)', 'Metallic'),
      key: 'metallic',
      patterns: ['metallic', 'metal', 'met'],
      matchedFile: null as string | null,
    },
    {
      name: label('高度/置换 (Height / Displacement)', 'Displacement'),
      key: 'height',
      patterns: ['height', 'displacement', 'disp', 'hgt'],
      matchedFile: null as string | null,
    },
    {
      name: label('环境光遮蔽 (Ambient Occlusion)', 'AO Map'),
      key: 'ao',
      patterns: ['ao', 'occlusion', 'ambient'],
      matchedFile: null as string | null,
    },
  ];

  for (const channel of channelsList) {
    const match = files.find((filePath) => {
      const fileName = filePath.split('/').pop()?.toLowerCase() || '';
      const isImg = /\.(png|jpg|jpeg|tga|dds|exr|hdr|tiff|bmp)$/i.test(filePath);
      if (!isImg) return false;

      return channel.patterns.some((pattern) => {
        if (pattern === 'ao' && fileName.includes('albedo')) return false;
        if (pattern === 'gl' && fileName.includes('roughness')) return false;
        return fileName.includes(pattern);
      });
    });

    if (match) {
      channel.matchedFile = match.split('/').pop() || match;
    }
  }

  return channelsList;
});

// Download states
const { isDownloading, downloadProgress, downloadSpeedStr, cancelDownload, runDownload } =
  useMultiThreadDownload();

const isExternal = computed(() => {
  const originality = props.material.originality;
  const fileUrl = props.material.fileUrl;
  if (originality === 'AUTHORIZED' || originality === 'REMIX') {
    return true;
  }
  if (fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
    const lowerUrl = fileUrl.toLowerCase();
    const isArchive = lowerUrl.endsWith('.zip') || lowerUrl.includes('.zip?') ||
                      lowerUrl.endsWith('.rar') || lowerUrl.includes('.rar?') ||
                      lowerUrl.endsWith('.7z') || lowerUrl.includes('.7z?');
    return !isArchive;
  }
  return false;
});

const handleMaterialDownload = async () => {
  const downloadUrl = props.material.fileUrl;
  if (isExternal.value) {
    const targetUrl = props.material.originalLink || downloadUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
      await api.post(`/api/materials/${props.material.id}/download`).catch(() => {});
      emit('download');
    } else {
      ElMessage.warning(label('源站链接不存在', 'Source link not found'));
    }
    return;
  }

  if (!props.canDownload) {
    ElMessage.warning(
      label('该材质审核通过后才能下载', 'This material can be downloaded after approval'),
    );
    return;
  }
  if (!downloadUrl) {
    ElMessage.warning(label('文件不存在', 'File not found'));
    return;
  }

  const ext = downloadUrl.split('.').pop()?.split('?')[0] || 'zip';
  const safeTitle = (props.material.title || 'material').replace(
    /[^a-zA-Z0-9\u4e00-\u9fff._-]/g,
    '_',
  );
  const resolvedUrl = getAssetUrl(downloadUrl);

  const totalSizeOverrideBytes = (props.material.fileSize || 0) * 1024 * 1024;

  await runDownload({
    url: resolvedUrl,
    filename: `${safeTitle}.${ext}`,
    totalSizeOverrideBytes,
    onSuccess: async () => {
      // Record download on backend
      await api.post(`/api/materials/${props.material.id}/download`);
      emit('download');
      emit('update');
    },
    onError: (err) => {
      const msg = err.response?.data?.error || label('下载失败', 'Download failed');
      ElMessage.error(msg);
    },
  });
};

const authStore = useAuthStore();

const shareDialogRef = ref<any>(null);

const {
  comments,
  isCommentsLoading,
  newCommentContent,
  isSubmittingComment,
  fetchComments,
  handlePostComment,
  handleDeleteComment,
  canDeleteComment,
} = useResourceComments('materials', () => props.material?.id);

const handleShare = () => {
  shareDialogRef.value?.open({
    id: props.material.id,
    title: props.material.title,
    userId: props.material.userId || '',
    createdAt: props.material.createdAt || '',
    previewUrl: props.material.previewUrl || null,
  });
};

const selectedPreviewUrl = ref<string | null>(null);

const handleChannelClick = (channel: any) => {
  if (!channel.matchedFile) return;
  const pathPart = encodeURIComponent(channel.matchedFile);
  const targetUrl = getAssetUrl(`/api/materials/${props.material.id}/zip-entry?path=${pathPart}`);

  if (selectedPreviewUrl.value === targetUrl) {
    selectedPreviewUrl.value = null; // Toggle off if clicked again
  } else {
    selectedPreviewUrl.value = targetUrl;
  }
};

watch(
  () => props.material?.id,
  (newId) => {
    if (newId) {
      resetExpansion();
      packageFiles.value = [];
      selectedPreviewUrl.value = null;
      isFilesCollapsed.value = true;
      fetchPackageFiles(newId);
      fetchComments();
    }
  },
  { immediate: true },
);

const activePreviewTab = ref<'image' | 'video'>('image');
watch(
  () => props.material?.id,
  () => {
    activePreviewTab.value = 'image';
  }
);
const getBilibiliEmbedUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const match = url.match(/video\/(BV[a-zA-Z0-9]+)/i) || url.match(/bvid=(BV[a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return `//player.bilibili.com/player.html?bvid=${match[1]}&page=1&high_quality=1&as_wide=1&autoplay=0&danmaku=0`;
  }
  return undefined;
};
</script>

<template>
  <component
    :is="inline ? 'div' : Modal"
    v-bind="
      inline
        ? { class: 'w-full' }
        : { show: !!material, size: 'xxl', padding: 'md', glassCard: true }
    "
    @close="emit('close')"
  >
    <template v-if="!inline" #header>
      <div class="flex items-center gap-3">
        <ImageIcon class="h-5 w-5 text-indigo-400" />
        <div>
          <h3
            class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)] flex items-center gap-2"
          >
            <span>{{ material.title }}</span>
            <span
              v-if="!material.isFree"
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse"
            >
              会员专享下载
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
            >
              免费下载
            </span>
          </h3>
          <p class="text-xs text-[var(--text-muted)] mt-0.5">
            {{ material.category || label('未分类', 'Uncategorized') }}
          </p>
        </div>
      </div>
    </template>

    <!-- Inline header for share view -->
    <div
      v-if="inline && material"
      class="premium-card-header flex items-center justify-between mb-5 pb-3 border-b border-[var(--border-base)] text-left"
    >
      <div class="flex items-center gap-3">
        <ImageIcon class="h-5 w-5 text-indigo-400" />
        <div>
          <h3
            class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)] flex items-center gap-2"
          >
            <span>{{ material.title }}</span>
            <span
              v-if="!material.isFree"
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30"
            >
              会员专享下载
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
            >
              免费下载
            </span>
          </h3>
          <p class="text-xs text-[var(--text-muted)] mt-0.5">
            {{ material.category || label('未分类', 'Uncategorized') }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="loading"
      class="flex flex-col items-center justify-center py-20 gap-3 text-[var(--text-secondary)]"
    >
      <RefreshCw class="h-8 w-8 animate-spin text-teal-400" />
      <span class="text-xs font-semibold tracking-wider uppercase">{{
        label('正在载入材质档案...', 'Loading material...')
      }}</span>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <!-- Left Column: Prominent Preview area & Inline Discussions -->
        <div
          class="xl:col-span-7 flex flex-col gap-6 text-left"
          :class="inline ? '' : 'overflow-y-auto max-h-[75vh] pr-1.5 custom-scrollbar'"
        >
          <!-- Preview Mode Selector -->
          <div
            v-if="material.bilibiliUrl"
            class="flex items-center gap-1 p-0.5 bg-black/20 dark:bg-white/5 backdrop-blur-md rounded-lg border border-white/10 self-start"
          >
            <button
              type="button"
              class="px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border-none"
              :class="activePreviewTab === 'image' ? 'bg-teal-500 text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-white'"
              @click="activePreviewTab = 'image'"
            >
              图片预览
            </button>
            <button
              type="button"
              class="px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border-none"
              :class="activePreviewTab === 'video' ? 'bg-teal-500 text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-white'"
              @click="activePreviewTab = 'video'"
            >
              视频演示
            </button>
          </div>

          <!-- Prominent Square Preview Container -->
          <div
            class="relative w-full aspect-square sm:max-h-[480px] rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center group shrink-0"
          >
            <iframe
              v-if="activePreviewTab === 'video' && getBilibiliEmbedUrl(material.bilibiliUrl)"
              :src="getBilibiliEmbedUrl(material.bilibiliUrl)"
              scrolling="no"
              border="0"
              frameborder="no"
              framespacing="0"
              allowfullscreen="true"
              class="w-full h-full absolute inset-0 z-20"
            ></iframe>

            <img
              v-if="activePreviewTab === 'image' && (selectedPreviewUrl || material.preview)"
              :src="selectedPreviewUrl || material.preview"
              class="w-full h-full object-cover filter blur-md opacity-25 absolute inset-0 scale-105"
              alt="Background blur"
            />
            <img
              v-if="activePreviewTab === 'image' && (selectedPreviewUrl || material.preview)"
              :src="selectedPreviewUrl || material.preview"
              class="w-full h-full object-contain relative z-10"
              alt="Material Preview"
            />
            <div
              v-else
              class="text-center text-[var(--text-muted)] text-sm flex flex-col items-center gap-2 relative z-10"
            >
              <ImageIcon class="h-10 w-10 text-white/20" />
              <span>{{ label('暂无预览图', 'No Preview Available') }}</span>
            </div>

            <!-- Float Badge -->
            <div class="absolute top-3 left-3 z-20 flex gap-2">
              <span
                v-if="material.status === 'APPROVED'"
                class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
              >
                {{ label('已发布', 'Approved') }}
              </span>
              <span
                v-else-if="material.status === 'PENDING'"
                class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
              >
                {{ label('审核中', 'Pending') }}
              </span>
              <span
                v-else
                class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-semibold"
              >
                {{ label('未通过', 'Rejected') }}
              </span>
            </div>

            <!-- Floating Overlay for Channel Preview -->
            <div
              v-if="selectedPreviewUrl"
              class="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-md border-t border-white/10 px-4 py-2.5 z-20 flex items-center justify-between text-xs text-white"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                <span class="font-bold truncate text-left">{{
                  label('正在预览贴图通道', 'Previewing texture map channel')
                }}</span>
              </div>
              <button
                type="button"
                class="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 border-0 text-white text-[10px] font-bold cursor-pointer transition-colors"
                @click="selectedPreviewUrl = null"
              >
                {{ label('恢复主预览', 'Reset View') }}
              </button>
            </div>
          </div>

          <!-- PBR Map Channel Explorer Grid -->
          <div
            class="border border-white/10 rounded-2xl p-4 bg-white/[0.01] dark:bg-white/[0.02] shrink-0"
          >
            <h3
              class="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3 flex items-center justify-between"
            >
              <span>{{ label('贴图通道解析', 'Texture Maps & Channels') }}</span>
              <span class="text-[10px] text-[var(--text-muted)] font-normal normal-case">
                {{
                  label(
                    '自动识别压缩包内的 PBR 贴图文件',
                    'Auto-identified PBR textures from package',
                  )
                }}
              </span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div
                v-for="channel in pbrChannels"
                :key="channel.key"
                class="p-3 rounded-xl border transition-all duration-300 flex flex-col gap-2 relative overflow-hidden text-left"
                :class="[
                  channel.matchedFile
                    ? 'border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/5'
                    : 'border-white/5 bg-white/[0.005] opacity-60 cursor-not-allowed',
                  selectedPreviewUrl &&
                  selectedPreviewUrl.includes(encodeURIComponent(channel.matchedFile || ''))
                    ? '!border-teal-500 !bg-teal-500/10 shadow-lg'
                    : '',
                ]"
                @click="channel.matchedFile && handleChannelClick(channel)"
              >
                <!-- Card header: Name and Status -->
                <div class="flex items-center justify-between gap-2">
                  <span class="font-bold text-[var(--text-primary)] truncate">{{
                    channel.name
                  }}</span>
                  <span
                    class="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase"
                    :class="
                      channel.matchedFile
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/5 text-[var(--text-muted)] border border-white/5'
                    "
                  >
                    {{
                      channel.matchedFile ? label('已包含', 'Included') : label('未找到', 'Missing')
                    }}
                  </span>
                </div>

                <!-- Card body: Filename -->
                <div class="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2
                    v-if="channel.matchedFile"
                    class="h-3.5 w-3.5 text-emerald-400 shrink-0"
                  />
                  <span
                    v-else
                    class="h-3.5 w-3.5 rounded-full border border-dashed border-white/20 shrink-0"
                  ></span>

                  <span
                    class="truncate font-mono text-[10px] text-left"
                    :class="
                      channel.matchedFile
                        ? 'text-[var(--text-secondary)] font-semibold'
                        : 'text-[var(--text-muted)] italic'
                    "
                    :title="channel.matchedFile || ''"
                  >
                    {{
                      channel.matchedFile ||
                      label('压缩包中未检测到此通道文件', 'No matching file found in package')
                    }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Inline Discussions Section -->
          <div class="flex flex-col gap-4 pt-4 border-t border-white/10">
            <h3
              class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-l-2 border-indigo-500 pl-2"
            >
              <span>{{ label('用户讨论与反馈', 'Discussions & Feedback') }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-[var(--text-muted)] font-mono"
                >{{ comments.length }}</span
              >
            </h3>

            <!-- Post Comment Form -->
            <div
              v-if="authStore.user"
              class="flex flex-col gap-2 bg-white/[0.01] border border-white/5 rounded-2xl p-4"
            >
              <textarea
                v-model="newCommentContent"
                :placeholder="
                  label('发表您的想法和建议...', 'Post your thoughts and suggestions...')
                "
                class="w-full min-h-[80px] bg-white/[0.03] dark:bg-black/[0.1] border border-[var(--border-base)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:border-indigo-500 outline-none resize-none placeholder-[var(--text-muted)]"
              ></textarea>
              <div class="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="isSubmittingComment || !newCommentContent.trim()"
                  @click="handlePostComment"
                >
                  <span class="text-xs">{{
                    isSubmittingComment
                      ? label('发表中...', 'Posting...')
                      : label('发表评论', 'Post Comment')
                  }}</span>
                </Button>
              </div>
            </div>
            <div
              v-else
              class="text-center py-4 bg-white/[0.02] dark:bg-black/[0.05] rounded-xl border border-dashed border-[var(--border-base)]"
            >
              <p class="text-xs text-[var(--text-muted)]">
                {{ label('登录平台后即可发表评论', 'Login to post comments') }}
              </p>
            </div>

            <!-- Comments List -->
            <div v-if="isCommentsLoading" class="flex justify-center py-6">
              <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
            </div>
            <div
              v-else-if="comments.length === 0"
              class="text-center py-6 text-[var(--text-muted)] text-xs bg-white/[0.01] border border-dashed border-white/5 rounded-2xl font-semibold"
            >
              {{ label('暂无评论，快来抢沙发吧！', 'No comments yet. Be the first to comment!') }}
            </div>
            <div v-else class="space-y-4 max-h-[300px] overflow-y-auto pr-1.5 custom-scrollbar">
              <div
                v-for="c in comments"
                :key="c.id"
                class="flex gap-3 pb-3 border-b border-[var(--border-base)]/50 last:border-0 last:pb-0"
              >
                <div
                  class="h-8 w-8 rounded-full overflow-hidden border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center shrink-0"
                >
                  <img
                    v-if="c.user?.avatarUrl"
                    :src="getAssetUrl(c.user.avatarUrl)"
                    class="h-full w-full object-cover"
                  />
                  <span v-else class="text-xs font-bold uppercase text-[var(--text-secondary)]">{{
                    c.user?.name?.slice(0, 1) || 'U'
                  }}</span>
                </div>
                <div class="flex-1 flex flex-col gap-1 min-w-0">
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-bold text-[var(--text-primary)] truncate">{{
                      c.user?.name || '用户'
                    }}</span>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] text-[var(--text-muted)]">{{
                        new Date(c.createdAt).toLocaleString()
                      }}</span>
                      <button
                        v-if="canDeleteComment(c)"
                        class="text-[10px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer border-0 bg-transparent"
                        @click="handleDeleteComment(c.id)"
                      >
                        {{ label('删除', 'Delete') }}
                      </button>
                    </div>
                  </div>
                  <p
                    class="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words text-left"
                  >
                    {{ c.content }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Info pane -->
        <div
          class="xl:col-span-5 flex flex-col gap-4"
          :class="inline ? '' : 'overflow-y-auto max-h-[75vh] pr-1.5 custom-scrollbar'"
        >
          <!-- Author Profile Card -->
          <div
            v-if="material.user"
            class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 text-left shrink-0"
          >
            <div
              class="h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center text-sm shrink-0"
            >
              <img
                v-if="material.user.avatarUrl"
                :src="getAssetUrl(material.user.avatarUrl)"
                class="h-full w-full object-cover"
              />
              <span v-else class="font-semibold uppercase text-xs text-[var(--text-secondary)]">{{
                material.user.name?.slice(0, 1) || 'A'
              }}</span>
            </div>
            <div class="text-left min-w-0">
              <div class="text-xs font-bold text-[var(--text-primary)] truncate">
                {{ material.user.name }}
              </div>
              <div
                class="text-[10px] text-[var(--text-muted)] mt-1 font-medium uppercase tracking-wider"
              >
                {{ label('上传作者', 'Author') }}
              </div>
            </div>
          </div>

          <!-- Download Options Box -->
          <div
            class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 text-left"
          >
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{{
                label('下载选项', 'Download Options')
              }}</span>
              <div>
                <span
                  v-if="material.status === 'APPROVED'"
                  class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
                >
                  {{ label('已发布', 'Approved') }}
                </span>
                <span
                  v-else-if="material.status === 'PENDING'"
                  class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
                >
                  {{ label('审核中', 'Pending') }}
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-semibold"
                >
                  {{ label('未通过', 'Rejected') }}
                </span>
              </div>
            </div>

            <!-- Primary Download Button -->
            <Button
              variant="primary"
              size="md"
              :disabled="!isExternal && (!canDownload || isDownloading)"
              class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] transition-all duration-300"
              @click="handleMaterialDownload"
            >
              <template v-if="isExternal">
                <ExternalLink class="h-4.5 w-4.5" />
                <span>{{ label('前往源站获取下载', 'Visit Source Site') }}</span>
              </template>
              <template v-else>
                <Download v-if="!isDownloading" class="h-4.5 w-4.5 animate-bounce-slow" />
                <span>{{ label('下载材质包', 'Download Material') }}</span>
              </template>
            </Button>

            <!-- Quick Statistics -->
            <div class="grid grid-cols-2 gap-2 mt-1 pt-3 border-t border-white/5">
              <div class="flex flex-col gap-0.5">
                <span class="text-[10px] text-[var(--text-muted)]">{{
                  label('下载次数', 'Downloads')
                }}</span>
                <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                  <Download class="h-3 w-3 text-teal-400" />
                  {{ material.downloads || 0 }}
                </span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-[10px] text-[var(--text-muted)]">{{
                  label('收藏人数', 'Favorites')
                }}</span>
                <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                  <Heart class="h-3 w-3 text-rose-400 fill-rose-400/20" />
                  {{ material.favorites || 0 }}
                </span>
              </div>
            </div>
          </div>

          <!-- Control Action Buttons -->
          <div
            v-if="!inline"
            class="flex flex-col gap-2 p-3 bg-white/[0.01] border border-white/5 rounded-2xl text-left"
          >
            <span
              class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-1 mb-1"
              >{{ label('管理与操作', 'Actions') }}</span
            >
            <div class="grid grid-cols-2 gap-2">
              <Button
                v-if="canEdit"
                variant="secondary"
                size="sm"
                class="flex items-center justify-center gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-400"
                @click="emit('edit', material)"
              >
                <Edit3 class="h-3.5 w-3.5 text-emerald-400" />
                <span>{{ label('编辑', 'Edit') }}</span>
              </Button>

              <Button
                v-if="canEdit"
                variant="secondary"
                size="sm"
                class="flex items-center justify-center gap-1.5 hover:bg-rose-500/10 hover:text-rose-400"
                @click="handleDelete"
              >
                <Trash2 class="h-3.5 w-3.5 text-rose-400" />
                <span>{{ label('删除', 'Delete') }}</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                class="flex items-center justify-center gap-1.5"
                :class="{ 'text-rose-400 bg-rose-500/5': material.isFavorited }"
                @click="emit('favorite')"
              >
                <Heart
                  :class="[
                    'h-3.5 w-3.5',
                    material.isFavorited ? 'text-rose-500 fill-rose-500' : 'text-slate-400',
                  ]"
                />
                <span>{{
                  material.isFavorited ? label('已收藏', 'Saved') : label('收藏', 'Save')
                }}</span>
              </Button>

              <Button
                v-if="authStore.user"
                variant="secondary"
                size="sm"
                class="flex items-center justify-center gap-1.5"
                @click="handleShare"
              >
                <Share2 class="h-3.5 w-3.5 text-indigo-400" />
                <span>{{ label('分享', 'Share') }}</span>
              </Button>
            </div>

            <!-- Admin actions block inside the actions card -->
            <div
              v-if="isAdmin && material.status === 'PENDING'"
              class="flex flex-col gap-2 mt-2 pt-3 border-t border-white/5 w-full"
            >
              <span class="text-[10px] text-amber-400 font-semibold px-1">{{
                label('管理员审核', 'Admin Review')
              }}</span>
              <div class="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="isSavingReview"
                  class="flex-1 flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 border-0"
                  @click="handleApprove"
                >
                  <CheckCircle2 class="h-3.5 w-3.5 text-white" />
                  <span>{{ label('通过', 'Approve') }}</span>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="isSavingReview"
                  class="flex-1 flex items-center justify-center gap-1"
                  @click="handleReject"
                >
                  <XCircle class="h-3.5 w-3.5 text-white" />
                  <span>{{ label('驳回', 'Reject') }}</span>
                </Button>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="flex flex-col gap-1.5 text-left">
            <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {{ label('说明', 'Description') }}
            </h4>
            <div class="bg-white/[0.01] border border-white/5 rounded-2xl p-4 overflow-hidden">
              <MdPreview
                :model-value="
                  material.description ||
                  label('作者很懒，什么都没有写。', 'No description provided.')
                "
                :theme="isDark ? 'dark' : 'light'"
                class="!bg-transparent !text-[var(--text-secondary)] !text-xs dark:invert-preview"
              />
            </div>
          </div>

          <!-- Reject Reason -->
          <div v-if="material.rejectReason" class="flex flex-col gap-1.5 text-left">
            <h4 class="text-xs font-bold text-rose-400 uppercase tracking-wider">
              {{ label('审核驳回原因', 'Rejection Reason') }}
            </h4>
            <p
              class="text-xs text-rose-300 leading-relaxed bg-rose-500/10 border border-rose-500/20 rounded-xl p-3"
            >
              {{ material.rejectReason }}
            </p>
          </div>

          <!-- ZIP File Explorer (async-loaded) -->
          <div
            v-if="isPackageFilesLoading || packageFiles.length > 0"
            class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left shrink-0"
          >
            <div
              class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02] cursor-pointer select-none hover:bg-white/[0.04] transition-colors"
              @click="isFilesCollapsed = !isFilesCollapsed"
            >
              <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span
                class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]"
              >
                {{ label('源文件压缩包包含', 'Package Contents') }}
                <span v-if="!isPackageFilesLoading">({{ packageFiles.length }})</span>
              </span>
              <RefreshCw
                v-if="isPackageFilesLoading"
                class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0"
              />
              <component
                :is="isFilesCollapsed ? ChevronRight : ChevronDown"
                v-else
                class="h-4 w-4 text-[var(--text-muted)] ml-auto shrink-0 transition-transform duration-200"
              />
            </div>
            <div
              v-if="isPackageFilesLoading && !isFilesCollapsed"
              class="p-3 flex items-center gap-2 text-xs text-[var(--text-muted)]"
            >
              <span>{{ label('正在读取压缩包目录...', 'Reading package contents...') }}</span>
            </div>
            <div
              v-else-if="!isFilesCollapsed"
              class="p-2.5 flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar text-xs text-[var(--text-secondary)] font-mono"
            >
              <div
                v-for="node in visibleFileNodes"
                :key="node.path"
                class="flex items-center gap-1.5 py-0.5 hover:bg-[var(--bg-hover)] px-2 rounded transition-colors"
                :class="{ 'cursor-pointer select-none': node.isFolder }"
                :style="{ paddingLeft: node.level * 14 + 4 + 'px' }"
                @click="node.isFolder ? toggleFolder(node.path) : null"
              >
                <component
                  :is="expandedFolders.has(node.path) ? FolderOpen : Folder"
                  v-if="node.isFolder"
                  class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400/80 shrink-0"
                />
                <template v-else>
                  <Box
                    v-if="
                      node.name.toLowerCase().endsWith('.glb') ||
                      node.name.toLowerCase().endsWith('.gltf') ||
                      node.name.toLowerCase().endsWith('.fbx') ||
                      node.name.toLowerCase().endsWith('.obj') ||
                      node.name.toLowerCase().endsWith('.blend')
                    "
                    class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0"
                  />
                  <ImageIcon
                    v-else-if="
                      node.name.toLowerCase().endsWith('.png') ||
                      node.name.toLowerCase().endsWith('.jpg') ||
                      node.name.toLowerCase().endsWith('.jpeg') ||
                      node.name.toLowerCase().endsWith('.tga') ||
                      node.name.toLowerCase().endsWith('.exr') ||
                      node.name.toLowerCase().endsWith('.hdr') ||
                      node.name.toLowerCase().endsWith('.tiff')
                    "
                    class="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0"
                  />
                  <FileArchive
                    v-else
                    class="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0"
                  />
                </template>
                <span
                  class="truncate min-w-0"
                  :class="{
                    'text-indigo-600 dark:text-indigo-300 font-semibold':
                      !node.isFolder &&
                      (node.name.toLowerCase().endsWith('.glb') ||
                        node.name.toLowerCase().endsWith('.gltf') ||
                        node.name.toLowerCase().endsWith('.fbx') ||
                        node.name.toLowerCase().endsWith('.obj') ||
                        node.name.toLowerCase().endsWith('.blend')),
                  }"
                >
                  {{ node.name }}
                </span>
              </div>
            </div>
          </div>

          <!-- Specifications & Copyright side-by-side -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Copyright Info -->
            <div
              class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left"
            >
              <div
                class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]"
              >
                <Shield class="h-3.5 w-3.5 text-indigo-400" />
                <span
                  class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]"
                >
                  {{ label('版权与许可协议', 'Copyright & Licensing') }}
                </span>
              </div>
              <div class="p-3 flex flex-col gap-2 text-xs text-left">
                <div class="flex justify-between">
                  <span class="text-[var(--text-muted)]">{{
                    label('原创属性', 'Originality')
                  }}</span>
                  <span class="font-semibold text-[var(--text-secondary)]">{{
                    material.originality === 'ORIGINAL'
                      ? label('原创', 'Original')
                      : label('转载/改编', 'Reprint/Adaptation')
                  }}</span>
                </div>
                <div v-if="material.license" class="flex justify-between">
                  <span class="text-[var(--text-muted)]">{{ label('授权协议', 'License') }}</span>
                  <span class="font-semibold text-teal-400 uppercase text-[10px]">{{
                    material.license.replace('_', ' ')
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Specifications -->
            <div
              class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left"
            >
              <div
                class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]"
              >
                <Settings class="h-3.5 w-3.5 text-teal-400" />
                <span
                  class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]"
                >
                  {{ label('技术参数与规格', 'Specifications') }}
                </span>
              </div>
              <div class="p-3 flex flex-col gap-2 text-xs text-left">
                <div class="flex justify-between">
                  <span class="text-[var(--text-muted)]">{{
                    label('程序化材质', 'Procedural')
                  }}</span>
                  <span class="font-semibold text-[var(--text-secondary)]">{{
                    material.isProcedural ? label('是', 'Yes') : label('否', 'No')
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tag badges -->
          <div
            v-if="material.tags && material.tags.length"
            class="border border-white/10 rounded-2xl p-3 bg-white/[0.01] dark:bg-white/[0.02] text-left"
          >
            <span
              class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2"
              >{{ label('相关标签', 'Tags') }}</span
            >
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in material.tags"
                :key="tag"
                class="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] text-[var(--text-secondary)] border border-white/5 font-medium"
              >
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </component>

  <ShareDialog ref="shareDialogRef" type="material" />

  <!-- Downloading Progress Dialog Overlay -->
  <DownloadProgressOverlay
    :is-downloading="isDownloading"
    :progress="downloadProgress"
    :speed-str="downloadSpeedStr"
    @cancel="cancelDownload"
  />
</template>

<style scoped>
.detail-drawer {
  position: sticky;
  top: 10px;
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.close-button {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: #fff;
  border-color: var(--border-strong);
}

.drawer-loading {
  display: grid;
  place-items: center;
  min-height: 380px;
  color: #d97706;
}

.drawer-preview {
  position: relative;
  height: 180px;
  overflow: hidden;
  background: #172033;
}

.drawer-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.drawer-badges {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.drawer-badges span {
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  padding: 2px 5px;
  font-size: 9px;
  font-weight: 600;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.drawer-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.drawer-title h2 {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
}

.drawer-body > p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
}

.detail-grid div,
.reject-note,
.author-row,
.my-submissions {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-hover);
}

.detail-grid div {
  padding: 6px;
}

.detail-grid dt {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
}

.detail-grid dd {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reject-note {
  display: grid;
  gap: 3px;
  padding: 8px;
}

.reject-note strong {
  color: #dc2626;
  font-size: 10px;
}

.reject-note span {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 0;
}

.detail-tags span {
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 500;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.author-row strong,
.author-row span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-row strong {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.author-row span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
}

.my-submissions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
}

.my-submissions header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.submission-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 28px;
  padding: 0 4px;
  font-size: 11px;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.my-submissions > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.submission-item:hover {
  background: var(--bg-hover);
}

.submission-item span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submission-item small {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 600;
}

.drawer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-top: 1px solid var(--border-base);
  padding: 10px 12px;
}

.review-actions {
  display: flex;
  gap: 6px;
  border-top: 1px solid var(--border-base);
  padding: 0 12px 12px;
}

.primary-button,
.ghost-button,
.danger-button,
.approve-button,
.reject-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-base);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-text {
  gap: 6px;
}

.primary-button {
  border-color: transparent;
  background: #d97706;
  color: #fff;
  box-shadow: 0 2px 4px rgba(217, 119, 6, 0.15);
}

.primary-button:hover {
  background: #c26702;
  transform: translateY(-0.5px);
}

.ghost-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.ghost-button.active {
  border-color: rgba(225, 29, 72, 0.25);
  background: rgba(225, 29, 72, 0.05);
  color: #e11d48;
}

.danger-button {
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}

.danger-button:hover {
  background: rgba(220, 38, 38, 0.1);
  border-color: #dc2626;
}

.approve-button {
  border-color: rgba(5, 150, 105, 0.25);
  background: rgba(5, 150, 105, 0.05);
  color: #047857;
}

.approve-button:hover {
  background: rgba(5, 150, 105, 0.1);
  border-color: #059669;
}

.reject-button {
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}

.reject-button:hover {
  background: rgba(220, 38, 38, 0.1);
  border-color: #dc2626;
}

.square-action {
  display: grid;
  place-items: center;
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-xs {
  width: 11px;
  height: 11px;
}

.filled {
  fill: #e11d48;
}

.status-pill {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
}

.status-pill[data-tone='success'],
.submission-item small[data-tone='success'] {
  background: rgba(5, 150, 105, 0.1);
  color: #047857;
}

.status-pill[data-tone='warning'],
.submission-item small[data-tone='warning'] {
  background: rgba(217, 119, 6, 0.1);
  color: #b45309;
}

.status-pill[data-tone='danger'],
.submission-item small[data-tone='danger'] {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.spinning {
  /* @keyframes spin provided globally; only duration differs from the 1s default */
  animation-duration: 0.8s;
}

@media (max-width: 1080px) {
  .detail-drawer {
    position: relative;
    top: 0;
  }
}

@media (max-width: 860px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 99px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>

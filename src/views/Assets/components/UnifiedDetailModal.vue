<script setup lang="ts">
import { ref, watch, computed, type Component, defineAsyncComponent } from 'vue';
import { logError } from '@/utils/error';
import 'md-editor-v3/lib/preview.css';
import { useThemeObserver } from '@/composables/useThemeObserver';

const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));
import { useI18n } from 'vue-i18n';
import {
  Heart,
  Download,
  Box,
  Layers,
  Sun,
  Bone,
  Import,
  Package,
  FileArchive,
  FolderOpen,
  Folder,
  RefreshCw,
  Share2,
  Edit3,
  Trash2,
  Trash,
  CheckCircle2,
  XCircle,
  Shield,
  Settings,
  ExternalLink,
  Key,
  Activity,
  History,
  Plus,
  Copy,
  BookOpen,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { formatDate } from '@/utils/format';
import { useLabel } from '@/utils/i18n';
import api, { getAssetUrl } from '@/utils/api';
import { buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import { useFileTree } from '@/composables/useFileTree';
import { useResourceComments } from '@/composables/useResourceComments';
import { useMultiThreadDownload } from '@/composables/useMultiThreadDownload';
import DownloadProgressOverlay from '@/components/ui/DownloadProgressOverlay.vue';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import { useAuthStore } from '@/stores/auth';
import ShareDialog from './ShareDialog.vue';

const CATEGORY_ALL = '全部插件';
const CATEGORY_OTHER = '其他工具';

interface PluginUser {
  id?: string;
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

interface PluginItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  version: string;
  compatibility: string;
  downloads: number;
  fileUrl?: string | null;
  fileSize?: number | null;
  previewUrl?: string | null;
  installGuide: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
  user?: PluginUser | null;
  originality?: string;
  originalAuthor?: string | null;
  originalLink?: string | null;
  license?: string;
  isFree?: boolean;
  linkedCourseId?: string | null;
  linkedLessonId?: string | null;
  linkedCourse?: { id: string; title: string } | null;
  linkedLesson?: { id: string; title: string } | null;
  bilibiliUrl?: string | null;
  developerToken?: string | null;
  kind?: 'plugin' | 'software';
}

const props = withDefaults(
  defineProps<{
    show?: boolean;
    plugin?: PluginItem | null;
    item?: PluginItem | null;
    kind?: 'plugin' | 'software';
    isFavorited?: boolean;
    isDownloading?: boolean;
    isAdmin?: boolean;
    canEdit?: boolean;
    isSavingReview?: boolean;
    inline?: boolean;
  }>(),
  {
    show: false,
    plugin: null,
    item: null,
    kind: 'plugin',
    isFavorited: false,
    isDownloading: false,
    isAdmin: false,
    canEdit: false,
    isSavingReview: false,
    inline: false,
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'favorite'): void;
  (e: 'download'): void;
  (e: 'edit', plugin: PluginItem): void;
  (e: 'delete', plugin: PluginItem): void;
  (e: 'review-approved', plugin: PluginItem): void;
  (e: 'review-rejected', plugin: PluginItem): void;
  (e: 'update'): void;
}>();

const label = useLabel();
const { locale } = useI18n();

const activeItem = computed(() => props.item || props.plugin);
const activeKind = computed(() => props.kind || activeItem.value?.kind || 'plugin');
const plugin = computed(() => activeItem.value);

const apiPrefix = computed(() => activeKind.value === 'plugin' ? '/api/plugins' : '/api/softwares');
const uploadFieldName = computed(() => activeKind.value === 'plugin' ? 'plugin_file' : 'software_file');
const itemLabel = computed(() => activeKind.value === 'plugin' ? label('插件', 'Plugin') : label('软件', 'Software'));

const categoryLabel = (category?: string | null) => {
  const normalized = category || CATEGORY_OTHER;
  const englishLabels: Record<string, string> = {
    [CATEGORY_ALL]: activeKind.value === 'plugin' ? 'All Add-ons' : 'All Software',
    [CATEGORY_OTHER]: 'Other Utilities',
    建模: 'Modeling',
    材质与纹理: 'Materials & Texturing',
    渲染与灯光: 'Rendering & Lighting',
    动画与骨骼: 'Animation & Rigging',
    导入与导出: 'Import & Export',
    物理与特效: 'Physics & FX',
    '3D 建模与雕刻软件': '3D Modeling & Sculpting',
    '渲染引擎与渲染器': 'Render Engines & Renderers',
    '后期与图像处理': 'Post-production & Imaging',
    '游戏与交互引擎': 'Game & Interactive Engines',
  };
  return locale.value === 'en-US' ? englishLabels[normalized] || normalized : normalized;
};

const getCategoryIcon = (category?: string | null): Component => {
  const cat = category || '';
  if (cat.includes('建模') || cat.includes('雕刻')) return Box;
  if (cat.includes('材质') || cat.includes('纹理') || cat.includes('后期') || cat.includes('图像')) return Layers;
  if (cat.includes('渲染') || cat.includes('灯光')) return Sun;
  if (cat.includes('动画') || cat.includes('骨骼')) return Bone;
  if (cat.includes('导入') || cat.includes('导出')) return Import;
  if (cat.includes('游戏') || cat.includes('交互')) return Activity;
  return Folder;
};

const formatSize = (size?: number | null) => {
  if (!size) return label('未知大小', 'Unknown size');
  if (size >= 1) return `${size.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size * 1024))} KB`;
};
const handleApprove = () => {
  if (plugin.value) {
    emit('review-approved', plugin.value);
  }
};

const handleReject = () => {
  if (plugin.value) {
    emit('review-rejected', plugin.value);
  }
};

const handleDelete = () => {
  if (plugin.value) {
    emit('delete', plugin.value);
  }
};

const getTagsList = (tags?: string) =>
  (tags || '')
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);

// packageFiles is loaded asynchronously via a dedicated endpoint
const packageFiles = ref<string[]>([]);
const isPackageFilesLoading = ref(false);

const parsedFileTree = computed(() => {
  const tree = buildFileTree(packageFiles.value);
  return flattenFileTree(tree);
});

const { expandedFolders, toggleFolder, visibleFileNodes, resetExpansion } =
  useFileTree(parsedFileTree);

const fetchPackageFiles = async (id: string) => {
  if (!id) return;
  isPackageFilesLoading.value = true;
  try {
    const { data } = await api.get(`${apiPrefix.value}/${id}/package-files`);
    if (plugin.value?.id === id) {
      packageFiles.value = data.packageFiles || [];
    }
  } catch (err) {
    logError(err, { operation: 'fetch plugin package files' });
    if (plugin.value?.id === id) {
      packageFiles.value = [];
    }
  } finally {
    if (plugin.value?.id === id) {
      isPackageFilesLoading.value = false;
    }
  }
};

// Download states
const {
  isDownloading: localDownloading,
  downloadProgress,
  downloadSpeedStr,
  cancelDownload,
  runDownload,
} = useMultiThreadDownload();

const isExternal = computed(() => {
  if (!props.plugin) return false;
  const originality = props.plugin.originality;
  const fileUrl = props.plugin.fileUrl;
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

const handlePluginDownload = async () => {
  const activeItemVal = plugin.value;
  if (!activeItemVal) return;
  const downloadUrl = activeItemVal.fileUrl;

  if (isExternal.value) {
    const targetUrl = activeItemVal.originalLink || downloadUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
      await api.post(`${apiPrefix.value}/${activeItemVal.id}/download`).catch(() => {});
      emit('download');
    } else {
      ElMessage.warning(label('源站链接不存在', 'Source link not found'));
    }
    return;
  }

  if (!downloadUrl) {
    ElMessage.warning(label(activeKind.value === 'plugin' ? '该插件暂未提供下载文件' : '该软件暂未提供下载文件', activeKind.value === 'plugin' ? 'This plugin has no download file yet' : 'This software has no download file yet'));
    return;
  }

  const ext = downloadUrl.split('.').pop()?.split('?')[0] || 'zip';
  const safeTitle = (activeItemVal.title || 'file').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
  const resolvedUrl = getAssetUrl(downloadUrl);

  const totalSizeOverrideBytes = (activeItemVal.fileSize || 0) * 1024 * 1024;

  await runDownload({
    url: resolvedUrl,
    filename: `${safeTitle}.${ext}`,
    totalSizeOverrideBytes,
    onSuccess: async () => {
      // Record download on backend (only after successful download)
      await api.post(`${apiPrefix.value}/${activeItemVal.id}/download`);
      emit('download');
      emit('update');
    },
    onError: (err) => {
      const status = err?.response?.status;
      const msg =
        status === 404
          ? label(
              '文件不存在或已被删除，请联系管理员',
              'File not found or deleted, please contact admin',
            )
          : err.response?.data?.error ||
            label('下载失败，请稍后重试', 'Download failed, please try again');
      ElMessage.error(msg);
    },
  });
};

const handleVersionDownload = async (v: VersionItem) => {
  const activeItemVal = plugin.value;
  if (!activeItemVal) return;
  const downloadUrl = v.fileUrl;
  if (!downloadUrl) {
    ElMessage.warning(label('该版本暂未提供下载文件', 'This version has no download file yet'));
    return;
  }

  const ext = downloadUrl.split('.').pop()?.split('?')[0] || 'zip';
  const safeTitle = (activeItemVal.title || 'file').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
  const resolvedUrl = getAssetUrl(downloadUrl);

  const totalSizeOverrideBytes = (v.fileSize || 0) * 1024 * 1024;

  await runDownload({
    url: resolvedUrl,
    filename: `${safeTitle}.${ext}`,
    totalSizeOverrideBytes,
    onSuccess: async () => {
      // Record download on backend (only after successful download)
      await api.post(`${apiPrefix.value}/${activeItemVal.id}/download`);
      emit('download');
      emit('update');
    },
    onError: (err) => {
      const status = err?.response?.status;
      const msg =
        status === 404
          ? label(
              '文件不存在或已被删除，请联系管理员',
              'File not found or deleted, please contact admin',
            )
          : err.response?.data?.error ||
            label('下载失败，请稍后重试', 'Download failed, please try again');
      ElMessage.error(msg);
    },
  });
};

const authStore = useAuthStore();

const { isDark } = useThemeObserver();

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
} = useResourceComments(() => activeKind.value === 'plugin' ? 'plugins' : 'softwares', () => plugin.value?.id);

const handleShare = () => {
  if (!plugin.value) return;
  shareDialogRef.value?.open({
    id: plugin.value.id,
    title: plugin.value.title,
    userId: plugin.value.user?.id || '',
    createdAt: plugin.value.createdAt || '',
    previewUrl: plugin.value.previewUrl || null,
  });
};

// Details Tab Navigation
const activeDetailTab = ref<any>('detail');
const detailTabOptions = computed(() => {
  const options = [
    { label: label(activeKind.value === 'plugin' ? '插件详情' : '软件详情', activeKind.value === 'plugin' ? 'Plugin Details' : 'Software Details'), value: 'detail' },
    { label: label('版本历史', 'Release History'), value: 'versions', icon: History },
  ];
  if (props.canEdit && activeKind.value === 'plugin') {
    options.push({
      label: label('开发者中心', 'Developer Panel'),
      value: 'developer',
      icon: Settings,
    });
  }
  return options;
});

// Versions history list
interface VersionItem {
  id: string;
  version: string;
  changelog: string | null;
  fileUrl: string;
  fileSize: number | null;
  downloads: number;
  createdAt: string;
}
const versionsList = ref<VersionItem[]>([]);
const isVersionsLoading = ref(false);

const fetchVersions = async () => {
  const currentId = plugin.value?.id;
  if (!currentId) return;
  isVersionsLoading.value = true;
  try {
    const { data } = await api.get(`${apiPrefix.value}/${currentId}/versions`);
    if (plugin.value?.id === currentId) {
      versionsList.value = data;
    }
  } catch (err) {
    logError(err, { operation: 'fetch versions' });
  } finally {
    if (plugin.value?.id === currentId) {
      isVersionsLoading.value = false;
    }
  }
};

// Developer Panel Token and Feedbacks logs
const developerToken = ref('');
const feedbacks = ref<any[]>([]);
const isFeedbacksLoading = ref(false);
const isGeneratingToken = ref(false);
const isBlenderCodeExpanded = ref(false);

const fetchTokenAndFeedbacks = async () => {
  const currentId = plugin.value?.id;
  if (!currentId || !props.canEdit || activeKind.value !== 'plugin') return;
  isFeedbacksLoading.value = true;
  try {
    const { data } = await api.get(`/api/plugins/${currentId}`);
    const res = await api.get(`/api/plugins/${currentId}/feedbacks`);
    if (plugin.value?.id === currentId) {
      developerToken.value = data.developerToken || '';
      feedbacks.value = res.data;
    }
  } catch (err) {
    logError(err, { operation: 'fetch developer details' });
  } finally {
    if (plugin.value?.id === currentId) {
      isFeedbacksLoading.value = false;
    }
  }
};

const handleGenerateToken = async () => {
  if (!plugin.value?.id) return;
  isGeneratingToken.value = true;
  try {
    const { data } = await api.post(`/api/plugins/${plugin.value.id}/token`);
    developerToken.value = data.developerToken;
    ElMessage.success(label('Token 生成成功', 'Token generated successfully'));
  } catch (err) {
    logError(err, { operation: 'generate developer token' });
    ElMessage.error(label('生成 Token 失败', 'Failed to generate token'));
  } finally {
    isGeneratingToken.value = false;
  }
};

const handleDeleteFeedback = async (feedbackId: string) => {
  const activeItemVal = plugin.value;
  if (!activeItemVal?.id) return;
  try {
    await ElMessageBox.confirm(
      label('确定要删除这条反馈日志吗？', 'Are you sure you want to delete this feedback log?'),
      label('删除确认', 'Confirm Delete'),
      {
        confirmButtonText: label('确定', 'Confirm'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  try {
    await api.delete(`/api/plugins/${activeItemVal.id}/feedbacks/${feedbackId}`);
    ElMessage.success(label('反馈已删除', 'Feedback deleted'));
    await fetchTokenAndFeedbacks();
  } catch (err) {
    logError(err, { operation: 'delete feedback' });
    ElMessage.error(label('删除反馈失败', 'Failed to delete feedback'));
  }
};

const handleClearFeedbacks = async () => {
  const activeItemVal = plugin.value;
  if (!activeItemVal?.id) return;
  try {
    await ElMessageBox.confirm(
      label(
        '确定要清空所有反馈日志吗？此操作无法恢复。',
        'Are you sure you want to clear all feedback logs? This action cannot be undone.',
      ),
      label('清空确认', 'Confirm Clear All'),
      {
        confirmButtonText: label('清空', 'Clear All'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  try {
    await api.delete(`/api/plugins/${activeItemVal.id}/feedbacks`);
    ElMessage.success(label('所有反馈已清空', 'All feedbacks cleared'));
    await fetchTokenAndFeedbacks();
  } catch (err) {
    logError(err, { operation: 'clear feedbacks' });
    ElMessage.error(label('清空反馈失败', 'Failed to clear feedbacks'));
  }
};

// Upload new release version (used in Versions History tab)
const isPublishingVersion = ref(false);
const showVersionUploadPanel = ref(false);
const publishVersionForm = ref({ version: '', changelog: '' });
const publishVersionFile = ref<File | null>(null);
const releaseFileInput = ref<HTMLInputElement | null>(null);

const handlePublishVersionFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    publishVersionFile.value = file;
    if (!publishVersionForm.value.version) {
      const match = file.name.match(/(\d+\.\d+\.\d+)/);
      if (match) publishVersionForm.value.version = match[1];
    }
  }
};

const handlePublishVersionSubmit = async () => {
  if (!plugin.value?.id || !publishVersionFile.value || !publishVersionForm.value.version.trim()) {
    ElMessage.warning(label('请上传文件并填写版本号', 'Please upload file and fill version'));
    return;
  }
  isPublishingVersion.value = true;
  const formData = new FormData();
  formData.append(uploadFieldName.value, publishVersionFile.value);
  formData.append('version', publishVersionForm.value.version.trim());
  formData.append('changelog', publishVersionForm.value.changelog.trim());
  try {
    await api.post(`${apiPrefix.value}/${plugin.value.id}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success(label('新版本已上传', 'New version uploaded successfully'));
    publishVersionForm.value = { version: '', changelog: '' };
    publishVersionFile.value = null;
    showVersionUploadPanel.value = false;
    await fetchVersions();
    emit('update');
  } catch (error) {
    logError(error, { operation: 'publish version' });
    ElMessage.error(label('上传失败', 'Upload failed'));
  } finally {
    isPublishingVersion.value = false;
  }
};

// Edit and Delete version handlers
const editingVersionId = ref<string | null>(null);
const editingVersionForm = ref({ version: '', changelog: '' });
const isUpdatingVersion = ref(false);

const handleEditVersion = (v: VersionItem) => {
  editingVersionId.value = v.id;
  editingVersionForm.value = {
    version: v.version,
    changelog: v.changelog || '',
  };
};

const handleUpdateVersionSubmit = async (versionId: string) => {
  if (!plugin.value?.id || !editingVersionForm.value.version.trim()) return;
  isUpdatingVersion.value = true;
  try {
    await api.put(`${apiPrefix.value}/${plugin.value.id}/versions/${versionId}`, {
      version: editingVersionForm.value.version.trim(),
      changelog: editingVersionForm.value.changelog.trim(),
    });
    ElMessage.success(label('版本信息已更新', 'Version info updated successfully'));
    editingVersionId.value = null;
    await fetchVersions();
    emit('update');
  } catch (err) {
    logError(err, { operation: 'update version' });
    ElMessage.error(label('更新版本失败', 'Failed to update version'));
  } finally {
    isUpdatingVersion.value = false;
  }
};

const handleDeleteVersion = async (v: VersionItem) => {
  const activeItemVal = plugin.value;
  if (!activeItemVal?.id) return;
  try {
    await ElMessageBox.confirm(
      label(
        `确定要删除版本 v${v.version} 吗？此操作将永久删除物理文件且无法撤销。`,
        `Are you sure you want to delete version v${v.version}? This will permanently delete the physical file and cannot be undone.`,
      ),
      label('删除确认', 'Confirm Delete'),
      {
        confirmButtonText: label('确定', 'Confirm'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  try {
    await api.delete(`${apiPrefix.value}/${activeItemVal.id}/versions/${v.id}`);
    ElMessage.success(label('版本已删除', 'Version deleted'));
    await fetchVersions();
    emit('update');
  } catch (err: any) {
    logError('Failed to delete version:', err);
    const msg = err.response?.data?.message || label('删除版本失败', 'Failed to delete version');
    ElMessage.error(msg);
  }
};

// Bilibili link player embed helper
const getBilibiliEmbedUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const match = url.match(/video\/(BV[a-zA-Z0-9]+)/i) || url.match(/bvid=(BV[a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return `//player.bilibili.com/player.html?bvid=${match[1]}&page=1&high_quality=1&as_wide=1&autoplay=0&danmaku=0`;
  }
  return undefined;
};

// Categorized bookmark folders selector
const showFavoriteCategorySelect = ref(false);
const favoriteCategories = ref<string[]>(['默认']);
const newFavoriteCategory = ref('');
const pluginFavCategory = ref('');

const fetchFavoriteCategories = async () => {
  try {
    const { data } = await api.get(`${apiPrefix.value}/favorites`);
    favoriteCategories.value = data.categories || ['默认'];
    const pluginId = plugin.value?.id;
    if (pluginId) {
      const match = data.favorites?.find((f: any) => (f.plugin?.id || f.software?.id) === pluginId);
      pluginFavCategory.value = match ? match.category : '';
    }
  } catch (err) {
    logError(err, { operation: 'fetch favorite categories' });
  }
};

const handleFavoriteWithCategory = async (categoryName: string) => {
  const activeItemVal = plugin.value;
  if (!activeItemVal) return;
  try {
    const { data } = await api.post(`${apiPrefix.value}/${activeItemVal.id}/favorite`, {
      category: categoryName,
    });
    emit('favorite');
    showFavoriteCategorySelect.value = false;
    ElMessage.success(
      data.isFavorited
        ? label(`已收藏至 [${categoryName}]`, `Plugin saved to [${categoryName}]`)
        : label('已取消收藏', 'Favorite removed'),
    );
    await fetchFavoriteCategories();
  } catch (err) {
    logError(err, { operation: 'toggle favorite with category' });
    ElMessage.error(label('操作失败', 'Action failed'));
  }
};

const handleCreateAndFavorite = () => {
  if (newFavoriteCategory.value.trim()) {
    handleFavoriteWithCategory(newFavoriteCategory.value.trim());
    newFavoriteCategory.value = '';
  }
};

watch(
  [() => plugin.value?.id, () => props.show, () => plugin.value?.version],
  ([newId, newShow]) => {
    if (newId && newShow) {
      resetExpansion();
      packageFiles.value = [];
      fetchPackageFiles(newId);
      fetchComments();
      fetchVersions();
      activeDetailTab.value = 'detail';
      showFavoriteCategorySelect.value = false;
      fetchFavoriteCategories();
      if (props.canEdit) {
        fetchTokenAndFeedbacks();
      }
    }
  },
  { immediate: true },
);

// ── Blender Integration Code Generator ─────────────────────────────────────────
const blenderIntegrationCode = computed(() => {
  const token = developerToken.value || 'YOUR_PLUGIN_TOKEN_HERE';
  const baseUrl = window.location.origin;
  return `# ============================================================
# 3D Platform Plugin Integration — Auto Update & Error Report
# 粘贴到你的 Blender 插件 __init__.py 文件中
# ============================================================
import bpy, urllib.request, urllib.parse, json, traceback

PLUGIN_TOKEN  = "${token}"
CURRENT_VER   = bl_info["version"]  # 直接读取插件的版本元组
CHECK_URL     = "${baseUrl}/api/plugins/client/check-update"
FEEDBACK_URL  = "${baseUrl}/api/plugins/client/feedback"

def version_tuple_to_str(v):
    return ".".join(str(x) for x in v)

def check_for_updates():
    """启动时调用，有新版本时在信息栏弹出提示"""
    try:
        cur = version_tuple_to_str(CURRENT_VER)
        params = urllib.parse.urlencode({"token": PLUGIN_TOKEN, "version": cur})
        with urllib.request.urlopen(f"{CHECK_URL}?{params}", timeout=5) as r:
            data = json.loads(r.read())
        if data.get("updateAvailable"):
            ver = data.get("latestVersion", "?")
            log = data.get("changelog", "")
            def draw(self, ctx):
                self.layout.label(text=f"插件有新版本 v{ver}！{log}")
            bpy.context.window_manager.popup_menu(draw, title="发现更新", icon="INFO")
    except Exception:
        pass  # 静默失败，不影响正常使用

def send_feedback(feedback_type="BUG", content=""):
    """遇到异常时调用，自动上报错误日志到平台开发者控制台"""
    try:
        payload = json.dumps({
            "token": PLUGIN_TOKEN,
            "clientVersion": version_tuple_to_str(CURRENT_VER),
            "feedbackType": feedback_type,
            "content": content
        }).encode()
        req = urllib.request.Request(
            FEEDBACK_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass  # 静默失败

# ── 使用示例 ─────────────────────────────────────────────────
# 示例 1: 在 register() 中调用更新检查
def register():
    # ... 注册你的 Operator / Panel ...
    check_for_updates()  # ← 添加这一行

# 示例 2: 在 Operator.execute() 中用 try/except 捕获错误并上报
class MY_OT_Example(bpy.types.Operator):
    bl_idname = "myaddon.example"
    bl_label  = "Example Operator"
    def execute(self, context):
        try:
            # ... 你的插件逻辑 ...
            return {"FINISHED"}
        except Exception as e:
            send_feedback("BUG", traceback.format_exc())
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}

# 示例 3: 制作一个用户反馈/建议提交弹窗 (用户填写建议提交回平台)
class MY_OT_SubmitFeedback(bpy.types.Operator):
    bl_idname = "myaddon.submit_feedback"
    bl_label  = "提交反馈与建议"
    bl_options = {'REGISTER', 'UNDO'}
    
    feedback_type: bpy.props.EnumProperty(
        name="反馈类型",
        items=[
            ('SUGGESTION', "建议 / 需求", "对插件的功能建议"),
            ('BUG', "问题反馈 / BUG", "遇到程序错误")
        ],
        default='SUGGESTION'
    )
    content: bpy.props.StringProperty(name="反馈内容", default="")

    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self, width=400)

    def execute(self, context):
        if not self.content.strip():
            self.report({'WARNING'}, "反馈内容不能为空")
            return {'CANCELLED'}
        send_feedback(self.feedback_type, self.content)
        self.report({'INFO'}, "反馈提交成功，感谢您的支持！")
        return {'FINISHED'}`;
});

const copyIntegrationCode = async () => {
  try {
    await navigator.clipboard.writeText(blenderIntegrationCode.value);
    ElMessage.success(label('代码已复制到剪贴板！', 'Code copied to clipboard!'));
  } catch {
    ElMessage.error(label('复制失败，请手动选取代码', 'Copy failed, please select manually'));
  }
};
</script>

<template>
  <component
    :is="inline ? 'div' : Modal"
    v-bind="
      inline
        ? { class: 'w-full' }
        : { show: show && !!plugin, size: 'xxl', padding: 'md', glassCard: true }
    "
    @close="emit('close')"
  >
    <template v-if="!inline" #header>
      <div v-if="plugin" class="flex items-center gap-3">
        <component :is="getCategoryIcon(plugin.category)" class="h-5 w-5 text-indigo-400" />
        <div>
          <h3
            class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)] flex items-center gap-2"
          >
            <span>{{ plugin.title }}</span>
            <span
              v-if="!plugin.isFree"
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse"
            >
              {{ label('会员专享', 'VIP Only') }}
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
            >
              {{ label('免费下载', 'Free') }}
            </span>
            <span
              class="px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 font-semibold"
            >
              v{{ plugin.version }}
            </span>
          </h3>
          <p class="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
            <span>{{ categoryLabel(plugin.category) }}</span>
            <span class="text-white/20">•</span>
            <span class="font-mono text-[10px]">{{ formatDate(plugin.createdAt) }}</span>
          </p>
        </div>
      </div>
    </template>

    <!-- Inline header for share view -->
    <div
      v-if="inline && plugin"
      class="premium-card-header flex items-center justify-between mb-5 pb-3 border-b border-[var(--border-base)] text-left"
    >
      <div class="flex items-center gap-3">
        <component :is="getCategoryIcon(plugin.category)" class="h-5 w-5 text-indigo-400" />
        <div>
          <h3
            class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)] flex items-center gap-2"
          >
            <span>{{ plugin.title }}</span>
            <span
              v-if="!plugin.isFree"
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30"
            >
              {{ label('会员专享', 'VIP Only') }}
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
            >
              {{ label('免费下载', 'Free') }}
            </span>
            <span
              class="px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 font-semibold"
            >
              v{{ plugin.version }}
            </span>
          </h3>
          <p class="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
            <span>{{ categoryLabel(plugin.category) }}</span>
            <span class="text-white/20">•</span>
            <span class="font-mono text-[10px]">{{ formatDate(plugin.createdAt) }}</span>
          </p>
        </div>
      </div>
    </div>

    <div v-if="plugin" class="grid grid-cols-1 xl:grid-cols-12 gap-8">
      <!-- Left Column: Document / Article / Inline Discussions -->
      <div
        class="xl:col-span-8 flex flex-col gap-6 text-left"
        :class="inline ? '' : 'overflow-y-auto max-h-[75vh] pr-1.5 custom-scrollbar'"
      >
        <!-- Details Tab Bar -->
        <div v-if="!inline" class="shrink-0 flex items-center">
          <Tabs v-model="activeDetailTab" :options="detailTabOptions" size="sm" />
        </div>

        <template v-if="activeDetailTab === 'detail'">
          <!-- Plugin Preview Image -->
          <div v-if="plugin.previewUrl" class="w-full flex justify-center mb-4">
            <img
              :src="getAssetUrl(plugin.previewUrl)"
              class="max-w-full h-auto max-h-[480px] rounded-2xl border border-black/10 dark:border-white/10 shadow-md transition-transform duration-500 hover:scale-[1.01]"
              alt="Plugin Preview"
            />
          </div>

          <!-- Description Section -->
          <div class="flex flex-col gap-2">
            <h3
              class="text-sm font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2"
            >
              {{ label('插件简介', 'Plugin Overview') }}
            </h3>
            <div
              class="bg-white/[0.01] border border-white/5 rounded-2xl p-4 overflow-hidden plugin-markdown-content"
            >
              <MdPreview
                :model-value="
                  plugin.description || label('作者暂未填写简介。', 'No plugin description yet.')
                "
                :theme="isDark ? 'dark' : 'light'"
                class="!bg-transparent !text-[var(--text-secondary)] !text-xs dark:invert-preview"
              />
            </div>
          </div>

          <!-- Bilibili Share Video or Homepage -->
          <div v-if="plugin.bilibiliUrl" class="flex flex-col gap-2">
            <h3
              class="text-sm font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2"
            >
              {{ label('B站视频与分享', 'Bilibili Showcase') }}
            </h3>
            <div
              v-if="getBilibiliEmbedUrl(plugin.bilibiliUrl)"
              class="w-full aspect-video rounded-2xl overflow-hidden border border-white/5 bg-black shadow-inner"
            >
              <iframe
                :src="getBilibiliEmbedUrl(plugin.bilibiliUrl)"
                scrolling="no"
                border="0"
                frameborder="no"
                framespacing="0"
                allowfullscreen="true"
                class="w-full h-full"
              ></iframe>
            </div>
            <div
              v-else
              class="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between"
            >
              <div class="flex items-center gap-2">
                <ExternalLink class="w-4 h-4 text-indigo-400" />
                <span class="text-xs text-[var(--text-secondary)]">{{
                  label('关联 B站 链接：', 'Linked Bilibili:')
                }}</span>
                <a
                  :href="plugin.bilibiliUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-indigo-400 hover:underline truncate max-w-[200px]"
                  >{{ plugin.bilibiliUrl }}</a
                >
              </div>
              <a
                :href="plugin.bilibiliUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors border-0"
              >
                {{ label('跳转访问', 'Visit Link') }}
              </a>
            </div>
          </div>

          <!-- Inline Discussions Section -->
          <div class="flex flex-col gap-4 mt-4 pt-6 border-t border-white/10">
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
                  label('发表您的想法 and 建议...', 'Post your thoughts and suggestions...')
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
        </template>

        <!-- Version History Tab view -->
        <template v-else-if="activeDetailTab === 'versions'">
          <div class="flex flex-col gap-4">
            <!-- Header row -->
            <div class="flex items-center justify-between">
              <h3
                class="text-sm font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2"
              >
                {{ label('历史发布版本', 'Version Release History') }}
              </h3>
              <button
                v-if="canEdit"
                class="flex items-center gap-1.5 text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-teal-600/15 hover:bg-teal-600/25 border border-teal-500/25 text-teal-800 dark:text-teal-400 transition-colors cursor-pointer"
                @click="showVersionUploadPanel = !showVersionUploadPanel"
              >
                <Plus class="w-3 h-3" />
                <span>{{ label('上传新版本', 'Upload New Version') }}</span>
              </button>
            </div>

            <!-- Upload panel (collapsible, owner only) -->
            <div
              v-if="canEdit && showVersionUploadPanel"
              class="p-4 rounded-2xl bg-teal-600/5 border border-teal-500/15 flex flex-col gap-3"
            >
              <h4
                class="text-xs font-bold text-teal-800 dark:text-teal-400 flex items-center gap-1.5"
              >
                <History class="w-3.5 h-3.5" />
                <span>{{ label('上传新版本包', 'Upload New Version Package') }}</span>
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-3">
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1.5">{{
                      label('插件包文件 (.zip) *', 'Plugin Package (.zip) *')
                    }}</label>
                    <input
                      ref="releaseFileInput"
                      type="file"
                      accept=".zip"
                      class="hidden"
                      @change="handlePublishVersionFileChange"
                    />
                    <div
                      class="border border-dashed border-white/10 hover:border-teal-500 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white/[0.02] transition-colors"
                      @click="releaseFileInput?.click()"
                    >
                      <FileArchive class="w-6 h-6 text-teal-500" />
                      <span
                        class="text-[10px] text-[var(--text-secondary)] font-medium text-center"
                      >
                        {{
                          publishVersionFile
                            ? publishVersionFile.name
                            : label('点击选择 zip 插件包', 'Click to choose zip')
                        }}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1.5">{{
                      label('版本号 *', 'Version *')
                    }}</label>
                    <input
                      v-model="publishVersionForm.version"
                      type="text"
                      placeholder="e.g. 1.1.0"
                      class="w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/10 rounded-xl text-white outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                <div class="flex flex-col gap-3">
                  <div class="flex-1 flex flex-col">
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1.5">{{
                      label('更新日志 / Changelog', 'Changelog')
                    }}</label>
                    <textarea
                      v-model="publishVersionForm.changelog"
                      placeholder="描述新版本的优化、Bug修复等内容..."
                      class="flex-1 min-h-[100px] w-full px-3 py-2 text-xs bg-white/[0.03] border border-white/10 rounded-xl text-white outline-none focus:border-teal-500 resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>
              <div class="flex justify-end gap-2 mt-1">
                <button
                  class="text-[10px] px-3 py-1.5 rounded-xl border border-white/10 text-[var(--text-muted)] hover:text-white bg-transparent cursor-pointer transition-colors"
                  @click="showVersionUploadPanel = false"
                >
                  {{ label('取消', 'Cancel') }}
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  :loading="isPublishingVersion"
                  :disabled="!publishVersionFile || !publishVersionForm.version.trim()"
                  @click="handlePublishVersionSubmit"
                >
                  {{ label('上传此版本', 'Upload Version') }}
                </Button>
              </div>
            </div>

            <!-- Version cards list -->
            <div v-if="isVersionsLoading" class="flex justify-center py-6">
              <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
            </div>
            <div
              v-else-if="versionsList.length === 0"
              class="text-center py-6 text-xs text-[var(--text-muted)]"
            >
              {{ label('暂无历史发布版本。', 'No release history available.') }}
            </div>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="v in versionsList"
                :key="v.id"
                class="flex flex-col gap-2 p-4 rounded-2xl border transition-colors"
                :class="
                  v.version === plugin.version
                    ? 'bg-indigo-600/8 border-indigo-500/30'
                    : 'bg-white/[0.02] border-white/5'
                "
              >
                <!-- Edit mode form -->
                <div v-if="editingVersionId === v.id" class="flex flex-col gap-3">
                  <div class="flex items-center gap-3">
                    <div class="flex-1">
                      <label class="block text-[10px] font-semibold text-slate-400 mb-1">{{
                        label('版本号', 'Version')
                      }}</label>
                      <input
                        v-model="editingVersionForm.version"
                        type="text"
                        class="w-full px-3 py-1.5 text-xs bg-white/[0.03] border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1">{{
                      label('更新日志', 'Changelog')
                    }}</label>
                    <textarea
                      v-model="editingVersionForm.changelog"
                      class="w-full min-h-[60px] px-3 py-1.5 text-xs bg-white/[0.03] border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500 resize-none"
                    ></textarea>
                  </div>
                  <div class="flex justify-end gap-2 mt-1">
                    <button
                      class="text-[10px] px-2.5 py-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white bg-transparent cursor-pointer transition-colors"
                      @click="editingVersionId = null"
                    >
                      {{ label('取消', 'Cancel') }}
                    </button>
                    <Button
                      variant="primary"
                      size="sm"
                      :loading="isUpdatingVersion"
                      :disabled="!editingVersionForm.version.trim()"
                      @click="handleUpdateVersionSubmit(v.id)"
                    >
                      {{ label('保存', 'Save') }}
                    </Button>
                  </div>
                </div>

                <!-- Display mode -->
                <template v-else>
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border border-indigo-500/20 shrink-0"
                      >
                        v{{ v.version }}
                      </span>
                      <span
                        v-if="v.version === plugin.version"
                        class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
                      >
                        {{ label('当前推送', 'Active') }}
                      </span>
                      <span
                        class="text-[10px] text-slate-500 dark:text-slate-300 font-mono truncate"
                      >
                        {{ formatDate(v.createdAt) }}
                      </span>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                      <!-- Edit button -->
                      <button
                        v-if="canEdit"
                        type="button"
                        class="flex items-center justify-center p-1.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 cursor-pointer transition-colors"
                        :title="label('编辑版本信息', 'Edit Version Info')"
                        @click="handleEditVersion(v)"
                      >
                        <Edit3 class="w-3.5 h-3.5" />
                      </button>

                      <!-- Delete button -->
                      <button
                        v-if="canEdit"
                        type="button"
                        class="flex items-center justify-center p-1.5 text-[10px] font-bold text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 cursor-pointer transition-colors"
                        :title="label('删除版本', 'Delete Version')"
                        @click="handleDeleteVersion(v)"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>

                      <!-- Download button -->
                      <button
                        type="button"
                        class="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-400/20 hover:border-indigo-400/40 px-2 py-1 rounded-lg bg-transparent cursor-pointer"
                        @click="handleVersionDownload(v)"
                      >
                        <Download class="w-3 h-3" />
                        <span>{{ formatSize(v.fileSize) }}</span>
                      </button>
                    </div>
                  </div>
                  <div
                    class="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed"
                  >
                    {{ v.changelog || label('暂无更新说明。', 'No release notes.') }}
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- Developer Panel Tab view -->
        <template v-else-if="activeDetailTab === 'developer' && canEdit">
          <div class="flex flex-col gap-6">
            <!-- Dev Integration Tokens -->
            <div
              class="flex flex-col gap-2.5 p-4 rounded-2xl bg-indigo-600/5 border border-indigo-500/10"
            >
              <h4
                class="text-xs font-bold text-indigo-800 dark:text-indigo-400 flex items-center gap-1"
              >
                <Key class="w-3.5 h-3.5" />
                <span>{{
                  label('Blender 客户端联网 API Token', 'Client Integration API Token')
                }}</span>
              </h4>
              <p class="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {{
                  label(
                    '在 Blender 插件中调用本站 API 实现自动检查更新和报错日志反馈。请勿泄露您的 Token。',
                    'Use this token in your Blender client plugin for update checks and error reporting.',
                  )
                }}
              </p>

              <div class="flex gap-2 items-center mt-1">
                <input
                  type="text"
                  readonly
                  :value="
                    developerToken || label('未生成 Token，点击右侧生成', 'Token not generated yet')
                  "
                  class="flex-1 px-3 py-2 text-xs font-mono bg-black/20 border border-white/10 rounded-xl text-white outline-none select-all"
                />
                <Button
                  variant="primary"
                  size="sm"
                  :loading="isGeneratingToken"
                  @click="handleGenerateToken"
                >
                  {{
                    developerToken
                      ? label('重新生成', 'Regenerate')
                      : label('生成 Token', 'Generate')
                  }}
                </Button>
              </div>
            </div>

            <!-- Blender Integration Code Guide -->
            <div
              v-if="developerToken"
              class="flex flex-col gap-3 p-4 rounded-2xl bg-slate-500/5 dark:bg-white/[0.02] border border-slate-500/15 dark:border-white/10"
            >
              <div
                class="flex items-center justify-between cursor-pointer select-none"
                @click="isBlenderCodeExpanded = !isBlenderCodeExpanded"
              >
                <h4
                  class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <BookOpen class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{{
                    label(
                      'Blender 插件集成代码（复制即用）',
                      'Blender Addon Integration Code (Ready to Use)',
                    )
                  }}</span>
                  <ChevronDown
                    v-if="!isBlenderCodeExpanded"
                    class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform"
                  />
                  <ChevronUp
                    v-else
                    class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform"
                  />
                </h4>
                <button
                  v-if="isBlenderCodeExpanded"
                  class="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl bg-slate-500/10 dark:bg-white/10 hover:bg-slate-500/20 dark:hover:bg-white/20 border border-slate-500/20 dark:border-white/15 text-slate-800 dark:text-slate-200 font-bold transition-colors cursor-pointer"
                  @click.stop="copyIntegrationCode"
                >
                  <Copy class="w-3 h-3" />
                  <span>{{ label('复制代码', 'Copy Code') }}</span>
                </button>
              </div>

              <div v-if="isBlenderCodeExpanded" class="flex flex-col gap-3 mt-1">
                <!-- Loop diagram -->
                <div
                  class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-black/5 dark:bg-black/25 border border-black/5 dark:border-white/5 text-[10px] font-bold text-slate-800 dark:text-slate-200"
                >
                  <span class="flex items-center gap-1"
                    ><Zap class="w-3 h-3 text-emerald-500 dark:text-emerald-400" />{{
                      label('Blender 插件', 'Blender Addon')
                    }}</span
                  >
                  <span class="text-slate-500 dark:text-slate-400">→</span>
                  <span>{{ label('检查更新', 'Check Updates') }}</span>
                  <span class="text-slate-500 dark:text-slate-400">→</span>
                  <span>{{ label('本平台', 'Platform') }}</span>
                  <span class="text-slate-500 dark:text-slate-400">→</span>
                  <span>{{ label('下发更新', 'Deliver Update') }}</span>
                  <span class="text-slate-500 dark:text-slate-400">→</span>
                  <span>{{ label('用户弹窗', 'User Notice') }}</span>
                  <span class="text-slate-500 dark:text-slate-400">/</span>
                  <span>{{ label('报错', 'Error') }}</span>
                  <span class="text-slate-500 dark:text-slate-400">→</span>
                  <span>{{ label('日志面板', 'Your Logs') }}</span>
                </div>

                <div class="relative">
                  <pre
                    class="font-mono text-[10px] text-slate-300 leading-relaxed p-3 rounded-xl bg-black/40 overflow-x-auto whitespace-pre border border-white/5 max-h-[220px] overflow-y-auto custom-scrollbar"
                    >{{ blenderIntegrationCode }}</pre
                  >
                </div>

                <p class="text-[10px] text-slate-800 dark:text-slate-200 font-bold leading-relaxed">
                  {{
                    label(
                      '将上方代码粘贴到您的 Blender 插件 __init__.py 中，注册 register() 函数中调用 check_for_updates()，报错时调用 send_feedback()。',
                      'Paste the code into your addon __init__.py. Call check_for_updates() inside register(), and send_feedback() when an exception occurs.',
                    )
                  }}
                </p>
              </div>
            </div>

            <!-- Current Active Version Status + Edit Entry -->
            <div class="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.01] border border-white/5">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Zap class="w-3.5 h-3.5 text-teal-400" />
                  <span>{{ label('当前主版本', 'Current Active Version') }}</span>
                </h4>
                <Button
                  variant="secondary"
                  size="sm"
                  class="flex items-center gap-1.5"
                  @click="plugin && emit('edit', plugin)"
                >
                  <Edit3 class="w-3 h-3" />
                  <span>{{ label('编辑插件信息', 'Edit Plugin') }}</span>
                </Button>
              </div>

              <div
                class="flex items-center gap-3 px-3 py-3 rounded-xl bg-emerald-600/8 border border-emerald-500/20"
              >
                <div class="flex-1 flex items-center gap-3 min-w-0">
                  <span
                    class="px-2.5 py-1 rounded-lg text-sm font-extrabold font-mono bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
                  >
                    v{{ plugin.version }}
                  </span>
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <span class="text-xs font-semibold text-[var(--text-primary)] truncate">{{
                      plugin.title
                    }}</span>
                    <span class="text-[10px] text-slate-500 dark:text-slate-300">
                      {{
                        label(
                          'Blender 客户端检查更新时将收到此版本号及下载地址',
                          'Blender clients receive this version on update check',
                        )
                      }}
                    </span>
                  </div>
                </div>
                <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
              </div>

              <p class="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {{
                  label(
                    '如需切换推送版本，请点击「编辑插件信息」修改版本号并重新上传对应文件，保存后将同步至所有 Blender 客户端。',
                    'To change the pushed version, click "Edit Plugin" to update the version number and file, then save. Changes sync to all Blender clients immediately.',
                  )
                }}
              </p>
            </div>

            <!-- Client Feedback & Crash Telemetry -->
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Activity class="w-3.5 h-3.5 text-rose-500" />
                  <span>{{
                    label('Blender 客户端反馈与报错日志', 'Client Error & Telemetry Logs')
                  }}</span>
                </h4>
                <button
                  v-if="canEdit && feedbacks.length > 0"
                  class="text-[10px] font-bold text-rose-500 hover:text-rose-400 cursor-pointer border-0 bg-transparent flex items-center gap-1"
                  @click="handleClearFeedbacks"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>{{ label('清空日志', 'Clear Logs') }}</span>
                </button>
              </div>

              <div v-if="isFeedbacksLoading" class="flex justify-center py-6">
                <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
              </div>
              <div
                v-else-if="feedbacks.length === 0"
                class="text-center py-6 text-xs text-slate-500 dark:text-slate-400 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl font-semibold"
              >
                {{ label('暂无客户端日志反馈。', 'No client reports received yet.') }}
              </div>
              <div
                v-else
                class="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scrollbar"
              >
                <div
                  v-for="fb in feedbacks"
                  :key="fb.id"
                  class="p-3 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col gap-1.5 text-[11px]"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="px-1.5 py-0.5 rounded text-[8px] font-bold"
                        :class="
                          fb.feedbackType === 'BUG'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : fb.feedbackType === 'SUGGESTION'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        "
                      >
                        {{ fb.feedbackType }}
                      </span>
                      <span class="text-slate-700 dark:text-slate-200 font-mono"
                        >v{{ fb.clientVersion }}</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[9px] text-slate-500 dark:text-slate-300 font-mono">{{
                        new Date(fb.createdAt).toLocaleString()
                      }}</span>
                      <button
                        v-if="canEdit"
                        class="text-[9px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer border-0 bg-transparent flex items-center"
                        title="删除日志 / Delete entry"
                        @click="handleDeleteFeedback(fb.id)"
                      >
                        <Trash class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <pre
                    class="font-mono text-[10px] text-slate-300 leading-normal p-2 rounded bg-black/30 overflow-x-auto whitespace-pre-wrap break-all border border-white/5"
                    >{{ fb.content }}</pre
                  >
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Right Column: Sticky Metadata Sidebar -->
      <div
        class="xl:col-span-4 flex flex-col gap-4"
        :class="inline ? '' : 'overflow-y-auto max-h-[75vh] pr-1.5 custom-scrollbar'"
      >
        <!-- Author Profile Card -->
        <div
          v-if="plugin.user"
          class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 text-left shrink-0"
        >
          <div
            class="h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center text-sm shrink-0"
          >
            <img
              v-if="plugin.user.avatarUrl"
              :src="getAssetUrl(plugin.user.avatarUrl)"
              class="h-full w-full object-cover"
            />
            <span v-else class="font-semibold uppercase text-xs text-[var(--text-secondary)]">{{
              plugin.user.name?.slice(0, 1) || 'A'
            }}</span>
          </div>
          <div class="text-left min-w-0">
            <div class="text-xs font-bold text-[var(--text-primary)] truncate">
              {{ plugin.user.name }}
            </div>
            <div
              class="text-[10px] text-[var(--text-muted)] mt-1 font-medium uppercase tracking-wider"
            >
              {{ label('上传作者', 'Author') }}
            </div>
          </div>
        </div>

        <!-- Floating status badge / Quick download box -->
        <div
          class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 text-left"
        >
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{{
              label('下载选项', 'Download Options')
            }}</span>
            <div>
              <span
                v-if="plugin.status === 'APPROVED'"
                class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
              >
                {{ label('已发布', 'Approved') }}
              </span>
              <span
                v-else-if="plugin.status === 'PENDING'"
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
            :loading="!isExternal && localDownloading"
            class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] transition-all duration-300"
            @click="handlePluginDownload"
          >
            <template v-if="isExternal">
              <ExternalLink class="h-4.5 w-4.5" />
              <span>{{ label('前往源站获取下载', 'Visit Source Site') }}</span>
            </template>
            <template v-else>
              <Download v-if="!localDownloading" class="h-4.5 w-4.5 animate-bounce-slow" />
              <span>{{ label('下载插件资源', 'Download Add-on') }}</span>
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
                {{ plugin.downloads || 0 }}
              </span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[10px] text-[var(--text-muted)]">{{
                label('文件大小', 'File Size')
              }}</span>
              <span class="text-xs font-bold text-[var(--text-primary)]">
                {{ formatSize(plugin.fileSize) }}
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
              @click="emit('edit', plugin)"
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

            <div class="flex-1">
              <el-popover
                v-model:visible="showFavoriteCategorySelect"
                placement="top"
                :width="200"
                trigger="click"
                popper-class="!glass-panel !backdrop-blur-xl !rounded-2xl !p-3 !border-strong/10 shadow-[0_12px_30px_rgba(0,0,0,0.15)] text-left"
              >
                <template #reference>
                  <Button
                    variant="secondary"
                    size="sm"
                    class="w-full flex items-center justify-center gap-1.5"
                    :class="{ 'text-rose-400 bg-rose-500/5': isFavorited }"
                  >
                    <Heart
                      :class="[
                        'h-3.5 w-3.5',
                        isFavorited ? 'text-rose-500 fill-rose-500' : 'text-slate-400',
                      ]"
                    />
                    <span>{{
                      isFavorited ? label('已收藏', 'Saved') : label('收藏', 'Save')
                    }}</span>
                  </Button>
                </template>

                <!-- Category Dropdown Popover -->
                <div class="flex flex-col gap-1.5">
                  <span
                    class="text-[10px] text-slate-400 px-1 font-semibold uppercase tracking-wider"
                    >{{ label('选择收藏分类', 'Select Category') }}</span
                  >

                  <div class="max-h-[120px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
                    <button
                      v-for="cat in favoriteCategories"
                      :key="cat"
                      class="w-full px-2 py-1.5 text-left text-xs rounded hover:bg-white/5 transition-colors border-0 bg-transparent text-[var(--text-secondary)] hover:text-white flex items-center justify-between cursor-pointer"
                      @click="handleFavoriteWithCategory(cat)"
                    >
                      <span>{{ cat }}</span>
                      <span
                        v-if="isFavorited && pluginFavCategory === cat"
                        class="w-1.5 h-1.5 rounded-full bg-rose-500"
                      ></span>
                    </button>
                  </div>

                  <div class="border-t border-white/5 my-1"></div>

                  <!-- Add New Category -->
                  <div class="flex items-center gap-1.5 px-1">
                    <input
                      v-model="newFavoriteCategory"
                      type="text"
                      :placeholder="label('新分类...', 'New Folder...')"
                      class="flex-1 min-w-0 px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded focus:border-indigo-500 outline-none text-white placeholder-slate-500"
                      @keyup.enter="handleCreateAndFavorite"
                    />
                    <button
                      class="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors border-0 cursor-pointer flex items-center justify-center shrink-0"
                      @click="handleCreateAndFavorite"
                    >
                      <CheckCircle2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </el-popover>
            </div>

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
            v-if="isAdmin && plugin.status === 'PENDING'"
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

        <!-- ZIP File Explorer -->
        <div
          v-if="isPackageFilesLoading || packageFiles.length > 0"
          class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left shrink-0"
        >
          <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
            <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {{ label('压缩包包含', 'Package Contents') }}
              <span v-if="!isPackageFilesLoading">({{ packageFiles.length }})</span>
            </span>
            <RefreshCw
              v-if="isPackageFilesLoading"
              class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0"
            />
          </div>
          <div
            v-if="isPackageFilesLoading"
            class="p-3 flex items-center gap-2 text-xs text-[var(--text-muted)]"
          >
            <span>{{ label('正在读取...', 'Reading...') }}</span>
          </div>
          <div
            v-else
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
                <Box class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              </template>
              <span class="truncate min-w-0">
                {{ node.name }}
              </span>
            </div>
          </div>
        </div>

        <!-- Telemetry Stats Card -->
        <div
          class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left"
        >
          <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
            <Settings class="h-3.5 w-3.5 text-teal-400" />
            <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {{ label('技术参数与规格', 'Specifications') }}
            </span>
          </div>
          <div class="p-3 flex flex-col gap-2 text-xs">
            <div class="flex justify-between">
              <span class="text-[var(--text-muted)]">{{ label('兼容版本', 'Compatibility') }}</span>
              <span
                class="font-semibold text-[var(--text-secondary)] truncate max-w-[120px]"
                :title="plugin.compatibility"
                >{{ plugin.compatibility || '-' }}</span
              >
            </div>
            <div class="flex justify-between">
              <span class="text-[var(--text-muted)]">{{ label('当前版本', 'Version') }}</span>
              <span class="font-semibold text-[var(--text-secondary)]">v{{ plugin.version }}</span>
            </div>
          </div>
        </div>

        <!-- Copyright Info -->
        <div
          class="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left"
        >
          <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
            <Shield class="h-3.5 w-3.5 text-indigo-400" />
            <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {{ label('版权与许可协议', 'Copyright & Licensing') }}
            </span>
          </div>
          <div class="p-3 flex flex-col gap-2 text-xs">
            <div class="flex justify-between">
              <span class="text-[var(--text-muted)]">{{ label('原创属性', 'Originality') }}</span>
              <span class="font-semibold text-[var(--text-secondary)]">
                {{
                  plugin.originality === 'ORIGINAL'
                    ? label('原创', 'Original')
                    : plugin.originality === 'AUTHORIZED'
                      ? label('授权发布', 'Authorized')
                      : label('二次创作', 'Remix')
                }}
              </span>
            </div>
            <div v-if="plugin.license" class="flex justify-between">
              <span class="text-[var(--text-muted)]">{{ label('授权协议', 'License') }}</span>
              <span class="font-semibold text-teal-400 uppercase text-[10px]">{{
                plugin.license.replace('_', ' ')
              }}</span>
            </div>
            <div
              v-if="plugin.originality !== 'ORIGINAL' && plugin.originalAuthor"
              class="flex justify-between"
            >
              <span class="text-[var(--text-muted)]">{{ label('原作者', 'Original Author') }}</span>
              <span
                class="font-semibold text-[var(--text-secondary)] truncate max-w-[100px]"
                :title="plugin.originalAuthor"
                >{{ plugin.originalAuthor }}</span
              >
            </div>
            <div
              v-if="plugin.originality !== 'ORIGINAL' && plugin.originalLink"
              class="flex justify-between items-center"
            >
              <span class="text-[var(--text-muted)]">{{ label('原作链接', 'Original Link') }}</span>
              <a
                :href="plugin.originalLink"
                target="_blank"
                class="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                {{ label('查看', 'Link') }}
                <ExternalLink class="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        <!-- Tags badges Card -->
        <div
          v-if="getTagsList(plugin.tags).length > 0"
          class="border border-white/10 rounded-2xl p-3 bg-white/[0.01] dark:bg-white/[0.02] text-left"
        >
          <span
            class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold block mb-2"
            >{{ label('相关标签', 'Tags') }}</span
          >
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="tag in getTagsList(plugin.tags)"
              :key="tag"
              class="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] text-[var(--text-secondary)] border border-white/5 font-medium"
            >
              #{{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </component>

  <ShareDialog ref="shareDialogRef" :type="activeKind" />

  <!-- Downloading Progress Dialog Overlay -->
  <DownloadProgressOverlay
    :is-downloading="localDownloading"
    :progress="downloadProgress"
    :speed-str="downloadSpeedStr"
    @cancel="cancelDownload"
  />
</template>

<style scoped>
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
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

/* Markdown typography and scaling overrides for plugin description */
.plugin-markdown-content :deep(.md-editor-preview),
.plugin-markdown-content :deep(.md-preview),
.plugin-markdown-content :deep(.mdw__preview-only) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px !important;
  line-height: 1.6 !important;
  background-color: transparent !important;
  padding: 0 !important;
}

.plugin-markdown-content :deep(.md-editor-preview h1),
.plugin-markdown-content :deep(.md-preview h1) {
  font-size: 14px !important;
  margin-top: 14px !important;
  margin-bottom: 8px !important;
  font-weight: 800 !important;
  color: var(--text-primary) !important;
}

.plugin-markdown-content :deep(.md-editor-preview h2),
.plugin-markdown-content :deep(.md-preview h2) {
  font-size: 13px !important;
  margin-top: 12px !important;
  margin-bottom: 6px !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
}

.plugin-markdown-content :deep(.md-editor-preview h3),
.plugin-markdown-content :deep(.md-preview h3) {
  font-size: 12px !important;
  margin-top: 10px !important;
  margin-bottom: 4px !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
}

.plugin-markdown-content :deep(.md-editor-preview p),
.plugin-markdown-content :deep(.md-preview p),
.plugin-markdown-content :deep(.md-editor-preview li),
.plugin-markdown-content :deep(.md-preview li) {
  font-size: 11px !important;
  line-height: 1.6 !important;
  color: var(--text-secondary) !important;
  margin-bottom: 6px !important;
}

.plugin-markdown-content :deep(.md-editor-preview ul),
.plugin-markdown-content :deep(.md-preview ul) {
  list-style-type: disc !important;
  padding-left: 16px !important;
  margin-bottom: 8px !important;
}

.plugin-markdown-content :deep(.md-editor-preview ol),
.plugin-markdown-content :deep(.md-preview ol) {
  list-style-type: decimal !important;
  padding-left: 16px !important;
  margin-bottom: 8px !important;
}
</style>

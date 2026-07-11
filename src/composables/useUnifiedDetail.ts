/**
 * useUnifiedDetail.ts
 *
 * Composable that consolidates the stateful business logic of UnifiedDetailModal.vue:
 *   - Version history (fetch / publish / edit / delete)
 *   - Favorite category management
 *   - Developer panel (token generation, feedbacks)
 *   - Blender integration code generator
 *
 * The modal component now only declares props/emits and delegates logic here,
 * keeping the <script setup> block lean and focused on presentation wiring.
 */

import { ref, computed, watch } from 'vue';
import { toast, messageBox } from '@/utils/feedbackAdapter';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { useLabel } from '@/utils/i18n';

// ── Shared interfaces ─────────────────────────────────────────────────────────

export interface VersionItem {
  id: string;
  version: string;
  changelog: string | null;
  fileUrl: string;
  fileSize: number | null;
  downloads: number;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  feedbackType: 'BUG' | 'SUGGESTION' | 'OTHER';
  clientVersion: string;
  content: string;
  createdAt: string;
}

// ── useVersions ───────────────────────────────────────────────────────────────

export interface UseVersionsOptions {
  /** Reactive API prefix, e.g. computed(() => '/api/plugins') */
  apiPrefix: () => string;
  uploadFieldName: () => string;
  /** Reactive ID of the active item */
  activeItemId: () => string | undefined;
  /** Reactive version of the active item (to compare current) */
  activeItemVersion: () => string | undefined;
  onUpdate: () => void;
}

export function useVersions(options: UseVersionsOptions) {
  const { apiPrefix, uploadFieldName, activeItemId, onUpdate } = options;
  const label = useLabel();

  const versionsList = ref<VersionItem[]>([]);
  const isVersionsLoading = ref(false);
  const showVersionUploadPanel = ref(false);
  const publishVersionForm = ref({ version: '', changelog: '' });
  const publishVersionFile = ref<File | null>(null);
  const releaseFileInput = ref<HTMLInputElement | null>(null);
  const isPublishingVersion = ref(false);
  const editingVersionId = ref<string | null>(null);
  const editingVersionForm = ref({ version: '', changelog: '' });
  const isUpdatingVersion = ref(false);

  const fetchVersions = async () => {
    const id = activeItemId();
    if (!id) return;
    isVersionsLoading.value = true;
    try {
      const { data } = await api.get(`${apiPrefix()}/${id}/versions`);
      if (activeItemId() === id) {
        versionsList.value = data;
      }
    } catch (err) {
      logError(err, { operation: 'fetch versions' });
    } finally {
      if (activeItemId() === id) {
        isVersionsLoading.value = false;
      }
    }
  };

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
    const id = activeItemId();
    if (!id || !publishVersionFile.value || !publishVersionForm.value.version.trim()) {
      toast.warning(label('请上传文件并填写版本号', 'Please upload file and fill version'));
      return;
    }
    isPublishingVersion.value = true;
    const formData = new FormData();
    formData.append(uploadFieldName(), publishVersionFile.value);
    formData.append('version', publishVersionForm.value.version.trim());
    formData.append('changelog', publishVersionForm.value.changelog.trim());
    try {
      await api.post(`${apiPrefix()}/${id}/versions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(label('新版本已上传', 'New version uploaded successfully'));
      publishVersionForm.value = { version: '', changelog: '' };
      publishVersionFile.value = null;
      showVersionUploadPanel.value = false;
      await fetchVersions();
      onUpdate();
    } catch (error) {
      logError(error, { operation: 'publish version' });
      toast.error(label('上传失败', 'Upload failed'));
    } finally {
      isPublishingVersion.value = false;
    }
  };

  const handleEditVersion = (v: VersionItem) => {
    editingVersionId.value = v.id;
    editingVersionForm.value = { version: v.version, changelog: v.changelog || '' };
  };

  const handleUpdateVersionSubmit = async (versionId: string) => {
    const id = activeItemId();
    if (!id || !editingVersionForm.value.version.trim()) return;
    isUpdatingVersion.value = true;
    try {
      await api.put(`${apiPrefix()}/${id}/versions/${versionId}`, {
        version: editingVersionForm.value.version.trim(),
        changelog: editingVersionForm.value.changelog.trim(),
      });
      toast.success(label('版本信息已更新', 'Version info updated successfully'));
      editingVersionId.value = null;
      await fetchVersions();
      onUpdate();
    } catch (err) {
      logError(err, { operation: 'update version' });
      toast.error(label('更新版本失败', 'Failed to update version'));
    } finally {
      isUpdatingVersion.value = false;
    }
  };

  const handleDeleteVersion = async (v: VersionItem) => {
    const id = activeItemId();
    if (!id) return;
    try {
      await messageBox.confirm(
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
      await api.delete(`${apiPrefix()}/${id}/versions/${v.id}`);
      toast.success(label('版本已删除', 'Version deleted'));
      await fetchVersions();
      onUpdate();
    } catch (err: unknown) {
      logError(err, { operation: 'delete version' });
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        label('删除版本失败', 'Failed to delete version');
      toast.error(msg);
    }
  };

  const resetVersions = () => {
    versionsList.value = [];
    showVersionUploadPanel.value = false;
    editingVersionId.value = null;
  };

  return {
    versionsList,
    isVersionsLoading,
    showVersionUploadPanel,
    publishVersionForm,
    publishVersionFile,
    releaseFileInput,
    isPublishingVersion,
    editingVersionId,
    editingVersionForm,
    isUpdatingVersion,
    fetchVersions,
    handlePublishVersionFileChange,
    handlePublishVersionSubmit,
    handleEditVersion,
    handleUpdateVersionSubmit,
    handleDeleteVersion,
    resetVersions,
  };
}

// ── useFavoriteCategories ─────────────────────────────────────────────────────

export interface UseFavoriteCategoriesOptions {
  apiPrefix: () => string;
  activeItemId: () => string | undefined;
  onFavorite: () => void;
}

export function useFavoriteCategories(options: UseFavoriteCategoriesOptions) {
  const { apiPrefix, activeItemId, onFavorite } = options;
  const label = useLabel();

  const showFavoriteCategorySelect = ref(false);
  const favoriteCategories = ref<string[]>(['默认']);
  const newFavoriteCategory = ref('');
  const pluginFavCategory = ref('');

  const fetchFavoriteCategories = async () => {
    try {
      const { data } = await api.get(`${apiPrefix()}/favorites`);
      favoriteCategories.value = data.categories || ['默认'];
      const id = activeItemId();
      if (id) {
        const match = data.favorites?.find(
          (f: { plugin?: { id: string }; software?: { id: string }; category: string }) =>
            (f.plugin?.id || f.software?.id) === id,
        );
        pluginFavCategory.value = match ? match.category : '';
      }
    } catch (err) {
      logError(err, { operation: 'fetch favorite categories' });
    }
  };

  const handleFavoriteWithCategory = async (categoryName: string) => {
    const id = activeItemId();
    if (!id) return;
    try {
      const { data } = await api.post(`${apiPrefix()}/${id}/favorite`, { category: categoryName });
      onFavorite();
      showFavoriteCategorySelect.value = false;
      toast.success(
        data.isFavorited
          ? label(`已收藏至 [${categoryName}]`, `Saved to [${categoryName}]`)
          : label('已取消收藏', 'Favorite removed'),
      );
      await fetchFavoriteCategories();
    } catch (err) {
      logError(err, { operation: 'toggle favorite with category' });
      toast.error(label('操作失败', 'Action failed'));
    }
  };

  const handleCreateAndFavorite = () => {
    if (newFavoriteCategory.value.trim()) {
      handleFavoriteWithCategory(newFavoriteCategory.value.trim());
      newFavoriteCategory.value = '';
    }
  };

  const resetFavoriteCategories = () => {
    showFavoriteCategorySelect.value = false;
  };

  return {
    showFavoriteCategorySelect,
    favoriteCategories,
    newFavoriteCategory,
    pluginFavCategory,
    fetchFavoriteCategories,
    handleFavoriteWithCategory,
    handleCreateAndFavorite,
    resetFavoriteCategories,
  };
}

// ── useDeveloperPanel ─────────────────────────────────────────────────────────

export interface UseDeveloperPanelOptions {
  activeItemId: () => string | undefined;
  canEdit: () => boolean;
  isPlugin: () => boolean;
}

export function useDeveloperPanel(options: UseDeveloperPanelOptions) {
  const { activeItemId, canEdit, isPlugin } = options;
  const label = useLabel();

  const developerToken = ref('');
  const feedbacks = ref<FeedbackItem[]>([]);
  const isFeedbacksLoading = ref(false);
  const isGeneratingToken = ref(false);
  const isBlenderCodeExpanded = ref(false);

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

  const fetchTokenAndFeedbacks = async () => {
    const id = activeItemId();
    if (!id || !canEdit() || !isPlugin()) return;
    isFeedbacksLoading.value = true;
    try {
      const { data } = await api.get(`/api/plugins/${id}`);
      const res = await api.get(`/api/plugins/${id}/feedbacks`);
      if (activeItemId() === id) {
        developerToken.value = data.developerToken || '';
        feedbacks.value = res.data;
      }
    } catch (err) {
      logError(err, { operation: 'fetch developer details' });
    } finally {
      if (activeItemId() === id) {
        isFeedbacksLoading.value = false;
      }
    }
  };

  const handleGenerateToken = async () => {
    const id = activeItemId();
    if (!id) return;
    isGeneratingToken.value = true;
    try {
      const { data } = await api.post(`/api/plugins/${id}/token`);
      developerToken.value = data.developerToken;
      toast.success(label('Token 生成成功', 'Token generated successfully'));
    } catch (err) {
      logError(err, { operation: 'generate developer token' });
      toast.error(label('生成 Token 失败', 'Failed to generate token'));
    } finally {
      isGeneratingToken.value = false;
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    const id = activeItemId();
    if (!id) return;
    try {
      await messageBox.confirm(
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
      await api.delete(`/api/plugins/${id}/feedbacks/${feedbackId}`);
      toast.success(label('反馈已删除', 'Feedback deleted'));
      await fetchTokenAndFeedbacks();
    } catch (err) {
      logError(err, { operation: 'delete feedback' });
      toast.error(label('删除反馈失败', 'Failed to delete feedback'));
    }
  };

  const handleClearFeedbacks = async () => {
    const id = activeItemId();
    if (!id) return;
    try {
      await messageBox.confirm(
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
      await api.delete(`/api/plugins/${id}/feedbacks`);
      toast.success(label('所有反馈已清空', 'All feedbacks cleared'));
      await fetchTokenAndFeedbacks();
    } catch (err) {
      logError(err, { operation: 'clear feedbacks' });
      toast.error(label('清空反馈失败', 'Failed to clear feedbacks'));
    }
  };

  const copyIntegrationCode = async () => {
    try {
      await navigator.clipboard.writeText(blenderIntegrationCode.value);
      toast.success(label('代码已复制到剪贴板！', 'Code copied to clipboard!'));
    } catch {
      toast.error(label('复制失败，请手动选取代码', 'Copy failed, please select manually'));
    }
  };

  const resetDeveloperPanel = () => {
    developerToken.value = '';
    feedbacks.value = [];
    isBlenderCodeExpanded.value = false;
  };

  return {
    developerToken,
    feedbacks,
    isFeedbacksLoading,
    isGeneratingToken,
    isBlenderCodeExpanded,
    blenderIntegrationCode,
    fetchTokenAndFeedbacks,
    handleGenerateToken,
    handleDeleteFeedback,
    handleClearFeedbacks,
    copyIntegrationCode,
    resetDeveloperPanel,
  };
}

// ── useUnifiedDetail (convenience aggregator) ────────────────────────────────

export interface UseUnifiedDetailOptions {
  apiPrefix: () => string;
  uploadFieldName: () => string;
  activeItemId: () => string | undefined;
  activeItemVersion: () => string | undefined;
  canEdit: () => boolean;
  isPlugin: () => boolean;
  onUpdate: () => void;
  onFavorite: () => void;
}

/**
 * Aggregator composable that wires up all three sub-composables and
 * exposes a unified "reset on item change" watcher.
 */
export function useUnifiedDetail(options: UseUnifiedDetailOptions) {
  const { activeItemId, activeItemVersion, canEdit, isPlugin, onUpdate, onFavorite } = options;

  const versions = useVersions({
    apiPrefix: options.apiPrefix,
    uploadFieldName: options.uploadFieldName,
    activeItemId,
    activeItemVersion,
    onUpdate,
  });

  const favoriteCategories = useFavoriteCategories({
    apiPrefix: options.apiPrefix,
    activeItemId,
    onFavorite,
  });

  const developerPanel = useDeveloperPanel({
    activeItemId,
    canEdit,
    isPlugin,
  });

  /**
   * Resets all transient state and re-fetches data when the active item changes.
   * Call this from a watch() in the consuming component.
   */
  const resetAndRefetch = async (id: string) => {
    versions.resetVersions();
    favoriteCategories.resetFavoriteCategories();
    developerPanel.resetDeveloperPanel();

    await Promise.all([versions.fetchVersions(), favoriteCategories.fetchFavoriteCategories()]);

    if (canEdit() && isPlugin()) {
      await developerPanel.fetchTokenAndFeedbacks();
    }
  };

  return {
    ...versions,
    ...favoriteCategories,
    ...developerPanel,
    resetAndRefetch,
  };
}

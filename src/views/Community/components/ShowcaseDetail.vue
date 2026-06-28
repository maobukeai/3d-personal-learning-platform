<script setup lang="ts">
import {
  formatCompactNumber as formatNumber,
  formatRelativeTime as formatTime,
} from '@/utils/format';
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/preview.css';
import { logError, getApiErrorMessage } from '@/utils/error';
import {
  X,
  Edit3,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Type,
  Heart,
  Eye,
  MessageCircle,
  Clock,
  Share2,
  Check,
  Play,
  Download,
  Send,
  Save,
  Image,
  Video,
  Box,
  Layers3,
  Puzzle,
  Sparkles,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import axios from 'axios';
import { downloadFileMultiThreaded } from '@/utils/downloadHelper';
import { useAuthStore } from '@/stores/auth';
import { parseTags } from '@/utils/tags';
import type { ShowcaseItem, ShowcaseType, ShowcaseUser } from './showcaseTypes';

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: ShowcaseUser;
}

const props = defineProps<{
  isOpen: boolean;
  item: ShowcaseItem | null;
  isAdmin: boolean;
  showcases: ShowcaseItem[];
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', val: boolean): void;
  (e: 'update:item', val: ShowcaseItem | null): void;
  (e: 'select-tag', tag: string): void;
  (e: 'refresh-list'): void;
  (e: 'user-profile', userId: string): void;
}>();

const authStore = useAuthStore();


const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const comments = ref<CommentItem[]>([]);
const commentsLoading = ref(false);
const newComment = ref('');
const isSubmittingComment = ref(false);
const shareCopied = ref(false);
const currentImageIndex = ref(0);
const relatedShowcases = ref<ShowcaseItem[]>([]);
const relatedLoading = ref(false);
const isEditingDetail = ref(false);
const isSavingDetail = ref(false);
const isDeletingDetail = ref(false);

const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue'));

const activeMediaTab = ref<'renders' | '3d' | 'video'>('renders');
const selectedModelId = ref<string>('');

const availableModels = computed(() => {
  const models = [];
  if (props.item?.linkedAssets && props.item.linkedAssets.length > 0) {
    models.push(...props.item.linkedAssets);
  } else if (props.item?.asset) {
    models.push(props.item.asset);
  }
  return models;
});

const activeModel = computed(() => {
  if (availableModels.value.length === 0) return null;
  return availableModels.value.find(m => m.id === selectedModelId.value) || availableModels.value[0];
});

const myApprovedAssets = ref<Array<{ id: string; title: string }>>([]);
const myApprovedMaterials = ref<Array<{ id: string; title: string }>>([]);
const myApprovedPlugins = ref<Array<{ id: string; title: string }>>([]);

const fetchMyApprovedResources = async () => {
  try {
    const [assetsRes, materialsRes, pluginsRes] = await Promise.all([
      api.get('/api/assets/my'),
      api.get('/api/materials/my'),
      api.get('/api/plugins/my'),
    ]);
    myApprovedAssets.value = ((assetsRes.data || []) as any[])
      .filter((asset: any) => asset.status === 'APPROVED')
      .map((asset: any) => ({ id: String(asset.id), title: String(asset.title) }));
    myApprovedMaterials.value = ((materialsRes.data || []) as any[])
      .filter((mat: any) => mat.status === 'APPROVED')
      .map((mat: any) => ({ id: String(mat.id), title: String(mat.title) }));
    myApprovedPlugins.value = ((pluginsRes.data || []) as any[])
      .filter((plugin: any) => plugin.status === 'APPROVED')
      .map((plugin: any) => ({ id: String(plugin.id), title: String(plugin.title) }));
  } catch (error) {
    logError(error, { operation: 'showcaseDetail.fetchMyResources', component: 'ShowcaseDetail' });
  }
};

const editForm = ref({
  title: '',
  description: '',
  tags: '',
  type: 'IMAGE' as ShowcaseType,
  videoUrl: '',
  isVideo: false,
  linkedAssetIds: [] as string[],
  linkedMaterialIds: [] as string[],
  linkedPluginIds: [] as string[],
});
const editThumbnail = ref<File | null>(null);
const editImages = ref<File[]>([]);

const typeOptions: Array<{ value: ShowcaseType; label: string; icon: Component }> = [
  { value: 'IMAGE', label: '图片', icon: Image },
  { value: 'VIDEO', label: '视频', icon: Video },
  { value: 'MODEL', label: '3D模型', icon: Box },
  { value: 'TEXT', label: '文本', icon: Type },
  { value: 'OTHER', label: '其他', icon: Layers3 },
];

const getTypeLabel = (type: ShowcaseType) =>
  typeOptions.find((option) => option.value === type)?.label ?? '作品';

const getTypeClass = (type: ShowcaseType) => {
  if (type === 'MODEL') return 'tone-blue';
  if (type === 'VIDEO') return 'tone-rose';
  if (type === 'IMAGE') return 'tone-green';
  if (type === 'TEXT') return 'tone-amber';
  return 'tone-slate';
};

const canManageDetail = computed(() => {
  if (!props.item) return false;
  return props.item.user.id === authStore.user?.id || props.isAdmin;
});

const detailStatusMeta = computed(() => {
  const status = props.item?.status ?? 'APPROVED';
  if (status === 'PENDING') {
    return {
      label: '审核中',
      tone: 'status-pending',
      hint: '仅你和管理员可见，审核通过后进入全站作品流。',
    };
  }
  if (status === 'REJECTED') {
    return { label: '已驳回', tone: 'status-rejected', hint: '修改后重新提交审核。' };
  }
  return { label: '已发布', tone: 'status-approved', hint: '全站可见' };
});

const detailImages = computed(() => {
  if (!props.item) return [];
  const images: string[] = [];
  if (props.item.thumbnailUrl) images.push(getAssetUrl(props.item.thumbnailUrl));
  if (props.item.images) {
    try {
      const parsed = JSON.parse(props.item.images);
      if (Array.isArray(parsed)) {
        parsed.forEach((url) => {
          const normalized = getAssetUrl(String(url));
          if (normalized) images.push(normalized);
        });
      }
    } catch {}
  }
  return Array.from(new Set(images.filter(Boolean)));
});

const currentDetailImage = computed(() => detailImages.value[currentImageIndex.value] ?? '');

const isVideoUrl = (url: string) => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return cleanUrl.endsWith('.mp4') || 
         cleanUrl.endsWith('.webm') || 
         cleanUrl.endsWith('.mov') || 
         cleanUrl.endsWith('.ogg') ||
         cleanUrl.endsWith('.quicktime');
};

const similarShowcases = computed(() => {
  if (relatedShowcases.value.length) return relatedShowcases.value;
  if (!props.item) return [];
  const tagsSet = new Set(parseTags(props.item.tags));
  return props.showcases
    .filter((item) => item.id !== props.item?.id)
    .map((item) => {
      const tagScore = parseTags(item.tags).filter((tag) => tagsSet.has(tag)).length;
      const typeScore = item.type === props.item?.type ? 2 : 0;
      return { item, score: tagScore + typeScore };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.item);
});

const hydrateEditForm = (target: ShowcaseItem) => {
  editForm.value = {
    title: target.title,
    description: target.description || '',
    tags: parseTags(target.tags).join(', '),
    type: target.type,
    videoUrl: target.videoUrl || '',
    isVideo: target.isVideo || target.type === 'VIDEO',
    linkedAssetIds: target.linkedAssets?.map(a => a.id) || (target.assetId ? [target.assetId] : []),
    linkedMaterialIds: target.linkedMaterials?.map(m => m.id) || [],
    linkedPluginIds: target.linkedPlugins?.map(p => p.id) || [],
  };
  editThumbnail.value = null;
  editImages.value = [];
};

const watchTrigger = computed(() => props.item?.id);
watch(
  watchTrigger,
  (newId) => {
    if (newId && props.item) {
      fetchComments(newId);
      fetchRelatedShowcases(newId);
      hydrateEditForm(props.item);
      currentImageIndex.value = 0;
      isEditingDetail.value = false;
      activeMediaTab.value = 'renders';
      if (availableModels.value.length > 0) {
        selectedModelId.value = availableModels.value[0].id;
      } else {
        selectedModelId.value = '';
      }
    } else {
      comments.value = [];
      newComment.value = '';
    }
  },
  { immediate: true },
);

const isIframeVideo = computed(() => {
  const url = props.item?.videoUrl;
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'bilibili.com' ||
      hostname.endsWith('.bilibili.com') ||
      hostname === 'vimeo.com' ||
      hostname.endsWith('.vimeo.com') ||
      hostname === 'player.vimeo.com' ||
      hostname.endsWith('.player.vimeo.com')
    );
  } catch {
    return false;
  }
});

const fetchComments = async (showcaseId: string) => {
  commentsLoading.value = true;
  try {
    const response = await api.get(`/api/showcase/${showcaseId}/comments`);
    if (props.item?.id === showcaseId) {
      comments.value = response.data;
    }
  } catch (error) {
    logError(error, { operation: 'showcase.fetchComments', component: 'ShowcaseDetail' });
  } finally {
    if (props.item?.id === showcaseId) {
      commentsLoading.value = false;
    }
  }
};

const fetchRelatedShowcases = async (showcaseId: string) => {
  relatedLoading.value = true;
  try {
    const response = await api.get(`/api/showcase/${showcaseId}/related`);
    if (props.item?.id === showcaseId) {
      relatedShowcases.value = response.data;
    }
  } catch {
    if (props.item?.id === showcaseId) {
      relatedShowcases.value = [];
    }
  } finally {
    if (props.item?.id === showcaseId) {
      relatedLoading.value = false;
    }
  }
};

const closeDetail = () => {
  emit('update:isOpen', false);
  emit('update:item', null);
};

const prevImage = () => {
  if (currentImageIndex.value > 0) currentImageIndex.value--;
};

const nextImage = () => {
  if (currentImageIndex.value < detailImages.value.length - 1) currentImageIndex.value++;
};

const startEditDetail = () => {
  if (!props.item) return;
  hydrateEditForm(props.item);
  isEditingDetail.value = true;
  fetchMyApprovedResources();
};

const cancelEditDetail = () => {
  if (props.item) hydrateEditForm(props.item);
  isEditingDetail.value = false;
};

const handleEditThumbnailChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) editThumbnail.value = file;
};

const handleEditImagesChange = (event: Event) => {
  editImages.value = Array.from((event.target as HTMLInputElement).files ?? []);
};

const setEditType = (type: ShowcaseType) => {
  editForm.value.type = type;
};

const saveDetail = async () => {
  if (!props.item) return;
  if (!editForm.value.title.trim()) {
    ElMessage.warning('请填写作品标题');
    return;
  }

  isSavingDetail.value = true;
  try {
    const formData = new FormData();
    formData.append('title', editForm.value.title.trim());
    formData.append('description', editForm.value.description);
    formData.append('tags', editForm.value.tags);
    formData.append('type', editForm.value.type);
    formData.append('videoUrl', editForm.value.videoUrl);
    formData.append('isVideo', String(editForm.value.isVideo || editForm.value.type === 'VIDEO'));
    formData.append('linkedAssetIds', JSON.stringify(editForm.value.linkedAssetIds));
    formData.append('linkedMaterialIds', JSON.stringify(editForm.value.linkedMaterialIds));
    formData.append('linkedPluginIds', JSON.stringify(editForm.value.linkedPluginIds));
    if (editThumbnail.value) formData.append('thumbnail', editThumbnail.value);
    editImages.value.forEach((image) => formData.append('images', image));

    const response = await api.put(`/api/showcase/${props.item.id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const updatedDetail = { ...props.item, ...response.data } as ShowcaseItem;
    emit('update:item', updatedDetail);
    hydrateEditForm(updatedDetail);
    isEditingDetail.value = false;
    emit('refresh-list');
    ElMessage.success(
      response.data.status === 'PENDING' ? '已保存，等待审核通过后进入全站' : '作品已更新',
    );
  } catch {
    ElMessage.error('保存失败，请稍后重试');
  } finally {
    isSavingDetail.value = false;
  }
};

const downloadMaterialFile = async (material: any) => {
  try {
    await api.post(`/api/materials/${material.id}/download`);
    const response = await api.get(`/api/materials/${material.id}/file`, {
      responseType: 'blob',
    });
    const ext = material.fileUrl?.split('.').pop() || 'zip';
    const safeTitle = (material.title || 'material').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    ElMessage.error('下载材质失败，请稍后重试');
  }
};

const downloadPluginFile = async (plugin: any) => {
  if (!plugin.fileUrl) {
    ElMessage.error('此插件没有有效的下载地址');
    return;
  }
  try {
    const resolvedUrl = getAssetUrl(plugin.fileUrl);
    const ext = plugin.fileUrl.split('.').pop()?.split('?')[0] || 'zip';
    const safeTitle = (plugin.title || 'plugin').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
    await downloadFileMultiThreaded(resolvedUrl, `${safeTitle}.${ext}`);
    await api.post(`/api/plugins/${plugin.id}/download`);
  } catch (error: any) {
    if (axios.isCancel(error) || error?.name === 'CanceledError' || error?.name === 'AbortError' || error?.message === 'canceled') {
      return;
    }
    const status = error?.response?.status;
    const msg = status === 404
      ? '文件不存在或已被删除，请联系管理员'
      : '下载插件失败，请稍后重试';
    ElMessage.error(msg);
  }
};

const deleteDetail = async () => {
  if (!props.item) return;
  try {
    await ElMessageBox.confirm(`确定删除《${props.item.title}》吗？删除后无法恢复。`, '删除作品', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }

  isDeletingDetail.value = true;
  try {
    const deletedId = props.item.id;
    await api.delete(`/api/showcase/${deletedId}`);
    emit('refresh-list');
    closeDetail();
    ElMessage.success('作品已删除');
  } catch (error) {
    logError('Failed to delete showcase:', error);
    ElMessage.error(getApiErrorMessage(error, '删除作品失败'));
  } finally {
    isDeletingDetail.value = false;
  }
};

const toggleLike = async (target: ShowcaseItem) => {
  try {
    const response = await api.post(`/api/showcase/${target.id}/like`);
    const updated = {
      ...target,
      isLiked: response.data.liked !== undefined ? response.data.liked : response.data.isLiked,
      likesCount: response.data.likesCount,
    };
    if (props.item && target.id === props.item.id) {
      emit('update:item', updated);
    }
    emit('refresh-list');
  } catch {
    ElMessage.error('操作失败，请重试');
  }
};

const handleShare = async (target?: ShowcaseItem | null) => {
  const shareTarget = target || props.item;
  if (!shareTarget) return;
  try {
    const url = `${window.location.origin}/showcase?workId=${shareTarget.id}`;
    await navigator.clipboard.writeText(url);
    shareCopied.value = true;
    ElMessage.success('作品链接已复制到剪贴板，快分享给你的好友吧！');
    setTimeout(() => {
      shareCopied.value = false;
    }, 2000);
  } catch {
    ElMessage.error('分享链接生成失败，请手动复制浏览器地址。');
  }
};

const submitComment = async () => {
  if (!newComment.value.trim() || !props.item) return;
  isSubmittingComment.value = true;
  try {
    const response = await api.post(`/api/showcase/${props.item.id}/comment`, {
      content: newComment.value,
    });
    comments.value.unshift(response.data);
    const updated = {
      ...props.item,
      commentsCount: props.item.commentsCount + 1,
    };
    emit('update:item', updated);
    newComment.value = '';
    emit('refresh-list');
  } catch {
    ElMessage.error('评论发表失败');
  } finally {
    isSubmittingComment.value = false;
  }
};

const deleteComment = async (comment: CommentItem) => {
  if (!props.item) return;
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '删除评论', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/showcase/${props.item.id}/comment/${comment.id}`);
    comments.value = comments.value.filter((item) => item.id !== comment.id);
    const updated = {
      ...props.item,
      commentsCount: Math.max(0, props.item.commentsCount - 1),
    };
    emit('update:item', updated);
    emit('refresh-list');
    ElMessage.success('评论已删除');
  } catch {}
};

const openDetail = (target: ShowcaseItem) => {
  emit('update:item', target);
};

const selectTag = (tag: string) => {
  emit('select-tag', tag);
};

const openUserProfile = (userId: string) => {
  emit('user-profile', userId);
};

const handleStartChat = async (user: ShowcaseUser) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    ElMessage.success('会话已创建');
  } catch {
    ElMessage.error('发起会话失败');
  }
};
</script>

<template>
  <Transition name="detail-fade">
    <div v-if="isOpen" class="detail-layer mobile-adaptive">
      <div class="detail-backdrop" @click="closeDetail"></div>
      <aside class="detail-drawer">
        <header class="detail-header">
          <div>
            <span>作品详情</span>
            <strong v-if="item">{{ item.title }}</strong>
          </div>
          <div class="detail-header-actions mobile-row">
            <button
              v-if="item && canManageDetail && !isEditingDetail"
              type="button"
              title="编辑作品"
              @click="startEditDetail"
            >
              <Edit3 class="w-4 h-4" />
            </button>
            <button
              v-if="item && canManageDetail"
              type="button"
              class="danger"
              :disabled="isDeletingDetail"
              title="删除作品"
              @click="deleteDetail"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button type="button" title="关闭" @click="closeDetail">
              <X class="w-5 h-5" />
            </button>
          </div>
        </header>

        <div v-if="!item" class="detail-loading">
          <RefreshCw class="w-6 h-6 animate-spin" />
          正在加载作品...
        </div>

        <template v-else>
          <div class="detail-content">
            <section class="detail-media-panel">
              <!-- Media Tab Selector -->
              <div v-if="availableModels.length > 0 || item.videoUrl" class="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl mb-3">
                <button
                  type="button"
                  class="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer"
                  :class="activeMediaTab === 'renders' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-transparent'"
                  @click="activeMediaTab = 'renders'"
                >
                  效果图册
                </button>
                <button
                  v-if="availableModels.length > 0"
                  type="button"
                  class="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer"
                  :class="activeMediaTab === '3d' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-transparent'"
                  @click="activeMediaTab = '3d'"
                >
                  3D交互
                </button>
                <button
                  v-if="item.videoUrl"
                  type="button"
                  class="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer"
                  :class="activeMediaTab === 'video' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-transparent'"
                  @click="activeMediaTab = 'video'"
                >
                  视频演示
                </button>
              </div>

              <!-- Media Content Panel -->
              <div v-if="activeMediaTab === 'renders'">
                <div v-if="currentDetailImage" class="detail-media">
                  <video
                    v-if="isVideoUrl(currentDetailImage)"
                    :src="currentDetailImage"
                    class="w-full h-full object-contain"
                    controls
                  ></video>
                  <img v-else :src="currentDetailImage" :alt="item.title" />
                  <button
                    v-if="currentImageIndex > 0"
                    type="button"
                    class="gallery-button left"
                    title="上一张"
                    @click="prevImage"
                  >
                    <ChevronLeft class="w-5 h-5" />
                  </button>
                  <button
                    v-if="currentImageIndex < detailImages.length - 1"
                    type="button"
                    class="gallery-button right"
                    title="下一张"
                    @click="nextImage"
                  >
                    <ChevronRight class="w-5 h-5" />
                  </button>
                </div>
                <div v-else class="detail-media detail-media--empty">
                  <Type class="w-10 h-10" />
                  <span>文本作品</span>
                </div>

                <div v-if="detailImages.length > 1" class="thumbnail-strip">
                  <button
                    v-for="(image, idx) in detailImages"
                    :key="image"
                    type="button"
                    :class="{ active: currentImageIndex === idx }"
                    @click="currentImageIndex = idx"
                  >
                    <video
                      v-if="isVideoUrl(image)"
                      :src="image"
                      class="w-full h-full object-cover"
                      muted
                      playsinline
                    ></video>
                    <img v-else :src="image" :alt="`${item.title} ${idx + 1}`" />
                  </button>
                </div>
              </div>

              <!-- 3D Interactive Viewport -->
              <div v-else-if="activeMediaTab === '3d' && activeModel">
                <div class="relative w-full aspect-[1.5] rounded-2xl overflow-hidden bg-slate-950 border border-slate-200/50 dark:border-slate-800/50 mb-3">
                  <ModelViewer
                    :model-url="activeModel.url"
                    :default-camera-pos="activeModel.defaultCameraPos"
                    :default-camera-target="activeModel.defaultCameraTarget"
                    :scene-config="{
                      environment: activeModel.defaultEnvironment || 'sunset',
                      exposure: activeModel.defaultExposure || 1.0,
                      showGrid: true
                    }"
                    show-controls
                    class="w-full h-full"
                  />
                </div>

                <!-- Multiple Models Selector -->
                <div v-if="availableModels.length > 1" class="model-selector-strip mt-3 mb-3 flex items-center gap-1.5 overflow-x-auto p-1 scrollbar-hide">
                  <span class="text-[10px] uppercase font-black tracking-widest text-slate-400 mr-1 flex-shrink-0">切换模型:</span>
                  <button
                    v-for="model in availableModels"
                    :key="model.id"
                    type="button"
                    class="px-3 py-1 rounded-lg text-xs font-bold transition-all border whitespace-nowrap cursor-pointer"
                    :class="selectedModelId === model.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'"
                    @click="selectedModelId = model.id"
                  >
                    {{ model.title }}
                  </button>
                </div>

                <!-- Model Specs Card -->
                <div class="model-specs-card p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">3D 规格参数</h4>
                    <a
                      v-if="activeModel.isFree || authStore.user"
                      :href="getAssetUrl(activeModel.url)"
                      download
                      class="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1"
                    >
                      <Download class="w-3.5 h-3.5" />
                      下载模型
                    </a>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="flex flex-col">
                      <span class="text-[9px] text-slate-400 uppercase font-semibold">名称</span>
                      <strong class="truncate font-semibold mt-0.5" style="color: var(--text-primary)">{{ activeModel.title }}</strong>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[9px] text-slate-400 uppercase font-semibold">类型</span>
                      <strong class="font-semibold mt-0.5" style="color: var(--text-primary)">{{ activeModel.type }}</strong>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[9px] text-slate-400 uppercase font-semibold">顶点数</span>
                      <strong class="font-semibold mt-0.5" style="color: var(--text-primary)">{{ activeModel.vertices ? formatNumber(activeModel.vertices) : '---' }}</strong>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[9px] text-slate-400 uppercase font-semibold">三角面数</span>
                      <strong class="font-semibold mt-0.5" style="color: var(--text-primary)">{{ activeModel.faces ? formatNumber(activeModel.faces) : '---' }}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Video Viewport -->
              <div v-else-if="activeMediaTab === 'video' && item.videoUrl">
                <div class="relative w-full aspect-[1.5] rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-200/50 dark:border-slate-800/50">
                  <iframe
                    v-if="isIframeVideo"
                    :src="item.videoUrl"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    class="w-full h-full"
                  ></iframe>
                  <video
                    v-else
                    :src="item.videoUrl"
                    controls
                    class="w-full h-full"
                  ></video>
                </div>
              </div>
            </section>

            <section class="detail-info-panel">
              <div class="detail-title-row mobile-row">
                <span :class="['detail-type', getTypeClass(item.type)]">
                  {{ getTypeLabel(item.type) }}
                </span>
                <span :class="['detail-status', detailStatusMeta.tone]">
                  {{ detailStatusMeta.label }}
                </span>
              </div>

              <div v-if="isEditingDetail" class="detail-edit-form">
                <label>
                  <span>标题</span>
                  <input v-model="editForm.title" type="text" placeholder="作品标题" />
                </label>

                <label>
                  <span>标签</span>
                  <input v-model="editForm.tags" type="text" placeholder="Render, Cycles, Retro" />
                </label>

                <label>
                  <span>嵌入已发布3D模型</span>
                  <el-select
                    v-model="editForm.linkedAssetIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    placeholder="选择想展示在帖子里的已发布3D模型(可多选)"
                    class="w-full custom-select-v2 mt-1"
                  >
                    <el-option
                      v-for="asset in myApprovedAssets"
                      :key="asset.id"
                      :label="asset.title"
                      :value="asset.id"
                    />
                  </el-select>
                </label>

                <label class="mt-2 block">
                  <span>嵌入已发布材质</span>
                  <el-select
                    v-model="editForm.linkedMaterialIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    placeholder="选择想展示在帖子里的已发布材质(可多选)"
                    class="w-full custom-select-v2 mt-1"
                  >
                    <el-option
                      v-for="mat in myApprovedMaterials"
                      :key="mat.id"
                      :label="mat.title"
                      :value="mat.id"
                    />
                  </el-select>
                </label>

                <label class="mt-2 block">
                  <span>嵌入已发布插件</span>
                  <el-select
                    v-model="editForm.linkedPluginIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    placeholder="选择想展示在帖子里的已发布插件(可多选)"
                    class="w-full custom-select-v2 mt-1"
                  >
                    <el-option
                      v-for="plugin in myApprovedPlugins"
                      :key="plugin.id"
                      :label="plugin.title"
                      :value="plugin.id"
                    />
                  </el-select>
                </label>


                <label>
                  <span>作品说明</span>
                  <MarkdownEditor v-model="editForm.description" height="240px" simple />
                </label>

                <div class="detail-file-row mobile-row">
                  <label>
                    <span>替换封面</span>
                    <input type="file" accept="image/*" @change="handleEditThumbnailChange" />
                    <small>{{ editThumbnail?.name || '保持当前封面' }}</small>
                  </label>
                  <label>
                    <span>补充图集</span>
                    <input type="file" accept="image/*" multiple @change="handleEditImagesChange" />
                    <small>{{
                      editImages.length ? `已选择 ${editImages.length} 张` : '可一次追加多张'
                    }}</small>
                  </label>
                </div>

                <div class="detail-edit-actions mobile-row">
                  <button
                    type="button"
                    class="primary"
                    :disabled="isSavingDetail"
                    @click="saveDetail"
                  >
                    <RefreshCw v-if="isSavingDetail" class="w-4 h-4 animate-spin" />
                    <Save v-else class="w-4 h-4" />
                    {{ isSavingDetail ? '保存中' : '保存修改' }}
                  </button>
                  <button type="button" @click="cancelEditDetail">取消</button>
                </div>
                <p class="detail-status-hint">{{ detailStatusMeta.hint }}</p>
              </div>

              <template v-else>
                <h1>{{ item.title }}</h1>

                <div class="detail-author mobile-row">
                  <UserAvatar :user="item.user" size="md" />
                  <button
                    type="button"
                    class="detail-author-profile"
                    @click="openUserProfile(item.user.id)"
                  >
                    <strong>{{ item.user.name || item.user.email || '匿名创作者' }}</strong>
                    <span>{{ item.user.bio || '查看创作者主页与更多作品' }}</span>
                  </button>
                  <button
                    v-if="item.user.id !== authStore.user?.id"
                    type="button"
                    class="detail-author-chat"
                    title="私信创作者"
                    @click="handleStartChat(item.user)"
                  >
                    <MessageCircle class="w-4 h-4" />
                  </button>
                </div>

                <div v-if="parseTags(item.tags).length" class="detail-tags">
                  <button
                    v-for="tag in parseTags(item.tags)"
                    :key="tag"
                    type="button"
                    @click="selectTag(tag)"
                  >
                    #{{ tag }}
                  </button>
                </div>

                <div class="detail-actions mobile-row">
                  <button type="button" :class="{ liked: item.isLiked }" @click="toggleLike(item)">
                    <Heart class="w-4 h-4" :class="{ 'fill-current': item.isLiked }" />
                    {{ formatNumber(item.likesCount) }}
                  </button>
                  <span><Eye class="w-4 h-4" />{{ formatNumber(item.views) }}</span>
                  <span
                    ><MessageCircle class="w-4 h-4" />{{ formatNumber(item.commentsCount) }}</span
                  >
                  <span><Clock class="w-4 h-4" />{{ formatTime(item.createdAt) }}</span>
                  <button type="button" @click="handleShare(item)">
                    <component :is="shareCopied ? Check : Share2" class="w-4 h-4" />
                    {{ shareCopied ? '已复制' : '分享' }}
                  </button>
                </div>

                <a
                  v-if="item.videoUrl"
                  :href="item.videoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="detail-link"
                >
                  <Play class="w-4 h-4" />
                  打开视频源
                </a>

                <a
                  v-if="item.asset?.url"
                  :href="getAssetUrl(item.asset.url)"
                  download
                  class="detail-link"
                >
                  <Download class="w-4 h-4" />
                  下载关联模型：{{ item.asset.title }}
                </a>

                <div v-if="item.description" class="detail-description">
                  <MdPreview :model-value="item.description" class="md-preview-showcase" />
                </div>
                <p v-else class="detail-description-empty">创作者还没有填写详细说明。</p>

                <!-- 关联的资源作品 (Linked Resources) -->
                <div v-if="(item.linkedAssets && item.linkedAssets.length > 0) || (item.linkedMaterials && item.linkedMaterials.length > 0) || (item.linkedPlugins && item.linkedPlugins.length > 0)" class="linked-resources-section mt-6 border-t border-slate-200/60 dark:border-slate-800/40 pt-5">
                  <h3 class="text-xs font-black uppercase tracking-wider text-indigo-500 mb-3.5 flex items-center gap-1.5">
                    <Sparkles class="w-4 h-4 text-indigo-500" />
                    本作品中使用的资源
                  </h3>
                  
                  <div class="space-y-3">
                    <!-- Linked Assets (3D models) -->
                    <div v-if="item.linkedAssets && item.linkedAssets.length > 0" class="space-y-2">
                      <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">3D模型作品</div>
                      <div class="grid grid-cols-1 gap-2.5">
                        <div v-for="asset in item.linkedAssets" :key="asset.id" class="flex items-center justify-between p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-10 h-10 rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-800/40 bg-slate-100 dark:bg-slate-950 flex-shrink-0 flex items-center justify-center">
                              <img v-if="asset.thumbnail" :src="getAssetUrl(asset.thumbnail)" class="w-full h-full object-cover" />
                              <Box v-else class="w-5 h-5 text-slate-400" />
                            </div>
                            <div class="min-w-0">
                              <h5 class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{{ asset.title }}</h5>
                              <p class="text-[10px] text-slate-500 mt-0.5">
                                <span v-if="asset.type" class="mr-2">{{ asset.type }}</span>
                                <span v-if="asset.vertices">{{ formatNumber(asset.vertices) }} 顶点</span>
                              </p>
                            </div>
                          </div>
                          <a :href="getAssetUrl(asset.url)" download class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 border-0 cursor-pointer transition-colors no-underline">
                            <Download class="w-3.5 h-3.5" />
                            下载模型
                          </a>
                        </div>
                      </div>
                    </div>

                    <!-- Linked Materials -->
                    <div v-if="item.linkedMaterials && item.linkedMaterials.length > 0" class="space-y-2 mt-4">
                      <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">材质贴图作品</div>
                      <div class="grid grid-cols-1 gap-2.5">
                        <div v-for="mat in item.linkedMaterials" :key="mat.id" class="flex items-center justify-between p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-10 h-10 rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-800/40 bg-slate-100 dark:bg-slate-950 flex-shrink-0 flex items-center justify-center">
                              <img v-if="mat.previewUrl" :src="getAssetUrl(mat.previewUrl)" class="w-full h-full object-cover" />
                              <Layers3 v-else class="w-5 h-5 text-slate-400" />
                            </div>
                            <div class="min-w-0">
                              <h5 class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{{ mat.title }}</h5>
                              <p class="text-[10px] text-slate-500 mt-0.5">
                                <span class="mr-2">{{ mat.category || '其它贴图' }}</span>
                                <span v-if="mat.resolution">{{ mat.resolution }} 分辨率</span>
                              </p>
                            </div>
                          </div>
                          <button type="button" @click="downloadMaterialFile(mat)" class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 border-0 cursor-pointer transition-colors">
                            <Download class="w-3.5 h-3.5" />
                            下载材质
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Linked Plugins -->
                    <div v-if="item.linkedPlugins && item.linkedPlugins.length > 0" class="space-y-2 mt-4">
                      <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">工具插件作品</div>
                      <div class="grid grid-cols-1 gap-2.5">
                        <div v-for="plugin in item.linkedPlugins" :key="plugin.id" class="flex items-center justify-between p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-10 h-10 rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-800/40 bg-slate-100 dark:bg-slate-950 flex-shrink-0 flex items-center justify-center">
                              <img v-if="plugin.previewUrl" :src="getAssetUrl(plugin.previewUrl)" class="w-full h-full object-cover" />
                              <Puzzle v-else class="w-5 h-5 text-slate-400" />
                            </div>
                            <div class="min-w-0">
                              <h5 class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{{ plugin.title }}</h5>
                              <p class="text-[10px] text-slate-500 mt-0.5">
                                <span class="mr-2">v{{ plugin.version }}</span>
                                <span v-if="plugin.compatibility">{{ plugin.compatibility }}</span>
                              </p>
                            </div>
                          </div>
                          <button type="button" @click="downloadPluginFile(plugin)" class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 border-0 cursor-pointer transition-colors">
                            <Download class="w-3.5 h-3.5" />
                            下载插件
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="relatedLoading" class="comments-empty">
                  <RefreshCw class="w-4 h-4 animate-spin" />
                  正在匹配相关作品
                </div>
                <div v-else-if="similarShowcases.length" class="similar-strip mobile-row">
                  <h3>相关作品</h3>
                  <button
                    v-for="simItem in similarShowcases"
                    :key="simItem.id"
                    type="button"
                    @click="openDetail(simItem)"
                  >
                    <img
                      v-if="simItem.thumbnailUrl"
                      :src="getAssetUrl(simItem.thumbnailUrl)"
                      :alt="simItem.title"
                    />
                    <span>{{ simItem.title }}</span>
                  </button>
                </div>
              </template>
            </section>
          </div>

          <section class="comments-panel">
            <header>
              <h2>讨论区</h2>
              <span>{{ formatNumber(item.commentsCount) }} 条评论</span>
            </header>

            <div class="comment-composer mobile-row">
              <UserAvatar :user="authStore.user" size="sm" />
              <input
                v-model="newComment"
                type="text"
                placeholder="写下反馈、问题或制作建议..."
                @keyup.enter="submitComment"
              />
              <button
                type="button"
                :disabled="isSubmittingComment || !newComment.trim()"
                title="发送评论"
                @click="submitComment"
              >
                <Send class="w-4 h-4" />
              </button>
            </div>

            <div v-if="commentsLoading" class="comments-empty">
              <RefreshCw class="w-5 h-5 animate-spin" />
              正在加载评论
            </div>
            <div v-else-if="!comments.length" class="comments-empty">还没有评论，来开第一句。</div>
            <div v-else class="comment-list">
              <article v-for="comment in comments" :key="comment.id" class="comment-item">
                <UserAvatar :user="comment.user" size="sm" />
                <div>
                  <header>
                    <strong>{{ comment.user.name || comment.user.email || '匿名用户' }}</strong>
                    <span>{{ formatTime(comment.createdAt) }}</span>
                    <button
                      v-if="comment.user.id === authStore.user?.id || isAdmin"
                      type="button"
                      title="删除评论"
                      @click="deleteComment(comment)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </header>
                  <p>{{ comment.content }}</p>
                </div>
              </article>
            </div>
          </section>
        </template>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.custom-select-v2 :deep(.el-input__wrapper),
.custom-select-v2 :deep(.el-select__wrapper) {
  border-radius: 12px !important;
  background-color: var(--bg-surface) !important;
  box-shadow: 0 0 0 1px var(--border-base) inset !important;
  padding: 8px 12px !important;
  min-height: 44px !important;
  height: 44px !important;
}
.custom-select-v2 :deep(.el-input__inner) {
  height: 100% !important;
}
</style>

<script setup lang="ts">
import {
  formatCompactNumber as formatNumber,
  formatRelativeTime as formatTime,
} from '@/utils/format';
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import { logError } from '@/utils/error';
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
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
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

const MdPreview = defineAsyncComponent(async () => {
  await import('md-editor-v3/lib/style.css');
  return (await import('md-editor-v3')).MdPreview;
});
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

const editForm = ref({
  title: '',
  description: '',
  tags: '',
  type: 'IMAGE' as ShowcaseType,
  videoUrl: '',
  isVideo: false,
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
    } else {
      comments.value = [];
      newComment.value = '';
    }
  },
  { immediate: true },
);

const fetchComments = async (showcaseId: string) => {
  commentsLoading.value = true;
  try {
    const response = await api.get(`/api/showcase/${showcaseId}/comments`);
    comments.value = response.data;
  } catch (error) {
    logError(error, { operation: 'showcase.fetchComments', component: 'ShowcaseDetail' });
  } finally {
    commentsLoading.value = false;
  }
};

const fetchRelatedShowcases = async (showcaseId: string) => {
  relatedLoading.value = true;
  try {
    const response = await api.get(`/api/showcase/${showcaseId}/related`);
    relatedShowcases.value = response.data;
  } catch {
    relatedShowcases.value = [];
  } finally {
    relatedLoading.value = false;
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

const deleteDetail = async () => {
  if (!props.item) return;
  try {
    await ElMessageBox.confirm(`确定删除《${props.item.title}》吗？删除后无法恢复。`, '删除作品', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    isDeletingDetail.value = true;
    const deletedId = props.item.id;
    await api.delete(`/api/showcase/${deletedId}`);
    emit('refresh-list');
    closeDetail();
    ElMessage.success('作品已删除');
  } catch {
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
              <div v-if="currentDetailImage" class="detail-media">
                <img :src="currentDetailImage" :alt="item.title" />
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
                  <img :src="image" :alt="`${item.title} ${idx + 1}`" />
                </button>
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

                <div class="detail-edit-types mobile-row">
                  <button
                    v-for="opt in typeOptions"
                    :key="opt.value"
                    type="button"
                    :class="[{ active: editForm.type === opt.value }, getTypeClass(opt.value)]"
                    @click="setEditType(opt.value)"
                  >
                    <component :is="opt.icon" class="w-3.5 h-3.5" />
                    {{ opt.label }}
                  </button>
                </div>

                <label>
                  <span>标签</span>
                  <input v-model="editForm.tags" type="text" placeholder="Render, Cycles, Retro" />
                </label>

                <label v-if="editForm.type === 'VIDEO' || editForm.isVideo">
                  <span>视频链接</span>
                  <input v-model="editForm.videoUrl" type="url" placeholder="https://..." />
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

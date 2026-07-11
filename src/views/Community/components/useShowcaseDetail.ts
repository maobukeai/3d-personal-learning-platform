import { ref, computed, watch, defineAsyncComponent } from 'vue';
import { logError, getApiErrorMessage } from '@/utils/error';
import { toast, messageBox } from '@/utils/feedbackAdapter';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { parseTags } from '@/utils/tags';
import type { ShowcaseItem, ShowcaseType, ShowcaseUser } from './showcaseTypes';
import { downloadMaterialFile, downloadPluginFile } from './showcaseHelpers';
export interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: ShowcaseUser;
}
export interface ShowcaseDetailProps {
  isOpen: boolean;
  item: ShowcaseItem | null;
  isAdmin: boolean;
  showcases: ShowcaseItem[];
}
export type ShowcaseDetailEmits = {
  (e: 'update:isOpen', val: boolean): void;
  (e: 'update:item', val: ShowcaseItem | null): void;
  (e: 'select-tag', tag: string): void;
  (e: 'refresh-list'): void;
  (e: 'user-profile', userId: string): void;
}; /* eslint-disable @typescript-eslint/no-explicit-any */
export function useShowcaseDetail(props: ShowcaseDetailProps, emit: ShowcaseDetailEmits) {
  const authStore = useAuthStore();
  const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
  const comments = ref<CommentItem[]>([]);
  const commentsLoading = ref(false);
  const newComment = ref('');
  const isSubmittingComment = ref(false);
  const relatedShowcases = ref<ShowcaseItem[]>([]);
  const relatedLoading = ref(false);
  const isEditingDetail = ref(false);
  const isSavingDetail = ref(false);
  const isDeletingDetail = ref(false);
  const myApprovedAssets = ref<Array<{ id: string; title: string }>>([]);
  const myApprovedMaterials = ref<Array<{ id: string; title: string }>>([]);
  const myApprovedPlugins = ref<Array<{ id: string; title: string }>>([]);
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
      linkedAssetIds:
        target.linkedAssets?.map((a) => a.id) || (target.assetId ? [target.assetId] : []),
      linkedMaterialIds: target.linkedMaterials?.map((m) => m.id) || [],
      linkedPluginIds: target.linkedPlugins?.map((p) => p.id) || [],
    };
    editThumbnail.value = null;
    editImages.value = [];
  };
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
      logError(error, {
        operation: 'showcaseDetail.fetchMyResources',
        component: 'ShowcaseDetail',
      });
    }
  };
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
  const saveDetail = async () => {
    if (!props.item) return;
    if (!editForm.value.title.trim()) {
      toast.warning('请填写作品标题');
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
      toast.success(
        response.data.status === 'PENDING' ? '已保存，等待审核通过后进入全站' : '作品已更新',
      );
    } catch {
      toast.error('保存失败，请稍后重试');
    } finally {
      isSavingDetail.value = false;
    }
  };
  const deleteDetail = async () => {
    if (!props.item) return;
    try {
      await messageBox.confirm(`确定删除《${props.item.title}》吗？删除后无法恢复。`, '删除作品', {
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
      toast.success('作品已删除');
    } catch (error) {
      logError(error, { operation: 'Failed to delete showcase' });
      toast.error(getApiErrorMessage(error, '删除作品失败'));
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
      toast.error('操作失败，请重试');
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
      const updated = { ...props.item, commentsCount: props.item.commentsCount + 1 };
      emit('update:item', updated);
      newComment.value = '';
      emit('refresh-list');
    } catch {
      toast.error('评论发表失败');
    } finally {
      isSubmittingComment.value = false;
    }
  };
  const deleteComment = async (comment: CommentItem) => {
    if (!props.item) return;
    try {
      await messageBox.confirm('确定要删除这条评论吗？', '删除评论', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
      await api.delete(`/api/showcase/${props.item.id}/comment/${comment.id}`);
      comments.value = comments.value.filter((item) => item.id !== comment.id);
      const updated = { ...props.item, commentsCount: Math.max(0, props.item.commentsCount - 1) };
      emit('update:item', updated);
      emit('refresh-list');
      toast.success('评论已删除');
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
      await api.post('/api/messages/conversations', { participantIds: [user.id], isGroup: false });
      toast.success('会话已创建');
    } catch {
      toast.error('发起会话失败');
    }
  };
  watch(
    () => props.item?.id,
    (newId) => {
      if (newId && props.item) {
        fetchComments(newId);
        fetchRelatedShowcases(newId);
        hydrateEditForm(props.item);
        isEditingDetail.value = false;
      } else {
        comments.value = [];
        newComment.value = '';
      }
    },
    { immediate: true },
  );
  return {
    authStore,
    MarkdownEditor,
    comments,
    commentsLoading,
    newComment,
    isSubmittingComment,
    relatedShowcases,
    relatedLoading,
    isEditingDetail,
    isSavingDetail,
    isDeletingDetail,
    myApprovedAssets,
    myApprovedMaterials,
    myApprovedPlugins,
    editForm,
    editThumbnail,
    editImages,
    canManageDetail,
    detailStatusMeta,
    similarShowcases,
    fetchComments,
    fetchRelatedShowcases,
    closeDetail,
    startEditDetail,
    cancelEditDetail,
    handleEditThumbnailChange,
    handleEditImagesChange,
    saveDetail,
    deleteDetail,
    toggleLike,
    submitComment,
    deleteComment,
    openDetail,
    selectTag,
    openUserProfile,
    handleStartChat,
    hydrateEditForm,
    fetchMyApprovedResources,
    downloadMaterialFile,
    downloadPluginFile,
  };
}

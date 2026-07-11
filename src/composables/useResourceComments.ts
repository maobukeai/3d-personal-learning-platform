import { ref } from 'vue';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { useAuthStore } from '@/stores/auth';
import { useLabel } from '@/utils/i18n';
import { ElMessage } from '@/utils/feedbackBridge';

/**
 * Shared comment state + CRUD logic for resource detail modals.
 *
 * Extracted from the duplicated `fetchComments` / `handlePostComment` /
 * `handleDeleteComment` / `canDeleteComment` block that previously appeared
 * verbatim in AssetDetailModal, MaterialDetailPanel, and PluginDetailModal.
 *
 * @param resourceType - API path segment: `'assets'` | `'materials'` | `'plugins'`
 * @param getResourceId - reactive getter returning the current resource id
 *                        (or `undefined` when no resource is loaded)
 *
 * @returns `{ comments, isCommentsLoading, newCommentContent, isSubmittingComment,
 *            fetchComments, handlePostComment, handleDeleteComment,
 *            canDeleteComment, resetComments }`
 */
export function useResourceComments(resourceType: any, getResourceId: () => string | undefined) {
  const authStore = useAuthStore();
  const label = useLabel();

  const comments = ref<any[]>([]);
  const isCommentsLoading = ref(false);
  const newCommentContent = ref('');
  const isSubmittingComment = ref(false);

  const fetchComments = async () => {
    const targetId = getResourceId();
    if (!targetId) return;
    const type =
      typeof resourceType === 'function'
        ? resourceType()
        : typeof resourceType === 'object' && 'value' in resourceType
          ? (resourceType as any).value
          : resourceType;
    isCommentsLoading.value = true;
    try {
      const { data } = await api.get(`/api/${type}/${targetId}/comments`);
      // Race guard: only apply if still viewing the same resource (prevents
      // stale data when the user switches resources while a fetch is in flight).
      if (getResourceId() === targetId) {
        comments.value = data;
      }
    } catch (err) {
      logError(err, { operation: 'fetch comments' });
    } finally {
      if (getResourceId() === targetId) {
        isCommentsLoading.value = false;
      }
    }
  };

  const handlePostComment = async () => {
    const targetId = getResourceId();
    if (!targetId || !newCommentContent.value.trim()) return;
    const type =
      typeof resourceType === 'function'
        ? resourceType()
        : typeof resourceType === 'object' && 'value' in resourceType
          ? (resourceType as any).value
          : resourceType;
    isSubmittingComment.value = true;
    try {
      const { data } = await api.post(`/api/${type}/${targetId}/comments`, {
        content: newCommentContent.value.trim(),
      });
      comments.value.unshift(data);
      newCommentContent.value = '';
      ElMessage.success(label('评论发表成功', 'Comment posted successfully'));
    } catch (err: any) {
      logError('Failed to post comment:', err);
      ElMessage.error(err.response?.data?.error || label('评论发表失败', 'Failed to post comment'));
    } finally {
      isSubmittingComment.value = false;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const type =
        typeof resourceType === 'function'
          ? resourceType()
          : typeof resourceType === 'object' && 'value' in resourceType
            ? (resourceType as any).value
            : resourceType;
      await api.delete(`/api/${type}/comments/${commentId}`);
      comments.value = comments.value.filter((c) => c.id !== commentId);
      ElMessage.success(label('评论已删除', 'Comment deleted'));
    } catch (err: any) {
      logError('Failed to delete comment:', err);
      ElMessage.error(
        err.response?.data?.error || label('删除评论失败', 'Failed to delete comment'),
      );
    }
  };

  const canDeleteComment = (comment: any) => {
    if (!authStore.user) return false;
    return authStore.user.id === comment.userId || authStore.user.role === 'ADMIN';
  };

  const resetComments = () => {
    comments.value = [];
    newCommentContent.value = '';
  };

  return {
    comments,
    isCommentsLoading,
    newCommentContent,
    isSubmittingComment,
    fetchComments,
    handlePostComment,
    handleDeleteComment,
    canDeleteComment,
    resetComments,
  };
}

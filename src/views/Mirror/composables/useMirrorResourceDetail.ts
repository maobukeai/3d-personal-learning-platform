import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMirrorStore } from '@/stores/mirror';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { ElMessage } from '@/utils/feedbackBridge';
import { getApiErrorMessage, logError } from '@/utils/error';
import api from '@/utils/api';
import { decryptText } from '@/utils/crypto';
import type { MirrorComment } from '../components/detail/MirrorResourceComments.vue';

export function useMirrorResourceDetail() {
  const route = useRoute();
  const router = useRouter();
  const mirrorStore = useMirrorStore();
  const authStore = useAuthStore();
  const workspaceStore = useWorkspaceStore();

  const resourceId = computed(() => route.params.id as string);
  const resource = ref<any | null>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);
  const comments = ref<MirrorComment[]>([]);
  const likeStatus = ref({ liked: false, count: 0 });
  const isSubmittingComment = ref(false);
  const isTogglingLike = ref(false);
  const isExtracting = ref(false);
  const showSecurityVerifyModal = ref(false);
  const showLinkDialog = ref(false);
  const pendingExtractLink = ref<{ name: string; type: string } | null>(null);
  const activeLink = ref<{ name: string; url: string; code?: string; type: string } | null>(null);

  async function loadResource() {
    // 切换课程时强行重置所有提取与数据状态，绝对杜绝信息残留
    activeLink.value = null;
    showLinkDialog.value = false;
    showSecurityVerifyModal.value = false;
    pendingExtractLink.value = null;
    resource.value = null;
    isLoading.value = true;
    error.value = null;

    try {
      const data = await mirrorStore.fetchResource(resourceId.value);
      if (data) {
        resource.value = data;
        if (data.sourceId) {
          workspaceStore.setWorkspaceById(`mirror-${data.sourceId}`);
          mirrorStore.fetchCategories(data.sourceId);
        }
      } else {
        error.value = '资源不存在';
      }
    } catch (e) {
      error.value = getApiErrorMessage(e, '加载失败');
    } finally {
      isLoading.value = false;
    }
  }

  function goBack() {
    if (window.history.length > 1 && window.history.state?.back) {
      router.back();
    } else if (resource.value?.sourceId) {
      router.push(`/mirror/source/${resource.value.sourceId}`);
    } else {
      router.push('/dashboard');
    }
  }

  async function fetchComments() {
    try {
      const res = await api.get(`/api/mirror/resources/${resourceId.value}/comments`);
      comments.value = res.data;
    } catch (e) {
      logError(e, { operation: 'mirror.fetchComments', component: 'MirrorResourceDetail' });
    }
  }

  async function fetchLikeStatus() {
    try {
      const res = await api.get(`/api/mirror/resources/${resourceId.value}/like-status`);
      likeStatus.value = res.data;
    } catch (e) {
      logError(e, { operation: 'mirror.fetchLikeStatus', component: 'MirrorResourceDetail' });
    }
  }

  async function toggleLike() {
    if (isTogglingLike.value) return;
    isTogglingLike.value = true;
    try {
      const res = await api.post(`/api/mirror/resources/${resourceId.value}/like`);
      likeStatus.value = res.data;
    } catch (e) {
      ElMessage.error(getApiErrorMessage(e, '操作失败'));
    } finally {
      isTogglingLike.value = false;
    }
  }

  async function submitComment(content: string) {
    isSubmittingComment.value = true;
    try {
      const res = await api.post(`/api/mirror/resources/${resourceId.value}/comments`, { content });
      comments.value.unshift(res.data);
      ElMessage.success('发表成功');
    } catch (e) {
      ElMessage.error(getApiErrorMessage(e, '发表评论失败'));
    } finally {
      isSubmittingComment.value = false;
    }
  }

  async function deleteComment(commentId: string) {
    try {
      await api.delete(`/api/mirror/resources/comments/${commentId}`);
      comments.value = comments.value.filter((c) => c.id !== commentId);
      ElMessage.success('删除成功');
    } catch (e) {
      ElMessage.error(getApiErrorMessage(e, '删除评论失败'));
    }
  }

  function handleStartExtract(link: { name: string; type: string }) {
    if (!authStore.isAuthenticated) {
      ElMessage.warning('请先登录后提取资源');
      if (route.path.startsWith('/portal')) {
        authStore.setShowLoginModal(true);
      } else {
        router.push(`/login?redirect=${route.fullPath}`);
      }
      return;
    }
    if (resource.value?.hasAccess === false) {
      ElMessage.error('您的账号权限不足，请先升级会员');
      return;
    }
    pendingExtractLink.value = link;
    showSecurityVerifyModal.value = true;
  }

  async function handleSecurityVerified() {
    if (!pendingExtractLink.value) return;
    const link = pendingExtractLink.value;
    isExtracting.value = true;
    try {
      const res = await api.post(`/api/mirror/resources/${resourceId.value}/extract`);
      const envKey =
        import.meta.env.VITE_EXTRACT_ENCRYPTION_KEY ||
        '3d_learning_platform_secure_extract_key_2026';
      const url = res.data.encryptedLink
        ? decryptText(res.data.encryptedLink, envKey)
        : res.data.downloadUrl || res.data.url || res.data.contentUrl || '';
      const code = res.data.encryptedPassword
        ? decryptText(res.data.encryptedPassword, envKey)
        : res.data.code || '';
      activeLink.value = {
        name: link.name || res.data.driveName || '百度网盘',
        url,
        code,
        type: link.type || 'baidu',
      };
      showLinkDialog.value = true;
      if (res.data?.quota) {
        const q = res.data.quota;
        if (q.isAdmin) {
          ElMessage.success('身份核验通过，已安全提取网盘链接（管理员无限次）！');
        } else if (typeof q.remaining === 'number') {
          ElMessage.success(
            `提取成功！今日剩余获取次数：${q.remaining} 次（总共 ${q.total} 次/天）`,
          );
        } else {
          ElMessage.success('身份核验通过，已解密网盘链接！');
        }
      } else {
        ElMessage.success('身份核验通过，已解密网盘链接！');
      }
    } catch (e) {
      ElMessage.error(getApiErrorMessage(e, '提取失败'));
    } finally {
      isExtracting.value = false;
    }
  }

  const extractedLinks = computed(() => {
    if (!resource.value) return [];
    if (resource.value.links && resource.value.links.length > 0) return resource.value.links;
    if (resource.value.hasLinks) return [{ name: '资源下载', type: 'generic' }];
    return [];
  });

  function initData() {
    loadResource().then(() => {
      if (resource.value) {
        fetchComments();
        fetchLikeStatus();
      }
    });
  }

  onMounted(initData);
  watch(resourceId, initData);

  return {
    resourceId,
    resource,
    isLoading,
    error,
    comments,
    likeStatus,
    isSubmittingComment,
    isTogglingLike,
    isExtracting,
    showSecurityVerifyModal,
    showLinkDialog,
    pendingExtractLink,
    activeLink,
    extractedLinks,
    authStore,
    router,
    route,
    goBack,
    toggleLike,
    submitComment,
    deleteComment,
    handleStartExtract,
    handleSecurityVerified,
  };
}

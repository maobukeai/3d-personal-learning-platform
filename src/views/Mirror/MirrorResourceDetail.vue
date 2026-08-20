<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  Clock,
  Eye,
  Tag,
  Globe,
  Calendar,
  Loader2,
  AlertCircle,
  Lock,
  FolderTree,
} from 'lucide-vue-next';
import { getApiErrorMessage, logError } from '@/utils/error';
import { formatDateTime as formatDate } from '@/utils/format';
import { parseTags } from '@/utils/tags';
import { useMirrorStore } from '@/stores/mirror';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import SafeHtml from '@/components/SafeHtml.vue';
import { ElMessage } from '@/utils/feedbackBridge';
import api, { getAssetUrl } from '@/utils/api';
import { decryptText } from '@/utils/crypto';
import { getPlanName } from '@/utils/plans';

import MirrorResourceComments, {
  type MirrorComment,
} from './components/detail/MirrorResourceComments.vue';
import MirrorResourceExtractCard from './components/detail/MirrorResourceExtractCard.vue';
import MirrorResourceExtractModal from './components/detail/MirrorResourceExtractModal.vue';
import MirrorResourceSecurityVerifyModal from './components/detail/MirrorResourceSecurityVerifyModal.vue';

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
const isSubmittingComment = ref(false),
  isTogglingLike = ref(false),
  isExtracting = ref(false);
const showSecurityVerifyModal = ref(false),
  showLinkDialog = ref(false);
const pendingExtractLink = ref<{ name: string; type: string } | null>(null);
const activeLink = ref<{ name: string; url: string; code?: string; type: string } | null>(null);

async function loadResource() {
  const cached = mirrorStore.resources.find((r) => r.id === resourceId.value);
  if (cached) {
    resource.value = { ...cached };
    isLoading.value = false;
    if (cached.sourceId) {
      workspaceStore.setWorkspaceById(`mirror-${cached.sourceId}`);
      mirrorStore.fetchCategories(cached.sourceId);
    }
  } else {
    isLoading.value = true;
  }
  error.value = null;

  try {
    const data = await mirrorStore.fetchResource(resourceId.value);
    if (data) {
      resource.value = data;
      if (data.sourceId) {
        workspaceStore.setWorkspaceById(`mirror-${data.sourceId}`);
        mirrorStore.fetchCategories(data.sourceId);
      }
    } else if (!resource.value) {
      error.value = '资源不存在';
    }
  } catch (e) {
    if (!resource.value) error.value = getApiErrorMessage(e, '加载失败');
    else logError(e, { operation: 'Failed to refresh resource details in background' });
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  if (resource.value?.sourceId) router.push(`/mirror/source/${resource.value.sourceId}`);
  else router.push('/mirror');
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
    router.push(`/login?redirect=${route.fullPath}`);
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
      import.meta.env.VITE_EXTRACT_ENCRYPTION_KEY || '3d_learning_platform_secure_extract_key_2026';
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
    ElMessage.success('身份核验通过，已解密网盘链接！');
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

onMounted(() => {
  loadResource().then(() => {
    if (resource.value) {
      fetchComments();
      fetchLikeStatus();
    }
  });
});

watch(resourceId, () => {
  loadResource().then(() => {
    if (resource.value) {
      fetchComments();
      fetchLikeStatus();
    }
  });
});
</script>

<template>
  <div
    class="mirror-resource-detail h-full overflow-y-auto p-4 md:p-6 w-full max-w-[1500px] mx-auto scrollbar-hide"
  >
    <div class="flex items-center gap-3 mb-5">
      <button
        type="button"
        class="p-2 rounded-xl bg-white/70 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 transition-colors cursor-pointer"
        @click="goBack"
      >
        <ArrowLeft class="w-4 h-4" />
      </button>
      <span class="text-xs font-bold text-slate-400">返回资源列表</span>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-24">
      <Loader2 class="w-8 h-8 animate-spin text-blue-500" /><span
        class="ml-2 text-sm font-medium text-slate-500"
        >加载资源中...</span
      >
    </div>

    <div
      v-else-if="error"
      class="text-center py-20 bg-white/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-8"
    >
      <AlertCircle class="w-12 h-12 text-rose-400 mx-auto mb-3" />
      <p class="text-sm font-bold text-rose-500">{{ error }}</p>
      <button
        type="button"
        class="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
        @click="goBack"
      >
        返回列表
      </button>
    </div>

    <template v-else-if="resource">
      <!-- Auth / Member Alert Banner -->
      <div
        v-if="!authStore.isAuthenticated"
        class="mb-5 p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <AlertCircle class="w-5 h-5 text-blue-500 shrink-0" />
          <span class="text-xs md:text-sm text-blue-900 dark:text-blue-200 font-medium"
            >您当前以游客身份浏览。如需提取下载链接，请登录账号。</span
          >
        </div>
        <button
          type="button"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0"
          @click="router.push(`/login?redirect=${route.fullPath}`)"
        >
          立即登录
        </button>
      </div>

      <div
        v-else-if="resource.hasAccess === false"
        class="mb-5 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <Lock class="w-5 h-5 text-amber-500 shrink-0" />
          <span class="text-xs md:text-sm text-amber-900 dark:text-amber-200 font-medium"
            >会员权限不足（需要 {{ getPlanName(resource.requiredPlan ?? 0) }} 会员）。</span
          >
        </div>
        <button
          type="button"
          class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0"
          @click="router.push('/billing')"
        >
          升级会员
        </button>
      </div>

      <!-- Main Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <!-- Left: Article Content (2 columns) -->
        <div class="lg:col-span-2 space-y-6">
          <div
            class="bg-white/80 dark:bg-slate-800/70 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 overflow-hidden shadow-xs backdrop-blur-md"
          >
            <div
              v-if="resource.thumbnailUrl"
              class="w-full aspect-[16/9] max-h-[460px] bg-slate-100 dark:bg-slate-700 overflow-hidden border-b border-slate-100 dark:border-slate-700/50"
            >
              <img
                :src="getAssetUrl(resource.thumbnailUrl)"
                :alt="resource.title"
                class="w-full h-full object-cover"
              />
            </div>

            <div class="p-5 md:p-7 space-y-5">
              <div>
                <div class="flex items-center gap-2 mb-2.5">
                  <span
                    v-if="resource.category"
                    class="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"
                  >
                    <FolderTree class="w-3 h-3 inline mr-1" />{{ resource.category.name }}
                  </span>
                  <span
                    class="px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-500"
                    >{{ resource.resourceType }}</span
                  >
                </div>
                <h1
                  class="text-lg md:text-2xl font-black text-slate-900 dark:text-white leading-snug tracking-tight"
                >
                  {{ resource.title }}
                </h1>
              </div>

              <div
                class="flex flex-wrap items-center gap-4 text-xs text-slate-400 border-y border-slate-100 dark:border-slate-700/50 py-3"
              >
                <span class="flex items-center gap-1.5"
                  ><Globe class="w-3.5 h-3.5" />{{
                    resource.source?.displayName || resource.source?.name
                  }}</span
                >
                <span v-if="resource.publishedAt" class="flex items-center gap-1.5"
                  ><Calendar class="w-3.5 h-3.5" />{{ formatDate(resource.publishedAt) }}</span
                >
                <span class="flex items-center gap-1.5"
                  ><Clock class="w-3.5 h-3.5" />同步于 {{ formatDate(resource.syncedAt) }}</span
                >
                <span class="flex items-center gap-1.5 ml-auto"
                  ><Eye class="w-3.5 h-3.5" />{{ resource.viewCount }} 次浏览</span
                >
              </div>

              <div v-if="parseTags(resource.tags).length > 0" class="flex flex-wrap gap-1.5">
                <span
                  v-for="tag in parseTags(resource.tags)"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-medium"
                >
                  <Tag class="w-3 h-3" />{{ tag }}
                </span>
              </div>

              <div class="block lg:hidden">
                <MirrorResourceExtractCard
                  :resource="resource"
                  :extracted-links="extractedLinks"
                  :is-extracting="isExtracting"
                  :like-status="likeStatus"
                  :is-toggling-like="isTogglingLike"
                  @extract="handleStartExtract"
                  @toggle-like="toggleLike"
                />
              </div>

              <div class="pt-2">
                <SafeHtml
                  v-if="resource.contentHtml"
                  class="mirror-content prose prose-sm dark:prose-invert max-w-none"
                  :html="resource.contentHtml"
                />
                <div
                  v-else-if="resource.description"
                  class="prose prose-sm dark:prose-invert max-w-none"
                >
                  <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-2">资源简介</h3>
                  <p
                    class="text-xs md:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed"
                  >
                    {{ resource.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="block lg:hidden">
            <MirrorResourceComments
              :comments="comments"
              :is-submitting="isSubmittingComment"
              @submit="submitComment"
              @delete="deleteComment"
            />
          </div>
        </div>

        <!-- Right: Action & Comments Rail -->
        <div class="hidden lg:flex flex-col gap-5 lg:sticky lg:top-4">
          <MirrorResourceExtractCard
            :resource="resource"
            :extracted-links="extractedLinks"
            :is-extracting="isExtracting"
            :like-status="likeStatus"
            :is-toggling-like="isTogglingLike"
            @extract="handleStartExtract"
            @toggle-like="toggleLike"
          />
          <MirrorResourceComments
            :comments="comments"
            :is-submitting="isSubmittingComment"
            @submit="submitComment"
            @delete="deleteComment"
          />
        </div>
      </div>
    </template>

    <MirrorResourceSecurityVerifyModal
      v-model:show="showSecurityVerifyModal"
      :resource-title="resource?.title"
      @verified="handleSecurityVerified"
    />
    <MirrorResourceExtractModal v-model:show="showLinkDialog" :active-link="activeLink" />
  </div>
</template>

<style scoped>
.mirror-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 12px 0;
}
.mirror-content :deep(p) {
  margin: 8px 0;
  line-height: 1.7;
}
.mirror-content :deep(a) {
  color: #3b82f6;
  text-decoration: none;
}
.mirror-content :deep(a:hover) {
  text-decoration: underline;
}
</style>

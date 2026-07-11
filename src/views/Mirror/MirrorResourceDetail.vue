<script setup lang="ts">
import { getApiErrorMessage, logError } from '@/utils/error';
import { formatDateTime as formatDate } from '@/utils/format';
import { parseTags } from '@/utils/tags';

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
  Heart,
  MessageSquare,
  Trash2,
  Link2,
  Lock,
  ExternalLink,
  X,
} from 'lucide-vue-next';

import { useMirrorStore } from '@/stores/mirror';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

import SafeHtml from '@/components/SafeHtml.vue';

import { ElMessage } from '@/utils/feedbackBridge';

import api, { getAssetUrl } from '@/utils/api';

import { decryptText } from '@/utils/crypto';

import { getPlanName } from '@/utils/plans';
import Modal from '@/components/ui/Modal.vue';
import type { MirrorResource } from '@/stores/mirror';
import type { User } from '@/types';

type MirrorResourceDetail = MirrorResource & {
  sourceId?: string;
  contentHtml?: string | null;
  source?: {
    name?: string;
    displayName?: string;
    minPlanPriority?: number;
  } | null;
  hasAccess?: boolean;
  hasLinks?: boolean;
  links?: Array<{ name: string; type: string }> | null;
  requiredPlan?: number | null;
  currentPlan?: number | null;
};

interface MirrorComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
}

const route = useRoute();

const router = useRouter();

const mirrorStore = useMirrorStore();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const resourceId = computed(() => route.params.id as string);
const resource = ref<MirrorResourceDetail | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

async function loadResource() {
  // Check Pinia store cache first for instant visual rendering
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

    if (!data) {
      if (!resource.value) {
        error.value = '资源不存在';
      }
    } else {
      resource.value = data;
      if (data.sourceId) {
        workspaceStore.setWorkspaceById(`mirror-${data.sourceId}`);
        mirrorStore.fetchCategories(data.sourceId);
      }
    }
  } catch (e) {
    if (!resource.value) {
      error.value = getApiErrorMessage(e, '加载失败');
    } else {
      logError(e, { operation: 'Failed to refresh resource details in background' });
    }
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  if (resource.value?.sourceId) {
    router.push(`/mirror/source/${resource.value.sourceId}`);
  } else {
    router.push('/mirror');
  }
}

const comments = ref<MirrorComment[]>([]);

const likeStatus = ref({ liked: false, count: 0 });

const newCommentText = ref('');

const isSubmittingComment = ref(false);

const isTogglingLike = ref(false);

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

async function submitComment() {
  if (!newCommentText.value.trim() || isSubmittingComment.value) return;

  isSubmittingComment.value = true;

  try {
    const res = await api.post(`/api/mirror/resources/${resourceId.value}/comments`, {
      content: newCommentText.value,
    });

    comments.value.unshift(res.data);

    newCommentText.value = '';

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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);

  ElMessage.success('提取码已复制到剪贴板！');
}

const showLinkDialog = ref(false);

const activeLink = ref<{ name: string; url: string; code?: string; type: string } | null>(null);

const isExtracting = ref(false);

async function handleExtract(link: { name: string; type: string }) {
  if (!authStore.isAuthenticated) {
    ElMessage.warning('请先登录后提取资源');

    router.push(`/login?redirect=${route.fullPath}`);

    return;
  }

  if (resource.value?.hasAccess === undefined) {
    return;
  }

  if (resource.value?.hasAccess === false) {
    ElMessage.error('您的账号权限不足，请先升级会员');

    return;
  }

  isExtracting.value = true;

  try {
    const res = await api.post(`/api/mirror/resources/${resourceId.value}/extract`);

    const envKey = import.meta.env.VITE_EXTRACT_ENCRYPTION_KEY;
    if (!envKey && import.meta.env.PROD) {
      console.warn(
        '[Mirror] VITE_EXTRACT_ENCRYPTION_KEY is not set in production. Falling back to default key.',
      );
    }
    const key = envKey || '3d_learning_platform_secure_extract_key_2026';

    const decryptedUrl = decryptText(res.data.encryptedLink, key);

    const decryptedCode = res.data.encryptedPassword
      ? decryptText(res.data.encryptedPassword, key)
      : '';

    activeLink.value = {
      name: link.name,

      url: decryptedUrl,

      code: decryptedCode,

      type: link.type,
    };

    showLinkDialog.value = true;
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, '提取失败，请重试'));
  } finally {
    isExtracting.value = false;
  }
}

function stripManualDownloadLink(html: string): string {
  if (!html) return '';

  return html.replace(
    /<!-- MANUAL_DOWNLOAD_LINK_START -->[\s\S]*?<!-- MANUAL_DOWNLOAD_LINK_END -->/g,
    '',
  );
}

function getLinkTypeColor(type: string) {
  switch (type) {
    case 'baidu':
      return 'bg-blue-500';

    case 'quark':
      return 'bg-teal-500';

    case 'aliyun':
      return 'bg-orange-500';

    case '123pan':
      return 'bg-indigo-500';

    case 'tianyi':
      return 'bg-cyan-500';

    case 'lanzou':
      return 'bg-rose-500';

    default:
      return 'bg-slate-400';
  }
}

const extractedLinks = computed(() => {
  if (!resource.value) return [];

  if (resource.value.links && resource.value.links.length > 0) {
    return resource.value.links;
  }

  if (resource.value.hasLinks) {
    return [{ name: '资源下载', type: 'generic' }];
  }

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
    class="mirror-resource-detail mobile-adaptive h-full overflow-y-auto p-4 md:p-6 w-full max-w-[1400px] mx-auto scrollbar-hide"
  >
    <div class="flex items-center gap-3 mb-6 mobile-row">
      <button
        type="button"
        class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        @click="goBack"
      >
        <ArrowLeft class="w-5 h-5" />
      </button>

      <span class="text-sm text-slate-400">返回</span>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 animate-spin text-blue-500" />

      <span class="ml-2 text-slate-500">加载中...</span>
    </div>

    <div v-else-if="error" class="text-center py-20">
      <AlertCircle class="w-12 h-12 text-red-300 mx-auto mb-4" />

      <p class="text-red-500">{{ error }}</p>

      <button
        type="button"
        class="mt-4 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 hover:bg-slate-200 transition-colors"
        @click="goBack"
      >
        返回列表
      </button>
    </div>

    <template v-else-if="resource">
      <!-- Auth or Plan Access Alert Banner -->

      <div
        v-if="!authStore.isAuthenticated"
        class="mb-6 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/10 flex flex-row items-center justify-between gap-4 mobile-row"
      >
        <div class="flex items-center gap-3 mobile-row">
          <AlertCircle class="w-5 h-5 text-blue-500 shrink-0" />

          <div class="text-sm text-blue-800 dark:text-blue-200 font-medium truncate">
            您当前以游客身份浏览。如需提取该镜像源的下载链接，请登录您的账号。
          </div>
        </div>

        <button
          type="button"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-sm transition-colors cursor-pointer"
          @click="router.push(`/login?redirect=${route.fullPath}`)"
        >
          立即登录
        </button>
      </div>

      <div
        v-else-if="resource.hasAccess === false"
        class="mb-6 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/10 flex flex-row items-center justify-between gap-4 mobile-row"
      >
        <div class="flex items-center gap-3 mobile-row">
          <Lock class="w-5 h-5 text-amber-500 shrink-0" />

          <div class="text-sm text-amber-800 dark:text-amber-200 font-medium truncate">
            会员权限不足。提取该资源需要更高的会员权限（需要级别:
            {{ getPlanName(resource.requiredPlan ?? 0) }}，您当前的级别:
            {{ getPlanName(resource.currentPlan ?? 0) || '普通用户' }}）。
          </div>
        </div>

        <button
          type="button"
          class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-sm transition-colors cursor-pointer"
          @click="router.push('/billing')"
        >
          升级会员
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <!-- Left content -->

        <div class="lg:col-span-2 space-y-6">
          <div
            class="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden"
          >
            <div
              v-if="resource.thumbnailUrl"
              class="w-full aspect-[16/9] max-h-[500px] bg-slate-100 dark:bg-slate-700 overflow-hidden"
            >
              <img
                :src="getAssetUrl(resource.thumbnailUrl)"
                :alt="resource.title"
                class="w-full h-full object-cover"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
            </div>

            <div class="p-6">
              <div class="flex items-start gap-3 mb-4">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2 mobile-row">
                    <span
                      v-if="resource.category"
                      class="px-2 py-0.5 text-xs rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 truncate"
                    >
                      {{ resource.category.name }}
                    </span>

                    <span
                      class="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 truncate"
                    >
                      {{ resource.resourceType }}
                    </span>
                  </div>

                  <h1 class="text-xl font-bold text-slate-900 dark:text-white truncate">
                    {{ resource.title }}
                  </h1>
                </div>
              </div>

              <div
                class="flex flex-nowrap items-center gap-4 text-sm text-slate-400 mb-6 mobile-row"
              >
                <span class="flex items-center gap-1.5 truncate">
                  <Globe class="w-4 h-4 shrink-0" />

                  {{ resource.source?.displayName || resource.source?.name }}
                </span>

                <span v-if="resource.publishedAt" class="flex items-center gap-1.5 truncate">
                  <Calendar class="w-4 h-4 shrink-0" />

                  {{ formatDate(resource.publishedAt) }}
                </span>

                <span class="flex items-center gap-1.5 truncate">
                  <Clock class="w-4 h-4 shrink-0" />

                  同步于 {{ formatDate(resource.syncedAt) }}
                </span>

                <span class="flex items-center gap-1.5 truncate">
                  <Eye class="w-4 h-4 shrink-0" />

                  {{ resource.viewCount }} 次浏览
                </span>
              </div>

              <div
                v-if="parseTags(resource.tags).length > 0"
                class="flex flex-wrap gap-1.5 mb-6 mobile-row"
              >
                <span
                  v-for="tag in parseTags(resource.tags)"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 truncate"
                >
                  <Tag class="w-3 h-3 shrink-0" />

                  {{ tag }}
                </span>
              </div>

              <!-- Prominent Link Box on Mobile -->

              <div class="block lg:hidden mb-6">
                <div
                  class="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 shadow-sm"
                >
                  <h3
                    class="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-3 mobile-row"
                  >
                    <Link2 class="w-4 h-4 text-blue-500 shrink-0" />

                    提取资源链接
                  </h3>

                  <div class="space-y-3.5">
                    <div
                      v-if="extractedLinks.length === 0"
                      class="text-slate-400 text-xs text-center py-4"
                    >
                      暂未提取
                    </div>

                    <div v-else class="space-y-3">
                      <div
                        v-for="(link, idx) in extractedLinks"
                        :key="idx"
                        class="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col gap-2"
                      >
                        <div class="flex items-center justify-between mobile-row">
                          <div class="flex items-center gap-2 mobile-row">
                            <div
                              class="w-2 h-2 rounded-full shrink-0"
                              :class="getLinkTypeColor(link.type)"
                            ></div>

                            <span
                              class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate"
                              >{{ link.name }}</span
                            >
                          </div>

                          <span
                            class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 shrink-0"
                          >
                            {{ link.type }}
                          </span>
                        </div>

                        <!-- Trigger Link Dialog if matched, otherwise show lock "暂未提取" -->

                        <button
                          type="button"
                          :class="[
                            'mt-1 w-full py-2.5 px-3 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-1.5 transition-all duration-300 shadow-sm cursor-pointer border border-transparent',

                            !authStore.isAuthenticated
                              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20'
                              : resource.hasAccess === undefined
                                ? 'bg-slate-400 dark:bg-slate-700 text-white cursor-not-allowed shadow-none'
                                : resource.hasAccess === false
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20',
                          ]"
                          :disabled="
                            isExtracting ||
                            (authStore.isAuthenticated && resource.hasAccess === undefined)
                          "
                          @click="handleExtract(link)"
                        >
                          <Loader2
                            v-if="
                              isExtracting ||
                              (authStore.isAuthenticated && resource.hasAccess === undefined)
                            "
                            class="w-3.5 h-3.5 animate-spin"
                          />

                          <Lock
                            v-else-if="authStore.isAuthenticated && resource.hasAccess === false"
                            class="w-3.5 h-3.5"
                          />

                          <ExternalLink v-else class="w-3.5 h-3.5" />

                          <span v-if="isExtracting">正在提取...</span>

                          <span v-else-if="!authStore.isAuthenticated">登录后提取</span>

                          <span v-else-if="resource.hasAccess === undefined">核对权限中...</span>

                          <span v-else-if="resource.hasAccess === false">升级会员后提取</span>

                          <span v-else>提取资源</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Like Status for Mobile -->

                <div
                  class="mt-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between mobile-row"
                >
                  <span class="text-xs text-slate-500 font-medium truncate">
                    {{ likeStatus.count }} 人觉得很棒
                  </span>

                  <button
                    type="button"
                    :disabled="isTogglingLike"
                    class="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all duration-300 border"
                    :class="
                      likeStatus.liked
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-500 border-red-500/20'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                    "
                    @click="toggleLike"
                  >
                    <Heart
                      class="w-4 h-4"
                      :class="{ 'fill-current animate-bounce text-red-500': likeStatus.liked }"
                    />

                    <span class="font-bold text-xs">{{
                      likeStatus.liked ? '已点赞' : '点赞'
                    }}</span>
                  </button>
                </div>
              </div>

              <SafeHtml
                v-if="resource.contentHtml"
                class="mirror-content prose prose-sm dark:prose-invert max-w-none"
                :html="stripManualDownloadLink(resource.contentHtml)"
              />

              <div
                v-else-if="resource.description"
                class="prose prose-sm dark:prose-invert max-w-none"
              >
                <h3 class="text-sm font-medium text-slate-900 dark:text-white mb-2">简介</h3>

                <p
                  class="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed"
                >
                  {{ resource.description }}
                </p>
              </div>
            </div>
          </div>

          <!-- Comments Section -->

          <div
            class="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 space-y-6"
          >
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare class="w-5 h-5 text-blue-500" />

              评论 ({{ comments.length }})
            </h3>

            <!-- Write Comment -->

            <div class="flex gap-3 mobile-row">
              <div
                class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0"
              >
                {{ authStore.user?.name?.[0]?.toUpperCase() || 'U' }}
              </div>

              <div class="flex-1 space-y-3 min-w-0">
                <textarea
                  v-model="newCommentText"
                  placeholder="写下你的看法，与大家一起讨论..."
                  rows="3"
                  class="w-full text-sm p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                ></textarea>

                <div class="flex justify-end">
                  <button
                    type="button"
                    :disabled="isSubmittingComment || !newCommentText.trim()"
                    class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                    @click="submitComment"
                  >
                    <Loader2 v-if="isSubmittingComment" class="w-3.5 h-3.5 animate-spin" />

                    <span>发表评论</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Comment List -->

            <div v-if="comments.length === 0" class="text-center py-10 text-slate-400 text-sm">
              暂无评论，快来抢沙发吧~
            </div>

            <div v-else class="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
              <div
                v-for="comment in comments"
                :key="comment.id"
                class="flex gap-3 pt-4 first:pt-0 mobile-row"
              >
                <div
                  class="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0"
                >
                  <img
                    v-if="comment.user?.avatarUrl"
                    alt=""
                    :src="getAssetUrl(comment.user.avatarUrl)"
                    class="w-full h-full object-cover"
                  />

                  <div
                    v-else
                    class="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-xs font-bold"
                  >
                    {{ comment.user?.name?.[0]?.toUpperCase() || 'U' }}
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1 mobile-row">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{{
                      comment.user?.name
                    }}</span>

                    <span class="text-[10px] text-slate-400 truncate">{{
                      formatDate(comment.createdAt)
                    }}</span>
                  </div>

                  <p
                    class="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed"
                  >
                    {{ comment.content }}
                  </p>

                  <div
                    v-if="comment.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
                    class="flex justify-end mt-1.5"
                  >
                    <button
                      type="button"
                      class="text-[10px] text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1"
                      @click="deleteComment(comment.id)"
                    >
                      <Trash2 class="w-3 h-3" />

                      <span>删除</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right sidebar (Desktop only) -->

        <div class="hidden lg:block lg:sticky lg:top-4 space-y-6">
          <div
            class="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 shadow-sm"
          >
            <h3
              class="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-3"
            >
              <Link2 class="w-4 h-4 text-blue-500" />

              提取资源链接
            </h3>

            <div class="space-y-3.5">
              <div
                v-if="extractedLinks.length === 0"
                class="text-slate-400 text-xs text-center py-4"
              >
                暂未提取
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="(link, idx) in extractedLinks"
                  :key="idx"
                  class="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col gap-2"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" :class="getLinkTypeColor(link.type)"></div>

                      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{
                        link.name
                      }}</span>
                    </div>

                    <span
                      class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400"
                    >
                      {{ link.type }}
                    </span>
                  </div>

                  <!-- Trigger Link Dialog if matched, otherwise show lock "暂未提取" -->

                  <button
                    type="button"
                    :class="[
                      'mt-1 w-full py-2.5 px-3 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-1.5 transition-all duration-300 shadow-sm cursor-pointer border border-transparent',

                      !authStore.isAuthenticated
                        ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20'
                        : resource.hasAccess === undefined
                          ? 'bg-slate-400 dark:bg-slate-700 text-white cursor-not-allowed shadow-none'
                          : resource.hasAccess === false
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20',
                    ]"
                    :disabled="
                      isExtracting ||
                      (authStore.isAuthenticated && resource.hasAccess === undefined)
                    "
                    @click="handleExtract(link)"
                  >
                    <Loader2
                      v-if="
                        isExtracting ||
                        (authStore.isAuthenticated && resource.hasAccess === undefined)
                      "
                      class="w-3.5 h-3.5 animate-spin"
                    />

                    <Lock
                      v-else-if="authStore.isAuthenticated && resource.hasAccess === false"
                      class="w-3.5 h-3.5"
                    />

                    <ExternalLink v-else class="w-3.5 h-3.5" />

                    <span v-if="isExtracting">正在提取...</span>

                    <span v-else-if="!authStore.isAuthenticated">登录后提取</span>

                    <span v-else-if="resource.hasAccess === undefined">核对权限中...</span>

                    <span v-else-if="resource.hasAccess === false">升级会员后提取</span>

                    <span v-else>提取资源</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Likes -->

          <div
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between"
          >
            <span class="text-xs text-slate-500 font-medium">
              {{ likeStatus.count }} 人觉得很棒
            </span>

            <button
              type="button"
              :disabled="isTogglingLike"
              class="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all duration-300 border"
              :class="
                likeStatus.liked
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-500 border-red-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              "
              @click="toggleLike"
            >
              <Heart
                class="w-4.5 h-4.5"
                :class="{ 'fill-current animate-bounce text-red-500': likeStatus.liked }"
              />

              <span class="font-bold text-xs">{{ likeStatus.liked ? '已点赞' : '点赞' }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Extraction Link & Password Dialog -->
    <Modal
      :show="showLinkDialog && !!activeLink"
      title="提取网盘资源"
      size="md"
      @close="showLinkDialog = false"
    >
      <div v-if="activeLink" class="space-y-4">
        <!-- Drive Info Card -->
        <div
          class="p-4 bg-slate-50/50 dark:bg-white/[0.01] border rounded-2xl flex items-center justify-between mobile-row"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-3 mobile-row">
            <div
              class="w-2.5 h-2.5 rounded-full animate-pulse shrink-0"
              :class="getLinkTypeColor(activeLink.type)"
            ></div>

            <div class="min-w-0">
              <div class="text-sm font-bold truncate" style="color: var(--text-primary)">
                {{ activeLink.name }}
              </div>

              <div
                class="text-[10px] uppercase mt-0.5 font-black tracking-wider truncate"
                style="color: var(--text-secondary)"
              >
                {{ activeLink.type }} 资源
              </div>
            </div>
          </div>
        </div>

        <!-- Download Link Field -->
        <div class="space-y-1.5">
          <label class="block text-[11px] font-black text-slate-500 uppercase tracking-wider"
            >下载链接</label
          >

          <div class="flex gap-2 mobile-row">
            <input
              type="text"
              readonly
              :value="activeLink.url"
              class="flex-1 min-w-0 px-4 py-2.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-white/[0.02] focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              style="border-color: var(--border-base); color: var(--text-primary)"
            />

            <button
              type="button"
              class="px-4 py-2.5 rounded-xl border font-bold text-xs cursor-pointer text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-[0.98] shrink-0"
              style="border-color: var(--border-base)"
              @click="
                copyToClipboard(activeLink.url);
                ElMessage.success('下载链接已复制到剪贴板！');
              "
            >
              复制链接
            </button>
          </div>
        </div>

        <!-- Passcode Field (if present) -->
        <div v-if="activeLink.code" class="space-y-1.5">
          <label class="block text-[11px] font-black text-slate-500 uppercase tracking-wider"
            >提取密码 / 访问码</label
          >

          <div class="flex gap-2 mobile-row">
            <input
              type="text"
              readonly
              :value="activeLink.code"
              class="flex-1 min-w-0 px-4 py-2.5 text-sm font-bold rounded-xl border text-center tracking-wider focus:outline-none bg-rose-500/10 dark:bg-rose-500/5 text-rose-500"
              style="border-color: rgba(244, 63, 94, 0.2)"
            />

            <button
              type="button"
              class="px-4 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 font-bold text-xs cursor-pointer transition-all active:scale-[0.98] shrink-0"
              @click="copyToClipboard(activeLink.code)"
            >
              复制密码
            </button>
          </div>
        </div>
      </div>

      <template v-if="activeLink" #footer>
        <div class="flex gap-3 mobile-row">
          <button
            type="button"
            class="flex-1 py-2.5 rounded-xl border font-bold text-xs cursor-pointer text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-[0.98]"
            style="border-color: var(--border-base)"
            @click="showLinkDialog = false"
          >
            关闭
          </button>

          <a
            :href="activeLink.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-accent to-indigo-600 hover:from-accent hover:to-indigo-500 text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-accent/20 hover:shadow-accent/35 active:scale-[0.99]"
            @click="showLinkDialog = false"
          >
            <ExternalLink class="w-3.5 h-3.5 shrink-0" />
            立即跳转网盘
          </a>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.mirror-content :deep(img) {
  max-width: 100%;

  height: auto;

  border-radius: 8px;

  margin: 8px 0;
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

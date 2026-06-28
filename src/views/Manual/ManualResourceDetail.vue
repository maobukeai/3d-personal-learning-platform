<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import { logError } from '@/utils/error';
import { useRoute, useRouter } from 'vue-router';
import { parseTags } from '@/utils/tags';
import {
  ArrowLeft,
  Eye,
  Tag,
  Calendar,
  Loader2,
  AlertCircle,
  Heart,
  MessageSquare,
  Link2,
  Lock,
  ExternalLink,
  X,
  BookOpen,
} from 'lucide-vue-next';
import { useManualStore } from '@/stores/manual';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getPlanName } from '@/utils/plans';
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
import { formatDateTime as formatDate } from '@/utils/format';

interface ManualLink {
  id?: string;
  name: string;
  url?: string;
  type: string;
  fileFormat?: string;
  fileSize?: number;
  planRequired?: string;
}

interface ManualComment {
  id: string;
  content: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

interface DetailedResource {
  id: string;
  stationId: string;
  categoryId?: string | null;
  category?: {
    id?: string;
    name: string;
  } | null;
  station?: {
    id?: string;
    name: string;
  } | null;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  contentUrl?: string | null;
  tags?: string | null;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  coverUrl?: string | null;
  minPlanPriority?: number;
  resourceType?: string;
  viewCount?: number;
  views?: number;
  likeCount: number;
  hasLiked: boolean;
  createdAt?: string;
  updatedAt?: string;
  comments?: ManualComment[];
  links?: ManualLink[];
  planRequired?: string | null;
  hasAccess?: boolean;
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
}

const route = useRoute();
const router = useRouter();
const manualStore = useManualStore();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const resourceId = computed(() => route.params.id as string);
const resource = ref<DetailedResource | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

async function loadResource() {
  const cached = manualStore.resources.find((r) => r.id === resourceId.value);
  if (cached) {
    resource.value = { ...cached, comments: [], likeCount: 0, hasLiked: false, links: [] };
    isLoading.value = false;
    if (cached.stationId) {
      workspaceStore.setWorkspaceById(`manual-${cached.stationId}`);
      manualStore.fetchCategories(cached.stationId);
    }
  } else {
    isLoading.value = true;
  }
  error.value = null;

  try {
    const data = await manualStore.fetchResource(resourceId.value);
    if (!data) {
      if (!resource.value) {
        error.value = '资源不存在或无权访问';
      }
    } else {
      resource.value = data;
      if (data.stationId) {
        workspaceStore.setWorkspaceById(`manual-${data.stationId}`);
        manualStore.fetchCategories(data.stationId);
      }
    }
  } catch (e) {
    const err = e as ApiError;
    if (!resource.value) {
      error.value = err.response?.data?.error || '加载资源详情失败';
    } else {
      logError(e, { operation: 'Failed to refresh resource details in background' });
    }
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  if (resource.value?.stationId) {
    router.push(`/manual/station/${resource.value.stationId}`);
  } else {
    router.push('/');
  }
}

const newCommentText = ref('');
const isSubmittingComment = ref(false);
const isTogglingLike = ref(false);

async function toggleLike() {
  if (!authStore.isAuthenticated) {
    ElMessage.warning('请先登录后再进行点赞');
    router.push(`/login?redirect=${route.fullPath}`);
    return;
  }
  if (isTogglingLike.value || !resource.value) return;
  isTogglingLike.value = true;
  try {
    const res = await api.post(`/api/manual/resources/${resourceId.value}/like`);
    const liked = res.data.liked;
    resource.value.hasLiked = liked;
    if (liked) {
      resource.value.likeCount++;
      ElMessage.success({ message: '感谢您的点赞！', duration: 1500 });
    } else {
      resource.value.likeCount = Math.max(0, resource.value.likeCount - 1);
    }
  } catch (e) {
    const err = e as ApiError;
    ElMessage.error(err.response?.data?.error || '操作失败，请重试');
  } finally {
    isTogglingLike.value = false;
  }
}

async function submitComment() {
  if (!authStore.isAuthenticated) {
    ElMessage.warning('请先登录后再发表评论');
    router.push(`/login?redirect=${route.fullPath}`);
    return;
  }
  if (!newCommentText.value.trim() || isSubmittingComment.value || !resource.value) return;
  isSubmittingComment.value = true;
  try {
    const res = await api.post(`/api/manual/resources/${resourceId.value}/comments`, {
      content: newCommentText.value,
    });
    if (!resource.value.comments) {
      resource.value.comments = [];
    }
    resource.value.comments.unshift(res.data);
    newCommentText.value = '';
    ElMessage.success('评论发表成功');
  } catch (e) {
    const err = e as ApiError;
    ElMessage.error(err.response?.data?.error || '发表评论失败');
  } finally {
    isSubmittingComment.value = false;
  }
}

const showLinkDialog = ref(false);
const activeLink = ref<{ name: string; url: string; type: string } | null>(null);
const isExtracting = ref(false);

async function handleExtract(link: ManualLink) {
  if (!authStore.isAuthenticated) {
    ElMessage.warning('请先登录后提取资源链接');
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
    const res = await api.post(`/api/manual/resources/${resourceId.value}/extract`);
    activeLink.value = {
      name: link.name,
      url: res.data.downloadUrl,
      type: link.type,
    };
    showLinkDialog.value = true;
  } catch (e) {
    const err = e as ApiError;
    ElMessage.error(err.response?.data?.error || '提取链接失败，请稍后重试');
  } finally {
    isExtracting.value = false;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  ElMessage.success('链接已复制到剪贴板！');
}

function getLinkTypeColor(type: string) {
  switch (type) {
    case 'baidu':
      return 'bg-blue-500';
    case 'quark':
      return 'bg-teal-400';
    case 'aliyun':
      return 'bg-orange-500';
    case '123pan':
      return 'bg-indigo-500';
    default:
      return 'bg-cyan-500';
  }
}

const extractedLinks = computed(() => {
  if (!resource.value) return [];
  if (resource.value.links && resource.value.links.length > 0) {
    return resource.value.links;
  }
  if (resource.value.contentUrl) {
    return [{ name: '资源下载地址', type: 'generic' }];
  }
  return [];
});

onMounted(() => {
  loadResource();
});

watch(resourceId, () => {
  loadResource();
});
</script>

<template>
  <div
    class="manual-resource-detail mobile-adaptive h-full overflow-y-auto p-4 md:p-6 w-full max-w-[1400px] mx-auto scrollbar-hide"
  >
    <!-- Back breadcrumb -->
    <div class="flex items-center gap-3 mb-6 mobile-row">
      <button
        type="button"
        class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shadow-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        @click="goBack"
      >
        <ArrowLeft class="w-4 h-4" />
      </button>
      <span class="text-xs font-semibold text-slate-400">返回资产站</span>
    </div>

    <!-- Page Loading -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/50"
    >
      <Loader2 class="w-8 h-8 animate-spin text-cyan-500 mb-3" />
      <span class="text-sm font-medium text-slate-400">正在为您加载资源详情...</span>
    </div>

    <!-- Error Handling -->
    <div
      v-else-if="error"
      class="text-center py-20 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/50 p-6"
    >
      <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-4 animate-bounce" />
      <p class="text-red-500 font-bold mb-2">{{ error }}</p>
      <p class="text-xs text-slate-400 mb-6">您尝试访问的资源不存在，或当前会员计划无访问权限。</p>
      <button
        type="button"
        class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors border border-transparent hover:border-slate-300"
        @click="goBack"
      >
        返回资产列表
      </button>
    </div>

    <!-- Resource Content View -->
    <template v-else-if="resource">
      <!-- Unauthenticated Alert -->
      <div
        v-if="!authStore.isAuthenticated"
        class="mb-6 p-4.5 rounded-2xl bg-cyan-500/5 dark:bg-cyan-500/5 border border-cyan-500/10 dark:border-cyan-500/20 flex flex-row items-center justify-between gap-4 shadow-sm backdrop-blur-sm mobile-row"
      >
        <div class="flex items-center gap-3 mobile-row">
          <AlertCircle class="w-5 h-5 text-cyan-500 shrink-0" />
          <div class="text-xs sm:text-sm text-cyan-800 dark:text-cyan-300 font-bold truncate">
            您当前以访客身份浏览。如需获取/提取该手动资产的网盘下载链接，请登录账号。
          </div>
        </div>
        <button
          type="button"
          class="px-5 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-xl text-xs font-black shrink-0 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          @click="router.push(`/login?redirect=${route.fullPath}`)"
        >
          立即登录账户
        </button>
      </div>

      <!-- Insufficient Permissions Alert -->
      <div
        v-else-if="resource.hasAccess === false"
        class="mb-6 p-4.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/5 border border-amber-500/10 dark:border-amber-500/20 flex flex-row items-center justify-between gap-4 shadow-sm backdrop-blur-sm mobile-row"
      >
        <div class="flex items-center gap-3 mobile-row">
          <Lock class="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
          <div class="min-w-0">
            <div class="text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-bold truncate">
              会员获取权限不足
            </div>
            <div class="text-slate-400 text-xs mt-0.5 truncate">
              该资源需要高级别计划（需要:
              {{ getPlanName(resource.minPlanPriority || 0) || '专业版' }}，您当前:
              {{
                getPlanName(authStore.user?.subscription?.plan?.priority || 0) || '普通注册用户'
              }}）。
            </div>
          </div>
        </div>
        <button
          type="button"
          class="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shrink-0 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          @click="router.push('/billing')"
        >
          升级会员计划
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <!-- Left content (Details & Comments) -->
        <div class="lg:col-span-2 space-y-6">
          <div
            class="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800/50 overflow-hidden shadow-sm"
          >
            <!-- Thumbnail Cover -->
            <div
              v-if="resource.thumbnailUrl"
              class="w-full aspect-[16/9] max-h-[500px] bg-slate-100 dark:bg-slate-800 overflow-hidden relative"
            >
              <img
                :src="getAssetUrl(resource.thumbnailUrl)"
                :alt="resource.title"
                class="w-full h-full object-cover"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent"></div>
            </div>

            <!-- Meta Section -->
            <div class="p-6">
              <div class="flex items-start gap-3 mb-4">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2 mobile-row">
                    <span
                      v-if="resource.category"
                      class="px-2.5 py-0.5 text-[10px] rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-black tracking-wide truncate"
                    >
                      {{ resource.category.name }}
                    </span>
                    <span
                      class="px-2.5 py-0.5 text-[10px] rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide truncate"
                    >
                      {{
                        resource.resourceType === 'MODEL'
                          ? '3D模型'
                          : resource.resourceType === 'COURSE'
                            ? '课程教程'
                            : '技术文件'
                      }}
                    </span>
                  </div>
                  <h1
                    class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate"
                  >
                    {{ resource.title }}
                  </h1>
                </div>
              </div>

              <!-- Extra Meta Info -->
              <div
                class="flex flex-nowrap items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mb-6 border-b border-slate-100 dark:border-slate-800/80 pb-5 mobile-row"
              >
                <span class="flex items-center gap-1.5 font-semibold text-slate-500 truncate">
                  <BookOpen class="w-4 h-4 text-cyan-500 shrink-0" />
                  手动发布
                </span>
                <span class="flex items-center gap-1.5 truncate">
                  <Calendar class="w-4 h-4 text-slate-300 shrink-0" />
                  发布于 {{ formatDate(resource.createdAt) }}
                </span>
                <span class="flex items-center gap-1.5 truncate">
                  <Eye class="w-4 h-4 text-slate-300 shrink-0" />
                  {{ resource.viewCount }} 次浏览
                </span>
              </div>

              <!-- Tag badges -->
              <div
                v-if="parseTags(resource.tags).length > 0"
                class="flex flex-wrap gap-2 mb-6 mobile-row"
              >
                <span
                  v-for="tag in parseTags(resource.tags)"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/40 dark:border-slate-800/50 text-slate-600 dark:text-slate-400 font-medium truncate"
                >
                  <Tag class="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  {{ tag }}
                </span>
              </div>

              <!-- Mobile Link Box -->
              <div class="block lg:hidden mb-6">
                <div
                  class="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"
                >
                  <h3
                    class="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3 uppercase tracking-wider mobile-row"
                  >
                    <Link2 class="w-4 h-4 text-cyan-500 shrink-0" />
                    安全网盘通道
                  </h3>

                  <div class="space-y-3">
                    <div
                      v-if="extractedLinks.length === 0"
                      class="text-slate-400 text-xs text-center py-4"
                    >
                      管理员暂未配置该资源的下载地址
                    </div>
                    <div v-else class="space-y-3">
                      <div
                        v-for="(link, idx) in extractedLinks"
                        :key="idx"
                        class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 flex flex-col gap-2 shadow-sm"
                      >
                        <div class="flex items-center justify-between mobile-row">
                          <div class="flex items-center gap-2 mobile-row">
                            <div
                              class="w-2.5 h-2.5 rounded-full shrink-0"
                              :class="getLinkTypeColor(link.type)"
                            ></div>
                            <span
                              class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate"
                              >{{ link.name }}</span
                            >
                          </div>
                          <span
                            class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 shrink-0"
                          >
                            {{ link.type }}
                          </span>
                        </div>

                        <button
                          type="button"
                          :class="[
                            'mt-1 w-full py-2.5 px-3 rounded-xl font-black text-xs text-center flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md border border-transparent cursor-pointer',
                            !authStore.isAuthenticated
                              ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/20'
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
                          <Loader2 v-if="isExtracting" class="w-3.5 h-3.5 animate-spin" />
                          <Lock
                            v-else-if="authStore.isAuthenticated && resource.hasAccess === false"
                            class="w-3.5 h-3.5"
                          />
                          <ExternalLink v-else class="w-3.5 h-3.5" />

                          <span v-if="isExtracting">正在提取中...</span>
                          <span v-else-if="!authStore.isAuthenticated">登录提取链接</span>
                          <span v-else-if="resource.hasAccess === undefined">校验权限中...</span>
                          <span v-else-if="resource.hasAccess === false">升级计划后提取</span>
                          <span v-else>立即提取资源</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Like Box Mobile -->
                <div
                  class="mt-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between mobile-row"
                >
                  <span class="text-xs text-slate-400 font-semibold truncate">
                    {{ resource.likeCount }} 人觉得这个资源很赞
                  </span>
                  <button
                    type="button"
                    :disabled="isTogglingLike"
                    class="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-300 border font-bold text-xs"
                    :class="
                      resource.hasLiked
                        ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500 border-rose-500/20'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                    "
                    @click="toggleLike"
                  >
                    <Heart
                      class="w-4 h-4"
                      :class="{ 'fill-current animate-pulse text-rose-500': resource.hasLiked }"
                    />
                    <span>{{ resource.hasLiked ? '已点赞' : '点赞' }}</span>
                  </button>
                </div>
              </div>

              <!-- Main HTML Content -->
              <div v-if="resource.contentHtml" class="manual-content pt-4">
                <MarkdownEditor :model-value="resource.contentHtml" preview-only />
              </div>
              <div
                v-else-if="resource.description"
                class="prose prose-sm dark:prose-invert max-w-none pt-4"
              >
                <h3
                  class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 border-l-2 border-cyan-500 pl-2"
                >
                  资源简介
                </h3>
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
            class="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800/50 p-6 space-y-6 shadow-sm"
          >
            <h3
              class="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"
            >
              <MessageSquare class="w-5 h-5 text-cyan-500" />
              评论交流 ({{ resource.comments?.length || 0 }})
            </h3>

            <!-- Post comment -->
            <div class="flex gap-3 mobile-row">
              <div
                class="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md"
              >
                {{ authStore.user?.name?.[0]?.toUpperCase() || 'U' }}
              </div>
              <div class="flex-1 space-y-3 min-w-0">
                <textarea
                  v-model="newCommentText"
                  placeholder="说点什么吧，优质的讨论能帮助到更多的同学..."
                  rows="3"
                  class="w-full text-xs p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all resize-none shadow-inner text-slate-800 dark:text-slate-200 placeholder-slate-400"
                ></textarea>
                <div class="flex justify-end">
                  <button
                    type="button"
                    :disabled="isSubmittingComment || !newCommentText.trim()"
                    class="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md shadow-cyan-600/10 flex items-center gap-1.5 cursor-pointer"
                    @click="submitComment"
                  >
                    <Loader2 v-if="isSubmittingComment" class="w-3.5 h-3.5 animate-spin" />
                    <span>发表观点</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Comments List -->
            <div
              v-if="!resource.comments || resource.comments.length === 0"
              class="text-center py-12 text-slate-400 text-xs"
            >
              <MessageSquare class="w-8 h-8 text-slate-200 dark:text-slate-800 mx-auto mb-2" />
              暂无任何讨论评论，快来发表你的精彩观点吧~
            </div>
            <div v-else class="space-y-4 divide-y divide-slate-100 dark:divide-slate-800/60">
              <div
                v-for="comment in resource.comments"
                :key="comment.id"
                class="flex gap-3 pt-4 first:pt-0 mobile-row"
              >
                <div
                  class="w-8 h-8 rounded-full overflow-hidden bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shrink-0"
                >
                  <img
                    v-if="comment.user?.avatarUrl"
                    alt=""
                    :src="getAssetUrl(comment.user.avatarUrl)"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div
                    v-else
                    class="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-[10px] font-black uppercase"
                  >
                    {{ comment.user?.name?.[0]?.toUpperCase() || 'U' }}
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1 mobile-row">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{{
                      comment.user?.name
                    }}</span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 truncate">{{
                      formatDate(comment.createdAt)
                    }}</span>
                  </div>
                  <p
                    class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed"
                  >
                    {{ comment.content }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right sidebar (Desktop Sticky links) -->
        <div class="hidden lg:block lg:sticky lg:top-6 space-y-6">
          <div
            class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm"
          >
            <h3
              class="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3 uppercase tracking-wider"
            >
              <Link2 class="w-4 h-4 text-cyan-500" />
              安全网盘通道
            </h3>

            <div class="space-y-3.5">
              <div
                v-if="extractedLinks.length === 0"
                class="text-slate-400 text-xs text-center py-4"
              >
                管理员暂未配置下载链接
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="(link, idx) in extractedLinks"
                  :key="idx"
                  class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-2 shadow-sm bg-white"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div
                        class="w-2.5 h-2.5 rounded-full"
                        :class="getLinkTypeColor(link.type)"
                      ></div>
                      <span class="text-xs font-bold text-slate-700 dark:text-slate-200">{{
                        link.name
                      }}</span>
                    </div>
                    <span
                      class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400"
                    >
                      {{ link.type }}
                    </span>
                  </div>

                  <button
                    type="button"
                    :class="[
                      'mt-1 w-full py-2.5 px-3 rounded-xl font-black text-xs text-center flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md border border-transparent cursor-pointer',
                      !authStore.isAuthenticated
                        ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/20'
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
                    <Loader2 v-if="isExtracting" class="w-3.5 h-3.5 animate-spin" />
                    <Lock
                      v-else-if="authStore.isAuthenticated && resource.hasAccess === false"
                      class="w-3.5 h-3.5"
                    />
                    <ExternalLink v-else class="w-3.5 h-3.5" />

                    <span v-if="isExtracting">正在提取中...</span>
                    <span v-else-if="!authStore.isAuthenticated">登录提取链接</span>
                    <span v-else-if="resource.hasAccess === undefined">校验权限中...</span>
                    <span v-else-if="resource.hasAccess === false">升级计划后提取</span>
                    <span v-else>立即提取资源</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Likes Sticky card -->
          <div
            class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm flex items-center justify-between"
          >
            <span class="text-xs text-slate-400 dark:text-slate-500 font-semibold">
              {{ resource.likeCount }} 人觉得很棒
            </span>
            <button
              type="button"
              :disabled="isTogglingLike"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-300 border font-bold text-xs cursor-pointer"
              :class="
                resource.hasLiked
                  ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500 border-rose-500/20 shadow-sm shadow-rose-500/5'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              "
              @click="toggleLike"
            >
              <Heart
                class="w-4 h-4"
                :class="{ 'fill-current animate-pulse text-rose-500': resource.hasLiked }"
              />
              <span>{{ resource.hasLiked ? '已点赞' : '点赞' }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Dialog Modal for Netdisk Download Links -->
    <Teleport to="body">
      <div
        v-if="showLinkDialog && activeLink"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="showLinkDialog = false"
      >
        <div
          class="glass-dialog rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden border border-white/10 bg-slate-900 text-white animate-in fade-in zoom-in-95 duration-200"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-white/5 mobile-row">
            <h2
              class="text-sm font-black flex items-center gap-2 text-cyan-400 uppercase tracking-wider mobile-row"
            >
              <Link2 class="w-5 h-5 text-cyan-400 shrink-0" />
              已为您提取网盘下载地址
            </h2>
            <button
              type="button"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              @click="showLinkDialog = false"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-5 bg-slate-950/40">
            <!-- Drive Badge Card -->
            <div
              class="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between mobile-row"
            >
              <div class="flex items-center gap-3 mobile-row">
                <div
                  class="w-2.5 h-2.5 rounded-full animate-ping shrink-0"
                  :class="getLinkTypeColor(activeLink.type)"
                ></div>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-100 truncate">{{ activeLink.name }}</div>
                  <div class="text-[10px] text-slate-400 uppercase mt-0.5 font-bold truncate">
                    {{ activeLink.type }} 高速下载通道已激活
                  </div>
                </div>
              </div>
            </div>

            <!-- Download link field -->
            <div class="space-y-1.5">
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide"
                >提取地址 / 下载链接</label
              >
              <div class="flex gap-2 mobile-row">
                <input
                  type="text"
                  readonly
                  :value="activeLink.url"
                  class="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-white/10 bg-white/5 text-slate-300 focus:outline-none select-all font-mono"
                />
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white transition-all cursor-pointer shadow-md shadow-cyan-500/10 shrink-0"
                  @click="copyToClipboard(activeLink.url)"
                >
                  复制地址
                </button>
              </div>
            </div>

            <p
              class="text-[10px] text-slate-400 leading-normal bg-slate-900 p-3 rounded-lg border border-white/5"
            >
              💡 **温馨提示**:
              网盘服务由第三方提供，如遇到“链接已失效”或“链接不存在”，请联系系统管理员进行手动补档。
            </p>
          </div>

          <!-- Footer -->
          <div class="flex gap-3 p-5 border-t border-white/5 bg-slate-950/70 mobile-row">
            <button
              type="button"
              class="flex-1 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-xs text-slate-300 hover:text-white hover:bg-white/5 font-bold transition-all cursor-pointer"
              @click="showLinkDialog = false"
            >
              关闭窗口
            </button>
            <a
              :href="activeLink.url"
              target="_blank"
              rel="noopener noreferrer"
              class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white text-xs font-black text-center flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20"
              @click="showLinkDialog = false"
            >
              <ExternalLink class="w-3.5 h-3.5 shrink-0" />
              跳转网盘下载
            </a>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.manual-content :deep(img) {
  max-width: 90%;
  max-height: 55vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
  margin: 24px auto;
  display: block;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.manual-content :deep(img:hover) {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1);
}

.manual-content :deep(p) {
  margin: 12px 0;
  line-height: 1.8;
  color: inherit;
}

.manual-content :deep(a) {
  color: #06b6d4; /* cyan-500 */
  text-decoration: none;
  font-weight: 600;
}

.manual-content :deep(a:hover) {
  text-decoration: underline;
}

.manual-content :deep(h1),
.manual-content :deep(h2),
.manual-content :deep(h3) {
  font-weight: 800;
  margin-top: 24px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding-bottom: 6px;
}

.manual-content :deep(ul),
.manual-content :deep(ol) {
  padding-left: 20px;
  margin: 12px 0;
}

.manual-content :deep(li) {
  margin: 6px 0;
}
</style>

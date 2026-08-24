<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
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
  Sparkles,
  HardDriveDownload,
  Crown,
} from 'lucide-vue-next';
import { formatDateTime as formatDate } from '@/utils/format';
import { parseTags } from '@/utils/tags';
import SafeHtml from '@/components/SafeHtml.vue';
import api, { getAssetUrl } from '@/utils/api';
import { getPlanName } from '@/utils/plans';
import { useMirrorStore } from '@/stores/mirror';

import MirrorResourceComments from '@/views/Mirror/components/detail/MirrorResourceComments.vue';
import MirrorResourceExtractCard from '@/views/Mirror/components/detail/MirrorResourceExtractCard.vue';
import MirrorResourceExtractModal from '@/views/Mirror/components/detail/MirrorResourceExtractModal.vue';
import MirrorResourceSecurityVerifyModal from '@/views/Mirror/components/detail/MirrorResourceSecurityVerifyModal.vue';
import { useMirrorResourceDetail } from '@/views/Mirror/composables/useMirrorResourceDetail';

const mirrorStore = useMirrorStore();
const extractQuota = ref<{
  total: number | 'UNLIMITED';
  used: number;
  remaining: number | 'UNLIMITED';
  planName: string;
  isAdmin: boolean;
} | null>(null);

const {
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
  activeLink,
  extractedLinks,
  authStore,
  router,
  route,
  toggleLike,
  submitComment,
  deleteComment,
  handleStartExtract,
  handleSecurityVerified,
} = useMirrorResourceDetail();

const recommendedResources = computed(() => {
  return mirrorStore.resources.filter((r) => r.id !== resource.value?.id).slice(0, 4);
});

async function fetchExtractQuota() {
  if (!authStore.isAuthenticated) return;
  try {
    const res = await api.get('/api/subscriptions/extract-quota');
    extractQuota.value = res.data;
  } catch {}
}

onMounted(() => {
  fetchExtractQuota();
  if (mirrorStore.resources.length === 0 && resource.value?.sourceId) {
    mirrorStore.fetchResources(resource.value.sourceId, { page: 1, pageSize: 8 });
  }
});

function goBackPortal() {
  if (window.history.length > 1 && window.history.state?.back) {
    router.back();
  } else if (resource.value?.sourceId) {
    router.push(`/portal/mirror/${resource.value.sourceId}`);
  } else {
    router.push('/portal');
  }
}

function handleNavigateDetail(id: string) {
  router.push(`/portal/resource/${id}`);
}
</script>

<template>
  <div
    class="portal-resource-detail h-full overflow-y-auto p-4 md:p-6 w-full max-w-[1500px] mx-auto scrollbar-hide"
  >
    <div class="flex items-center gap-3 mb-5">
      <button
        type="button"
        class="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-700/60 transition-colors cursor-pointer"
        @click="goBackPortal"
      >
        <ArrowLeft class="w-4 h-4" />
      </button>
      <span class="text-xs font-bold text-slate-400">返回资源列表</span>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-24">
      <Loader2 class="w-8 h-8 animate-spin text-blue-500" />
      <span class="ml-2 text-sm font-medium text-slate-500">加载资源中...</span>
    </div>

    <div
      v-else-if="error"
      class="text-center py-20 bg-white/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-8"
    >
      <AlertCircle class="w-12 h-12 text-rose-400 mx-auto mb-3" />
      <p class="text-sm font-bold text-rose-500">{{ error }}</p>
      <button
        type="button"
        class="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
        @click="goBackPortal"
      >
        返回列表
      </button>
    </div>

    <template v-else-if="resource">
      <!-- Member Status Alert Banner -->
      <div
        v-if="!authStore.isAuthenticated"
        class="mb-5 p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <AlertCircle class="w-5 h-5 text-blue-500 shrink-0" />
          <span class="text-xs md:text-sm text-blue-900 dark:text-blue-200 font-medium"
            >您当前以游客身份浏览。登录后即可提取完整网盘下载链接。</span
          >
        </div>
        <button
          type="button"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
          @click="authStore.setShowLoginModal(true)"
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
      </div>

      <!-- Main Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
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

        <!-- Right Side: Extract & Comments -->
        <div class="hidden lg:flex flex-col gap-4 lg:sticky lg:top-4">
          <!-- Daily Quota Floating Badge -->
          <div
            v-if="extractQuota"
            class="p-3 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/80 dark:border-blue-500/20 backdrop-blur-md flex items-center justify-between text-xs"
          >
            <div class="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <HardDriveDownload class="w-3.5 h-3.5 text-blue-500" />
              <span>今日获取额度</span>
            </div>
            <span
              v-if="extractQuota.isAdmin"
              class="text-blue-600 dark:text-blue-400 font-extrabold text-[11px]"
            >
              无限次获取
            </span>
            <span
              v-else-if="typeof extractQuota.remaining === 'number'"
              class="text-slate-600 dark:text-slate-300 font-semibold text-[11px]"
            >
              剩余
              <strong class="text-blue-600 dark:text-blue-400 font-black">{{
                extractQuota.remaining
              }}</strong>
              / {{ extractQuota.total }} 次
            </span>
          </div>

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

      <!-- Recommended Resources Stream -->
      <div
        v-if="recommendedResources.length > 0"
        class="mt-12 pt-8 border-t border-slate-200/80 dark:border-slate-800/80 space-y-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-blue-500" />
            <h3 class="text-sm font-extrabold text-slate-900 dark:text-white">更多精选相关资源</h3>
          </div>
          <button
            type="button"
            class="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
            @click="goBackPortal"
          >
            查看全部资源 ➔
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div
            v-for="item in recommendedResources"
            :key="item.id"
            class="group cursor-pointer rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-blue-500/40"
            @click="handleNavigateDetail(item.id)"
          >
            <div
              class="w-full aspect-[16/10] bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden mb-2"
            >
              <img
                v-if="item.thumbnailUrl"
                :src="getAssetUrl(item.thumbnailUrl)"
                :alt="item.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-400">
                <Sparkles class="w-6 h-6" />
              </div>
            </div>
            <h4
              class="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors"
            >
              {{ item.title }}
            </h4>
          </div>
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
</style>

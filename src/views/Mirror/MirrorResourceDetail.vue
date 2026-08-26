<script setup lang="ts">
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
import { formatDateTime as formatDate } from '@/utils/format';
import { parseTags } from '@/utils/tags';
import SafeHtml from '@/components/SafeHtml.vue';
import { getAssetUrl } from '@/utils/api';
import { getPlanName } from '@/utils/plans';

import { ref, watch } from 'vue';
import ImagePreviewModal from '@/components/ImagePreviewModal.vue';
import MirrorResourceComments from './components/detail/MirrorResourceComments.vue';
import MirrorResourceExtractCard from './components/detail/MirrorResourceExtractCard.vue';
import MirrorResourceExtractModal from './components/detail/MirrorResourceExtractModal.vue';
import MirrorResourceSecurityVerifyModal from './components/detail/MirrorResourceSecurityVerifyModal.vue';
import { useMirrorResourceDetail } from './composables/useMirrorResourceDetail';

const containerRef = ref<HTMLElement | null>(null);
const showImagePreview = ref(false);
const previewImageUrl = ref('');
const previewImageAlt = ref('');

function openImagePreview(url: string, alt = '') {
  if (!url) return;
  previewImageUrl.value = url;
  previewImageAlt.value = alt;
  showImagePreview.value = true;
}

function handleTagClick(tag: string) {
  if (!tag) return;
  const sourceId = resource.value?.sourceId || (route.params.sourceId as string);
  router.push({
    path: sourceId ? `/mirror/source/${sourceId}` : '/mirror',
    query: { search: tag.trim(), page: '1' },
  });
}

function handleContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target && target.tagName.toLowerCase() === 'img') {
    const imgEl = target as HTMLImageElement;
    const src = imgEl.currentSrc || imgEl.src || imgEl.getAttribute('src') || '';
    if (src) {
      openImagePreview(src, imgEl.alt || resource.value?.title || '');
    }
  }
}

function scrollToTop() {
  if (containerRef.value) {
    containerRef.value.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const scrollParent = document.querySelector(
    '.portal-layout-content, .main-content, main, .mirror-resource-detail',
  );
  if (scrollParent) {
    scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

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
  goBack,
  toggleLike,
  submitComment,
  deleteComment,
  handleStartExtract,
  handleSecurityVerified,
} = useMirrorResourceDetail();

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      scrollToTop();
    }
  },
);
</script>

<template>
  <div
    ref="containerRef"
    class="mirror-resource-detail h-full overflow-y-auto p-3.5 sm:p-4 md:p-6 w-full max-w-[1500px] mx-auto scrollbar-hide"
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
        class="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
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
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
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
          class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
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
              class="w-full aspect-[16/9] max-h-[460px] bg-slate-100 dark:bg-slate-700 overflow-hidden border-b border-slate-100 dark:border-slate-700/50 cursor-zoom-in relative group"
              title="点击查看大图"
              @click="openImagePreview(getAssetUrl(resource.thumbnailUrl), resource.title)"
            >
              <img
                :src="getAssetUrl(resource.thumbnailUrl)"
                :alt="resource.title"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
              <div
                class="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              >
                点击放大
              </div>
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

              <!-- Clickable Tags -->
              <div v-if="parseTags(resource.tags).length > 0" class="flex flex-wrap gap-1.5">
                <button
                  v-for="tag in parseTags(resource.tags)"
                  :key="tag"
                  type="button"
                  class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-slate-700/60 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all font-medium cursor-pointer"
                  title="点击搜索此标签"
                  @click="handleTagClick(tag)"
                >
                  <Tag class="w-3 h-3 text-slate-400 group-hover:text-blue-500" />{{ tag }}
                </button>
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
                <div @click="handleContentClick">
                  <SafeHtml
                    v-if="resource.contentHtml"
                    class="mirror-content prose prose-sm dark:prose-invert max-w-none"
                    :html="resource.contentHtml"
                  />
                </div>
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
    <ImagePreviewModal
      v-model:show="showImagePreview"
      :image-url="previewImageUrl"
      :alt="previewImageAlt"
    />
  </div>
</template>

<style scoped>
.mirror-content :deep(img) {
  max-width: 100% !important;
  height: auto !important;
  border-radius: 12px;
  margin: 12px auto;
  display: block;
  object-fit: contain;
  background: rgba(148, 163, 184, 0.08);
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.05);
  cursor: zoom-in;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.mirror-content :deep(img:hover) {
  transform: scale(1.01);
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.1);
}
.mirror-content :deep(p) {
  margin: 8px 0;
  line-height: 1.7;
  word-break: break-word;
}
.mirror-content :deep(a) {
  color: #3b82f6;
  text-decoration: none;
}
.mirror-content :deep(a:hover) {
  text-decoration: underline;
}
</style>

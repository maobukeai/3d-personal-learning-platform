<script setup lang="ts">
import { ref, onMounted, computed, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Search,
  MonitorPlay,
  Heart,
  MessageCircle,
  Share2,
  Play,
  Trophy,
  Flame,
  Eye,
  ChevronRight,
  Plus,
  X,
  Send,
  Clock,
  Tag,
  Check,
  Trash2,
  Box,
  ChevronLeft,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import type { Asset } from '@/types';

import UserProfileDialog from '@/components/UserProfileDialog.vue';
import UserAvatar from '@/components/UserAvatar.vue';

const MdPreview = defineAsyncComponent(async () => {
  await import('md-editor-v3/lib/style.css');
  return (await import('md-editor-v3')).MdPreview;
});

import PublishWorkDialog from '@/components/PublishWorkDialog.vue';
import PageHeader from '@/components/PageHeader.vue';
import ShowcaseCard from '@/components/ShowcaseCard.vue';

interface ShowcaseUser {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
  email?: string;
  bio?: string;
}

interface ShowcaseItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  images?: string;
  type: 'IMAGE' | 'VIDEO' | 'MODEL' | 'TEXT' | 'OTHER';
  views: number;
  likes: number;
  likesCount: number;
  commentsCount: number;
  user: ShowcaseUser;
  createdAt: string;
  isLiked?: boolean;
  isVideo?: boolean;
  videoUrl?: string;
  tags?: string;
  asset?: Asset | null;
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: ShowcaseUser;
}

const { t: i18nT } = useI18n();
const t = (key: string, ...args: any[]) => {
  const prefixes = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  if (prefixes.some((p) => key.startsWith(p))) {
    return (i18nT as any)(`community.${key}`, ...args);
  }
  return (i18nT as any)(key, ...args);
};
const authStore = useAuthStore();
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
const searchQuery = ref('');
const activeFilter = ref('popular');
const activeTypeFilter = ref('all');
const showcases = ref<ShowcaseItem[]>([]);
const isLoading = ref(false);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: ShowcaseUser) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
  } catch (_error) {
    ElMessage.error(t('members.chatInitFailed'));
  }
};

const filters = ['popular', 'newest'];
const filterLabels = computed<Record<string, string>>(() => ({
  popular: t('showcase.popular'),
  newest: t('showcase.newest'),
}));

const typeFilters = ['all', 'IMAGE', 'VIDEO', 'MODEL', 'OTHER', 'TEXT'];

const typeFilterLabels = computed<Record<string, string>>(() => ({
  all: t('showcase.allTypes'),
  IMAGE: t('showcase.typeImage'),
  VIDEO: t('showcase.typeVideo'),
  MODEL: t('showcase.typeModel'),
  OTHER: t('showcase.typeOther'),
  TEXT: t('showcase.typeText'),
}));

const getTypeBg = (type: string) => {
  switch (type) {
    case 'MODEL':
      return 'bg-blue-500/80';
    case 'VIDEO':
      return 'bg-purple-500/80';
    case 'IMAGE':
      return 'bg-emerald-500/80';
    case 'TEXT':
      return 'bg-amber-500/80';
    default:
      return 'bg-slate-500/80';
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'MODEL':
      return t('showcase.typeModel');
    case 'VIDEO':
      return t('showcase.typeVideo');
    case 'IMAGE':
      return t('showcase.typeImage');
    case 'TEXT':
      return t('showcase.typeText');
    case 'OTHER':
      return t('showcase.typeOther');
    default:
      return t('showcase.typeWork');
  }
};

const isPublishDialogOpen = ref(false);

const isDetailOpen = ref(false);
const detailItem = ref<ShowcaseItem | null>(null);
const detailLoading = ref(false);
const comments = ref<CommentItem[]>([]);
const commentsLoading = ref(false);
const newComment = ref('');
const isSubmittingComment = ref(false);
const shareCopied = ref(false);
const currentImageIndex = ref(0);

const fetchShowcases = async () => {
  isLoading.value = true;
  try {
    const filterVal = activeFilter.value === 'popular' ? '热门' : '最新';
    const typeVal = activeTypeFilter.value === 'all' ? '全部' : activeTypeFilter.value;
    const response = await api.get('/api/showcase', {
      params: { filter: filterVal, type: typeVal },
    });
    showcases.value = response.data;
  } catch (_error) {
    ElMessage.error(t('showcase.fetchFailed'));
  } finally {
    isLoading.value = false;
  }
};

const openPublishDialog = () => {
  isPublishDialogOpen.value = true;
};

const openDetail = async (item: ShowcaseItem) => {
  isDetailOpen.value = true;
  detailLoading.value = true;
  currentImageIndex.value = 0;
  try {
    const response = await api.get(`/api/showcase/${item.id}`);
    detailItem.value = response.data;
    const idx = showcases.value.findIndex((s) => s.id === item.id);
    if (idx !== -1) {
      showcases.value[idx] = { ...showcases.value[idx], views: response.data.views };
    }
  } catch (_error) {
    ElMessage.error(t('showcase.detailFailed'));
    isDetailOpen.value = false;
    return;
  } finally {
    detailLoading.value = false;
  }
  await fetchComments(item.id);
};

const closeDetail = () => {
  isDetailOpen.value = false;
  detailItem.value = null;
  comments.value = [];
  newComment.value = '';
  currentImageIndex.value = 0;
};

const getDetailImages = computed(() => {
  if (!detailItem.value) return [];
  const images: string[] = [detailItem.value.thumbnailUrl];
  if (detailItem.value.images) {
    try {
      const parsed = JSON.parse(detailItem.value.images);
      images.push(...parsed);
    } catch {
      // Ignore error
    }
  }
  return images;
});

const nextImage = () => {
  if (currentImageIndex.value < getDetailImages.value.length - 1) {
    currentImageIndex.value++;
  }
};

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--;
  }
};

const fetchComments = async (showcaseId: string) => {
  commentsLoading.value = true;
  try {
    const response = await api.get(`/api/showcase/${showcaseId}/comments`);
    comments.value = response.data;
  } catch (_error) {
    console.error('Failed to fetch comments');
  } finally {
    commentsLoading.value = false;
  }
};

const submitComment = async () => {
  if (!newComment.value.trim()) return;
  if (!detailItem.value) return;
  isSubmittingComment.value = true;
  try {
    const response = await api.post(`/api/showcase/${detailItem.value.id}/comment`, {
      content: newComment.value,
    });
    comments.value.unshift(response.data);
    detailItem.value.commentsCount++;
    const idx = showcases.value.findIndex((s) => s.id === detailItem.value!.id);
    if (idx !== -1) {
      showcases.value[idx].commentsCount++;
    }
    newComment.value = '';
  } catch (_error) {
    ElMessage.error(t('showcase.commentFailed'));
  } finally {
    isSubmittingComment.value = false;
  }
};

const deleteComment = async (comment: CommentItem) => {
  try {
    await ElMessageBox.confirm(t('showcase.deleteCommentConfirm'), t('showcase.deleteCommentTitle'), {
      confirmButtonText: t('common.confirm') || '确定',
      cancelButtonText: t('common.cancel') || '取消',
      type: 'warning',
    });
    await api.delete(`/api/showcase/${detailItem.value!.id}/comment/${comment.id}`);
    comments.value = comments.value.filter((c) => c.id !== comment.id);
    detailItem.value!.commentsCount--;
    const idx = showcases.value.findIndex((s) => s.id === detailItem.value!.id);
    if (idx !== -1) {
      showcases.value[idx].commentsCount--;
    }
    ElMessage.success(t('showcase.commentDeleteSuccess'));
  } catch {
    // Ignore error
  }
};

const toggleLike = async (item: ShowcaseItem) => {
  try {
    const response = await api.post(`/api/showcase/${item.id}/like`);
    item.isLiked = response.data.liked;
    item.likesCount += item.isLiked ? 1 : -1;
    if (detailItem.value && detailItem.value.id === item.id) {
      detailItem.value.isLiked = response.data.liked;
      detailItem.value.likesCount += response.data.liked ? 1 : -1;
    }
  } catch (_error) {
    ElMessage.error(t('showcase.actionFailed'));
  }
};

const handleShare = () => {
  const url = `${window.location.origin}/showcase`;
  navigator.clipboard
    .writeText(url)
    .then(() => {
      shareCopied.value = true;
      setTimeout(() => {
        shareCopied.value = false;
      }, 2000);
      ElMessage.success(t('showcase.copySuccess'));
    })
    .catch(() => {
      ElMessage.error(t('showcase.copyFailed'));
    });
};

const parseTags = (tags: string | null | undefined): string[] => {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return t('showcase.justNow');
  if (minutes < 60) return t('showcase.minutesAgo', { n: minutes });
  if (hours < 24) return t('showcase.hoursAgo', { n: hours });
  if (days < 30) return t('showcase.daysAgo', { n: days });
  return date.toLocaleDateString();
};

const filteredShowcases = computed(() => {
  return showcases.value.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (s.user?.name || s.user?.email || '').toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

onMounted(fetchShowcases);
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <PageHeader
      :title="t('showcase.title')"
      :icon="MonitorPlay"
    >
      <div class="flex flex-row items-center gap-2 sm:gap-3 w-full md:w-auto">
        <div class="relative flex-1 min-w-0 sm:w-64">
          <Search
            class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--text-muted)"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('showcase.searchPlaceholder')"
            class="pl-10 pr-4 py-2 border-none rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button
type="button"
          class="bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
          @click="openPublishDialog"
        >
          <Plus class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span class="hidden xs:inline">{{ t('showcase.publishMyWork') }}</span>
          <span class="xs:hidden">{{ t('showcase.publishShort') }}</span>
        </button>
      </div>
    </PageHeader>

    <!-- Featured Banner -->
    <div class="px-4 sm:px-6 py-2.5 sm:py-3.5 shrink-0">
      <div class="relative h-28 md:h-36 rounded-xl overflow-hidden bg-slate-900 group cursor-pointer">
        <img
alt=""
          src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=1200&auto=format&fit=crop&q=80"
          class="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
        />
        <div
          class="absolute inset-0 p-4 sm:p-5 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent"
        >
          <div class="flex items-center gap-2 mb-1">
            <span
              class="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest"
              >{{ t('showcase.featuredSelection') }}</span
            >
            <div class="flex items-center gap-1 text-white/60 text-[10px]">
              <Flame class="w-3 h-3 text-orange-500" /> {{ t('showcase.recommendedWork') }}
            </div>
          </div>
          <h2 class="text-base sm:text-lg font-bold text-white mb-1">{{ t('showcase.featuredTitle') }}</h2>
          <p class="text-white/70 text-[11px] sm:text-xs max-w-xl line-clamp-2">
            {{ t('showcase.featuredDesc') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="px-4 sm:px-6 mb-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
      <div class="flex items-center gap-3 overflow-x-auto scrollbar-hide py-1 -mx-4 px-4 sm:mx-0 sm:px-0 max-w-full">
        <div class="flex items-center gap-1.5 shrink-0">
          <button
v-for="f in filters"
            :key="f"
            type="button"
            class="px-3 py-1 rounded-md text-xs font-bold transition-all shrink-0"
            :class="activeFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'hover:opacity-80'"
            :style="
              activeFilter !== f
                ? 'color: var(--text-secondary); background-color: var(--bg-card)'
                : ''
            "
            @click="
              activeFilter = f;
              fetchShowcases();
            "
          >
            {{ filterLabels[f] || f }}
          </button>
        </div>
        <div class="w-px h-4 shrink-0" style="background-color: var(--border-base)"></div>
        <div class="flex items-center gap-1 shrink-0">
          <button
v-for="tf in typeFilters"
            :key="tf"
            type="button"
            class="px-2 py-0.5 rounded text-[10px] font-bold transition-all shrink-0"
            :class="
              activeTypeFilter === tf
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'hover:opacity-80'
            "
            :style="
              activeTypeFilter !== tf
                ? 'color: var(--text-secondary); background-color: var(--bg-card)'
                : ''
            "
            @click="
              activeTypeFilter = tf;
              fetchShowcases();
            "
          >
            {{ typeFilterLabels[tf] || tf }}
          </button>
        </div>
      </div>
      <div class="flex items-center gap-1.5 text-xs font-bold shrink-0 self-start lg:self-auto" style="color: var(--text-muted)">
        <Trophy class="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span class="truncate">{{ t('showcase.yearlyTrophy') }}</span>
        <ChevronRight class="w-3 h-3 shrink-0" />
      </div>
    </div>

    <!-- Showcase Grid -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-6 pt-0 scrollbar-hide">
      <div class="max-w-none">
        <div
          v-if="filteredShowcases.length > 0"
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4"
        >
          <ShowcaseCard
            v-for="item in filteredShowcases"
            :key="item.id"
            :item="item"
            @click="openDetail"
            @like="toggleLike"
            @user-click="openUserProfile"
          />
        </div>

        <div v-else class="h-64 flex flex-col items-center justify-center text-slate-400">
          <MonitorPlay class="w-12 h-12 mb-4 opacity-10" />
          <p class="text-sm font-bold">{{ t('showcase.noShowcases') }}</p>
        </div>
      </div>
    </div>

    <!-- Detail Dialog -->
    <Transition name="fade">
      <div v-if="isDetailOpen" class="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeDetail"></div>
        <div
          class="relative w-full md:max-w-4xl max-h-[85vh] md:max-h-[90vh] bg-[var(--bg-card)] border border-[var(--border-base)] shadow-2xl overflow-hidden flex flex-col rounded-t-2xl md:rounded-2xl"
        >
          <!-- Close Button -->
          <button
type="button"
            class="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style="color: var(--text-secondary)"
            @click="closeDetail"
          >
            <X class="w-4 h-4" />
          </button>

          <div v-if="detailLoading" class="flex-1 flex items-center justify-center py-20">
            <div
              class="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"
            ></div>
          </div>

          <template v-else-if="detailItem">
            <div class="flex-1 overflow-y-auto">
              <!-- Cover Image / Image Gallery (skip for TEXT type without thumbnail) -->
              <div
                v-if="!(detailItem.type === 'TEXT' && !detailItem.thumbnailUrl)"
                class="relative aspect-video w-full overflow-hidden"
                style="background-color: var(--bg-app)"
              >
                <img alt="" :src="getDetailImages[currentImageIndex]" class="w-full h-full object-cover" />
                <div
                  v-if="getDetailImages.length > 1"
                  class="absolute inset-0 flex items-center justify-between px-4"
                >
                  <button
v-if="currentImageIndex > 0"
                    type="button"
                    class="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all"
                    @click="prevImage"
                  >
                    <ChevronLeft class="w-5 h-5" />
                  </button>
                  <div v-else></div>
                  <button
v-if="currentImageIndex < getDetailImages.length - 1"
                    type="button"
                    class="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all"
                    @click="nextImage"
                  >
                    <ChevronRight class="w-5 h-5" />
                  </button>
                  <div v-else></div>
                </div>
                <div
                  v-if="getDetailImages.length > 1"
                  class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5"
                >
                  <span
                    v-for="(_, idx) in getDetailImages"
                    :key="idx"
                    class="w-2 h-2 rounded-full cursor-pointer transition-all"
                    :class="idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'"
                    @click="currentImageIndex = idx"
                  ></span>
                </div>
                <div
                  v-if="detailItem.isVideo && detailItem.videoUrl"
                  class="absolute inset-0 flex items-center justify-center bg-black/30"
                >
                  <a
                    :href="detailItem.videoUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-5 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 transition-all"
                  >
                    <Play class="w-10 h-10 text-white fill-white" />
                  </a>
                </div>
                <div class="absolute top-3 left-3">
                  <span
                    class="backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
                    :class="getTypeBg(detailItem.type)"
                  >
                    {{ getTypeLabel(detailItem.type) }}
                  </span>
                </div>
              </div>

              <!-- Detail Content -->
              <div class="p-5 md:p-6">
                <!-- Title & Author -->
                <div class="flex items-start justify-between mb-3.5">
                  <div class="flex-1">
                    <h2 class="text-lg sm:text-xl font-bold mb-2" style="color: var(--text-primary)">
                      {{ detailItem.title }}
                    </h2>
                    <div class="flex items-center gap-2.5">
                      <UserAvatar
                        :user="detailItem.user"
                        size="sm"
                        class="cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                        @click="openUserProfile(detailItem.user.id)"
                      />
                      <div>
                        <p
                          class="text-xs sm:text-sm font-bold cursor-pointer hover:text-indigo-600 transition-colors"
                          style="color: var(--text-primary)"
                          @click="openUserProfile(detailItem.user.id)"
                        >
                          {{ detailItem.user.name || detailItem.user.email }}
                        </p>
                        <p
                          v-if="detailItem.user.bio"
                          class="text-[11px]"
                          style="color: var(--text-muted)"
                        >
                          {{ detailItem.user.bio }}
                        </p>
                      </div>
                      <span class="text-xs" style="color: var(--text-muted)">·</span>
                      <span
                        class="text-xs flex items-center gap-1"
                        style="color: var(--text-muted)"
                      >
                        <Clock class="w-3 h-3" /> {{ formatTime(detailItem.createdAt) }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Tags -->
                <div
                  v-if="parseTags(detailItem.tags).length"
                  class="flex items-center gap-1.5 mb-3 flex-wrap"
                >
                  <Tag class="w-3.5 h-3.5 text-indigo-500" />
                  <span
                    v-for="tag in parseTags(detailItem.tags)"
                    :key="tag"
                    class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  >
                    {{ tag }}
                  </span>
                </div>

                <!-- Description (Markdown rendered) -->
                <div v-if="detailItem.description" class="mb-4">
                  <MdPreview :model-value="detailItem.description" class="md-preview-showcase" />
                </div>

                <!-- Linked Asset -->
                <div
                  v-if="detailItem.asset"
                  class="mb-4 p-3 rounded-lg border flex items-center gap-2.5"
                  style="background-color: var(--bg-app); border-color: var(--border-base)"
                >
                  <Box class="w-6 h-6 text-blue-500 shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-bold" style="color: var(--text-secondary)">{{ t('showcase.linkedModel') }}</p>
                    <p class="text-xs font-bold truncate" style="color: var(--text-primary)">
                      {{ detailItem.asset.title }}
                    </p>
                  </div>
                  <a
                    :href="detailItem.asset.url"
                    download
                    class="px-2.5 py-1 bg-blue-500 text-white rounded-lg text-[11px] font-bold hover:bg-blue-600 transition-all shrink-0"
                  >
                    {{ t('showcase.downloadModel') }}
                  </a>
                </div>

                <!-- Stats Bar -->
                <div
                  class="flex items-center gap-4 py-2.5 border-t border-b"
                  style="border-color: var(--border-base)"
                >
                  <div class="flex items-center gap-1.5 text-xs" style="color: var(--text-secondary)">
                    <Eye class="w-3.5 h-3.5" />
                    <span class="font-bold">{{ detailItem.views }}</span> {{ t('showcase.viewsUnit') }}
                  </div>
                  <button
type="button"
                    class="flex items-center gap-1.5 text-xs transition-all"
                    :class="detailItem.isLiked ? 'text-rose-500' : ''"
                    style="color: var(--text-secondary)"
                    @click="toggleLike(detailItem)"
                  >
                    <Heart class="w-3.5 h-3.5" :class="detailItem.isLiked ? 'fill-rose-500' : ''" />
                    <span class="font-bold">{{ detailItem.likesCount }}</span> {{ t('showcase.likesUnit') }}
                  </button>
                  <div class="flex items-center gap-1.5 text-xs" style="color: var(--text-secondary)">
                    <MessageCircle class="w-3.5 h-3.5" />
                    <span class="font-bold">{{ detailItem.commentsCount }}</span> {{ t('showcase.commentsUnit') }}
                  </div>
                  <button
type="button"
                    class="flex items-center gap-1.5 text-xs ml-auto transition-all hover:text-indigo-600"
                    style="color: var(--text-secondary)"
                    @click="handleShare"
                  >
                    <component
                      :is="shareCopied ? Check : Share2"
                      class="w-3.5 h-3.5"
                      :class="shareCopied ? 'text-emerald-500' : ''"
                    />
                    {{ shareCopied ? t('showcase.copied') : t('showcase.share') }}
                  </button>
                </div>

                <!-- Comments Section -->
                <div class="mt-4">
                  <h3 class="text-xs sm:text-sm font-bold mb-3" style="color: var(--text-primary)">
                    {{ t('showcase.commentsTitle', { count: detailItem.commentsCount }) }}
                  </h3>

                  <!-- Comment Input -->
                  <div class="flex items-start gap-2.5 mb-4">
                    <UserAvatar :user="authStore.user" size="sm" />
                    <div class="flex-1 flex items-center gap-2">
                      <input
                        v-model="newComment"
                        type="text"
                        :placeholder="t('showcase.writeComment')"
                        class="flex-1 px-3 py-2 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        style="background-color: var(--bg-app); color: var(--text-primary)"
                        @keyup.enter="submitComment"
                      />
                      <button
type="button"
                        :disabled="isSubmittingComment || !newComment.trim()"
                        class="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        @click="submitComment"
                      >
                        <Send class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <!-- Comments List -->
                  <div v-if="commentsLoading" class="py-6 text-center">
                    <div
                      class="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"
                    ></div>
                  </div>
                  <div v-else-if="comments.length === 0" class="py-6 text-center">
                    <p class="text-xs" style="color: var(--text-muted)">{{ t('showcase.noComments') }}</p>
                  </div>
                  <div v-else class="space-y-3">
                    <div
                      v-for="comment in comments"
                      :key="comment.id"
                      class="flex items-start gap-2.5 group"
                    >
                      <UserAvatar :user="comment.user" size="sm" />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-0.5">
                          <span class="text-[11px] font-bold" style="color: var(--text-primary)">{{
                            comment.user.name || t('showcase.anonymousUser')
                          }}</span>
                          <span class="text-[9px]" style="color: var(--text-muted)">{{
                            formatTime(comment.createdAt)
                          }}</span>
                          <button
v-if="comment.user.id === authStore.user?.id || isAdmin"
                            type="button"
                            class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500"
                            @click="deleteComment(comment)"
                          >
                            <Trash2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="text-xs sm:text-sm leading-relaxed" style="color: var(--text-secondary)">
                          {{ comment.content }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>

    <PublishWorkDialog v-model="isPublishDialogOpen" @published="fetchShowcases" />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
    />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 767px) {
  .fade-enter-from {
    transform: translateY(100%);
  }
  .fade-leave-to {
    transform: translateY(100%);
  }
}
.custom-select-v2 :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 44px;
}
.md-preview-showcase {
  background: transparent !important;
  font-size: 14px;
  line-height: 1.8;
}
.md-preview-showcase :deep(.md-editor-preview-wrapper) {
  padding: 0 !important;
}
</style>

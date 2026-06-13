<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  Eye,
  Flame,
  Heart,
  Image as ImageIcon,
  Inbox,
  Layers,
  LoaderCircle,
  MessageCircle,
  MessageSquare,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import PageHeader from '@/components/PageHeader.vue';
import DiscussionCard from '@/components/DiscussionCard.vue';

const authStore = useAuthStore();
const { t, locale } = useI18n();

const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

type DiscussionFilter = 'all' | 'mine' | 'unanswered' | 'pinned';

interface DiscussionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface DiscussionCounts {
  likes: number;
  comments: number;
  replies?: number;
}

interface DiscussionComment {
  id: string;
  content: string;
  createdAt: string;
  user: DiscussionUser;
  parentId?: string | null;
  replies: DiscussionComment[];
  isLiked?: boolean;
  _count: DiscussionCounts;
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  tags: string | null;
  images: string | null;
  createdAt: string;
  updatedAt?: string;
  lastActivityAt?: string;
  viewCount?: number;
  isPinned?: boolean;
  isLiked?: boolean;
  latestComment?: DiscussionComment | null;
  user: DiscussionUser;
  comments?: DiscussionComment[];
  _count: DiscussionCounts;
}

interface DiscussionCardActionTarget {
  id: string;
  isLiked?: boolean;
  isPinned?: boolean;
  _count: {
    likes: number;
  };
}

interface TagInsight {
  name: string;
  count: number;
}

interface ContributorInsight {
  user: DiscussionUser;
  discussions: number;
  comments: number;
  likesReceived: number;
}

interface RecentCommentInsight {
  id: string;
  content: string;
  createdAt: string;
  user: DiscussionUser;
  discussion: Pick<Discussion, 'id' | 'title'>;
}

interface DiscussionInsights {
  totals: {
    discussions: number;
    comments: number;
    likes: number;
    views: number;
    activeAuthors: number;
    unanswered: number;
    pinned: number;
  };
  tags: TagInsight[];
  trending: Discussion[];
  contributors: ContributorInsight[];
  recentComments: RecentCommentInsight[];
}

const searchQuery = ref('');
const showCreateModal = ref(false);
const discussions = ref<Discussion[]>([]);
const insights = ref<DiscussionInsights | null>(null);
const isLoading = ref(false);
const isInsightsLoading = ref(false);
const sortBy = ref('active');
const activeFilter = ref<DiscussionFilter>('all');
const selectedTag = ref('');

const pagination = ref({
  total: 0,
  page: 1,
  limit: 12,
  totalPages: 0,
});

const postForm = ref({
  title: '',
  content: '',
  tags: '',
});

const selectedImages = ref<File[]>([]);
const imagePreviews = ref<string[]>([]);
const selectedDiscussion = ref<Discussion | null>(null);
const isDetailOpen = ref(false);
const newComment = ref('');
const isSubmittingComment = ref(false);
const replyingTo = ref<DiscussionComment | null>(null);
const replyContent = ref('');
const expandedReplies = ref<Set<string>>(new Set());

let searchTimer: number | ReturnType<typeof setTimeout> | undefined;

const sortOptions = computed(() => [
  { value: 'active', label: t('community.discussions.sortActive'), icon: Sparkles },
  { value: 'newest', label: t('community.discussions.sortNewest'), icon: Clock },
  { value: 'most_commented', label: t('community.discussions.sortComments'), icon: MessageSquare },
  { value: 'most_liked', label: t('community.discussions.sortLikes'), icon: Flame },
  { value: 'most_viewed', label: t('community.discussions.sortViews'), icon: Eye },
]);

const filterOptions = computed(() => [
  {
    value: 'all' as DiscussionFilter,
    label: t('community.discussions.filterAll'),
    count: insights.value?.totals.discussions ?? pagination.value.total,
    icon: Layers,
  },
  {
    value: 'mine' as DiscussionFilter,
    label: t('community.discussions.filterMine'),
    count: undefined,
    icon: UserRound,
  },
  {
    value: 'unanswered' as DiscussionFilter,
    label: t('community.discussions.filterUnanswered'),
    count: insights.value?.totals.unanswered ?? 0,
    icon: Inbox,
  },
  {
    value: 'pinned' as DiscussionFilter,
    label: t('community.discussions.filterPinned'),
    count: insights.value?.totals.pinned ?? 0,
    icon: Pin,
  },
]);

const tagInsights = computed<TagInsight[]>(() => {
  if (insights.value?.tags?.length) return insights.value.tags;

  const counts = new Map<string, number>();
  discussions.value.forEach((discussion) => {
    parseTags(discussion.tags).forEach((tagName) => {
      counts.set(tagName, (counts.get(tagName) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
});

const hotDiscussions = computed(() => {
  if (insights.value?.trending?.length) return insights.value.trending.slice(0, 6);
  return [...discussions.value]
    .sort((a, b) => {
      const scoreA = (a.viewCount || 0) + (a._count?.comments || 0) * 8 + (a._count?.likes || 0) * 5;
      const scoreB = (b.viewCount || 0) + (b._count?.comments || 0) * 8 + (b._count?.likes || 0) * 5;
      return scoreB - scoreA;
    })
    .slice(0, 6);
});

const topContributors = computed<ContributorInsight[]>(() => {
  if (insights.value?.contributors?.length) return insights.value.contributors.slice(0, 5);

  const counts: Record<string, ContributorInsight> = {};
  discussions.value.forEach((discussion) => {
    if (!discussion.user?.id) return;
    if (!counts[discussion.user.id]) {
      counts[discussion.user.id] = {
        user: discussion.user,
        discussions: 0,
        comments: 0,
        likesReceived: 0,
      };
    }
    counts[discussion.user.id].discussions += 1;
    counts[discussion.user.id].likesReceived += discussion._count?.likes || 0;
  });
  return Object.values(counts)
    .sort((a, b) => b.discussions + b.likesReceived - (a.discussions + a.likesReceived))
    .slice(0, 5);
});

const recentComments = computed(() => insights.value?.recentComments?.slice(0, 5) || []);

const metricCards = computed(() => {
  const totals = insights.value?.totals;
  const pageLikes = discussions.value.reduce((sum, item) => sum + (item._count?.likes || 0), 0);
  const pageViews = discussions.value.reduce((sum, item) => sum + (item.viewCount || 0), 0);
  const pageComments = discussions.value.reduce((sum, item) => sum + (item._count?.comments || 0), 0);

  return [
    {
      label: t('community.discussions.totalPosts'),
      value: formatNumber(totals?.discussions ?? pagination.value.total),
      icon: MessageSquare,
      tone: 'blue',
    },
    {
      label: t('community.discussions.totalReplies'),
      value: formatNumber(totals?.comments ?? pageComments),
      icon: MessageCircle,
      tone: 'teal',
    },
    {
      label: t('community.discussions.totalLikes'),
      value: formatNumber(totals?.likes ?? pageLikes),
      icon: Heart,
      tone: 'rose',
    },
    {
      label: t('community.discussions.totalViews'),
      value: formatNumber(totals?.views ?? pageViews),
      icon: BarChart3,
      tone: 'amber',
    },
  ];
});

const selectedSortLabel = computed(() => {
  return sortOptions.value.find((item) => item.value === sortBy.value)?.label || '';
});

const listSummary = computed(() => {
  if (selectedTag.value) {
    return t('community.discussions.resultsForTag', {
      count: pagination.value.total,
      tag: selectedTag.value,
    });
  }
  return t('community.discussions.resultsCount', { count: pagination.value.total });
});

const hasActiveFilters = computed(() => {
  return Boolean(searchQuery.value || selectedTag.value || activeFilter.value !== 'all' || sortBy.value !== 'active');
});

const starterPrompts = computed(() => [
  {
    label: t('community.discussions.templateQuestion'),
    title: t('community.discussions.templateQuestionTitle'),
    tags: t('community.discussions.templateQuestionTags'),
    content: t('community.discussions.templateQuestionContent'),
  },
  {
    label: t('community.discussions.templateShare'),
    title: t('community.discussions.templateShareTitle'),
    tags: t('community.discussions.templateShareTags'),
    content: t('community.discussions.templateShareContent'),
  },
  {
    label: t('community.discussions.templateReview'),
    title: t('community.discussions.templateReviewTitle'),
    tags: t('community.discussions.templateReviewTags'),
    content: t('community.discussions.templateReviewContent'),
  },
]);

watch(searchQuery, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    resetAndFetch();
  }, 260);
});

watch([sortBy, selectedTag, activeFilter], () => {
  resetAndFetch();
});

const parseImages = (imagesStr: string | null | undefined): string[] => {
  try {
    const parsed = imagesStr ? JSON.parse(imagesStr) : [];
    return Array.isArray(parsed) ? parsed.filter((img): img is string => typeof img === 'string') : [];
  } catch (_e) {
    return [];
  }
};

const parseTags = (tagsStr: string | null | undefined): string[] => {
  try {
    const parsed = tagsStr ? JSON.parse(tagsStr) : [];
    return Array.isArray(parsed) ? parsed.filter((tagName): tagName is string => typeof tagName === 'string') : [];
  } catch (_e) {
    return tagsStr
      ? tagsStr
          .split(',')
          .map((tagName) => tagName.trim())
          .filter(Boolean)
      : [];
  }
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('common.time.justNow');
  if (minutes < 60) return t('common.time.minutesAgo', { n: minutes });
  if (hours < 24) return t('common.time.hoursAgo', { n: hours });
  if (days < 7) return t('common.time.daysAgo', { n: days });
  return date.toLocaleDateString(locale.value === 'en-US' ? 'en-US' : 'zh-CN');
};

function formatNumber(value: number | undefined) {
  const safe = value || 0;
  if (safe >= 10000) return `${(safe / 10000).toFixed(1)}w`;
  if (safe >= 1000) return `${(safe / 1000).toFixed(1)}k`;
  return String(safe);
}

function resetAndFetch() {
  pagination.value.page = 1;
  fetchDiscussions();
}

const fetchDiscussions = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/discussions', {
      params: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        search: searchQuery.value || undefined,
        sort: sortBy.value,
        tag: selectedTag.value || undefined,
        filter: activeFilter.value,
      },
    });
    discussions.value = response.data.discussions;
    pagination.value = response.data.pagination;
  } catch (error) {
    console.error('Fetch discussions error:', error);
    ElMessage.error(t('common.error'));
  } finally {
    isLoading.value = false;
  }
};

const fetchInsights = async () => {
  isInsightsLoading.value = true;
  try {
    const response = await api.get('/api/discussions/insights');
    insights.value = response.data;
  } catch (error) {
    console.error('Fetch discussion insights error:', error);
  } finally {
    isInsightsLoading.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([fetchDiscussions(), fetchInsights()]);
};

const handlePageChange = (page: number) => {
  pagination.value.page = page;
  fetchDiscussions();
};

const setTag = (tagName: string) => {
  selectedTag.value = selectedTag.value === tagName ? '' : tagName;
};

const clearFilters = () => {
  searchQuery.value = '';
  selectedTag.value = '';
  activeFilter.value = 'all';
  sortBy.value = 'active';
  resetAndFetch();
};

const handleImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files) return;

  if (selectedImages.value.length + files.length > 5) {
    ElMessage.warning(t('community.discussions.maxImagesLimit', { count: 5 }));
    input.value = '';
    return;
  }

  Array.from(files).forEach((file) => {
    selectedImages.value.push(file);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      imagePreviews.value.push(readerEvent.target?.result as string);
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
};

const removeImage = (index: number) => {
  selectedImages.value.splice(index, 1);
  imagePreviews.value.splice(index, 1);
};

const applyTemplate = (template: { title: string; tags: string; content: string }) => {
  postForm.value = {
    title: postForm.value.title || template.title,
    tags: postForm.value.tags || template.tags,
    content: postForm.value.content || template.content,
  };
};

const addTagToDraft = (tagName: string) => {
  const currentTags = postForm.value.tags
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!currentTags.includes(tagName)) {
    currentTags.push(tagName);
  }
  postForm.value.tags = currentTags.join(', ');
};

const resetDraft = () => {
  postForm.value = { title: '', content: '', tags: '' };
  selectedImages.value = [];
  imagePreviews.value = [];
};

const handleCreateDiscussion = async () => {
  if (!postForm.value.title.trim() || !postForm.value.content.trim()) {
    ElMessage.warning(t('support.fill_all_fields'));
    return;
  }

  const formData = new FormData();
  formData.append('title', postForm.value.title.trim());
  formData.append('content', postForm.value.content.trim());
  if (postForm.value.tags.trim()) {
    const tagsArray = postForm.value.tags
      .split(',')
      .map((tagName) => tagName.trim())
      .filter(Boolean);
    formData.append('tags', JSON.stringify(Array.from(new Set(tagsArray))));
  }
  selectedImages.value.forEach((file) => {
    formData.append('images', file);
  });

  try {
    await api.post('/api/discussions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success(t('community.discussions.postSuccess'));
    showCreateModal.value = false;
    resetDraft();
    await refreshAll();
  } catch (_error) {
    ElMessage.error(t('community.discussions.postFailed'));
  }
};

const openDiscussion = async (id: string) => {
  try {
    const response = await api.get(`/api/discussions/${id}`);
    selectedDiscussion.value = response.data;
    isDetailOpen.value = true;
    replyingTo.value = null;
    replyContent.value = '';
    newComment.value = '';
    expandedReplies.value = new Set(
      (response.data.comments || [])
        .filter((comment: DiscussionComment) => comment.replies?.length > 0)
        .map((comment: DiscussionComment) => comment.id),
    );

    const index = discussions.value.findIndex((discussion) => discussion.id === id);
    if (index >= 0) {
      discussions.value[index] = {
        ...discussions.value[index],
        viewCount: response.data.viewCount,
        isLiked: response.data.isLiked,
      };
    }
  } catch (_error) {
    ElMessage.error(t('common.error'));
  }
};

const handleAddComment = async () => {
  if (!selectedDiscussion.value || !newComment.value.trim()) return;
  isSubmittingComment.value = true;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: selectedDiscussion.value.id,
      content: newComment.value.trim(),
    });
    if (!selectedDiscussion.value.comments) selectedDiscussion.value.comments = [];
    selectedDiscussion.value.comments.push(response.data);
    selectedDiscussion.value._count.comments = (selectedDiscussion.value._count.comments || 0) + 1;
    selectedDiscussion.value.latestComment = response.data;
    selectedDiscussion.value.lastActivityAt = response.data.createdAt;
    newComment.value = '';
    ElMessage.success(t('community.discussions.postSuccess'));
    await refreshAll();
  } catch (_error) {
    ElMessage.error(t('community.discussions.postFailed'));
  } finally {
    isSubmittingComment.value = false;
  }
};

const handleReplyComment = async (parentId: string) => {
  if (!selectedDiscussion.value || !replyContent.value.trim()) return;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: selectedDiscussion.value.id,
      content: replyContent.value.trim(),
      parentId,
    });
    const parentComment = selectedDiscussion.value.comments?.find((comment) => comment.id === parentId);
    if (parentComment) {
      if (!parentComment.replies) parentComment.replies = [];
      parentComment.replies.push(response.data);
      parentComment._count = {
        ...parentComment._count,
        replies: (parentComment._count?.replies || 0) + 1,
      };
      expandedReplies.value = new Set([...expandedReplies.value, parentId]);
    }
    selectedDiscussion.value._count.comments = (selectedDiscussion.value._count.comments || 0) + 1;
    selectedDiscussion.value.latestComment = response.data;
    selectedDiscussion.value.lastActivityAt = response.data.createdAt;
    replyContent.value = '';
    replyingTo.value = null;
    ElMessage.success(t('community.discussions.postSuccess'));
    await refreshAll();
  } catch (_error) {
    ElMessage.error(t('community.discussions.postFailed'));
  }
};

const toggleLikeDiscussion = async (discussion: DiscussionCardActionTarget, event?: Event) => {
  event?.stopPropagation();
  try {
    const response = await api.post(`/api/discussions/${discussion.id}/like`);
    const wasLiked = Boolean(discussion.isLiked);
    discussion.isLiked = response.data.isLiked;
    discussion._count.likes = Math.max(
      0,
      (discussion._count.likes || 0) + (response.data.isLiked ? 1 : wasLiked ? -1 : 0),
    );

    if (selectedDiscussion.value?.id === discussion.id) {
      selectedDiscussion.value.isLiked = discussion.isLiked;
      selectedDiscussion.value._count.likes = discussion._count.likes;
    }
    fetchInsights();
  } catch (_error) {
    ElMessage.error(t('community.discussions.likeFailed'));
  }
};

const toggleLikeComment = async (comment: DiscussionComment) => {
  try {
    const response = await api.post(`/api/discussions/comments/${comment.id}/like`);
    const wasLiked = Boolean(comment.isLiked);
    comment.isLiked = response.data.isLiked;
    comment._count.likes = Math.max(
      0,
      (comment._count?.likes || 0) + (response.data.isLiked ? 1 : wasLiked ? -1 : 0),
    );
  } catch (_error) {
    ElMessage.error(t('community.discussions.likeFailed'));
  }
};

const togglePinDiscussion = async (discussion: DiscussionCardActionTarget, event?: Event) => {
  event?.stopPropagation();
  try {
    await api.post(`/api/discussions/${discussion.id}/pin`);
    discussion.isPinned = !discussion.isPinned;
    ElMessage.success(
      discussion.isPinned
        ? t('community.discussions.pinSuccess')
        : t('community.discussions.unpinSuccess'),
    );
    await refreshAll();
  } catch (_error) {
    ElMessage.error(t('community.discussions.likeFailed'));
  }
};

const deleteDiscussion = async (discussion: DiscussionCardActionTarget, event?: Event) => {
  event?.stopPropagation();
  try {
    await ElMessageBox.confirm(t('community.discussions.deletePostConfirm'), t('common.confirmDelete'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    await api.delete(`/api/discussions/${discussion.id}`);
    ElMessage.success(t('community.discussions.deleteSuccess'));
    if (selectedDiscussion.value?.id === discussion.id) {
      isDetailOpen.value = false;
      selectedDiscussion.value = null;
    }
    await refreshAll();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('community.discussions.deleteFailed'));
    }
  }
};

const deleteComment = async (comment: DiscussionComment, parentComment?: DiscussionComment) => {
  try {
    await ElMessageBox.confirm(t('community.discussions.deleteCommentConfirm'), t('common.confirmDelete'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    await api.delete(`/api/discussions/comments/${comment.id}`);
    if (parentComment) {
      parentComment.replies = (parentComment.replies || []).filter((reply) => reply.id !== comment.id);
      parentComment._count = {
        ...parentComment._count,
        replies: Math.max(0, (parentComment._count?.replies || 1) - 1),
      };
    } else if (selectedDiscussion.value?.comments) {
      selectedDiscussion.value.comments = selectedDiscussion.value.comments.filter((item) => item.id !== comment.id);
    }
    if (selectedDiscussion.value) {
      selectedDiscussion.value._count.comments = Math.max(
        0,
        (selectedDiscussion.value._count.comments || 1) - 1,
      );
    }
    ElMessage.success(t('community.discussions.deleteSuccess'));
    await refreshAll();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('community.discussions.deleteFailed'));
    }
  }
};

const toggleReplies = (commentId: string) => {
  const next = new Set(expandedReplies.value);
  if (next.has(commentId)) {
    next.delete(commentId);
  } else {
    next.add(commentId);
  }
  expandedReplies.value = next;
};

onMounted(() => {
  refreshAll();
});

onBeforeUnmount(() => {
  if (searchTimer) window.clearTimeout(searchTimer);
});
</script>

<template>
  <div class="discussion-page">
    <PageHeader
      :title="t('community.discussions.title')"
      :subtitle="listSummary"
      :icon="MessageSquare"
    >
      <div class="discussion-header-actions">
        <div class="discussion-search">
          <Search class="h-3.5 w-3.5" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('community.discussions.searchPlaceholder')"
          />
        </div>
        <button type="button" class="icon-action" :title="t('community.discussions.refresh')" @click="refreshAll">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading || isInsightsLoading }" />
        </button>
        <button type="button" class="primary-action" @click="showCreateModal = true">
          <Edit3 class="h-4 w-4" />
          <span>{{ t('community.discussions.newPost') }}</span>
        </button>
      </div>
    </PageHeader>

    <main class="discussion-board">
      <section class="discussion-feed">
        <div class="discussion-composer-card">
          <div class="composer-entry">
            <UserAvatar :user="authStore.user" size="sm" />
            <button type="button" class="composer-trigger" @click="showCreateModal = true">
              <span>{{ t('community.discussions.draftMeta') }}</span>
              <Edit3 class="h-4 w-4" />
            </button>
          </div>

          <div class="composer-stats">
            <div
              v-for="metric in metricCards"
              :key="metric.label"
              class="composer-stat"
              :class="`composer-stat--${metric.tone}`"
            >
              <component :is="metric.icon" class="h-3.5 w-3.5" />
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
        </div>

        <div class="control-panel">
          <div class="filter-tabs">
            <button
              v-for="filter in filterOptions"
              :key="filter.value"
              type="button"
              :class="{ 'is-active': activeFilter === filter.value }"
              @click="activeFilter = filter.value"
            >
              <component :is="filter.icon" class="h-3.5 w-3.5" />
              <span>{{ filter.label }}</span>
              <b v-if="filter.count !== undefined">{{ formatNumber(filter.count) }}</b>
            </button>
          </div>

          <div class="sort-strip">
            <span>{{ selectedSortLabel }}</span>
            <button
              v-for="option in sortOptions"
              :key="option.value"
              type="button"
              :class="{ 'is-active': sortBy === option.value }"
              :title="option.label"
              @click="sortBy = option.value"
            >
              <component :is="option.icon" class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div v-if="hasActiveFilters" class="active-filter-line">
          <div>
            <CheckCircle2 class="h-3.5 w-3.5" />
            <span v-if="selectedTag">{{ t('community.discussions.selectedTag', { tag: selectedTag }) }}</span>
            <span v-else>{{ t('community.discussions.filteredView') }}</span>
          </div>
          <button type="button" @click="clearFilters">{{ t('community.discussions.clearFilters') }}</button>
        </div>

        <div v-if="isLoading" class="loading-list">
          <div v-for="idx in 4" :key="idx" class="skeleton-card">
            <span></span>
            <div>
              <i></i>
              <i></i>
              <i></i>
            </div>
          </div>
        </div>

        <div v-else-if="discussions.length > 0" class="discussion-list">
          <DiscussionCard
            v-for="discussion in discussions"
            :key="discussion.id"
            :discussion="discussion"
            :current-user-id="currentUserId"
            :is-admin="isAdmin"
            @click="openDiscussion"
            @like="toggleLikeDiscussion"
            @pin="togglePinDiscussion"
            @delete="deleteDiscussion"
            @tag="setTag"
          />
        </div>

        <div v-else class="empty-state">
          <MessageSquare class="h-12 w-12" />
          <strong>{{ t('community.discussions.emptyTitle') }}</strong>
          <p>{{ t('community.discussions.emptySubtitle') }}</p>
          <button type="button" class="primary-action" @click="showCreateModal = true">
            <Edit3 class="h-4 w-4" />
            <span>{{ t('community.discussions.newPost') }}</span>
          </button>
        </div>

        <div v-if="pagination.totalPages > 1" class="pagination-row">
          <el-pagination
            v-model:current-page="pagination.page"
            :page-size="pagination.limit"
            :total="pagination.total"
            layout="prev, pager, next"
            background
            @current-change="handlePageChange"
          />
        </div>
      </section>

      <aside class="discussion-side">
        <section class="side-panel side-panel--compose">
          <div>
            <p>{{ t('community.discussions.communityHealth') }}</p>
            <strong>{{ formatNumber(insights?.totals.activeAuthors || topContributors.length) }}</strong>
            <span>{{ t('community.discussions.activeAuthors') }}</span>
          </div>
          <button type="button" class="primary-action" @click="showCreateModal = true">
            <Plus class="h-4 w-4" />
            <span>{{ t('community.discussions.newPost') }}</span>
          </button>
        </section>

        <section class="side-panel">
          <header>
            <h2><Tag class="h-4 w-4" /> {{ t('community.discussions.popularTags') }}</h2>
          </header>
          <div v-if="tagInsights.length > 0" class="tag-cloud">
            <button
              v-for="tagItem in tagInsights.slice(0, 18)"
              :key="tagItem.name"
              type="button"
              :class="{ 'is-active': selectedTag === tagItem.name }"
              @click="setTag(tagItem.name)"
            >
              <span>#{{ tagItem.name }}</span>
              <b>{{ tagItem.count }}</b>
            </button>
          </div>
          <p v-else class="muted-line">{{ t('community.discussions.noTagsYet') }}</p>
        </section>

        <section class="side-panel">
          <header>
            <h2><Flame class="h-4 w-4" /> {{ t('community.discussions.hotPosts') }}</h2>
          </header>
          <div v-if="hotDiscussions.length > 0" class="rank-list">
            <button
              v-for="(item, index) in hotDiscussions"
              :key="item.id"
              type="button"
              @click="openDiscussion(item.id)"
            >
              <b :class="`rank-index--${index + 1}`">{{ index + 1 }}</b>
              <span>{{ item.title }}</span>
              <small>{{ formatNumber(item.viewCount) }} {{ t('community.discussions.views') }}</small>
            </button>
          </div>
          <p v-else class="muted-line">{{ t('community.discussions.noHotPosts') }}</p>
        </section>

        <section class="side-panel">
          <header>
            <h2><Users class="h-4 w-4" /> {{ t('community.discussions.activeCreators') }}</h2>
          </header>
          <div v-if="topContributors.length > 0" class="creator-list">
            <div v-for="creator in topContributors" :key="creator.user.id">
              <UserAvatar :user="creator.user" size="xs" />
              <div>
                <strong>{{ creator.user.name || t('community.discussions.anonymousCreator') }}</strong>
                <span>
                  {{ t('community.discussions.creatorStats', {
                    posts: creator.discussions,
                    comments: creator.comments,
                  }) }}
                </span>
              </div>
              <b>{{ formatNumber(creator.likesReceived) }}</b>
            </div>
          </div>
          <p v-else class="muted-line">{{ t('community.discussions.noCreatorsYet') }}</p>
        </section>

        <section class="side-panel">
          <header>
            <h2><MessageCircle class="h-4 w-4" /> {{ t('community.discussions.recentActivity') }}</h2>
          </header>
          <div v-if="recentComments.length > 0" class="activity-list">
            <button
              v-for="activity in recentComments"
              :key="activity.id"
              type="button"
              @click="openDiscussion(activity.discussion.id)"
            >
              <span>{{ activity.user.name || t('community.discussions.anonymous') }}</span>
              <strong>{{ activity.discussion.title }}</strong>
              <small>{{ formatTime(activity.createdAt) }}</small>
            </button>
          </div>
          <p v-else class="muted-line">{{ t('community.discussions.noActivityYet') }}</p>
        </section>
      </aside>
    </main>

    <Transition name="fade">
      <div v-if="isDetailOpen && selectedDiscussion" class="modal-shell">
        <div class="modal-backdrop" @click="isDetailOpen = false"></div>
        <section class="detail-modal">
          <header class="detail-header">
            <div class="detail-author">
              <UserAvatar :user="selectedDiscussion.user" size="sm" />
              <div>
                <strong>{{ selectedDiscussion.user?.name || t('community.discussions.anonymous') }}</strong>
                <span>{{ formatTime(selectedDiscussion.createdAt) }}</span>
              </div>
              <i v-if="selectedDiscussion.isPinned">
                <Pin class="h-3 w-3" />
                {{ t('community.discussions.pinned') }}
              </i>
            </div>
            <div class="modal-actions">
              <button
                v-if="isAdmin"
                type="button"
                :class="{ 'is-active': selectedDiscussion.isPinned }"
                @click="togglePinDiscussion(selectedDiscussion)"
              >
                <Pin class="h-4 w-4" />
              </button>
              <button
                v-if="currentUserId === selectedDiscussion.user?.id || isAdmin"
                type="button"
                class="danger"
                @click="deleteDiscussion(selectedDiscussion)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
              <button type="button" @click="isDetailOpen = false">
                <X class="h-4 w-4" />
              </button>
            </div>
          </header>

          <div class="detail-grid">
            <article class="detail-content">
              <h2>{{ selectedDiscussion.title }}</h2>
              <div v-if="parseTags(selectedDiscussion.tags).length > 0" class="detail-tags">
                <button
                  v-for="tagName in parseTags(selectedDiscussion.tags)"
                  :key="tagName"
                  type="button"
                  @click="setTag(tagName)"
                >
                  #{{ tagName }}
                </button>
              </div>

              <div class="detail-stats">
                <button
                  type="button"
                  :class="{ 'is-liked': selectedDiscussion.isLiked }"
                  @click="toggleLikeDiscussion(selectedDiscussion)"
                >
                  <Heart class="h-4 w-4" :class="{ 'fill-current': selectedDiscussion.isLiked }" />
                  {{ selectedDiscussion._count?.likes || 0 }}
                </button>
                <span><MessageSquare class="h-4 w-4" /> {{ selectedDiscussion._count?.comments || 0 }}</span>
                <span><Eye class="h-4 w-4" /> {{ selectedDiscussion.viewCount || 0 }}</span>
              </div>

              <MarkdownEditor
                class="discussion-preview"
                :model-value="selectedDiscussion.content"
                preview-only
              />

              <div v-if="parseImages(selectedDiscussion.images).length > 0" class="detail-images">
                <img
                  v-for="(image, index) in parseImages(selectedDiscussion.images)"
                  :key="`${image}-${index}`"
                  :src="getAssetUrl(image)"
                  alt=""
                />
              </div>
            </article>

            <aside class="detail-comments">
              <div class="comments-title">
                <h3>{{ t('community.discussions.allComments', { count: selectedDiscussion.comments?.length || 0 }) }}</h3>
              </div>

              <div class="comments-scroll">
                <div v-if="selectedDiscussion.comments?.length" class="comment-list">
                  <div v-for="comment in selectedDiscussion.comments" :key="comment.id" class="comment-item">
                    <UserAvatar :user="comment.user" size="xs" />
                    <div class="comment-body">
                      <div class="comment-bubble">
                        <div>
                          <strong>{{ comment.user?.name || t('community.discussions.anonymous') }}</strong>
                          <span>{{ formatTime(comment.createdAt) }}</span>
                        </div>
                        <p>{{ comment.content }}</p>
                      </div>

                      <div class="comment-actions">
                        <button
                          type="button"
                          :class="{ 'is-liked': comment.isLiked }"
                          @click="toggleLikeComment(comment)"
                        >
                          <Heart class="h-3 w-3" :class="{ 'fill-current': comment.isLiked }" />
                          {{ comment._count?.likes || 0 }}
                        </button>
                        <button
                          type="button"
                          @click="
                            replyingTo = replyingTo?.id === comment.id ? null : comment;
                            replyContent = '';
                          "
                        >
                          <MessageSquare class="h-3 w-3" />
                          {{ t('common.reply') }}
                        </button>
                        <button
                          v-if="currentUserId === comment.user?.id || isAdmin"
                          type="button"
                          class="danger"
                          @click="deleteComment(comment)"
                        >
                          <Trash2 class="h-3 w-3" />
                          {{ t('common.delete') }}
                        </button>
                      </div>

                      <div v-if="replyingTo?.id === comment.id" class="reply-box">
                        <textarea
                          v-model="replyContent"
                          rows="2"
                          :placeholder="t('community.discussions.replyTo', {
                            name: comment.user?.name || t('community.discussions.anonymous'),
                          })"
                        ></textarea>
                        <div>
                          <button type="button" @click="replyingTo = null">{{ t('common.cancel') }}</button>
                          <button
                            type="button"
                            :disabled="!replyContent.trim()"
                            @click="handleReplyComment(comment.id)"
                          >
                            <Send class="h-3 w-3" />
                            {{ t('common.reply') }}
                          </button>
                        </div>
                      </div>

                      <button
                        v-if="comment._count?.replies"
                        type="button"
                        class="reply-toggle"
                        @click="toggleReplies(comment.id)"
                      >
                        <ChevronUp v-if="expandedReplies.has(comment.id)" class="h-3 w-3" />
                        <ChevronDown v-else class="h-3 w-3" />
                        {{
                          expandedReplies.has(comment.id)
                            ? t('community.discussions.collapseReplies')
                            : t('community.discussions.showRepliesCount', { count: comment._count.replies })
                        }}
                      </button>

                      <div
                        v-if="expandedReplies.has(comment.id) && comment.replies?.length"
                        class="reply-list"
                      >
                        <div v-for="reply in comment.replies" :key="reply.id" class="reply-item">
                          <UserAvatar :user="reply.user" size="xs" />
                          <div>
                            <div class="comment-bubble">
                              <div>
                                <strong>{{ reply.user?.name || t('community.discussions.anonymous') }}</strong>
                                <span>{{ formatTime(reply.createdAt) }}</span>
                              </div>
                              <p>{{ reply.content }}</p>
                            </div>
                            <div class="comment-actions">
                              <button
                                type="button"
                                :class="{ 'is-liked': reply.isLiked }"
                                @click="toggleLikeComment(reply)"
                              >
                                <Heart class="h-3 w-3" :class="{ 'fill-current': reply.isLiked }" />
                                {{ reply._count?.likes || 0 }}
                              </button>
                              <button
                                v-if="currentUserId === reply.user?.id || isAdmin"
                                type="button"
                                class="danger"
                                @click="deleteComment(reply, comment)"
                              >
                                <Trash2 class="h-3 w-3" />
                                {{ t('common.delete') }}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="comments-empty">
                  <MessageCircle class="h-8 w-8" />
                  <span>{{ t('community.discussions.noRepliesYet') }}</span>
                </div>
              </div>

              <div class="comment-composer">
                <UserAvatar :user="authStore.user" size="sm" />
                <div>
                  <textarea
                    v-model="newComment"
                    rows="3"
                    :placeholder="t('community.discussions.commentPlaceholder')"
                  ></textarea>
                  <button
                    type="button"
                    :disabled="!newComment.trim() || isSubmittingComment"
                    @click="handleAddComment"
                  >
                    <LoaderCircle v-if="isSubmittingComment" class="h-3.5 w-3.5 animate-spin" />
                    <Send v-else class="h-3.5 w-3.5" />
                    {{ t('community.discussions.postComment') }}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showCreateModal" class="modal-shell">
        <div class="modal-backdrop" @click="showCreateModal = false"></div>
        <section class="create-modal">
          <header class="create-header">
            <div>
              <h2>{{ t('community.discussions.newPost') }}</h2>
              <p>{{ t('community.discussions.draftMeta') }}</p>
            </div>
            <button type="button" @click="showCreateModal = false">
              <X class="h-4 w-4" />
            </button>
          </header>

          <div class="create-grid">
            <section class="create-main">
              <label>
                <span>{{ t('community.discussions.postTitleLabel') }}</span>
                <input
                  v-model="postForm.title"
                  type="text"
                  :placeholder="t('community.discussions.titlePlaceholder')"
                />
              </label>

              <label class="editor-label">
                <span>{{ t('community.discussions.postContentLabel') }}</span>
                <MarkdownEditor
                  v-model="postForm.content"
                  height="420px"
                  :placeholder="t('community.discussions.editorPlaceholder')"
                />
              </label>
            </section>

            <aside class="create-side">
              <section>
                <h3><Sparkles class="h-4 w-4" /> {{ t('community.discussions.quickDraft') }}</h3>
                <div class="template-list">
                  <button
                    v-for="template in starterPrompts"
                    :key="template.label"
                    type="button"
                    @click="applyTemplate(template)"
                  >
                    {{ template.label }}
                  </button>
                </div>
              </section>

              <section>
                <h3><Tag class="h-4 w-4" /> {{ t('community.discussions.postTagsLabel') }}</h3>
                <input
                  v-model="postForm.tags"
                  type="text"
                  :placeholder="t('community.discussions.tagsPlaceholder')"
                />
                <div v-if="tagInsights.length > 0" class="draft-tags">
                  <button
                    v-for="tagItem in tagInsights.slice(0, 10)"
                    :key="tagItem.name"
                    type="button"
                    @click="addTagToDraft(tagItem.name)"
                  >
                    #{{ tagItem.name }}
                  </button>
                </div>
              </section>

              <section>
                <h3><ImageIcon class="h-4 w-4" /> {{ t('community.discussions.postImagesLabel') }}</h3>
                <div class="image-uploader">
                  <div v-for="(image, index) in imagePreviews" :key="`${image}-${index}`">
                    <img :src="image" alt="" />
                    <button type="button" @click="removeImage(index)">
                      <X class="h-3 w-3" />
                    </button>
                  </div>
                  <label v-if="imagePreviews.length < 5">
                    <Plus class="h-4 w-4" />
                    <span>{{ t('community.discussions.uploadImage') }}</span>
                    <input type="file" accept="image/*" multiple @change="handleImageSelect" />
                  </label>
                </div>
              </section>

              <section class="draft-preview">
                <h3><Eye class="h-4 w-4" /> {{ t('community.discussions.preview') }}</h3>
                <strong>{{ postForm.title || t('community.discussions.titlePlaceholder') }}</strong>
                <p>{{ postForm.content || t('community.discussions.emptyContent') }}</p>
              </section>
            </aside>
          </div>

          <footer class="create-footer">
            <button type="button" class="ghost-action" @click="resetDraft">{{ t('community.discussions.resetDraft') }}</button>
            <button type="button" class="primary-action" @click="handleCreateDiscussion">
              <Send class="h-4 w-4" />
              <span>{{ t('community.discussions.postSubmit') }}</span>
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.discussion-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-app);
}

.discussion-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.discussion-search {
  display: flex;
  align-items: center;
  gap: 7px;
  width: min(320px, 42vw);
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-muted);
}

.discussion-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.primary-action,
.ghost-action,
.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.primary-action {
  padding: 0 12px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.15);
}

.primary-action:hover {
  transform: translateY(-0.5px);
}

.primary-action:disabled,
.comment-composer button:disabled,
.reply-box button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.ghost-action,
.icon-action {
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  color: var(--text-secondary);
}

.ghost-action {
  padding: 0 10px;
}

.icon-action {
  width: 32px;
  flex: 0 0 auto;
}

.discussion-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 12px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

.discussion-feed,
.discussion-side {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.discussion-feed::-webkit-scrollbar,
.discussion-side::-webkit-scrollbar,
.comments-scroll::-webkit-scrollbar {
  display: none;
}

.discussion-feed {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.discussion-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.discussion-composer-card {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(320px, 0.9fr);
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.composer-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.composer-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  text-align: left;
  transition: all 0.15s ease;
}

.composer-trigger:hover {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(37, 99, 235, 0.05);
  color: var(--text-secondary);
}

.composer-trigger span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-trigger svg {
  flex: 0 0 auto;
  color: var(--accent);
}

.composer-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.composer-stat {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 1px 4px;
  align-items: center;
  min-width: 0;
  min-height: 32px;
  padding: 4px 6px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
}

.composer-stat svg {
  grid-row: 1 / span 2;
  width: 12px;
  height: 12px;
}

.composer-stat span {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1;
}

.composer-stat strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.composer-stat--blue svg { color: #2563eb; }
.composer-stat--teal svg { color: #0f766e; }
.composer-stat--rose svg { color: #e11d48; }
.composer-stat--amber svg { color: #b45309; }

.control-panel,
.active-filter-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.control-panel {
  padding: 6px;
  background: var(--bg-hover);
}

.filter-tabs,
.sort-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.filter-tabs {
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-tabs::-webkit-scrollbar {
  display: none;
}

.filter-tabs button,
.sort-strip button,
.active-filter-line button,
.tag-cloud button,
.draft-tags button,
.template-list button,
.detail-tags button {
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 500;
}

.filter-tabs button b {
  color: var(--text-muted);
  font-size: 9px;
  margin-left: 2px;
}

.filter-tabs button.is-active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.filter-tabs button.is-active b {
  color: var(--accent);
}

.sort-strip {
  flex: 0 0 auto;
}

.sort-strip span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
  margin-right: 4px;
}

.sort-strip button,
.modal-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
}

.sort-strip button.is-active {
  background: var(--accent);
  color: #fff;
}

.active-filter-line {
  min-height: 32px;
  padding: 0 10px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.active-filter-line div {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.active-filter-line button {
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--border-base);
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
}

.discussion-list,
.loading-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-card {
  display: flex;
  gap: 12px;
  height: 136px;
  padding: 14px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.skeleton-card span,
.skeleton-card i {
  display: block;
  border-radius: 7px;
  background: linear-gradient(
    90deg,
    var(--bg-app),
    color-mix(in srgb, var(--border-base) 70%, var(--bg-card)),
    var(--bg-app)
  );
  background-size: 200% 100%;
  animation: shimmer 1.3s infinite linear;
}

.skeleton-card span {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.skeleton-card div {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
}

.skeleton-card i {
  height: 14px;
}

.skeleton-card i:nth-child(1) { width: 36%; }
.skeleton-card i:nth-child(2) { width: 82%; }
.skeleton-card i:nth-child(3) { width: 56%; }

@keyframes shimmer {
  to { background-position: -200% 0; }
}

.empty-state {
  display: flex;
  flex: 1;
  min-height: 280px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-muted);
  text-align: center;
}

.empty-state strong {
  color: var(--text-primary);
  font-size: 14px;
}

.empty-state p {
  margin: 0 0 4px;
  font-size: 11px;
}

.pagination-row {
  display: flex;
  justify-content: center;
  padding: 8px 0 12px;
}

/* Sidebar Panels - Clean borderless rows */
.side-panel {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

.side-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.side-panel h2,
.create-side h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.side-panel--compose {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(20, 184, 166, 0.05)),
    var(--bg-card);
}

.side-panel--compose p,
.side-panel--compose span {
  margin: 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.side-panel--compose strong {
  display: block;
  margin: 1px 0;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  max-width: 130px;
  padding: 0 8px;
  border-radius: 9999px;
  border: 0;
  font-size: 10px;
  font-weight: 500;
}

.tag-cloud button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-cloud button b {
  color: var(--text-muted);
  font-size: 9px;
  margin-left: 2px;
}

/* Sidebar lists borderless & dashed */
.rank-list,
.creator-list,
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rank-list button,
.creator-list > div,
.activity-list button {
  display: grid;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  padding: 6px 4px;
  border-bottom: 1px dashed var(--border-base);
  transition: all 0.15s ease;
}

.rank-list button:hover,
.creator-list > div:hover,
.activity-list button:hover {
  background: var(--bg-hover);
  border-radius: 4px;
}

.rank-list button:last-child,
.creator-list > div:last-child,
.activity-list button:last-child {
  border-bottom: 0;
}

.rank-list button {
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
}

.rank-list b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.rank-list b.rank-index--1 { background: #f59e0b; color: #fff; }
.rank-list b.rank-index--2 { background: #94a3b8; color: #fff; }
.rank-list b.rank-index--3 { background: #a16207; color: #fff; }
.rank-list b:not(.rank-index--1):not(.rank-index--2):not(.rank-index--3) {
  background: var(--bg-app);
  color: var(--text-muted);
}

.rank-list span,
.activity-list strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}

.rank-list small,
.activity-list small,
.creator-list span,
.muted-line {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.creator-list > div {
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.creator-list strong {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-list b {
  color: #e11d48;
  font-size: 10px;
}

.activity-list button {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 6px;
  padding: 6px;
  background: transparent;
}

.activity-list span {
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
}

.activity-list strong {
  grid-column: 1 / -1;
}

.muted-line {
  margin: 0;
  line-height: 1.5;
}

.modal-shell {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(10px);
}

.detail-modal,
.create-modal {
  position: relative;
  display: flex;
  width: min(1120px, 100%);
  max-height: min(92vh, 860px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
}

.detail-header,
.create-header,
.create-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-base);
}

.detail-author {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.detail-author strong,
.create-header h2 {
  display: block;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 950;
}

.detail-author span,
.create-header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
}

.detail-author i {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 850;
}

.modal-actions {
  display: flex;
  gap: 6px;
}

.modal-actions button,
.create-header > button {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-actions button.is-active {
  border-color: var(--accent);
  color: var(--accent);
}

.modal-actions button.danger,
.comment-actions button.danger {
  color: #ef4444;
}

.create-header > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  min-height: 0;
}

.detail-content,
.detail-comments {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.detail-content {
  padding: 18px;
}

.detail-content h2 {
  margin: 0 0 10px;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 950;
  line-height: 1.35;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 12px;
}

.detail-tags button {
  height: 24px;
  padding: 0 9px;
  border-radius: 7px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 850;
}

.detail-stats {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-base);
}

.detail-stats button,
.detail-stats span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 850;
}

.detail-stats button.is-liked {
  color: #ef4444;
}

.discussion-preview {
  color: var(--text-primary);
}

.detail-images {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.detail-images img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.detail-comments {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-base);
  background: color-mix(in srgb, var(--bg-app) 72%, var(--bg-card));
}

.comments-title {
  padding: 13px;
  border-bottom: 1px solid var(--border-base);
}

.comments-title h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 950;
}

.comments-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 13px;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.comment-item,
.reply-item,
.comment-composer {
  display: flex;
  gap: 9px;
}

.comment-body {
  min-width: 0;
  flex: 1;
}

.comment-bubble {
  padding: 9px 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.comment-bubble > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}

.comment-bubble strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.comment-bubble span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
}

.comment-bubble p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 6px 0 0 4px;
}

.comment-actions button,
.reply-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10.5px;
  font-weight: 800;
}

.comment-actions button.is-liked {
  color: #ef4444;
}

.reply-box {
  margin-top: 8px;
}

.reply-box textarea,
.comment-composer textarea,
.create-main input,
.create-side input {
  width: 100%;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  outline: 0;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
}

.reply-box textarea,
.comment-composer textarea {
  resize: vertical;
  min-height: 58px;
  padding: 9px;
  line-height: 1.55;
}

.reply-box > div {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 7px;
}

.reply-box button,
.comment-composer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 7px;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 850;
}

.reply-box button:last-child,
.comment-composer button {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}
</style>
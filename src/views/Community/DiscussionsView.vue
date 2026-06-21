<script setup lang="ts">
import {
  formatRelativeTime as formatTime,
  formatCompactNumber as formatNumber,
} from '@/utils/format';
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Flame,
  Heart,
  Image as ImageIcon,
  Inbox,
  Layers,
  MessageCircle,
  MessageSquare,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  UserRound,
  Users,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
import UserAvatar from '@/components/UserAvatar.vue';
import PageHeader from '@/components/PageHeader.vue';
import DiscussionCard from '@/components/DiscussionCard.vue';
import DiscussionDetail from './components/DiscussionDetail.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import Modal from '@/components/ui/Modal.vue';
import { parseTags } from '@/utils/tags';

const authStore = useAuthStore();
const { t, locale } = useI18n();
const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);

const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

type DiscussionFilter = 'all' | 'mine' | 'unanswered' | 'pinned';

export interface DiscussionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface DiscussionCounts {
  likes: number;
  comments: number;
  replies?: number;
}

export interface DiscussionComment {
  id: string;
  content: string;
  createdAt: string;
  user: DiscussionUser;
  parentId?: string | null;
  replies: DiscussionComment[];
  isLiked?: boolean;
  _count: DiscussionCounts;
}

export interface Discussion {
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
      const scoreA =
        (a.viewCount || 0) + (a._count?.comments || 0) * 8 + (a._count?.likes || 0) * 5;
      const scoreB =
        (b.viewCount || 0) + (b._count?.comments || 0) * 8 + (b._count?.likes || 0) * 5;
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
  const pageComments = discussions.value.reduce(
    (sum, item) => sum + (item._count?.comments || 0),
    0,
  );

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
  return Boolean(
    searchQuery.value ||
    selectedTag.value ||
    activeFilter.value !== 'all' ||
    sortBy.value !== 'active',
  );
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
    await ElMessageBox.confirm(
      t('community.discussions.deletePostConfirm'),
      t('common.confirmDelete'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      },
    );
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
      <template #center>
        <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
          <Search />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('community.discussions.searchPlaceholder')"
          />
        </label>
      </template>

      <div class="discussion-header-actions">
        <Button
          variant="outline"
          size="sm"
          class="!w-8 !h-8 !p-0 !rounded-lg shrink-0"
          :title="t('community.discussions.refresh')"
          @click="refreshAll"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading || isInsightsLoading }" />
        </Button>
        <Button
          variant="primary"
          size="sm"
          :icon="Edit3"
          class="!h-8 !rounded-lg shrink-0 font-bold"
          @click="showCreateModal = true"
        >
          {{ t('community.discussions.newPost') }}
        </Button>
      </div>
    </PageHeader>

    <main class="discussion-board">
      <section class="discussion-feed">
        <!-- Stats Premium Grid -->
        <div class="stats-row">
          <div
            v-for="metric in metricCards"
            :key="metric.label"
            class="stat-card-premium"
            :class="`stat-card-premium--${metric.tone}`"
          >
            <div class="stat-icon-wrapper">
              <component :is="metric.icon" class="h-4 w-4" />
            </div>
            <div class="stat-info">
              <span class="stat-label">{{ metric.label }}</span>
              <strong class="stat-value">{{ metric.value }}</strong>
            </div>
          </div>
        </div>

        <!-- Composer Card Premium -->
        <div class="composer-card-premium">
          <UserAvatar :user="authStore.user" size="md" />
          <button type="button" class="composer-trigger-premium" @click="showCreateModal = true">
            <span>{{
              label(
                '分享你的 3D 学习心得，在此发布新讨论...',
                'Share your 3D learning insights, start a new discussion...',
              )
            }}</span>
            <div class="composer-btn-inner">
              <Edit3 class="h-3.5 w-3.5" />
              <span>{{ t('community.discussions.newPost') }}</span>
            </div>
          </button>
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
            <span v-if="selectedTag">{{
              t('community.discussions.selectedTag', { tag: selectedTag })
            }}</span>
            <span v-else>{{ t('community.discussions.filteredView') }}</span>
          </div>
          <button type="button" @click="clearFilters">
            {{ t('community.discussions.clearFilters') }}
          </button>
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
          <Button
            variant="primary"
            size="md"
            :icon="Edit3"
            class="hover:scale-105 transition-transform"
            @click="showCreateModal = true"
          >
            {{ t('community.discussions.newPost') }}
          </Button>
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
        <section class="side-panel side-panel--health">
          <div class="health-header">
            <BarChart3 class="h-3.5 w-3.5 text-accent" />
            <span>{{ t('community.discussions.communityHealth') }}</span>
          </div>
          <div class="health-stats">
            <div class="health-stat-item">
              <strong>{{
                formatNumber(insights?.totals.activeAuthors || topContributors.length)
              }}</strong>
              <span>{{ t('community.discussions.activeAuthors') }}</span>
            </div>
            <div v-if="insights?.totals.unanswered !== undefined" class="health-stat-item">
              <strong>{{ formatNumber(insights?.totals.unanswered) }}</strong>
              <span>{{ label('等回复', 'Unanswered') }}</span>
            </div>
          </div>
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
              <small
                >{{ formatNumber(item.viewCount) }} {{ t('community.discussions.views') }}</small
              >
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
                <strong>{{
                  creator.user.name || t('community.discussions.anonymousCreator')
                }}</strong>
                <span>
                  {{
                    t('community.discussions.creatorStats', {
                      posts: creator.discussions,
                      comments: creator.comments,
                    })
                  }}
                </span>
              </div>
              <b>{{ formatNumber(creator.likesReceived) }}</b>
            </div>
          </div>
          <p v-else class="muted-line">{{ t('community.discussions.noCreatorsYet') }}</p>
        </section>

        <section class="side-panel">
          <header>
            <h2>
              <MessageCircle class="h-4 w-4" /> {{ t('community.discussions.recentActivity') }}
            </h2>
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
      <DiscussionDetail
        v-if="isDetailOpen && selectedDiscussion"
        :discussion="selectedDiscussion"
        :current-user-id="currentUserId"
        :is-admin="isAdmin"
        @close="isDetailOpen = false"
        @set-tag="setTag"
        @refresh-parent="refreshAll"
      />
    </Transition>

    <Modal
      :show="showCreateModal"
      :title="t('community.discussions.newPost')"
      size="xl"
      @close="showCreateModal = false"
    >
      <div class="create-grid text-left">
        <section class="create-main">
          <Input
            v-model="postForm.title"
            type="text"
            :label="t('community.discussions.postTitleLabel')"
            :placeholder="t('community.discussions.titlePlaceholder')"
            input-class="!py-2.5 !rounded-lg"
          />

          <div class="space-y-2 mt-4 text-left">
            <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">
              {{ t('community.discussions.postContentLabel') }}
            </label>
            <MarkdownEditor
              v-model="postForm.content"
              height="380px"
              :placeholder="t('community.discussions.editorPlaceholder')"
            />
          </div>
        </section>

        <aside class="create-side">
          <section>
            <h3
              class="flex items-center gap-1 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2"
            >
              <Sparkles class="h-4 w-4 text-accent" /> {{ t('community.discussions.quickDraft') }}
            </h3>
            <div class="template-list flex flex-wrap gap-1.5">
              <Button
                v-for="template in starterPrompts"
                :key="template.label"
                variant="outline"
                size="sm"
                class="!py-1 !px-2.5 !text-[10px] !h-auto !rounded-lg font-bold"
                @click="applyTemplate(template)"
              >
                {{ template.label }}
              </Button>
            </div>
          </section>

          <section class="mt-4">
            <h3
              class="flex items-center gap-1 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2"
            >
              <Tag class="h-4 w-4 text-accent" /> {{ t('community.discussions.postTagsLabel') }}
            </h3>
            <Input
              v-model="postForm.tags"
              type="text"
              :placeholder="t('community.discussions.tagsPlaceholder')"
              input-class="!py-2 !rounded-lg !text-xs"
            />
            <div v-if="tagInsights.length > 0" class="draft-tags flex flex-wrap gap-1.5 mt-2">
              <Button
                v-for="tagItem in tagInsights.slice(0, 10)"
                :key="tagItem.name"
                variant="secondary"
                size="sm"
                class="!py-0.5 !px-2 !text-[9px] !h-auto !rounded-md !bg-slate-100 dark:!bg-white/5 font-bold"
                @click="addTagToDraft(tagItem.name)"
              >
                #{{ tagItem.name }}
              </Button>
            </div>
          </section>

          <section class="mt-4">
            <h3
              class="flex items-center gap-1 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2"
            >
              <ImageIcon class="h-4 w-4 text-accent" />
              {{ t('community.discussions.postImagesLabel') }}
            </h3>
            <div class="image-uploader">
              <div v-for="(image, index) in imagePreviews" :key="`${image}-${index}`">
                <img :src="image" alt="" />
                <button type="button" @click="removeImage(index)">
                  <X class="h-3 w-3" />
                </button>
              </div>
              <label v-if="imagePreviews.length < 5" class="cursor-pointer">
                <Plus class="h-4 w-4" />
                <span>{{ t('community.discussions.uploadImage') }}</span>
                <input type="file" accept="image/*" multiple @change="handleImageSelect" />
              </label>
            </div>
          </section>

          <section
            class="draft-preview mt-4 p-3 rounded-xl border border-dashed border-base bg-white/20 dark:bg-white/5"
          >
            <h3
              class="flex items-center gap-1 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2"
            >
              <Eye class="h-4 w-4 text-accent" /> {{ t('community.discussions.preview') }}
            </h3>
            <strong class="block text-xs font-bold mb-1 truncate text-primary">{{
              postForm.title || t('community.discussions.titlePlaceholder')
            }}</strong>
            <p class="text-[10px] text-secondary line-clamp-3 leading-relaxed">
              {{ postForm.content || t('community.discussions.emptyContent') }}
            </p>
          </section>
        </aside>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" size="sm" @click="resetDraft">
            {{ t('community.discussions.resetDraft') }}
          </Button>
          <Button variant="primary" size="sm" :icon="Send" @click="handleCreateDiscussion">
            {{ t('community.discussions.postSubmit') }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.discussion-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: transparent !important;
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

/* Stats row & premium cards */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 640px) {
  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.stat-card-premium {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  transition: all 0.2s ease;
}

.stat-card-premium:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.stat-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-card-premium--blue .stat-icon-wrapper {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}
.stat-card-premium--blue:hover {
  border-color: rgba(37, 99, 235, 0.3);
}

.stat-card-premium--teal .stat-icon-wrapper {
  background: rgba(15, 118, 110, 0.1);
  color: #0f766e;
}
.stat-card-premium--teal:hover {
  border-color: rgba(15, 118, 110, 0.3);
}

.stat-card-premium--rose .stat-icon-wrapper {
  background: rgba(225, 29, 72, 0.1);
  color: #e11d48;
}
.stat-card-premium--rose:hover {
  border-color: rgba(225, 29, 72, 0.3);
}

.stat-card-premium--amber .stat-icon-wrapper {
  background: rgba(180, 83, 9, 0.1);
  color: #b45309;
}
.stat-card-premium--amber:hover {
  border-color: rgba(180, 83, 9, 0.3);
}

/* Composer premium styling */
.composer-card-premium {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}

.composer-trigger-premium {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.composer-trigger-premium:hover {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(37, 99, 235, 0.05);
  color: var(--text-secondary);
}

.composer-trigger-premium span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-btn-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.composer-trigger-premium:hover .composer-btn-inner {
  transform: translateY(-0.5px);
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);
}

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

.skeleton-card i:nth-child(1) {
  width: 36%;
}
.skeleton-card i:nth-child(2) {
  width: 82%;
}
.skeleton-card i:nth-child(3) {
  width: 56%;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
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

.side-panel--health {
  background:
    linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(20, 184, 166, 0.03)), var(--bg-card);
  padding: 12px;
}

.health-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.health-stats {
  display: flex;
  gap: 16px;
}

.health-stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.health-stat-item strong {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.1;
}

.health-stat-item span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
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

.rank-list b.rank-index--1 {
  background: #f59e0b;
  color: #fff;
}
.rank-list b.rank-index--2 {
  background: #94a3b8;
  color: #fff;
}
.rank-list b.rank-index--3 {
  background: #a16207;
  color: #fff;
}
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

.create-header,
.create-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-base);
}

.create-header h2 {
  display: block;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 950;
}

.create-header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
}

.create-header > button {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

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
</style>

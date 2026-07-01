<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Clock,
  Eye,
  Flame,
  Grid3X3,
  Inbox,
  Layers,
  LayoutList,
  MessageSquare,
  Pin,
  Sparkles,
  UserRound,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { useAuthStore } from '@/stores/auth';
import DiscussionHeader from './components/DiscussionHeader.vue';
import DiscussionFilterBar from './components/DiscussionFilterBar.vue';
import DiscussionListPanel from './components/DiscussionListPanel.vue';
import DiscussionSidebar from './components/DiscussionSidebar.vue';

const DiscussionDetail = defineAsyncComponent(() => import('./components/DiscussionDetail.vue'));
const DiscussionCreateModal = defineAsyncComponent(
  () => import('./components/DiscussionCreateModal.vue'),
);
import { parseTags } from '@/utils/tags';

const authStore = useAuthStore();
const { t } = useI18n();

const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

export type DiscussionFilter = 'all' | 'mine' | 'unanswered' | 'pinned';

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

export interface DiscussionCardActionTarget {
  id: string;
  isLiked?: boolean;
  isPinned?: boolean;
  _count: {
    likes: number;
  };
}

export interface TagInsight {
  name: string;
  count: number;
}

export interface ContributorInsight {
  user: DiscussionUser;
  discussions: number;
  comments: number;
  likesReceived: number;
}

export interface RecentCommentInsight {
  id: string;
  content: string;
  createdAt: string;
  user: DiscussionUser;
  discussion: Pick<Discussion, 'id' | 'title'>;
}

export interface DiscussionInsights {
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
const viewMode = ref<'grid' | 'list'>('grid');
const viewModeOptions = computed(() => [
  { value: 'grid' as const, icon: Grid3X3 },
  { value: 'list' as const, icon: LayoutList },
]);

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
    logError(error, { operation: 'fetchDiscussions', view: 'DiscussionsView' });
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
    logError(error, { operation: 'fetchDiscussionInsights', view: 'DiscussionsView' });
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
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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
  <div class="discussion-page mobile-adaptive">
    <DiscussionHeader
      v-model:search-query="searchQuery"
      :title="t('community.discussions.title')"
      :subtitle="listSummary"
      :is-loading="isLoading"
      :is-insights-loading="isInsightsLoading"
      @refresh="refreshAll"
      @create="showCreateModal = true"
    />

    <main class="discussion-board">
      <section class="discussion-feed">
        <DiscussionFilterBar
          v-model:active-filter="activeFilter"
          v-model:sort-by="sortBy"
          v-model:view-mode="viewMode"
          :filters="filterOptions"
          :sort-options="sortOptions"
          :selected-sort-label="selectedSortLabel"
          :selected-tag="selectedTag"
          :has-active-filters="hasActiveFilters"
          :view-mode-options="viewModeOptions"
          @clear="clearFilters"
        />
        <DiscussionListPanel
          :discussions="discussions"
          :is-loading="isLoading"
          :current-user-id="currentUserId"
          :is-admin="isAdmin"
          :pagination="pagination"
          :view-mode="viewMode"
          @open="openDiscussion"
          @like="toggleLikeDiscussion"
          @pin="togglePinDiscussion"
          @delete="deleteDiscussion"
          @tag="setTag"
          @page-change="handlePageChange"
          @create="showCreateModal = true"
        />
      </section>

      <DiscussionSidebar
        :insights="insights"
        :tag-insights="tagInsights"
        :selected-tag="selectedTag"
        :hot-discussions="hotDiscussions"
        :top-contributors="topContributors"
        :recent-comments="recentComments"
        @tag-click="setTag"
        @open-discussion="openDiscussion"
      />
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

    <DiscussionCreateModal
      v-if="showCreateModal"
      v-model:show="showCreateModal"
      v-model:title="postForm.title"
      v-model:content="postForm.content"
      v-model:tags="postForm.tags"
      :selected-images="selectedImages"
      :image-previews="imagePreviews"
      :tag-insights="tagInsights"
      :starter-prompts="starterPrompts"
      @submit="handleCreateDiscussion"
      @reset="resetDraft"
      @apply-template="applyTemplate"
      @add-tag="addTagToDraft"
      @image-select="handleImageSelect"
      @remove-image="removeImage"
    />
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

.discussion-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 12px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

@media (max-width: 767px) {
  .discussion-board {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
}

.discussion-feed {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.discussion-feed::-webkit-scrollbar {
  display: none;
}
</style>

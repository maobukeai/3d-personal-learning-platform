<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Search,
  MessageSquare,
  Edit3,
  X,
  Plus,
  Heart,
  Eye,
  Pin,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  Tag,
  Flame,
  Clock,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import PageHeader from '@/components/PageHeader.vue';
import DiscussionCard from '@/components/DiscussionCard.vue';

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

interface DiscussionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface DiscussionCounts {
  likes: number;
  comments: number;
  replies: number;
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
  viewCount?: number;
  isPinned?: boolean;
  isLiked?: boolean;
  user: DiscussionUser;
  comments: DiscussionComment[];
  _count: DiscussionCounts;
}

const searchQuery = ref('');
const showCreateModal = ref(false);
const discussions = ref<Discussion[]>([]);
const isLoading = ref(false);
const sortBy = ref('newest');
const selectedTag = ref('');
const availableTags = ref<string[]>([]);

const sortOptions = [
  { value: 'newest', label: '最新发布', icon: Clock },
  { value: 'most_commented', label: '最多回复', icon: MessageSquare },
  { value: 'most_liked', label: '最多点赞', icon: Flame },
  { value: 'most_viewed', label: '最多浏览', icon: Eye },
];

const pagination = ref({
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
});

watch([searchQuery, sortBy, selectedTag], () => {
  pagination.value.page = 1;
  fetchDiscussions();
});

const postForm = ref({
  title: '',
  content: '',
  tags: '',
});

const selectedImages = ref<File[]>([]);
const imagePreviews = ref<string[]>([]);

const handleImageSelect = (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;

  if (selectedImages.value.length + files.length > 5) {
    ElMessage.warning('最多只能上传 5 张图片');
    return;
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    selectedImages.value.push(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreviews.value.push(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }
};

const removeImage = (index: number) => {
  selectedImages.value.splice(index, 1);
  imagePreviews.value.splice(index, 1);
};

const selectedDiscussion = ref<Discussion | null>(null);
const isDetailOpen = ref(false);
const newComment = ref('');
const isSubmittingComment = ref(false);
const replyingTo = ref<DiscussionComment | null>(null);
const replyContent = ref('');

const parseImages = (imagesStr: string | null) => {
  try {
    return imagesStr ? JSON.parse(imagesStr) : [];
  } catch (_e) {
    return [];
  }
};

const parseTags = (tagsStr: string | null) => {
  try {
    return tagsStr ? JSON.parse(tagsStr) : [];
  } catch (_e) {
    return [];
  }
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString();
};

const fetchDiscussions = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/discussions', {
      params: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        search: searchQuery.value,
        sort: sortBy.value,
        tag: selectedTag.value || undefined,
      },
    });
    discussions.value = response.data.discussions;
    pagination.value = response.data.pagination;
  } catch (error) {
    console.error('Fetch discussions error:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchTags = async () => {
  try {
    const response = await api.get('/api/discussions/tags');
    availableTags.value = response.data.tags;
  } catch (error) {
    console.error('Fetch tags error:', error);
  }
};

const handlePageChange = (page: number) => {
  pagination.value.page = page;
  fetchDiscussions();
};

const filteredDiscussions = computed(() => {
  return discussions.value;
});

const hotDiscussions = computed(() => {
  return [...discussions.value]
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 5);
});

const topContributors = computed(() => {
  const counts: Record<string, { user: DiscussionUser; count: number }> = {};
  discussions.value.forEach((d) => {
    if (d.user) {
      if (!counts[d.user.id]) {
        counts[d.user.id] = { user: d.user, count: 0 };
      }
      counts[d.user.id].count++;
    }
  });
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
});

const handleCreateDiscussion = async () => {
  if (!postForm.value.title || !postForm.value.content) {
    ElMessage.warning('请填写标题和内容');
    return;
  }

  const formData = new FormData();
  formData.append('title', postForm.value.title);
  formData.append('content', postForm.value.content);
  if (postForm.value.tags) {
    const tagsArray = postForm.value.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    formData.append('tags', JSON.stringify(tagsArray));
  }
  selectedImages.value.forEach((file) => {
    formData.append('images', file);
  });

  try {
    await api.post('/api/discussions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success('发布成功');
    showCreateModal.value = false;
    postForm.value = { title: '', content: '', tags: '' };
    selectedImages.value = [];
    imagePreviews.value = [];
    fetchDiscussions();
    fetchTags();
  } catch (_error) {
    ElMessage.error('发布失败');
  }
};

const openDiscussion = async (id: string) => {
  try {
    const response = await api.get(`/api/discussions/${id}`);
    selectedDiscussion.value = response.data;
    isDetailOpen.value = true;
    replyingTo.value = null;
    replyContent.value = '';
  } catch (_error) {
    ElMessage.error('无法加载讨论详情');
  }
};

const handleAddComment = async () => {
  if (!selectedDiscussion.value) return;
  if (!newComment.value.trim()) return;
  isSubmittingComment.value = true;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: selectedDiscussion.value.id,
      content: newComment.value,
    });
    if (!selectedDiscussion.value.comments) selectedDiscussion.value.comments = [];
    selectedDiscussion.value.comments.push(response.data);
    newComment.value = '';
    ElMessage.success('评论已发表');
    fetchDiscussions();
  } catch (_error) {
    ElMessage.error('发表评论失败');
  } finally {
    isSubmittingComment.value = false;
  }
};

const handleReplyComment = async (parentId: string) => {
  if (!selectedDiscussion.value) return;
  if (!replyContent.value.trim()) return;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: selectedDiscussion.value.id,
      content: replyContent.value,
      parentId,
    });
    const parentComment = selectedDiscussion.value.comments?.find((c) => c.id === parentId);
    if (parentComment) {
      if (!parentComment.replies) parentComment.replies = [];
      parentComment.replies.push(response.data);
      parentComment._count = {
        ...parentComment._count,
        replies: (parentComment._count?.replies || 0) + 1,
      };
    }
    replyContent.value = '';
    replyingTo.value = null;
    ElMessage.success('回复已发表');
    fetchDiscussions();
  } catch (_error) {
    ElMessage.error('回复失败');
  }
};

const toggleLikeDiscussion = async (discussion: Discussion, event?: Event) => {
  if (event) event.stopPropagation();
  try {
    const response = await api.post(`/api/discussions/${discussion.id}/like`);
    discussion.isLiked = response.data.isLiked;
    if (discussion._count) {
      discussion._count.likes = response.data.isLiked
        ? discussion._count.likes + 1
        : discussion._count.likes - 1;
    }
  } catch (_error) {
    ElMessage.error('操作失败');
  }
};

const toggleLikeComment = async (comment: DiscussionComment) => {
  try {
    const response = await api.post(`/api/discussions/comments/${comment.id}/like`);
    comment.isLiked = response.data.isLiked;
    if (comment._count) {
      comment._count.likes = response.data.isLiked
        ? comment._count.likes + 1
        : comment._count.likes - 1;
    }
  } catch (_error) {
    ElMessage.error('操作失败');
  }
};

const togglePinDiscussion = async (discussion: Discussion, event?: Event) => {
  if (event) event.stopPropagation();
  try {
    await api.post(`/api/discussions/${discussion.id}/pin`);
    discussion.isPinned = !discussion.isPinned;
    ElMessage.success(discussion.isPinned ? '已置顶' : '已取消置顶');
    fetchDiscussions();
  } catch (_error) {
    ElMessage.error('操作失败');
  }
};

const deleteDiscussion = async (discussion: Discussion, event?: Event) => {
  if (event) event.stopPropagation();
  try {
    await ElMessageBox.confirm('确定要删除这篇讨论吗？此操作不可撤销。', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/discussions/${discussion.id}`);
    ElMessage.success('已删除');
    if (isDetailOpen.value) {
      isDetailOpen.value = false;
    }
    fetchDiscussions();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const deleteComment = async (comment: DiscussionComment, parentComment?: DiscussionComment) => {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/discussions/comments/${comment.id}`);
    if (parentComment) {
      parentComment.replies = (parentComment.replies || []).filter((r) => r.id !== comment.id);
      parentComment._count = {
        ...parentComment._count,
        replies: (parentComment._count?.replies || 1) - 1,
      };
    } else {
      if (selectedDiscussion.value?.comments) {
        selectedDiscussion.value.comments = selectedDiscussion.value.comments.filter(
          (c) => c.id !== comment.id,
        );
      }
    }
    ElMessage.success('已删除');
    fetchDiscussions();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const expandedReplies = ref<Set<string>>(new Set());

const toggleReplies = (commentId: string) => {
  if (expandedReplies.value.has(commentId)) {
    expandedReplies.value.delete(commentId);
  } else {
    expandedReplies.value.add(commentId);
  }
};

onMounted(() => {
  fetchDiscussions();
  fetchTags();
});
</script>

<template>
  <div class="flex flex-col h-full" style="background-color: var(--bg-app)">
    <!-- Header -->
    <PageHeader
      title="交流社区"
      :subtitle="`${pagination.total} 篇`"
      :icon="MessageSquare"
    >
      <div class="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
        <div class="relative flex-1 md:flex-none">
          <Search
            class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--text-muted)"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索讨论..."
            class="pl-9 pr-4 py-1.5 border rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-full md:w-48 lg:w-60 transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <button type="button" class="hidden md:flex bg-accent hover:bg-accent text-white px-4 py-2 rounded-full text-sm font-medium items-center gap-2 transition-all active:scale-95 shadow-lg shadow-accent/20" @click="showCreateModal = true">
          <Edit3 class="w-4 h-4" /> 发起讨论
        </button>
        <button type="button" class="md:hidden bg-accent text-white p-2 rounded-full shadow-lg shadow-accent/20" @click="showCreateModal = true">
          <Edit3 class="w-4 h-4" />
        </button>
      </div>
    </PageHeader>

    <!-- Filter Bar -->
    <div
      class="px-4 sm:px-6 py-2.5 border-b flex items-center gap-3 overflow-x-auto scrollbar-hide shrink-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- Sort Options -->
      <div class="flex items-center gap-1 shrink-0">
        <button
v-for="opt in sortOptions" :key="opt.value" type="button" class="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap" :style="
            sortBy === opt.value
              ? 'background-color: var(--accent); color: white'
              : 'background-color: var(--bg-app); color: var(--text-secondary)'
          " @click="sortBy = opt.value">
          {{ opt.label }}
        </button>
      </div>

      <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-1"></div>

      <!-- Tags (Hidden on desktop sidebar but visible in mobile overflow bar) -->
      <div v-if="availableTags.length > 0" class="flex lg:hidden items-center gap-1.5 shrink-0">
        <Tag class="w-3 h-3" style="color: var(--text-muted)" />
        <button
type="button" class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap" :style="
            !selectedTag
              ? 'background-color: var(--accent); color: white'
              : 'background-color: var(--bg-app); color: var(--text-secondary)'
          " @click="selectedTag = ''">
          全部
        </button>
        <button
v-for="tag in availableTags" :key="tag" type="button" class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap" :style="
            selectedTag === tag
              ? 'background-color: var(--accent); color: white'
              : 'background-color: var(--bg-app); color: var(--text-secondary)'
          " @click="selectedTag = selectedTag === tag ? '' : tag">
          #{{ tag }}
        </button>
      </div>
    </div>


    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-3 sm:p-5 scrollbar-hide">
      <div class="max-w-none flex flex-col lg:flex-row gap-6">
        <!-- Left: Discussions List Feed -->
        <div class="flex-1 min-w-0 space-y-3.5">
          <div v-if="filteredDiscussions.length > 0" class="space-y-3">
            <DiscussionCard
              v-for="d in filteredDiscussions"
              :key="d.id"
              :discussion="d"
              :current-user-id="currentUserId"
              :is-admin="isAdmin"
              @click="openDiscussion"
              @like="toggleLikeDiscussion"
              @pin="togglePinDiscussion"
              @delete="deleteDiscussion"
            />
          </div>

          <!-- Empty State -->
          <div
            v-else
            class="h-64 flex flex-col items-center justify-center rounded-2xl border transition-colors duration-300"
            style="
              background-color: var(--bg-card);
              border-color: var(--border-base);
              color: var(--text-muted);
            "
          >
            <MessageSquare class="w-12 h-12 mb-4 opacity-10" />
            <p class="text-sm">暂无讨论内容</p>
            <p class="text-xs mt-1 opacity-60">点击右侧「发起讨论帖子」开始交流</p>
          </div>

          <!-- Pagination Footer -->
          <div v-if="pagination.totalPages > 1" class="py-6 flex justify-center">
            <el-pagination
              v-model:current-page="pagination.page"
              :page-size="pagination.limit"
              :total="pagination.total"
              layout="prev, pager, next"
              background
              @current-change="handlePageChange"
            />
          </div>
        </div>

        <!-- Right Sidebar -->
        <div class="w-full lg:w-80 shrink-0 space-y-4">
          <!-- Quick Action Card -->
          <div class="p-4 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl flex flex-col gap-3">
            <h4 class="text-xs font-black uppercase tracking-wider" style="color: var(--text-secondary)">交流互动</h4>
            <p class="text-xs leading-relaxed" style="color: var(--text-muted)">
              欢迎来到创作者交流社区！在这里分享您的 3D 渲染成品、建模心得、软件技术，与同行一起成长。
            </p>
            <button type="button" class="w-full bg-accent hover:bg-accent text-white py-2.5 rounded-xl text-xs font-bold items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-accent/20 flex cursor-pointer" @click="showCreateModal = true">
              <Edit3 class="w-4 h-4" /> 发起讨论帖子
            </button>
          </div>

          <!-- Hot Discussions Card -->
          <div v-if="hotDiscussions.length > 0" class="p-4 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider flex items-center gap-1.5" style="color: var(--text-secondary)">
              <Flame class="w-3.5 h-3.5 text-orange-500 fill-orange-500" /> 热门推荐帖子
            </h4>
            <div class="space-y-2.5">
              <div
                v-for="(hd, idx) in hotDiscussions"
                :key="hd.id"
                class="flex items-start gap-2 group cursor-pointer"
                @click="openDiscussion(hd.id)"
              >
                <span
                  class="text-xs font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px]"
                  :class="[
                    idx === 0 ? 'bg-amber-500 text-white' :
                    idx === 1 ? 'bg-slate-400 text-white' :
                    idx === 2 ? 'bg-amber-600 text-white' :
                    'bg-slate-100 dark:bg-white/5 text-slate-400'
                  ]"
                >
                  {{ idx + 1 }}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-bold truncate group-hover:text-accent transition-colors" style="color: var(--text-primary)">
                    {{ hd.title }}
                  </p>
                  <p class="text-[9px] flex items-center gap-2" style="color: var(--text-muted)">
                    <span>{{ hd.user?.name || '匿名' }}</span>
                    <span>{{ hd.viewCount || 0 }} 浏览</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Contributors Card -->
          <div v-if="topContributors.length > 0" class="p-4 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider" style="color: var(--text-secondary)">活跃创作者</h4>
            <div class="space-y-3">
              <div v-for="c in topContributors" :key="c.user.id" class="flex items-center gap-2.5">
                <UserAvatar :user="c.user" size="xs" />
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-bold truncate" style="color: var(--text-primary)">
                    {{ c.user.name || '匿名创作者' }}
                  </p>
                  <p class="text-[9px]" style="color: var(--text-muted)">
                    发表了 {{ c.count }} 篇讨论
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Popular Tags Card -->
          <div v-if="availableTags.length > 0" class="p-4 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider" style="color: var(--text-secondary)">热门话题标签</h4>
            <div class="flex flex-wrap gap-1.5">
              <button
v-for="tag in availableTags.slice(0, 15)" :key="tag" type="button" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:opacity-85" :style="
                  selectedTag === tag
                    ? 'background-color: var(--accent); color: white'
                    : 'background-color: var(--bg-app); color: var(--text-secondary); border: 1px solid var(--border-base)'
                " @click="selectedTag = selectedTag === tag ? '' : tag">
                #{{ tag }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Discussion Detail Modal -->
    <Transition name="fade">
      <div
        v-if="isDetailOpen && selectedDiscussion"
        class="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isDetailOpen = false"
        ></div>
        <div
          class="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl shadow-2xl overflow-hidden"
        >
          <!-- Modal Header -->
          <div
            class="p-2.5 sm:p-3 border-b flex items-center justify-between shrink-0"
            style="border-color: var(--border-base)"
          >
            <div class="flex items-center gap-2 sm:gap-2.5">
              <UserAvatar :user="selectedDiscussion.user" size="sm" />
              <div>
                <div class="flex items-center gap-1.5">
                  <p class="text-[11px] sm:text-xs font-bold" style="color: var(--text-primary)">
                    {{ selectedDiscussion.user?.name || '匿名用户' }}
                  </p>
                  <span
                    v-if="selectedDiscussion.isPinned"
                    class="px-1 py-0.2 rounded text-[7.5px] sm:text-[8px] font-bold"
                    style="background-color: var(--accent); color: white"
                    >置顶</span
                  >
                </div>
                <p class="text-[8.5px] sm:text-[9px]" style="color: var(--text-muted)">
                  {{ formatTime(selectedDiscussion.createdAt) }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button v-if="isAdmin" type="button" class="p-1 sm:p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" style="color: var(--text-secondary)" @click="togglePinDiscussion(selectedDiscussion)">
                <Pin class="w-3 h-3 sm:w-3.5 sm:h-3.5" :class="{ 'text-accent': selectedDiscussion.isPinned }" />
              </button>
              <button v-if="currentUserId === selectedDiscussion.user?.id || isAdmin" type="button" class="p-1 sm:p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" style="color: var(--text-secondary)" @click="deleteDiscussion(selectedDiscussion)">
                <Trash2 class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
              <button type="button" class="p-1 sm:p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" style="color: var(--text-secondary)" @click="isDetailOpen = false">
                <X class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          <!-- Modal Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-3.5 sm:p-4.5 scrollbar-hide">
            <h2 class="text-base sm:text-lg font-black mb-2 sm:mb-2.5 leading-tight" style="color: var(--text-primary)">
              {{ selectedDiscussion.title }}
            </h2>

            <!-- Tags -->
            <div
              v-if="parseTags(selectedDiscussion.tags).length > 0"
              class="flex flex-wrap gap-1 mb-2"
            >
              <span
                v-for="tag in parseTags(selectedDiscussion.tags)"
                :key="tag"
                class="px-1.5 py-0.2 rounded-full text-[8.5px] sm:text-[9.5px] font-medium"
                style="background-color: var(--bg-app); color: var(--accent)"
                >#{{ tag }}</span
              >
            </div>

            <!-- Stats Bar -->
            <div
              class="flex items-center gap-3.5 sm:gap-4 mb-3 sm:mb-3.5 pb-2 border-b"
              style="border-color: var(--border-base)"
            >
              <button type="button" class="flex items-center gap-1 text-[9.5px] sm:text-[11px] font-bold transition-colors cursor-pointer" :class="selectedDiscussion.isLiked ? 'text-red-500' : ''" :style="!selectedDiscussion.isLiked ? 'color: var(--text-muted)' : ''" @click="toggleLikeDiscussion(selectedDiscussion)">
                <Heart class="w-3 h-3 sm:w-3.5 sm:h-3.5" :class="{ 'fill-red-500': selectedDiscussion.isLiked }" />
                {{ selectedDiscussion._count?.likes || 0 }} <span class="hidden sm:inline">赞</span>
              </button>
              <div
                class="flex items-center gap-1 text-[9.5px] sm:text-[11px] font-bold"
                style="color: var(--text-muted)"
              >
                <MessageSquare class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {{ selectedDiscussion._count?.comments || 0 }} <span class="hidden sm:inline">回复</span>
              </div>
              <div
                class="flex items-center gap-1 text-[9.5px] sm:text-[11px] font-bold"
                style="color: var(--text-muted)"
              >
                <Eye class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {{ selectedDiscussion.viewCount || 0 }} <span class="hidden sm:inline">浏览</span>
              </div>
            </div>

            <div class="mb-3.5 sm:mb-4 text-xs leading-relaxed">
              <MarkdownEditor :model-value="selectedDiscussion.content" preview-only />
            </div>

            <!-- Post Images (Dynamic Compact Grid Layout) -->
            <div
              v-if="parseImages(selectedDiscussion.images).length > 0"
              class="grid gap-2 mb-4 sm:mb-5"
              :class="[
                parseImages(selectedDiscussion.images).length === 1 ? 'grid-cols-1 max-w-lg' :
                parseImages(selectedDiscussion.images).length === 2 ? 'grid-cols-2' : 'grid-cols-3'
              ]"
            >
              <img v-for="(img, idx) in parseImages(selectedDiscussion.images)" :key="idx" alt="" :src="img" class="w-full h-28 sm:h-36 object-cover rounded-lg shadow-sm border border-slate-100 dark:border-white/5" />
            </div>

            <!-- Comments Section -->
            <div class="space-y-3">
              <div
                class="flex items-center gap-1.5 border-b pb-1.5 sm:pb-2"
                style="border-color: var(--border-base)"
              >
                <MessageSquare class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />
                <h3 class="text-[9.5px] sm:text-[10.5px] font-black uppercase tracking-widest">
                  全部回复 ({{ selectedDiscussion.comments?.length || 0 }})
                </h3>
              </div>

              <div
                v-for="comment in selectedDiscussion.comments"
                :key="comment.id"
                class="space-y-2"
              >
                <!-- Main Comment -->
                <div class="flex gap-2">
                  <UserAvatar :user="comment.user" size="xs" class="shrink-0" />
                  <div class="flex-1">
                    <div class="p-2 sm:p-2.5 rounded-lg" style="background-color: var(--bg-app)">
                      <div class="flex items-center justify-between mb-0.5">
                        <span class="text-[11px] font-bold" style="color: var(--text-primary)">{{
                          comment.user?.name || '匿名用户'
                        }}</span>
                        <span class="text-[8.5px]" style="color: var(--text-muted)">{{
                          formatTime(comment.createdAt)
                        }}</span>
                      </div>
                      <div class="text-[10.5px] sm:text-xs leading-relaxed whitespace-pre-wrap" style="color: var(--text-secondary)">
                        {{ comment.content }}
                      </div>
                    </div>
                    <!-- Comment Actions -->
                    <div class="flex items-center gap-3.5 mt-1 ml-1.5">
                      <button type="button" class="flex items-center gap-0.5 text-[9px] font-medium transition-colors cursor-pointer" :class="comment.isLiked ? 'text-red-500' : ''" :style="!comment.isLiked ? 'color: var(--text-muted)' : ''" @click="toggleLikeComment(comment)">
                        <Heart class="w-2.5 h-2.5" :class="{ 'fill-red-500': comment.isLiked }" />
                        {{ comment._count?.likes || 0 }}
                      </button>
                      <button
type="button" class="flex items-center gap-0.5 text-[9px] font-medium transition-colors hover:text-accent cursor-pointer" style="color: var(--text-muted)" @click="
                          replyingTo = replyingTo?.id === comment.id ? null : comment;
                          replyContent = '';
                        ">
                        <MessageSquare class="w-2.5 h-2.5" /> 回复
                      </button>
                      <button v-if="currentUserId === comment.user?.id || isAdmin" type="button" class="flex items-center gap-0.5 text-[9px] font-medium transition-colors hover:text-red-500 cursor-pointer" style="color: var(--text-muted)" @click="deleteComment(comment)">
                        <Trash2 class="w-2.5 h-2.5" /> 删除
                      </button>
                    </div>

                    <!-- Reply Input -->
                    <div v-if="replyingTo?.id === comment.id" class="mt-2 ml-1.5 space-y-1.5">
                      <textarea
                        v-model="replyContent"
                        class="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                        rows="2"
                        :placeholder="`回复 ${comment.user?.name || '匿名用户'}...`"
                      ></textarea>
                      <div class="flex justify-end gap-1.5">
                        <button type="button" class="px-2.5 py-1 rounded-xl text-[9px] transition-all font-bold cursor-pointer" style="color: var(--text-muted)" @click="replyingTo = null">
                          取消
                        </button>
                        <button type="button" :disabled="!replyContent" class="px-3 py-1 bg-accent text-white font-bold rounded-xl text-[9px] shadow-md shadow-accent/10 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer" @click="handleReplyComment(comment.id)">
                          <Send class="w-2 h-2" /> 发表回复
                        </button>
                      </div>
                    </div>

                    <!-- Show Replies Toggle -->
                    <button
v-if="
                        comment._count?.replies > 0 &&
                        (!comment.replies ||
                          comment.replies.length === 0 ||
                          !expandedReplies.has(comment.id))
                      " type="button" class="mt-1 ml-1.5 flex items-center gap-0.5 text-[9px] font-bold text-accent hover:underline cursor-pointer" @click="toggleReplies(comment.id)">
                      <ChevronDown class="w-2.5 h-2.5" /> 查看 {{ comment._count?.replies }} 条回复
                    </button>
                    <button v-if="expandedReplies.has(comment.id) && comment._count?.replies > 0" type="button" class="mt-1 ml-1.5 flex items-center gap-0.5 text-[9px] font-bold text-accent hover:underline cursor-pointer" @click="toggleReplies(comment.id)">
                      <ChevronUp class="w-2.5 h-2.5" /> 收起回复
                    </button>

                    <!-- Nested Replies -->
                    <div
                      v-if="expandedReplies.has(comment.id) && comment.replies?.length > 0"
                      class="mt-2 ml-3.5 space-y-2 border-l pl-2"
                      style="border-color: var(--border-base)"
                    >
                      <div v-for="reply in comment.replies" :key="reply.id" class="flex gap-2">
                        <UserAvatar :user="reply.user" size="xs" class="shrink-0" />
                        <div class="flex-1">
                          <div class="p-1.5 sm:p-2 rounded-md" style="background-color: var(--bg-app)">
                            <div class="flex items-center justify-between mb-0.5">
                              <span
                                class="text-[9.5px] font-bold"
                                style="color: var(--text-primary)"
                                >{{ reply.user?.name || '匿名用户' }}</span
                              >
                              <span class="text-[7.5px]" style="color: var(--text-muted)">{{
                                formatTime(reply.createdAt)
                              }}</span>
                            </div>
                            <div
                              class="text-[9.5px] leading-relaxed whitespace-pre-wrap"
                              style="color: var(--text-secondary)"
                            >
                              {{ reply.content }}
                            </div>
                          </div>
                          <div class="flex items-center gap-2.5 mt-0.5 ml-0.5">
                            <button type="button" class="flex items-center gap-0.5 text-[8.5px] font-medium transition-colors cursor-pointer" :class="reply.isLiked ? 'text-red-500' : ''" :style="!reply.isLiked ? 'color: var(--text-muted)' : ''" @click="toggleLikeComment(reply)">
                              <Heart
                                class="w-2 h-2"
                                :class="{ 'fill-red-500': reply.isLiked }"
                              />
                              {{ reply._count?.likes || 0 }}
                            </button>
                            <button v-if="currentUserId === reply.user?.id || isAdmin" type="button" class="flex items-center gap-0.5 text-[8.5px] font-medium transition-colors hover:text-red-500 cursor-pointer" style="color: var(--text-muted)" @click="deleteComment(reply, comment)">
                              <Trash2 class="w-2 h-2" /> 删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Comment Input Footer -->
          <div
            class="p-2.5 border-t shrink-0"
            style="border-color: var(--border-base); background-color: var(--bg-card)"
          >
            <div class="flex gap-2">
              <UserAvatar :user="authStore.user" size="sm" class="shrink-0" />
              <div class="flex-1 space-y-1.5">
                <textarea
                  v-model="newComment"
                  class="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  rows="3"
                  placeholder="撰写你的回复..."
                ></textarea>
                <div class="flex justify-end">
                  <button type="button" :disabled="!newComment || isSubmittingComment" class="px-3.5 py-1 bg-accent text-white font-bold rounded-xl text-xs shadow-lg shadow-accent/20 disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer" @click="handleAddComment">
                    <Send class="w-3 h-3" /> 发表回复
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Create Post Modal -->
    <Transition name="fade">
      <div v-if="showCreateModal" class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showCreateModal = false"
        ></div>
        <div
          class="relative w-full max-w-2xl lg:max-w-5xl max-h-[90vh] p-4 sm:p-6 rounded-2xl shadow-2xl space-y-4 overflow-y-auto scrollbar-hide"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between pb-1">
            <h3 class="text-md sm:text-lg font-black" style="color: var(--text-primary)">发布新讨论</h3>
            <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-secondary)" @click="showCreateModal = false">
              <X class="w-4 h-4 sm:w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3.5">
            <div>
              <label
                class="block text-[10px] font-black uppercase mb-1.5 ml-1 tracking-wider"
                style="color: var(--text-secondary)"
                >标题</label
              >
              <input
                v-model="postForm.title"
                type="text"
                class="w-full px-3.5 py-2 sm:py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-bold"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="给讨论起个标题"
              />
            </div>

            <div>
              <label
                class="block text-[10px] font-black uppercase mb-1.5 ml-1 tracking-wider"
                style="color: var(--text-secondary)"
                >内容</label
              >
              <MarkdownEditor
                v-model="postForm.content"
                height="400px"
                class="h-[200px] sm:h-[400px]"
                placeholder="你想说点什么？支持 Markdown 格式..."
              />
            </div>

            <!-- Tags Input -->
            <div>
              <label
                class="block text-[10px] font-black uppercase mb-1.5 ml-1 tracking-wider"
                style="color: var(--text-secondary)"
                >标签 (用逗号分隔)</label
              >
              <input
                v-model="postForm.tags"
                type="text"
                class="w-full px-3.5 py-2 sm:py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="例如: 技术, 3D建模, Blender"
              />
              <div v-if="availableTags.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                <span class="text-[9px] font-bold" style="color: var(--text-muted)"
                  >热门标签:</span
                >
                <button v-for="tag in availableTags.slice(0, 8)" :key="tag" type="button" class="px-2 py-0.5 rounded-full text-[9px] font-bold hover:opacity-80 transition-opacity" style="background-color: var(--bg-app); color: var(--accent)" @click="postForm.tags = postForm.tags ? `${postForm.tags}, ${tag}` : tag">
                  #{{ tag }}
                </button>
              </div>
            </div>

            <!-- Image Upload Section -->
            <div>
              <label
                class="block text-[10px] font-black uppercase mb-2 ml-1 tracking-wider"
                style="color: var(--text-secondary)"
                >图片 (最多 5 张)</label
              >
              <div class="flex flex-wrap gap-2.5">
                <div
                  v-for="(img, idx) in imagePreviews"
                  :key="idx"
                  class="relative w-16 h-16 rounded-lg overflow-hidden group border"
                  style="border-color: var(--border-base)"
                >
                  <img alt="" :src="img" class="w-full h-full object-cover" />
                  <button type="button" class="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" @click="removeImage(idx)">
                    <X class="w-2.5 h-2.5" />
                  </button>
                </div>
                <label
                  v-if="imagePreviews.length < 5"
                  class="w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all shrink-0"
                  style="border-color: var(--border-base)"
                >
                  <Plus class="w-4 h-4" style="color: var(--text-muted)" />
                  <span class="text-[9px] mt-0.5" style="color: var(--text-muted)">上传图片</span>
                  <input
                    type="file"
                    class="hidden"
                    accept="image/*"
                    multiple
                    @change="handleImageSelect"
                  />
                </label>
              </div>
            </div>
          </div>

          <div class="pt-2">
            <button type="button" class="w-full py-2.5 sm:py-3 bg-accent text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all flex items-center justify-center gap-2 cursor-pointer" @click="handleCreateDiscussion">
              <Send class="w-3.5 h-3.5" /> 立即发布
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Deep overrides to compact MarkdownEditor text rendering in comments and replies */
:deep(.comment-markdown .md-editor-preview),
:deep(.comment-markdown .md-preview-custom) {
  font-size: 12.5px !important;
  line-height: 1.5 !important;
  color: var(--text-secondary) !important;
}
:deep(.comment-markdown p) {
  margin-top: 2px !important;
  margin-bottom: 2px !important;
}
:deep(.reply-markdown .md-editor-preview),
:deep(.reply-markdown .md-preview-custom) {
  font-size: 11.5px !important;
  line-height: 1.4 !important;
  color: var(--text-secondary) !important;
}
:deep(.reply-markdown p) {
  margin-top: 1px !important;
  margin-bottom: 1px !important;
}
</style>

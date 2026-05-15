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

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

const searchQuery = ref('');
const showCreateModal = ref(false);
const discussions = ref<any[]>([]);
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

const selectedDiscussion = ref<any>(null);
const isDetailOpen = ref(false);
const newComment = ref('');
const isSubmittingComment = ref(false);
const replyingTo = ref<any>(null);
const replyContent = ref('');

const parseImages = (imagesStr: string) => {
  try {
    return imagesStr ? JSON.parse(imagesStr) : [];
  } catch (e) {
    return [];
  }
};

const parseTags = (tagsStr: string | null) => {
  try {
    return tagsStr ? JSON.parse(tagsStr) : [];
  } catch (e) {
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
  } catch (error) {
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
  } catch (error) {
    ElMessage.error('无法加载讨论详情');
  }
};

const handleAddComment = async () => {
  if (!newComment.value.trim()) return;
  isSubmittingComment.value = true;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: selectedDiscussion.value.id,
      content: newComment.value,
    });
    selectedDiscussion.value.comments.push(response.data);
    newComment.value = '';
    ElMessage.success('评论已发表');
    fetchDiscussions();
  } catch (error) {
    ElMessage.error('发表评论失败');
  } finally {
    isSubmittingComment.value = false;
  }
};

const handleReplyComment = async (parentId: string) => {
  if (!replyContent.value.trim()) return;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: selectedDiscussion.value.id,
      content: replyContent.value,
      parentId,
    });
    const parentComment = selectedDiscussion.value.comments.find((c: any) => c.id === parentId);
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
  } catch (error) {
    ElMessage.error('回复失败');
  }
};

const toggleLikeDiscussion = async (discussion: any, event?: Event) => {
  if (event) event.stopPropagation();
  try {
    const response = await api.post(`/api/discussions/${discussion.id}/like`);
    discussion.isLiked = response.data.isLiked;
    if (discussion._count) {
      discussion._count.likes = response.data.isLiked
        ? discussion._count.likes + 1
        : discussion._count.likes - 1;
    }
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

const toggleLikeComment = async (comment: any) => {
  try {
    const response = await api.post(`/api/discussions/comments/${comment.id}/like`);
    comment.isLiked = response.data.isLiked;
    if (comment._count) {
      comment._count.likes = response.data.isLiked
        ? comment._count.likes + 1
        : comment._count.likes - 1;
    }
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

const togglePinDiscussion = async (discussion: any, event?: Event) => {
  if (event) event.stopPropagation();
  try {
    await api.post(`/api/discussions/${discussion.id}/pin`);
    discussion.isPinned = !discussion.isPinned;
    ElMessage.success(discussion.isPinned ? '已置顶' : '已取消置顶');
    fetchDiscussions();
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

const deleteDiscussion = async (discussion: any, event?: Event) => {
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

const deleteComment = async (comment: any, parentComment?: any) => {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/discussions/comments/${comment.id}`);
    if (parentComment) {
      parentComment.replies = parentComment.replies.filter((r: any) => r.id !== comment.id);
      parentComment._count = {
        ...parentComment._count,
        replies: (parentComment._count?.replies || 1) - 1,
      };
    } else {
      selectedDiscussion.value.comments = selectedDiscussion.value.comments.filter(
        (c: any) => c.id !== comment.id,
      );
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
    <div
      class="border-b flex items-center justify-between px-6 py-4 shrink-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-semibold" style="color: var(--text-primary)">交流社区</h1>
        <span
          class="text-xs px-2.5 py-1 rounded-full font-medium"
          style="background-color: var(--bg-app); color: var(--text-muted)"
          >{{ pagination.total }} 篇讨论</span
        >
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <Search
            class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--text-muted)"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索讨论..."
            class="pl-9 pr-4 py-2 border rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-48 md:w-60 transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <button
          class="bg-accent hover:bg-accent text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-accent/20"
          @click="showCreateModal = true"
        >
          <Edit3 class="w-4 h-4" /> 发起讨论
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div
      class="px-6 py-3 border-b flex items-center gap-3 flex-wrap shrink-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- Sort Options -->
      <div class="flex items-center gap-1 mr-2">
        <button
          v-for="opt in sortOptions"
          :key="opt.value"
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          :style="
            sortBy === opt.value
              ? 'background-color: var(--accent); color: white'
              : 'background-color: var(--bg-app); color: var(--text-secondary)'
          "
          @click="sortBy = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- Tags -->
      <div v-if="availableTags.length > 0" class="flex items-center gap-1.5 ml-2">
        <Tag class="w-3.5 h-3.5" style="color: var(--text-muted)" />
        <button
          class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
          :style="
            !selectedTag
              ? 'background-color: var(--accent); color: white'
              : 'background-color: var(--bg-app); color: var(--text-secondary)'
          "
          @click="selectedTag = ''"
        >
          全部
        </button>
        <button
          v-for="tag in availableTags"
          :key="tag"
          class="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
          :style="
            selectedTag === tag
              ? 'background-color: var(--accent); color: white'
              : 'background-color: var(--bg-app); color: var(--text-secondary)'
          "
          @click="selectedTag = selectedTag === tag ? '' : tag"
        >
          #{{ tag }}
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-6 scrollbar-hide">
      <div class="max-w-4xl mx-auto space-y-3">
        <div v-if="filteredDiscussions.length > 0" class="space-y-3">
          <div
            v-for="d in filteredDiscussions"
            :key="d.id"
            class="group p-5 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer relative"
            :style="
              d.isPinned
                ? 'background-color: var(--bg-card); border-color: var(--accent); border-width: 1.5px'
                : 'background-color: var(--bg-card); border-color: var(--border-base)'
            "
            @click="openDiscussion(d.id)"
          >
            <!-- Pinned Badge -->
            <div
              v-if="d.isPinned"
              class="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style="background-color: var(--accent); color: white"
            >
              <Pin class="w-3 h-3" /> 置顶
            </div>

            <div class="flex gap-4">
              <UserAvatar :user="d.user" size="md" class="shrink-0" />

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-sm font-bold" style="color: var(--text-primary)">{{
                    d.user?.name || '匿名用户'
                  }}</span>
                  <span class="text-[11px]" style="color: var(--text-muted)">{{
                    formatTime(d.createdAt)
                  }}</span>
                </div>

                <h3
                  class="text-base font-bold mb-1.5 group-hover:text-accent transition-colors pr-16"
                >
                  {{ d.title }}
                </h3>
                <p class="text-sm line-clamp-2 mb-3" style="color: var(--text-secondary)">
                  {{ d.content }}
                </p>

                <!-- Tags -->
                <div v-if="parseTags(d.tags).length > 0" class="flex flex-wrap gap-1.5 mb-3">
                  <span
                    v-for="tag in parseTags(d.tags)"
                    :key="tag"
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style="background-color: var(--bg-app); color: var(--accent)"
                    >#{{ tag }}</span
                  >
                </div>

                <!-- Image Preview in List -->
                <div
                  v-if="parseImages(d.images).length > 0"
                  class="flex gap-2 mb-3 overflow-hidden h-20"
                >
                  <div
                    v-for="(img, idx) in parseImages(d.images).slice(0, 3)"
                    :key="idx"
                    class="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-slate-100 dark:border-white/5"
                  >
                    <img :src="img" class="w-full h-full object-cover" />
                  </div>
                  <div
                    v-if="parseImages(d.images).length > 3"
                    class="w-20 h-20 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-slate-400"
                  >
                    +{{ parseImages(d.images).length - 3 }}
                  </div>
                </div>

                <div
                  class="flex items-center gap-5 text-[11px] font-bold"
                  style="color: var(--text-muted)"
                >
                  <button
                    class="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                    :class="{ 'text-red-500': d.isLiked }"
                    @click.stop="toggleLikeDiscussion(d)"
                  >
                    <Heart class="w-3.5 h-3.5" :class="{ 'fill-red-500': d.isLiked }" />
                    <span>{{ d._count?.likes || 0 }}</span>
                  </button>
                  <div class="flex items-center gap-1.5">
                    <MessageSquare class="w-3.5 h-3.5" />
                    <span>{{ d._count?.comments || 0 }}</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <Eye class="w-3.5 h-3.5" />
                    <span>{{ d.viewCount || 0 }}</span>
                  </div>
                  <!-- Admin/Owner Actions -->
                  <div
                    v-if="currentUserId === d.user?.id || isAdmin"
                    class="flex items-center gap-2 ml-auto"
                  >
                    <button
                      v-if="isAdmin"
                      class="hover:text-accent transition-colors flex items-center gap-1"
                      @click.stop="togglePinDiscussion(d)"
                    >
                      <Pin class="w-3.5 h-3.5" />
                    </button>
                    <button
                      class="hover:text-red-500 transition-colors flex items-center gap-1"
                      @click.stop="deleteDiscussion(d)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
          <p class="text-xs mt-1 opacity-60">点击右上角「发起讨论」开始交流</p>
        </div>

        <!-- Pagination Footer -->
        <div v-if="pagination.totalPages > 1" class="py-8 flex justify-center">
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
    </div>

    <!-- Discussion Detail Modal -->
    <Transition name="fade">
      <div
        v-if="isDetailOpen && selectedDiscussion"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isDetailOpen = false"
        ></div>
        <div
          class="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden"
          style="background-color: var(--bg-card)"
        >
          <!-- Modal Header -->
          <div
            class="p-5 border-b flex items-center justify-between shrink-0"
            style="border-color: var(--border-base)"
          >
            <div class="flex items-center gap-3">
              <UserAvatar :user="selectedDiscussion.user" size="sm" />
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-xs font-bold" style="color: var(--text-primary)">
                    {{ selectedDiscussion.user?.name || '匿名用户' }}
                  </p>
                  <span
                    v-if="selectedDiscussion.isPinned"
                    class="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style="background-color: var(--accent); color: white"
                    >置顶</span
                  >
                </div>
                <p class="text-[10px]" style="color: var(--text-muted)">
                  {{ formatTime(selectedDiscussion.createdAt) }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="isAdmin"
                class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style="color: var(--text-secondary)"
                @click="togglePinDiscussion(selectedDiscussion)"
              >
                <Pin class="w-4 h-4" :class="{ 'text-accent': selectedDiscussion.isPinned }" />
              </button>
              <button
                v-if="currentUserId === selectedDiscussion.user?.id || isAdmin"
                class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style="color: var(--text-secondary)"
                @click="deleteDiscussion(selectedDiscussion)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
              <button
                class="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style="color: var(--text-secondary)"
                @click="isDetailOpen = false"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Modal Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
            <h2 class="text-2xl font-black mb-4" style="color: var(--text-primary)">
              {{ selectedDiscussion.title }}
            </h2>

            <!-- Tags -->
            <div
              v-if="parseTags(selectedDiscussion.tags).length > 0"
              class="flex flex-wrap gap-1.5 mb-4"
            >
              <span
                v-for="tag in parseTags(selectedDiscussion.tags)"
                :key="tag"
                class="px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                style="background-color: var(--bg-app); color: var(--accent)"
                >#{{ tag }}</span
              >
            </div>

            <!-- Stats Bar -->
            <div
              class="flex items-center gap-5 mb-6 pb-4 border-b"
              style="border-color: var(--border-base)"
            >
              <button
                class="flex items-center gap-1.5 text-xs font-bold transition-colors"
                :class="selectedDiscussion.isLiked ? 'text-red-500' : ''"
                :style="!selectedDiscussion.isLiked ? 'color: var(--text-muted)' : ''"
                @click="toggleLikeDiscussion(selectedDiscussion)"
              >
                <Heart class="w-4 h-4" :class="{ 'fill-red-500': selectedDiscussion.isLiked }" />
                {{ selectedDiscussion._count?.likes || 0 }} 赞
              </button>
              <div
                class="flex items-center gap-1.5 text-xs font-bold"
                style="color: var(--text-muted)"
              >
                <MessageSquare class="w-4 h-4" />
                {{ selectedDiscussion._count?.comments || 0 }} 回复
              </div>
              <div
                class="flex items-center gap-1.5 text-xs font-bold"
                style="color: var(--text-muted)"
              >
                <Eye class="w-4 h-4" />
                {{ selectedDiscussion.viewCount || 0 }} 浏览
              </div>
            </div>

            <div class="mb-8">
              <MarkdownEditor :model-value="selectedDiscussion.content" preview-only />
            </div>

            <!-- Post Images -->
            <div
              v-if="parseImages(selectedDiscussion.images).length > 0"
              class="grid grid-cols-1 gap-4 mb-10"
            >
              <img
                v-for="(img, idx) in parseImages(selectedDiscussion.images)"
                :key="idx"
                :src="img"
                class="w-full rounded-2xl shadow-sm border border-slate-100 dark:border-white/5"
              />
            </div>

            <!-- Comments Section -->
            <div class="space-y-6">
              <div
                class="flex items-center gap-2 border-b pb-4"
                style="border-color: var(--border-base)"
              >
                <MessageSquare class="w-4 h-4 text-accent" />
                <h3 class="text-sm font-black uppercase tracking-widest">
                  全部回复 ({{ selectedDiscussion.comments?.length || 0 }})
                </h3>
              </div>

              <div
                v-for="comment in selectedDiscussion.comments"
                :key="comment.id"
                class="space-y-3"
              >
                <!-- Main Comment -->
                <div class="flex gap-3">
                  <UserAvatar :user="comment.user" size="sm" class="shrink-0" />
                  <div class="flex-1">
                    <div class="p-3.5 rounded-2xl" style="background-color: var(--bg-app)">
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                          comment.user?.name || '匿名用户'
                        }}</span>
                        <span class="text-[10px]" style="color: var(--text-muted)">{{
                          formatTime(comment.createdAt)
                        }}</span>
                      </div>
                      <div class="text-sm leading-relaxed" style="color: var(--text-secondary)">
                        <MarkdownEditor :model-value="comment.content" preview-only />
                      </div>
                    </div>
                    <!-- Comment Actions -->
                    <div class="flex items-center gap-4 mt-1.5 ml-2">
                      <button
                        class="flex items-center gap-1 text-[11px] font-medium transition-colors"
                        :class="comment.isLiked ? 'text-red-500' : ''"
                        :style="!comment.isLiked ? 'color: var(--text-muted)' : ''"
                        @click="toggleLikeComment(comment)"
                      >
                        <Heart class="w-3 h-3" :class="{ 'fill-red-500': comment.isLiked }" />
                        {{ comment._count?.likes || 0 }}
                      </button>
                      <button
                        class="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-accent"
                        style="color: var(--text-muted)"
                        @click="
                          replyingTo = replyingTo?.id === comment.id ? null : comment;
                          replyContent = '';
                        "
                      >
                        <MessageSquare class="w-3 h-3" /> 回复
                      </button>
                      <button
                        v-if="currentUserId === comment.user?.id || isAdmin"
                        class="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-red-500"
                        style="color: var(--text-muted)"
                        @click="deleteComment(comment)"
                      >
                        <Trash2 class="w-3 h-3" /> 删除
                      </button>
                    </div>

                    <!-- Reply Input -->
                    <div v-if="replyingTo?.id === comment.id" class="mt-3 ml-2 space-y-2">
                      <MarkdownEditor
                        v-model="replyContent"
                        height="120px"
                        :placeholder="`回复 ${comment.user?.name || '匿名用户'}...`"
                      />
                      <div class="flex justify-end gap-2">
                        <button
                          class="px-3 py-1.5 rounded-xl text-xs transition-all font-bold"
                          style="color: var(--text-muted)"
                          @click="replyingTo = null"
                        >
                          取消
                        </button>
                        <button
                          :disabled="!replyContent"
                          class="px-4 py-1.5 bg-accent text-white font-bold rounded-xl text-xs shadow-md shadow-accent/10 disabled:opacity-50 transition-all flex items-center gap-1.5"
                          @click="handleReplyComment(comment.id)"
                        >
                          <Send class="w-3 h-3" /> 发表回复
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
                      "
                      class="mt-2 ml-2 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                      @click="toggleReplies(comment.id)"
                    >
                      <ChevronDown class="w-3 h-3" /> 查看 {{ comment._count?.replies }} 条回复
                    </button>
                    <button
                      v-if="expandedReplies.has(comment.id) && comment._count?.replies > 0"
                      class="mt-2 ml-2 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                      @click="toggleReplies(comment.id)"
                    >
                      <ChevronUp class="w-3 h-3" /> 收起回复
                    </button>

                    <!-- Nested Replies -->
                    <div
                      v-if="expandedReplies.has(comment.id) && comment.replies?.length > 0"
                      class="mt-3 ml-4 space-y-3 border-l-2 pl-4"
                      style="border-color: var(--border-base)"
                    >
                      <div v-for="reply in comment.replies" :key="reply.id" class="flex gap-2.5">
                        <UserAvatar :user="reply.user" size="sm" class="shrink-0" />
                        <div class="flex-1">
                          <div class="p-2.5 rounded-xl" style="background-color: var(--bg-app)">
                            <div class="flex items-center justify-between mb-1">
                              <span
                                class="text-[11px] font-bold"
                                style="color: var(--text-primary)"
                                >{{ reply.user?.name || '匿名用户' }}</span
                              >
                              <span class="text-[9px]" style="color: var(--text-muted)">{{
                                formatTime(reply.createdAt)
                              }}</span>
                            </div>
                            <div
                              class="text-xs leading-relaxed"
                              style="color: var(--text-secondary)"
                            >
                              <MarkdownEditor :model-value="reply.content" preview-only />
                            </div>
                          </div>
                          <div class="flex items-center gap-3 mt-1 ml-1">
                            <button
                              class="flex items-center gap-1 text-[10px] font-medium transition-colors"
                              :class="reply.isLiked ? 'text-red-500' : ''"
                              :style="!reply.isLiked ? 'color: var(--text-muted)' : ''"
                              @click="toggleLikeComment(reply)"
                            >
                              <Heart
                                class="w-2.5 h-2.5"
                                :class="{ 'fill-red-500': reply.isLiked }"
                              />
                              {{ reply._count?.likes || 0 }}
                            </button>
                            <button
                              v-if="currentUserId === reply.user?.id || isAdmin"
                              class="flex items-center gap-1 text-[10px] font-medium transition-colors hover:text-red-500"
                              style="color: var(--text-muted)"
                              @click="deleteComment(reply, comment)"
                            >
                              <Trash2 class="w-2.5 h-2.5" /> 删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="!selectedDiscussion.comments?.length"
                class="py-8 text-center text-sm italic"
                style="color: var(--text-muted)"
              >
                暂无回复，快来抢沙发吧！
              </div>
            </div>
          </div>

          <!-- Comment Input Footer -->
          <div
            class="p-4 border-t shrink-0"
            style="border-color: var(--border-base); background-color: var(--bg-card)"
          >
            <div class="flex gap-3">
              <UserAvatar :user="authStore.user" size="sm" class="shrink-0" />
              <div class="flex-1 space-y-3">
                <MarkdownEditor
                  v-model="newComment"
                  height="150px"
                  placeholder="撰写你的回复...支持 Markdown 格式"
                />
                <div class="flex justify-end">
                  <button
                    :disabled="!newComment || isSubmittingComment"
                    class="px-5 py-2 bg-accent text-white font-bold rounded-xl text-sm shadow-lg shadow-accent/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                    @click="handleAddComment"
                  >
                    <Send class="w-3.5 h-3.5" /> 发表回复
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
      <div v-if="showCreateModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showCreateModal = false"
        ></div>
        <div
          class="relative w-full max-w-[80vw] max-h-[90vh] p-8 rounded-3xl shadow-2xl space-y-5 overflow-y-auto scrollbar-hide"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">发布新讨论</h3>
            <button style="color: var(--text-secondary)" @click="showCreateModal = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >标题</label
              >
              <input
                v-model="postForm.title"
                type="text"
                class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
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
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >内容</label
              >
              <MarkdownEditor
                v-model="postForm.content"
                height="450px"
                placeholder="你想说点什么？支持 Markdown 格式..."
              />
            </div>

            <!-- Tags Input -->
            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >标签 (用逗号分隔)</label
              >
              <input
                v-model="postForm.tags"
                type="text"
                class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="例如: 技术, 3D建模, Blender"
              />
              <div v-if="availableTags.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                <span class="text-[10px] font-medium" style="color: var(--text-muted)"
                  >热门标签:</span
                >
                <button
                  v-for="tag in availableTags.slice(0, 8)"
                  :key="tag"
                  class="px-2 py-0.5 rounded-full text-[10px] font-medium hover:opacity-80 transition-opacity"
                  style="background-color: var(--bg-app); color: var(--accent)"
                  @click="postForm.tags = postForm.tags ? `${postForm.tags}, ${tag}` : tag"
                >
                  #{{ tag }}
                </button>
              </div>
            </div>

            <!-- Image Upload Section -->
            <div>
              <label
                class="block text-xs font-bold uppercase mb-3 ml-1"
                style="color: var(--text-secondary)"
                >图片 (最多 5 张)</label
              >
              <div class="flex flex-wrap gap-3">
                <div
                  v-for="(img, idx) in imagePreviews"
                  :key="idx"
                  class="relative w-20 h-20 rounded-xl overflow-hidden group"
                >
                  <img :src="img" class="w-full h-full object-cover" />
                  <button
                    class="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="removeImage(idx)"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
                <label
                  v-if="imagePreviews.length < 5"
                  class="w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  style="border-color: var(--border-base)"
                >
                  <Plus class="w-5 h-5" style="color: var(--text-muted)" />
                  <span class="text-[10px] mt-1" style="color: var(--text-muted)">上传图片</span>
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

          <button
            class="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all flex items-center justify-center gap-2"
            @click="handleCreateDiscussion"
          >
            <Send class="w-4 h-4" /> 立即发布
          </button>
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
</style>

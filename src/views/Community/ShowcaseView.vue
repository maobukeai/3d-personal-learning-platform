<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
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

import UserProfileDialog from '@/components/UserProfileDialog.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
const searchQuery = ref('');
const activeFilter = ref('热门');
const activeTypeFilter = ref('全部');
const showcases = ref<any[]>([]);
const isLoading = ref(false);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: any) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    // For showcase view, we might want to redirect to messages
    // but often users just want to see the profile
  } catch (error) {
    ElMessage.error('创建对话失败');
  }
};

const filters = ['热门', '最新'];
const typeFilters = ['全部', 'IMAGE', 'VIDEO', 'MODEL', 'OTHER', 'TEXT'];

const typeFilterLabels: Record<string, string> = {
  全部: '全部',
  IMAGE: '图片',
  VIDEO: '视频',
  MODEL: '3D模型',
  OTHER: '其他',
  TEXT: '文本',
};

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
      return '3D模型';
    case 'VIDEO':
      return '视频';
    case 'IMAGE':
      return '图片';
    case 'TEXT':
      return '文本';
    case 'OTHER':
      return '其他';
    default:
      return '作品';
  }
};

const isPublishDialogOpen = ref(false);

const isDetailOpen = ref(false);
const detailItem = ref<any>(null);
const detailLoading = ref(false);
const comments = ref<any[]>([]);
const commentsLoading = ref(false);
const newComment = ref('');
const isSubmittingComment = ref(false);
const shareCopied = ref(false);
const currentImageIndex = ref(0);

const fetchShowcases = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/showcase', {
      params: { filter: activeFilter.value, type: activeTypeFilter.value },
    });
    showcases.value = response.data;
  } catch (error) {
    ElMessage.error('获取作品展示失败');
  } finally {
    isLoading.value = false;
  }
};

const openPublishDialog = () => {
  isPublishDialogOpen.value = true;
};

const openDetail = async (item: any) => {
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
  } catch (error) {
    ElMessage.error('获取作品详情失败');
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
  } catch (error) {
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
    const idx = showcases.value.findIndex((s) => s.id === detailItem.value.id);
    if (idx !== -1) {
      showcases.value[idx].commentsCount++;
    }
    newComment.value = '';
  } catch (error) {
    ElMessage.error('评论失败');
  } finally {
    isSubmittingComment.value = false;
  }
};

const deleteComment = async (comment: any) => {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/showcase/${detailItem.value.id}/comment/${comment.id}`);
    comments.value = comments.value.filter((c) => c.id !== comment.id);
    detailItem.value.commentsCount--;
    const idx = showcases.value.findIndex((s) => s.id === detailItem.value.id);
    if (idx !== -1) {
      showcases.value[idx].commentsCount--;
    }
    ElMessage.success('评论已删除');
  } catch {
    // Ignore error
  }
};

const toggleLike = async (item: any) => {
  try {
    const response = await api.post(`/api/showcase/${item.id}/like`);
    item.isLiked = response.data.liked;
    item.likesCount += item.isLiked ? 1 : -1;
    if (detailItem.value && detailItem.value.id === item.id) {
      detailItem.value.isLiked = response.data.liked;
      detailItem.value.likesCount += response.data.liked ? 1 : -1;
    }
  } catch (error) {
    ElMessage.error('操作失败');
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
      ElMessage.success('链接已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error('复制失败');
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
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString();
};

const filteredShowcases = computed(() => {
  return showcases.value.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (s.user.name || s.user.email).toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

onMounted(fetchShowcases);
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div
      class="min-h-16 py-3 sm:py-0 sm:h-16 border-b px-4 sm:px-8 flex flex-col sm:flex-row gap-3 sm:items-center justify-between shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg shrink-0">
          <MonitorPlay class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">作品展示</h1>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
        <div class="relative flex-1 sm:flex-initial">
          <Search
            class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--text-muted)"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索优秀作品..."
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button
          class="bg-indigo-600 text-white px-3 py-2 sm:px-4 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shrink-0 flex items-center gap-2 whitespace-nowrap"
          @click="openPublishDialog"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">发布我的作品</span>
          <span class="sm:hidden">发布</span>
        </button>
      </div>
    </div>

    <!-- Featured Banner -->
    <div class="px-4 sm:px-8 py-4 sm:py-6 shrink-0">
      <div class="relative h-48 rounded-3xl overflow-hidden bg-slate-900 group cursor-pointer">
        <img
          src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=1200&auto=format&fit=crop&q=80"
          class="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
        />
        <div
          class="absolute inset-0 p-6 sm:p-8 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent"
        >
          <div class="flex items-center gap-2 mb-2">
            <span
              class="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
              >社区精选</span
            >
            <div class="flex items-center gap-1 text-white/60 text-xs">
              <Flame class="w-3 h-3 text-orange-500" /> 推荐作品
            </div>
          </div>
          <h2 class="text-xl sm:text-2xl font-bold text-white mb-2">展示你的创意作品</h2>
          <p class="text-white/70 text-xs sm:text-sm max-w-xl line-clamp-2 sm:line-clamp-none">
            发布你的渲染成品、3D模型、动画短片或任何创意作品，与全球创作者交流心得。
          </p>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="px-4 sm:px-8 mb-6 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
      <div class="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-hide py-1 -mx-4 px-4 sm:mx-0 sm:px-0 max-w-full">
        <div class="flex items-center gap-2 shrink-0">
          <button
            v-for="f in filters"
            :key="f"
            class="px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0"
            :class="activeFilter === f ? 'bg-indigo-600 text-white shadow-md' : 'hover:opacity-80'"
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
            {{ f }}
          </button>
        </div>
        <div class="w-px h-5 shrink-0" style="background-color: var(--border-base)"></div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            v-for="tf in typeFilters"
            :key="tf"
            class="px-3 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0"
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
      <div class="flex items-center gap-2 text-xs font-bold shrink-0 self-start lg:self-auto" style="color: var(--text-muted)">
        <Trophy class="w-4 h-4 text-amber-500 shrink-0" />
        <span class="truncate">年度优秀作品选拔进行中</span>
        <ChevronRight class="w-3 h-3 shrink-0" />
      </div>
    </div>

    <!-- Showcase Grid -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 pt-0 scrollbar-hide">
      <div class="max-w-7xl mx-auto">
        <div
          v-if="filteredShowcases.length > 0"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6"
        >
          <div
            v-for="item in filteredShowcases"
            :key="item.id"
            class="group rounded-3xl border overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col cursor-pointer"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
            @click="openDetail(item)"
          >
            <!-- Cover -->
            <div
              v-if="item.type === 'TEXT' && !item.thumbnailUrl"
              class="aspect-video relative overflow-hidden flex items-center justify-center p-6"
              style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            >
              <p class="text-white text-sm font-bold text-center line-clamp-3">{{ item.title }}</p>
              <div class="absolute top-2 left-2">
                <span
                  class="backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
                  :class="getTypeBg(item.type)"
                >
                  {{ getTypeLabel(item.type) }}
                </span>
              </div>
              <div
                class="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white"
              >
                <Eye class="w-3 h-3" /> {{ item.views || 0 }}
              </div>
            </div>
            <div
              v-else
              class="aspect-video relative overflow-hidden"
              style="background-color: var(--bg-app)"
            >
              <img
                :src="item.thumbnailUrl"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div
                v-if="item.isVideo"
                class="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1"
              >
                <Play class="w-2.5 h-2.5 fill-white" /> 视频
              </div>
              <div class="absolute top-2 left-2">
                <span
                  class="backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
                  :class="getTypeBg(item.type)"
                >
                  {{ getTypeLabel(item.type) }}
                </span>
              </div>
              <div
                v-if="item.asset"
                class="absolute bottom-2 left-2 bg-blue-500/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1"
              >
                <Box class="w-2.5 h-2.5" /> 关联3D模型
              </div>
              <div
                class="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white"
              >
                <Eye class="w-3 h-3" /> {{ item.views || 0 }}
              </div>
              <div
                class="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"
              ></div>
            </div>

            <!-- Content -->
            <div class="p-5 flex-1 flex flex-col">
              <h3
                class="text-sm font-bold mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors"
                style="color: var(--text-primary)"
              >
                {{ item.title }}
              </h3>

              <div
                v-if="parseTags(item.tags).length"
                class="flex items-center gap-1.5 mb-3 flex-wrap"
              >
                <span
                  v-for="tag in parseTags(item.tags).slice(0, 3)"
                  :key="tag"
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                >
                  {{ tag }}
                </span>
              </div>

              <div class="flex items-center justify-between mt-auto">
                <div
                  class="flex items-center gap-2 cursor-pointer group/author"
                  @click.stop="openUserProfile(item.user.id)"
                >
                  <UserAvatar
                    :user="item.user"
                    size="sm"
                    class="group-hover/author:ring-2 group-hover/author:ring-indigo-500 transition-all"
                  />
                  <span
                    class="text-[11px] font-bold group-hover/author:text-indigo-600 transition-colors"
                    style="color: var(--text-secondary)"
                    >{{ item.user.name || item.user.email }}</span
                  >
                </div>

                <div class="flex items-center gap-3">
                  <button
                    class="flex items-center gap-1 text-[10px] font-bold transition-all"
                    :class="item.isLiked ? 'text-rose-500' : 'text-slate-400'"
                    @click.stop="toggleLike(item)"
                  >
                    <Heart class="w-3 h-3" :class="item.isLiked ? 'fill-rose-500' : ''" />
                    {{ item.likesCount }}
                  </button>
                  <div class="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <MessageCircle class="w-3 h-3" /> {{ item.commentsCount }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="h-64 flex flex-col items-center justify-center text-slate-400">
          <MonitorPlay class="w-12 h-12 mb-4 opacity-10" />
          <p class="text-sm font-bold">还没有人发布作品，成为第一个吧！</p>
        </div>
      </div>
    </div>

    <!-- Detail Dialog -->
    <Transition name="fade">
      <div v-if="isDetailOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeDetail"></div>
        <div
          class="relative w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          style="background-color: var(--bg-card)"
        >
          <!-- Close Button -->
          <button
            class="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style="color: var(--text-secondary)"
            @click="closeDetail"
          >
            <X class="w-5 h-5" />
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
                <img :src="getDetailImages[currentImageIndex]" class="w-full h-full object-cover" />
                <div
                  v-if="getDetailImages.length > 1"
                  class="absolute inset-0 flex items-center justify-between px-4"
                >
                  <button
                    v-if="currentImageIndex > 0"
                    class="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all"
                    @click="prevImage"
                  >
                    <ChevronLeft class="w-5 h-5" />
                  </button>
                  <div v-else></div>
                  <button
                    v-if="currentImageIndex < getDetailImages.length - 1"
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
              <div class="p-8">
                <!-- Title & Author -->
                <div class="flex items-start justify-between mb-4">
                  <div class="flex-1">
                    <h2 class="text-2xl font-bold mb-3" style="color: var(--text-primary)">
                      {{ detailItem.title }}
                    </h2>
                    <div class="flex items-center gap-3">
                      <UserAvatar
                        :user="detailItem.user"
                        size="sm"
                        class="cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                        @click="openUserProfile(detailItem.user.id)"
                      />
                      <div>
                        <p
                          class="text-sm font-bold cursor-pointer hover:text-indigo-600 transition-colors"
                          style="color: var(--text-primary)"
                          @click="openUserProfile(detailItem.user.id)"
                        >
                          {{ detailItem.user.name || detailItem.user.email }}
                        </p>
                        <p
                          v-if="detailItem.user.bio"
                          class="text-xs"
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
                  class="flex items-center gap-2 mb-4 flex-wrap"
                >
                  <Tag class="w-3.5 h-3.5 text-indigo-500" />
                  <span
                    v-for="tag in parseTags(detailItem.tags)"
                    :key="tag"
                    class="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                  >
                    {{ tag }}
                  </span>
                </div>

                <!-- Description (Markdown rendered) -->
                <div v-if="detailItem.description" class="mb-6">
                  <MdPreview :model-value="detailItem.description" class="md-preview-showcase" />
                </div>

                <!-- Linked Asset -->
                <div
                  v-if="detailItem.asset"
                  class="mb-6 p-4 rounded-xl border flex items-center gap-3"
                  style="background-color: var(--bg-app); border-color: var(--border-base)"
                >
                  <Box class="w-8 h-8 text-blue-500 shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold" style="color: var(--text-secondary)">关联3D模型</p>
                    <p class="text-sm font-bold truncate" style="color: var(--text-primary)">
                      {{ detailItem.asset.title }}
                    </p>
                  </div>
                  <a
                    :href="detailItem.asset.url"
                    download
                    class="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all shrink-0"
                  >
                    下载模型
                  </a>
                </div>

                <!-- Stats Bar -->
                <div
                  class="flex items-center gap-6 py-4 border-t border-b"
                  style="border-color: var(--border-base)"
                >
                  <div class="flex items-center gap-2 text-sm" style="color: var(--text-secondary)">
                    <Eye class="w-4 h-4" />
                    <span class="font-bold">{{ detailItem.views }}</span> 浏览
                  </div>
                  <button
                    class="flex items-center gap-2 text-sm transition-all"
                    :class="detailItem.isLiked ? 'text-rose-500' : ''"
                    style="color: var(--text-secondary)"
                    @click="toggleLike(detailItem)"
                  >
                    <Heart class="w-4 h-4" :class="detailItem.isLiked ? 'fill-rose-500' : ''" />
                    <span class="font-bold">{{ detailItem.likesCount }}</span> 点赞
                  </button>
                  <div class="flex items-center gap-2 text-sm" style="color: var(--text-secondary)">
                    <MessageCircle class="w-4 h-4" />
                    <span class="font-bold">{{ detailItem.commentsCount }}</span> 评论
                  </div>
                  <button
                    class="flex items-center gap-2 text-sm ml-auto transition-all hover:text-indigo-600"
                    style="color: var(--text-secondary)"
                    @click="handleShare"
                  >
                    <component
                      :is="shareCopied ? Check : Share2"
                      class="w-4 h-4"
                      :class="shareCopied ? 'text-emerald-500' : ''"
                    />
                    {{ shareCopied ? '已复制' : '分享' }}
                  </button>
                </div>

                <!-- Comments Section -->
                <div class="mt-6">
                  <h3 class="text-sm font-bold mb-4" style="color: var(--text-primary)">
                    评论 ({{ detailItem.commentsCount }})
                  </h3>

                  <!-- Comment Input -->
                  <div class="flex items-start gap-3 mb-6">
                    <UserAvatar :user="authStore.user" size="sm" />
                    <div class="flex-1 flex items-center gap-2">
                      <input
                        v-model="newComment"
                        type="text"
                        placeholder="写下你的评论..."
                        class="flex-1 px-4 py-2.5 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        style="background-color: var(--bg-app); color: var(--text-primary)"
                        @keyup.enter="submitComment"
                      />
                      <button
                        :disabled="isSubmittingComment || !newComment.trim()"
                        class="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        @click="submitComment"
                      >
                        <Send class="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <!-- Comments List -->
                  <div v-if="commentsLoading" class="py-8 text-center">
                    <div
                      class="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"
                    ></div>
                  </div>
                  <div v-else-if="comments.length === 0" class="py-8 text-center">
                    <p class="text-xs" style="color: var(--text-muted)">暂无评论，来说点什么吧</p>
                  </div>
                  <div v-else class="space-y-4">
                    <div
                      v-for="comment in comments"
                      :key="comment.id"
                      class="flex items-start gap-3 group"
                    >
                      <UserAvatar :user="comment.user" size="sm" />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5">
                          <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                            comment.user.name || '匿名用户'
                          }}</span>
                          <span class="text-[10px]" style="color: var(--text-muted)">{{
                            formatTime(comment.createdAt)
                          }}</span>
                          <button
                            v-if="comment.user.id === authStore.user?.id || isAdmin"
                            class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500"
                            @click="deleteComment(comment)"
                          >
                            <Trash2 class="w-3 h-3" />
                          </button>
                        </div>
                        <p class="text-sm leading-relaxed" style="color: var(--text-secondary)">
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
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

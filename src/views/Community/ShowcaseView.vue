<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Award,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Eye,
  Filter,
  Flame,
  Heart,
  Image,
  Layers3,
  MessageCircle,
  MonitorPlay,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Trophy,
  Type,
  Users,
  Video,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import type { Asset } from '@/types';

import PageHeader from '@/components/PageHeader.vue';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';
import ShowcaseCard from '@/components/ShowcaseCard.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';

const MdPreview = defineAsyncComponent(async () => {
  await import('md-editor-v3/lib/style.css');
  return (await import('md-editor-v3')).MdPreview;
});
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

type ShowcaseType = 'IMAGE' | 'VIDEO' | 'MODEL' | 'TEXT' | 'OTHER';
type ShowcaseSortKey = 'popular' | 'newest' | 'trending' | 'viewed' | 'discussed' | 'featured';
type ShowcaseScope = 'all' | 'my' | 'liked';
type ShowcaseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ShowcaseBucket = 'all' | 'fresh' | 'downloadable' | 'discussed' | 'pending' | 'rejected';

interface ShowcaseUser {
  id: string;
  name?: string | null;
  avatar?: string;
  avatarUrl?: string | null;
  role?: string;
  email?: string;
  bio?: string | null;
}

interface ShowcaseItem {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  images?: string | null;
  type: ShowcaseType;
  views: number;
  likesCount: number;
  commentsCount: number;
  user: ShowcaseUser;
  createdAt: string;
  isLiked?: boolean;
  isVideo?: boolean;
  videoUrl?: string | null;
  tags?: string | null;
  asset?: Asset | null;
  assetId?: string | null;
  status?: ShowcaseStatus;
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: ShowcaseUser;
}

interface ShowcaseActivity {
  id: string;
  content: string;
  createdAt: string;
  user: ShowcaseUser;
  showcase: Pick<ShowcaseItem, 'id' | 'title' | 'type' | 'thumbnailUrl'>;
}

interface ShowcaseStats {
  totalWorks: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  todayWorks: number;
  weekWorks: number;
  myWorks: number;
  myLikes: number;
  downloadableWorks?: number;
  discussedWorks?: number;
  myPendingWorks?: number;
  myRejectedWorks?: number;
  statusBreakdown?: Array<{ status: ShowcaseStatus; count: number }>;
  typeBreakdown: Array<{ type: ShowcaseType; count: number; views: number }>;
  topTags: Array<{ name: string; count: number }>;
  topCreators: Array<
    ShowcaseUser & {
      works: number;
      likes: number;
      comments: number;
      views: number;
      score: number;
    }
  >;
  recentActivity: ShowcaseActivity[];
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
const isPublishDialogOpen = ref(false);
const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const searchInput = ref('');
const searchQuery = ref('');
const activeSort = ref<ShowcaseSortKey>('trending');
const activeType = ref<ShowcaseType | 'all'>('all');
const activeScope = ref<ShowcaseScope>('all');
const activeBucket = ref<ShowcaseBucket>('all');
const viewMode = ref<'grid' | 'dense'>('grid');
const showInsights = ref(false);
const showcases = ref<ShowcaseItem[]>([]);
const page = ref(1);
const total = ref(0);
const hasMore = ref(false);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const statsLoading = ref(false);
const stats = ref<ShowcaseStats | null>(null);

const isDetailOpen = ref(false);
const detailItem = ref<ShowcaseItem | null>(null);
const detailLoading = ref(false);
const comments = ref<CommentItem[]>([]);
const commentsLoading = ref(false);
const newComment = ref('');
const isSubmittingComment = ref(false);
const shareCopied = ref(false);
const currentImageIndex = ref(0);
const relatedShowcases = ref<ShowcaseItem[]>([]);
const relatedLoading = ref(false);
const isEditingDetail = ref(false);
const isSavingDetail = ref(false);
const isDeletingDetail = ref(false);
const editThumbnail = ref<File | null>(null);
const editImages = ref<File[]>([]);
const editForm = ref({
  title: '',
  description: '',
  tags: '',
  type: 'IMAGE' as ShowcaseType,
  videoUrl: '',
  isVideo: false,
});

const sortOptions: Array<{
  value: ShowcaseSortKey;
  label: string;
  hint: string;
  icon: Component;
}> = [
  { value: 'trending', label: '趋势', hint: '近期互动热度', icon: TrendingUp },
  { value: 'popular', label: '热门', hint: '点赞优先', icon: Flame },
  { value: 'featured', label: '精选', hint: '综合评分', icon: Award },
  { value: 'newest', label: '最新', hint: '发布时间', icon: Clock },
  { value: 'viewed', label: '浏览', hint: '访问最多', icon: Eye },
  { value: 'discussed', label: '讨论', hint: '评论最多', icon: MessageCircle },
];

const scopeOptions: Array<{ value: ShowcaseScope; label: string; icon: Component }> = [
  { value: 'all', label: '全站', icon: Users },
  { value: 'my', label: '我的发布', icon: Sparkles },
  { value: 'liked', label: '我赞过', icon: Heart },
];

const typeOptions: Array<{ value: ShowcaseType | 'all'; label: string; icon: Component }> = [
  { value: 'all', label: '全部', icon: Filter },
  { value: 'IMAGE', label: '图片', icon: Image },
  { value: 'VIDEO', label: '视频', icon: Video },
  { value: 'MODEL', label: '3D模型', icon: Box },
  { value: 'TEXT', label: '文本', icon: Type },
  { value: 'OTHER', label: '其他', icon: Layers3 },
];

let searchTimer: ReturnType<typeof setTimeout> | undefined;

const formatNumber = (value: number) =>
  new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);

const parseTags = (tags: string | null | undefined): string[] => {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed.map((tag) => String(tag).trim()).filter(Boolean);
  } catch {
    // Legacy showcase tags are comma-separated.
  }
  return tags
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const formatTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

const getTypeLabel = (type: ShowcaseType | 'all') =>
  typeOptions.find((option) => option.value === type)?.label ?? '作品';

const getTypeClass = (type: ShowcaseType | 'all') => {
  if (type === 'MODEL') return 'tone-blue';
  if (type === 'VIDEO') return 'tone-rose';
  if (type === 'IMAGE') return 'tone-green';
  if (type === 'TEXT') return 'tone-amber';
  return 'tone-slate';
};

const getRouteWorkId = () => {
  const work = route.query.work;
  return Array.isArray(work) ? work[0] : work;
};

const setWorkQuery = (workId: string | null) => {
  const query = { ...route.query };
  if (workId) {
    query.work = workId;
  } else {
    delete query.work;
  }
  router.replace({ query }).catch(() => undefined);
};

const pendingReviewCount = computed(() => stats.value?.myPendingWorks ?? 0);

const smartFilterOptions = computed<
  Array<{
    value: ShowcaseBucket;
    label: string;
    hint: string;
    metric: string;
    icon: Component;
  }>
>(() => [
  {
    value: 'all',
    label: '全部作品',
    hint: '当前结果',
    metric: formatNumber(total.value || stats.value?.totalWorks || showcases.value.length),
    icon: MonitorPlay,
  },
  {
    value: 'fresh',
    label: '本周上新',
    hint: '7 天内发布',
    metric: formatNumber(stats.value?.weekWorks ?? 0),
    icon: Clock,
  },
  {
    value: 'downloadable',
    label: '可下载',
    hint: '含关联资源',
    metric: formatNumber(
      stats.value?.downloadableWorks ?? showcases.value.filter((item) => item.assetId || item.asset).length,
    ),
    icon: Download,
  },
  {
    value: 'discussed',
    label: '有讨论',
    hint: '已产生评论',
    metric: formatNumber(
      stats.value?.discussedWorks ?? showcases.value.filter((item) => item.commentsCount > 0).length,
    ),
    icon: MessageCircle,
  },
  {
    value: 'pending',
    label: '待审核',
    hint: '我的队列',
    metric: formatNumber(stats.value?.myPendingWorks ?? 0),
    icon: ShieldCheck,
  },
]);



const canManageDetail = computed(() => {
  if (!detailItem.value) return false;
  return detailItem.value.user.id === authStore.user?.id || isAdmin.value;
});

const detailStatusMeta = computed(() => {
  const status = detailItem.value?.status ?? 'APPROVED';
  if (status === 'PENDING') {
    return { label: '审核中', tone: 'status-pending', hint: '仅你和管理员可见，审核通过后进入全站作品流。' };
  }
  if (status === 'REJECTED') {
    return { label: '已驳回', tone: 'status-rejected', hint: '修改后重新提交审核。' };
  }
  return { label: '已发布', tone: 'status-approved', hint: '全站可见' };
});

const resetFilters = () => {
  searchInput.value = '';
  searchQuery.value = '';
  activeScope.value = 'all';
  activeType.value = 'all';
  activeBucket.value = 'all';
  activeSort.value = 'trending';
};

const setBucket = (bucket: ShowcaseBucket) => {
  activeBucket.value = bucket;
  if (bucket === 'pending' || bucket === 'rejected') {
    activeScope.value = 'my';
  }
};

const topTags = computed(() => {
  if (stats.value?.topTags.length) return stats.value.topTags;
  const usage = new Map<string, number>();
  showcases.value.forEach((item) => {
    parseTags(item.tags).forEach((tag) => usage.set(tag, (usage.get(tag) ?? 0) + 1));
  });
  return Array.from(usage.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
});

const topCreators = computed(() => stats.value?.topCreators ?? []);
const recentActivity = computed(() => stats.value?.recentActivity ?? []);

const typeBreakdown = computed(() => {
  const groups = stats.value?.typeBreakdown ?? [];
  const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
  return typeOptions
    .filter((option) => option.value !== 'all')
    .map((option) => {
      const group = groups.find((item) => item.type === option.value);
      const count = group?.count ?? showcases.value.filter((item) => item.type === option.value).length;
      return {
        ...option,
        count,
        percent: totalCount ? Math.round((count / totalCount) * 100) : 0,
      };
    });
});


const resultSummary = computed(() => {
  const shown = showcases.value.length;
  const count = total.value || shown;
  if (searchQuery.value) return `搜索「${searchQuery.value}」共 ${formatNumber(count)} 个结果`;
  return `已展示 ${formatNumber(shown)} / ${formatNumber(count)} 个作品`;
});

const detailImages = computed(() => {
  if (!detailItem.value) return [];
  const images: string[] = [];
  if (detailItem.value.thumbnailUrl) images.push(getAssetUrl(detailItem.value.thumbnailUrl));
  if (detailItem.value.images) {
    try {
      const parsed = JSON.parse(detailItem.value.images);
      if (Array.isArray(parsed)) {
        parsed.forEach((url) => {
          const normalized = getAssetUrl(String(url));
          if (normalized) images.push(normalized);
        });
      }
    } catch {
      // Ignore malformed gallery payloads from old records.
    }
  }
  return Array.from(new Set(images.filter(Boolean)));
});

const currentDetailImage = computed(() => detailImages.value[currentImageIndex.value] ?? '');

const similarShowcases = computed(() => {
  if (relatedShowcases.value.length) return relatedShowcases.value;
  if (!detailItem.value) return [];
  const tags = new Set(parseTags(detailItem.value.tags));
  return showcases.value
    .filter((item) => item.id !== detailItem.value?.id)
    .map((item) => {
      const tagScore = parseTags(item.tags).filter((tag) => tags.has(tag)).length;
      const typeScore = item.type === detailItem.value?.type ? 2 : 0;
      return { item, score: tagScore + typeScore };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.item);
});

const fetchStats = async () => {
  statsLoading.value = true;
  try {
    const response = await api.get('/api/showcase/stats');
    stats.value = response.data;
  } catch (_error) {
    console.error('Failed to fetch showcase stats');
  } finally {
    statsLoading.value = false;
  }
};

const hydrateEditForm = (item: ShowcaseItem) => {
  editForm.value = {
    title: item.title,
    description: item.description ?? '',
    tags: parseTags(item.tags).join(', '),
    type: item.type,
    videoUrl: item.videoUrl ?? '',
    isVideo: item.isVideo || item.type === 'VIDEO',
  };
  editThumbnail.value = null;
  editImages.value = [];
};

const fetchRelatedShowcases = async (id: string) => {
  relatedLoading.value = true;
  try {
    const response = await api.get(`/api/showcase/${id}/related`);
    relatedShowcases.value = response.data;
  } catch (_error) {
    relatedShowcases.value = [];
  } finally {
    relatedLoading.value = false;
  }
};

const fetchShowcases = async (append = false) => {
  if (append) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
  }
  const nextPage = append ? page.value + 1 : 1;
  try {
    const response = await api.get('/api/showcase', {
      params: {
        sort: activeSort.value,
        type: activeType.value,
        scope: activeScope.value,
        bucket: activeBucket.value,
        q: searchQuery.value,
        page: nextPage,
        limit: viewMode.value === 'dense' ? 60 : 36,
        withMeta: true,
      },
    });
    const payload = response.data;
    const items: ShowcaseItem[] = Array.isArray(payload) ? payload : payload.items ?? [];
    showcases.value = append ? [...showcases.value, ...items] : items;
    page.value = payload.meta?.page ?? nextPage;
    total.value = payload.meta?.total ?? showcases.value.length;
    hasMore.value = payload.meta?.hasMore ?? false;

    const routeWorkId = getRouteWorkId();
    if (!append && routeWorkId && detailItem.value?.id !== routeWorkId) {
      const item = showcases.value.find((work) => work.id === routeWorkId);
      if (item) {
        await openDetail(item, false);
      } else {
        await loadDetail(routeWorkId, false);
      }
    }
  } catch (_error) {
    ElMessage.error('作品集加载失败，请稍后重试');
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([fetchShowcases(), fetchStats()]);
};

const openPublishDialog = () => {
  isPublishDialogOpen.value = true;
};

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
    ElMessage.success('会话已创建');
  } catch (_error) {
    ElMessage.error('发起会话失败');
  }
};

const loadDetail = async (id: string, syncQuery = true) => {
  if (syncQuery) setWorkQuery(id);
  isDetailOpen.value = true;
  detailLoading.value = true;
  currentImageIndex.value = 0;
  try {
    const response = await api.get(`/api/showcase/${id}`);
    detailItem.value = response.data;
    hydrateEditForm(response.data);
    isEditingDetail.value = false;
    const idx = showcases.value.findIndex((item) => item.id === id);
    if (idx !== -1) {
      showcases.value[idx] = {
        ...showcases.value[idx],
        views: response.data.views,
        isLiked: response.data.isLiked,
        likesCount: response.data.likesCount,
        commentsCount: response.data.commentsCount,
      };
    }
    await Promise.all([fetchComments(id), fetchRelatedShowcases(id)]);
  } catch (_error) {
    ElMessage.error('作品详情加载失败');
    closeDetail();
  } finally {
    detailLoading.value = false;
  }
};

const openDetail = async (item: ShowcaseItem, syncQuery = true) => {
  await loadDetail(item.id, syncQuery);
};

const closeDetail = () => {
  isDetailOpen.value = false;
  detailItem.value = null;
  comments.value = [];
  relatedShowcases.value = [];
  newComment.value = '';
  currentImageIndex.value = 0;
  shareCopied.value = false;
  isEditingDetail.value = false;
  editThumbnail.value = null;
  editImages.value = [];
  setWorkQuery(null);
};

const nextImage = () => {
  if (currentImageIndex.value < detailImages.value.length - 1) currentImageIndex.value++;
};

const prevImage = () => {
  if (currentImageIndex.value > 0) currentImageIndex.value--;
};

const fetchComments = async (showcaseId: string) => {
  commentsLoading.value = true;
  try {
    const response = await api.get(`/api/showcase/${showcaseId}/comments`);
    comments.value = response.data;
  } catch (_error) {
    console.error('Failed to fetch showcase comments');
  } finally {
    commentsLoading.value = false;
  }
};

const updateLikeState = (id: string, liked: boolean, likesCount?: number) => {
  const updateItem = (item: ShowcaseItem) => {
    if (typeof likesCount === 'number') {
      item.likesCount = likesCount;
    } else if (item.isLiked !== liked) {
      item.likesCount = Math.max(0, item.likesCount + (liked ? 1 : -1));
    }
    item.isLiked = liked;
  };
  const target = showcases.value.find((item) => item.id === id);
  if (target) updateItem(target);
  if (detailItem.value?.id === id) updateItem(detailItem.value);
};

const toggleLike = async (item: ShowcaseItem) => {
  try {
    const response = await api.post(`/api/showcase/${item.id}/like`);
    updateLikeState(item.id, response.data.liked, response.data.likesCount);
    void fetchStats();
  } catch (_error) {
    ElMessage.error('操作失败，请稍后重试');
  }
};

const submitComment = async () => {
  if (!newComment.value.trim() || !detailItem.value) return;
  isSubmittingComment.value = true;
  try {
    const response = await api.post(`/api/showcase/${detailItem.value.id}/comment`, {
      content: newComment.value,
    });
    comments.value.unshift(response.data);
    detailItem.value.commentsCount += 1;
    const target = showcases.value.find((item) => item.id === detailItem.value?.id);
    if (target) target.commentsCount += 1;
    newComment.value = '';
    void fetchStats();
  } catch (_error) {
    ElMessage.error('评论发布失败');
  } finally {
    isSubmittingComment.value = false;
  }
};

const deleteComment = async (comment: CommentItem) => {
  if (!detailItem.value) return;
  try {
    await ElMessageBox.confirm('删除后这条讨论将无法恢复。', '删除评论', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/showcase/${detailItem.value.id}/comment/${comment.id}`);
    comments.value = comments.value.filter((item) => item.id !== comment.id);
    detailItem.value.commentsCount = Math.max(0, detailItem.value.commentsCount - 1);
    const target = showcases.value.find((item) => item.id === detailItem.value?.id);
    if (target) target.commentsCount = Math.max(0, target.commentsCount - 1);
    ElMessage.success('评论已删除');
    void fetchStats();
  } catch {
    // User cancelled or request failed after the confirmation dialog closed.
  }
};

const handleShare = async (item?: ShowcaseItem | null) => {
  const workId = item?.id ?? detailItem.value?.id;
  const url = new URL(window.location.href);
  if (workId) url.searchParams.set('work', workId);
  try {
    await navigator.clipboard.writeText(url.toString());
    shareCopied.value = true;
    window.setTimeout(() => {
      shareCopied.value = false;
    }, 1800);
    ElMessage.success('链接已复制');
  } catch (_error) {
    ElMessage.error('复制失败，请手动复制浏览器地址');
  }
};

const handleCardShare = async (item: ShowcaseItem) => {
  await handleShare(item);
};

const handleEditThumbnailChange = (event: Event) => {
  editThumbnail.value = (event.target as HTMLInputElement).files?.[0] ?? null;
};

const handleEditImagesChange = (event: Event) => {
  editImages.value = Array.from((event.target as HTMLInputElement).files ?? []);
};

const setEditType = (type: ShowcaseType | 'all') => {
  if (type !== 'all') editForm.value.type = type;
};

const startEditDetail = () => {
  if (!detailItem.value) return;
  hydrateEditForm(detailItem.value);
  isEditingDetail.value = true;
};

const cancelEditDetail = () => {
  if (detailItem.value) hydrateEditForm(detailItem.value);
  isEditingDetail.value = false;
};

const saveDetail = async () => {
  if (!detailItem.value) return;
  if (!editForm.value.title.trim()) {
    ElMessage.warning('请填写作品标题');
    return;
  }

  isSavingDetail.value = true;
  try {
    const formData = new FormData();
    formData.append('title', editForm.value.title.trim());
    formData.append('description', editForm.value.description);
    formData.append('tags', editForm.value.tags);
    formData.append('type', editForm.value.type);
    formData.append('videoUrl', editForm.value.videoUrl);
    formData.append('isVideo', String(editForm.value.isVideo || editForm.value.type === 'VIDEO'));
    if (editThumbnail.value) formData.append('thumbnail', editThumbnail.value);
    editImages.value.forEach((image) => formData.append('images', image));

    const response = await api.put(`/api/showcase/${detailItem.value.id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const updatedDetail = { ...detailItem.value, ...response.data } as ShowcaseItem;
    detailItem.value = updatedDetail;
    hydrateEditForm(updatedDetail);
    isEditingDetail.value = false;
    if (response.data.status === 'PENDING') activeScope.value = 'my';
    await Promise.all([fetchShowcases(), fetchStats(), fetchRelatedShowcases(updatedDetail.id)]);
    ElMessage.success(response.data.status === 'PENDING' ? '已保存，等待审核通过后进入全站' : '作品已更新');
  } catch (_error) {
    ElMessage.error('保存失败，请稍后重试');
  } finally {
    isSavingDetail.value = false;
  }
};

const deleteDetail = async () => {
  if (!detailItem.value) return;
  try {
    await ElMessageBox.confirm(`确定删除《${detailItem.value.title}》吗？删除后无法恢复。`, '删除作品', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    isDeletingDetail.value = true;
    const deletedId = detailItem.value.id;
    await api.delete(`/api/showcase/${deletedId}`);
    showcases.value = showcases.value.filter((item) => item.id !== deletedId);
    total.value = Math.max(0, total.value - 1);
    closeDetail();
    await fetchStats();
    ElMessage.success('作品已删除');
  } catch (_error) {
    // User cancelled or request failed after the confirmation dialog closed.
  } finally {
    isDeletingDetail.value = false;
  }
};

const handlePublished = async () => {
  activeScope.value = 'my';
  activeBucket.value = 'pending';
  activeSort.value = 'newest';
  await refreshAll();
};

const selectTag = (tag: string) => {
  searchInput.value = tag;
  searchQuery.value = tag;
  activeScope.value = 'all';
  activeBucket.value = 'all';
};

const openActivity = async (activity: ShowcaseActivity) => {
  const item = showcases.value.find((work) => work.id === activity.showcase.id);
  if (item) {
    await openDetail(item);
  } else {
    await loadDetail(activity.showcase.id);
  }
};

watch(searchInput, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery.value = searchInput.value.trim();
  }, 260);
});

watch([activeSort, activeType, activeScope, activeBucket, searchQuery, viewMode], () => {
  void fetchShowcases();
});

onMounted(() => {
  void refreshAll();
});
</script>

<template>
  <div class="showcase-view">
    <PageHeader title="创意作品集" :icon="MonitorPlay">
      <div class="showcase-header-actions">
        <div class="showcase-search">
          <Search class="w-4 h-4" />
          <input v-model="searchInput" type="search" placeholder="搜索作品、作者、标签..." />
        </div>
        <button type="button" class="icon-button" title="刷新作品集" @click="refreshAll">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading || statsLoading }" />
        </button>
        <button
          type="button"
          class="icon-button"
          :title="showInsights ? '收起洞察面板' : '打开洞察面板'"
          @click="showInsights = !showInsights"
        >
          <component :is="showInsights ? PanelRightClose : PanelRightOpen" class="w-4 h-4" />
        </button>
        <button type="button" class="publish-button" @click="openPublishDialog">
          <Plus class="w-4 h-4" />
          发布
        </button>
      </div>
    </PageHeader>

    <div class="showcase-layout" :class="{ 'showcase-layout--with-rail': showInsights }">
      <main class="showcase-main">

        <section class="showcase-controls">
          <!-- Row 1: Scope & Smart Filters (Scrollable on mobile) -->
          <div class="controls-row controls-row--primary">
            <div class="flex flex-row lg:justify-between items-center overflow-x-auto lg:overflow-x-visible no-scrollbar gap-2 flex-1 w-full pb-0.5 lg:pb-0 select-none">
              <div class="scope-strip shrink-0" aria-label="范围">
                <button
                  v-for="option in scopeOptions"
                  :key="option.value"
                  type="button"
                  :class="{ active: activeScope === option.value }"
                  @click="activeScope = option.value"
                >
                  <component :is="option.icon" class="w-3.5 h-3.5" />
                  {{ option.label }}
                </button>
              </div>

              <div class="divider-v block lg:hidden"></div>

              <div class="smart-filter-strip shrink-0" aria-label="智能筛选">
                <button
                  v-for="filter in smartFilterOptions"
                  :key="filter.value"
                  type="button"
                  :class="{ active: activeBucket === filter.value }"
                  @click="setBucket(filter.value)"
                >
                  <component :is="filter.icon" class="w-3.5 h-3.5" />
                  <span>{{ filter.label }}</span>
                  <b class="ml-0.5">{{ filter.metric }}</b>
                </button>
              </div>
            </div>
          </div>

          <!-- Row 2: Types & Sorting/View -->
          <div class="controls-row controls-row--secondary">
            <div class="type-strip-container w-full lg:w-auto">
              <span class="control-label hidden md:inline-flex">
                <Filter class="w-3.5 h-3.5" />
                类型
              </span>
              <div class="type-strip w-full lg:w-auto" aria-label="类型筛选">
                <button
                  v-for="option in typeOptions"
                  :key="option.value"
                  type="button"
                  :class="[{ active: activeType === option.value }, getTypeClass(option.value)]"
                  @click="activeType = option.value"
                >
                  <component :is="option.icon" class="w-3.5 h-3.5" />
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div class="right-actions-group w-full lg:w-auto">
              <!-- Review Pill -->
              <button
                v-if="pendingReviewCount"
                type="button"
                class="review-pill flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold cursor-pointer shrink-0"
                @click="setBucket('pending')"
              >
                <ShieldCheck class="w-3.5 h-3.5" />
                <span>{{ pendingReviewCount }} 个待审核</span>
              </button>

              <!-- Clear Filters Pill -->
              <button
                v-if="
                  searchQuery ||
                  activeType !== 'all' ||
                  activeBucket !== 'all' ||
                  activeScope !== 'all' ||
                  activeSort !== 'trending'
                "
                type="button"
                class="clear-search flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold cursor-pointer hover:text-red-500 transition-colors shrink-0"
                @click="resetFilters"
              >
                <span>清除筛选</span>
              </button>

              <div class="sort-strip-container flex-1 lg:flex-initial">
                <span class="control-label hidden md:inline-flex">
                  <SlidersHorizontal class="w-3.5 h-3.5" />
                  排序
                </span>
                <div class="sort-strip w-full lg:w-auto" aria-label="排序">
                  <button
                    v-for="option in sortOptions"
                    :key="option.value"
                    type="button"
                    :class="{ active: activeSort === option.value }"
                    :title="option.hint"
                    @click="activeSort = option.value"
                  >
                    <component :is="option.icon" class="w-3.5 h-3.5" />
                    <span>{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <!-- Compact Result Summary -->
              <span class="text-[10px] text-slate-550 dark:text-slate-400 font-semibold hidden sm:inline select-none">{{ resultSummary }}</span>
            </div>
          </div>
        </section>

        <section v-if="isLoading" class="showcase-grid" :class="{ dense: viewMode === 'dense' }">
          <div v-for="idx in 12" :key="idx" class="skeleton-card"></div>
        </section>

        <section
          v-else-if="showcases.length"
          class="showcase-grid"
          :class="{ dense: viewMode === 'dense' }"
        >
          <ShowcaseCard
            v-for="(item, index) in showcases"
            :key="item.id"
            :item="item"
            :compact="viewMode === 'dense'"
            :featured="viewMode === 'grid' && index === 0 && showcases.length > 2"
            @click="openDetail"
            @like="toggleLike"
            @share="handleCardShare"
            @user-click="openUserProfile"
          />
        </section>

        <section v-else class="empty-state">
          <MonitorPlay class="w-11 h-11" />
          <h3>还没有找到作品</h3>
          <p>换一个关键词或类型筛选，也可以现在发布一个作品把这里点亮。</p>
          <button type="button" @click="openPublishDialog">
            <Plus class="w-4 h-4" />
            发布作品
          </button>
        </section>

        <div v-if="hasMore && !isLoading" class="load-more-row">
          <button type="button" :disabled="isLoadingMore" @click="fetchShowcases(true)">
            <RefreshCw v-if="isLoadingMore" class="w-4 h-4 animate-spin" />
            <ChevronRight v-else class="w-4 h-4" />
            {{ isLoadingMore ? '加载中' : '加载更多作品' }}
          </button>
        </div>
      </main>

      <aside v-if="showInsights" class="showcase-rail">
        <section class="rail-panel">
          <div class="rail-title">
            <Trophy class="w-4 h-4" />
            创作者榜
          </div>
          <div v-if="topCreators.length" class="creator-list">
            <button
              v-for="(creator, index) in topCreators"
              :key="creator.id"
              type="button"
              @click="openUserProfile(creator.id)"
            >
              <span class="rank">{{ index + 1 }}</span>
              <UserAvatar :user="creator" size="sm" />
              <span class="creator-name">{{ creator.name || creator.email }}</span>
              <small>{{ formatNumber(creator.likes + creator.comments) }}</small>
            </button>
          </div>
          <p v-else class="rail-empty">发布和互动后会自动生成榜单。</p>
        </section>

        <section class="rail-panel">
          <div class="rail-title">
            <Tag class="w-4 h-4" />
            热门标签
          </div>
          <div v-if="topTags.length" class="tag-cloud">
            <button v-for="tag in topTags" :key="tag.name" type="button" @click="selectTag(tag.name)">
              #{{ tag.name }}
              <span>{{ tag.count }}</span>
            </button>
          </div>
          <p v-else class="rail-empty">作品标签会在这里聚合。</p>
        </section>

        <section class="rail-panel">
          <div class="rail-title">
            <MessageCircle class="w-4 h-4" />
            社区动态
          </div>
          <div v-if="recentActivity.length" class="activity-list">
            <button
              v-for="activity in recentActivity"
              :key="activity.id"
              type="button"
              @click="openActivity(activity)"
            >
              <UserAvatar :user="activity.user" size="sm" />
              <span>
                <strong>{{ activity.user.name || activity.user.email || '创作者' }}</strong>
                评论了《{{ activity.showcase.title }}》
                <small>{{ formatTime(activity.createdAt) }}</small>
              </span>
            </button>
          </div>
          <p v-else class="rail-empty">评论出现后会在这里实时沉淀。</p>
        </section>

        <section class="rail-panel">
          <div class="rail-title">
            <Filter class="w-4 h-4" />
            类型分布
          </div>
          <div class="type-bars">
            <button
              v-for="type in typeBreakdown"
              :key="type.value"
              type="button"
              @click="activeType = type.value"
            >
              <span>{{ type.label }}</span>
              <strong>{{ type.count }}</strong>
              <i :style="{ width: `${Math.max(type.percent, type.count ? 8 : 0)}%` }"></i>
            </button>
          </div>
        </section>
      </aside>
    </div>

    <Transition name="detail-fade">
      <div v-if="isDetailOpen" class="detail-layer">
        <div class="detail-backdrop" @click="closeDetail"></div>
        <aside class="detail-drawer">
          <header class="detail-header">
            <div>
              <span>作品详情</span>
              <strong v-if="detailItem">{{ detailItem.title }}</strong>
            </div>
            <div class="detail-header-actions">
              <button
                v-if="detailItem && canManageDetail && !isEditingDetail"
                type="button"
                title="编辑作品"
                @click="startEditDetail"
              >
                <Edit3 class="w-4 h-4" />
              </button>
              <button
                v-if="detailItem && canManageDetail"
                type="button"
                class="danger"
                :disabled="isDeletingDetail"
                title="删除作品"
                @click="deleteDetail"
              >
                <Trash2 class="w-4 h-4" />
              </button>
              <button type="button" title="关闭" @click="closeDetail">
                <X class="w-5 h-5" />
              </button>
            </div>
          </header>

          <div v-if="detailLoading" class="detail-loading">
            <RefreshCw class="w-6 h-6 animate-spin" />
            正在加载作品...
          </div>

          <template v-else-if="detailItem">
            <div class="detail-content">
              <section class="detail-media-panel">
                <div v-if="currentDetailImage" class="detail-media">
                  <img :src="currentDetailImage" :alt="detailItem.title" />
                  <button
                    v-if="currentImageIndex > 0"
                    type="button"
                    class="gallery-button left"
                    title="上一张"
                    @click="prevImage"
                  >
                    <ChevronLeft class="w-5 h-5" />
                  </button>
                  <button
                    v-if="currentImageIndex < detailImages.length - 1"
                    type="button"
                    class="gallery-button right"
                    title="下一张"
                    @click="nextImage"
                  >
                    <ChevronRight class="w-5 h-5" />
                  </button>
                </div>
                <div v-else class="detail-media detail-media--empty">
                  <Type class="w-10 h-10" />
                  <span>文本作品</span>
                </div>

                <div v-if="detailImages.length > 1" class="thumbnail-strip">
                  <button
                    v-for="(image, idx) in detailImages"
                    :key="image"
                    type="button"
                    :class="{ active: currentImageIndex === idx }"
                    @click="currentImageIndex = idx"
                  >
                    <img :src="image" :alt="`${detailItem.title} ${idx + 1}`" />
                  </button>
                </div>
              </section>

              <section class="detail-info-panel">
                <div class="detail-title-row">
                  <span :class="['detail-type', getTypeClass(detailItem.type)]">
                    {{ getTypeLabel(detailItem.type) }}
                  </span>
                  <span :class="['detail-status', detailStatusMeta.tone]">
                    {{ detailStatusMeta.label }}
                  </span>
                </div>

                <div v-if="isEditingDetail" class="detail-edit-form">
                  <label>
                    <span>标题</span>
                    <input v-model="editForm.title" type="text" placeholder="作品标题" />
                  </label>

                  <div class="detail-edit-types">
                    <button
                      v-for="option in typeOptions.filter((item) => item.value !== 'all')"
                      :key="option.value"
                      type="button"
                      :class="[{ active: editForm.type === option.value }, getTypeClass(option.value)]"
                      @click="setEditType(option.value)"
                    >
                      <component :is="option.icon" class="w-3.5 h-3.5" />
                      {{ option.label }}
                    </button>
                  </div>

                  <label>
                    <span>标签</span>
                    <input v-model="editForm.tags" type="text" placeholder="Render, Cycles, Retro" />
                  </label>

                  <label v-if="editForm.type === 'VIDEO' || editForm.isVideo">
                    <span>视频链接</span>
                    <input v-model="editForm.videoUrl" type="url" placeholder="https://..." />
                  </label>

                  <label>
                    <span>作品说明</span>
                    <MarkdownEditor v-model="editForm.description" height="240px" simple />
                  </label>

                  <div class="detail-file-row">
                    <label>
                      <span>替换封面</span>
                      <input type="file" accept="image/*" @change="handleEditThumbnailChange" />
                      <small>{{ editThumbnail?.name || '保持当前封面' }}</small>
                    </label>
                    <label>
                      <span>补充图集</span>
                      <input type="file" accept="image/*" multiple @change="handleEditImagesChange" />
                      <small>{{ editImages.length ? `已选择 ${editImages.length} 张` : '可一次追加多张' }}</small>
                    </label>
                  </div>

                  <div class="detail-edit-actions">
                    <button type="button" class="primary" :disabled="isSavingDetail" @click="saveDetail">
                      <RefreshCw v-if="isSavingDetail" class="w-4 h-4 animate-spin" />
                      <Save v-else class="w-4 h-4" />
                      {{ isSavingDetail ? '保存中' : '保存修改' }}
                    </button>
                    <button type="button" @click="cancelEditDetail">取消</button>
                  </div>
                  <p class="detail-status-hint">{{ detailStatusMeta.hint }}</p>
                </div>

                <template v-else>
                  <h1>{{ detailItem.title }}</h1>

                  <div class="detail-author">
                    <UserAvatar :user="detailItem.user" size="md" />
                    <button type="button" class="detail-author-profile" @click="openUserProfile(detailItem.user.id)">
                      <strong>{{ detailItem.user.name || detailItem.user.email || '匿名创作者' }}</strong>
                      <span>{{ detailItem.user.bio || '查看创作者主页与更多作品' }}</span>
                    </button>
                    <button
                      v-if="detailItem.user.id !== authStore.user?.id"
                      type="button"
                      class="detail-author-chat"
                      title="私信创作者"
                      @click="handleStartChat(detailItem.user)"
                    >
                      <MessageCircle class="w-4 h-4" />
                    </button>
                  </div>

                  <div v-if="parseTags(detailItem.tags).length" class="detail-tags">
                    <button
                      v-for="tag in parseTags(detailItem.tags)"
                      :key="tag"
                      type="button"
                      @click="selectTag(tag)"
                    >
                      #{{ tag }}
                    </button>
                  </div>

                  <div class="detail-actions">
                    <button
                      type="button"
                      :class="{ liked: detailItem.isLiked }"
                      @click="toggleLike(detailItem)"
                    >
                      <Heart class="w-4 h-4" :class="{ 'fill-current': detailItem.isLiked }" />
                      {{ formatNumber(detailItem.likesCount) }}
                    </button>
                    <span><Eye class="w-4 h-4" />{{ formatNumber(detailItem.views) }}</span>
                    <span><MessageCircle class="w-4 h-4" />{{ formatNumber(detailItem.commentsCount) }}</span>
                    <span><Clock class="w-4 h-4" />{{ formatTime(detailItem.createdAt) }}</span>
                    <button type="button" @click="handleShare(detailItem)">
                      <component :is="shareCopied ? Check : Share2" class="w-4 h-4" />
                      {{ shareCopied ? '已复制' : '分享' }}
                    </button>
                  </div>

                  <a
                    v-if="detailItem.videoUrl"
                    :href="detailItem.videoUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="detail-link"
                  >
                    <Play class="w-4 h-4" />
                    打开视频源
                  </a>

                  <a
                    v-if="detailItem.asset?.url"
                    :href="getAssetUrl(detailItem.asset.url)"
                    download
                    class="detail-link"
                  >
                    <Download class="w-4 h-4" />
                    下载关联模型：{{ detailItem.asset.title }}
                  </a>

                  <div v-if="detailItem.description" class="detail-description">
                    <MdPreview :model-value="detailItem.description" class="md-preview-showcase" />
                  </div>
                  <p v-else class="detail-description-empty">创作者还没有填写详细说明。</p>

                  <div v-if="relatedLoading" class="comments-empty">
                    <RefreshCw class="w-4 h-4 animate-spin" />
                    正在匹配相关作品
                  </div>
                  <div v-else-if="similarShowcases.length" class="similar-strip">
                    <h3>相关作品</h3>
                    <button
                      v-for="item in similarShowcases"
                      :key="item.id"
                      type="button"
                      @click="openDetail(item)"
                    >
                      <img v-if="item.thumbnailUrl" :src="getAssetUrl(item.thumbnailUrl)" :alt="item.title" />
                      <span>{{ item.title }}</span>
                    </button>
                  </div>
                </template>
              </section>
            </div>

            <section class="comments-panel">
              <header>
                <h2>讨论区</h2>
                <span>{{ formatNumber(detailItem.commentsCount) }} 条评论</span>
              </header>

              <div class="comment-composer">
                <UserAvatar :user="authStore.user" size="sm" />
                <input
                  v-model="newComment"
                  type="text"
                  placeholder="写下反馈、问题或制作建议..."
                  @keyup.enter="submitComment"
                />
                <button
                  type="button"
                  :disabled="isSubmittingComment || !newComment.trim()"
                  title="发送评论"
                  @click="submitComment"
                >
                  <Send class="w-4 h-4" />
                </button>
              </div>

              <div v-if="commentsLoading" class="comments-empty">
                <RefreshCw class="w-5 h-5 animate-spin" />
                正在加载评论
              </div>
              <div v-else-if="!comments.length" class="comments-empty">还没有评论，来开第一句。</div>
              <div v-else class="comment-list">
                <article v-for="comment in comments" :key="comment.id" class="comment-item">
                  <UserAvatar :user="comment.user" size="sm" />
                  <div>
                    <header>
                      <strong>{{ comment.user.name || comment.user.email || '匿名用户' }}</strong>
                      <span>{{ formatTime(comment.createdAt) }}</span>
                      <button
                        v-if="comment.user.id === authStore.user?.id || isAdmin"
                        type="button"
                        title="删除评论"
                        @click="deleteComment(comment)"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </header>
                    <p>{{ comment.content }}</p>
                  </div>
                </article>
              </div>
            </section>
          </template>
        </aside>
      </div>
    </Transition>

    <PublishWorkDialog v-model="isPublishDialogOpen" @published="handlePublished" />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
    />
  </div>
</template>

<style scoped>
.showcase-view {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-app);
}

.showcase-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(720px, 100%);
}

.showcase-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 180px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-muted);
}

.showcase-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
}

.showcase-search input::placeholder {
  color: var(--text-muted);
}

.icon-button,
.publish-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border: 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 850;
  transition: transform 0.16s ease, background-color 0.16s ease;
}

.icon-button {
  width: 36px;
  color: var(--text-secondary);
  background: var(--bg-app);
  border: 1px solid var(--border-base);
}

.publish-button {
  gap: 6px;
  padding: 0 14px;
  color: white;
  background: var(--accent);
}

.icon-button:hover,
.publish-button:hover {
  transform: translateY(-1px);
}

.showcase-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
  flex: 1;
  padding: 16px;
  overflow: hidden;
}

.showcase-layout--with-rail {
  grid-template-columns: minmax(0, 1fr) minmax(290px, 330px);
}

.showcase-main,
.showcase-rail {
  min-height: 0;
  overflow-y: auto;
}

.showcase-main {
  padding-right: 2px;
}

.showcase-controls,
.results-head,
.rail-panel {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-enterprise);
}

.showcase-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(320px, 0.8fr);
  gap: 16px;
  min-height: 320px;
}

.hero-feature {
  position: relative;
  display: block;
  min-width: 0;
  min-height: 320px;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: white;
  background: #111827;
  text-align: left;
  box-shadow: 0 24px 60px rgb(15 23 42 / 0.18);
}

.hero-feature img {
  width: 100%;
  height: 100%;
  min-height: 320px;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.hero-feature:hover img {
  transform: scale(1.035);
}

.hero-feature__fallback,
.hero-feature--empty {
  display: grid;
  min-height: 320px;
  place-items: center;
  background:
    linear-gradient(135deg, rgb(17 24 39 / 0.88), rgb(36 54 72 / 0.92)),
    #111827;
}

.hero-feature__fallback svg {
  width: 58px;
  height: 58px;
  opacity: 0.72;
}

.hero-feature__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgb(0 0 0 / 0.74), rgb(0 0 0 / 0.22) 58%, rgb(0 0 0 / 0.04));
}

.hero-feature__content {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  max-width: 680px;
  flex-direction: column;
  gap: 12px;
  padding: 32px;
}

.hero-kicker,
.hero-meta,
.hero-meta span {
  display: inline-flex;
  align-items: center;
}

.hero-kicker {
  gap: 7px;
  width: max-content;
  max-width: 100%;
  height: 30px;
  padding: 0 11px;
  border: 1px solid rgb(255 255 255 / 0.22);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.14);
  font-size: 12px;
  font-weight: 900;
  backdrop-filter: blur(10px);
}

.hero-feature h1,
.hero-feature p,
.gallery-title h2,
.gallery-title p {
  margin: 0;
}

.hero-feature h1 {
  display: -webkit-box;
  overflow: hidden;
  font-size: 34px;
  font-weight: 950;
  line-height: 1.12;
  text-wrap: balance;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.hero-feature p {
  display: -webkit-box;
  max-width: 560px;
  overflow: hidden;
  color: rgb(255 255 255 / 0.78);
  font-size: 14px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.hero-meta {
  flex-wrap: wrap;
  gap: 10px;
  color: rgb(255 255 255 / 0.84);
  font-size: 12px;
  font-weight: 850;
}

.hero-meta span {
  gap: 5px;
  min-width: 0;
}

.hero-feature--empty {
  align-content: center;
  gap: 10px;
  color: rgb(255 255 255 / 0.82);
  text-align: center;
}

.hero-feature--empty h1 {
  font-size: 24px;
}

.hero-feature--empty p {
  max-width: 320px;
}

.gallery-curation {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
}

.gallery-title {
  min-width: 0;
}

.gallery-title span {
  color: var(--accent);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0;
  text-transform: uppercase;
}

.gallery-title h2 {
  margin-top: 6px;
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 950;
  line-height: 1.1;
}

.gallery-title p {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 800;
}

.gallery-stat-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.gallery-stat-strip div {
  min-width: 0;
  padding: 13px 14px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.gallery-stat-strip strong,
.gallery-stat-strip span {
  display: block;
}

.gallery-stat-strip strong {
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 950;
  line-height: 1;
}

.gallery-stat-strip span {
  margin-top: 7px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 850;
}

.curated-strip {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.curated-strip button {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0;
  border: 0;
  color: var(--text-primary);
  background: transparent;
  text-align: left;
}

.curated-strip img,
.curated-strip span {
  width: 68px;
  height: 48px;
  border-radius: 7px;
}

.curated-strip img {
  object-fit: cover;
}

.curated-strip span {
  display: grid;
  place-items: center;
  color: white;
  background: #1f2937;
}

.curated-strip span svg {
  width: 20px;
  height: 20px;
}

.curated-strip strong {
  display: -webkit-box;
  overflow: hidden;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.showcase-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  box-shadow: var(--shadow-enterprise);
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.controls-row--primary {
  border-bottom: 1px solid var(--border-base);
  padding-bottom: 12px;
}

.divider-v {
  width: 1px;
  height: 20px;
  background: var(--border-base);
  flex-shrink: 0;
}

.scope-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-app);
  padding: 3px;
  border-radius: 6px;
  border: 1px solid var(--border-base);
  flex-shrink: 0;
}

.scope-strip button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.scope-strip button.active {
  color: var(--accent);
  background: var(--bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.type-strip-container,
.sort-strip-container {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.right-actions-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.view-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-app);
  padding: 3px;
  border-radius: 6px;
  border: 1px solid var(--border-base);
}

.view-switch button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  transition: all 0.15s ease;
}

.view-switch button.active {
  color: var(--accent);
  background: var(--bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.sort-strip,
.type-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.sort-strip::-webkit-scrollbar,
.type-strip::-webkit-scrollbar {
  display: none;
}

.sort-strip button,
.type-strip button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.sort-strip button:hover,
.type-strip button:hover {
  background: var(--bg-hover);
}

.sort-strip button.active,
.type-strip button.active {
  color: var(--accent);
  background: var(--accent-subtle);
  border-color: color-mix(in srgb, var(--accent) 25%, var(--border-base));
}

.control-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.tone-blue {
  --tone-color: #2563eb;
}

.tone-green {
  --tone-color: #059669;
}

.tone-rose {
  --tone-color: #e11d48;
}

.tone-amber {
  --tone-color: #d97706;
}

.tone-slate {
  --tone-color: #64748b;
}

.type-strip button.active {
  color: var(--tone-color);
  background: color-mix(in srgb, var(--tone-color) 10%, transparent);
  border-color: color-mix(in srgb, var(--tone-color) 32%, var(--border-base));
}

.stat-tile,
.rail-title {
  display: flex;
  align-items: center;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.command-stat-grid {
  align-content: stretch;
}

.stat-tile {
  gap: 8px;
  min-width: 0;
  padding: 9px;
  border: 1px solid color-mix(in srgb, var(--tone-color) 20%, var(--border-base));
  border-radius: 7px;
  background: color-mix(in srgb, var(--tone-color) 7%, transparent);
}

.stat-tile > svg {
  color: var(--tone-color);
}

.stat-tile strong,
.stat-tile span,
.stat-tile small {
  display: block;
}

.command-side {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.mini-panel {
  min-width: 0;
  padding: 9px;
  border: 1px solid var(--border-base);
  border-radius: 7px;
  background: var(--bg-app);
}

.mini-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.stat-tile strong {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 900;
  line-height: 1;
}

.stat-tile span {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 850;
}

.smart-filter-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.smart-filter-strip button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border-base);
  border-radius: 999px; /* Pill style */
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 12px;
  font-weight: 850;
  transition: all 0.2s ease;
}

.smart-filter-strip button svg {
  color: var(--text-muted);
}

.smart-filter-strip button span {
  white-space: nowrap;
}

.smart-filter-strip button b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 12%, transparent);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 900;
  margin-left: 2px;
}

.smart-filter-strip button.active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border-base));
  background: var(--accent-subtle);
}

.smart-filter-strip button.active svg {
  color: var(--accent);
}

.smart-filter-strip button.active b {
  background: var(--accent);
  color: white;
}

.stat-tile small {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 10px;
}

.results-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding: 12px 14px;
}

.results-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.results-head h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 900;
}

.results-head p {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
}

.clear-search {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 12px;
  font-weight: 850;
}

.review-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, #d97706 25%, var(--border-base));
  border-radius: 6px;
  color: #b45309;
  background: color-mix(in srgb, #d97706 9%, transparent);
  font-size: 11px;
  font-weight: 900;
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 14px;
  padding-bottom: 22px;
}

.showcase-grid.dense {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.skeleton-card {
  min-height: 286px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background:
    linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-muted) 8%, transparent), transparent),
    var(--bg-card);
  background-size: 220px 100%, auto;
  animation: shimmer 1.2s infinite linear;
}

@keyframes shimmer {
  from {
    background-position: -220px 0, 0 0;
  }
  to {
    background-position: calc(100% + 220px) 0, 0 0;
  }
}

.empty-state {
  display: flex;
  min-height: 260px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--bg-card);
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 900;
}

.empty-state p {
  max-width: 360px;
  margin: 0;
  text-align: center;
  font-size: 12px;
}

.empty-state button,
.load-more-row button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  color: white;
  background: var(--accent);
  font-size: 13px;
  font-weight: 900;
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding: 4px 0 22px;
}

.showcase-rail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
}

.rail-panel {
  padding: 12px;
}

.rail-title {
  gap: 7px;
  margin-bottom: 10px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.creator-list,
.activity-list,
.type-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.creator-list button,
.activity-list button,
.type-bars button {
  min-width: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
}

.creator-list button {
  display: grid;
  grid-template-columns: 22px 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 4px;
}

.creator-list button:hover,
.activity-list button:hover,
.type-bars button:hover {
  background: var(--bg-hover);
}

.rank {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 5px;
  color: var(--accent);
  background: var(--accent-subtle);
  font-size: 11px;
  font-weight: 900;
}

.creator-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-list small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 850;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 132px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 11px;
  font-weight: 850;
}

.tag-cloud--compact button {
  max-width: 116px;
  height: 24px;
  padding: 0 7px;
  font-size: 10px;
}

.tag-cloud button span {
  color: var(--text-muted);
  font-size: 10px;
}

.activity-list button {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 4px;
}

.activity-list span {
  display: block;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.45;
}

.activity-list strong {
  color: var(--text-primary);
}

.activity-list small {
  display: block;
  margin-top: 2px;
  color: var(--text-muted);
}

.type-bars button {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  overflow: hidden;
  padding: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 850;
}

.type-bars--compact {
  gap: 4px;
}

.type-bars--compact button {
  padding: 6px 7px;
  font-size: 11px;
}

.type-bars button span,
.type-bars button strong {
  position: relative;
  z-index: 1;
}

.type-bars button i {
  position: absolute;
  inset: auto auto 0 0;
  height: 2px;
  border-radius: 999px;
  background: var(--accent);
}

.rail-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.detail-layer {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
}

.detail-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(15 23 42 / 0.45);
}

.detail-drawer {
  position: relative;
  z-index: 1;
  display: flex;
  width: min(1120px, calc(100vw - 48px));
  height: 100%;
  flex-direction: column;
  background: var(--bg-card);
  border-left: 1px solid var(--border-base);
  box-shadow: -24px 0 56px rgb(15 23 42 / 0.18);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 58px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-base);
}

.detail-header span,
.detail-header strong {
  display: block;
}

.detail-header span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 850;
}

.detail-header strong {
  max-width: 720px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-header button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  color: var(--text-secondary);
  background: var(--bg-app);
}

.detail-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-header button.danger {
  color: #e11d48;
}

.detail-header button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.detail-loading {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 850;
}

.detail-content {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) 390px;
  gap: 14px;
  min-height: 0;
  padding: 14px;
  overflow-y: auto;
}

.detail-media-panel,
.detail-info-panel,
.comments-panel {
  min-width: 0;
}

.detail-media {
  position: relative;
  display: grid;
  min-height: 440px;
  overflow: hidden;
  place-items: center;
  border-radius: 8px;
  background: #0f172a;
}

.detail-media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.detail-media--empty {
  color: white;
  font-weight: 900;
}

.gallery-button {
  position: absolute;
  top: 50%;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  color: white;
  background: rgb(0 0 0 / 0.48);
  transform: translateY(-50%);
}

.gallery-button.left {
  left: 12px;
}

.gallery-button.right {
  right: 12px;
}

.thumbnail-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.thumbnail-strip button {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 6px;
  background: var(--bg-app);
}

.thumbnail-strip button.active {
  border-color: var(--accent);
}

.thumbnail-strip img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-info-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-title-row,
.detail-actions,
.detail-link {
  display: flex;
  align-items: center;
}

.detail-title-row {
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 850;
}

.detail-type {
  padding: 4px 7px;
  border-radius: 5px;
  color: white;
  background: var(--tone-color);
}

.detail-status {
  padding: 4px 7px;
  border-radius: 5px;
  font-weight: 900;
}

.status-approved {
  color: #047857;
  background: color-mix(in srgb, #059669 12%, transparent);
}

.status-pending {
  color: #b45309;
  background: color-mix(in srgb, #d97706 14%, transparent);
}

.status-rejected {
  color: #be123c;
  background: color-mix(in srgb, #e11d48 12%, transparent);
}

.detail-info-panel h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 950;
  line-height: 1.22;
}

.detail-author {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.detail-author-profile {
  flex: 1;
  min-width: 0;
  border: 0;
  color: inherit;
  text-align: left;
  background: transparent;
}

.detail-author-chat {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border-base));
  border-radius: 7px;
  color: var(--accent);
  background: var(--accent-subtle);
}

.detail-author strong,
.detail-author span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-edit-form label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.detail-edit-form input {
  min-width: 0;
  height: 38px;
  padding: 0 11px;
  border: 1px solid var(--border-base);
  border-radius: 7px;
  outline: 0;
  color: var(--text-primary);
  background: var(--bg-app);
  font-size: 13px;
}

.detail-edit-types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-edit-types button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 12px;
  font-weight: 850;
}

.detail-edit-types button.active {
  color: var(--tone-color);
  border-color: color-mix(in srgb, var(--tone-color) 32%, var(--border-base));
  background: color-mix(in srgb, var(--tone-color) 10%, transparent);
}

.detail-file-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.detail-file-row label {
  min-height: 78px;
  padding: 10px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.detail-file-row input {
  height: auto;
  padding: 0;
  border: 0;
  font-size: 11px;
}

.detail-file-row small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-edit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-edit-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-base);
  border-radius: 7px;
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 12px;
  font-weight: 900;
}

.detail-edit-actions button.primary {
  border-color: transparent;
  color: white;
  background: var(--accent);
}

.detail-status-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.6;
}

.detail-author strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.detail-author span {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-tags button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border-base));
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-subtle);
  font-size: 11px;
  font-weight: 850;
}

.detail-actions {
  flex-wrap: wrap;
  gap: 8px;
}

.detail-actions button,
.detail-actions span,
.detail-link {
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 7px;
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 12px;
  font-weight: 850;
  text-decoration: none;
}

.detail-actions button.liked {
  color: #e11d48;
}

.detail-link {
  justify-content: center;
  color: var(--accent);
}

.detail-description {
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.detail-description-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.md-preview-showcase {
  background: transparent !important;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.75;
}

.md-preview-showcase :deep(.md-editor-preview-wrapper) {
  padding: 0 !important;
}

.similar-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.similar-strip h3 {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.similar-strip button {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px;
  border: 1px solid var(--border-base);
  border-radius: 7px;
  color: var(--text-primary);
  background: var(--bg-app);
  font-size: 11px;
  font-weight: 850;
  text-align: left;
}

.similar-strip img {
  width: 44px;
  height: 34px;
  border-radius: 5px;
  object-fit: cover;
}

.similar-strip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comments-panel {
  padding: 0 14px 16px;
}

.comments-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid var(--border-base);
}

.comments-panel h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 900;
}

.comments-panel header span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 850;
}

.comment-composer {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 34px;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.comment-composer input {
  height: 34px;
  min-width: 0;
  border: 0;
  outline: 0;
  border-radius: 6px;
  padding: 0 10px;
  color: var(--text-primary);
  background: var(--bg-card);
}

.comment-composer button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  color: white;
  background: var(--accent);
}

.comment-composer button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.comments-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 92px;
  color: var(--text-muted);
  font-size: 12px;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.comment-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 8px;
}

.comment-item header {
  display: flex;
  align-items: center;
  gap: 7px;
}

.comment-item strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.comment-item span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
}

.comment-item header button {
  margin-left: auto;
  border: 0;
  color: #e11d48;
  background: transparent;
}

.comment-item p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.detail-fade-enter-active,
.detail-fade-leave-active {
  transition: opacity 0.2s ease;
}

.detail-fade-enter-from,
.detail-fade-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .showcase-layout {
    display: block;
    overflow-y: auto;
  }

  .showcase-hero {
    grid-template-columns: 1fr;
  }

  .gallery-curation {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(300px, 1.1fr);
    align-items: start;
  }

  .curated-strip {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .showcase-main,
  .showcase-rail {
    overflow: visible;
  }

  .showcase-rail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 10px;
  }
}

@media (max-width: 900px) {
  .showcase-layout {
    padding: 8px;
  }

  .hero-feature,
  .hero-feature img,
  .hero-feature__fallback,
  .hero-feature--empty {
    min-height: 280px;
  }

  .hero-feature__content {
    padding: 22px;
  }

  .hero-feature h1 {
    font-size: 28px;
  }

  .gallery-curation {
    grid-template-columns: 1fr;
  }

  .curated-strip {
    grid-template-columns: 1fr;
  }

  .detail-content {
    grid-template-columns: 1fr;
  }

  .showcase-controls {
    padding: 8px !important;
    gap: 8px !important;
    margin-top: 10px !important;
  }

  .controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: 6px !important;
  }

  .controls-row--primary {
    border-bottom: none;
    padding-bottom: 0;
  }

  .divider-v {
    display: none;
  }

  .right-actions-group {
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px !important;
  }

  .type-strip button,
  .sort-strip button,
  .scope-strip button,
  .smart-filter-strip button {
    height: 24px !important;
    padding: 0 8px !important;
    font-size: 11px !important;
  }

  .detail-drawer {
    width: 100%;
  }

  .detail-media {
    min-height: 320px;
  }
}

@media (max-width: 640px) {
  .showcase-header-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .showcase-search {
    flex-basis: 100%;
    order: 2;
  }

  .publish-button {
    padding: 0 10px;
  }

  .showcase-hero,
  .showcase-controls,
  .results-head,
  .rail-panel {
    border-radius: 7px;
  }

  .hero-feature,
  .hero-feature img,
  .hero-feature__fallback,
  .hero-feature--empty {
    min-height: 240px;
  }

  .hero-feature__shade {
    background: linear-gradient(180deg, rgb(0 0 0 / 0.18), rgb(0 0 0 / 0.78));
  }

  .hero-feature__content {
    gap: 9px;
    padding: 18px;
  }

  .hero-feature h1 {
    font-size: 24px;
  }

  .hero-feature p {
    font-size: 13px;
    -webkit-line-clamp: 2;
  }

  .gallery-title h2 {
    font-size: 22px;
  }

  .gallery-stat-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .showcase-rail {
    grid-template-columns: 1fr;
  }

  .results-head {
    align-items: stretch;
    flex-direction: column;
    margin-top: 8px !important;
    padding: 6px 10px !important;
  }

  .results-actions {
    justify-content: flex-start;
  }

  .showcase-grid,
  .showcase-grid.dense {
    grid-template-columns: 1fr;
  }

  .detail-content {
    padding: 10px;
  }

  .detail-file-row,
  .similar-strip {
    grid-template-columns: 1fr;
  }

  .comments-panel {
    padding: 0 10px 14px;
  }
}
</style>

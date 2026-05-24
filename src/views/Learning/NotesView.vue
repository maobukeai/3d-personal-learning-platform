<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import {
  Plus,
  Search,
  Eye,
  ThumbsUp,
  Trash2,
  Edit3,
  BookOpen,
  Notebook,
  Copy,
  Check,
  Settings,
  Layout,
  Star,
  FolderPlus,
  Folder,
  MessageSquare,
  Flame,
  Bookmark,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import PageHeader from '@/components/PageHeader.vue';

const authStore = useAuthStore();

const previewMode = ref<'edit' | 'live' | 'preview'>('edit');

interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  visibility: string;
  tags?: string;
  category?: string;
  views: number;
  isPinned: boolean;
  isPopular: boolean;
  isLiked: boolean;
  userId: string;
  _count: { likes: number; comments: number };
  user: { id: string; name: string; avatarUrl: string; bio?: string };
  createdAt: string;
  updatedAt: string;
}

const activeTab = ref<'MY' | 'POPULAR' | 'ACTIVITY'>('MY');
const notes = ref<Note[]>([]);
const tags = ref<string[]>([]);
const categories = ref<string[]>([]);
const loading = ref(false);
const totalNotes = ref(0);
const currentPage = ref(1);
const pageSize = 12;
const searchQuery = ref('');
const sortBy = ref('latest');
const filterTag = ref('');
const filterCategory = ref('');

// Sidebar & Notebook state
const localNotebooks = ref<string[]>([]);
const newNotebookName = ref('');
const showAddNotebookDialog = ref(false);

const loadLocalNotebooks = () => {
  const userId = authStore.user?.id;
  if (!userId) return;
  try {
    const saved = localStorage.getItem(`my_custom_notebooks_${userId}`);
    if (saved) {
      localNotebooks.value = JSON.parse(saved);
    } else {
      localNotebooks.value = [];
    }
  } catch (e) {
    console.error('Failed to load local notebooks', e);
  }
};

const saveLocalNotebooks = () => {
  const userId = authStore.user?.id;
  if (!userId) return;
  try {
    localStorage.setItem(`my_custom_notebooks_${userId}`, JSON.stringify(localNotebooks.value));
  } catch (e) {
    console.error('Failed to save local notebooks', e);
  }
};

const addNotebook = () => {
  if (!newNotebookName.value.trim()) return;
  const name = newNotebookName.value.trim();
  if (localNotebooks.value.includes(name) || categories.value.includes(name)) {
    ElMessage.warning('该笔记本已存在');
    return;
  }
  localNotebooks.value.push(name);
  saveLocalNotebooks();
  ElMessage.success(`笔记本「${name}」创建成功！`);
  newNotebookName.value = '';
  showAddNotebookDialog.value = false;
};

// Compute dynamic list of my notebooks
const myNotebooksList = computed(() => {
  const set = new Set<string>();
  notes.value.forEach((note) => {
    if (note.category && note.userId === authStore.user?.id) {
      set.add(note.category);
    }
  });
  categories.value.forEach((c) => {
    if (c) set.add(c);
  });
  localNotebooks.value.forEach((c) => set.add(c));
  return Array.from(set).filter(Boolean);
});

// Select notebook filter
const selectNotebook = (notebookName: string) => {
  if (notebookName === 'ALL') {
    filterCategory.value = '';
  } else if (notebookName === 'UNCATEGORIZED') {
    filterCategory.value = '__uncategorized__';
  } else {
    filterCategory.value = notebookName;
  }
  currentPage.value = 1;
  loadNotes();
};

// Comment states
const noteCommentsMap = ref<Record<string, any[]>>({});
const activeCommentsNoteId = ref<string | null>(null);
const commentInputText = ref('');
const commentsLoading = ref<Record<string, boolean>>({});

const toggleComments = async (note: Note) => {
  if (activeCommentsNoteId.value === note.id) {
    activeCommentsNoteId.value = null;
    return;
  }
  activeCommentsNoteId.value = note.id;
  if (!noteCommentsMap.value[note.id]) {
    commentsLoading.value[note.id] = true;
    try {
      const res = await api.get(`/api/notes/${note.id}/comments`);
      noteCommentsMap.value[note.id] = res.data;
    } catch {
      ElMessage.error('加载评论失败');
    } finally {
      commentsLoading.value[note.id] = false;
    }
  }
};

const submitComment = async (note: Note) => {
  if (!commentInputText.value.trim()) return;
  try {
    const res = await api.post(`/api/notes/${note.id}/comment`, {
      content: commentInputText.value.trim(),
    });
    if (!noteCommentsMap.value[note.id]) {
      noteCommentsMap.value[note.id] = [];
    }
    noteCommentsMap.value[note.id].push(res.data);
    commentInputText.value = '';
    
    // Increment comments count locally
    if (note._count) {
      note._count.comments = (note._count.comments || 0) + 1;
    } else {
      (note as any)._count = { likes: 0, comments: 1 };
    }
    ElMessage.success('发布评论成功');
  } catch {
    ElMessage.error('发布评论失败');
  }
};

const handleDeleteComment = async (note: Note, commentId: string) => {
  try {
    await api.delete(`/api/notes/comment/${commentId}`);
    noteCommentsMap.value[note.id] = noteCommentsMap.value[note.id].filter(
      (c) => c.id !== commentId
    );
    if (note._count && note._count.comments > 0) {
      note._count.comments--;
    }
    ElMessage.success('评论已删除');
  } catch {
    ElMessage.error('删除评论失败');
  }
};

// Cloning / 一键转存 states & functions
const showCloneDialog = ref(false);
const cloningNote = ref<Note | null>(null);
const targetCategory = ref('');
const cloning = ref(false);

const openCloneDialog = (note: Note) => {
  cloningNote.value = note;
  targetCategory.value = note.category || '';
  showCloneDialog.value = true;
};

const handleClone = async () => {
  if (!cloningNote.value) return;
  cloning.value = true;
  try {
    const payload = {
      title: cloningNote.value.title,
      content: cloningNote.value.content,
      summary: cloningNote.value.summary || undefined,
      visibility: 'PRIVATE',
      category: targetCategory.value.trim() || '默认笔记本',
      tags: cloningNote.value.tags || undefined,
    };
    await api.post('/api/notes', payload);
    ElMessage.success(`已成功转存至笔记本「${targetCategory.value.trim() || '默认笔记本'}」！`);
    
    if (targetCategory.value.trim()) {
      const cat = targetCategory.value.trim();
      if (!localNotebooks.value.includes(cat) && !categories.value.includes(cat)) {
        localNotebooks.value.push(cat);
        saveLocalNotebooks();
      }
    }

    showCloneDialog.value = false;
    
    await loadTagsAndCategories();
    if (activeTab.value === 'MY') {
      await loadNotes();
    }
  } catch {
    ElMessage.error('转存失败');
  } finally {
    cloning.value = false;
  }
};

// Drag and drop notebook management
const draggedNote = ref<Note | null>(null);
const draggedNotebook = ref<string | null>(null);

const handleDragStart = (event: DragEvent, note: Note) => {
  draggedNote.value = note;
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', note.id);
    event.dataTransfer.effectAllowed = 'move';
  }
};

const handleDrop = async (event: DragEvent, targetNotebookName: string) => {
  event.preventDefault();
  draggedNotebook.value = null;
  if (!draggedNote.value) return;

  const noteId = draggedNote.value.id;
  let categoryToSend = targetNotebookName;
  if (targetNotebookName === 'ALL') {
    draggedNote.value = null;
    return;
  } else if (targetNotebookName === 'UNCATEGORIZED') {
    categoryToSend = '';
  }

  try {
    const payload = {
      category: categoryToSend || null,
    };
    await api.put(`/api/notes/${noteId}`, payload);
    ElMessage.success(`已成功移动笔记至「${targetNotebookName === 'UNCATEGORIZED' ? '未分类' : targetNotebookName}」！`);

    // Optimistic local update
    const idx = notes.value.findIndex((n) => n.id === noteId);
    if (idx !== -1) {
      notes.value[idx].category = categoryToSend || undefined;
    }

    // Refresh categories & list
    await loadTagsAndCategories();
    await loadNotes();
  } catch {
    ElMessage.error('移动笔记本失败');
  } finally {
    draggedNote.value = null;
  }
};

const showCreateDialog = ref(false);
const showDetailDialog = ref(false);
const editingNote = ref<Note | null>(null);
const detailNote = ref<Note | null>(null);
const formTitle = ref('');
const formContent = ref('');
const formSummary = ref('');
const formVisibility = ref('PRIVATE');
const formTags = ref('');
const formCategory = ref('');
const saving = ref(false);
const isCopying = ref(false);

const handleCopy = async () => {
  if (!detailNote.value) return;
  try {
    await navigator.clipboard.writeText(detailNote.value.content);
    isCopying.value = true;
    ElMessage.success('已复制全文到剪贴板');
    setTimeout(() => {
      isCopying.value = false;
    }, 2000);
  } catch {
    ElMessage.error('复制失败');
  }
};

const dailyQuotes = [
  "学而不思则罔，思而不学则殆。记录每一次心得，都是成长的印记。",
  "成功的秘诀在于持之以恒的积累。每一篇笔记都是通往精通的阶梯。",
  "将复杂的知识写下来、讲出来，这是最顶级的学习方法——费曼学习法。",
  "智能的本质不在于获取多少现成答案，而在于探索未知的过程。—— 爱因斯坦",
  "精于工，匠于心；创于想，行于行。保持好奇，不断打磨你的3D视界！"
];
const dailyQuote = computed(() => {
  const day = new Date().getDate();
  return dailyQuotes[day % dailyQuotes.length];
});

const topContributors = computed(() => {
  const counts: Record<string, { user: any; count: number }> = {};
  notes.value.forEach((note) => {
    if (note.user && note.user.id) {
      const uid = note.user.id;
      if (!counts[uid]) {
        counts[uid] = { user: note.user, count: 0 };
      }
      counts[uid].count++;
    }
  });
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
});

const totalPages = computed(() => Math.ceil(totalNotes.value / pageSize));

const loadNotes = async () => {
  loading.value = true;
  try {
    let endpoint = '/api/notes';
    const params: any = {
      page: currentPage.value,
      limit: pageSize,
      sort: sortBy.value,
    };

    if (activeTab.value === 'MY') {
      params.author = 'me';
    } else if (activeTab.value === 'ACTIVITY') {
      params.visibility = 'PUBLIC';
    } else if (activeTab.value === 'POPULAR') {
      endpoint = '/api/notes/popular';
    }

    if (searchQuery.value) params.search = searchQuery.value;
    if (filterTag.value) params.tag = filterTag.value;
    if (filterCategory.value) params.category = filterCategory.value;

    const res = await api.get(endpoint, { params });
    if (activeTab.value === 'POPULAR') {
      notes.value = res.data;
      totalNotes.value = res.data.length;
    } else {
      notes.value = res.data.notes;
      totalNotes.value = res.data.pagination.total;
    }
  } catch {
    ElMessage.error('加载笔记失败');
  } finally {
    loading.value = false;
  }
};

const handleTabChange = () => {
  currentPage.value = 1;
  loadNotes();
};

const loadTagsAndCategories = async () => {
  try {
    const [tagsRes, catRes] = await Promise.all([
      api.get('/api/notes/tags'),
      api.get('/api/notes/categories'),
    ]);
    tags.value = tagsRes.data.tags || [];
    categories.value = catRes.data.categories || [];
  } catch {
    // Ignore error
  }
};

const openCreateDialog = () => {
  editingNote.value = null;
  formTitle.value = '';
  formContent.value = '';
  formSummary.value = '';
  formVisibility.value = 'PRIVATE';
  formTags.value = '';
  formCategory.value = '';
  showCreateDialog.value = true;
};

const openEditDialog = (note: Note) => {
  editingNote.value = note;
  formTitle.value = note.title;
  formContent.value = note.content;
  formSummary.value = note.summary || '';
  formVisibility.value = note.visibility;
  formTags.value = note.tags
    ? Array.isArray(JSON.parse(note.tags))
      ? JSON.parse(note.tags).join(', ')
      : note.tags
    : '';
  formCategory.value = note.category || '';
  showCreateDialog.value = true;
};

const handleSave = async () => {
  if (!formTitle.value.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  if (!formContent.value.trim()) {
    ElMessage.warning('请输入内容');
    return;
  }

  saving.value = true;
  try {
    const payload = {
      title: formTitle.value.trim(),
      content: formContent.value.trim(),
      summary: formSummary.value.trim() || undefined,
      visibility: formVisibility.value,
      tags: formTags.value
        ? JSON.stringify(
            formTags.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          )
        : undefined,
      category: formCategory.value.trim() || undefined,
    };

    if (editingNote.value) {
      await api.put(`/api/notes/${editingNote.value.id}`, payload);
      ElMessage.success('笔记已更新');
    } else {
      await api.post('/api/notes', payload);
      ElMessage.success('笔记已创建');
    }

    if (formCategory.value.trim()) {
      const cat = formCategory.value.trim();
      if (!localNotebooks.value.includes(cat) && !categories.value.includes(cat)) {
        localNotebooks.value.push(cat);
        saveLocalNotebooks();
      }
    }

    showCreateDialog.value = false;
    await loadNotes();
    await loadTagsAndCategories();
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const handleDelete = async (note: Note) => {
  try {
    await ElMessageBox.confirm('确定要删除这条笔记吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/notes/${note.id}`);
    ElMessage.success('笔记已删除');
    await loadNotes();
  } catch {
    // Ignore error
  }
};

const handleTogglePopular = async (note: Note) => {
  try {
    const res = await api.post(`/api/notes/${note.id}/popular`);
    note.isPopular = res.data.isPopular;
    ElMessage.success(note.isPopular ? '已推荐该笔记为热门！' : '已取消该热门推荐');
    
    // Synced reactive list update
    const idx = notes.value.findIndex((n) => n.id === note.id);
    if (idx !== -1) {
      notes.value[idx].isPopular = res.data.isPopular;
    }
    
    if (activeTab.value === 'POPULAR') {
      loadNotes();
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败');
  }
};

const handleLike = async (note: Note) => {
  try {
    const res = await api.post(`/api/notes/${note.id}/like`);
    note.isLiked = res.data.isLiked;
    if (res.data.isLiked) {
      note._count.likes++;
    } else {
      note._count.likes--;
    }
  } catch {
    ElMessage.error('操作失败');
  }
};

const viewDetail = async (note: Note) => {
  try {
    const res = await api.get(`/api/notes/${note.id}`);
    detailNote.value = res.data;
    showDetailDialog.value = true;
    const idx = notes.value.findIndex((n) => n.id === note.id);
    if (idx !== -1) {
      notes.value[idx].views = res.data.views;
      notes.value[idx].isLiked = res.data.isLiked;
    }
  } catch {
    ElMessage.error('加载笔记详情失败');
  }
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  loadNotes();
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getVisibilityLabel = (v: string) => (v === 'PUBLIC' ? '公开' : '私有');
const getVisibilityTag = (v: string) => (v === 'PUBLIC' ? 'success' : 'info');

const parseTags = (note: Note): string[] => {
  if (!note.tags) return [];
  try {
    const parsed = JSON.parse(note.tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return note.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
};

const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  loadLocalNotebooks();
  loadNotes();
  loadTagsAndCategories();
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header Section -->
    <PageHeader
      title="学习笔记"
      subtitle="记录学习心得，分享知识见解"
      :icon="Notebook"
    >
      <button
        class="bg-accent hover:bg-accent-dark text-white px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all active:scale-95 shadow-lg shadow-accent/20 shrink-0 w-full sm:w-auto cursor-pointer"
        @click="openCreateDialog"
      >
        <Plus class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>发布笔记</span>
      </button>
    </PageHeader>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-2.5 sm:p-4 lg:p-4.5">
      <div class="max-w-[1600px] mx-auto">
        <div class="mb-1.5 md:mb-2">
          <el-tabs v-model="activeTab" class="custom-note-tabs" @tab-change="handleTabChange">
            <el-tab-pane label="我的" name="MY" />
            <el-tab-pane label="动态" name="ACTIVITY" />
            <el-tab-pane label="热门" name="POPULAR" />
          </el-tabs>
        </div>

        <div class="flex flex-col md:flex-row gap-4.5 items-start">
          <!-- Left side Notebook List for MY Tab (Desktop) -->
          <aside
            v-if="activeTab === 'MY'"
            class="hidden md:flex flex-col w-60 shrink-0 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-3.5 space-y-3.5 shadow-sm"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <Notebook class="w-4 h-4 text-accent" /> 笔记本管理
              </span>
              <button
                class="text-accent hover:text-accent-dark hover:bg-accent/5 p-1 rounded-lg transition-all cursor-pointer"
                title="新建笔记本"
                @click="showAddNotebookDialog = true"
              >
                <FolderPlus class="w-4 h-4" />
              </button>
            </div>
            
            <div class="flex flex-col gap-1 max-h-[500px] overflow-y-auto custom-scrollbar">
              <!-- All Notes -->
              <button
                class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 text-left w-full cursor-pointer border border-transparent"
                :class="[
                  !filterCategory ? 'bg-accent/10 text-accent font-black border-accent/10' : 'text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5',
                  draggedNotebook === 'ALL' ? 'bg-accent/20 text-accent border-accent/30 shadow-sm' : ''
                ]"
                @click="selectNotebook('ALL')"
                @dragover.prevent
                @dragenter.prevent="draggedNotebook = 'ALL'"
                @dragleave="draggedNotebook = null"
                @drop="handleDrop($event, 'ALL')"
              >
                <span class="flex items-center gap-2 truncate">
                  <Folder class="w-3.5 h-3.5" :class="[!filterCategory ? 'text-accent' : 'text-[var(--text-muted)]']" /> 全部笔记
                </span>
              </button>
              
              <!-- Uncategorized -->
              <button
                class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 text-left w-full cursor-pointer border border-transparent"
                :class="[
                  filterCategory === '__uncategorized__' ? 'bg-accent/10 text-accent font-black border-accent/10' : 'text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5',
                  draggedNotebook === 'UNCATEGORIZED' ? 'bg-accent/20 text-accent border-accent/30 shadow-sm' : ''
                ]"
                @click="selectNotebook('UNCATEGORIZED')"
                @dragover.prevent
                @dragenter.prevent="draggedNotebook = 'UNCATEGORIZED'"
                @dragleave="draggedNotebook = null"
                @drop="handleDrop($event, 'UNCATEGORIZED')"
              >
                <span class="flex items-center gap-2 truncate">
                  <Folder class="w-3.5 h-3.5" :class="[filterCategory === '__uncategorized__' ? 'text-accent' : 'text-[var(--text-muted)]']" /> 未分类
                </span>
              </button>
              
              <!-- Dynamic Categories / Notebooks -->
              <button
                v-for="cat in myNotebooksList"
                :key="cat"
                class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 text-left w-full cursor-pointer border border-transparent"
                :class="[
                  filterCategory === cat ? 'bg-accent/10 text-accent font-black border-accent/10' : 'text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5',
                  draggedNotebook === cat ? 'bg-accent/20 text-accent border-accent/30 shadow-sm' : ''
                ]"
                @click="selectNotebook(cat)"
                @dragover.prevent
                @dragenter.prevent="draggedNotebook = cat"
                @dragleave="draggedNotebook = null"
                @drop="handleDrop($event, cat)"
              >
                <span class="flex items-center gap-2 truncate">
                  <Folder class="w-3.5 h-3.5" :class="[filterCategory === cat ? 'text-accent' : 'text-[var(--text-muted)]']" /> {{ cat }}
                </span>
              </button>
            </div>
          </aside>

          <!-- Right side: Note content list -->
          <div class="flex-1 min-w-0 w-full flex flex-col gap-3 md:gap-4.5">
            <!-- Search & Filters -->
            <div class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-1.5 md:gap-2.5 mb-1 sm:mb-2">
              <!-- Search Input & Sort Select Side-by-Side on Mobile -->
              <div class="flex items-center gap-1.5 flex-1 min-w-0">
                <el-input
                  v-model="searchQuery"
                  placeholder="搜索笔记..."
                  :prefix-icon="Search"
                  clearable
                  class="flex-1 sm:!w-64"
                  @keyup.enter="loadNotes"
                  @clear="loadNotes"
                />

                <div
                  class="flex items-center gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl shrink-0 w-24 sm:w-32"
                  style="background-color: var(--bg-card); border: 1px solid var(--border-base)"
                >
                  <el-select v-model="sortBy" placeholder="排序" class="!w-full" @change="loadNotes">
                    <el-option label="最新" value="latest" />
                    <el-option label="浏览" value="most_viewed" />
                    <el-option label="点赞" value="most_liked" />
                  </el-select>
                </div>
              </div>

              <!-- Tags and Categories Selects -->
              <div v-if="tags.length || categories.length || (activeTab === 'MY' && myNotebooksList.length)" class="flex items-center gap-1.5 w-full sm:w-auto">
                <!-- Mobile Notebook Dropdown Selector -->
                <div
                  v-if="activeTab === 'MY'"
                  class="md:hidden flex-1 flex items-center gap-1 p-0.5 rounded-lg"
                  style="background-color: var(--bg-card); border: 1px solid var(--border-base)"
                >
                  <el-select
                    :model-value="filterCategory === '__uncategorized__' ? 'UNCATEGORIZED' : (filterCategory || 'ALL')"
                    placeholder="笔记本"
                    class="!w-full"
                    @change="selectNotebook"
                  >
                    <el-option label="全部笔记" value="ALL" />
                    <el-option label="未分类" value="UNCATEGORIZED" />
                    <el-option v-for="cat in myNotebooksList" :key="cat" :label="cat" :value="cat" />
                  </el-select>
                </div>

                <div
                  v-if="tags.length"
                  class="flex-1 sm:flex-none flex items-center gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl"
                  style="background-color: var(--bg-card); border: 1px solid var(--border-base)"
                >
                  <el-select
                    v-model="filterTag"
                    placeholder="标签"
                    class="!w-full sm:!w-32"
                    clearable
                    @change="loadNotes"
                  >
                    <el-option v-for="t in tags" :key="t" :label="t" :value="t" />
                  </el-select>
                </div>

                <!-- Only show Category dropdown if not in MY tab -->
                <div
                  v-if="activeTab !== 'MY' && categories.length"
                  class="flex-1 sm:flex-none flex items-center gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl"
                  style="background-color: var(--bg-card); border: 1px solid var(--border-base)"
                >
                  <el-select
                    v-model="filterCategory"
                    placeholder="分类"
                    class="!w-full sm:!w-32"
                    clearable
                    @change="loadNotes"
                  >
                    <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
                  </el-select>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div
              v-if="loading"
              class="flex flex-col items-center justify-center py-32 text-[var(--text-muted)] w-full"
            >
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p class="mt-4 font-medium">正在为您加载笔记...</p>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="notes.length === 0"
              class="flex flex-col items-center justify-center py-32 w-full"
            >
              <div
                class="w-24 h-24 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6"
              >
                <BookOpen class="w-12 h-12 text-[var(--text-muted)] opacity-40" />
              </div>
              <p class="text-[var(--text-secondary)] font-medium">暂无相关笔记内容</p>
            </div>

            <!-- Content list -->
            <div v-else class="w-full">
              
              <!-- TIMELINE FEED for ACTIVITY Tab -->
              <div v-if="activeTab === 'ACTIVITY'" class="flex flex-col xl:flex-row gap-5 items-start w-full animate-fade-in">
                <!-- Central Timeline Column -->
                <div class="flex-1 min-w-0 w-full space-y-3.5">
                  <div
                    v-for="note in notes"
                    :key="note.id"
                    class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-3 sm:p-3.5 md:p-4 shadow-sm flex flex-col gap-2.5 relative transition-all hover:shadow-md cursor-default animate-fade-in"
                  >
                    <!-- Top Author & Info (Inline single row Twitter-style) -->
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2">
                        <UserAvatar :user="note.user" size="xs" class="shrink-0" />
                        <div class="flex items-center gap-1.5 text-xs font-black text-[var(--text-primary)]">
                          <span>{{ note.user.name }}</span>
                          <span class="text-[9px] text-[var(--text-muted)] font-normal">• {{ formatDate(note.createdAt) }}</span>
                        </div>
                      </div>
                      <!-- Right Tag -->
                      <span
                        v-if="note.category"
                        class="text-[8px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded-full uppercase shrink-0"
                      >
                        {{ note.category }}
                      </span>
                    </div>

                    <!-- Title & Markdown content snippet (Line clamp 2 for tight density) -->
                    <div class="cursor-pointer" @click="viewDetail(note)">
                      <h3 class="text-xs sm:text-sm md:text-base font-extrabold text-[var(--text-primary)] hover:text-accent transition-colors leading-snug">
                        {{ note.title }}
                      </h3>
                      <p class="text-[11px] sm:text-xs md:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed line-clamp-2">
                        {{ note.summary || note.content.replace(/[#*`>]/g, '').slice(0, 200) }}
                      </p>
                    </div>

                    <!-- Tags (Super compact) -->
                    <div v-if="parseTags(note).length" class="flex flex-wrap gap-1 my-0.5">
                      <span
                        v-for="tag in parseTags(note)"
                        :key="tag"
                        class="px-2 py-0.5 rounded-full bg-slate-50 dark:bg-white/5 text-[var(--text-muted)] text-[9px] font-bold border border-[var(--border-base)]"
                      >
                        #{{ tag }}
                      </span>
                    </div>

                    <!-- Bottom Social Toolbar -->
                    <div class="flex items-center justify-between mt-1 pt-2.5 border-t border-[var(--border-base)]">
                      <div class="flex items-center gap-5 text-[10px] md:text-xs font-bold text-[var(--text-muted)]">
                        <!-- Likes -->
                        <button
                          class="flex items-center gap-1.5 cursor-pointer hover:text-red-500 transition-colors"
                          :class="[note.isLiked ? 'text-red-500' : '']"
                          @click.stop="handleLike(note)"
                        >
                          <ThumbsUp class="w-3.5 h-3.5" :class="[note.isLiked ? 'fill-current' : '']" />
                          <span>{{ note._count.likes }}</span>
                        </button>

                        <!-- Comments -->
                        <button
                          class="flex items-center gap-1.5 cursor-pointer hover:text-accent transition-colors"
                          :class="[activeCommentsNoteId === note.id ? 'text-accent' : '']"
                          @click.stop="toggleComments(note)"
                        >
                          <MessageSquare class="w-3.5 h-3.5" />
                          <span>{{ note._count.comments || 0 }}</span>
                        </button>
                      </div>

                      <!-- 一键转存 (Clip/Save) button -->
                      <button
                        v-if="note.userId !== authStore.user?.id"
                        class="flex items-center gap-1 text-[9px] font-black text-accent hover:text-accent-dark hover:bg-accent/5 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                        @click.stop="openCloneDialog(note)"
                      >
                        <Bookmark class="w-3 h-3" />
                        <span>一键转存</span>
                      </button>
                      
                      <div v-else class="flex gap-1">
                        <button class="p-1 text-[var(--text-secondary)] hover:text-accent transition-all cursor-pointer" @click.stop="openEditDialog(note)">
                          <Edit3 class="w-3 h-3" />
                        </button>
                        <button class="p-1 text-red-500 hover:text-red-600 transition-all cursor-pointer" @click.stop="handleDelete(note)">
                          <Trash2 class="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <!-- Comments Sub-drawer (Highly Compact chat bubbles) -->
                    <Transition name="slide-fade">
                      <div v-if="activeCommentsNoteId === note.id" class="mt-2.5 pt-2.5 border-t border-[var(--border-base)] flex flex-col gap-2.5">
                        
                        <!-- Loader -->
                        <div v-if="commentsLoading[note.id]" class="flex justify-center py-2">
                          <el-icon class="is-loading" :size="16"><Loading /></el-icon>
                        </div>

                        <!-- Empty state -->
                        <div v-else-if="!noteCommentsMap[note.id] || !noteCommentsMap[note.id].length" class="text-center py-2 text-[10px] text-[var(--text-muted)] font-bold">
                          暂无评论，留下你的一笔启发吧~
                        </div>

                        <!-- Comments List -->
                        <div v-else class="flex flex-col gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                          <div v-for="c in noteCommentsMap[note.id]" :key="c.id" class="flex gap-2 items-start">
                            <UserAvatar :user="c.user" size="xs" class="shrink-0 mt-0.5" />
                            <div class="flex-1 bg-slate-50 dark:bg-white/[0.02] border border-[var(--border-base)] rounded-xl p-2 relative group/comment">
                              <div class="flex items-center justify-between gap-2 leading-none">
                                <span class="text-[9px] font-black text-[var(--text-primary)]">{{ c.user.name }}</span>
                                <span class="text-[8px] text-[var(--text-muted)]">{{ formatDate(c.createdAt) }}</span>
                              </div>
                              <p class="text-[10px] md:text-[11px] text-[var(--text-secondary)] mt-1 whitespace-pre-line leading-relaxed">
                                {{ c.content }}
                              </p>
                              
                              <!-- Delete action -->
                              <button
                                v-if="c.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
                                class="absolute right-2 top-2 opacity-0 group-hover/comment:opacity-100 text-red-500 hover:text-red-600 transition-all cursor-pointer"
                                title="删除评论"
                                @click.stop="handleDeleteComment(note, c.id)"
                              >
                                <Trash2 class="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <!-- Write comment input box -->
                        <div class="flex gap-2 items-center mt-0.5">
                          <el-input
                            v-model="commentInputText"
                            placeholder="写下你的想法，一起讨论交流..."
                            size="small"
                            class="flex-1 rounded-xl"
                            clearable
                            @keyup.enter="submitComment(note)"
                          />
                          <el-button type="primary" size="small" round class="font-bold shrink-0 shadow-sm shadow-accent/10" @click="submitComment(note)">
                            发送
                          </el-button>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>

                <!-- Right Sidebar for ACTIVITY Tab on Desktop (xl and up) -->
                <aside class="hidden xl:flex flex-col w-80 shrink-0 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-4 space-y-4 shadow-sm sticky top-20">
                  <div class="border-b border-[var(--border-base)] pb-2.5">
                    <h3 class="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                      <Flame class="w-4 h-4 text-red-500 fill-current animate-pulse" /> 社区动态观察
                    </h3>
                  </div>

                  <!-- Daily Quote (今日学习寄语) -->
                  <div class="pt-0.5">
                    <div class="bg-gradient-to-br from-accent/5 to-purple-500/5 dark:from-accent/10 dark:to-purple-500/10 border border-[var(--border-base)] p-3.5 rounded-xl relative overflow-hidden backdrop-blur-sm group/quote">
                      <div class="absolute -right-3 -bottom-3 text-accent/10 pointer-events-none transition-transform group-hover/quote:scale-110 duration-500">
                        <BookOpen class="w-16 h-16" />
                      </div>
                      <p class="text-[8px] font-black text-accent uppercase tracking-wider mb-1">今日灵感寄语</p>
                      <p class="text-[10px] text-[var(--text-secondary)] font-bold leading-relaxed italic">
                        “ {{ dailyQuote }} ”
                      </p>
                    </div>
                  </div>

                  <!-- Today Stats -->
                  <div class="space-y-2 pt-1.5">
                    <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">动态看板</p>
                    <div class="grid grid-cols-2 gap-2">
                      <div class="bg-slate-50 dark:bg-white/[0.02] border border-[var(--border-base)] p-2 rounded-xl border-dashed">
                        <p class="text-[8px] text-[var(--text-muted)] mb-0.5">全站动态</p>
                        <p class="text-xs font-black text-[var(--text-primary)]">{{ totalNotes }} 条</p>
                      </div>
                      <div class="bg-slate-50 dark:bg-white/[0.02] border border-[var(--border-base)] p-2 rounded-xl border-dashed">
                        <p class="text-[8px] text-[var(--text-muted)] mb-0.5">标签话题</p>
                        <p class="text-xs font-black text-[var(--text-primary)]">{{ tags.length }} 个</p>
                      </div>
                    </div>
                  </div>

                  <!-- Top Contributors (活跃学霸榜) -->
                  <div v-if="topContributors.length" class="space-y-2 pt-1.5">
                    <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">活跃学霸榜</p>
                    <div class="flex flex-col gap-1.5">
                      <div v-for="(item, idx) in topContributors" :key="item.user.id" class="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                        <div class="flex items-center gap-2 min-w-0">
                          <div class="relative shrink-0">
                            <UserAvatar :user="item.user" size="xs" />
                            <span class="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-accent/80 text-white flex items-center justify-center font-bold text-[8px] border border-white dark:border-slate-800 scale-90">
                              {{ idx + 1 }}
                            </span>
                          </div>
                          <span class="text-[10px] font-bold text-[var(--text-primary)] truncate">{{ item.user.name }}</span>
                        </div>
                        <span class="text-[8px] font-black text-accent bg-accent/5 px-2 py-0.5 rounded-full shrink-0 border border-accent/10">
                          {{ item.count }} 动态
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Tag cloud -->
                  <div class="space-y-2 pt-1.5">
                    <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">热门标签话题</p>
                    <div class="flex flex-wrap gap-1">
                      <button
                        v-for="t in tags.slice(0, 12)"
                        :key="t"
                        class="px-2 py-0.5 rounded-full bg-slate-50 dark:bg-white/5 text-[var(--text-secondary)] text-[9px] font-bold border border-[var(--border-base)] hover:border-accent hover:text-accent transition-all cursor-pointer"
                        :class="[filterTag === t ? '!border-accent !text-accent bg-accent/5' : '']"
                        @click="filterTag = filterTag === t ? '' : t; loadNotes()"
                      >
                        #{{ t }}
                      </button>
                      <span v-if="!tags.length" class="text-[10px] text-[var(--text-muted)]">暂无话题</span>
                    </div>
                  </div>

                  <!-- Active Category List -->
                  <div class="space-y-2 pt-1.5">
                    <p class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">推荐笔记本/分类</p>
                    <div class="flex flex-col gap-1">
                      <button
                        v-for="c in categories.slice(0, 5)"
                        :key="c"
                        class="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[9px] font-bold transition-all text-left text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer border border-transparent"
                        :class="[filterCategory === c ? '!border-accent !text-accent bg-accent/5 font-black' : '']"
                        @click="filterCategory = filterCategory === c ? '' : c; loadNotes()"
                      >
                        <span class="truncate">📁 {{ c }}</span>
                      </button>
                    </div>
                  </div>
                </aside>
              </div>

              <!-- CARDS GRID for MY & POPULAR Tabs -->
              <div v-else class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-4.5">
                <div
                  v-for="(note, index) in notes"
                  :key="note.id"
                  class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-xl p-2.5 sm:p-3.5 lg:p-4 hover:shadow-xl hover:-translate-y-0.5 transition-all group flex flex-col h-full relative"
                  :class="[activeTab === 'MY' && (note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN') ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer']"
                  :draggable="activeTab === 'MY' && (note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN')"
                  @click="viewDetail(note)"
                  @dragstart="handleDragStart($event, note)"
                >
                  <!-- Beautiful Glowing Rank Index on POPULAR leaderboard -->
                  <div v-if="activeTab === 'POPULAR'" class="absolute -top-2 -left-2 z-10 flex items-center gap-1">
                    <span
                      v-if="index === 0"
                      class="px-2.5 py-0.5 text-[9px] font-black text-white rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 shadow-md shadow-amber-500/20 border border-yellow-300 flex items-center gap-0.5"
                    >
                      👑 #1
                    </span>
                    <span
                      v-else-if="index === 1"
                      class="px-2.5 py-0.5 text-[9px] font-black text-white rounded-full bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500 shadow-md shadow-slate-500/20 border border-slate-200 flex items-center gap-0.5"
                    >
                      🥈 #2
                    </span>
                    <span
                      v-else-if="index === 2"
                      class="px-2.5 py-0.5 text-[9px] font-black text-white rounded-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-800 shadow-md shadow-orange-500/20 border border-orange-500 flex items-center gap-0.5"
                    >
                      🥉 #3
                    </span>
                    <span
                      v-else
                      class="px-2 py-0.5 text-[8px] font-black text-[var(--text-secondary)] rounded-full bg-slate-100 dark:bg-white/10 border border-[var(--border-base)]"
                    >
                      #{{ index + 1 }}
                    </span>

                    <!-- Hotness Rating tag -->
                    <span class="px-2 py-0.5 text-[8px] font-black text-red-500 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-0.5 shadow-sm">
                      <Flame class="w-2.5 h-2.5 text-red-500 fill-current animate-pulse" />
                      {{ Math.round(note.views * 1 + note._count.likes * 5 + (note._count.comments || 0) * 10) }} 热度
                    </span>
                  </div>

                  <div class="flex items-start justify-between mb-1.5 md:mb-2.5 gap-1 min-w-0">
                    <div class="flex items-center gap-1.5 md:gap-2.5 min-w-0">
                      <UserAvatar :user="note.user" size="xs" class="md:hidden shrink-0" />
                      <UserAvatar :user="note.user" size="sm" class="hidden md:inline-flex shrink-0" />
                      <div class="min-w-0">
                        <p class="text-xs md:text-sm font-bold text-[var(--text-primary)] leading-none truncate">
                          {{ note.user.name }}
                        </p>
                        <p class="hidden sm:block text-[9px] md:text-[10px] text-[var(--text-muted)] mt-1">
                          {{ formatDate(note.createdAt) }}
                        </p>
                      </div>
                    </div>
                    <div
                      class="flex items-center gap-1 shrink-0 transition-all duration-300"
                      :class="{ 'group-hover:opacity-0 group-hover:scale-90 group-hover:pointer-events-none': note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN' }"
                    >
                      <el-tag v-if="note.isPopular && activeTab !== 'POPULAR'" type="warning" size="small" round effect="dark" class="px-1 md:px-2">热</el-tag>
                      <el-tag :type="getVisibilityTag(note.visibility)" size="small" round class="px-1 md:px-2">
                        <span class="hidden sm:inline">{{ getVisibilityLabel(note.visibility) }}</span>
                        <span class="sm:hidden">{{ note.visibility === 'PUBLIC' ? '公' : '私' }}</span>
                      </el-tag>
                    </div>
                  </div>

                  <h3
                    class="text-xs sm:text-sm md:text-base font-bold mb-1 md:mb-1.5 line-clamp-1 group-hover:text-accent transition-colors"
                  >
                    {{ note.title }}
                  </h3>
                  <p
                    class="text-[11px] sm:text-xs md:text-sm text-[var(--text-secondary)] line-clamp-2 md:line-clamp-3 mb-1.5 md:mb-2.5 flex-1 leading-relaxed"
                  >
                    {{ note.summary || note.content.replace(/[#*`>]/g, '').slice(0, 150) }}
                  </p>

                  <div v-if="parseTags(note).length" class="flex flex-wrap gap-1 mb-2 md:mb-3">
                    <span
                      v-for="tag in parseTags(note).slice(0, isMobile ? 1 : 3)"
                      :key="tag"
                      class="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-white/5 text-[var(--text-muted)] text-[9px] md:text-[10px] font-bold border border-[var(--border-base)] whitespace-nowrap truncate max-w-[80px]"
                    >
                      #{{ tag }}
                    </span>
                  </div>

                  <div
                    class="flex items-center justify-between mt-auto pt-1.5 md:pt-3 border-t border-[var(--border-base)] gap-1"
                  >
                    <div
                      class="flex items-center gap-2 md:gap-4 text-[9px] md:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0"
                    >
                      <span class="flex items-center gap-1">
                        <Eye class="w-3 md:w-3.5 h-3 md:h-3.5" /> {{ note.views }}
                      </span>
                      <span
                        class="flex items-center gap-1 cursor-pointer hover:text-red-500 transition-colors"
                        :class="{ 'text-red-500': note.isLiked }"
                        @click.stop="handleLike(note)"
                      >
                        <ThumbsUp class="w-3 md:w-3.5 h-3 md:h-3.5" :class="{ 'fill-current': note.isLiked }" />
                        {{ note._count.likes }}
                      </span>
                      <span class="flex items-center gap-1">
                        <MessageSquare class="w-3 md:w-3.5 h-3 md:h-3.5" /> {{ note._count.comments || 0 }}
                      </span>
                    </div>
                    <span
                      v-if="note.category"
                      class="text-[8px] md:text-[10px] font-black text-accent bg-accent/10 px-1.5 py-0.5 rounded uppercase truncate max-w-[50px] sm:max-w-[80px]"
                    >
                      {{ note.category }}
                    </span>
                  </div>

                  <!-- Hover Actions -->
                  <div
                    class="absolute top-1.5 md:top-2.5 right-1.5 md:right-2.5 flex gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0"
                  >
                    <!-- Edit for Owner -->
                    <el-button
                      v-if="note.userId === authStore.user?.id"
                      circle
                      size="small"
                      class="!p-1"
                      @click.stop="openEditDialog(note)"
                    >
                      <Edit3 class="w-3 h-3 md:w-3.5 md:h-3.5" />
                    </el-button>

                    <!-- Popular toggle for Admin (on public notes) -->
                    <el-button
                      v-if="authStore.user?.role === 'ADMIN' && note.visibility === 'PUBLIC'"
                      circle
                      size="small"
                      :type="note.isPopular ? 'warning' : ''"
                      class="!p-1"
                      @click.stop="handleTogglePopular(note)"
                    >
                      <Star class="w-3 h-3 md:w-3.5 md:h-3.5" :class="{ 'fill-current': note.isPopular }" />
                    </el-button>

                    <!-- Delete for Owner or Admin -->
                    <el-button
                      v-if="note.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
                      circle
                      size="small"
                      type="danger"
                      class="!p-1"
                      @click.stop="handleDelete(note)"
                    >
                      <Trash2 class="w-3 h-3 md:w-3.5 md:h-3.5" />
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div
              v-if="totalPages > 1 && activeTab !== 'POPULAR'"
              class="flex justify-center mt-12 mb-8"
            >
              <el-pagination
                :current-page="currentPage"
                :page-size="pageSize"
                :total="totalNotes"
                layout="prev, pager, next"
                background
                @current-change="handlePageChange"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Immersive Editor Dialog -->
    <el-dialog
      v-model="showCreateDialog"
      fullscreen
      :show-close="false"
      class="immersive-editor-dialog"
      destroy-on-close
    >
      <div class="fixed inset-0 bg-[var(--bg-app)] overflow-y-auto custom-scrollbar h-screen">
        <header
          class="sticky top-0 z-50 h-14 md:h-16 flex items-center justify-between px-3 md:px-8 bg-[var(--bg-app)]/80 backdrop-blur-md border-b border-[var(--border-base)]"
        >
          <div class="flex items-center gap-2 md:gap-4">
            <el-button
              circle
              size="small"
              class="hover:bg-slate-100 dark:hover:bg-white/10 shrink-0"
              @click="showCreateDialog = false"
            >
              <Plus class="w-4 h-4 md:w-5 md:h-5 rotate-45 text-[var(--text-secondary)]" />
            </el-button>
          </div>

          <div class="flex items-center gap-2 md:gap-3 min-w-0">
            <el-radio-group v-model="previewMode" size="small" class="preview-mode-toggle">
              <el-radio-button value="edit">
                <div class="flex items-center gap-1 px-1">
                  <Edit3 class="w-3.5 h-3.5" /> <span class="hidden sm:inline">编辑</span>
                </div>
              </el-radio-button>
              <el-radio-button value="live">
                <div class="flex items-center gap-1 px-1">
                  <Layout class="w-3.5 h-3.5" /> <span class="hidden sm:inline">实时</span>
                </div>
              </el-radio-button>
              <el-radio-button value="preview">
                <div class="flex items-center gap-1 px-1">
                  <Eye class="w-3.5 h-3.5" /> <span class="hidden sm:inline">预览</span>
                </div>
              </el-radio-button>
            </el-radio-group>

            <el-dropdown trigger="click" class="lg:hidden">
              <el-button circle class="!bg-[var(--bg-card)]">
                <Settings class="w-4 h-4" />
              </el-button>
              <template #dropdown>
                <div class="p-4 w-72 md:w-80 space-y-4">
                  <div>
                    <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">笔记摘要</p>
                    <el-input v-model="formSummary" type="textarea" :rows="2" placeholder="简短摘要..." size="small" />
                  </div>
                  <div>
                    <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">可见性</p>
                    <el-radio-group v-model="formVisibility" size="small" class="w-full">
                      <el-radio-button value="PRIVATE">私有</el-radio-button>
                      <el-radio-button value="PUBLIC">公开</el-radio-button>
                    </el-radio-group>
                  </div>
                  <div>
                    <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">分类/笔记本</p>
                    <el-select
                      v-model="formCategory"
                      placeholder="选择或输入笔记本"
                      size="small"
                      class="w-full"
                      filterable
                      allow-create
                      default-first-option
                      clearable
                    >
                      <el-option label="默认笔记本" value="默认笔记本" />
                      <el-option v-for="cat in myNotebooksList" :key="cat" :label="cat" :value="cat" />
                    </el-select>
                  </div>
                  <div>
                    <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">标签</p>
                    <el-input v-model="formTags" placeholder="多个标签用逗号分隔" size="small" />
                  </div>
                </div>
              </template>
            </el-dropdown>
            <el-button
              type="primary"
              size="default"
              round
              class="font-bold shadow-lg shrink-0"
              :loading="saving"
              @click="handleSave"
            >
              发布
            </el-button>
          </div>
        </header>

        <main class="max-w-[1550px] mx-auto px-3 md:px-6 pb-20 md:pb-32 pt-4 lg:pt-8">
          <div class="flex flex-col lg:flex-row gap-6 items-start">
            <!-- Left Column: Writing area -->
            <div class="flex-1 min-w-0 w-full bg-[var(--bg-card)] border border-[var(--border-base)] shadow-sm rounded-2xl min-h-[85vh] px-4 md:px-8 lg:px-10 py-6 md:py-12">
              <el-input v-model="formTitle" placeholder="无标题" class="editor-modern-title mb-4" />
              <MarkdownEditor
                v-model="formContent"
                auto-height
                class="modern-paper-theme"
                :auto-focus="true"
                :preview="previewMode === 'live'"
                :preview-only="previewMode === 'preview'"
              />
              <div class="mt-6 md:mt-12 flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest pt-4 md:pt-8 border-t border-[var(--border-base)]">
                <div class="flex items-center gap-4">
                  <span class="flex items-center gap-1"><Check class="w-3 h-3" /> 自动保存</span>
                  <span class="hidden sm:flex items-center gap-1"><BookOpen class="w-3 h-3" /> Markdown 支持</span>
                </div>
                <span>共 {{ formContent.length }} 字符</span>
              </div>
            </div>

            <!-- Right Column: Permanent sidebar settings on desktop (lg and up) -->
            <aside class="hidden lg:flex flex-col w-80 shrink-0 bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-5 space-y-5 shadow-sm sticky top-20">
              <div class="border-b border-[var(--border-base)] pb-3">
                <h3 class="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Settings class="w-4 h-4 text-accent" /> 笔记属性设置
                </h3>
              </div>
              
              <div class="space-y-4">
                <div>
                  <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">笔记摘要</p>
                  <el-input v-model="formSummary" type="textarea" :rows="3" placeholder="简短摘要有助于读者在动态中快速了解..." size="small" />
                </div>
                <div>
                  <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">可见性</p>
                  <el-radio-group v-model="formVisibility" size="small" class="w-full">
                    <el-radio-button value="PRIVATE" class="w-1/2 text-center">私有</el-radio-button>
                    <el-radio-button value="PUBLIC" class="w-1/2 text-center">公开</el-radio-button>
                  </el-radio-group>
                </div>
                <div>
                  <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">分类/笔记本</p>
                  <el-select
                    v-model="formCategory"
                    placeholder="选择或输入笔记本"
                    size="small"
                    class="w-full"
                    filterable
                    allow-create
                    default-first-option
                    clearable
                  >
                    <el-option label="默认笔记本" value="默认笔记本" />
                    <el-option v-for="cat in myNotebooksList" :key="cat" :label="cat" :value="cat" />
                  </el-select>
                </div>
                <div>
                  <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">标签</p>
                  <el-input v-model="formTags" placeholder="多个标签用逗号分隔" size="small" />
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </el-dialog>

    <!-- Note Detail Dialog -->
    <el-dialog
      v-model="showDetailDialog"
      width="95%"
      top="2vh"
      class="modern-note-dialog"
      destroy-on-close
      :show-close="false"
    >
      <div v-if="detailNote" class="flex flex-col md:flex-row h-[92vh] overflow-hidden">
        <!-- Sidebar -->
        <aside class="w-full md:w-72 bg-slate-50/50 dark:bg-white/[0.02] p-3.5 md:p-5 flex flex-col shrink-0 border-b md:border-b-0 md:border-r" style="border-color: var(--border-base)">
          <div class="mb-3 md:mb-5 flex items-center justify-between">
            <el-button circle class="hover:bg-white dark:hover:bg-white/10 shadow-sm" @click="showDetailDialog = false">
              <Plus class="w-5 h-5 rotate-45 text-[var(--text-secondary)]" />
            </el-button>
            <div class="md:hidden flex gap-2">
              <el-button circle :type="detailNote.isLiked ? 'danger' : ''" @click="handleLike(detailNote)">
                <ThumbsUp class="w-4 h-4" :class="{ 'fill-current': detailNote.isLiked }" />
              </el-button>
              <el-button circle @click="handleCopy">
                <component :is="isCopying ? Check : Copy" class="w-4 h-4" />
              </el-button>
            </div>
          </div>

          <div class="mb-4 md:mb-6 flex items-center md:items-start md:flex-col gap-2.5 md:gap-0">
            <UserAvatar :user="detailNote.user" size="md" md-size="lg" class="md:mb-3 shrink-0" />
            <div class="min-w-0">
              <h4 class="font-bold text-[var(--text-primary)] mb-0.5 truncate">{{ detailNote.user.name }}</h4>
              <p class="text-[10px] md:text-xs text-[var(--text-muted)] line-clamp-1 md:line-clamp-2 leading-relaxed">
                {{ detailNote.user.bio || '探索者' }}
              </p>
            </div>
          </div>

          <div class="hidden md:block space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide">
            <div>
              <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2.5">数据统计</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-white dark:bg-white/5 p-2.5 rounded-xl border border-[var(--border-base)]">
                  <p class="text-[10px] text-[var(--text-muted)] mb-0.5">阅读</p>
                  <p class="text-xs font-black text-[var(--text-primary)]">{{ detailNote.views }}</p>
                </div>
                <div class="bg-white dark:bg-white/5 p-2.5 rounded-xl border border-[var(--border-base)]">
                  <p class="text-[10px] text-[var(--text-muted)] mb-0.5">点赞</p>
                  <p class="text-xs font-black text-[var(--text-primary)]">{{ detailNote._count.likes }}</p>
                </div>
              </div>
            </div>
            <div>
              <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2.5">分类标签</p>
              <div class="flex flex-wrap gap-1.5">
                <span v-if="detailNote.category" class="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold">{{ detailNote.category }}</span>
                <span v-for="tag in parseTags(detailNote)" :key="tag" class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-[var(--text-secondary)] text-[10px] font-bold border border-[var(--border-base)]">#{{ tag }}</span>
              </div>
            </div>
          </div>

          <div class="hidden md:flex pt-4 border-t border-[var(--border-base)] flex-col gap-2">
            <!-- Popular Toggle for Admins -->
            <el-button
              v-if="authStore.user?.role === 'ADMIN' && detailNote.visibility === 'PUBLIC'"
              class="w-full !rounded-xl font-bold"
              :type="detailNote.isPopular ? 'warning' : ''"
              @click="handleTogglePopular(detailNote)"
            >
              <Star class="w-3.5 h-3.5 mr-1.5" :class="{ 'fill-current': detailNote.isPopular }" />
              {{ detailNote.isPopular ? '取消热门' : '推荐热门' }}
            </el-button>

            <el-button class="w-full !rounded-xl font-bold" :type="detailNote.isLiked ? 'danger' : ''" @click="handleLike(detailNote)">
              <ThumbsUp class="w-3.5 h-3.5 mr-1.5" :class="{ 'fill-current': detailNote.isLiked }" />
              {{ detailNote.isLiked ? '已赞' : '点赞' }}
            </el-button>
            <el-button class="w-full !rounded-xl font-bold" :loading="isCopying" @click="handleCopy">
              <component :is="isCopying ? Check : Copy" class="w-3.5 h-3.5 mr-1.5" />
              {{ isCopying ? '已复制' : '复制全文' }}
            </el-button>
          </div>
        </aside>

        <div class="flex-1 bg-white dark:bg-[var(--bg-card)] overflow-y-auto custom-scrollbar">
          <div class="max-w-[800px] mx-auto px-3.5 md:px-8 py-5 md:py-10">
            <header class="mb-5 md:mb-8">
              <h1 class="text-xl md:text-3xl font-extrabold text-[var(--text-primary)] leading-tight mb-2 md:mb-3.5">{{ detailNote.title }}</h1>
              <div v-if="detailNote.summary" class="bg-slate-50 dark:bg-white/[0.02] rounded-xl p-3 md:p-4.5 text-[var(--text-secondary)] text-xs md:text-sm leading-relaxed border-l-4 border-l-accent">
                <span class="block text-[8px] md:text-[10px] font-black text-accent mb-1 tracking-widest uppercase">Abstract</span>
                {{ detailNote.summary }}
              </div>
            </header>
            <div class="modern-markdown-content">
              <MarkdownEditor :model-value="detailNote.content" preview-only />
            </div>
            <footer class="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-[var(--border-base)] text-center">
              <div class="inline-flex items-center gap-2 text-[var(--text-muted)] text-xs md:text-sm font-medium">
                <BookOpen class="w-4 h-4" />
                <span>END OF ARTICLE</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- Add Notebook Dialog -->
    <el-dialog
      v-model="showAddNotebookDialog"
      title="新建笔记本"
      width="360px"
      destroy-on-close
    >
      <div class="space-y-4">
        <div>
          <label class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2 block">笔记本名称</label>
          <el-input v-model="newNotebookName" placeholder="例如：Three.js 进阶" @keyup.enter="addNotebook" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button size="small" round @click="showAddNotebookDialog = false">取消</el-button>
          <el-button type="primary" size="small" round class="font-bold" @click="addNotebook">创建</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Clone Note Dialog (一键转存) -->
    <el-dialog
      v-model="showCloneDialog"
      title="一键转存笔记"
      width="400px"
      destroy-on-close
    >
      <div v-if="cloningNote" class="space-y-4">
        <div class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-[var(--border-base)]">
          <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-1">转存作品</p>
          <h4 class="text-xs font-bold text-[var(--text-primary)] truncate">{{ cloningNote.title }}</h4>
          <p class="text-[10px] text-[var(--text-muted)] mt-0.5">作者: {{ cloningNote.user.name }}</p>
        </div>

        <div>
          <label class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2 block">选择目标笔记本</label>
          <el-select v-model="targetCategory" placeholder="请选择或输入分类" class="!w-full" filterable allow-create default-first-option>
            <el-option label="默认笔记本" value="默认笔记本" />
            <el-option v-for="cat in myNotebooksList" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button size="small" round @click="showCloneDialog = false">取消</el-button>
          <el-button type="primary" size="small" round class="font-bold" :loading="cloning" @click="handleClone">
            确认转存
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
:deep(.immersive-editor-dialog) {
  padding: 0 !important;
}
:deep(.immersive-editor-dialog .el-dialog__header) {
  display: none;
}
:deep(.immersive-editor-dialog .el-dialog__body) {
  padding: 0;
  height: 100%;
}
.preview-mode-toggle :deep(.el-radio-button__inner) {
  background-color: transparent !important;
  border: none !important;
  padding: 8px 12px !important;
  font-weight: 600 !important;
  color: var(--text-muted) !important;
}
.preview-mode-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: var(--bg-card) !important;
  color: var(--accent) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
  border-radius: 6px !important;
}
.preview-mode-toggle {
  background-color: var(--bg-app) !important;
  padding: 2px !important;
  border-radius: 8px !important;
  border: 1px solid var(--border-base) !important;
}
.editor-modern-title :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background-color: transparent !important;
  padding-left: 0 !important;
}
.editor-modern-title :deep(.el-input__inner) {
  font-size: 1.25rem !important;
  font-weight: 800 !important;
  color: var(--text-primary) !important;
  border: none !important;
}
@media (min-width: 768px) {
  .editor-modern-title :deep(.el-input__inner) {
    font-size: 1.75rem !important;
  }
}
:deep(.custom-note-tabs .el-tabs__nav-wrap::after) {
  display: none;
}
:deep(.custom-note-tabs .el-tabs__header) {
  margin: 0 !important;
}
:deep(.custom-note-tabs .el-tabs__content) {
  display: none !important;
}
:deep(.custom-note-tabs .el-tabs__item) {
  font-size: 0.85rem !important;
  height: 32px !important;
  line-height: 32px !important;
  padding: 0 12px !important;
  color: var(--text-secondary) !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
}
:deep(.custom-note-tabs .el-tabs__item.is-active) {
  color: var(--accent) !important;
  font-weight: 700 !important;
}
:deep(.custom-note-tabs .el-tabs__active-bar) {
  height: 2px !important;
  background-color: var(--accent) !important;
}
:deep(.modern-note-dialog) {
  border-radius: 1.5rem;
  overflow: hidden;
  border: none !important;
}
:deep(.modern-note-dialog .el-dialog__header) {
  display: none;
}
:deep(.modern-note-dialog .el-dialog__body) {
  padding: 0;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.modern-markdown-content :deep(.md-preview-custom) {
  font-size: 15px !important;
  line-height: 1.7 !important;
  color: var(--text-primary) !important;
}
:deep(.md-preview-custom h2) {
  font-size: 1.75rem !important;
  border-bottom: 1px solid var(--border-base) !important;
}

/* slide-fade transition */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.25s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Custom Scrollbar for side panel */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

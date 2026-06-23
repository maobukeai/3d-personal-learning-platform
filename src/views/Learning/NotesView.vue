<script setup lang="ts">
import { getApiErrorMessage, logError } from '@/utils/error';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import {
  Plus,
  Search,
  Notebook,
  FolderPlus,
  Folder,
  Github,
  CheckSquare,
  Square,
  Grid3X3,
  LayoutList,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import PageHeader from '@/components/PageHeader.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePagedList } from '@/composables/usePagedList';

// Subcomponents
import NotebookCreateDialog from './components/NotebookCreateDialog.vue';
import NoteCloneDialog from './components/NoteCloneDialog.vue';
import NoteEditorDialog from './components/NoteEditorDialog.vue';
import NoteDetailDialog from './components/NoteDetailDialog.vue';
import NoteShareDialog from './components/NoteShareDialog.vue';
import NoteImportGithubDialog from './components/NoteImportGithubDialog.vue';
import NoteCard from './components/NoteCard.vue';
import ActivityTimeline from './components/ActivityTimeline.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Button from '@/components/ui/Button.vue';
import Checkbox from '@/components/ui/Checkbox.vue';
import Modal from '@/components/ui/Modal.vue';

const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

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
const tags = ref<string[]>([]);
const categories = ref<string[]>([]);
const searchQuery = ref('');
const sortBy = ref('latest');
const filterTag = ref('');
const filterCategory = ref('');
const pageSize = 12;
const viewMode = ref<'grid' | 'list'>('grid');
const viewModeOptions = computed(() => [
  { value: 'grid', label: '', icon: Grid3X3 },
  { value: 'list', label: '', icon: LayoutList },
]);

const getNotesEndpoint = () => {
  return activeTab.value === 'POPULAR' ? '/api/notes/popular' : '/api/notes';
};

const getNotesParams = () => {
  const params: Record<string, unknown> = {
    sort: sortBy.value,
  };
  if (activeTab.value === 'MY') {
    params.author = 'me';
  } else if (activeTab.value === 'ACTIVITY') {
    params.visibility = 'PUBLIC';
  }
  if (searchQuery.value) params.search = searchQuery.value;
  if (filterTag.value) params.tag = filterTag.value;
  if (filterCategory.value) params.category = filterCategory.value;
  return params;
};

const {
  data: notes,
  loading,
  page: currentPage,
  total: totalNotes,
  fetchData: runLoadNotes,
} = usePagedList<Note, { notes: Note[]; pagination: { total: number } }>(
  getNotesEndpoint,
  getNotesParams,
  {
    initialPageSize: 12,
    listExtractor: (res) => {
      return res.notes || [];
    },
    totalExtractor: (res) => {
      return res.pagination?.total ?? 0;
    },
    onError: () => {
      ElMessage.error(t('notes.loadFailed'));
    },
  },
);

// Sidebar & Notebook state
const localNotebooks = ref<string[]>([]);

// Dialog component references
const createNotebookDialogRef = ref<InstanceType<typeof NotebookCreateDialog> | null>(null);
const cloneDialogRef = ref<InstanceType<typeof NoteCloneDialog> | null>(null);
const editorDialogRef = ref<InstanceType<typeof NoteEditorDialog> | null>(null);
const detailDialogRef = ref<InstanceType<typeof NoteDetailDialog> | null>(null);
const shareDialogRef = ref<InstanceType<typeof NoteShareDialog> | null>(null);
const githubImportDialogRef = ref<InstanceType<typeof NoteImportGithubDialog> | null>(null);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const handleShowUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleChatWithMember = async (member: { id: string }) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [member.id],
      isGroup: false,
    });
    router.push('/messages');
  } catch {
    ElMessage.error(t('notes.startChatFailed'));
  }
};

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
    logError(e, { operation: 'loadLocalNotebooks', view: 'NotesView' });
  }
};

const saveLocalNotebooks = () => {
  const userId = authStore.user?.id;
  if (!userId) return;
  try {
    localStorage.setItem(`my_custom_notebooks_${userId}`, JSON.stringify(localNotebooks.value));
  } catch (e) {
    logError(e, { operation: 'saveLocalNotebooks', view: 'NotesView' });
  }
};

const handleNotebookCreated = (name: string) => {
  localNotebooks.value.push(name);
  saveLocalNotebooks();
  ElMessage.success(t('notes.notebookCreateSuccess', { name }));
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

// Active notebook model for vertical Tabs
const activeNotebook = computed({
  get() {
    if (!filterCategory.value) return 'ALL';
    if (filterCategory.value === '__uncategorized__') return 'UNCATEGORIZED';
    return filterCategory.value;
  },
  set(val) {
    selectNotebook(val);
  },
});

const notebookTabOptions = computed(() => {
  return [
    { value: 'ALL', label: t('notes.allNotes'), icon: Folder },
    { value: 'UNCATEGORIZED', label: t('notes.uncategorized'), icon: Folder },
    ...myNotebooksList.value.map((cat) => ({
      value: cat,
      label: cat,
      icon: Folder,
    })),
  ];
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

// Drag and drop notebook management
const draggedNote = ref<Note | null>(null);

const handleDragStart = (event: DragEvent, note: Note) => {
  draggedNote.value = note;
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', note.id);
    event.dataTransfer.effectAllowed = 'move';
  }
};

const totalPages = computed(() => Math.ceil(totalNotes.value / pageSize));

const loadNotes = () => runLoadNotes(false);

watch(activeTab, () => {
  currentPage.value = 1;
  filterCategory.value = '';
  filterTag.value = '';
  loadTagsAndCategories();
  loadNotes();
});

watch(searchQuery, (newVal) => {
  if (!newVal) {
    loadNotes();
  }
});

const loadTagsAndCategories = async () => {
  try {
    const params: Record<string, unknown> = {};
    if (activeTab.value !== 'MY') {
      params.visibility = 'PUBLIC';
    }
    const [tagsRes, catRes] = await Promise.all([
      api.get('/api/notes/tags', { params }),
      api.get('/api/notes/categories', { params }),
    ]);
    tags.value = tagsRes.data.tags || [];
    categories.value = catRes.data.categories || [];
  } catch {
    // Ignore error
  }
};

const openCreateDialog = () => {
  editorDialogRef.value?.open();
};

const openEditDialog = (note: Note) => {
  editorDialogRef.value?.open(note);
};

const openImportDialog = () => {
  githubImportDialogRef.value?.open();
};

const handleImportedSuccess = async () => {
  await loadNotes();
  await loadTagsAndCategories();
};

const handleEditorSaved = async (category: string) => {
  if (category) {
    if (!localNotebooks.value.includes(category) && !categories.value.includes(category)) {
      localNotebooks.value.push(category);
      saveLocalNotebooks();
    }
  }
  await loadNotes();
  await loadTagsAndCategories();
};

const handleNoteCloned = async (category: string) => {
  if (category) {
    if (!localNotebooks.value.includes(category) && !categories.value.includes(category)) {
      localNotebooks.value.push(category);
      saveLocalNotebooks();
    }
  }
  await loadTagsAndCategories();
  if (activeTab.value === 'MY') {
    await loadNotes();
  }
};

const viewDetail = (note: Note) => {
  detailDialogRef.value?.open(note);
};

const openShareDialog = (note: Note) => {
  shareDialogRef.value?.open(note);
};

const handleDetailLikeUpdated = (data: { id: string; isLiked: boolean; likesCount: number }) => {
  const idx = notes.value.findIndex((n) => n.id === data.id);
  if (idx !== -1) {
    notes.value[idx].isLiked = data.isLiked;
    notes.value[idx]._count.likes = data.likesCount;
  }
};

const handleDetailPopularUpdated = (data: { id: string; isPopular: boolean }) => {
  const idx = notes.value.findIndex((n) => n.id === data.id);
  if (idx !== -1) {
    notes.value[idx].isPopular = data.isPopular;
  }
  if (activeTab.value === 'POPULAR') {
    loadNotes();
  }
};

const handleDetailViewsUpdated = (data: { id: string; views: number }) => {
  const idx = notes.value.findIndex((n) => n.id === data.id);
  if (idx !== -1) {
    notes.value[idx].views = data.views;
  }
};

const handleDelete = async (note: Note) => {
  try {
    await ElMessageBox.confirm(
      t('notes.deleteConfirm'),
      t('common.confirmDelete') || t('common.delete'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      },
    );
    await api.delete(`/api/notes/${note.id}`);
    ElMessage.success(t('notes.deleteSuccess'));
    await loadNotes();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('notes.deleteFailed') || '删除笔记失败');
    }
  }
};

const handleTogglePopular = async (note: Note) => {
  try {
    const res = await api.post(`/api/notes/${note.id}/popular`);
    note.isPopular = res.data.isPopular;
    ElMessage.success(note.isPopular ? t('notes.popularRecommended') : t('notes.popularCancelled'));

    // Synced reactive list update
    const idx = notes.value.findIndex((n) => n.id === note.id);
    if (idx !== -1) {
      notes.value[idx].isPopular = res.data.isPopular;
    }

    if (activeTab.value === 'POPULAR') {
      loadNotes();
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('notes.operationFailed')));
  }
};

const handleToggleVisibility = async (note: Note, newVisibility: string) => {
  try {
    const res = await api.put(`/api/notes/${note.id}`, { visibility: newVisibility });
    note.visibility = res.data.visibility;
    ElMessage.success(
      note.visibility === 'PUBLIC' ? '已公开笔记，所有人可见' : '已设为私密，仅自己可见',
    );

    // Synced reactive list update
    const idx = notes.value.findIndex((n) => n.id === note.id);
    if (idx !== -1) {
      notes.value[idx].visibility = res.data.visibility;
    }

    // If we're not on MY tab and note visibility became PRIVATE, remove it from list
    if (activeTab.value !== 'MY' && note.visibility === 'PRIVATE') {
      notes.value = notes.value.filter((n) => n.id !== note.id);
    }

    // Reload categories and tags to update the filter lists immediately!
    loadTagsAndCategories();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('notes.operationFailed')));
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
    ElMessage.error(t('notes.operationFailed'));
  }
};

// ── Batch selection of notes state & logic ────────────────
const isSelectionMode = ref(false);
const selectedNoteIds = ref<string[]>([]);
const isMoveDialogOpen = ref(false);
const targetMoveCategory = ref('');

const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value;
  selectedNoteIds.value = [];
};

const toggleNoteSelection = (note: Note) => {
  const idx = selectedNoteIds.value.indexOf(note.id);
  if (idx !== -1) {
    selectedNoteIds.value.splice(idx, 1);
  } else {
    selectedNoteIds.value.push(note.id);
  }
};

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedNoteIds.value = notes.value
      .filter((n) => n.userId === authStore.user?.id || authStore.user?.role === 'ADMIN')
      .map((n) => n.id);
  } else {
    selectedNoteIds.value = [];
  }
};

const handleBatchDelete = async () => {
  if (selectedNoteIds.value.length === 0) {
    ElMessage.warning(t('notes.selectToDelete'));
    return;
  }
  try {
    await ElMessageBox.confirm(
      t('notes.batchDeleteConfirm', { n: selectedNoteIds.value.length }),
      t('notes.batchDeleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      },
    );

    loading.value = true;
    try {
      await Promise.all(selectedNoteIds.value.map((id) => api.delete(`/api/notes/${id}`)));
      ElMessage.success(t('notes.batchDeleteSuccess', { n: selectedNoteIds.value.length }));
      selectedNoteIds.value = [];
      isSelectionMode.value = false;

      await loadTagsAndCategories();
      await loadNotes();
    } catch {
      ElMessage.error(t('notes.batchDeleteFailed'));
    } finally {
      loading.value = false;
    }
  } catch (err) {
    if (err !== 'cancel') {
      logError(err, { operation: 'confirmBatchDelete', view: 'NotesView' });
    }
  }
};

const handleBatchMove = () => {
  if (selectedNoteIds.value.length === 0) {
    ElMessage.warning(t('notes.selectToMove'));
    return;
  }
  targetMoveCategory.value = '';
  isMoveDialogOpen.value = true;
};

const confirmBatchMove = async () => {
  isMoveDialogOpen.value = false;
  loading.value = true;
  try {
    const categoryValue = targetMoveCategory.value || null;
    await Promise.all(
      selectedNoteIds.value.map((id) => api.put(`/api/notes/${id}`, { category: categoryValue })),
    );
    ElMessage.success(t('notes.batchMoveSuccess', { n: selectedNoteIds.value.length }));
    selectedNoteIds.value = [];
    isSelectionMode.value = false;

    await loadTagsAndCategories();
    await loadNotes();
  } catch {
    ElMessage.error(t('notes.batchMoveFailed'));
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  loadNotes();
};

const dailyQuote = ref('');
const dailyQuoteGenerated = ref(false);
const isGeneratingQuote = ref(false);

const fetchDailyQuote = async () => {
  try {
    const res = await api.get('/api/notes/daily-quote');
    dailyQuote.value = res.data.quote || '';
    dailyQuoteGenerated.value = res.data.generated === true;
  } catch (err) {
    logError(err, { operation: 'fetchDailyQuote', view: 'NotesView' });
  }
};

const handleGenerateDailyQuote = async () => {
  if (isGeneratingQuote.value) return;
  isGeneratingQuote.value = true;
  try {
    const res = await api.post('/api/notes/daily-quote/generate');
    dailyQuote.value = res.data.quote || '';
    dailyQuoteGenerated.value = res.data.generated === true;
    ElMessage.success('今日灵感寄语生成成功！');
  } catch (err) {
    logError(err, { operation: 'generateDailyQuote', view: 'NotesView' });
    ElMessage.error('AI生成失败，请稍后重试');
  } finally {
    isGeneratingQuote.value = false;
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
  fetchDailyQuote();
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});
</script>

<template>
  <div
    class="mobile-adaptive flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header Section -->
    <PageHeader :title="t('notes.title')" :subtitle="t('notes.subtitle')" :icon="Notebook">
      <template #center>
        <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
          <Search />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('notes.searchPlaceholder')"
            @keyup.enter="loadNotes"
          />
        </label>
      </template>
      <div class="flex items-center gap-2.5 w-full sm:w-auto">
        <button
          type="button"
          class="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[var(--text-primary)] px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all active:scale-95 border border-[var(--border-base)] shrink-0 w-full sm:w-auto cursor-pointer shadow-xs"
          @click="openImportDialog"
        >
          <Github class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-secondary)]" />
          <span>{{ t('notes.importGithub') }}</span>
        </button>
        <button
          type="button"
          class="bg-accent hover:bg-accent-dark text-white px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all active:scale-95 shadow-lg shadow-accent/20 shrink-0 w-full sm:w-auto cursor-pointer"
          @click="openCreateDialog"
        >
          <Plus class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{{ t('notes.publish') }}</span>
        </button>
      </div>
    </PageHeader>

    <!-- Main Content Area -->
    <div
      class="flex-1 overflow-y-auto custom-scrollbar pt-0 pb-2.5 px-2.5 sm:pt-0 sm:pb-4 sm:px-4 lg:pt-0 lg:pb-4.5 lg:px-4.5"
    >
      <div class="max-w-none">
        <div
          class="mobile-row flex flex-wrap items-center gap-3 mb-3 md:mb-4 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/40 dark:border-slate-800/40"
        >
          <Tabs
            v-model="activeTab"
            :options="[
              { label: t('notes.tabMy'), value: 'MY' },
              { label: t('notes.tabActivity'), value: 'ACTIVITY' },
              { label: t('notes.tabPopular'), value: 'POPULAR' },
            ]"
            size="md"
            class="!bg-transparent border-none shrink-0"
          />

          <!-- Right side: Search & Filters -->
          <div
            class="flex flex-wrap flex-1 items-center gap-2 min-w-0 md:min-w-[280px] justify-start sm:justify-end"
          >
            <!-- Sort Select -->
            <el-select
              v-model="sortBy"
              :placeholder="t('notes.sortLabel')"
              class="shrink-0 !w-24 sm:!w-24 note-filter-select"
              @change="loadNotes"
            >
              <el-option :label="t('notes.sortLatest')" value="latest" />
              <el-option :label="t('notes.sortMostViewed')" value="most_viewed" />
              <el-option :label="t('notes.sortMostLiked')" value="most_liked" />
            </el-select>

            <!-- Tags and Categories Selects -->
            <template
              v-if="
                tags.length || categories.length || (activeTab === 'MY' && myNotebooksList.length)
              "
            >
              <!-- Mobile Notebook Dropdown Selector -->
              <el-select
                v-if="activeTab === 'MY'"
                :model-value="
                  filterCategory === '__uncategorized__' ? 'UNCATEGORIZED' : filterCategory || 'ALL'
                "
                :placeholder="t('notes.notebookLabel')"
                class="md:hidden shrink-0 !w-24 sm:!w-24 note-filter-select"
                @change="selectNotebook"
              >
                <el-option :label="t('notes.allNotes')" value="ALL" />
                <el-option :label="t('notes.uncategorized')" value="UNCATEGORIZED" />
                <el-option v-for="cat in myNotebooksList" :key="cat" :label="cat" :value="cat" />
              </el-select>

              <!-- Tag Select -->
              <el-select
                v-if="tags.length"
                v-model="filterTag"
                :placeholder="t('notes.tagLabel')"
                class="shrink-0 !w-24 sm:!w-24 note-filter-select"
                clearable
                @change="loadNotes"
              >
                <el-option
                  v-for="tagName in tags"
                  :key="tagName"
                  :label="tagName"
                  :value="tagName"
                />
              </el-select>

              <!-- Category Select (Only if not MY tab) -->
              <el-select
                v-if="activeTab !== 'MY' && categories.length"
                v-model="filterCategory"
                :placeholder="t('notes.categoryLabel')"
                class="shrink-0 !w-24 sm:!w-24 note-filter-select"
                clearable
                @change="loadNotes"
              >
                <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
              </el-select>
            </template>

            <!-- Batch Management Toggle Button -->
            <button
              v-if="activeTab === 'MY' && notes.length > 0"
              type="button"
              class="flex items-center justify-center w-8 h-8 rounded-lg border transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
              :class="[
                isSelectionMode
                  ? 'bg-purple-500/10 border-purple-500/25 text-purple-500 dark:text-purple-400'
                  : 'bg-[var(--bg-card)] border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-zinc-800',
              ]"
              :title="isSelectionMode ? t('notes.cancelBatch') : t('notes.batchManage')"
              @click="toggleSelectionMode"
            >
              <CheckSquare v-if="isSelectionMode" class="w-4 h-4 shrink-0" />
              <Square v-else class="w-4 h-4 shrink-0" />
            </button>

            <!-- Layout Switcher (Grid / List) -->
            <Tabs v-model="viewMode" :options="viewModeOptions" size="sm" class="shrink-0" />
          </div>
        </div>

        <div class="flex flex-col md:flex-row gap-4.5 items-start">
          <!-- Left side Notebook List for MY Tab (Desktop) -->
          <aside
            v-if="activeTab === 'MY'"
            class="hidden md:flex flex-col w-[180px] shrink-0 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-3.5 space-y-3.5 shadow-lg shadow-slate-100/50 dark:shadow-none transition-colors duration-300"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5"
              >
                <Notebook class="w-4 h-4 text-accent" /> {{ t('notes.notebookManagement') }}
              </span>
              <button
                type="button"
                class="text-accent hover:text-accent-dark hover:bg-accent/5 p-1 rounded-lg transition-all cursor-pointer"
                :title="t('notes.newNotebook')"
                @click="createNotebookDialogRef?.open()"
              >
                <FolderPlus class="w-4 h-4" />
              </button>
            </div>

            <div
              class="relative flex flex-col gap-1 max-h-[500px] overflow-y-auto custom-scrollbar"
            >
              <Tabs
                v-model="activeNotebook"
                :options="notebookTabOptions"
                direction="vertical"
                size="sm"
              />
            </div>
          </aside>

          <!-- Right side: Note content list -->
          <div class="flex-1 min-w-0 w-full flex flex-col gap-2 md:gap-3">
            <!-- Search & Filters moved to top level inline with Tabs -->

            <!-- Batch Management Action Bar -->
            <div
              v-if="isSelectionMode && activeTab === 'MY'"
              class="mobile-row flex items-center justify-between p-3 rounded-2xl border border-accent/20 bg-accent/5 backdrop-blur-xs text-xs font-bold mb-3"
            >
              <div class="flex items-center gap-3">
                <Checkbox
                  :model-value="
                    notes.length > 0 &&
                    selectedNoteIds.length ===
                      notes.filter(
                        (n) => n.userId === authStore.user?.id || authStore.user?.role === 'ADMIN',
                      ).length
                  "
                  @change="handleSelectAll"
                >
                  <span class="text-xs font-bold text-[var(--text-primary)]">{{
                    t('notes.selectAll')
                  }}</span>
                </Checkbox>
                <span class="text-[var(--text-secondary)]">{{
                  t('notes.selectedCount', { n: selectedNoteIds.length })
                }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  class="font-bold"
                  :disabled="selectedNoteIds.length === 0"
                  @click="handleBatchMove"
                >
                  {{ t('notes.batchMove') }}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  class="font-bold"
                  :disabled="selectedNoteIds.length === 0"
                  @click="handleBatchDelete"
                >
                  {{ t('notes.batchDelete') }}
                </Button>
              </div>
            </div>

            <!-- Loading State -->
            <div
              v-if="loading"
              class="flex flex-col items-center justify-center py-32 text-[var(--text-muted)] w-full"
            >
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p class="mt-4 font-medium">{{ t('notes.loadingNotes') }}</p>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="notes.length === 0"
              class="flex flex-col items-center justify-center py-32 w-full"
            >
              <div
                class="w-24 h-24 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6"
              >
                <Notebook class="w-12 h-12 text-[var(--text-muted)] opacity-40" />
              </div>
              <p class="text-[var(--text-secondary)] font-medium">
                {{ t('notes.noNotesContent') }}
              </p>
            </div>

            <!-- Content list -->
            <div v-else class="w-full">
              <!-- TIMELINE FEED for ACTIVITY Tab -->
              <ActivityTimeline
                v-if="activeTab === 'ACTIVITY'"
                :notes="notes"
                :tags="tags"
                :categories="categories"
                :total-notes="totalNotes"
                :filter-tag="filterTag"
                :filter-category="filterCategory"
                :daily-quote-prop="dailyQuote"
                :daily-quote-generated="dailyQuoteGenerated"
                :is-generating-quote="isGeneratingQuote"
                :view-mode="viewMode"
                @click-detail="viewDetail"
                @like="handleLike"
                @clone="(note) => cloneDialogRef?.open(note)"
                @edit="openEditDialog"
                @delete="handleDelete"
                @popular-toggle="handleTogglePopular"
                @generate-daily-quote="handleGenerateDailyQuote"
                @filter-tag="
                  (t) => {
                    filterTag = t;
                    loadNotes();
                  }
                "
                @filter-category="
                  (c) => {
                    filterCategory = c;
                    loadNotes();
                  }
                "
                @click-avatar="handleShowUserProfile"
              />

              <!-- CARDS GRID for MY & POPULAR Tabs -->
              <div
                v-else
                :class="
                  viewMode === 'list'
                    ? 'flex flex-col gap-2 sm:gap-3 w-full'
                    : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6'
                "
              >
                <NoteCard
                  v-for="(note, index) in notes"
                  :key="note.id"
                  :note="note"
                  :index="index"
                  :active-tab="activeTab"
                  :is-mobile="isMobile"
                  :is-selection-mode="isSelectionMode && activeTab === 'MY'"
                  :is-selected="selectedNoteIds.includes(note.id)"
                  :view-mode="viewMode"
                  @click-detail="viewDetail"
                  @dragstart="handleDragStart"
                  @edit="openEditDialog"
                  @delete="handleDelete"
                  @popular-toggle="handleTogglePopular"
                  @visibility-toggle="handleToggleVisibility"
                  @like="handleLike"
                  @share="openShareDialog"
                  @click-avatar="handleShowUserProfile"
                  @toggle-select="toggleNoteSelection"
                />
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="flex justify-center mt-12 mb-8">
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

    <!-- Dialogs Subcomponents -->
    <NotebookCreateDialog
      ref="createNotebookDialogRef"
      :local-notebooks="localNotebooks"
      :categories="categories"
      @created="handleNotebookCreated"
    />

    <NoteCloneDialog
      ref="cloneDialogRef"
      :my-notebooks-list="myNotebooksList"
      @cloned="handleNoteCloned"
    />

    <NoteEditorDialog
      ref="editorDialogRef"
      :my-notebooks-list="myNotebooksList"
      @saved="handleEditorSaved"
    />

    <NoteDetailDialog
      ref="detailDialogRef"
      @like-updated="handleDetailLikeUpdated"
      @popular-updated="handleDetailPopularUpdated"
      @views-updated="handleDetailViewsUpdated"
      @share="openShareDialog"
    />

    <NoteShareDialog ref="shareDialogRef" />

    <NoteImportGithubDialog
      ref="githubImportDialogRef"
      :my-notebooks-list="myNotebooksList"
      @imported="handleImportedSuccess"
    />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleChatWithMember"
    />

    <!-- Batch Move Dialog -->
    <Modal
      :show="isMoveDialogOpen"
      :title="t('notes.batchMoveTitle')"
      size="sm"
      @close="isMoveDialogOpen = false"
    >
      <div class="py-2">
        <p class="text-xs text-[var(--text-secondary)] mb-3">
          {{ t('notes.selectTargetNotebook') }}
        </p>
        <el-select
          v-model="targetMoveCategory"
          :placeholder="t('notes.selectNotebookPlaceholder')"
          class="w-full note-filter-select"
        >
          <el-option :label="t('notes.uncategorized')" value="" />
          <el-option v-for="cat in myNotebooksList" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="sm" @click="isMoveDialogOpen = false">{{
            t('common.cancel')
          }}</Button>
          <Button variant="primary" size="sm" @click="confirmBatchMove">{{
            t('common.confirm')
          }}</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}

/* Custom styling to make input and select compact and premium */
:deep(.note-search-input .el-input__wrapper) {
  border-radius: 8px !important;
  background-color: var(--bg-card) !important;
  box-shadow: 0 0 0 1px var(--border-base) inset !important;
  height: 32px !important;
  transition: all 0.2s ease !important;
}
:deep(.note-search-input .el-input__wrapper:hover),
:deep(.note-search-input .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--accent) inset !important;
}

:deep(.note-filter-select .el-select__wrapper) {
  border-radius: 8px !important;
  background-color: var(--bg-card) !important;
  box-shadow: 0 0 0 1px var(--border-base) inset !important;
  transition: all 0.2s ease !important;
  height: 32px !important;
  line-height: 32px !important;
  padding: 0 10px !important;
}
:deep(.note-filter-select .el-select__wrapper:hover),
:deep(.note-filter-select .el-select__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--accent) inset !important;
}
:deep(.note-filter-select .el-select__placeholder) {
  font-size: 12px !important;
  color: var(--text-muted) !important;
}
:deep(.note-filter-select .el-select__text) {
  font-size: 12px !important;
  color: var(--text-primary) !important;
  font-weight: 600 !important;
}
</style>

<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import {
  Plus,
  Search,
  Notebook,
  FolderPlus,
  Folder
} from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import PageHeader from '@/components/PageHeader.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import { useRouter } from 'vue-router';

// Subcomponents
import NotebookCreateDialog from './components/NotebookCreateDialog.vue';
import NoteCloneDialog from './components/NoteCloneDialog.vue';
import NoteEditorDialog from './components/NoteEditorDialog.vue';
import NoteDetailDialog from './components/NoteDetailDialog.vue';
import NoteShareDialog from './components/NoteShareDialog.vue';
import NoteCard from './components/NoteCard.vue';
import ActivityTimeline from './components/ActivityTimeline.vue';

const authStore = useAuthStore();
const router = useRouter();

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

// Dialog component references
const createNotebookDialogRef = ref<InstanceType<typeof NotebookCreateDialog> | null>(null);
const cloneDialogRef = ref<InstanceType<typeof NoteCloneDialog> | null>(null);
const editorDialogRef = ref<InstanceType<typeof NoteEditorDialog> | null>(null);
const detailDialogRef = ref<InstanceType<typeof NoteDetailDialog> | null>(null);
const shareDialogRef = ref<InstanceType<typeof NoteShareDialog> | null>(null);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const handleShowUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleChatWithMember = async (member: any) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [member.id],
      isGroup: false,
    });
    router.push('/messages');
  } catch (_error) {
    ElMessage.error('无法发起对话');
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

const handleNotebookCreated = (name: string) => {
  localNotebooks.value.push(name);
  saveLocalNotebooks();
  ElMessage.success(`笔记本「${name}」创建成功！`);
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
  } else if (notebookName === 'UNCATEGORIZED' || notebookName === 'UNCATEGORIZED') {
    filterCategory.value = '__uncategorized__';
  } else {
    filterCategory.value = notebookName;
  }
  currentPage.value = 1;
  loadNotes();
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

const totalPages = computed(() => Math.ceil(totalNotes.value / pageSize));

type NoteQueryParams = {
  page: number;
  limit: number;
  sort: string;
  author?: string;
  visibility?: string;
  search?: string;
  tag?: string;
  category?: string;
};

const loadNotes = async () => {
  loading.value = true;
  try {
    let endpoint = '/api/notes';
    const params: NoteQueryParams = {
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
  editorDialogRef.value?.open();
};

const openEditDialog = (note: Note) => {
  editorDialogRef.value?.open(note);
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
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '操作失败'));
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

const handlePageChange = (page: number) => {
  currentPage.value = page;
  loadNotes();
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
      <button type="button" class="bg-accent hover:bg-accent-dark text-white px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all active:scale-95 shadow-lg shadow-accent/20 shrink-0 w-full sm:w-auto cursor-pointer" @click="openCreateDialog">
        <Plus class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>发布笔记</span>
      </button>
    </PageHeader>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-2.5 sm:p-4 lg:p-4.5">
      <div class="max-w-none">
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
              <button type="button" class="text-accent hover:text-accent-dark hover:bg-accent/5 p-1 rounded-lg transition-all cursor-pointer" title="新建笔记本" @click="createNotebookDialogRef?.open()">
                <FolderPlus class="w-4 h-4" />
              </button>
            </div>
            
            <div class="flex flex-col gap-1 max-h-[500px] overflow-y-auto custom-scrollbar">
              <!-- All Notes -->
              <button
type="button" class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 text-left w-full cursor-pointer border border-transparent" :class="[
                  !filterCategory ? 'bg-accent/10 text-accent font-black border-accent/10' : 'text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5',
                  draggedNotebook === 'ALL' ? 'bg-accent/20 text-accent border-accent/30 shadow-sm' : ''
                ]" @click="selectNotebook('ALL')" @dragover.prevent @dragenter.prevent="draggedNotebook = 'ALL'" @dragleave="draggedNotebook = null" @drop="handleDrop($event, 'ALL')">
                <span class="flex items-center gap-2 truncate">
                  <Folder class="w-3.5 h-3.5" :class="[!filterCategory ? 'text-accent' : 'text-[var(--text-muted)]']" /> 全部笔记
                </span>
              </button>
              
              <!-- Uncategorized -->
              <button
type="button" class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 text-left w-full cursor-pointer border border-transparent" :class="[
                  filterCategory === '__uncategorized__' ? 'bg-accent/10 text-accent font-black border-accent/10' : 'text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5',
                  draggedNotebook === 'UNCATEGORIZED' ? 'bg-accent/20 text-accent border-accent/30 shadow-sm' : ''
                ]" @click="selectNotebook('UNCATEGORIZED')" @dragover.prevent @dragenter.prevent="draggedNotebook = 'UNCATEGORIZED'" @dragleave="draggedNotebook = null" @drop="handleDrop($event, 'UNCATEGORIZED')">
                <span class="flex items-center gap-2 truncate">
                  <Folder class="w-3.5 h-3.5" :class="[filterCategory === '__uncategorized__' ? 'text-accent' : 'text-[var(--text-muted)]']" /> 未分类
                </span>
              </button>
              
              <!-- Dynamic Categories / Notebooks -->
              <button
v-for="cat in myNotebooksList" :key="cat" type="button" class="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 text-left w-full cursor-pointer border border-transparent" :class="[
                  filterCategory === cat ? 'bg-accent/10 text-accent font-black border-accent/10' : 'text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5',
                  draggedNotebook === cat ? 'bg-accent/20 text-accent border-accent/30 shadow-sm' : ''
                ]" @click="selectNotebook(cat)" @dragover.prevent @dragenter.prevent="draggedNotebook = cat" @dragleave="draggedNotebook = null" @drop="handleDrop($event, cat)">
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
                <Notebook class="w-12 h-12 text-[var(--text-muted)] opacity-40" />
              </div>
              <p class="text-[var(--text-secondary)] font-medium">暂无相关笔记内容</p>
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
                @click-detail="viewDetail"
                @like="handleLike"
                @clone="(note) => cloneDialogRef?.open(note)"
                @edit="openEditDialog"
                @delete="handleDelete"
                @filter-tag="(t) => { filterTag = t; loadNotes() }"
                @filter-category="(c) => { filterCategory = c; loadNotes() }"
                @click-avatar="handleShowUserProfile"
              />

              <!-- CARDS GRID for MY & POPULAR Tabs -->
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                <NoteCard
                  v-for="(note, index) in notes"
                  :key="note.id"
                  :note="note"
                  :index="index"
                  :active-tab="activeTab"
                  :is-mobile="isMobile"
                  @click-detail="viewDetail"
                  @dragstart="handleDragStart"
                  @edit="openEditDialog"
                  @delete="handleDelete"
                  @popular-toggle="handleTogglePopular"
                  @like="handleLike"
                  @share="openShareDialog"
                  @click-avatar="handleShowUserProfile"
                />
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

    <NoteShareDialog
      ref="shareDialogRef"
    />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleChatWithMember"
    />
  </div>
</template>

<style scoped>
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
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
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
} from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import UserAvatar from '@/components/UserAvatar.vue';

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
  _count: { likes: number };
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

onMounted(() => {
  loadNotes();
  loadTagsAndCategories();
});
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden">
    <!-- Header Section -->
    <div
      class="px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 border-b gap-4"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 md:gap-4">
        <div class="p-2 md:p-3 bg-accent-subtle rounded-xl md:rounded-2xl">
          <Notebook class="w-5 h-5 md:w-6 md:h-6 text-accent" />
        </div>
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-[var(--text-primary)]">学习笔记</h1>
          <p class="text-[10px] md:text-xs text-[var(--text-muted)] mt-0.5">记录学习心得，分享知识见解</p>
        </div>
      </div>
      <el-button type="primary" :icon="Plus" size="default" round class="w-full sm:w-auto" @click="openCreateDialog">
        发布笔记
      </el-button>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
      <div class="max-w-[1600px] mx-auto">
        <div class="mb-4 md:mb-8">
          <el-tabs v-model="activeTab" class="custom-note-tabs" @tab-change="handleTabChange">
            <el-tab-pane label="我的" name="MY" />
            <el-tab-pane label="动态" name="ACTIVITY" />
            <el-tab-pane label="热门" name="POPULAR" />
          </el-tabs>
        </div>

        <div class="flex flex-col gap-4 md:gap-6">
          <div class="flex-1 min-w-0">
            <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 md:gap-4 mb-6">
              <el-input
                v-model="searchQuery"
                placeholder="搜索..."
                :prefix-icon="Search"
                clearable
                class="col-span-2 !w-full sm:!w-64"
                @keyup.enter="loadNotes"
                @clear="loadNotes"
              />

              <div
                class="flex items-center gap-1 p-1 rounded-xl"
                style="background-color: var(--bg-card); border: 1px solid var(--border-base)"
              >
                <el-select v-model="sortBy" placeholder="排序" class="!w-full sm:!w-32" @change="loadNotes">
                  <el-option label="最新" value="latest" />
                  <el-option label="浏览" value="most_viewed" />
                  <el-option label="点赞" value="most_liked" />
                </el-select>
              </div>

              <div
                v-if="tags.length"
                class="flex items-center gap-1 p-1 rounded-xl"
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

              <div
                v-if="categories.length"
                class="flex items-center gap-1 p-1 rounded-xl"
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

            <div
              v-if="loading"
              class="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]"
            >
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p class="mt-4 font-medium">正在为您加载笔记...</p>
            </div>

            <div
              v-else-if="notes.length === 0"
              class="flex flex-col items-center justify-center py-32"
            >
              <div
                class="w-24 h-24 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6"
              >
                <BookOpen class="w-12 h-12 text-[var(--text-muted)] opacity-40" />
              </div>
              <p class="text-[var(--text-secondary)] font-medium">暂无相关笔记内容</p>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <div
                v-for="note in notes"
                :key="note.id"
                class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-full relative"
                @click="viewDetail(note)"
              >
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-2.5">
                    <UserAvatar :user="note.user" size="sm" />
                    <div>
                      <p class="text-sm font-bold text-[var(--text-primary)] leading-none">
                        {{ note.user.name }}
                      </p>
                      <p class="text-[10px] text-[var(--text-muted)] mt-1">
                        {{ formatDate(note.createdAt) }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <el-tag v-if="note.isPopular" type="warning" size="small" round effect="dark">热门</el-tag>
                    <el-tag :type="getVisibilityTag(note.visibility)" size="small" round>
                      {{ getVisibilityLabel(note.visibility) }}
                    </el-tag>
                  </div>
                </div>

                <h3
                  class="text-lg font-bold text-[var(--text-primary)] mb-3 line-clamp-1 group-hover:text-accent transition-colors"
                >
                  {{ note.title }}
                </h3>
                <p
                  class="text-sm text-[var(--text-secondary)] line-clamp-3 mb-4 flex-1 leading-relaxed"
                >
                  {{ note.summary || note.content.replace(/[#*`>]/g, '').slice(0, 150) }}
                </p>

                <div v-if="parseTags(note).length" class="flex flex-wrap gap-1.5 mb-5">
                  <span
                    v-for="tag in parseTags(note).slice(0, 3)"
                    :key="tag"
                    class="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-white/5 text-[var(--text-muted)] text-[10px] font-bold border border-[var(--border-base)]"
                  >
                    #{{ tag }}
                  </span>
                </div>

                <div
                  class="flex items-center justify-between mt-auto pt-4 border-t border-[var(--border-base)]"
                >
                  <div
                    class="flex items-center gap-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider"
                  >
                    <span class="flex items-center gap-1.5">
                      <Eye class="w-3.5 h-3.5" /> {{ note.views }}
                    </span>
                    <span
                      class="flex items-center gap-1.5 cursor-pointer hover:text-red-500 transition-colors"
                      :class="{ 'text-red-500': note.isLiked }"
                      @click.stop="handleLike(note)"
                    >
                      <ThumbsUp class="w-3.5 h-3.5" :class="{ 'fill-current': note.isLiked }" />
                      {{ note._count.likes }}
                    </span>
                  </div>
                  <span
                    v-if="note.category"
                    class="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded uppercase"
                  >
                    {{ note.category }}
                  </span>
                </div>

                <!-- Hover Actions -->
                <div
                  class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0"
                >
                  <template v-if="note.userId === authStore.user?.id">
                    <el-button circle size="small" @click.stop="openEditDialog(note)">
                      <Edit3 class="w-3.5 h-3.5" />
                    </el-button>
                    <el-button circle size="small" type="danger" @click.stop="handleDelete(note)">
                      <Trash2 class="w-3.5 h-3.5" />
                    </el-button>
                  </template>
                </div>
              </div>
            </div>

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
              <el-radio-button label="edit">
                <div class="flex items-center gap-1 px-1">
                  <Edit3 class="w-3.5 h-3.5" /> <span class="hidden sm:inline">编辑</span>
                </div>
              </el-radio-button>
              <el-radio-button label="live">
                <div class="flex items-center gap-1 px-1">
                  <Layout class="w-3.5 h-3.5" /> <span class="hidden sm:inline">实时</span>
                </div>
              </el-radio-button>
              <el-radio-button label="preview">
                <div class="flex items-center gap-1 px-1">
                  <Eye class="w-3.5 h-3.5" /> <span class="hidden sm:inline">预览</span>
                </div>
              </el-radio-button>
            </el-radio-group>

            <el-dropdown trigger="click">
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
                      <el-radio-button label="PRIVATE">私有</el-radio-button>
                      <el-radio-button label="PUBLIC">公开</el-radio-button>
                    </el-radio-group>
                  </div>
                  <div>
                    <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">分类</p>
                    <el-input v-model="formCategory" placeholder="例如：前端开发" size="small" />
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

        <main class="max-w-6xl mx-auto px-4 pb-32 pt-10">
          <div class="bg-[var(--bg-card)] border border-[var(--border-base)] shadow-sm rounded-lg min-h-[80vh] px-8 md:px-16 py-12 md:py-20">
            <el-input v-model="formTitle" placeholder="无标题" class="editor-modern-title mb-4" />
            <MarkdownEditor
              v-model="formContent"
              auto-height
              class="modern-paper-theme"
              :auto-focus="true"
              :preview="previewMode === 'live'"
              :html-preview="previewMode === 'preview'"
            />
            <div class="mt-12 flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest pt-8 border-t border-[var(--border-base)]">
              <div class="flex items-center gap-4">
                <span class="flex items-center gap-1"><Check class="w-3 h-3" /> 自动保存</span>
                <span class="flex items-center gap-1"><BookOpen class="w-3 h-3" /> Markdown 支持</span>
              </div>
              <span>共 {{ formContent.length }} 字符</span>
            </div>
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
        <aside class="w-full md:w-72 bg-slate-50/50 dark:bg-white/[0.02] p-4 md:p-8 flex flex-col shrink-0 border-b md:border-b-0 md:border-r" style="border-color: var(--border-base)">
          <div class="mb-4 md:mb-8 flex items-center justify-between">
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

          <div class="mb-6 md:mb-10 flex items-center md:items-start md:flex-col gap-3 md:gap-0">
            <UserAvatar :user="detailNote.user" size="md" md-size="lg" class="md:mb-4 shrink-0" />
            <div class="min-w-0">
              <h4 class="font-bold text-[var(--text-primary)] mb-1 truncate">{{ detailNote.user.name }}</h4>
              <p class="text-[10px] md:text-xs text-[var(--text-muted)] line-clamp-1 md:line-clamp-2 leading-relaxed">
                {{ detailNote.user.bio || '探索者' }}
              </p>
            </div>
          </div>

          <div class="hidden md:block space-y-8 flex-1 overflow-y-auto pr-2 scrollbar-hide">
            <div>
              <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-4">数据统计</p>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white dark:bg-white/5 p-3 rounded-xl border border-[var(--border-base)]">
                  <p class="text-[10px] text-[var(--text-muted)] mb-1">阅读</p>
                  <p class="text-sm font-black text-[var(--text-primary)]">{{ detailNote.views }}</p>
                </div>
                <div class="bg-white dark:bg-white/5 p-3 rounded-xl border border-[var(--border-base)]">
                  <p class="text-[10px] text-[var(--text-muted)] mb-1">点赞</p>
                  <p class="text-sm font-black text-[var(--text-primary)]">{{ detailNote._count.likes }}</p>
                </div>
              </div>
            </div>
            <div>
              <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-4">分类标签</p>
              <div class="flex flex-wrap gap-2">
                <span v-if="detailNote.category" class="px-2 py-1 rounded bg-accent/10 text-accent text-[10px] font-bold">{{ detailNote.category }}</span>
                <span v-for="tag in parseTags(detailNote)" :key="tag" class="px-2 py-1 rounded bg-slate-100 dark:bg-white/5 text-[var(--text-secondary)] text-[10px] font-bold border border-[var(--border-base)]">#{{ tag }}</span>
              </div>
            </div>
          </div>

          <div class="hidden md:flex pt-8 border-t border-[var(--border-base)] flex-col gap-3">
            <el-button class="w-full !rounded-xl font-bold" :type="detailNote.isLiked ? 'danger' : ''" @click="handleLike(detailNote)">
              <ThumbsUp class="w-4 h-4 mr-2" :class="{ 'fill-current': detailNote.isLiked }" />
              {{ detailNote.isLiked ? '已赞' : '点赞' }}
            </el-button>
            <el-button class="w-full !rounded-xl font-bold" :loading="isCopying" @click="handleCopy">
              <component :is="isCopying ? Check : Copy" class="w-4 h-4 mr-2" />
              {{ isCopying ? '已复制' : '复制全文' }}
            </el-button>
          </div>
        </aside>

        <div class="flex-1 bg-white dark:bg-[var(--bg-card)] overflow-y-auto custom-scrollbar">
          <div class="max-w-[800px] mx-auto px-4 md:px-12 py-8 md:py-16">
            <header class="mb-8 md:mb-12">
              <h1 class="text-2xl md:text-4xl font-extrabold text-[var(--text-primary)] leading-tight mb-4 md:mb-6">{{ detailNote.title }}</h1>
              <div v-if="detailNote.summary" class="bg-slate-50 dark:bg-white/[0.02] rounded-xl md:rounded-2xl p-4 md:p-6 text-[var(--text-secondary)] text-xs md:text-sm leading-relaxed border-l-4 border-l-accent">
                <span class="block text-[8px] md:text-[10px] font-black text-accent mb-1 md:mb-2 tracking-widest uppercase">Abstract</span>
                {{ detailNote.summary }}
              </div>
            </header>
            <div class="modern-markdown-content">
              <MarkdownEditor :model-value="detailNote.content" preview-only />
            </div>
            <footer class="mt-12 md:mt-24 pt-8 md:pt-12 border-t border-[var(--border-base)] text-center">
              <div class="inline-flex items-center gap-2 text-[var(--text-muted)] text-xs md:text-sm font-medium">
                <BookOpen class="w-4 h-4" />
                <span>END OF ARTICLE</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
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
  font-size: 1.5rem !important;
  font-weight: 800 !important;
  color: var(--text-primary) !important;
  border: none !important;
}
:deep(.custom-note-tabs .el-tabs__nav-wrap::after) {
  display: none;
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
</style>

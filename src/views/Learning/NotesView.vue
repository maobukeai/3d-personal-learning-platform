<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Eye, ThumbsUp, Trash2, Edit3, Tag, FolderOpen, BookOpen, Copy, Check } from 'lucide-vue-next'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const authStore = useAuthStore()

interface Note {
  id: string
  title: string
  content: string
  summary?: string
  visibility: string
  tags?: string
  category?: string
  views: number
  isPinned: boolean
  isPopular: boolean
  isLiked: boolean
  userId: string
  _count: { likes: number }
  user: { id: string; name: string; avatarUrl: string }
  createdAt: string
  updatedAt: string
}

const activeTab = ref<'MY' | 'POPULAR' | 'ACTIVITY'>('MY')
const notes = ref<Note[]>([])
const tags = ref<string[]>([])
const categories = ref<string[]>([])
const loading = ref(false)
const totalNotes = ref(0)
const currentPage = ref(1)
const pageSize = 12
const searchQuery = ref('')
const sortBy = ref('latest')
const filterTag = ref('')
const filterCategory = ref('')

const showCreateDialog = ref(false)
const showDetailDialog = ref(false)
const editingNote = ref<Note | null>(null)
const detailNote = ref<Note | null>(null)
const formTitle = ref('')
const formContent = ref('')
const formSummary = ref('')
const formVisibility = ref('PRIVATE')
const formTags = ref('')
const formCategory = ref('')
const saving = ref(false)
const readingProgress = ref(0)
const readingArea = ref<HTMLElement | null>(null)
const isCopying = ref(false)

const handleCopy = async () => {
  if (!detailNote.value) return
  try {
    await navigator.clipboard.writeText(detailNote.value.content)
    isCopying.value = true
    ElMessage.success('已复制全文到剪贴板')
    setTimeout(() => {
      isCopying.value = false
    }, 2000)
  } catch {
    ElMessage.error('复制失败')
  }
}

const updateProgress = (e: Event) => {
  const target = e.target as HTMLElement
  const winScroll = target.scrollTop
  const height = target.scrollHeight - target.clientHeight
  readingProgress.value = (winScroll / height) * 100
}

const totalPages = computed(() => Math.ceil(totalNotes.value / pageSize))

const loadNotes = async () => {
  loading.value = true
  try {
    let endpoint = '/api/notes'
    const params: any = {
      page: currentPage.value,
      limit: pageSize,
      sort: sortBy.value
    }

    if (activeTab.value === 'MY') {
      params.author = 'me'
    } else if (activeTab.value === 'ACTIVITY') {
      params.visibility = 'PUBLIC'
    } else if (activeTab.value === 'POPULAR') {
      endpoint = '/api/notes/popular'
      // Popular notes endpoint might not support pagination in the same way, 
      // but I updated it to take 12.
    }

    if (searchQuery.value) params.search = searchQuery.value
    if (filterTag.value) params.tag = filterTag.value
    if (filterCategory.value) params.category = filterCategory.value

    const res = await api.get(endpoint, { params })
    if (activeTab.value === 'POPULAR') {
      notes.value = res.data
      totalNotes.value = res.data.length
    } else {
      notes.value = res.data.notes
      totalNotes.value = res.data.pagination.total
    }
  } catch {
    ElMessage.error('加载笔记失败')
  } finally {
    loading.value = false
  }
}

const handleTabChange = () => {
  currentPage.value = 1
  loadNotes()
}

const handlePromote = async (note: Note) => {
  try {
    const res = await api.post(`/api/notes/${note.id}/popular`)
    note.isPopular = res.data.isPopular
    ElMessage.success(note.isPopular ? '已推流到热门' : '已取消热门推流')
    if (activeTab.value === 'POPULAR' && !note.isPopular) {
      loadNotes()
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败')
  }
}

const loadTagsAndCategories = async () => {
  try {
    const [tagsRes, catRes] = await Promise.all([
      api.get('/api/notes/tags'),
      api.get('/api/notes/categories')
    ])
    tags.value = tagsRes.data.tags || []
    categories.value = catRes.data.categories || []
  } catch {}
}

const openCreateDialog = () => {
  editingNote.value = null
  formTitle.value = ''
  formContent.value = ''
  formSummary.value = ''
  formVisibility.value = 'PRIVATE'
  formTags.value = ''
  formCategory.value = ''
  showCreateDialog.value = true
}

const openEditDialog = (note: Note) => {
  editingNote.value = note
  formTitle.value = note.title
  formContent.value = note.content
  formSummary.value = note.summary || ''
  formVisibility.value = note.visibility
  formTags.value = note.tags ? (Array.isArray(JSON.parse(note.tags)) ? JSON.parse(note.tags).join(', ') : note.tags) : ''
  formCategory.value = note.category || ''
  showCreateDialog.value = true
}

const handleSave = async () => {
  if (!formTitle.value.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!formContent.value.trim()) {
    ElMessage.warning('请输入内容')
    return
  }

  saving.value = true
  try {
    const payload = {
      title: formTitle.value.trim(),
      content: formContent.value.trim(),
      summary: formSummary.value.trim() || undefined,
      visibility: formVisibility.value,
      tags: formTags.value ? JSON.stringify(formTags.value.split(',').map(t => t.trim()).filter(Boolean)) : undefined,
      category: formCategory.value.trim() || undefined
    }

    if (editingNote.value) {
      await api.put(`/api/notes/${editingNote.value.id}`, payload)
      ElMessage.success('笔记已更新')
    } else {
      await api.post('/api/notes', payload)
      ElMessage.success('笔记已创建')
    }

    showCreateDialog.value = false
    await loadNotes()
    await loadTagsAndCategories()
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (note: Note) => {
  try {
    await ElMessageBox.confirm('确定要删除这条笔记吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await api.delete(`/api/notes/${note.id}`)
    ElMessage.success('笔记已删除')
    await loadNotes()
  } catch {}
}

const handleLike = async (note: Note) => {
  try {
    const res = await api.post(`/api/notes/${note.id}/like`)
    note.isLiked = res.data.isLiked
    if (res.data.isLiked) {
      note._count.likes++
    } else {
      note._count.likes--
    }
  } catch {
    ElMessage.error('操作失败')
  }
}

const viewDetail = async (note: Note) => {
  try {
    const res = await api.get(`/api/notes/${note.id}`)
    detailNote.value = res.data
    showDetailDialog.value = true
    const idx = notes.value.findIndex(n => n.id === note.id)
    if (idx !== -1) {
      notes.value[idx].views = res.data.views
      notes.value[idx].isLiked = res.data.isLiked
    }
  } catch {
    ElMessage.error('加载笔记详情失败')
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadNotes()
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getVisibilityLabel = (v: string) => v === 'PUBLIC' ? '公开' : '私有'
const getVisibilityTag = (v: string) => v === 'PUBLIC' ? 'success' : 'info'

const parseTags = (note: Note): string[] => {
  if (!note.tags) return []
  try {
    const parsed = JSON.parse(note.tags)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return note.tags.split(',').map(t => t.trim()).filter(Boolean)
  }
}

onMounted(() => {
  loadNotes()
  loadTagsAndCategories()
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">学习笔记</h1>
        <p class="text-sm text-[var(--text-secondary)] mt-1">记录学习心得，分享知识见解</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog" size="large" round>
        写笔记
      </el-button>
    </div>

    <div class="mb-6">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="我的笔记" name="MY" />
        <el-tab-pane label="笔记动态" name="ACTIVITY" />
        <el-tab-pane label="热门推荐" name="POPULAR" />
      </el-tabs>
    </div>

    <div class="flex flex-col gap-6">
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <el-input
            v-model="searchQuery"
            placeholder="搜索笔记..."
            :prefix-icon="Search"
            clearable
            class="max-w-xs"
            @keyup.enter="loadNotes"
            @clear="loadNotes"
          />

          <el-select v-model="sortBy" placeholder="排序" class="w-32" @change="loadNotes">
            <el-option label="最新" value="latest" />
            <el-option label="最热" value="most_viewed" />
            <el-option label="最多赞" value="most_liked" />
            <el-option label="最早" value="oldest" />
          </el-select>

          <el-select v-if="tags.length" v-model="filterTag" placeholder="标签" class="w-32" clearable @change="loadNotes">
            <el-option v-for="t in tags" :key="t" :label="t" :value="t" />
          </el-select>

          <el-select v-if="categories.length" v-model="filterCategory" placeholder="分类" class="w-32" clearable @change="loadNotes">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <div v-if="loading" class="text-center py-20 text-[var(--text-muted)]">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p class="mt-2">加载中...</p>
        </div>

        <div v-else-if="notes.length === 0" class="text-center py-20">
          <BookOpen class="w-16 h-16 mx-auto text-[var(--text-muted)] opacity-40" />
          <p class="text-[var(--text-secondary)] mt-4">这里空空如也...</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="note in notes"
            :key="note.id"
            class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-5 hover:shadow-card-hover transition-all cursor-pointer group flex flex-col h-full"
            @click="viewDetail(note)"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <UserAvatar :src="note.user.avatarUrl" :name="note.user.name" size="sm" />
                <div>
                  <span class="text-sm font-medium text-[var(--text-primary)]">{{ note.user.name }}</span>
                  <span class="text-xs text-[var(--text-muted)] ml-2">{{ formatDate(note.createdAt) }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <el-tag v-if="note.isPopular" type="warning" size="small" round effect="dark">热门</el-tag>
                <el-tag :type="getVisibilityTag(note.visibility)" size="small" round>
                  {{ getVisibilityLabel(note.visibility) }}
                </el-tag>
              </div>
            </div>

            <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-2 line-clamp-1">
              {{ note.title }}
            </h3>
            <p class="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3 flex-1">
              {{ note.summary || note.content.replace(/[#*`>]/g, '').slice(0, 150) }}
            </p>

            <div v-if="parseTags(note).length" class="flex flex-wrap gap-1 mb-3">
              <el-tag v-for="tag in parseTags(note).slice(0, 3)" :key="tag" size="small" round type="info">
                {{ tag }}
              </el-tag>
            </div>

            <div class="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span class="flex items-center gap-1"><Eye class="w-3.5 h-3.5" /> {{ note.views }}</span>
              <span
                class="flex items-center gap-1 cursor-pointer hover:text-red-500 transition-colors"
                :class="{ 'text-red-500': note.isLiked }"
                @click.stop="handleLike(note)"
              >
                <ThumbsUp class="w-3.5 h-3.5" :class="{ 'fill-current': note.isLiked }" />
                {{ note._count.likes }}
              </span>
              <span v-if="note.category" class="flex items-center gap-1">
                <FolderOpen class="w-3.5 h-3.5" /> {{ note.category }}
              </span>
            </div>

            <div class="flex gap-2 mt-3 pt-3 border-t border-[var(--border-base)] opacity-0 group-hover:opacity-100 transition-opacity">
              <template v-if="note.userId === authStore.user?.id">
                <el-button size="small" text @click.stop="openEditDialog(note)">
                  <Edit3 class="w-4 h-4" />
                </el-button>
                <el-button size="small" text type="danger" @click.stop="handleDelete(note)">
                  <Trash2 class="w-4 h-4" />
                </el-button>
              </template>
              <template v-if="authStore.user?.role === 'ADMIN' && note.visibility === 'PUBLIC'">
                <el-button 
                  size="small" 
                  :type="note.isPopular ? 'warning' : 'info'" 
                  text 
                  @click.stop="handlePromote(note)"
                  :title="note.isPopular ? '取消推流' : '推流到热门'"
                >
                  <ThumbsUp class="w-4 h-4" :class="{ 'fill-current': note.isPopular }" />
                  {{ note.isPopular ? '取消推流' : '推流热门' }}
                </el-button>
              </template>
            </div>
          </div>
        </div>

        <div v-if="totalPages > 1 && activeTab !== 'POPULAR'" class="flex justify-center mt-6">
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

    <el-dialog
      v-model="showCreateDialog"
      :title="editingNote ? '编辑笔记' : '写笔记'"
      width="80%"
      top="5vh"
      class="custom-rounded-dialog"
      destroy-on-close
    >
      <div class="space-y-4">
        <el-input v-model="formTitle" placeholder="笔记标题" size="large" />
        <div class="flex gap-3">
          <el-select v-model="formVisibility" placeholder="可见性" class="w-28">
            <el-option label="私有" value="PRIVATE" />
            <el-option label="公开" value="PUBLIC" />
          </el-select>
          <el-input v-model="formCategory" placeholder="分类（可选）" class="w-40" />
          <el-input v-model="formTags" placeholder="标签，逗号分隔" class="flex-1" />
        </div>
        <el-input v-model="formSummary" placeholder="摘要（可选）" type="textarea" :rows="3" />
        <div class="min-h-[600px]">
          <MarkdownEditor v-model="formContent" height="600px" />
        </div>
      </div>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ editingNote ? '保存' : '发布' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Modern Professional Note Detail View -->
    <el-dialog
      v-model="showDetailDialog"
      width="1200px"
      top="5vh"
      class="modern-note-dialog"
      destroy-on-close
      :show-close="false"
    >
      <div v-if="detailNote" class="flex h-[80vh] overflow-hidden">
        <!-- Left Sidebar: Meta & Actions -->
        <aside class="w-72 bg-slate-50/50 dark:bg-white/[0.02] p-8 flex flex-col shrink-0">
          <div class="mb-8">
            <el-button circle @click="showDetailDialog = false" class="hover:bg-white dark:hover:bg-white/10 shadow-sm">
              <Plus class="w-5 h-5 rotate-45 text-[var(--text-secondary)]" />
            </el-button>
          </div>

          <!-- Author Info -->
          <div class="mb-10">
            <UserAvatar :src="detailNote.user.avatarUrl" :name="detailNote.user.name" size="lg" class="mb-4" />
            <h4 class="font-bold text-[var(--text-primary)] mb-1">{{ detailNote.user.name }}</h4>
            <p class="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">{{ detailNote.user.bio || '探索者' }}</p>
          </div>

          <div class="space-y-8 flex-1 overflow-y-auto pr-2 scrollbar-hide">
            <!-- Stats -->
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

            <!-- Tags & Category -->
            <div>
              <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-4">分类标签</p>
              <div class="flex flex-wrap gap-2">
                <span v-if="detailNote.category" class="px-2 py-1 rounded bg-accent/10 text-accent text-[10px] font-bold">
                  {{ detailNote.category }}
                </span>
                <span v-for="tag in parseTags(detailNote)" :key="tag" 
                      class="px-2 py-1 rounded bg-slate-100 dark:bg-white/5 text-[var(--text-secondary)] text-[10px] font-bold border border-[var(--border-base)]">
                  #{{ tag }}
                </span>
              </div>
            </div>

            <!-- Date -->
            <div>
              <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">发布日期</p>
              <p class="text-xs font-bold text-[var(--text-secondary)]">{{ formatDate(detailNote.createdAt) }}</p>
            </div>
          </div>

          <!-- Actions Footer -->
          <div class="pt-8 border-t border-[var(--border-base)] flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <el-button 
                class="flex-1 !rounded-xl font-bold"
                :type="detailNote.isLiked ? 'danger' : ''"
                @click="handleLike(detailNote)"
              >
                <ThumbsUp class="w-4 h-4 mr-2" :class="{ 'fill-current': detailNote.isLiked }" />
                {{ detailNote.isLiked ? '已赞' : '点赞' }}
              </el-button>
              <el-button 
                v-if="authStore.user?.role === 'ADMIN'"
                circle
                :type="detailNote.isPopular ? 'warning' : ''"
                @click="handlePromote(detailNote)"
              >
                <ThumbsUp class="w-4 h-4" :class="{ 'fill-current': detailNote.isPopular }" />
              </el-button>
            </div>
            
            <el-button 
              class="w-full !rounded-xl font-bold"
              @click="handleCopy"
              :loading="isCopying"
            >
              <component :is="isCopying ? Check : Copy" class="w-4 h-4 mr-2" />
              {{ isCopying ? '已复制' : '复制全文' }}
            </el-button>
          </div>
        </aside>

        <!-- Right: Content Area -->
        <div class="flex-1 bg-white dark:bg-[var(--bg-card)] overflow-y-auto custom-scrollbar">
          <div class="max-w-[800px] mx-auto px-12 py-16">
            <!-- Header -->
            <header class="mb-12">
              <h1 class="text-4xl font-extrabold text-[var(--text-primary)] leading-tight mb-6">
                {{ detailNote.title }}
              </h1>
              <div v-if="detailNote.summary" class="bg-slate-50 dark:bg-white/[0.02] rounded-2xl p-6 text-[var(--text-secondary)] text-sm leading-relaxed border-l-4 border-l-accent">
                <span class="block text-[10px] font-black text-accent mb-2 tracking-widest uppercase">Abstract</span>
                {{ detailNote.summary }}
              </div>
            </header>

            <!-- Content -->
            <div class="modern-markdown-content">
              <MarkdownEditor :model-value="detailNote.content" preview-only />
            </div>

            <!-- Footer -->
            <footer class="mt-24 pt-12 border-t border-[var(--border-base)] text-center">
              <div class="inline-flex items-center gap-2 text-[var(--text-muted)] text-sm font-medium">
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
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}

.modern-markdown-content :deep(.md-preview-custom) {
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif) !important;
  font-size: 15px !important;
  line-height: 1.7 !important;
  color: var(--text-primary) !important;
}

:deep(.md-preview-custom h1),
:deep(.md-preview-custom h2),
:deep(.md-preview-custom h3) {
  font-family: var(--font-sans) !important;
  margin-top: 2.5rem !important;
  margin-bottom: 1.25rem !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
}

:deep(.md-preview-custom h2) { font-size: 1.75rem !important; border-bottom: 1px solid var(--border-base) !important; padding-bottom: 0.5rem !important; }
:deep(.md-preview-custom h3) { font-size: 1.4rem !important; }

:deep(.md-preview-custom p) {
  margin-bottom: 1.25rem !important;
}

:deep(.md-preview-custom blockquote) {
  border-left: 4px solid var(--accent) !important;
  background: var(--bg-app) !important;
  padding: 1rem 1.5rem !important;
  border-radius: 0 0.75rem 0.75rem 0 !important;
  margin: 1.5rem 0 !important;
  color: var(--text-secondary) !important;
  font-style: normal !important;
}

:deep(.md-preview-custom pre) {
  background: #1e293b !important;
  border-radius: 1rem !important;
  padding: 1.5rem !important;
  margin: 1.5rem 0 !important;
}

:deep(.md-preview-custom img) {
  border-radius: 1rem;
  margin: 2rem auto !important;
}
</style>
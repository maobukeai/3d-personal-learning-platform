<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Eye, ThumbsUp, Trash2, Edit3, Tag, FolderOpen, BookOpen } from 'lucide-vue-next'
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
  isLiked: boolean
  userId: string
  _count: { likes: number }
  user: { id: string; name: string; avatarUrl: string }
  createdAt: string
  updatedAt: string
}

const notes = ref<Note[]>([])
const popularNotes = ref<Note[]>([])
const tags = ref<string[]>([])
const categories = ref<string[]>([])
const loading = ref(false)
const totalNotes = ref(0)
const currentPage = ref(1)
const pageSize = 12
const searchQuery = ref('')
const sortBy = ref('latest')
const filterVisibility = ref('')
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

const totalPages = computed(() => Math.ceil(totalNotes.value / pageSize))

const loadNotes = async () => {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      limit: pageSize,
      sort: sortBy.value
    }
    if (searchQuery.value) params.search = searchQuery.value
    if (filterVisibility.value) params.visibility = filterVisibility.value
    if (filterTag.value) params.tag = filterTag.value
    if (filterCategory.value) params.category = filterCategory.value

    const res = await api.get('/api/notes', { params })
    notes.value = res.data.notes
    totalNotes.value = res.data.pagination.total
  } catch {
    ElMessage.error('加载笔记失败')
  } finally {
    loading.value = false
  }
}

const loadPopularNotes = async () => {
  try {
    const res = await api.get('/api/notes/popular')
    popularNotes.value = res.data
  } catch {}
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
  loadPopularNotes()
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

    <div class="flex gap-6">
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

          <el-select v-model="filterVisibility" placeholder="可见性" class="w-28" clearable @change="loadNotes">
            <el-option label="全部" value="" />
            <el-option label="公开" value="PUBLIC" />
            <el-option label="私有" value="PRIVATE" />
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
          <p class="text-[var(--text-secondary)] mt-4">还没有笔记，点击右上角开始记录</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="note in notes"
            :key="note.id"
            class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-5 hover:shadow-card-hover transition-all cursor-pointer group"
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
              <el-tag :type="getVisibilityTag(note.visibility)" size="small" round>
                {{ getVisibilityLabel(note.visibility) }}
              </el-tag>
            </div>

            <h3 class="text-lg font-semibold text-[var(--text-primary)] mb-2 line-clamp-1">
              {{ note.title }}
            </h3>
            <p class="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
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

            <div v-if="note.userId === authStore.user?.id" class="flex gap-2 mt-3 pt-3 border-t border-[var(--border-base)] opacity-0 group-hover:opacity-100 transition-opacity">
              <el-button size="small" text @click.stop="openEditDialog(note)">
                <Edit3 class="w-4 h-4" />
              </el-button>
              <el-button size="small" text type="danger" @click.stop="handleDelete(note)">
                <Trash2 class="w-4 h-4" />
              </el-button>
            </div>
          </div>
        </div>

        <div v-if="totalPages > 1" class="flex justify-center mt-6">
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

      <div class="w-72 shrink-0 hidden lg:block">
        <div class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-4 sticky top-6">
          <h3 class="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <ThumbsUp class="w-4 h-4 text-[var(--accent)]" />
            热门笔记
          </h3>
          <div v-if="popularNotes.length === 0" class="text-sm text-[var(--text-muted)] py-4 text-center">
            暂无热门笔记
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="note in popularNotes"
              :key="note.id"
              class="cursor-pointer group"
              @click="viewDetail(note)"
            >
              <p class="text-sm font-medium text-[var(--text-primary)] line-clamp-1 group-hover:text-[var(--accent)] transition-colors">
                {{ note.title }}
              </p>
              <div class="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-1">
                <span>{{ note.user.name }}</span>
                <span class="flex items-center gap-1"><Eye class="w-3 h-3" /> {{ note.views }}</span>
              </div>
            </div>
          </div>
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

    <el-dialog
      v-model="showDetailDialog"
      :title="detailNote?.title || '笔记详情'"
      width="80%"
      top="5vh"
      class="custom-rounded-dialog"
      destroy-on-close
    >
      <div v-if="detailNote" class="space-y-4">
        <div class="flex items-center gap-3 pb-3 border-b border-[var(--border-base)]">
          <UserAvatar :src="detailNote.user.avatarUrl" :name="detailNote.user.name" size="lg" />
          <div>
            <p class="font-medium text-[var(--text-primary)]">{{ detailNote.user.name }}</p>
            <p class="text-xs text-[var(--text-muted)]">{{ formatDate(detailNote.createdAt) }}</p>
          </div>
          <div class="ml-auto flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <span class="flex items-center gap-1"><Eye class="w-4 h-4" /> {{ detailNote.views }}</span>
            <span
              class="flex items-center gap-1 cursor-pointer hover:text-red-500 transition-colors"
              :class="{ 'text-red-500': detailNote.isLiked }"
              @click="handleLike(detailNote)"
            >
              <ThumbsUp class="w-4 h-4" :class="{ 'fill-current': detailNote.isLiked }" />
              {{ detailNote._count.likes }}
            </span>
          </div>
        </div>

        <div v-if="detailNote.summary" class="bg-[var(--bg-app)] rounded-xl p-4 text-sm text-[var(--text-secondary)]">
          {{ detailNote.summary }}
        </div>

        <div class="min-h-[200px]">
          <MarkdownEditor :model-value="detailNote.content" preview-only />
        </div>

        <div v-if="parseTags(detailNote).length" class="flex flex-wrap gap-1 pt-3 border-t border-[var(--border-base)]">
          <el-tag v-for="tag in parseTags(detailNote)" :key="tag" size="small" round>
            <Tag class="w-3 h-3 mr-1" /> {{ tag }}
          </el-tag>
        </div>
      </div>
    </el-dialog>
  </div>
</template>
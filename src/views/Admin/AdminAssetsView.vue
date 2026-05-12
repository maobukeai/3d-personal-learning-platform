<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  Database, 
  Search, 
  RefreshCw, 
  User as UserIcon,
  Check,
  X,
  Maximize2,
  Edit,
  Trash2,
  FileText,
  Plus,
  FolderTree,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  AlertTriangle,
  TrendingUp,
  Clock,
  BarChart3
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import ModelViewer from '@/components/ModelViewer.vue'
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail'

const assets = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const filterStatus = ref('ALL')
const selectedAsset = ref<any>(null)
const isPreviewOpen = ref(false)
const isEditOpen = ref(false)
const isSaving = ref(false)
const sortBy = ref<'newest' | 'oldest' | 'size_asc' | 'size_desc'>('newest')
const viewMode = ref<'grid' | 'list'>('grid')

const selectedIds = ref<Set<string>>(new Set())
const isRejectDialogOpen = ref(false)
const rejectTargetId = ref<string | null>(null)
const rejectReason = ref('')
const isBatchRejectDialogOpen = ref(false)
const batchRejectReason = ref('')

const editForm = ref({
  id: '',
  title: '',
  description: '',
  categoryId: '',
  status: 'PENDING'
})

const assetCategories = ref<any[]>([])
const activeTab = ref<'assets' | 'categories'>('assets')
const isCategoryModalOpen = ref(false)
const categoryForm = ref({
  name: '',
  icon: '',
  order: 0
})
const currentCategory = ref<any>(null)

const stats = computed(() => {
  const total = assets.value.length
  const pending = assets.value.filter(a => a.status === 'PENDING').length
  const approved = assets.value.filter(a => a.status === 'APPROVED').length
  const rejected = assets.value.filter(a => a.status === 'REJECTED').length
  const approvalRate = total > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0
  return { total, pending, approved, rejected, approvalRate }
})

const isAllSelected = computed(() => {
  const pendingAssets = filteredAssets.value.filter(a => a.status === 'PENDING')
  return pendingAssets.length > 0 && pendingAssets.every(a => selectedIds.value.has(a.id))
})

const selectedCount = computed(() => selectedIds.value.size)

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/admin/asset-categories')
    assetCategories.value = response.data
  } catch (error) {
    ElMessage.error('获取分类失败')
  }
}

const fetchAssets = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/admin/assets', {
      params: { 
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
        search: searchQuery.value || undefined
      }
    })
    assets.value = response.data
  } catch (error) {
    ElMessage.error('获取资产列表失败')
  } finally {
    isLoading.value = false
  }
}

const sortedAssets = computed(() => {
  const list = [...filteredAssets.value]
  switch (sortBy.value) {
    case 'newest': return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'oldest': return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    case 'size_asc': return list.sort((a, b) => (a.size || 0) - (b.size || 0))
    case 'size_desc': return list.sort((a, b) => (b.size || 0) - (a.size || 0))
    default: return list
  }
})

const filteredAssets = computed(() => {
  if (!searchQuery.value) return assets.value
  const query = searchQuery.value.toLowerCase()
  return assets.value.filter(a => 
    a.title.toLowerCase().includes(query) || 
    (a.description && a.description.toLowerCase().includes(query)) ||
    a.user.name?.toLowerCase().includes(query) ||
    a.user.email.toLowerCase().includes(query)
  )
})

const toggleSelectAll = () => {
  const pendingAssets = filteredAssets.value.filter(a => a.status === 'PENDING')
  if (isAllSelected.value) {
    pendingAssets.forEach(a => selectedIds.value.delete(a.id))
  } else {
    pendingAssets.forEach(a => selectedIds.value.add(a.id))
  }
}

const toggleSelect = (id: string) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

const handleAudit = async (id: string, status: string) => {
  if (status === 'REJECTED') {
    rejectTargetId.value = id
    rejectReason.value = ''
    isRejectDialogOpen.value = true
    return
  }
  try {
    await api.put(`/api/admin/assets/${id}/status`, { status })
    ElMessage.success('已批准')
    fetchAssets()
    if (isPreviewOpen.value) isPreviewOpen.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const confirmReject = async () => {
  if (!rejectTargetId.value) return
  try {
    await api.put(`/api/admin/assets/${rejectTargetId.value}/status`, { 
      status: 'REJECTED', 
      rejectReason: rejectReason.value 
    })
    ElMessage.success('已拒绝')
    isRejectDialogOpen.value = false
    rejectReason.value = ''
    rejectTargetId.value = null
    fetchAssets()
    if (isPreviewOpen.value) isPreviewOpen.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleBatchAudit = async (status: string) => {
  if (selectedIds.value.size === 0) {
    ElMessage.warning('请先选择资产')
    return
  }
  if (status === 'REJECTED') {
    batchRejectReason.value = ''
    isBatchRejectDialogOpen.value = true
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定要批量批准 ${selectedIds.value.size} 个资产吗？`,
      '批量审核确认'
    )
    await api.put('/api/admin/assets/batch-status', { 
      ids: Array.from(selectedIds.value), 
      status 
    })
    ElMessage.success(`已批量批准 ${selectedIds.value.size} 个资产`)
    selectedIds.value.clear()
    fetchAssets()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('批量操作失败')
    }
  }
}

const confirmBatchReject = async () => {
  try {
    await api.put('/api/admin/assets/batch-status', { 
      ids: Array.from(selectedIds.value), 
      status: 'REJECTED',
      rejectReason: batchRejectReason.value
    })
    ElMessage.success(`已批量拒绝 ${selectedIds.value.size} 个资产`)
    isBatchRejectDialogOpen.value = false
    batchRejectReason.value = ''
    selectedIds.value.clear()
    fetchAssets()
  } catch (error) {
    ElMessage.error('批量操作失败')
  }
}

const openEdit = (asset: any) => {
  editForm.value = {
    id: asset.id,
    title: asset.title,
    description: asset.description || '',
    categoryId: asset.categoryId || '',
    status: asset.status
  }
  isEditOpen.value = true
}

const openCategoryModal = (category: any = null) => {
  currentCategory.value = category
  if (category) {
    categoryForm.value = {
      name: category.name,
      icon: category.icon || '',
      order: category.order || 0
    }
  } else {
    categoryForm.value = {
      name: '',
      icon: '',
      order: 0
    }
  }
  isCategoryModalOpen.value = true
}

const handleSaveCategory = async () => {
  if (!categoryForm.value.name) return
  try {
    if (currentCategory.value) {
      await api.put(`/api/admin/asset-categories/${currentCategory.value.id}`, categoryForm.value)
      ElMessage.success('分类更新成功')
    } else {
      await api.post('/api/admin/asset-categories', categoryForm.value)
      ElMessage.success('分类创建成功')
    }
    isCategoryModalOpen.value = false
    fetchCategories()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败')
  }
}

const handleDeleteCategory = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除此分类吗？如果分类下已有资产将无法删除。', '确认删除')
    await api.delete(`/api/admin/asset-categories/${id}`)
    ElMessage.success('分类已删除')
    fetchCategories()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

const handleUpdate = async () => {
  isSaving.value = true
  try {
    await api.put(`/api/admin/assets/${editForm.value.id}`, {
      title: editForm.value.title,
      description: editForm.value.description,
      categoryId: editForm.value.categoryId,
      status: editForm.value.status
    })
    ElMessage.success('资产更新成功')
    isEditOpen.value = false
    fetchAssets()
  } catch (error) {
    ElMessage.error('更新失败')
  } finally {
    isSaving.value = false
  }
}

const handleDelete = async (asset: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除资产 "${asset.title}" 吗？此操作不可撤销，且会删除对应的物理文件。`,
      '危险操作确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    await api.delete(`/api/admin/assets/${asset.id}`)
    ElMessage.success('资产已成功删除')
    fetchAssets()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const openPreview = (asset: any) => {
  selectedAsset.value = asset
  isPreviewOpen.value = true
}

const handleMetadataLoaded = async (metadata: any) => {
  if (!selectedAsset.value) return
  
  if (!selectedAsset.value.vertices || selectedAsset.value.vertices !== metadata.vertices) {
    try {
      const response = await api.patch(`/api/assets/${selectedAsset.value.id}/metadata`, metadata)
      selectedAsset.value = { ...selectedAsset.value, ...response.data }
      const index = assets.value.findIndex(a => a.id === selectedAsset.value.id)
      if (index !== -1) {
        assets.value[index] = { ...assets.value[index], ...response.data }
      }
    } catch (error) {
      console.error('Failed to save metadata:', error)
    }
  }
}

const getStatusType = (status: string) => {
  switch (status) {
    case 'PENDING': return 'warning'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'danger'
    default: return 'info'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING': return '待审核'
    case 'APPROVED': return '已通过'
    case 'REJECTED': return '未通过'
    default: return status
  }
}

const formatFileSize = (size: number | null | undefined) => {
  if (!size) return '-'
  if (size < 1) return `${(size * 1024).toFixed(0)} KB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} GB`
  return `${size.toFixed(1)} MB`
}

onMounted(() => {
  fetchAssets()
  fetchCategories()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="border-b px-8 py-4 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
          <Database class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 class="text-xl font-bold" style="color: var(--text-primary)">资产审核管理</h1>
          <div class="flex items-center gap-4 mt-1">
            <button @click="activeTab = 'assets'" 
                    class="text-xs font-bold transition-all px-2 py-1 rounded"
                    :class="activeTab === 'assets' ? 'text-accent bg-accent/10' : 'text-slate-400 hover:text-slate-600'">
              全部资产
            </button>
            <button @click="activeTab = 'categories'" 
                    class="text-xs font-bold transition-all px-2 py-1 rounded"
                    :class="activeTab === 'categories' ? 'text-accent bg-accent/10' : 'text-slate-400 hover:text-slate-600'">
              分类管理
            </button>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button v-if="activeTab === 'categories'" 
                @click="openCategoryModal()"
                class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20 flex items-center gap-2">
          <Plus class="w-4 h-4" /> 新建分类
        </button>
        <button @click="fetchAssets(); fetchCategories()" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-500">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <!-- Assets Tab -->
      <template v-if="activeTab === 'assets'">
        <!-- Statistics Panel -->
        <div class="mb-6 grid grid-cols-4 gap-4 max-w-7xl mx-auto">
          <div class="p-4 rounded-2xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-slate-400 uppercase">总资产</span>
              <BarChart3 class="w-4 h-4 text-slate-400" />
            </div>
            <p class="text-2xl font-black" style="color: var(--text-primary)">{{ stats.total }}</p>
          </div>
          <div class="p-4 rounded-2xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-amber-500 uppercase">待审核</span>
              <Clock class="w-4 h-4 text-amber-500" />
            </div>
            <p class="text-2xl font-black text-amber-500">{{ stats.pending }}</p>
          </div>
          <div class="p-4 rounded-2xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-emerald-500 uppercase">已通过</span>
              <Check class="w-4 h-4 text-emerald-500" />
            </div>
            <p class="text-2xl font-black text-emerald-500">{{ stats.approved }}</p>
          </div>
          <div class="p-4 rounded-2xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-indigo-500 uppercase">通过率</span>
              <TrendingUp class="w-4 h-4 text-indigo-500" />
            </div>
            <p class="text-2xl font-black text-indigo-500">{{ stats.approvalRate }}%</p>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="mb-6 flex items-center gap-4 max-w-7xl mx-auto">
          <div class="relative flex-1 max-w-md">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input v-model="searchQuery" 
                   type="text" 
                   placeholder="搜索资产名称、描述或作者..." 
                   class="w-full pl-10 pr-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" />
          </div>
          <el-select v-model="filterStatus" @change="fetchAssets" class="w-36">
            <el-option label="全部资产" value="ALL" />
            <el-option label="待审核" value="PENDING" />
            <el-option label="已通过" value="APPROVED" />
            <el-option label="未通过" value="REJECTED" />
          </el-select>

          <el-select v-model="sortBy" class="w-36">
            <el-option label="最新上传" value="newest" />
            <el-option label="最早上传" value="oldest" />
            <el-option label="文件最大" value="size_desc" />
            <el-option label="文件最小" value="size_asc" />
          </el-select>

          <div class="flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-white/10">
            <button @click="viewMode = 'grid'" 
                    class="p-1.5 rounded-md transition-all"
                    :class="viewMode === 'grid' ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-600'">
              <LayoutGrid class="w-4 h-4" />
            </button>
            <button @click="viewMode = 'list'" 
                    class="p-1.5 rounded-md transition-all"
                    :class="viewMode === 'list' ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-600'">
              <List class="w-4 h-4" />
            </button>
          </div>
          
          <div class="ml-auto text-xs font-bold text-slate-400">
            共 {{ filteredAssets.length }} 个资产
          </div>
        </div>

        <!-- Batch Action Bar -->
        <div v-if="selectedCount > 0" class="mb-6 max-w-7xl mx-auto">
          <div class="flex items-center gap-4 px-5 py-3 rounded-2xl border-2 border-accent/20 bg-accent/5">
            <span class="text-sm font-bold text-accent">已选择 {{ selectedCount }} 项</span>
            <div class="h-4 w-px bg-slate-200 dark:bg-white/10"></div>
            <button @click="handleBatchAudit('APPROVED')" 
                    class="px-4 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-emerald-600 transition-colors">
              <Check class="w-3.5 h-3.5" /> 批量批准
            </button>
            <button @click="handleBatchAudit('REJECTED')" 
                    class="px-4 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-rose-600 transition-colors">
              <X class="w-3.5 h-3.5" /> 批量拒绝
            </button>
            <button @click="selectedIds.clear()" 
                    class="px-4 py-1.5 border border-slate-200 dark:border-white/10 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" style="color: var(--text-secondary)">
              取消选择
            </button>
          </div>
        </div>

        <!-- Select All Bar (for pending items) -->
        <div v-if="filteredAssets.some(a => a.status === 'PENDING') && selectedCount === 0" class="mb-4 max-w-7xl mx-auto">
          <button @click="toggleSelectAll" class="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-accent transition-colors">
            <CheckSquare v-if="isAllSelected" class="w-4 h-4 text-accent" />
            <Square v-else class="w-4 h-4" />
            全选待审核资产
          </button>
        </div>

        <!-- Grid View -->
        <div v-if="viewMode === 'grid' && sortedAssets.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        <div v-for="asset in sortedAssets" :key="asset.id" 
          class="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all flex flex-col"
          :class="{ 'ring-2 ring-accent/40': selectedIds.has(asset.id) }"
        >
          <div class="aspect-video bg-slate-100 dark:bg-white/5 relative flex items-center justify-center overflow-hidden">
            <img v-if="asset.thumbnail" :src="asset.thumbnail" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            <img v-else :src="getDefaultThumbnailUrl(asset.type)" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            
            <!-- Selection Checkbox -->
            <div v-if="asset.status === 'PENDING'" class="absolute top-3 right-3 z-10">
              <button @click.stop="toggleSelect(asset.id)" class="p-1 rounded-md transition-all hover:scale-110">
                <CheckSquare v-if="selectedIds.has(asset.id)" class="w-5 h-5 text-accent drop-shadow-lg" />
                <Square v-else class="w-5 h-5 text-white/70 drop-shadow-lg hover:text-white" />
              </button>
            </div>

            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button @click="openPreview(asset)" class="p-2.5 bg-white text-slate-800 rounded-xl hover:scale-110 transition-transform shadow-lg">
                <Maximize2 class="w-5 h-5" />
              </button>
              <button @click="openEdit(asset)" class="p-2.5 bg-white text-slate-800 rounded-xl hover:scale-110 transition-transform shadow-lg">
                <Edit class="w-5 h-5" />
              </button>
              <button @click="handleDelete(asset)" class="p-2.5 bg-rose-500 text-white rounded-xl hover:scale-110 transition-transform shadow-lg">
                <Trash2 class="w-5 h-5" />
              </button>
            </div>
            <div class="absolute top-3 left-3">
              <el-tag :type="getStatusType(asset.status)" size="small" class="font-bold border-none shadow-sm" effect="dark">
                {{ getStatusLabel(asset.status) }}
              </el-tag>
            </div>
          </div>
          
          <div class="p-5 flex-1 flex flex-col gap-4">
            <div>
              <div class="flex items-center justify-between mb-1">
                <h3 class="font-bold text-slate-800 dark:text-slate-100 truncate flex-1">{{ asset.title }}</h3>
                <div class="flex items-center gap-1.5">
                  <span v-if="asset.category" class="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-slate-400 font-bold uppercase">{{ asset.category.name }}</span>
                  <span class="text-[10px] font-bold text-accent px-1.5 py-0.5 bg-accent/10 rounded">{{ asset.type }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 text-[10px] text-slate-400">
                <UserIcon class="w-3 h-3" />
                <span class="truncate">{{ asset.user.name || asset.user.email }}</span>
                <span>·</span>
                <span>{{ formatFileSize(asset.size) }}</span>
              </div>
              <!-- Reject Reason -->
              <div v-if="asset.status === 'REJECTED' && asset.rejectReason" class="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30">
                <div class="flex items-start gap-1.5">
                  <AlertTriangle class="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                  <p class="text-[10px] text-rose-600 dark:text-rose-400 leading-relaxed">{{ asset.rejectReason }}</p>
                </div>
              </div>
            </div>

            <div v-if="asset.status === 'PENDING'" class="mt-auto flex gap-2">
              <button @click="handleAudit(asset.id, 'APPROVED')" class="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1">
                <Check class="w-3.5 h-3.5" /> 批准
              </button>
              <button @click="handleAudit(asset.id, 'REJECTED')" class="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1">
                <X class="w-3.5 h-3.5" /> 拒绝
              </button>
            </div>
            <div v-else class="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span class="text-[10px] text-slate-400">审核于 {{ new Date(asset.updatedAt).toLocaleDateString() }}</span>
              <div class="flex items-center gap-2">
                <button @click="openEdit(asset)" class="text-slate-400 hover:text-accent transition-colors">
                  <Edit class="w-4 h-4" />
                </button>
                <button @click="handleDelete(asset)" class="text-slate-400 hover:text-rose-500 transition-colors">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

        <!-- List View -->
        <div v-if="viewMode === 'list' && sortedAssets.length > 0" class="max-w-7xl mx-auto space-y-2">
          <!-- List Header -->
          <div class="grid grid-cols-12 gap-4 px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <div class="col-span-1 flex items-center">
              <button @click="toggleSelectAll" v-if="filteredAssets.some(a => a.status === 'PENDING')">
                <CheckSquare v-if="isAllSelected" class="w-4 h-4 text-accent" />
                <Square v-else class="w-4 h-4" />
              </button>
            </div>
            <div class="col-span-4">资产名称</div>
            <div class="col-span-1">类型</div>
            <div class="col-span-1">大小</div>
            <div class="col-span-2">上传者</div>
            <div class="col-span-1">状态</div>
            <div class="col-span-2 text-right">操作</div>
          </div>
          
          <div v-for="asset in sortedAssets" :key="asset.id"
               class="grid grid-cols-12 gap-4 px-5 py-3 rounded-xl border items-center transition-all hover:shadow-md"
               :class="selectedIds.has(asset.id) ? 'border-accent/30 bg-accent/5' : ''"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="col-span-1 flex items-center">
              <button v-if="asset.status === 'PENDING'" @click="toggleSelect(asset.id)">
                <CheckSquare v-if="selectedIds.has(asset.id)" class="w-4 h-4 text-accent" />
                <Square v-else class="w-4 h-4 text-slate-300" />
              </button>
            </div>
            <div class="col-span-4 flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 overflow-hidden shrink-0">
                <img v-if="asset.thumbnail" :src="asset.thumbnail" class="w-full h-full object-cover" />
                <img v-else :src="getDefaultThumbnailUrl(asset.type)" class="w-full h-full object-cover" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-bold truncate" style="color: var(--text-primary)">{{ asset.title }}</p>
                <p v-if="asset.status === 'REJECTED' && asset.rejectReason" class="text-[10px] text-rose-500 truncate">原因: {{ asset.rejectReason }}</p>
              </div>
            </div>
            <div class="col-span-1">
              <span class="text-[10px] font-bold text-accent px-1.5 py-0.5 bg-accent/10 rounded">{{ asset.type }}</span>
            </div>
            <div class="col-span-1 text-xs font-medium" style="color: var(--text-secondary)">{{ formatFileSize(asset.size) }}</div>
            <div class="col-span-2 flex items-center gap-2 min-w-0">
              <UserIcon class="w-3 h-3 text-slate-400 shrink-0" />
              <span class="text-xs truncate" style="color: var(--text-secondary)">{{ asset.user.name || asset.user.email }}</span>
            </div>
            <div class="col-span-1">
              <el-tag :type="getStatusType(asset.status)" size="small" class="font-bold border-none" effect="dark">
                {{ getStatusLabel(asset.status) }}
              </el-tag>
            </div>
            <div class="col-span-2 flex items-center justify-end gap-1">
              <template v-if="asset.status === 'PENDING'">
                <button @click="handleAudit(asset.id, 'APPROVED')" class="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                  <Check class="w-3.5 h-3.5" />
                </button>
                <button @click="handleAudit(asset.id, 'REJECTED')" class="p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors">
                  <X class="w-3.5 h-3.5" />
                </button>
              </template>
              <button @click="openPreview(asset)" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors">
                <Maximize2 class="w-3.5 h-3.5" />
              </button>
              <button @click="openEdit(asset)" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors">
                <Edit class="w-3.5 h-3.5" />
              </button>
              <button @click="handleDelete(asset)" class="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="sortedAssets.length === 0 && !isLoading" class="h-64 flex flex-col items-center justify-center text-slate-400 max-w-7xl mx-auto">
          <Database class="w-12 h-12 mb-4 opacity-10" />
          <p class="text-sm font-medium">没有找到符合条件的资产</p>
        </div>
      </template>

      <!-- Categories Tab -->
      <template v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          <div v-for="cat in assetCategories" :key="cat.id" 
               class="p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-md"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                <FolderTree class="w-6 h-6" />
              </div>
              <div>
                <h4 class="font-bold text-lg" style="color: var(--text-primary)">{{ cat.name }}</h4>
                <p class="text-xs text-slate-400">资产数量: {{ cat._count?.assets || 0 }} · 排序: {{ cat.order }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button @click="openCategoryModal(cat)" class="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors">
                <Edit class="w-4 h-4" />
              </button>
              <button @click="handleDeleteCategory(cat.id)" class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <button @click="openCategoryModal()" 
                  class="p-6 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-accent hover:border-accent transition-all group">
            <Plus class="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span class="text-sm font-bold">新建资产分类</span>
          </button>
        </div>
      </template>
    </div>

    <!-- Edit Dialog -->
    <el-dialog v-model="isEditOpen" title="编辑资产详情" width="500px" class="custom-rounded-dialog">
      <div class="space-y-6">
        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">资产标题</label>
          <div class="relative">
            <FileText class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input v-model="editForm.title" type="text" 
                   class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" />
          </div>
        </div>
        
        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">详细描述</label>
          <textarea v-model="editForm.description" rows="4"
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"></textarea>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">所属分类</label>
          <el-select v-model="editForm.categoryId" class="w-full custom-select">
            <el-option v-for="cat in assetCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">审核状态</label>
          <el-select v-model="editForm.status" class="w-full custom-select">
            <el-option label="待审核" value="PENDING" />
            <el-option label="已批准" value="APPROVED" />
            <el-option label="已拒绝" value="REJECTED" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-4">
          <button @click="isEditOpen = false" class="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors">取消</button>
          <button @click="handleUpdate" :disabled="isSaving"
                  class="flex-1 py-3 bg-accent text-white rounded-2xl font-bold text-sm shadow-lg shadow-accent/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50">
            {{ isSaving ? '正在保存...' : '保存更改' }}
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- Preview Dialog -->
    <el-dialog v-model="isPreviewOpen" title="资产预览" width="80%" class="custom-rounded-dialog" destroy-on-close>
      <div class="h-[60vh] rounded-2xl overflow-hidden bg-slate-100 mb-6">
        <ModelViewer 
          :model-url="selectedAsset?.url" 
          auto-rotate 
          @metadata-loaded="handleMetadataLoaded"
        />
      </div>
      <div class="flex items-start justify-between">
        <div class="space-y-4">
          <div>
            <h2 class="text-lg font-bold">{{ selectedAsset?.title }}</h2>
            <p class="text-sm text-slate-500">{{ selectedAsset?.description || '暂无描述' }}</p>
          </div>
          
          <div class="grid grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
            <div>
              <p class="text-[10px] text-slate-400 uppercase font-bold">格式</p>
              <p class="text-xs font-bold">{{ selectedAsset?.type }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 uppercase font-bold">大小</p>
              <p class="text-xs font-bold">{{ formatFileSize(selectedAsset?.size) }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 uppercase font-bold">顶点数</p>
              <p class="text-xs font-bold font-mono">{{ selectedAsset?.vertices?.toLocaleString() || '-' }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 uppercase font-bold">面数</p>
              <p class="text-xs font-bold font-mono">{{ selectedAsset?.faces?.toLocaleString() || '-' }}</p>
            </div>
          </div>

          <!-- Reject Reason in Preview -->
          <div v-if="selectedAsset?.status === 'REJECTED' && selectedAsset?.rejectReason" class="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30">
            <div class="flex items-start gap-2">
              <AlertTriangle class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p class="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">拒绝原因</p>
                <p class="text-sm text-rose-600 dark:text-rose-400">{{ selectedAsset.rejectReason }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-if="selectedAsset?.status === 'PENDING'" class="flex gap-3 pt-2">
          <button @click="handleAudit(selectedAsset.id, 'APPROVED')" class="px-8 py-2.5 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20">批准通过</button>
          <button @click="handleAudit(selectedAsset.id, 'REJECTED')" class="px-8 py-2.5 bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-500/20">拒绝申请</button>
        </div>
      </div>
    </el-dialog>

    <!-- Reject Reason Dialog -->
    <el-dialog v-model="isRejectDialogOpen" title="拒绝审核" width="450px" class="custom-rounded-dialog">
      <div class="space-y-4">
        <div class="flex items-start gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30">
          <AlertTriangle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p class="text-sm text-rose-600 dark:text-rose-400">拒绝后系统将通知上传者，请填写拒绝原因以便用户了解问题。</p>
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">拒绝原因</label>
          <textarea v-model="rejectReason" rows="3" placeholder="请输入拒绝原因..."
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all resize-none"></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-4">
          <button @click="isRejectDialogOpen = false" class="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors">取消</button>
          <button @click="confirmReject" class="flex-1 py-3 bg-rose-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-rose-500/20 hover:scale-105 transition-all active:scale-95">
            确认拒绝
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- Batch Reject Dialog -->
    <el-dialog v-model="isBatchRejectDialogOpen" title="批量拒绝审核" width="450px" class="custom-rounded-dialog">
      <div class="space-y-4">
        <div class="flex items-start gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30">
          <AlertTriangle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p class="text-sm text-rose-600 dark:text-rose-400">即将拒绝 {{ selectedCount }} 个资产，拒绝后系统将通知所有上传者。</p>
        </div>
        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">拒绝原因（可选）</label>
          <textarea v-model="batchRejectReason" rows="3" placeholder="请输入拒绝原因..."
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all resize-none"></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-4">
          <button @click="isBatchRejectDialogOpen = false" class="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors">取消</button>
          <button @click="confirmBatchReject" class="flex-1 py-3 bg-rose-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-rose-500/20 hover:scale-105 transition-all active:scale-95">
            确认批量拒绝
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- Category Modal -->
    <el-dialog v-model="isCategoryModalOpen" :title="currentCategory ? '编辑分类' : '新建分类'" width="400px" class="custom-rounded-dialog">
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase">分类名称</label>
          <input v-model="categoryForm.name" type="text" placeholder="输入分类名称..." 
                 class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                 style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase">排序</label>
          <input v-model="categoryForm.order" type="number" 
                 class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                 style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-4">
          <button @click="isCategoryModalOpen = false" class="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm">取消</button>
          <button @click="handleSaveCategory" class="flex-1 py-3 bg-accent text-white rounded-2xl font-bold text-sm shadow-lg shadow-accent/20">保存</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

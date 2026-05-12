<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  Layers, 
  Search, 
  RefreshCw, 
  Box,
  Check,
  X,
  Maximize2,
  Edit,
  Trash2,
  FileText,
  User as UserIcon,
  Download,
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

const materials = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const filterStatus = ref('ALL')
const selectedMaterial = ref<any>(null)
const isPreviewOpen = ref(false)
const isEditOpen = ref(false)
const isSaving = ref(false)
const sortBy = ref<'newest' | 'oldest' | 'downloads'>('newest')
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
  category: '',
  tags: '',
  status: 'PENDING'
})

const stats = computed(() => {
  const total = materials.value.length
  const pending = materials.value.filter(m => m.status === 'PENDING').length
  const approved = materials.value.filter(m => m.status === 'APPROVED').length
  const rejected = materials.value.filter(m => m.status === 'REJECTED').length
  const approvalRate = total > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0
  const totalDownloads = materials.value.reduce((sum, m) => sum + (m.downloads || 0), 0)
  return { total, pending, approved, rejected, approvalRate, totalDownloads }
})

const isAllSelected = computed(() => {
  const pendingMats = filteredMaterials.value.filter(m => m.status === 'PENDING')
  return pendingMats.length > 0 && pendingMats.every(m => selectedIds.value.has(m.id))
})

const selectedCount = computed(() => selectedIds.value.size)

const fetchMaterials = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/admin/materials', {
      params: { 
        status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
      }
    })
    materials.value = response.data
  } catch (error) {
    ElMessage.error('获取材料列表失败')
  } finally {
    isLoading.value = false
  }
}

const filteredMaterials = computed(() => {
  if (!searchQuery.value) return materials.value
  const query = searchQuery.value.toLowerCase()
  return materials.value.filter(m => {
    const titleMatch = m.title?.toLowerCase().includes(query)
    const tagsMatch = m.tags?.toLowerCase().includes(query)
    const nameMatch = m.user?.name?.toLowerCase().includes(query)
    const emailMatch = m.user?.email?.toLowerCase().includes(query)
    const categoryMatch = m.category?.toLowerCase().includes(query)
    return titleMatch || tagsMatch || nameMatch || emailMatch || categoryMatch
  })
})

const sortedMaterials = computed(() => {
  const list = [...filteredMaterials.value]
  switch (sortBy.value) {
    case 'newest': return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'oldest': return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    case 'downloads': return list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    default: return list
  }
})

const toggleSelectAll = () => {
  const pendingMats = filteredMaterials.value.filter(m => m.status === 'PENDING')
  if (isAllSelected.value) {
    pendingMats.forEach(m => selectedIds.value.delete(m.id))
  } else {
    pendingMats.forEach(m => selectedIds.value.add(m.id))
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
    await api.put(`/api/admin/materials/${id}/status`, { status })
    ElMessage.success('已批准')
    fetchMaterials()
    if (isPreviewOpen.value) isPreviewOpen.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const confirmReject = async () => {
  if (!rejectTargetId.value) return
  try {
    await api.put(`/api/admin/materials/${rejectTargetId.value}/status`, { 
      status: 'REJECTED', 
      rejectReason: rejectReason.value 
    })
    ElMessage.success('已拒绝')
    isRejectDialogOpen.value = false
    rejectReason.value = ''
    rejectTargetId.value = null
    fetchMaterials()
    if (isPreviewOpen.value) isPreviewOpen.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleBatchAudit = async (status: string) => {
  if (selectedIds.value.size === 0) {
    ElMessage.warning('请先选择材料')
    return
  }
  if (status === 'REJECTED') {
    batchRejectReason.value = ''
    isBatchRejectDialogOpen.value = true
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定要批量批准 ${selectedIds.value.size} 个材料吗？`,
      '批量审核确认'
    )
    await api.put('/api/admin/materials/batch-status', { 
      ids: Array.from(selectedIds.value), 
      status 
    })
    ElMessage.success(`已批量批准 ${selectedIds.value.size} 个材料`)
    selectedIds.value.clear()
    fetchMaterials()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('批量操作失败')
    }
  }
}

const confirmBatchReject = async () => {
  try {
    await api.put('/api/admin/materials/batch-status', { 
      ids: Array.from(selectedIds.value), 
      status: 'REJECTED',
      rejectReason: batchRejectReason.value
    })
    ElMessage.success(`已批量拒绝 ${selectedIds.value.size} 个材料`)
    isBatchRejectDialogOpen.value = false
    batchRejectReason.value = ''
    selectedIds.value.clear()
    fetchMaterials()
  } catch (error) {
    ElMessage.error('批量操作失败')
  }
}

const openEdit = (material: any) => {
  editForm.value = {
    id: material.id,
    title: material.title,
    description: material.description || '',
    category: material.category || '',
    tags: material.tags || '',
    status: material.status
  }
  isEditOpen.value = true
}

const handleUpdate = async () => {
  isSaving.value = true
  try {
    await api.put(`/api/admin/materials/${editForm.value.id}`, {
      title: editForm.value.title,
      description: editForm.value.description,
      category: editForm.value.category,
      tags: editForm.value.tags,
      status: editForm.value.status
    })
    ElMessage.success('材料更新成功')
    isEditOpen.value = false
    fetchMaterials()
  } catch (error) {
    ElMessage.error('更新失败')
  } finally {
    isSaving.value = false
  }
}

const handleDelete = async (material: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除材料 "${material.title}" 吗？此操作不可撤销，且会删除对应的物理文件。`,
      '危险操作确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    await api.delete(`/api/admin/materials/${material.id}`)
    ElMessage.success('材料已成功删除')
    fetchMaterials()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleDownload = async (material: any) => {
  try {
    const response = await api.get(`/api/materials/${material.id}/file`, {
      responseType: 'blob'
    })
    const ext = material.fileUrl?.split('.').pop() || 'zip'
    const safeTitle = (material.title || 'material').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_')
    const fileName = `${safeTitle}.${ext}`
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error('下载失败')
  }
}

const openPreview = (material: any) => {
  selectedMaterial.value = material
  isPreviewOpen.value = true
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
  fetchMaterials()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="border-b px-8 py-4 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-orange-50 dark:bg-orange-500/10 rounded-xl">
          <Layers class="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 class="text-xl font-bold" style="color: var(--text-primary)">材料审核管理</h1>
          <p class="text-[10px] font-medium mt-0.5" style="color: var(--text-muted)">审核和管理用户上传的纹理、材质等材料资源</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button @click="fetchMaterials()" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-500">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <!-- Statistics Panel -->
      <div class="mb-6 grid grid-cols-5 gap-4 max-w-7xl mx-auto">
        <div class="p-4 rounded-2xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-400 uppercase">总材料</span>
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
            <span class="text-xs font-bold text-orange-500 uppercase">通过率</span>
            <TrendingUp class="w-4 h-4 text-orange-500" />
          </div>
          <p class="text-2xl font-black text-orange-500">{{ stats.approvalRate }}%</p>
        </div>
        <div class="p-4 rounded-2xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-indigo-500 uppercase">总下载</span>
            <Download class="w-4 h-4 text-indigo-500" />
          </div>
          <p class="text-2xl font-black text-indigo-500">{{ stats.totalDownloads }}</p>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="mb-6 flex items-center gap-4 max-w-7xl mx-auto">
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="searchQuery" 
                 type="text" 
                 placeholder="搜索材料名称、标签或作者..." 
                 class="w-full pl-10 pr-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all" />
        </div>
        <el-select v-model="filterStatus" @change="fetchMaterials" class="w-36">
          <el-option label="全部材料" value="ALL" />
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="未通过" value="REJECTED" />
        </el-select>

        <el-select v-model="sortBy" class="w-36">
          <el-option label="最新上传" value="newest" />
          <el-option label="最早上传" value="oldest" />
          <el-option label="下载最多" value="downloads" />
        </el-select>

        <div class="flex items-center gap-1 p-1 rounded-lg border border-slate-200 dark:border-white/10">
          <button @click="viewMode = 'grid'" 
                  class="p-1.5 rounded-md transition-all"
                  :class="viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-600'">
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button @click="viewMode = 'list'" 
                  class="p-1.5 rounded-md transition-all"
                  :class="viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-600'">
            <List class="w-4 h-4" />
          </button>
        </div>
        
        <div class="ml-auto text-xs font-bold text-slate-400">
          共 {{ filteredMaterials.length }} 个材料
        </div>
      </div>

      <!-- Batch Action Bar -->
      <div v-if="selectedCount > 0" class="mb-6 max-w-7xl mx-auto">
        <div class="flex items-center gap-4 px-5 py-3 rounded-2xl border-2 border-orange-500/20 bg-orange-500/5">
          <span class="text-sm font-bold text-orange-600">已选择 {{ selectedCount }} 项</span>
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

      <!-- Select All Bar -->
      <div v-if="filteredMaterials.some(m => m.status === 'PENDING') && selectedCount === 0" class="mb-4 max-w-7xl mx-auto">
        <button @click="toggleSelectAll" class="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-orange-500 transition-colors">
          <CheckSquare v-if="isAllSelected" class="w-4 h-4 text-orange-500" />
          <Square v-else class="w-4 h-4" />
          全选待审核材料
        </button>
      </div>

      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
        <div class="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm font-bold text-slate-400">加载材料列表...</p>
      </div>

      <template v-else>
        <!-- Grid View -->
        <div v-if="viewMode === 'grid' && sortedMaterials.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          <div v-for="mat in sortedMaterials" :key="mat.id" 
            class="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all flex flex-col"
            :class="{ 'ring-2 ring-orange-500/40': selectedIds.has(mat.id) }"
          >
            <div class="aspect-square bg-slate-100 dark:bg-white/5 relative flex items-center justify-center overflow-hidden">
              <img v-if="mat.previewUrl" :src="mat.previewUrl" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <Box v-else class="w-12 h-12 text-slate-300 dark:text-slate-700 group-hover:scale-110 transition-transform duration-500" />
              
              <!-- Selection Checkbox -->
              <div v-if="mat.status === 'PENDING'" class="absolute top-3 right-3 z-10">
                <button @click.stop="toggleSelect(mat.id)" class="p-1 rounded-md transition-all hover:scale-110">
                  <CheckSquare v-if="selectedIds.has(mat.id)" class="w-5 h-5 text-orange-500 drop-shadow-lg" />
                  <Square v-else class="w-5 h-5 text-white/70 drop-shadow-lg hover:text-white" />
                </button>
              </div>

              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button @click="openPreview(mat)" class="p-2.5 bg-white text-slate-800 rounded-xl hover:scale-110 transition-transform shadow-lg">
                  <Maximize2 class="w-5 h-5" />
                </button>
                <button @click="openEdit(mat)" class="p-2.5 bg-white text-slate-800 rounded-xl hover:scale-110 transition-transform shadow-lg">
                  <Edit class="w-5 h-5" />
                </button>
                <button @click="handleDelete(mat)" class="p-2.5 bg-rose-500 text-white rounded-xl hover:scale-110 transition-transform shadow-lg">
                  <Trash2 class="w-5 h-5" />
                </button>
              </div>
              <div class="absolute top-3 left-3 flex flex-col gap-2">
                <el-tag :type="getStatusType(mat.status)" size="small" class="font-bold border-none shadow-sm" effect="dark">
                  {{ getStatusLabel(mat.status) }}
                </el-tag>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/50 text-white backdrop-blur shadow-sm self-start">
                  {{ mat.resolution || '未知' }}
                </span>
              </div>
            </div>
            
            <div class="p-5 flex-1 flex flex-col gap-4">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <h3 class="font-bold text-slate-800 dark:text-slate-100 truncate flex-1">{{ mat.title }}</h3>
                  <span v-if="mat.isProcedural" class="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded font-bold">程序化</span>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-[10px] text-slate-400">
                    <UserIcon class="w-3 h-3" />
                    <span class="truncate">{{ mat.user.name || mat.user.email }}</span>
                  </div>
                  <span class="text-[10px] font-bold text-orange-500 px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/20 rounded">{{ mat.category }}</span>
                </div>
                <!-- Reject Reason -->
                <div v-if="mat.status === 'REJECTED' && mat.rejectReason" class="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30">
                  <div class="flex items-start gap-1.5">
                    <AlertTriangle class="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                    <p class="text-[10px] text-rose-600 dark:text-rose-400 leading-relaxed">{{ mat.rejectReason }}</p>
                  </div>
                </div>
              </div>

              <div v-if="mat.status === 'PENDING'" class="mt-auto flex gap-2">
                <button @click="handleAudit(mat.id, 'APPROVED')" class="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1">
                  <Check class="w-3.5 h-3.5" /> 批准
                </button>
                <button @click="handleAudit(mat.id, 'REJECTED')" class="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1">
                  <X class="w-3.5 h-3.5" /> 拒绝
                </button>
              </div>
              <div v-else class="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span class="text-[10px] text-slate-400">下载量: {{ mat.downloads || 0 }} · {{ formatFileSize(mat.fileSize) }}</span>
                <div class="flex items-center gap-2">
                  <button @click="openEdit(mat)" class="text-slate-400 hover:text-orange-500 transition-colors">
                    <Edit class="w-4 h-4" />
                  </button>
                  <button @click="handleDelete(mat)" class="text-slate-400 hover:text-rose-500 transition-colors">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- List View -->
        <div v-if="viewMode === 'list' && sortedMaterials.length > 0" class="max-w-7xl mx-auto space-y-2">
          <div class="grid grid-cols-12 gap-4 px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <div class="col-span-1 flex items-center">
              <button @click="toggleSelectAll" v-if="filteredMaterials.some(m => m.status === 'PENDING')">
                <CheckSquare v-if="isAllSelected" class="w-4 h-4 text-orange-500" />
                <Square v-else class="w-4 h-4" />
              </button>
            </div>
            <div class="col-span-3">材料名称</div>
            <div class="col-span-1">分类</div>
            <div class="col-span-1">分辨率</div>
            <div class="col-span-2">上传者</div>
            <div class="col-span-1">下载量</div>
            <div class="col-span-1">状态</div>
            <div class="col-span-2 text-right">操作</div>
          </div>
          
          <div v-for="mat in sortedMaterials" :key="mat.id"
               class="grid grid-cols-12 gap-4 px-5 py-3 rounded-xl border items-center transition-all hover:shadow-md"
               :class="selectedIds.has(mat.id) ? 'border-orange-500/30 bg-orange-500/5' : ''"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="col-span-1 flex items-center">
              <button v-if="mat.status === 'PENDING'" @click="toggleSelect(mat.id)">
                <CheckSquare v-if="selectedIds.has(mat.id)" class="w-4 h-4 text-orange-500" />
                <Square v-else class="w-4 h-4 text-slate-300" />
              </button>
            </div>
            <div class="col-span-3 flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/5 overflow-hidden shrink-0">
                <img v-if="mat.previewUrl" :src="mat.previewUrl" class="w-full h-full object-cover" />
                <Box v-else class="w-5 h-5 text-slate-300 m-2.5" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-bold truncate" style="color: var(--text-primary)">{{ mat.title }}</p>
                <p v-if="mat.status === 'REJECTED' && mat.rejectReason" class="text-[10px] text-rose-500 truncate">原因: {{ mat.rejectReason }}</p>
              </div>
            </div>
            <div class="col-span-1">
              <span class="text-[10px] font-bold text-orange-500 px-1.5 py-0.5 bg-orange-50 dark:bg-orange-900/20 rounded">{{ mat.category }}</span>
            </div>
            <div class="col-span-1 text-xs font-medium" style="color: var(--text-secondary)">{{ mat.resolution || '-' }}</div>
            <div class="col-span-2 flex items-center gap-2 min-w-0">
              <UserIcon class="w-3 h-3 text-slate-400 shrink-0" />
              <span class="text-xs truncate" style="color: var(--text-secondary)">{{ mat.user.name || mat.user.email }}</span>
            </div>
            <div class="col-span-1 text-xs font-medium" style="color: var(--text-secondary)">{{ mat.downloads || 0 }}</div>
            <div class="col-span-1">
              <el-tag :type="getStatusType(mat.status)" size="small" class="font-bold border-none" effect="dark">
                {{ getStatusLabel(mat.status) }}
              </el-tag>
            </div>
            <div class="col-span-2 flex items-center justify-end gap-1">
              <template v-if="mat.status === 'PENDING'">
                <button @click="handleAudit(mat.id, 'APPROVED')" class="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                  <Check class="w-3.5 h-3.5" />
                </button>
                <button @click="handleAudit(mat.id, 'REJECTED')" class="p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors">
                  <X class="w-3.5 h-3.5" />
                </button>
              </template>
              <button @click="openPreview(mat)" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors">
                <Maximize2 class="w-3.5 h-3.5" />
              </button>
              <button @click="openEdit(mat)" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors">
                <Edit class="w-3.5 h-3.5" />
              </button>
              <button @click="handleDelete(mat)" class="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="sortedMaterials.length === 0" class="h-64 flex flex-col items-center justify-center text-slate-400 max-w-7xl mx-auto">
          <Layers class="w-12 h-12 mb-4 opacity-10" />
          <p class="text-sm font-medium">没有找到符合条件的材料</p>
        </div>
      </template>
    </div>

    <!-- Edit Dialog -->
    <el-dialog v-model="isEditOpen" title="编辑材料详情" width="500px" class="custom-rounded-dialog">
      <div class="space-y-6">
        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">材料标题</label>
          <div class="relative">
            <FileText class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input v-model="editForm.title" type="text" 
                   class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all" />
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">分类</label>
          <input v-model="editForm.category" type="text" 
                 class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all" />
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">描述</label>
          <textarea v-model="editForm.description" rows="3" 
                 class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all resize-none"></textarea>
        </div>
        
        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">标签</label>
          <input v-model="editForm.tags" type="text" 
                 class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all" />
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
                  class="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50">
            {{ isSaving ? '正在保存...' : '保存更改' }}
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- Preview Dialog -->
    <el-dialog v-model="isPreviewOpen" title="材料预览" width="60%" class="custom-rounded-dialog" destroy-on-close>
      <div class="flex flex-col items-center gap-6">
        <div class="w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center">
          <img v-if="selectedMaterial?.previewUrl" :src="selectedMaterial.previewUrl" class="w-full h-full object-contain" />
          <Box v-else class="w-16 h-16 text-slate-300" />
        </div>
        <div class="w-full flex items-start justify-between">
          <div class="space-y-4 flex-1">
            <div>
              <h2 class="text-lg font-bold">{{ selectedMaterial?.title }}</h2>
              <p class="text-sm text-slate-500">标签: {{ selectedMaterial?.tags || '暂无标签' }}</p>
            </div>
            
            <div class="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
              <div>
                <p class="text-[10px] text-slate-400 uppercase font-bold">分类</p>
                <p class="text-xs font-bold">{{ selectedMaterial?.category }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 uppercase font-bold">分辨率</p>
                <p class="text-xs font-bold">{{ selectedMaterial?.resolution || '未知' }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 uppercase font-bold">类型</p>
                <p class="text-xs font-bold font-mono">{{ selectedMaterial?.isProcedural ? '程序化' : '静态纹理' }}</p>
              </div>
            </div>

            <!-- Reject Reason in Preview -->
            <div v-if="selectedMaterial?.status === 'REJECTED' && selectedMaterial?.rejectReason" class="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30">
              <div class="flex items-start gap-2">
                <AlertTriangle class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p class="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">拒绝原因</p>
                  <p class="text-sm text-rose-600 dark:text-rose-400">{{ selectedMaterial.rejectReason }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 pl-8 min-w-[200px]">
            <button @click="handleDownload(selectedMaterial)" class="w-full py-2.5 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
              <Download class="w-4 h-4" /> 下载源文件
            </button>
            <div v-if="selectedMaterial?.status === 'PENDING'" class="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-100">
              <button @click="handleAudit(selectedMaterial.id, 'APPROVED')" class="w-full py-2.5 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20">批准通过</button>
              <button @click="handleAudit(selectedMaterial.id, 'REJECTED')" class="w-full py-2.5 bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-500/20">拒绝申请</button>
            </div>
          </div>
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
          <p class="text-sm text-rose-600 dark:text-rose-400">即将拒绝 {{ selectedCount }} 个材料，拒绝后系统将通知所有上传者。</p>
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
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

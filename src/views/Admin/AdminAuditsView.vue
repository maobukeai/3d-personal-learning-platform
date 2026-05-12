<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  Eye,
  Video,
  Box,
  Layers,
  RefreshCw,
  Trash2,
  Edit
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const activeTab = ref('assets')
const items = ref<any[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const statusFilter = ref('PENDING')

const isEditOpen = ref(false)
const isSaving = ref(false)

const editForm = ref({
  id: '',
  title: '',
  description: '',
  categoryId: '',
  category: '',
  tags: '',
  status: 'PENDING'
})

const assetCategories = ref<any[]>([])

const fetchItems = async () => {
  try {
    isLoading.value = true
    let endpoint = `/api/admin/${activeTab.value}`
    const params: any = {}
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    const { data } = await api.get(endpoint, { params })
    items.value = data
  } catch (error) {
    console.error(`Fetch ${activeTab.value} error:`, error)
    ElMessage.error('获取审核列表失败')
  } finally {
    isLoading.value = false
  }
}

const fetchCategories = async () => {
  try {
    const { data } = await api.get('/api/admin/asset-categories')
    assetCategories.value = data
  } catch (error) {
    console.error('Fetch categories error:', error)
  }
}

const filteredItems = computed(() => {
  if (!searchQuery.value) return items.value
  const query = searchQuery.value.toLowerCase()
  return items.value.filter((item: any) => {
    const titleMatch = item.title?.toLowerCase().includes(query)
    const userMatch = item.user?.name?.toLowerCase().includes(query) || item.user?.email?.toLowerCase().includes(query)
    const tagsMatch = item.tags?.toLowerCase().includes(query)
    const categoryMatch = item.category?.toLowerCase().includes(query)
    return titleMatch || userMatch || tagsMatch || categoryMatch
  })
})

const updateStatus = async (item: any, status: string) => {
  try {
    await api.put(`/api/admin/${activeTab.value}/${item.id}/status`, { status })
    ElMessage.success(status === 'APPROVED' ? '已批准' : '已拒绝')
    fetchItems()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败')
  }
}

const openEdit = (item: any) => {
  editForm.value = {
    id: item.id,
    title: item.title,
    description: item.description || '',
    categoryId: item.categoryId || '',
    category: item.category || '',
    tags: item.tags || '',
    status: item.status
  }
  isEditOpen.value = true
}

const handleUpdate = async () => {
  isSaving.value = true
  try {
    if (activeTab.value === 'assets') {
      await api.put(`/api/admin/assets/${editForm.value.id}`, {
        title: editForm.value.title,
        description: editForm.value.description,
        categoryId: editForm.value.categoryId,
        status: editForm.value.status
      })
    } else if (activeTab.value === 'materials') {
      await api.put(`/api/admin/materials/${editForm.value.id}`, {
        title: editForm.value.title,
        category: editForm.value.category,
        tags: editForm.value.tags,
        status: editForm.value.status
      })
    }
    ElMessage.success('更新成功')
    isEditOpen.value = false
    fetchItems()
  } catch (error) {
    ElMessage.error('更新失败')
  } finally {
    isSaving.value = false
  }
}

const handleDelete = async (item: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除 "${item.title}" 吗？此操作不可撤销。`,
      '危险操作确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    if (activeTab.value === 'showcases') {
      await api.delete(`/api/admin/showcases/${item.id}`)
    } else {
      await api.delete(`/api/admin/${activeTab.value}/${item.id}`)
    }
    ElMessage.success('删除成功')
    fetchItems()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString()
}

const switchTab = (tab: string) => {
  activeTab.value = tab
  searchQuery.value = ''
  fetchItems()
  if (tab === 'assets') {
    fetchCategories()
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

const getStatusType = (status: string) => {
  switch (status) {
    case 'PENDING': return 'warning'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'danger'
    default: return 'info'
  }
}

onMounted(() => {
  fetchItems()
  fetchCategories()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">内容审核</h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">审核平台用户提交的所有内容</p>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="flex p-1 rounded-xl transition-colors duration-300" style="background-color: var(--bg-app)">
          <button @click="switchTab('assets')" 
                  class="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  :class="activeTab === 'assets' ? 'bg-white dark:bg-slate-800 shadow-sm text-accent' : 'text-slate-500'">
            3D资产
          </button>
          <button @click="switchTab('materials')" 
                  class="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  :class="activeTab === 'materials' ? 'bg-white dark:bg-slate-800 shadow-sm text-accent' : 'text-slate-500'">
            材质材料
          </button>
          <button @click="switchTab('showcases')" 
                  class="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  :class="activeTab === 'showcases' ? 'bg-white dark:bg-slate-800 shadow-sm text-accent' : 'text-slate-500'">
            作品展示
          </button>
        </div>

        <button @click="fetchItems" class="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="p-8 border-b shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div class="relative w-full md:w-96">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input v-model="searchQuery" 
                 type="text" 
                 placeholder="搜索内容标题、作者或标签..." 
                 class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:ring-2 focus:ring-accent/20 outline-none"
                 style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <Filter class="w-4 h-4 text-slate-400" />
            <select v-model="statusFilter" @change="fetchItems" 
                    class="px-4 py-2.5 rounded-xl border outline-none font-bold text-xs"
                    style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)">
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已批准</option>
              <option value="REJECTED">已拒绝</option>
              <option value="">全部状态</option>
            </select>
          </div>
          <div class="text-xs font-bold text-slate-400">
            共 {{ filteredItems.length }} 项
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
        <div class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm font-bold text-slate-400">加载审核队列...</p>
      </div>

      <div v-else-if="filteredItems.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6">
          <Clock class="w-10 h-10 text-slate-300" />
        </div>
        <h3 class="text-xl font-bold mb-2" style="color: var(--text-primary)">当前无匹配内容</h3>
        <p class="text-sm text-slate-400 max-w-sm">
          暂无{{ statusFilter === 'PENDING' ? '待审核' : '' }}的{{ activeTab === 'assets' ? '资产' : activeTab === 'materials' ? '材料' : '作品' }}。
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div v-for="item in filteredItems" :key="item.id" 
             class="group rounded-3xl border overflow-hidden transition-all hover:shadow-xl"
             style="background-color: var(--bg-card); border-color: var(--border-base)">
          <!-- Preview -->
          <div class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5">
            <img v-if="item.thumbnail || item.previewUrl || item.thumbnailUrl" 
                 :src="item.thumbnail || item.previewUrl || item.thumbnailUrl" 
                 class="w-full h-full object-cover transition-transform group-hover:scale-110" />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Box v-if="activeTab === 'assets'" class="w-12 h-12 text-slate-300" />
              <Layers v-else-if="activeTab === 'materials'" class="w-12 h-12 text-slate-300" />
              <Video v-else class="w-12 h-12 text-slate-300" />
            </div>

            <!-- Overlay Actions -->
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <a v-if="item.url || item.fileUrl" :href="item.url || item.fileUrl" target="_blank" 
                 class="p-3 rounded-full bg-white text-slate-900 hover:scale-110 transition-transform shadow-xl">
                <Eye class="w-5 h-5" />
              </a>
              <button @click="openEdit(item)" class="p-3 rounded-full bg-white text-slate-900 hover:scale-110 transition-transform shadow-xl">
                <Edit class="w-5 h-5" />
              </button>
              <button @click="handleDelete(item)" class="p-3 rounded-full bg-rose-500 text-white hover:scale-110 transition-transform shadow-xl">
                <Trash2 class="w-5 h-5" />
              </button>
            </div>
            
            <div class="absolute top-4 left-4 flex items-center gap-2">
              <span class="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/90 backdrop-blur-md text-slate-900 shadow-sm">
                {{ activeTab === 'assets' ? item.type : (activeTab === 'materials' ? item.category : (item.isVideo ? '视频' : '图文')) }}
              </span>
              <el-tag :type="getStatusType(item.status)" size="small" class="font-bold border-none shadow-sm" effect="dark">
                {{ getStatusLabel(item.status) }}
              </el-tag>
            </div>
          </div>

          <!-- Info -->
          <div class="p-6 space-y-4">
            <div>
              <h3 class="font-bold text-lg mb-1 truncate" style="color: var(--text-primary)">{{ item.title }}</h3>
              <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full bg-slate-200 overflow-hidden">
                  <img v-if="item.user?.avatarUrl" :src="item.user.avatarUrl" class="w-full h-full object-cover" />
                </div>
                <span class="text-xs font-medium" style="color: var(--text-secondary)">{{ item.user?.name || item.user?.email }}</span>
              </div>
            </div>

            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 space-y-2">
              <div class="flex items-center justify-between text-[10px] font-bold">
                <span style="color: var(--text-muted)">提交时间</span>
                <span style="color: var(--text-primary)">{{ formatDate(item.createdAt) }}</span>
              </div>
              <div v-if="activeTab === 'assets' && item.size" class="flex items-center justify-between text-[10px] font-bold">
                <span style="color: var(--text-muted)">大小</span>
                <span style="color: var(--text-primary)">{{ item.size }} MB</span>
              </div>
              <div v-if="activeTab === 'materials' && item.resolution" class="flex items-center justify-between text-[10px] font-bold">
                <span style="color: var(--text-muted)">分辨率</span>
                <span style="color: var(--text-primary)">{{ item.resolution }}</span>
              </div>
              <div v-if="activeTab === 'showcases' && item.views" class="flex items-center justify-between text-[10px] font-bold">
                <span style="color: var(--text-muted)">浏览量</span>
                <span style="color: var(--text-primary)">{{ item.views }}</span>
              </div>
            </div>

            <div class="flex items-center gap-3 pt-2">
              <button @click="updateStatus(item, 'APPROVED')" 
                      class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all">
                <CheckCircle2 class="w-4 h-4" />
                通过
              </button>
              <button @click="updateStatus(item, 'REJECTED')" 
                      class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-all">
                <XCircle class="w-4 h-4" />
                拒绝
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Dialog -->
    <el-dialog v-model="isEditOpen" title="编辑内容详情" width="500px" class="custom-rounded-dialog">
      <div class="space-y-6">
        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">标题</label>
          <input v-model="editForm.title" type="text" 
                 class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" />
        </div>

        <template v-if="activeTab === 'assets'">
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">详细描述</label>
            <textarea v-model="editForm.description" rows="3"
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"></textarea>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">所属分类</label>
            <el-select v-model="editForm.categoryId" class="w-full">
              <el-option v-for="cat in assetCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
            </el-select>
          </div>
        </template>

        <template v-if="activeTab === 'materials'">
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">分类</label>
            <input v-model="editForm.category" type="text" 
                   class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">标签</label>
            <input v-model="editForm.tags" type="text" 
                   class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" />
          </div>
        </template>

        <div class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">审核状态</label>
          <el-select v-model="editForm.status" class="w-full">
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

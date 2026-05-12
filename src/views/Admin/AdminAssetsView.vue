<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  Database, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Clock,
  User as UserIcon,
  Box,
  Download,
  Check,
  X,
  Maximize2
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import ModelViewer from '@/components/ModelViewer.vue'

const assets = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const filterStatus = ref('PENDING')
const selectedAsset = ref<any>(null)
const isPreviewOpen = ref(false)

const fetchAssets = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/admin/assets', {
      params: { status: filterStatus.value === 'ALL' ? undefined : filterStatus.value }
    })
    assets.value = response.data
  } catch (error) {
    ElMessage.error('获取资产列表失败')
  } finally {
    isLoading.value = false
  }
}

const handleAudit = async (id: string, status: string) => {
  try {
    await api.put(`/api/admin/assets/${id}/status`, { status })
    ElMessage.success(status === 'APPROVED' ? '已批准' : '已拒绝')
    fetchAssets()
    if (isPreviewOpen.value) isPreviewOpen.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const openPreview = (asset: any) => {
  selectedAsset.value = asset
  isPreviewOpen.value = true
}

const handleMetadataLoaded = async (metadata: any) => {
  if (!selectedAsset.value) return
  
  // If the asset doesn't have metadata yet, update it
  if (!selectedAsset.value.vertices || selectedAsset.value.vertices !== metadata.vertices) {
    try {
      const response = await api.patch(`/api/assets/${selectedAsset.value.id}/metadata`, metadata)
      // Update local asset data
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

onMounted(fetchAssets)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-indigo-50 rounded-lg">
          <Database class="w-5 h-5 text-indigo-600" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">资产审核管理</h1>
      </div>
      <div class="flex items-center gap-3">
        <button @click="fetchAssets" class="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="p-6 border-b transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
      <div class="flex items-center gap-4 max-w-7xl mx-auto">
        <el-select v-model="filterStatus" @change="fetchAssets" class="w-40">
          <el-option label="全部资产" value="ALL" />
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="未通过" value="REJECTED" />
        </el-select>
      </div>
    </div>

    <!-- Grid -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div v-if="assets.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        <div v-for="asset in assets" :key="asset.id" 
          class="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all flex flex-col"
        >
          <div class="aspect-video bg-slate-100 dark:bg-white/5 relative flex items-center justify-center overflow-hidden">
            <img v-if="asset.thumbnail" :src="asset.thumbnail" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            <Box v-else class="w-12 h-12 text-slate-300 dark:text-slate-700 group-hover:scale-110 transition-transform duration-500" />
            
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button @click="openPreview(asset)" class="p-2.5 bg-white text-slate-800 rounded-xl hover:scale-110 transition-transform shadow-lg">
                <Maximize2 class="w-5 h-5" />
              </button>
              <a :href="asset.url" download class="p-2.5 bg-white text-slate-800 rounded-xl hover:scale-110 transition-transform shadow-lg">
                <Download class="w-5 h-5" />
              </a>
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
                <span class="text-[10px] font-bold text-accent px-1.5 py-0.5 bg-accent/10 rounded">{{ asset.type }}</span>
              </div>
              <div class="flex items-center gap-2 text-[10px] text-slate-400">
                <UserIcon class="w-3 h-3" />
                <span class="truncate">{{ asset.user.name || asset.user.email }}</span>
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
            <div v-else class="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span>审核于 {{ new Date(asset.updatedAt).toLocaleDateString() }}</span>
              <button @click="openPreview(asset)" class="text-accent hover:underline">查看详情</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="h-64 flex flex-col items-center justify-center text-slate-400">
        <Database class="w-12 h-12 mb-4 opacity-10" />
        <p class="text-sm font-medium">没有找到符合条件的资产</p>
      </div>
    </div>

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
              <p class="text-xs font-bold">{{ selectedAsset?.size || '未知' }} MB</p>
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
        </div>
        <div v-if="selectedAsset?.status === 'PENDING'" class="flex gap-3 pt-2">
          <button @click="handleAudit(selectedAsset.id, 'APPROVED')" class="px-8 py-2.5 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20">批准通过</button>
          <button @click="handleAudit(selectedAsset.id, 'REJECTED')" class="px-8 py-2.5 bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-500/20">拒绝申请</button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

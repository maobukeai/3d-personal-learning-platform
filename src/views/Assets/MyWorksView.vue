<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Heart, 
  MessageCircle, 
  Globe, 
  Lock,
  Edit3,
  Trash2,
  ExternalLink,
  X,
  Box,
  Download
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'
import ModelViewer from '@/components/ModelViewer.vue'

const searchQuery = ref('')
const activeTab = ref('全部作品')
const assets = ref<any[]>([])
const isLoading = ref(false)
const selectedAsset = ref<any>(null)
const isPreviewOpen = ref(false)

const tabs = ['全部作品', '待审核', '已发布', '未通过']

const fetchMyAssets = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/assets/my')
    assets.value = response.data
  } catch (error) {
    ElMessage.error('获取作品失败')
  } finally {
    isLoading.value = false
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING': return '待审核'
    case 'APPROVED': return '已发布'
    case 'REJECTED': return '未通过'
    default: return status
  }
}

const filteredWorks = computed(() => {
  return assets.value.filter(work => {
    const matchesSearch = work.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesTab = activeTab.value === '全部作品' || getStatusLabel(work.status) === activeTab.value
    return matchesSearch && matchesTab
  })
})

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

const handleDeleteWork = (work: any) => {
  ElMessageBox.confirm(
    `确定要删除作品 "${work.title}" 吗？此操作无法撤销。`,
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await api.delete(`/api/assets/${work.id}`)
      assets.value = assets.value.filter(w => w.id !== work.id)
      ElMessage.success('作品已删除')
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

onMounted(fetchMyAssets)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b px-8 flex items-center justify-between shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">我的作品</h1>
        <span class="bg-accent-subtle text-accent text-[10px] font-bold px-2 py-0.5 rounded-full">共 {{ assets.length }} 个作品</span>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索我的作品..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
      </div>
    </div>

    <!-- Tabs Area -->
    <div class="border-b px-8 py-2 shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-6">
        <button 
          v-for="tab in tabs" 
          :key="tab"
          @click="activeTab = tab"
          class="relative py-2 text-sm font-medium transition-all"
          :class="activeTab === tab ? 'text-accent' : 'hover:text-accent'"
          :style="activeTab !== tab ? 'color: var(--text-secondary)' : ''"
        >
          {{ tab }}
          <div v-if="activeTab === tab" class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"></div>
        </button>
      </div>
    </div>

    <!-- Works Grid Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto">
        <div v-if="filteredWorks.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div v-for="work in filteredWorks" :key="work.id" 
               class="group rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col relative"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <!-- Thumbnail -->
            <div class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <img v-if="work.thumbnail" :src="work.thumbnail" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <Box v-else class="w-12 h-12 text-slate-300 dark:text-slate-700 group-hover:scale-110 transition-transform duration-500" />
              
              <!-- Status Tag -->
              <div class="absolute top-3 left-3">
                <div class="backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-white shadow-sm"
                     :class="work.status === 'APPROVED' ? 'bg-emerald-500/80' : work.status === 'PENDING' ? 'bg-amber-500/80' : 'bg-rose-500/80'">
                  {{ getStatusLabel(work.status) }}
                </div>
              </div>

              <!-- Action Overlay -->
              <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button @click="openPreview(work)" class="p-2.5 rounded-xl hover:bg-accent-subtle hover:text-accent transition-all shadow-lg"
                        style="background-color: var(--bg-card); color: var(--text-primary)">
                  <Eye class="w-5 h-5" />
                </button>
                <button @click="handleDeleteWork(work)" class="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-all shadow-lg"
                        style="background-color: var(--bg-card)">
                  <Trash2 class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Info Panel -->
            <div class="p-5 flex-1 flex flex-col">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-sm font-bold truncate pr-4" style="color: var(--text-primary)">{{ work.title }}</h3>
                <span class="text-[10px] font-bold text-accent px-1.5 py-0.5 bg-accent/10 rounded">{{ work.type }}</span>
              </div>
              <p class="text-[10px] text-slate-400">上传于 {{ new Date(work.createdAt).toLocaleDateString() }}</p>
              
              <div class="mt-4 pt-4 border-t flex items-center justify-between" style="border-color: var(--border-base)">
                <a :href="work.url" download class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1">
                   <Download class="w-3 h-3" /> 下载源文件
                </a>
                <span v-if="work.status === 'REJECTED'" class="text-[10px] text-rose-500 cursor-help" title="资产未通过审核，请检查内容后重新上传">审核未通过</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="h-64 flex flex-col items-center justify-center rounded-3xl border border-dashed" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-secondary)">
          <Box class="w-12 h-12 mb-4 opacity-10" />
          <p class="text-sm">暂无相关作品</p>
        </div>
      </div>
    </div>

    <!-- Preview Dialog -->
    <el-dialog v-model="isPreviewOpen" title="我的作品预览" width="80%" destroy-on-close>
      <div class="h-[60vh] rounded-2xl overflow-hidden bg-slate-100 mb-6">
        <ModelViewer 
          :model-url="selectedAsset?.url" 
          auto-rotate 
          @metadata-loaded="handleMetadataLoaded"
        />
      </div>
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold">{{ selectedAsset?.title }}</h2>
          <p class="text-sm text-slate-500">{{ selectedAsset?.description || '暂无描述' }}</p>
        </div>
        <el-tag :type="selectedAsset?.status === 'APPROVED' ? 'success' : 'warning'">
          {{ getStatusLabel(selectedAsset?.status) }}
        </el-tag>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
</style>

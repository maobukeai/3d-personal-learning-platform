<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Search, ChevronRight, Box, Maximize2, X, Download, RotateCw, UploadCloud } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import ModelViewer from '@/components/ModelViewer.vue'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail'

const authStore = useAuthStore()
const searchQuery = ref('')
const activeCategory = ref('全部')

watch(searchQuery, () => {
  pagination.value.page = 1
  fetchAssets()
})

watch(activeCategory, () => {
  pagination.value.page = 1
  fetchAssets()
})
const selectedAsset = ref<any>(null)
const isPreviewOpen = ref(false)
const isAutoRotating = ref(true)
const assets = ref<any[]>([])
const isLoading = ref(false)

const pagination = ref({
  total: 0,
  page: 1,
  limit: 12,
  totalPages: 0
})

// Upload related
const isUploadDialogOpen = ref(false)
const uploadForm = ref({
  title: '',
  description: '',
  categoryId: '',
  file: null as File | null,
  thumbnail: null as File | null
})
const isUploading = ref(false)
const assetCategories = ref<any[]>([])

const categories = computed(() => {
  const list = [
    { id: 'all', name: '全部', count: pagination.value.total }
  ]
  assetCategories.value.forEach(cat => {
    list.push({ 
      id: cat.id, 
      name: cat.name, 
      count: cat._count?.assets || 0 
    })
  })
  return list
})

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/assets/categories')
    assetCategories.value = response.data
  } catch (error) {
    console.error('Failed to fetch categories')
  }
}

const fetchAssets = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/assets/public', {
      params: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        search: searchQuery.value,
        categoryId: activeCategory.value === '全部' ? 'all' : (assetCategories.value.find(c => c.name === activeCategory.value)?.id || 'all')
      }
    })
    assets.value = response.data.assets
    pagination.value = response.data.pagination
  } catch (error) {
    ElMessage.error('获取资源失败')
  } finally {
    isLoading.value = false
  }
}

const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchAssets()
}

const filteredAssets = computed(() => {
  // Since we're doing backend search and pagination, we might not need as much client-side filtering
  // but keeping it for category filtering if backend doesn't support it yet
  return assets.value.filter(asset => {
    const matchesCategory = activeCategory.value === '全部' || asset.type === activeCategory.value
    return matchesCategory
  })
})

const openPreview = (asset: any) => {
  selectedAsset.value = asset
  isPreviewOpen.value = true
}

const handleMetadataLoaded = async (metadata: any) => {
  if (!selectedAsset.value) return
  
  // Verify ownership before updating metadata
  if (selectedAsset.value.userId !== authStore.user?.id) {
    console.warn('Cannot update metadata: You are not the owner of this asset.')
    return
  }

  // If the asset doesn't have metadata yet, or it's different, update it
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

const handleScreenshotCaptured = async (dataURL: string) => {
  if (!selectedAsset.value) return

  // Verify ownership before updating thumbnail
  if (selectedAsset.value.userId !== authStore.user?.id) {
    console.warn('Cannot update thumbnail: You are not the owner of this asset.')
    return
  }

  // If the asset doesn't have a thumbnail, or it's a default one, update it
  if (!selectedAsset.value.thumbnail) {
    try {
      const response = await api.patch(`/api/assets/${selectedAsset.value.id}/thumbnail`, { thumbnail: dataURL })
      // Update local asset data
      selectedAsset.value = { ...selectedAsset.value, ...response.data }
      const index = assets.value.findIndex(a => a.id === selectedAsset.value.id)
      if (index !== -1) {
        assets.value[index] = { ...assets.value[index], ...response.data }
      }
    } catch (error) {
      console.error('Failed to save thumbnail:', error)
    }
  }
}

const handleFileChange = (e: any) => {
  const file = e.target.files[0]
  if (file) {
    uploadForm.value.file = file
    if (!uploadForm.value.title) {
      uploadForm.value.title = file.name.split('.')[0]
    }
  }
}

const handleThumbnailChange = (e: any) => {
  const file = e.target.files[0]
  if (file) {
    uploadForm.value.thumbnail = file
  }
}

const handleUpload = async () => {
  if (!uploadForm.value.file) {
    ElMessage.warning('请选择模型文件')
    return
  }

  if (!uploadForm.value.categoryId) {
    ElMessage.warning('请选择资源分类')
    return
  }

  isUploading.value = true
  const formData = new FormData()
  formData.append('asset', uploadForm.value.file)
  if (uploadForm.value.thumbnail) {
    formData.append('thumbnail', uploadForm.value.thumbnail)
  }
  formData.append('title', uploadForm.value.title)
  formData.append('description', uploadForm.value.description)
  formData.append('categoryId', uploadForm.value.categoryId)

  try {
    await api.post('/api/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    ElMessage.success('上传成功，请等待管理员审核')
    isUploadDialogOpen.value = false
    uploadForm.value = { title: '', description: '', categoryId: '', file: null, thumbnail: null }
    fetchAssets()
    fetchCategories()
  } catch (error) {
    ElMessage.error('上传失败')
  } finally {
    isUploading.value = false
  }
}

const deleteAsset = async (id: string) => {
  try {
    await api.delete(`/api/assets/${id}`)
    ElMessage.success('删除成功')
    isPreviewOpen.value = false
    fetchAssets()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

onMounted(() => {
  fetchAssets()
  fetchCategories()
})
</script>

<template>
  <div class="flex flex-col h-full relative" style="background-color: var(--bg-card)">
    <!-- Top Bar -->
    <div class="h-14 border-b flex items-center justify-between px-6 shrink-0" style="border-color: var(--border-base)">
      <div class="flex items-center text-xs gap-1 font-medium" style="color: var(--text-secondary)">
        <span class="hover:text-accent cursor-pointer transition-colors">3D 学习资源库</span>
        <ChevronRight class="w-3.5 h-3.5" />
        <span style="color: var(--text-primary)">我的资源</span>
      </div>

      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="在资源中搜索..." 
            class="pl-9 pr-4 py-1.5 border-none rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Inner Filter Sidebar -->
      <div class="w-56 border-r flex flex-col shrink-0 overflow-y-auto" style="background-color: var(--bg-card); border-color: var(--border-base)">
        <div class="p-4">
          <button 
            @click="isUploadDialogOpen = true"
            class="w-full py-2 bg-accent hover:bg-accent text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-accent/10 dark:shadow-none">
            上传新作品
          </button>
        </div>
        
        <div class="px-3 pb-4">
          <ul class="space-y-0.5">
            <li v-for="cat in categories" :key="cat.name">
              <a href="#" 
                @click.prevent="activeCategory = cat.name"
                class="flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all"
                :class="activeCategory === cat.name ? 'dark:bg-accent/20' : 'hover:dark:bg-white/5'"
                :style="activeCategory === cat.name ? 'background-color: var(--bg-app); color: var(--accent); font-weight: bold' : 'color: var(--text-secondary)'">
                <div class="flex items-center gap-2.5">
                  <div class="w-1.5 h-1.5 rounded-full" :class="activeCategory === cat.name ? 'bg-accent' : 'bg-transparent'"></div>
                  {{ cat.name }}
                </div>
                <span class="text-[10px] opacity-60">{{ cat.count }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Asset Grid Area -->
      <div class="flex-1 flex flex-col overflow-hidden relative" style="background-color: var(--bg-app)">
        <!-- Asset Grid Scrollable Area -->
        <div class="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div v-if="filteredAssets.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
            <!-- Asset Card -->
            <div v-for="asset in filteredAssets" :key="asset.id" 
                 @click="openPreview(asset)"
                 class="group rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col relative aspect-[4/5]"
                 style="background-color: var(--bg-card); border-color: var(--border-base)">
              
              <!-- Badge -->
              <div class="absolute top-3 left-3 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold z-10 shadow-sm"
                   style="background-color: rgba(var(--bg-card-rgb, 255, 255, 255), 0.9); color: var(--text-secondary)">
                {{ asset.type }}
              </div>

              <!-- Image/Icon -->
              <div class="flex-1 relative flex items-center justify-center overflow-hidden" style="background: linear-gradient(135deg, var(--bg-app), var(--bg-card))">
                <img v-if="asset.thumbnail" :src="asset.thumbnail" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <img v-else :src="getDefaultThumbnailUrl(asset.type)" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                
                <!-- Hover Overlay -->
                <div class="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div class="p-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300" style="background-color: var(--bg-card)">
                    <Maximize2 class="w-4 h-4 text-accent" />
                  </div>
                </div>
              </div>

              <!-- Card Footer -->
              <div class="p-4 border-t" style="background-color: var(--bg-card); border-color: var(--border-base)">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs font-bold truncate" style="color: var(--text-primary)">{{ asset.title }}</p>
                  <span v-if="asset.category" class="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-slate-400">{{ asset.category.name }}</span>
                </div>
                <div class="flex items-center justify-between text-[10px] font-medium" style="color: var(--text-secondary)">
                  <span>{{ new Date(asset.createdAt).toLocaleDateString() }}</span>
                  <span class="text-accent">{{ asset.type }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="h-full flex flex-col items-center justify-center" style="color: var(--text-secondary)">
            <Box class="w-12 h-12 mb-4 opacity-20" />
            <p class="text-sm">没有找到匹配的资源</p>
          </div>
        </div>

        <!-- Pagination Footer -->
        <div v-if="pagination.totalPages > 1" class="h-16 border-t flex items-center justify-center shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <el-pagination
            v-model:current-page="pagination.page"
            :page-size="pagination.limit"
            :total="pagination.total"
            layout="prev, pager, next"
            background
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Upload Dialog -->
    <Transition name="fade">
      <div v-if="isUploadDialogOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="isUploadDialogOpen = false"></div>
        <div class="relative w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6" style="background-color: var(--bg-card)">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">上传 3D 资产</h3>
            <button @click="isUploadDialogOpen = false" style="color: var(--text-secondary)"><X class="w-5 h-5" /></button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">资源名称</label>
              <input v-model="uploadForm.title" type="text" class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" placeholder="给你的作品起个名字" />
            </div>
            
            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">描述 (可选)</label>
              <textarea v-model="uploadForm.description" rows="3" class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" placeholder="简单介绍一下这个模型..."></textarea>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">资源分类</label>
              <el-select v-model="uploadForm.categoryId" placeholder="请选择分类" class="w-full custom-select-v2">
                <el-option v-for="cat in assetCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
              </el-select>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">选择文件 (GLB/GLTF/FBX/OBJ/STL/DAE)</label>
              <div class="relative group">
                <input type="file" @change="handleFileChange" accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div class="w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all group-hover:border-accent group-hover:bg-accent/5" style="border-color: var(--border-base)">
                  <Box class="w-8 h-8 text-accent/40" />
                  <p class="text-xs font-medium" style="color: var(--text-secondary)">
                    {{ uploadForm.file ? uploadForm.file.name : '点击或拖拽模型文件到这里' }}
                  </p>
                  <p class="text-[10px]" style="color: var(--text-secondary); opacity: 0.5">支持 GLB, GLTF, FBX, OBJ, STL, DAE, 3DS 格式</p>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">上传封面图 (可选)</label>
              <div class="relative group">
                <input type="file" @change="handleThumbnailChange" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div class="w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-1 transition-all group-hover:border-accent group-hover:bg-accent/5" style="border-color: var(--border-base)">
                  <UploadCloud class="w-6 h-6 text-accent/40" />
                  <p class="text-[10px] font-medium" style="color: var(--text-secondary)">
                    {{ uploadForm.thumbnail ? uploadForm.thumbnail.name : '点击上传封面预览图' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button 
            @click="handleUpload"
            :disabled="isUploading"
            class="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all flex items-center justify-center gap-2"
          >
            <span v-if="!isUploading">开始上传</span>
            <span v-else class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- 3D Preview Overlay -->
    <Transition name="fade">
      <div v-if="isPreviewOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="isPreviewOpen = false"></div>
        
        <div class="relative w-full max-w-5xl h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row" style="background-color: var(--bg-card)">
          <button @click="isPreviewOpen = false" class="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-white md:text-slate-400 md:bg-transparent md:hover:bg-white/10 transition-all">
            <X class="w-5 h-5" />
          </button>

          <div class="flex-1 relative group overflow-hidden" style="background-color: var(--bg-app)">
            <ModelViewer 
              :model-url="selectedAsset?.url" 
              :auto-rotate="isAutoRotating" 
              @metadata-loaded="handleMetadataLoaded"
              @screenshot-captured="handleScreenshotCaptured"
            />

            <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 backdrop-blur px-4 py-2 rounded-full shadow-lg border" 
                 style="background-color: rgba(var(--bg-card-rgb, 255, 255, 255), 0.8); border-color: var(--border-base)">
              <button @click="isAutoRotating = !isAutoRotating" class="p-2 rounded-full transition-colors" :class="isAutoRotating ? 'text-accent bg-accent-subtle' : 'text-slate-400 hover:bg-slate-50'"><RotateCw class="w-4 h-4" :class="isAutoRotating ? 'animate-spin-slow' : ''" /></button>
              <div class="w-px h-4 mx-1" style="background-color: var(--border-base)"></div>
              <button v-if="selectedAsset?.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'" class="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors" @click="deleteAsset(selectedAsset.id)"><X class="w-4 h-4" /></button>
            </div>
          </div>

          <!-- Side Info Panel -->
          <div class="w-full md:w-80 p-6 flex flex-col border-l" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <h2 class="text-xl font-bold mb-1" style="color: var(--text-primary)">{{ selectedAsset?.title }}</h2>
            <p class="text-sm mb-6" style="color: var(--text-secondary)">{{ selectedAsset?.type }} 模型资产</p>
            
            <div class="space-y-4 flex-1">
              <p class="text-xs leading-relaxed" style="color: var(--text-secondary)">{{ selectedAsset?.description || '暂无描述' }}</p>
              
              <div class="p-4 rounded-xl border" style="background-color: var(--bg-app); border-color: var(--border-base)">
                <p class="text-[10px] uppercase font-bold mb-2 tracking-wider" style="color: var(--text-secondary)">资产详情</p>
                <div class="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <p class="text-[10px]" style="color: var(--text-secondary)">格式</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">{{ selectedAsset?.type }}</p>
                  </div>
                  <div>
                    <p class="text-[10px]" style="color: var(--text-secondary)">文件大小</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">{{ selectedAsset?.size || '未知' }} MB</p>
                  </div>
                  <div v-if="selectedAsset?.vertices">
                    <p class="text-[10px]" style="color: var(--text-secondary)">顶点数</p>
                    <p class="text-xs font-bold font-mono" style="color: var(--text-primary)">{{ selectedAsset.vertices.toLocaleString() }}</p>
                  </div>
                  <div v-if="selectedAsset?.faces">
                    <p class="text-[10px]" style="color: var(--text-secondary)">面数</p>
                    <p class="text-xs font-bold font-mono" style="color: var(--text-primary)">{{ selectedAsset.faces.toLocaleString() }}</p>
                  </div>
                  <div v-if="selectedAsset?.animations">
                    <p class="text-[10px]" style="color: var(--text-secondary)">动画</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">{{ selectedAsset.animations }} 个</p>
                  </div>
                  <div v-if="selectedAsset?.category">
                    <p class="text-[10px]" style="color: var(--text-secondary)">分类</p>
                    <p class="text-xs font-bold text-accent">{{ selectedAsset.category.name }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-auto pt-6">
              <a :href="selectedAsset?.url" download class="w-full py-3 bg-accent hover:bg-accent text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-accent/10 dark:shadow-none flex items-center justify-center gap-2">
                <Download class="w-4 h-4" /> 下载模型文件
              </a>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.animate-spin-slow { animation: spin 3s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

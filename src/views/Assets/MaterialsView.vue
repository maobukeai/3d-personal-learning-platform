<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  Search, 
  Layers, 
  Filter, 
  Download, 
  ExternalLink, 
  Box, 
  Info,
  ChevronRight,
  Grid3X3,
  Maximize2,
  Plus,
  UploadCloud,
  X
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const searchQuery = ref('')
const activeCategory = ref('全部材料')
const materials = ref<any[]>([])
const isLoading = ref(false)

const categories = ['全部材料', '金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他']

// Upload related
const isUploadDialogOpen = ref(false)
const isUploading = ref(false)
const uploadForm = ref({
  title: '',
  category: '其他',
  resolution: '4K',
  tags: '',
  isProcedural: false,
  file: null as File | null,
  preview: null as File | null
})

const fetchMaterials = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/materials', {
      params: { category: activeCategory.value }
    })
    materials.value = response.data
  } catch (error) {
    ElMessage.error('获取材料失败')
  } finally {
    isLoading.value = false
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

const handlePreviewChange = (e: any) => {
  const file = e.target.files[0]
  if (file) {
    uploadForm.value.preview = file
  }
}

const handleUpload = async () => {
  if (!uploadForm.value.file) {
    ElMessage.warning('请选择材料包文件')
    return
  }
  if (!uploadForm.value.preview) {
    ElMessage.warning('请上传预览图')
    return
  }

  isUploading.value = true
  const formData = new FormData()
  formData.append('material', uploadForm.value.file)
  formData.append('preview', uploadForm.value.preview)
  formData.append('title', uploadForm.value.title)
  formData.append('category', uploadForm.value.category)
  formData.append('resolution', uploadForm.value.resolution)
  formData.append('tags', uploadForm.value.tags)
  formData.append('isProcedural', String(uploadForm.value.isProcedural))

  try {
    await api.post('/api/materials/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    ElMessage.success('材料上传成功')
    isUploadDialogOpen.value = false
    uploadForm.value = { title: '', category: '其他', resolution: '4K', tags: '', isProcedural: false, file: null, preview: null }
    fetchMaterials()
  } catch (error) {
    ElMessage.error('上传失败')
  } finally {
    isUploading.value = false
  }
}

const deleteMaterial = (id: string) => {
  ElMessageBox.confirm('确定删除该材料吗？', '提示', { type: 'warning' }).then(async () => {
    try {
      await api.delete(`/api/materials/${id}`)
      ElMessage.success('已删除')
      fetchMaterials()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

const filteredMaterials = computed(() => {
  return materials.value.filter(mat => {
    const tags = (mat.tags || '').toLowerCase()
    return mat.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           tags.includes(searchQuery.value.toLowerCase())
  })
})

const getTagsList = (tags: string | null) => {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(t => t)
}

onMounted(fetchMaterials)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b px-8 flex items-center justify-between shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <Layers class="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">材料与纹理库</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索材料库..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-72 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button @click="isUploadDialogOpen = true" class="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600">
          <Plus class="w-4 h-4" /> 上传新材料
        </button>
      </div>
    </div>

    <!-- Category Toolbar -->
    <div class="border-b px-8 py-2 shrink-0 overflow-x-auto scrollbar-hide" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <button 
          v-for="cat in categories" 
          :key="cat"
          @click="activeCategory = cat; fetchMaterials()"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
          :class="activeCategory === cat ? 'bg-slate-800 text-white dark:bg-accent dark:text-white' : 'hover:opacity-80'"
          :style="activeCategory !== cat ? 'color: var(--text-secondary); background-color: var(--bg-app)' : ''"
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto">
        <div v-if="filteredMaterials.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          <div v-for="mat in filteredMaterials" :key="mat.id" 
               class="group rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <!-- Material Preview -->
            <div class="aspect-square relative overflow-hidden" style="background-color: var(--bg-app)">
              <img :src="mat.previewUrl" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              
              <!-- Badge -->
              <div class="absolute top-2 right-2 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm border"
                   style="background-color: var(--bg-card); color: var(--text-primary); border-color: var(--border-base)">
                {{ mat.resolution }}
              </div>

              <!-- Procedural Indicator -->
              <div v-if="mat.isProcedural" class="absolute top-2 left-2 bg-accent px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-sm flex items-center gap-1">
                <Box class="w-2.5 h-2.5" /> 程序化
              </div>

              <!-- Hover Actions -->
              <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a :href="mat.fileUrl" download class="p-2 rounded-lg bg-white text-slate-800 hover:text-orange-600 transition-all shadow-lg">
                  <Download class="w-4 h-4" />
                </a>
                <button @click="deleteMaterial(mat.id)" class="p-2 rounded-lg bg-white text-rose-500 hover:bg-rose-50 transition-all shadow-lg">
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Material Info -->
            <div class="p-3">
              <h3 class="text-xs font-bold truncate mb-1.5" style="color: var(--text-primary)">{{ mat.title }}</h3>
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-medium" style="color: var(--text-secondary)">{{ mat.category }}</span>
                <div class="flex gap-1">
                  <span v-for="tag in getTagsList(mat.tags)" :key="tag" class="text-[8px] px-1 rounded border" 
                        style="background-color: var(--bg-app); color: var(--text-secondary); border-color: var(--border-base)">{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="h-64 flex flex-col items-center justify-center text-slate-400">
           <Layers class="w-12 h-12 mb-4 opacity-10" />
           <p class="text-sm font-bold">该分类下暂无材料</p>
        </div>
      </div>
    </div>

    <!-- Upload Dialog -->
    <Transition name="fade">
      <div v-if="isUploadDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="isUploadDialogOpen = false"></div>
        <div class="relative w-full max-w-lg p-8 rounded-3xl shadow-2xl space-y-6" style="background-color: var(--bg-card)">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">贡献新材料</h3>
            <button @click="isUploadDialogOpen = false" style="color: var(--text-secondary)"><X class="w-5 h-5" /></button>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">材料名称</label>
                <input v-model="uploadForm.title" type="text" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all" placeholder="例如：锈蚀铁片 PBR" />
              </div>

              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">分类</label>
                <el-select v-model="uploadForm.category" class="!w-full !rounded-2xl custom-select">
                  <el-option v-for="cat in categories.filter(c => c !== '全部材料')" :key="cat" :label="cat" :value="cat" />
                </el-select>
              </div>

              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">分辨率 / 类型</label>
                <el-select v-model="uploadForm.resolution" class="!w-full !rounded-2xl custom-select">
                  <el-option v-for="res in ['2K', '4K', '8K', '矢量', '程序化']" :key="res" :label="res" :value="res" />
                </el-select>
              </div>

              <div class="flex items-center gap-3 pt-2">
                <el-switch v-model="uploadForm.isProcedural" active-color="var(--accent)" />
                <span class="text-xs font-bold" style="color: var(--text-secondary)">这是程序化材料 (.sbsar)</span>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">材料包 (ZIP)</label>
                <div class="relative group h-24">
                  <input type="file" @change="handleFileChange" accept=".zip,.sbsar" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-orange-500 group-hover:bg-orange-500/5" style="border-color: var(--border-base)">
                    <Box class="w-5 h-5 text-orange-500/40" />
                    <p class="text-[10px] font-medium truncate px-4" style="color: var(--text-secondary)">
                      {{ uploadForm.file ? uploadForm.file.name : '点击选择 ZIP/SBSAR' }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">预览图</label>
                <div class="relative group h-24">
                  <input type="file" @change="handlePreviewChange" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-orange-500 group-hover:bg-orange-500/5" style="border-color: var(--border-base)">
                    <UploadCloud class="w-5 h-5 text-orange-500/40" />
                    <p class="text-[10px] font-medium truncate px-4" style="color: var(--text-secondary)">
                      {{ uploadForm.preview ? uploadForm.preview.name : '点击上传预览图' }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">标签</label>
                <input v-model="uploadForm.tags" type="text" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all" placeholder="用逗号分隔" />
              </div>
            </div>
          </div>

          <button 
            @click="handleUpload"
            :disabled="isUploading"
            class="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
          >
            <div v-if="isUploading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {{ isUploading ? '正在上传...' : '发布材料' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.custom-select :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
}
</style>

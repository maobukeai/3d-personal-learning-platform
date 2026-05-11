<script setup lang="ts">
import { ref } from 'vue'
import { Search, ChevronRight, ChevronDown, Check, Box, Maximize2, X, Download, Share2, RotateCw } from 'lucide-vue-next'
import ModelViewer from '@/components/ModelViewer.vue'

const searchQuery = ref('')
const activeCategory = ref('全部')
const selectedAsset = ref<any>(null)
const isPreviewOpen = ref(false)
const isAutoRotating = ref(true)

const categories = [
  { name: '全部', count: null, active: true },
  { name: '建筑', count: 119 },
  { name: '浴室', count: 155 },
  { name: '卧室', count: 96 },
  { name: '服装', count: 47 },
  { name: '采光', count: 277 },
  { name: '餐饮', count: 35 },
  { name: '电子设备', count: 51 },
  { name: '饮食', count: 61 },
  { name: '家具细节', count: 86 },
  { name: '花园', count: 52 },
  { name: '厨房', count: 282 },
  { name: '照明', count: 541 },
]

const mockAssets = Array.from({ length: 24 }).map((_, i) => ({
  id: i,
  title: i % 2 === 0 ? `布艺沙发 0${(i % 5) + 1}` : `室内盆栽 0${(i % 5) + 1}`,
  image: i % 2 === 0 ? '/asset_sofa.png' : '/asset_plant.png',
  type: i % 2 === 0 ? '家具' : '植物',
  format: 'GLB',
  size: '12.4 MB'
}))

const openPreview = (asset: any) => {
  selectedAsset.value = asset
  isPreviewOpen.value = true
}
</script>

<template>
  <div class="flex flex-col h-full bg-white relative">
    <!-- Top Bar -->
    <div class="h-14 border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div class="flex items-center text-xs text-slate-500 gap-1 font-medium">
        <span class="hover:text-slate-800 cursor-pointer transition-colors">3D 学习资源库</span>
        <ChevronRight class="w-3.5 h-3.5" />
        <span class="text-slate-800">全部资源</span>
      </div>

      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="在 2,485 个资源中搜索..." 
            class="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 transition-all"
          />
        </div>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Inner Filter Sidebar -->
      <div class="w-56 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto">
        <div class="p-4">
          <button class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-100">
            上传新作品
          </button>
        </div>
        
        <div class="px-3 pb-4">
          <ul class="space-y-0.5">
            <li v-for="cat in categories" :key="cat.name">
              <a href="#" 
                @click.prevent="activeCategory = cat.name"
                class="flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all"
                :class="activeCategory === cat.name ? 'bg-slate-100 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'">
                <div class="flex items-center gap-2.5">
                  <div class="w-1.5 h-1.5 rounded-full" :class="activeCategory === cat.name ? 'bg-blue-600' : 'bg-transparent'"></div>
                  {{ cat.name }}
                </div>
                <span v-if="cat.count" class="text-[10px] font-medium opacity-60">
                  {{ cat.count }}
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Asset Grid Area -->
      <div class="flex-1 flex flex-col bg-[#f8fafc] overflow-hidden relative">
        <!-- Asset Grid Scrollable Area -->
        <div class="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
            <!-- Asset Card -->
            <div v-for="asset in mockAssets" :key="asset.id" 
                 @click="openPreview(asset)"
                 class="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col relative aspect-[4/5]">
              
              <!-- Badge -->
              <div class="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 z-10 shadow-sm">
                {{ asset.format }}
              </div>

              <!-- Image Container -->
              <div class="flex-1 bg-gradient-to-br from-slate-50 to-white relative flex items-center justify-center p-6">
                <img :src="asset.image" :alt="asset.title" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" />
                
                <!-- Hover Overlay -->
                <div class="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div class="bg-white p-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    <Maximize2 class="w-4 h-4 text-blue-600" />
                  </div>
                </div>
              </div>

              <!-- Card Footer -->
              <div class="p-4 border-t border-slate-50 bg-white">
                <p class="text-xs font-bold text-slate-800 truncate mb-1">{{ asset.title }}</p>
                <div class="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>{{ asset.type }}</span>
                  <span>{{ asset.size }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pagination Footer -->
        <div class="h-14 border-t border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
          <span class="text-xs text-slate-400 font-medium">第 1 页, 共 208 页 (2485 项)</span>
          <div class="flex items-center gap-1">
            <button class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
              <ChevronRight class="w-4 h-4 rotate-180" />
            </button>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-100">
              1
            </button>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold text-xs">
              2
            </button>
            <span class="px-1 text-slate-300">...</span>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold text-xs">
              42
            </button>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 3D Preview Overlay (Mock) -->
    <Transition name="fade">
      <div v-if="isPreviewOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="isPreviewOpen = false"></div>
        
        <div class="relative w-full max-w-5xl h-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
          <!-- Close Button -->
          <button @click="isPreviewOpen = false" class="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-white md:text-slate-400 md:bg-transparent md:hover:bg-slate-100 transition-all">
            <X class="w-5 h-5" />
          </button>

          <!-- 3D Viewport -->
          <div class="flex-1 bg-slate-100 relative group overflow-hidden">
            <ModelViewer :auto-rotate="isAutoRotating" />

            <!-- Viewport Controls -->
            <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-white">
              <button 
                @click="isAutoRotating = !isAutoRotating"
                class="p-2 rounded-full transition-colors"
                :class="isAutoRotating ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'"
                title="自动旋转"
              >
                <RotateCw class="w-4 h-4" :class="isAutoRotating ? 'animate-spin-slow' : ''" />
              </button>
              <div class="w-px h-4 bg-slate-200 mx-1"></div>
              <button class="px-3 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">重置视图</button>
              <div class="w-px h-4 bg-slate-200 mx-1"></div>
              <button class="p-2 hover:bg-blue-50 rounded-full transition-colors text-slate-600 hover:text-blue-600"><Share2 class="w-4 h-4" /></button>
            </div>
            
            <div class="absolute top-6 left-6 pointer-events-none">
              <div class="bg-black/50 backdrop-blur text-white px-3 py-1.5 rounded-lg text-[10px] font-medium flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                实时 3D 渲染已开启
              </div>
            </div>
          </div>

          <!-- Side Info Panel -->
          <div class="w-full md:w-80 bg-white p-6 flex flex-col border-l border-slate-100">
            <h2 class="text-xl font-bold text-slate-900 mb-1">{{ selectedAsset?.title }}</h2>
            <p class="text-sm text-slate-500 mb-6">{{ selectedAsset?.type }} 模型资产</p>
            
            <div class="space-y-4 flex-1">
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p class="text-[10px] text-slate-400 uppercase font-bold mb-2 tracking-wider">资产详情</p>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs text-slate-400 mb-0.5">格式</p>
                    <p class="text-sm font-bold text-slate-700">{{ selectedAsset?.format }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-slate-400 mb-0.5">大小</p>
                    <p class="text-sm font-bold text-slate-700">{{ selectedAsset?.size }}</p>
                  </div>
                </div>
              </div>

              <div>
                <p class="text-xs font-bold text-slate-800 mb-3">使用许可</p>
                <div class="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg border border-emerald-100">
                  <Check class="w-3.5 h-3.5" />
                  免费商业用途 (CC0)
                </div>
              </div>
            </div>

            <div class="mt-auto pt-6 space-y-3">
              <button class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                <Download class="w-4 h-4" /> 下载模型文件
              </button>
              <button class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                <Box class="w-4 h-4" /> 收藏资产
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
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

.animate-spin-slow {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>

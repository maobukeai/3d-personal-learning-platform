<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, ChevronRight, ChevronDown, Check, Box, Maximize2, X, Download, Share2, RotateCw } from 'lucide-vue-next'
import ModelViewer from '@/components/ModelViewer.vue'

const searchQuery = ref('')
const activeCategory = ref('全部')
const selectedAsset = ref<any>(null)
const isPreviewOpen = ref(false)
const isAutoRotating = ref(true)

const categories = [
  { name: '全部', count: null },
  { name: '家具', count: 12 },
  { name: '植物', count: 12 },
  { name: '建筑', count: 0 },
  { name: '电子设备', count: 0 },
  { name: '照明', count: 0 },
]

const mockAssets = Array.from({ length: 24 }).map((_, i) => ({
  id: i,
  title: i % 2 === 0 ? `布艺沙发 0${(i % 5) + 1}` : `室内盆栽 0${(i % 5) + 1}`,
  image: i % 2 === 0 ? '/asset_sofa.png' : '/asset_plant.png',
  type: i % 2 === 0 ? '家具' : '植物',
  format: 'GLB',
  size: '12.4 MB'
}))

const filteredAssets = computed(() => {
  return mockAssets.filter(asset => {
    const matchesSearch = asset.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = activeCategory.value === '全部' || asset.type === activeCategory.value
    return matchesSearch && matchesCategory
  })
})

const openPreview = (asset: any) => {
  selectedAsset.value = asset
  isPreviewOpen.value = true
}
</script>

<template>
  <div class="flex flex-col h-full relative" style="background-color: var(--bg-card)">
    <!-- Top Bar -->
    <div class="h-14 border-b flex items-center justify-between px-6 shrink-0" style="border-color: var(--border-base)">
      <div class="flex items-center text-xs gap-1 font-medium" style="color: var(--text-secondary)">
        <span class="hover:text-accent cursor-pointer transition-colors">3D 学习资源库</span>
        <ChevronRight class="w-3.5 h-3.5" />
        <span style="color: var(--text-primary)">全部资源</span>
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
          <button class="w-full py-2 bg-accent hover:bg-accent text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-accent/10 dark:shadow-none">
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
                <span v-if="cat.count !== null" class="text-[10px] font-medium opacity-60">
                  {{ cat.count }}
                </span>
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
                {{ asset.format }}
              </div>

              <!-- Image Container -->
              <div class="flex-1 relative flex items-center justify-center p-6" style="background: linear-gradient(135deg, var(--bg-app), var(--bg-card))">
                <img :src="asset.image" :alt="asset.title" class="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-500" />
                
                <!-- Hover Overlay -->
                <div class="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div class="p-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300" style="background-color: var(--bg-card)">
                    <Maximize2 class="w-4 h-4 text-accent" />
                  </div>
                </div>
              </div>

              <!-- Card Footer -->
              <div class="p-4 border-t" style="background-color: var(--bg-card); border-color: var(--border-base)">
                <p class="text-xs font-bold truncate mb-1" style="color: var(--text-primary)">{{ asset.title }}</p>
                <div class="flex items-center justify-between text-[10px] font-medium" style="color: var(--text-secondary)">
                  <span>{{ asset.type }}</span>
                  <span>{{ asset.size }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="h-full flex flex-col items-center justify-center" style="color: var(--text-secondary)">
            <Box class="w-12 h-12 mb-4 opacity-20" />
            <p class="text-sm">没有找到匹配的资源</p>
            <button @click="searchQuery = ''; activeCategory = '全部'" class="mt-4 text-xs text-accent font-bold hover:underline">
              重置筛选条件
            </button>
          </div>
        </div>
        
        <!-- Pagination Footer -->
        <div class="h-14 border-t flex items-center justify-between px-6 shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <span class="text-xs font-medium" style="color: var(--text-secondary)">第 1 页, 共 208 页 (2485 项)</span>
          <div class="flex items-center gap-1">
            <button class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" style="color: var(--text-secondary)">
              <ChevronRight class="w-4 h-4 rotate-180" />
            </button>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center bg-accent text-white font-bold text-xs shadow-md shadow-accent/10 dark:shadow-none">
              1
            </button>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs" style="color: var(--text-primary)">
              2
            </button>
            <span class="px-1" style="color: var(--border-strong)">...</span>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs" style="color: var(--text-primary)">
              42
            </button>
            <button class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" style="color: var(--text-secondary)">
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 3D Preview Overlay (Mock) -->
    <Transition name="fade">
      <div v-if="isPreviewOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="isPreviewOpen = false"></div>
        
        <div class="relative w-full max-w-5xl h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row" style="background-color: var(--bg-card)">
          <!-- Close Button -->
          <button @click="isPreviewOpen = false" class="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-white md:text-slate-400 md:bg-transparent md:hover:bg-white/10 transition-all">
            <X class="w-5 h-5" />
          </button>

          <!-- 3D Viewport -->
          <div class="flex-1 relative group overflow-hidden" style="background-color: var(--bg-app)">
            <ModelViewer :auto-rotate="isAutoRotating" />

            <!-- Viewport Controls -->
            <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 backdrop-blur px-4 py-2 rounded-full shadow-lg border" 
                 style="background-color: rgba(var(--bg-card-rgb, 255, 255, 255), 0.8); border-color: var(--border-base)">
              <button 
                @click="isAutoRotating = !isAutoRotating"
                class="p-2 rounded-full transition-colors"
                :class="isAutoRotating ? 'text-accent bg-accent-subtle dark:bg-accent/30' : 'hover:bg-slate-50 dark:hover:bg-white/5'"
                :style="!isAutoRotating ? 'color: var(--text-secondary)' : ''"
                title="自动旋转"
              >
                <RotateCw class="w-4 h-4" :class="isAutoRotating ? 'animate-spin-slow' : ''" />
              </button>
              <div class="w-px h-4 mx-1" style="background-color: var(--border-base)"></div>
              <button class="px-3 py-1 text-xs font-bold text-accent hover:text-accent transition-colors">重置视图</button>
              <div class="w-px h-4 mx-1" style="background-color: var(--border-base)"></div>
              <button class="p-2 hover:bg-accent-subtle dark:hover:bg-accent/30 rounded-full transition-colors" style="color: var(--text-secondary)"><Share2 class="w-4 h-4" /></button>
            </div>
            
            <div class="absolute top-6 left-6 pointer-events-none">
              <div class="bg-black/50 backdrop-blur text-white px-3 py-1.5 rounded-lg text-[10px] font-medium flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                实时 3D 渲染已开启
              </div>
            </div>
          </div>

          <!-- Side Info Panel -->
          <div class="w-full md:w-80 p-6 flex flex-col border-l" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <h2 class="text-xl font-bold mb-1" style="color: var(--text-primary)">{{ selectedAsset?.title }}</h2>
            <p class="text-sm mb-6" style="color: var(--text-secondary)">{{ selectedAsset?.type }} 模型资产</p>
            
            <div class="space-y-4 flex-1">
              <div class="p-4 rounded-xl border" style="background-color: var(--bg-app); border-color: var(--border-base)">
                <p class="text-[10px] uppercase font-bold mb-2 tracking-wider" style="color: var(--text-secondary)">资产详情</p>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <p class="text-xs mb-0.5" style="color: var(--text-secondary)">格式</p>
                    <p class="text-sm font-bold" style="color: var(--text-primary)">{{ selectedAsset?.format }}</p>
                  </div>
                  <div>
                    <p class="text-xs mb-0.5" style="color: var(--text-secondary)">大小</p>
                    <p class="text-sm font-bold" style="color: var(--text-primary)">{{ selectedAsset?.size }}</p>
                  </div>
                </div>
              </div>

              <div>
                <p class="text-xs font-bold mb-3" style="color: var(--text-primary)">使用许可</p>
                <div class="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800">
                  <Check class="w-3.5 h-3.5" />
                  免费商业用途 (CC0)
                </div>
              </div>
            </div>

            <div class="mt-auto pt-6 space-y-3">
              <button class="w-full py-3 bg-accent hover:bg-accent text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-accent/10 dark:shadow-none flex items-center justify-center gap-2">
                <Download class="w-4 h-4" /> 下载模型文件
              </button>
              <button class="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2" 
                      style="background-color: var(--bg-app); color: var(--text-secondary)">
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

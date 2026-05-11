<script setup lang="ts">
import { ref, computed } from 'vue'
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
  Maximize2
} from 'lucide-vue-next'

const searchQuery = ref('')
const activeCategory = ref('全部材料')

const categories = ['全部材料', '金属', '木纹', '石材', '织物', '程序化', '玻璃']

const materials = [
  {
    id: 1,
    title: '拉丝不锈钢 PBR',
    category: '金属',
    resolution: '4K',
    preview: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&auto=format&fit=crop&q=60',
    tags: ['写实', '无缝'],
    isProcedural: false
  },
  {
    id: 2,
    title: '旧橡木地板贴图',
    category: '木纹',
    resolution: '8K',
    preview: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop&q=60',
    tags: ['室内', '复古'],
    isProcedural: false
  },
  {
    id: 3,
    title: '程序化大理石生成器',
    category: '程序化',
    resolution: '矢量',
    preview: 'https://images.unsplash.com/photo-1531070836356-073c7fd74b6a?w=800&auto=format&fit=crop&q=60',
    tags: ['Substance', '节点'],
    isProcedural: true
  },
  {
    id: 4,
    title: '战损皮革材质',
    category: '织物',
    resolution: '4K',
    preview: 'https://images.unsplash.com/photo-1589149098258-3e9102ca93d3?w=800&auto=format&fit=crop&q=60',
    tags: ['角色', '旧化'],
    isProcedural: false
  },
  {
    id: 5,
    title: '磨砂艺术玻璃',
    category: '玻璃',
    resolution: '2K',
    preview: 'https://images.unsplash.com/photo-1533167606207-d840b5070fc2?w=800&auto=format&fit=crop&q=60',
    tags: ['半透明', '折射'],
    isProcedural: false
  },
  {
    id: 6,
    title: '水泥工业墙面',
    category: '石材',
    resolution: '4K',
    preview: 'https://images.unsplash.com/photo-1517646281553-9b935c103184?w=800&auto=format&fit=crop&q=60',
    tags: ['建筑', '粗糙'],
    isProcedural: false
  }
]

const filteredMaterials = computed(() => {
  return materials.filter(mat => {
    const matchesSearch = mat.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          mat.tags.some(tag => tag.toLowerCase().includes(searchQuery.value.toLowerCase()))
    const matchesCategory = activeCategory.value === '全部材料' || mat.category === activeCategory.value
    return matchesSearch && matchesCategory
  })
})
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
            placeholder="在 5,200+ 材料中搜索..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-72 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button class="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-all"
                style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-secondary)">
          <Filter class="w-4 h-4" /> 详细参数
        </button>
      </div>
    </div>

    <!-- Category Toolbar -->
    <div class="border-b px-8 py-2 shrink-0 overflow-x-auto scrollbar-hide" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <button 
          v-for="cat in categories" 
          :key="cat"
          @click="activeCategory = cat"
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
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          <div v-for="mat in filteredMaterials" :key="mat.id" 
               class="group rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <!-- Material Preview -->
            <div class="aspect-square relative overflow-hidden" style="background-color: var(--bg-app)">
              <img :src="mat.preview" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              
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
                <button class="p-2 rounded-lg hover:text-orange-600 transition-all"
                        style="background-color: var(--bg-card); color: var(--text-primary)">
                  <Download class="w-4 h-4" />
                </button>
                <button class="p-2 rounded-lg hover:text-orange-600 transition-all"
                        style="background-color: var(--bg-card); color: var(--text-primary)">
                  <Maximize2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Material Info -->
            <div class="p-3">
              <h3 class="text-xs font-bold truncate mb-1.5" style="color: var(--text-primary)">{{ mat.title }}</h3>
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-medium" style="color: var(--text-secondary)">{{ mat.category }}</span>
                <div class="flex gap-1">
                  <span v-for="tag in mat.tags" :key="tag" class="text-[8px] px-1 rounded border" 
                        style="background-color: var(--bg-app); color: var(--text-secondary); border-color: var(--border-base)">{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>

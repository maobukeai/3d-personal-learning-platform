<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  Search, 
  FolderPlus, 
  LayoutGrid, 
  List, 
  MoreHorizontal, 
  Clock, 
  Users, 
  Layers,
  CheckCircle2,
  Calendar,
  ChevronRight
} from 'lucide-vue-next'

const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')

const projects = [
  {
    id: 1,
    title: '现代简约办公空间渲染',
    description: '使用 Blender Cycles 引擎进行高精度室内建模与写实灯光布置，目标是达到照片级渲染效果。',
    progress: 75,
    status: '进行中',
    dueDate: '2026-05-20',
    team: [
      { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' },
      { name: 'Sarah', avatar: 'https://i.pravatar.cc/150?img=32' }
    ],
    tags: ['室内设计', '写实渲染'],
    color: 'bg-accent'
  },
  {
    id: 2,
    title: '低多边形游戏场景资源包',
    description: '为移动端游戏设计的通用环境资源，包含植物、建筑和地形块，采用 Atlas 贴图优化。',
    progress: 100,
    status: '已完成',
    dueDate: '2026-05-01',
    team: [
      { name: 'David', avatar: 'https://i.pravatar.cc/150?img=12' }
    ],
    tags: ['游戏资产', 'Low-Poly'],
    color: 'bg-emerald-500'
  },
  {
    id: 3,
    title: '几何节点城市生成器',
    description: '开发一套基于几何节点的程序化城市生成工具，支持自定义建筑高度、密度和路网。',
    progress: 30,
    status: '进行中',
    dueDate: '2026-06-15',
    team: [
      { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' },
      { name: 'Emily', avatar: 'https://i.pravatar.cc/150?img=25' },
      { name: 'Sarah', avatar: 'https://i.pravatar.cc/150?img=32' }
    ],
    tags: ['技术美术', '几何节点'],
    color: 'bg-purple-500'
  },
  {
    id: 4,
    title: '写实角色雕刻练习',
    description: '在 ZBrush 中进行解剖学练习，并最终导入 Blender 完成材质连接与渲染展示。',
    progress: 10,
    status: '已暂停',
    dueDate: '2026-07-01',
    team: [
      { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' }
    ],
    tags: ['角色建模', '雕刻'],
    color: 'bg-orange-500'
  }
]

const filteredProjects = computed(() => {
  return projects.filter(project => {
    return project.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           project.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           project.tags.some(tag => tag.toLowerCase().includes(searchQuery.value.toLowerCase()))
  })
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b px-8 flex items-center justify-between shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-accent-subtle rounded-lg">
          <Layers class="w-5 h-5 text-accent" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">项目管理</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="在所有项目中搜索..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button class="bg-accent text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-lg shadow-accent/20 dark:shadow-none flex items-center gap-2">
          <FolderPlus class="w-4 h-4" /> 创建新项目
        </button>
      </div>
    </div>

    <!-- Toolbar Area -->
    <div class="px-8 py-4 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-4">
        <div class="flex items-center rounded-lg border p-1" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <button 
            @click="viewMode = 'grid'"
            class="p-1.5 rounded-md transition-all"
            :class="viewMode === 'grid' ? 'bg-slate-100 dark:bg-white/10 text-accent' : 'hover:text-accent'"
            :style="viewMode !== 'grid' ? 'color: var(--text-secondary)' : ''"
          >
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button 
            @click="viewMode = 'list'"
            class="p-1.5 rounded-md transition-all"
            :class="viewMode === 'list' ? 'bg-slate-100 dark:bg-white/10 text-accent' : 'hover:text-accent'"
            :style="viewMode !== 'list' ? 'color: var(--text-secondary)' : ''"
          >
            <List class="w-4 h-4" />
          </button>
        </div>
        <span class="text-xs font-medium" style="color: var(--text-secondary)">当前显示 {{ projects.length }} 个活跃项目</span>
      </div>

      <div class="flex items-center gap-3">
        <select class="text-xs font-bold border rounded-lg px-3 py-1.5 focus:ring-0 cursor-pointer"
                style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-secondary)">
          <option>最近活跃</option>
          <option>即将到期</option>
          <option>进度最高</option>
        </select>
      </div>
    </div>

    <!-- Projects Grid Area -->
    <div class="flex-1 overflow-y-auto p-8 pt-0 scrollbar-hide">
      <div class="max-w-7xl mx-auto">
        <div v-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <!-- Project Card (Grid) -->
          <div v-for="project in filteredProjects" :key="project.id" 
               class="rounded-3xl border p-6 hover:shadow-xl hover:border-accent/40 transition-all group flex flex-col"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white" :class="project.color">
                  <Layers class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="text-sm font-bold group-hover:text-accent transition-colors" style="color: var(--text-primary)">{{ project.title }}</h3>
                  <p class="text-[10px] font-medium" style="color: var(--text-secondary)">最后更新: 1天前</p>
                </div>
              </div>
              <button class="p-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-secondary)">
                <MoreHorizontal class="w-4 h-4" />
              </button>
            </div>

            <p class="text-xs leading-relaxed mb-6 line-clamp-2" style="color: var(--text-secondary)">{{ project.description }}</p>

            <!-- Tags -->
            <div class="flex flex-wrap gap-1.5 mb-6">
              <span v-for="tag in project.tags" :key="tag" class="text-[10px] font-bold px-2 py-0.5 border rounded-md"
                    style="background-color: var(--bg-app); color: var(--text-secondary); border-color: var(--border-base)">
                {{ tag }}
              </span>
            </div>

            <!-- Progress -->
            <div class="space-y-2 mb-6">
              <div class="flex items-center justify-between text-[10px] font-bold">
                <span class="uppercase tracking-wider" style="color: var(--text-secondary)">完成进度</span>
                <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'">{{ project.progress }}%</span>
              </div>
              <div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--bg-app)">
                <div 
                  class="h-full rounded-full transition-all duration-1000" 
                  :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
                  :style="{ width: project.progress + '%' }"
                ></div>
              </div>
            </div>

            <!-- Footer Meta -->
            <div class="mt-auto flex items-center justify-between pt-5 border-t" style="border-color: var(--border-base)">
              <div class="flex items-center -space-x-2">
                <img v-for="m in project.team" :key="m.name" :src="m.avatar" :title="m.name" class="w-7 h-7 rounded-full border-2" style="border-color: var(--bg-card)" />
                <div v-if="project.team.length > 3" class="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold" 
                     style="background-color: var(--bg-app); border-color: var(--bg-card); color: var(--text-secondary)">
                  +{{ project.team.length - 2 }}
                </div>
              </div>
              
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5 text-[10px] font-bold" style="color: var(--text-secondary)">
                  <Calendar class="w-3.5 h-3.5" />
                  {{ project.dueDate.split('-').slice(1).join('/') }}
                </div>
                <div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                     :class="project.status === '已完成' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : project.status === '进行中' ? 'bg-accent-subtle text-accent' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'">
                  <CheckCircle2 v-if="project.status === '已完成'" class="w-3 h-3" />
                  <Clock v-else class="w-3 h-3" />
                  {{ project.status }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- List View (Placeholder) -->
        <div v-else class="rounded-3xl border overflow-hidden" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="p-12 text-center">
            <Layers class="w-12 h-12 mx-auto mb-4 opacity-20" style="color: var(--text-secondary)" />
            <p class="text-sm font-medium" style="color: var(--text-secondary)">列表视图正在构建中...</p>
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
  ChevronRight,
  X
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const projects = ref<any[]>([])
const isLoading = ref(false)

// Create Project related
const isAddDialogOpen = ref(false)
const newProject = ref({
  title: '',
  description: '',
  dueDate: '',
  color: 'bg-accent',
  tags: ''
})

const colors = [
  { name: '蓝色', value: 'bg-accent' },
  { name: '绿色', value: 'bg-emerald-500' },
  { name: '紫色', value: 'bg-purple-500' },
  { name: '橙色', value: 'bg-orange-500' },
  { name: '玫瑰色', value: 'bg-rose-500' },
]

const fetchProjects = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/projects')
    projects.value = response.data
  } catch (error) {
    ElMessage.error('获取项目失败')
  } finally {
    isLoading.value = false
  }
}

const handleAddProject = async () => {
  if (!newProject.value.title) return
  try {
    await api.post('/api/projects', newProject.value)
    ElMessage.success('项目已创建')
    isAddDialogOpen.value = false
    newProject.value = { title: '', description: '', dueDate: '', color: 'bg-accent', tags: '' }
    fetchProjects()
  } catch (error) {
    ElMessage.error('创建项目失败')
  }
}

const deleteProject = (id: string) => {
  ElMessageBox.confirm('确定要删除该项目吗？', '警告', { type: 'warning' }).then(async () => {
    try {
      await api.delete(`/api/projects/${id}`)
      ElMessage.success('项目已删除')
      fetchProjects()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

const filteredProjects = computed(() => {
  return projects.value.filter(project => {
    const tags = project.tags ? project.tags.toLowerCase() : ''
    return project.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           (project.description || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           tags.includes(searchQuery.value.toLowerCase())
  })
})

const getTagsList = (tags: string | null) => {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(t => t)
}

onMounted(fetchProjects)
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
        <button @click="isAddDialogOpen = true" class="bg-accent text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-lg shadow-accent/20 dark:shadow-none flex items-center gap-2">
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
        <span class="text-xs font-medium" style="color: var(--text-secondary)">当前显示 {{ filteredProjects.length }} 个活跃项目</span>
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
                  <p class="text-[10px] font-medium" style="color: var(--text-secondary)">最后更新: {{ new Date(project.updatedAt).toLocaleDateString() }}</p>
                </div>
              </div>
              <el-dropdown trigger="click">
                <button class="p-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-secondary)">
                  <MoreHorizontal class="w-4 h-4" />
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="deleteProject(project.id)" class="!text-rose-500">删除项目</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <p class="text-xs leading-relaxed mb-6 line-clamp-2" style="color: var(--text-secondary)">{{ project.description || '暂无描述' }}</p>

            <!-- Tags -->
            <div class="flex flex-wrap gap-1.5 mb-6">
              <span v-for="tag in getTagsList(project.tags)" :key="tag" class="text-[10px] font-bold px-2 py-0.5 border rounded-md"
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
                <img v-for="m in project.members" :key="m.user.email" :src="m.user.avatarUrl || `https://ui-avatars.com/api/?name=${m.user.name || m.user.email}`" :title="m.user.name || m.user.email" class="w-7 h-7 rounded-full border-2" style="border-color: var(--bg-card)" />
              </div>
              
              <div class="flex items-center gap-3">
                <div v-if="project.dueDate" class="flex items-center gap-1.5 text-[10px] font-bold" style="color: var(--text-secondary)">
                  <Calendar class="w-3.5 h-3.5" />
                  {{ new Date(project.dueDate).toLocaleDateString() }}
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

    <!-- Add Project Dialog -->
    <Transition name="fade">
      <div v-if="isAddDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="isAddDialogOpen = false"></div>
        <div class="relative w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6" style="background-color: var(--bg-card)">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">启动新项目</h3>
            <button @click="isAddDialogOpen = false" style="color: var(--text-secondary)"><X class="w-5 h-5" /></button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">项目标题</label>
              <input v-model="newProject.title" type="text" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" placeholder="给你的创意起个名字" />
            </div>
            
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">项目描述</label>
              <textarea v-model="newProject.description" rows="3" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none" placeholder="简述项目的目标和视觉风格..."></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">截止日期</label>
                <el-date-picker
                  v-model="newProject.dueDate"
                  type="date"
                  placeholder="选择日期"
                  class="!w-full !rounded-2xl custom-date-picker"
                />
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">主题颜色</label>
                <el-select v-model="newProject.color" class="!w-full !rounded-2xl custom-select">
                  <el-option v-for="c in colors" :key="c.value" :label="c.name" :value="c.value">
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full" :class="c.value"></div>
                      <span>{{ c.name }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">标签 (逗号分隔)</label>
              <input v-model="newProject.tags" type="text" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" placeholder="例如：室内, 写实, Blender" />
            </div>
          </div>

          <button 
            @click="handleAddProject"
            class="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all"
          >
            开始项目
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  padding: 0.75rem 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
}
.custom-select :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
}
</style>

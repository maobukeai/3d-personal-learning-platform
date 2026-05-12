<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import draggable from 'vuedraggable'
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  Trash2,
  X,
  ChevronRight
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/utils/api'

const tasks = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const isAddDialogOpen = ref(false)

const newTask = ref({
  title: '',
  description: '',
  status: 'TODO',
  dueDate: ''
})

const columns = ref([
  { id: 'TODO', title: '待办', color: 'bg-slate-500' },
  { id: 'IN_PROGRESS', title: '进行中', color: 'bg-accent' },
  { id: 'DONE', title: '已完成', color: 'bg-emerald-500' },
])

const fetchTasks = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/tasks')
    tasks.value = response.data
  } catch (error) {
    ElMessage.error('获取任务失败')
  } finally {
    isLoading.value = false
  }
}

const handleAddTask = async () => {
  if (!newTask.value.title) return
  try {
    await api.post('/api/tasks', newTask.value)
    ElMessage.success('任务已添加')
    isAddDialogOpen.value = false
    newTask.value = { title: '', description: '', status: 'TODO', dueDate: '' }
    fetchTasks()
  } catch (error) {
    ElMessage.error('添加任务失败')
  }
}

const onDragChange = async (event: any, newStatus: string) => {
  if (event.added) {
    const task = event.added.element
    try {
      await api.put(`/api/tasks/${task.id}`, { ...task, status: newStatus })
      ElMessage.success(`已移动到 ${newStatus === 'DONE' ? '已完成' : newStatus === 'IN_PROGRESS' ? '进行中' : '待办'}`)
      // Update local state to reflect the change immediately
      const taskIndex = tasks.value.findIndex(t => t.id === task.id)
      if (taskIndex !== -1) {
        tasks.value[taskIndex].status = newStatus
      }
    } catch (error) {
      ElMessage.error('更新状态失败')
      fetchTasks() // Revert local state on error
    }
  }
}

const openAddDialog = (status: string = 'TODO') => {
  newTask.value.status = status
  isAddDialogOpen.value = true
}

const deleteTask = (task: any) => {
  ElMessageBox.confirm('确定删除该任务吗？', '提示', { 
    type: 'warning',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消'
  }).then(async () => {
    try {
      await api.delete(`/api/tasks/${task.id}`)
      ElMessage.success('已删除')
      fetchTasks()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

onMounted(fetchTasks)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 px-8 flex items-center justify-between shrink-0 border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-accent/10 rounded-lg">
          <CheckCircle2 class="w-5 h-5 text-accent" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">任务看板</h1>
      </div>

      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索任务..." 
            class="pl-10 pr-4 py-2 bg-slate-100 dark:bg-white/5 border-none rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-64 transition-all"
            style="color: var(--text-primary)"
          />
        </div>
        <button 
          @click="openAddDialog('TODO')"
          class="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all">
          <Plus class="w-4 h-4" /> 新建任务
        </button>
      </div>
    </div>

    <!-- Board Content -->
    <div class="flex-1 overflow-x-auto p-8 scrollbar-hide">
      <div class="flex gap-6 h-full min-w-[900px]">
        <!-- Columns -->
        <div v-for="col in columns" :key="col.id" class="flex-1 flex flex-col min-w-[300px] h-full rounded-2xl p-4 transition-colors duration-300" style="background-color: var(--bg-card)">
          <div class="flex items-center justify-between mb-6 px-2">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full" :class="col.color"></div>
              <h2 class="text-sm font-black uppercase tracking-wider" style="color: var(--text-primary)">{{ col.title }}</h2>
              <span class="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded-md text-slate-500">
                {{ tasks.filter(t => t.status === col.id).length }}
              </span>
            </div>
            <button @click="openAddDialog(col.id)" class="text-slate-400 hover:text-accent transition-colors"><Plus class="w-4 h-4" /></button>
          </div>

          <!-- Draggable Task List -->
          <draggable 
            :list="tasks.filter(t => t.status === col.id)"
            group="tasks"
            item-key="id"
            class="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide min-h-[100px]"
            @change="(e: any) => onDragChange(e, col.id)"
            :animation="200"
            ghost-class="opacity-50"
          >
            <template #item="{ element: task }">
              <div 
                   class="group p-5 rounded-2xl border shadow-sm hover:shadow-md hover:border-accent/50 transition-all cursor-grab active:cursor-grabbing relative"
                   style="background-color: var(--bg-app); border-color: var(--border-base)">
                
                <div class="flex justify-between items-start mb-3">
                  <h3 class="text-sm font-bold leading-snug group-hover:text-accent transition-colors" style="color: var(--text-primary)">{{ task.title }}</h3>
                  <button @click.stop="deleteTask(task)" class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-all">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>

                <p class="text-xs mb-4 line-clamp-2" style="color: var(--text-secondary)">{{ task.description || '暂无描述' }}</p>

                <div class="flex items-center justify-between pt-4 border-t" style="border-color: var(--border-base)">
                  <div class="flex items-center gap-2 text-[10px] font-medium" :class="task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE' ? 'text-rose-500' : 'text-slate-400'">
                    <Calendar class="w-3 h-3" />
                    <span>{{ task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无截止日期' }}</span>
                  </div>
                </div>
              </div>
            </template>
            
            <template #header>
              <!-- Empty State for Column -->
              <div v-if="tasks.filter(t => t.status === col.id).length === 0" 
                   @click="openAddDialog(col.id)"
                   class="h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl opacity-20 hover:opacity-100 hover:border-accent hover:text-accent cursor-pointer transition-all" 
                   style="border-color: var(--border-base)">
                <Plus class="w-6 h-6 mb-2" />
                <p class="text-[10px] font-bold">拖拽或点击新建</p>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>

    <!-- Add Task Dialog -->
    <Transition name="fade">
      <div v-if="isAddDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="isAddDialogOpen = false"></div>
        <div class="relative w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6" style="background-color: var(--bg-card)">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">新建学习任务</h3>
            <button @click="isAddDialogOpen = false" style="color: var(--text-secondary)"><X class="w-5 h-5" /></button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1 text-slate-400">任务标题</label>
              <input v-model="newTask.title" type="text" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" placeholder="例如：学习 Blender 几何节点" />
            </div>
            
            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1 text-slate-400">详细描述 (可选)</label>
              <textarea v-model="newTask.description" rows="3" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none" placeholder="这次任务的目标是什么？"></textarea>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1 text-slate-400">截止日期</label>
              <el-date-picker
                v-model="newTask.dueDate"
                type="date"
                placeholder="选择截止日期"
                class="!w-full !rounded-2xl custom-date-picker"
                popper-class="custom-date-popper"
              />
            </div>
          </div>

          <button 
            @click="handleAddTask"
            class="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all"
          >
            创建任务
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 1.25rem !important;
  padding: 0.75rem 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
}
</style>

<style>
/* Global styles for the date picker popper since it's teleported to body */
.custom-date-popper {
  border-radius: 1.5rem !important;
  overflow: hidden !important;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
  border: 1px solid var(--border-base) !important;
}
.custom-date-popper .el-picker-panel {
  border-radius: 1.5rem !important;
  border: none !important;
}
.custom-date-popper .el-popper__arrow::before {
  border: 1px solid var(--border-base) !important;
}
</style>

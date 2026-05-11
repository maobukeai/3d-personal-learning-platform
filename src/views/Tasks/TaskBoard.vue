<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import draggable from 'vuedraggable'
import { useRoute } from 'vue-router'
import { Plus, MoreHorizontal, Calendar, Clock, Users, User, Filter, LayoutGrid, CheckCircle2, MessageSquare } from 'lucide-vue-next'

const route = useRoute()

interface Task {
  id: number
  title: string
  points: number
  tag: string
  tagColor: string
  priority: 'High' | 'Medium' | 'Low'
  assignee?: {
    name: string
    avatar: string
  }
  dueDate: string
}

interface Column {
  title: string
  tasks: Task[]
}

const activeView = ref<'personal' | 'team' | 'activity'>('personal')

const teamActivities = ref([
  { id: 1, user: 'Alex', action: '将任务', target: '学习 Blender 基础操作', status: '标记为已完成', time: '10分钟前', avatar: 'https://i.pravatar.cc/150?img=11' },
  { id: 2, user: 'Sarah', action: '在任务', target: '了解 PBR 材质节点原理', status: '下发表了评论', time: '1小时前', avatar: 'https://i.pravatar.cc/150?img=32' },
  { id: 3, user: 'David', action: '创建了新任务', target: '提交赛博朋克小巷场景初稿', status: '', time: '4小时前', avatar: 'https://i.pravatar.cc/150?img=12' },
  { id: 4, user: 'Alex', action: '更新了任务', target: '完成第一个甜甜圈模型', status: '的优先级', time: '昨天', avatar: 'https://i.pravatar.cc/150?img=11' },
])

const board = ref<Column[]>([
  {
    title: '待办 (To Do)',
    tasks: [
      { 
        id: 1, 
        title: '学习 Blender 基础操作与快捷键', 
        points: 3, 
        tag: '基础', 
        tagColor: 'text-accent bg-accent-subtle',
        priority: 'High',
        assignee: { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' },
        dueDate: '10月28日'
      },
      { 
        id: 2, 
        title: '完成第一个甜甜圈模型', 
        points: 5, 
        tag: '练习', 
        tagColor: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
        priority: 'Medium',
        assignee: { name: 'Sarah', avatar: 'https://i.pravatar.cc/150?img=32' },
        dueDate: '11月2日'
      }
    ]
  },
  {
    title: '进行中 (In Progress)',
    tasks: [
      { 
        id: 3, 
        title: '了解 PBR 材质节点原理', 
        points: 2, 
        tag: '理论', 
        tagColor: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
        priority: 'Medium',
        assignee: { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' },
        dueDate: '10月25日'
      }
    ]
  },
  {
    title: '待评审 (Review)',
    tasks: [
      { 
        id: 4, 
        title: '提交赛博朋克小巷场景初稿', 
        points: 8, 
        tag: '项目', 
        tagColor: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30',
        priority: 'High',
        assignee: { name: 'David', avatar: 'https://i.pravatar.cc/150?img=12' },
        dueDate: '10月30日'
      }
    ]
  },
  {
    title: '已完成 (Done)',
    tasks: [
      { 
        id: 5, 
        title: '安装并配置开发环境', 
        points: 1, 
        tag: '设置', 
        tagColor: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/10',
        priority: 'Low',
        assignee: { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' },
        dueDate: '10月20日'
      }
    ]
  }
])

const priorityColors = {
  High: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  Medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  Low: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
}

const showCreateModal = ref(false)
const showDetailModal = ref(false)
const selectedTask = ref<Task | null>(null)

const newTaskForm = ref({
  title: '',
  priority: 'Medium' as 'High' | 'Medium' | 'Low',
  tag: '练习',
  dueDate: '',
  assignee: 'Alex'
})

const teamMembers = [
  { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' },
  { name: 'Sarah', avatar: 'https://i.pravatar.cc/150?img=32' },
  { name: 'David', avatar: 'https://i.pravatar.cc/150?img=12' },
]

const handleOpenDetail = (task: Task) => {
  selectedTask.value = task
  showDetailModal.value = true
}

const handleCreateTask = () => {
  const assignee = teamMembers.find(m => m.name === newTaskForm.value.assignee)
  const task: Task = {
    id: Date.now(),
    title: newTaskForm.value.title,
    points: 5,
    tag: newTaskForm.value.tag,
    tagColor: 'text-accent bg-accent-subtle',
    priority: newTaskForm.value.priority,
    assignee: assignee,
    dueDate: newTaskForm.value.dueDate || '11月30日'
  }
  
  board.value[0].tasks.push(task)
  showCreateModal.value = false
  newTaskForm.value = { title: '', priority: 'Medium', tag: '练习', dueDate: '', assignee: 'Alex' }
}

onMounted(() => {
  if (route.query.view === 'activity') {
    activeView.value = 'activity'
  }
})

watch(() => route.query.view, (newView) => {
  if (newView === 'activity') {
    activeView.value = 'activity'
  } else if (newView === 'team') {
    activeView.value = 'team'
  } else {
    activeView.value = 'personal'
  }
})
</script>

<template>
  <div class="flex flex-col h-full transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="px-6 border-b shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-semibold" style="color: var(--text-primary)">学习计划看板</h1>
          <div class="flex items-center p-1 rounded-lg ml-4" style="background-color: var(--bg-app)">
            <button 
              @click="activeView = 'personal'"
              class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :style="activeView === 'personal' ? 'background-color: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm)' : 'color: var(--text-secondary)'"
            >
              <User class="w-3.5 h-3.5" /> 个人计划
            </button>
            <button 
              @click="activeView = 'team'"
              class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :style="activeView === 'team' ? 'background-color: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm)' : 'color: var(--text-secondary)'"
            >
              <Users class="w-3.5 h-3.5" /> 团队协作
            </button>
            <button 
              @click="activeView = 'activity'"
              class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :style="activeView === 'activity' ? 'background-color: var(--bg-card); color: var(--text-primary); box-shadow: var(--shadow-sm)' : 'color: var(--text-secondary)'"
            >
              <Clock class="w-3.5 h-3.5" /> 团队动态
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button class="p-2 transition-colors rounded-md" style="color: var(--text-muted)" hover-class="bg-slate-100 dark:bg-white/10">
            <Filter class="w-4 h-4" />
          </button>
          <button 
            @click="showCreateModal = true"
            class="bg-accent hover:bg-accent text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-accent/20"
          >
            <Plus class="w-4 h-4" /> 新建任务
          </button>
        </div>
      </div>
      
      <!-- Sub Header / Breadcrumb -->
      <div class="h-10 flex items-center gap-4 text-xs border-t transition-colors duration-300" style="color: var(--text-secondary); border-color: var(--border-base)">
        <span class="flex items-center gap-1.5"><LayoutGrid class="w-3.5 h-3.5" /> {{ activeView === 'activity' ? '动态流视图' : '看板视图' }}</span>
        <span class="w-px h-3 transition-colors duration-300" style="background-color: var(--border-base)"></span>
        <span>当前显示: {{ activeView === 'personal' ? '我的所有学习任务' : activeView === 'team' ? 'Alpha 团队的共同进度' : '团队成员的实时动态' }}</span>
      </div>
    </div>

    <!-- Board Area -->
    <div v-if="activeView !== 'activity'" class="flex-1 overflow-x-auto p-6 scrollbar-hide">
      <div class="flex gap-6 h-full items-start">
        <!-- Column -->
        <div v-for="(col, index) in board" :key="index" class="w-80 shrink-0 flex flex-col max-h-full">
          <div class="flex items-center justify-between mb-4 px-1">
            <h3 class="font-medium flex items-center gap-2" style="color: var(--text-primary)">
              {{ col.title }}
              <span class="text-xs py-0.5 px-2 rounded-full transition-colors duration-300" style="background-color: var(--bg-app); color: var(--text-secondary)">{{ col.tasks.length }}</span>
            </h3>
            <button class="hover:text-accent transition-colors" style="color: var(--text-muted)">
              <MoreHorizontal class="w-4 h-4" />
            </button>
          </div>
          
          <div class="flex-1 overflow-y-auto">
            <draggable 
              v-model="col.tasks" 
              group="tasks" 
              item-key="id"
              class="min-h-[150px] space-y-3 pb-4"
              ghost-class="opacity-50"
              drag-class="rotate-2 scale-105 transition-transform"
            >
              <template #item="{ element }">
                <div 
                  @click="handleOpenDetail(element)"
                  class="p-4 rounded-2xl shadow-sm border cursor-grab active:cursor-grabbing hover:border-accent hover:shadow-md transition-all group"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                >
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex gap-1.5">
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm" :class="element.tagColor">
                        {{ element.tag }}
                      </span>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-sm" :class="priorityColors[element.priority]">
                        {{ element.priority }}
                      </span>
                    </div>
                    <button class="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal class="w-4 h-4" style="color: var(--text-muted)" />
                    </button>
                  </div>
                  
                  <h4 class="text-sm font-medium mb-4 leading-snug" style="color: var(--text-primary)">{{ element.title }}</h4>
                  
                  <div class="flex items-center justify-between" style="color: var(--text-muted)">
                    <div class="flex items-center gap-2 text-[11px] px-2 py-1 rounded-md transition-colors duration-300" style="background-color: var(--bg-app)">
                      <Calendar class="w-3 h-3" />
                      <span>{{ element.dueDate }}</span>
                    </div>
                    
                    <div class="flex items-center -space-x-1.5">
                      <el-tooltip :content="element.assignee?.name" placement="top">
                        <img :src="element.assignee?.avatar" class="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900" :alt="element.assignee?.name" />
                      </el-tooltip>
                      <div v-if="activeView === 'team'" class="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] cursor-pointer transition-colors duration-300" style="background-color: var(--bg-app); color: var(--text-secondary)" hover-class="bg-slate-200 dark:bg-white/10">
                        <Plus class="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </draggable>
          </div>
          
          <button class="mt-2 w-full py-2 flex items-center justify-center gap-2 rounded-lg transition-colors text-sm font-medium" style="color: var(--text-secondary)" hover-class="bg-slate-100 dark:bg-white/5">
            <Plus class="w-4 h-4" /> 添加卡片
          </button>
        </div>
      </div>
    </div>

    <!-- Activity Area -->
    <div v-else class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-3xl mx-auto space-y-6">
        <div v-for="activity in teamActivities" :key="activity.id" class="flex gap-6 relative last:after:hidden after:absolute after:left-[24px] after:top-[48px] after:bottom-[-24px] after:w-px after:transition-colors after:duration-300" :class="['after:bg-slate-100 dark:after:bg-slate-800']">
          <div class="relative z-10 shrink-0">
            <img :src="activity.avatar" class="w-12 h-12 rounded-2xl border-4 border-white dark:border-slate-900 shadow-sm object-cover" />
            <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent border-2 border-white dark:border-slate-900 flex items-center justify-center">
              <Plus v-if="activity.action.includes('创建')" class="w-2.5 h-2.5 text-white" />
              <CheckCircle2 v-else-if="activity.status.includes('已完成')" class="w-2.5 h-2.5 text-white" />
              <MessageSquare v-else-if="activity.action.includes('评论')" class="w-2.5 h-2.5 text-white" />
              <Clock v-else class="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          
          <div class="flex-1 p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-bold" style="color: var(--text-primary)">{{ activity.user }}</span>
              <span class="text-[11px] font-medium" style="color: var(--text-muted)">{{ activity.time }}</span>
            </div>
            <p class="text-sm leading-relaxed" style="color: var(--text-secondary)">
              {{ activity.action }} 
              <span class="font-bold text-accent hover:underline cursor-pointer">#{{ activity.target }}</span>
              {{ activity.status }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Task Dialog -->
  <el-dialog v-model="showCreateModal" title="新建学习任务" width="500px" class="custom-rounded-dialog">
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">任务标题</label>
        <el-input v-model="newTaskForm.title" placeholder="例如：制作一个低多边形树木模型..." />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">优先级</label>
          <el-select v-model="newTaskForm.priority" class="w-full">
            <el-option label="高 (High)" value="High" />
            <el-option label="中 (Medium)" value="Medium" />
            <el-option label="低 (Low)" value="Low" />
          </el-select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">指派给</label>
          <el-select v-model="newTaskForm.assignee" class="w-full">
            <el-option v-for="m in teamMembers" :key="m.name" :label="m.name" :value="m.name" />
          </el-select>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">截止日期</label>
        <el-date-picker v-model="newTaskForm.dueDate" type="date" placeholder="选择日期" class="!w-full" format="MM月DD日" value-format="MM月DD日" />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-3">
        <el-button @click="showCreateModal = false">取消</el-button>
        <el-button type="primary" class="bg-accent border-none" @click="handleCreateTask">创建任务</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- Task Detail Dialog -->
  <el-dialog v-model="showDetailModal" :title="selectedTask?.title" width="650px" class="custom-rounded-dialog">
    <div class="flex gap-8 p-1">
      <!-- Left: Details -->
      <div class="flex-1 space-y-6">
        <div>
          <h4 class="text-xs font-bold uppercase mb-3 tracking-wider" style="color: var(--text-muted)">任务描述</h4>
          <p class="text-sm leading-relaxed" style="color: var(--text-secondary)">
            这是关于 {{ selectedTask?.title }} 的详细学习计划。你需要查阅相关文档，并在 Blender 中完成实际练习，最后将生成的 GLB 文件上传到资产库进行评审。
          </p>
        </div>
        
        <div>
          <h4 class="text-xs font-bold uppercase mb-3 tracking-wider" style="color: var(--text-muted)">子任务清单</h4>
          <div class="space-y-2">
            <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors group/sub">
              <el-checkbox />
              <span class="text-sm" style="color: var(--text-primary)">步骤 {{ i }}: 完成初步概念设计与草图绘制</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase mb-3 tracking-wider" style="color: var(--text-muted)">团队评论 (2)</h4>
          <div class="space-y-4">
            <div class="flex gap-3">
              <img src="https://i.pravatar.cc/150?img=32" class="w-8 h-8 rounded-full shrink-0" />
              <div class="p-3 rounded-2xl flex-1 transition-colors duration-300" style="background-color: var(--bg-app)">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-bold" style="color: var(--text-primary)">Sarah</span>
                  <span class="text-[10px]" style="color: var(--text-muted)">1小时前</span>
                </div>
                <p class="text-xs" style="color: var(--text-secondary)">加油！如果材质节点调整不出来可以参考我之前的分享贴。</p>
              </div>
            </div>
          </div>
          <div class="mt-4 flex gap-3">
            <img src="https://i.pravatar.cc/150?img=11" class="w-8 h-8 rounded-full shrink-0" />
            <el-input placeholder="写下你的想法 or 提问..." size="small" />
          </div>
        </div>
      </div>

      <!-- Right: Meta -->
      <div class="w-48 space-y-6">
        <div class="p-4 rounded-2xl space-y-4 border transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <div>
            <p class="text-[10px] font-bold uppercase mb-1.5" style="color: var(--text-muted)">负责人</p>
            <div class="flex items-center gap-2">
              <img :src="selectedTask?.assignee?.avatar" class="w-6 h-6 rounded-full" />
              <span class="text-xs font-bold" style="color: var(--text-primary)">{{ selectedTask?.assignee?.name }}</span>
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase mb-1.5" style="color: var(--text-muted)">截止日期</p>
            <div class="flex items-center gap-2 text-xs font-bold" style="color: var(--text-primary)">
              <Calendar class="w-3.5 h-3.5" style="color: var(--text-muted)" />
              {{ selectedTask?.dueDate }}
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase mb-1.5" style="color: var(--text-muted)">优先级</p>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded" :class="selectedTask ? priorityColors[selectedTask.priority] : ''">
              {{ selectedTask?.priority }}
            </span>
          </div>
        </div>
        
        <button class="w-full py-2.5 bg-accent text-white rounded-2xl text-xs font-bold shadow-md shadow-accent/20 hover:bg-accent transition-all">
          标记为已完成
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

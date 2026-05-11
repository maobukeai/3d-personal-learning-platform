<script setup lang="ts">
import { ref } from 'vue'
import draggable from 'vuedraggable'
import { Plus, MoreHorizontal, Calendar, Clock, Users, User, Filter, LayoutGrid } from 'lucide-vue-next'

interface Task {
  id: number
  title: string
  points: number
  tag: string
  tagColor: string
  priority: 'High' | 'Medium' | 'Low'
  assignee?: { name: string; avatar: string }
  dueDate: string
}

interface Column {
  title: string
  tasks: Task[]
}

const activeView = ref<'personal' | 'team'>('personal')

const board = ref<Column[]>([
  {
    title: '待办 (To Do)',
    tasks: [
      { 
        id: 1, 
        title: '学习 Blender 基础操作与快捷键', 
        points: 3, 
        tag: '基础', 
        tagColor: 'text-blue-600 bg-blue-100',
        priority: 'High',
        assignee: { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' },
        dueDate: '10月28日'
      },
      { 
        id: 2, 
        title: '完成第一个甜甜圈模型', 
        points: 5, 
        tag: '练习', 
        tagColor: 'text-orange-600 bg-orange-100',
        priority: 'Medium',
        assignee: { name: 'Sarah', avatar: 'https://i.pravatar.cc/150?img=32' },
        dueDate: '11月02日'
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
        tagColor: 'text-purple-600 bg-purple-100',
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
        tagColor: 'text-rose-600 bg-rose-100',
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
        tagColor: 'text-slate-600 bg-slate-100',
        priority: 'Low',
        assignee: { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=11' },
        dueDate: '10月20日'
      }
    ]
  }
])

const priorityColors = {
  High: 'text-red-600 bg-red-50',
  Medium: 'text-amber-600 bg-amber-50',
  Low: 'text-emerald-600 bg-emerald-50'
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
    tagColor: 'text-blue-600 bg-blue-100',
    priority: newTaskForm.value.priority,
    assignee: assignee,
    dueDate: newTaskForm.value.dueDate || '11月10日'
  }
  
  board.value[0].tasks.push(task)
  showCreateModal.value = false
  newTaskForm.value = { title: '', priority: 'Medium', tag: '练习', dueDate: '', assignee: 'Alex' }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8fafc]">
    <!-- Header -->
    <div class="px-6 bg-white border-b border-slate-200 shrink-0">
      <div class="h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-semibold text-slate-800">学习计划看板</h1>
          <div class="flex items-center bg-slate-100 p-1 rounded-lg ml-4">
            <button 
              @click="activeView = 'personal'"
              class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :class="activeView === 'personal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
            >
              <User class="w-3.5 h-3.5" /> 个人计划
            </button>
            <button 
              @click="activeView = 'team'"
              class="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              :class="activeView === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
            >
              <Users class="w-3.5 h-3.5" /> 团队协作
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
            <Filter class="w-4 h-4" />
          </button>
          <button 
            @click="showCreateModal = true"
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus class="w-4 h-4" /> 新建任务
          </button>
        </div>
      </div>
      
      <!-- Sub Header / Breadcrumb -->
      <div class="h-10 flex items-center gap-4 text-xs text-slate-500 border-t border-slate-50">
        <span class="flex items-center gap-1.5"><LayoutGrid class="w-3.5 h-3.5" /> 看板视图</span>
        <span class="w-px h-3 bg-slate-200"></span>
        <span>当前显示: {{ activeView === 'personal' ? '我的所有学习任务' : 'Team Alpha 的共同进度' }}</span>
      </div>
    </div>

    <!-- Board Area -->
    <div class="flex-1 overflow-x-auto p-6 scrollbar-hide">
      <div class="flex gap-6 h-full items-start">
        <!-- Column -->
        <div v-for="(col, index) in board" :key="index" class="w-80 shrink-0 flex flex-col max-h-full">
          <div class="flex items-center justify-between mb-4 px-1">
            <h3 class="font-medium text-slate-700 flex items-center gap-2">
              {{ col.title }}
              <span class="bg-slate-200 text-slate-600 text-xs py-0.5 px-2 rounded-full">{{ col.tasks.length }}</span>
            </h3>
            <button class="text-slate-400 hover:text-slate-600">
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
                  class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-md transition-all group"
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
                      <MoreHorizontal class="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                  
                  <h4 class="text-slate-800 text-sm font-medium mb-4 leading-snug">{{ element.title }}</h4>
                  
                  <div class="flex items-center justify-between text-slate-400">
                    <div class="flex items-center gap-2 text-[11px] bg-slate-50 px-2 py-1 rounded-md">
                      <Calendar class="w-3 h-3" />
                      <span>{{ element.dueDate }}</span>
                    </div>
                    
                    <div class="flex items-center -space-x-1.5">
                      <el-tooltip :content="element.assignee?.name" placement="top">
                        <img :src="element.assignee?.avatar" class="w-6 h-6 rounded-full border-2 border-white" :alt="element.assignee?.name" />
                      </el-tooltip>
                      <div v-if="activeView === 'team'" class="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors">
                        <Plus class="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </draggable>
          </div>
          
          <button class="mt-2 w-full py-2 flex items-center justify-center gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium">
            <Plus class="w-4 h-4" /> 添加卡片
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Task Dialog -->
  <el-dialog v-model="showCreateModal" title="新建学习任务" width="500px" class="rounded-2xl">
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">任务标题</label>
        <el-input v-model="newTaskForm.title" placeholder="例如：制作一个低多边形树木模型..." />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">优先级</label>
          <el-select v-model="newTaskForm.priority" class="w-full">
            <el-option label="高 (High)" value="High" />
            <el-option label="中 (Medium)" value="Medium" />
            <el-option label="低 (Low)" value="Low" />
          </el-select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">指派给</label>
          <el-select v-model="newTaskForm.assignee" class="w-full">
            <el-option v-for="m in teamMembers" :key="m.name" :label="m.name" :value="m.name" />
          </el-select>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">截止日期</label>
        <el-date-picker v-model="newTaskForm.dueDate" type="date" placeholder="选择日期" class="!w-full" format="MM月DD日" value-format="MM月DD日" />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-3">
        <el-button @click="showCreateModal = false">取消</el-button>
        <el-button type="primary" class="bg-blue-600" @click="handleCreateTask">创建任务</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- Task Detail Dialog -->
  <el-dialog v-model="showDetailModal" :title="selectedTask?.title" width="650px" class="rounded-2xl overflow-hidden">
    <div class="flex gap-8 p-1">
      <!-- Left: Details -->
      <div class="flex-1 space-y-6">
        <div>
          <h4 class="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">任务描述</h4>
          <p class="text-sm text-slate-600 leading-relaxed">
            这是关于 {{ selectedTask?.title }} 的详细学习计划。你需要查阅相关文档，并在 Blender 中完成实际练习，最后将生成的 GLB 文件上传到资产库进行评审。
          </p>
        </div>
        
        <div>
          <h4 class="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">子任务清单</h4>
          <div class="space-y-2">
            <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group/sub">
              <el-checkbox />
              <span class="text-sm text-slate-700">步骤 {{ i }}: 完成初步概念设计与草图绘制</span>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">团队评论 (2)</h4>
          <div class="space-y-4">
            <div class="flex gap-3">
              <img src="https://i.pravatar.cc/150?img=32" class="w-8 h-8 rounded-full shrink-0" />
              <div class="bg-slate-50 p-3 rounded-xl flex-1">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-bold text-slate-800">Sarah</span>
                  <span class="text-[10px] text-slate-400">1小时前</span>
                </div>
                <p class="text-xs text-slate-600">加油！如果材质节点调整不出来可以参考我之前的分享贴。</p>
              </div>
            </div>
          </div>
          <div class="mt-4 flex gap-3">
            <img src="https://i.pravatar.cc/150?img=11" class="w-8 h-8 rounded-full shrink-0" />
            <el-input placeholder="写下你的想法或提问..." size="small" />
          </div>
        </div>
      </div>

      <!-- Right: Meta -->
      <div class="w-48 space-y-6">
        <div class="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase mb-1.5">负责人</p>
            <div class="flex items-center gap-2">
              <img :src="selectedTask?.assignee?.avatar" class="w-6 h-6 rounded-full" />
              <span class="text-xs font-bold text-slate-700">{{ selectedTask?.assignee?.name }}</span>
            </div>
          </div>
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase mb-1.5">截止日期</p>
            <div class="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Calendar class="w-3.5 h-3.5 text-slate-400" />
              {{ selectedTask?.dueDate }}
            </div>
          </div>
          <div>
            <p class="text-[10px] text-slate-400 font-bold uppercase mb-1.5">优先级</p>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded" :class="selectedTask ? priorityColors[selectedTask.priority] : ''">
              {{ selectedTask?.priority }}
            </span>
          </div>
        </div>
        
        <button class="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-100 hover:bg-blue-700 transition-all">
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

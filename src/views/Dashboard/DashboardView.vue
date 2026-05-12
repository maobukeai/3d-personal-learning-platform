<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Users, 
  Box, 
  MessageSquare,
  TrendingUp,
  Calendar,
  Layout,
  Plus
} from 'lucide-vue-next'
import api from '@/utils/api'

const router = useRouter()

const stats = ref([
  { label: '整体学习进度', value: '0%', trend: '+5%', color: 'text-accent', icon: TrendingUp },
  { label: '待办学习任务', value: '0', trend: '-2', color: 'text-amber-600', icon: Calendar },
  { label: '资产库作品', value: '0', trend: '0', color: 'text-emerald-600', icon: Box },
  { label: '反馈记录', value: '0', trend: '0', color: 'text-purple-600', icon: MessageSquare },
])

const activeEnrollment = ref<any>(null)
const activityLog = ref<any[]>([])
const recentAssets = ref<any[]>([])
const recentTasks = ref<any[]>([])

const fetchDashboardData = async () => {
  try {
    const [statsRes, enrollmentsRes, activityRes, assetsRes, tasksRes] = await Promise.all([
      api.get('/api/auth/stats'),
      api.get('/api/courses/my-enrollments'),
      api.get('/api/auth/activity'),
      api.get('/api/assets/public'),
      api.get('/api/tasks')
    ])
    
    const data = statsRes.data
    stats.value[0].value = data.learningProgress
    stats.value[1].value = data.taskCount.toString()
    stats.value[2].value = data.assetCount.toString()
    stats.value[3].value = data.feedbackCount.toString()

    if (enrollmentsRes.data.length > 0) {
      activeEnrollment.value = enrollmentsRes.data[0]
    }

    activityLog.value = activityRes.data
    recentAssets.value = (assetsRes.data.assets || []).slice(0, 2)
    recentTasks.value = tasksRes.data.slice(0, 3)
  } catch (error) {
    console.error('Fetch dashboard data error:', error)
  }
}

const formatTime = (date: string) => {
  const now = new Date()
  const then = new Date(date)
  const diff = now.getTime() - then.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return then.toLocaleDateString()
}

onMounted(() => {
  fetchDashboardData()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Dashboard Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">工作台概览</h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">欢迎回来，今天准备学习什么新技能？</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <Calendar class="w-4 h-4 text-slate-400" />
          <span class="text-xs font-bold" style="color: var(--text-secondary)">{{ new Date().toLocaleDateString() }}</span>
        </div>
        <button @click="router.push('/tasks')" class="p-2.5 bg-accent text-white rounded-xl shadow-lg shadow-accent/20 hover:scale-105 transition-all">
          <Plus class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Main Content Scroll Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto space-y-8">
        
        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="stat in stats" :key="stat.label" class="p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md" style="background-color: var(--bg-card); border-color: var(--border-base)">
            <div class="flex items-start justify-between mb-4">
              <div class="p-3 rounded-2xl bg-slate-50 dark:bg-white/5" :class="stat.color">
                <component :is="stat.icon" class="w-6 h-6" />
              </div>
              <span class="text-[10px] font-black px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">{{ stat.trend }}</span>
            </div>
            <p class="text-xs font-bold uppercase tracking-wider mb-1" style="color: var(--text-muted)">{{ stat.label }}</p>
            <h2 class="text-3xl font-black" style="color: var(--text-primary)">{{ stat.value }}</h2>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Left Column: Tasks & Assets -->
          <div class="lg:col-span-2 space-y-8">
            
            <!-- Active Learning Card -->
            <div v-if="activeEnrollment" class="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl group cursor-pointer" 
                 style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%)">
               <div class="relative z-10">
                 <div class="flex items-center gap-2 mb-4">
                   <div class="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                     <BookOpen class="w-4 h-4" />
                   </div>
                   <span class="text-[10px] font-bold uppercase tracking-widest opacity-80">继续学习</span>
                 </div>
                 <h2 class="text-2xl font-black mb-2">{{ activeEnrollment.course.title }}</h2>
                 <p class="text-sm opacity-80 mb-8 max-w-md">还剩下 {{ activeEnrollment.course._count.lessons }} 个章节，保持专注！</p>
                 <button @click="router.push(`/academy/player/${activeEnrollment.courseId}`)" class="px-6 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-xs shadow-xl hover:scale-105 transition-all">开始学习</button>
               </div>
               <div class="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform duration-700">
                 <Layout class="w-64 h-64 -mb-10 -mr-10" />
               </div>
            </div>

            <!-- Recent Tasks -->
            <div class="p-8 rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <div class="flex items-center justify-between mb-8">
                <h3 class="font-bold text-lg" style="color: var(--text-primary)">待办学习任务</h3>
                <button @click="router.push('/tasks')" class="text-xs font-bold text-accent hover:underline">查看全部任务</button>
              </div>
              <div class="space-y-4">
                <div v-for="task in recentTasks" :key="task.id" class="flex items-center justify-between p-4 rounded-2xl border transition-all hover:bg-slate-50 dark:hover:bg-white/5" style="border-color: var(--border-base)">
                  <div class="flex items-center gap-4">
                    <div class="w-2 h-2 rounded-full" :class="task.status === 'IN_PROGRESS' ? 'bg-accent' : task.status === 'DONE' ? 'bg-emerald-500' : 'bg-slate-300'"></div>
                    <div>
                      <p class="text-sm font-bold" style="color: var(--text-primary)">{{ task.title }}</p>
                      <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">截止于: {{ task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无' }}</p>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg" style="background-color: var(--bg-app); color: var(--text-secondary)">{{ task.status }}</span>
                </div>
                <div v-if="recentTasks.length === 0" class="py-12 text-center text-slate-400">
                   <p class="text-sm font-bold">暂无近期任务</p>
                </div>
              </div>
            </div>

            <!-- Recent Assets -->
            <div class="space-y-4">
              <div class="flex items-center justify-between px-1">
                <h3 class="font-bold text-lg" style="color: var(--text-primary)">最新创作资产</h3>
                <button @click="router.push('/my-works')" class="text-xs font-bold text-accent hover:underline">管理作品集</button>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div v-for="asset in recentAssets" :key="asset.id" @click="router.push('/assets')" class="group p-4 rounded-3xl border shadow-sm hover:shadow-md transition-all flex items-center gap-4 cursor-pointer" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <div class="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center p-1 shrink-0 bg-slate-50 dark:bg-white/5">
                    <img :src="asset.thumbnail || '/asset_sofa.png'" class="w-full h-full object-cover rounded-xl group-hover:scale-110 transition-transform" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold truncate" style="color: var(--text-primary)">{{ asset.title }}</p>
                    <span class="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded mt-1 inline-block">{{ asset.type }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Community & Feed -->
          <div class="space-y-8">
            
            <!-- Activity Feed -->
            <div class="rounded-3xl border shadow-sm overflow-hidden" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <div class="p-6 border-b flex items-center justify-between" style="border-color: var(--border-base)">
                <h3 class="font-bold" style="color: var(--text-primary)">团队动态</h3>
                <span class="text-[9px] font-black uppercase text-emerald-500 animate-pulse">实时</span>
              </div>
              <div class="p-6 space-y-6">
                <div v-for="log in activityLog" :key="log.id" class="flex gap-4">
                  <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 border-2 border-white dark:border-slate-800 shadow-sm overflow-hidden shrink-0">
                    <img :src="`https://ui-avatars.com/api/?name=${log.user}`" class="w-full h-full" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs leading-relaxed" style="color: var(--text-secondary)">
                      <span class="font-bold" style="color: var(--text-primary)">{{ log.user }}</span> 
                      {{ log.action }} 
                      <span class="text-accent font-bold">#{{ log.target }}</span>
                    </p>
                    <p class="text-[10px] mt-1" style="color: var(--text-muted)">{{ formatTime(log.createdAt) }}</p>
                  </div>
                </div>
              </div>
              <button @click="router.push('/community')" class="w-full py-4 text-xs font-bold border-t transition-colors hover:bg-slate-50 dark:hover:bg-white/5" style="color: var(--text-secondary); border-color: var(--border-base)">
                进入社区交流
              </button>
            </div>

            <!-- Collaboration Invite -->
            <div class="p-8 rounded-3xl border shadow-sm bg-gradient-to-br from-indigo-500/5 to-purple-500/5" style="background-color: var(--bg-card); border-color: var(--border-base)">
              <div class="flex items-center gap-3 mb-4">
                <div class="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <Users class="w-4 h-4 text-indigo-600" />
                </div>
                <h3 class="font-bold" style="color: var(--text-primary)">团队协作</h3>
              </div>
              <p class="text-xs leading-relaxed mb-6" style="color: var(--text-secondary)">加入一个兴趣小组，与志同道合的伙伴一起完成大型渲染项目。</p>
              <div class="flex -space-x-2 mb-8">
                 <img v-for="i in 4" :key="i" :src="`https://i.pravatar.cc/150?img=${i+30}`" class="w-8 h-8 rounded-full border-2" style="border-color: var(--bg-card)" />
                 <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-secondary)">+5</div>
              </div>
              <button @click="router.push('/members')" class="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-transform hover:scale-[1.02]">
                寻找团队伙伴
              </button>
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
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { 
  LayoutDashboard, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Users, 
  Box, 
  MessageSquare,
  TrendingUp,
  Calendar
} from 'lucide-vue-next'

const stats = [
  { label: '学习路线进度', value: '32%', trend: '+5%', color: 'text-blue-600', icon: TrendingUp },
  { label: '待办任务', value: '12', trend: '-2', color: 'text-orange-600', icon: CheckCircle2 },
  { label: '资产库作品', value: '24', trend: '+3', color: 'text-emerald-600', icon: Box },
  { label: '社区互动', value: '156', trend: '+12', color: 'text-purple-600', icon: MessageSquare },
]

const recentTasks = [
  { id: 1, title: '完成 Blender 甜甜圈材质节点', status: '进行中', time: '2小时前' },
  { id: 2, title: '提交赛博朋克小巷场景初稿', status: '待评审', time: '昨天' },
  { id: 3, title: '学习 PBR 物理渲染原理', status: '待办', time: '3天前' },
]

const recentAssets = [
  { id: 1, title: '赛博朋克霓虹灯', image: '/asset_sofa.png', format: 'GLB' },
  { id: 2, title: '室内绿植组合', image: '/asset_plant.png', format: 'GLB' },
]

const activityLog = [
  { id: 1, user: 'Alex', action: '上传了新资产', target: '写实沙发模型', time: '10分钟前' },
  { id: 2, user: 'Sarah', action: '回答了你的问题', target: '如何处理法线反转？', time: '1小时前' },
  { id: 3, user: 'David', action: '完成了学习阶段', target: '基础建模技术', time: '4小时前' },
]

const selectedDate = ref('2026-05-11')
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-[#f8fafc] p-8 scrollbar-hide">
    <div class="max-w-7xl mx-auto space-y-8">
      
      <!-- Welcome Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">欢迎回来，设计师！👋</h1>
          <p class="text-slate-500 text-sm mt-1">今天是你连续学习的第 12 天，保持住！</p>
        </div>
        <div class="relative dashboard-date-picker">
          <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择日期"
            format="YYYY年MM月DD日"
            value-format="YYYY-MM-DD"
            :clearable="false"
            class="!absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <div class="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
            <Calendar class="w-4 h-4 text-blue-600" />
            <span class="text-xs font-bold text-slate-700">{{ selectedDate.replace(/-/g, '年').replace(/年(\d{2})年/, '年$1月') + '日' }}</span>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div v-for="stat in stats" :key="stat.label" class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-4">
            <div class="p-2 bg-slate-50 rounded-lg">
              <component :is="stat.icon" class="w-5 h-5 text-slate-600" />
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="stat.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'">
              {{ stat.trend }}
            </span>
          </div>
          <p class="text-xs font-medium text-slate-400 mb-1">{{ stat.label }}</p>
          <p class="text-2xl font-bold text-slate-800">{{ stat.value }}</p>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Left Column: Tasks & Progress -->
        <div class="lg:col-span-2 space-y-8">
          
          <!-- Continue Learning -->
          <div class="bg-blue-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg shadow-blue-200">
            <div class="relative z-10">
              <h2 class="text-lg font-bold mb-2">继续学习：Blender 进阶渲染</h2>
              <p class="text-blue-100 text-sm mb-6 opacity-80">当前进度：3D 焦散效果实战 (第 4/12 课)</p>
              <button class="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-50 transition-colors flex items-center gap-2">
                立即开始 <ArrowUpRight class="w-3.5 h-3.5" />
              </button>
            </div>
            <Box class="absolute -right-10 -bottom-10 w-48 h-48 text-white/10 rotate-12" />
          </div>

          <!-- Recent Tasks -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 class="font-bold text-slate-800">近期任务</h3>
              <button class="text-xs font-bold text-blue-600 hover:underline">查看全部</button>
            </div>
            <div class="divide-y divide-slate-50">
              <div v-for="task in recentTasks" :key="task.id" class="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                <div class="flex items-center gap-4">
                  <div class="w-2 h-2 rounded-full" :class="task.status === '进行中' ? 'bg-blue-500' : task.status === '待评审' ? 'bg-orange-500' : 'bg-slate-300'"></div>
                  <div>
                    <p class="text-sm font-medium text-slate-700">{{ task.title }}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">{{ task.time }}</p>
                  </div>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">{{ task.status }}</span>
              </div>
            </div>
          </div>

          <!-- Recent Assets (3D Highlights) -->
          <div class="space-y-4">
            <div class="flex items-center justify-between px-1">
              <h3 class="font-bold text-slate-800">最新创作资产</h3>
              <button class="text-xs font-bold text-slate-400 hover:text-slate-600">管理作品集</button>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div v-for="asset in recentAssets" :key="asset.id" class="group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                <div class="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center p-2 shrink-0">
                  <img :src="asset.image" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-700 truncate">{{ asset.title }}</p>
                  <span class="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{{ asset.format }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Community & Feed -->
        <div class="space-y-8">
          
          <!-- Activity Feed -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-6 border-b border-slate-50">
              <h3 class="font-bold text-slate-800">团队动态</h3>
            </div>
            <div class="p-6 space-y-6">
              <div v-for="log in activityLog" :key="log.id" class="flex gap-4 relative last:after:hidden after:absolute after:left-[15px] after:top-[34px] after:bottom-[-26px] after:w-px after:bg-slate-100">
                <img :src="`https://i.pravatar.cc/150?img=${log.id+20}`" class="w-8 h-8 rounded-full border border-slate-100 z-10" />
                <div class="flex-1">
                  <p class="text-xs text-slate-500 leading-relaxed">
                    <span class="font-bold text-slate-800">{{ log.user }}</span> 
                    {{ log.action }} 
                    <span class="text-blue-600 font-medium">#{{ log.target }}</span>
                  </p>
                  <p class="text-[10px] text-slate-300 mt-1">{{ log.time }}</p>
                </div>
              </div>
            </div>
            <button class="w-full py-4 text-xs font-bold text-slate-400 hover:text-slate-600 border-t border-slate-50">
              查看更多动态
            </button>
          </div>

          <!-- Team Invitation Card -->
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 bg-purple-50 rounded-lg">
                <Users class="w-4 h-4 text-purple-600" />
              </div>
              <h3 class="font-bold text-slate-800">团队协作</h3>
            </div>
            <p class="text-xs text-slate-500 leading-relaxed mb-4">邀请你的伙伴加入“3D 设计俱乐部”，一起制定学习计划并互相点评作品。</p>
            <div class="flex -space-x-2 mb-6">
               <img v-for="i in 4" :key="i" :src="`https://i.pravatar.cc/150?img=${i+30}`" class="w-8 h-8 rounded-full border-2 border-white" />
               <div class="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-400">+5</div>
            </div>
            <button class="w-full py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors">
              管理我的团队
            </button>
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

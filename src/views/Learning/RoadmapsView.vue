<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle2, Circle, Lock, ChevronRight, Trophy, BookOpen, Star } from 'lucide-vue-next'

const roadmaps = ref([
  {
    id: 1,
    title: '3D 建模入门：从零到一',
    description: '掌握 Blender 基础，能够独立创作简单的场景和道具。',
    progress: 65,
    levels: [
      { id: 1, title: '基础操作与界面', status: 'completed', duration: '2h', tasks: 5 },
      { id: 2, title: '多边形建模技术', status: 'completed', duration: '5h', tasks: 8 },
      { id: 3, title: 'PBR 材质基础', status: 'in-progress', duration: '4h', tasks: 6 },
      { id: 4, title: '灯光与渲染设置', status: 'locked', duration: '3h', tasks: 4 },
      { id: 5, title: '综合实战项目', status: 'locked', duration: '10h', tasks: 2 },
    ]
  },
  {
    id: 2,
    title: '进阶渲染：Cycles 深度挖掘',
    description: '深入研究 Cycles 引擎，学习高级材质节点和焦散渲染。',
    progress: 0,
    levels: [
      { id: 1, title: '物理相机参数', status: 'locked', duration: '3h', tasks: 3 },
      { id: 2, title: '体积光与雾效', status: 'locked', duration: '4h', tasks: 5 },
    ]
  }
])

const activeRoadmap = ref(roadmaps.value[0])
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8fafc]">
    <!-- Header -->
    <div class="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-blue-50 rounded-lg">
          <BookOpen class="w-5 h-5 text-blue-600" />
        </div>
        <h1 class="text-xl font-bold text-slate-800">学习路线图</h1>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex flex-col items-end">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">当前总进度</span>
          <div class="flex items-center gap-2">
            <div class="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-blue-600 rounded-full" :style="{ width: '32%' }"></div>
            </div>
            <span class="text-sm font-bold text-slate-700">32%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar: Roadmap List -->
      <div class="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div class="p-4 border-b border-slate-50">
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest">我的路线</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          <button v-for="rm in roadmaps" :key="rm.id"
            @click="activeRoadmap = rm"
            class="w-full text-left p-3 rounded-xl transition-all group"
            :class="activeRoadmap.id === rm.id ? 'bg-blue-50 border border-blue-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'"
          >
            <h3 class="text-sm font-bold mb-1" :class="activeRoadmap.id === rm.id ? 'text-blue-700' : 'text-slate-700'">{{ rm.title }}</h3>
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-medium text-slate-400">{{ rm.levels.length }} 个阶段</span>
              <span class="text-[10px] font-bold" :class="activeRoadmap.id === rm.id ? 'text-blue-500' : 'text-slate-400'">{{ rm.progress }}%</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Main: Progress Visualization -->
      <div class="flex-1 overflow-y-auto p-8 relative">
        <div class="max-w-3xl mx-auto">
          <!-- Roadmap Info Card -->
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-12">
            <h2 class="text-2xl font-bold text-slate-800 mb-2">{{ activeRoadmap.title }}</h2>
            <p class="text-slate-500 text-sm leading-relaxed mb-6">{{ activeRoadmap.description }}</p>
            <div class="flex items-center gap-6">
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-orange-50 rounded-lg"><Star class="w-4 h-4 text-orange-500" /></div>
                <span class="text-xs font-bold text-slate-600">中级课程</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-purple-50 rounded-lg"><Trophy class="w-4 h-4 text-purple-500" /></div>
                <span class="text-xs font-bold text-slate-600">完成可获徽章</span>
              </div>
            </div>
          </div>

          <!-- Vertical Progress Path -->
          <div class="space-y-0 relative">
            <!-- Path Line -->
            <div class="absolute left-[27px] top-0 bottom-0 w-1 bg-slate-200 rounded-full"></div>
            
            <div v-for="(level, idx) in activeRoadmap.levels" :key="level.id" class="relative pl-16 pb-12 last:pb-0 group">
              <!-- Node Icon -->
              <div class="absolute left-0 top-0 w-14 h-14 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 transition-all duration-300 group-hover:scale-110"
                :class="{
                  'bg-emerald-500 text-white': level.status === 'completed',
                  'bg-blue-600 text-white ring-4 ring-blue-100': level.status === 'in-progress',
                  'bg-slate-100 text-slate-400': level.status === 'locked'
                }">
                <CheckCircle2 v-if="level.status === 'completed'" class="w-7 h-7" />
                <Circle v-else-if="level.status === 'in-progress'" class="w-7 h-7 animate-pulse" />
                <Lock v-else class="w-6 h-6" />
              </div>

              <!-- Content Card -->
              <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all duration-300"
                :class="{
                  'border-blue-200 bg-blue-50/30': level.status === 'in-progress',
                  'opacity-60 grayscale-[0.5]': level.status === 'locked'
                }">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-lg font-bold text-slate-800">{{ level.title }}</h4>
                  <div class="flex items-center gap-3">
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">{{ level.duration }}</span>
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">{{ level.tasks }} 个任务</span>
                  </div>
                </div>
                <p class="text-sm text-slate-500 mb-4">在这个阶段，你将学习到如何处理复杂的场景逻辑，以及如何优化你的渲染输出。</p>
                
                <div v-if="level.status !== 'locked'" class="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <button class="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
                    继续学习 <ChevronRight class="w-3.5 h-3.5" />
                  </button>
                  <div v-if="level.status === 'completed'" class="flex -space-x-2">
                     <img v-for="i in 3" :key="i" :src="`https://i.pravatar.cc/150?img=${i+10}`" class="w-6 h-6 rounded-full border-2 border-white" />
                     <div class="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">+12</div>
                  </div>
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
.animate-bounce-slow {
  animation: bounce 3s infinite;
}
</style>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  Map, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  Lock, 
  Trophy,
  ArrowRight,
  Sparkles,
  Zap,
  BookOpen
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const roadmaps = ref<any[]>([])
const myProgress = ref<any[]>([])
const isLoading = ref(false)
const selectedRoadmap = ref<any>(null)

const fetchData = async () => {
  isLoading.value = true
  try {
    const [roadRes, progRes] = await Promise.all([
      api.get('/api/roadmaps'),
      api.get('/api/roadmaps/my-progress')
    ])
    roadmaps.value = roadRes.data
    myProgress.value = progRes.data
    if (roadmaps.value.length > 0) {
      selectedRoadmap.value = roadmaps.value[0]
    }
  } catch (error) {
    ElMessage.error('加载学习路线失败')
  } finally {
    isLoading.value = false
  }
}

const isStepCompleted = (stepId: string) => {
  return myProgress.value.some(p => p.roadmapStepId === stepId && p.completed)
}

const toggleStep = async (stepId: string) => {
  const isCompleted = isStepCompleted(stepId)
  try {
    await api.post('/api/roadmaps/step-progress', {
      stepId,
      completed: !isCompleted
    })
    // Update local state
    const progIndex = myProgress.value.findIndex(p => p.roadmapStepId === stepId)
    if (progIndex > -1) {
      myProgress.value[progIndex].completed = !isCompleted
    } else {
      myProgress.value.push({ roadmapStepId: stepId, completed: !isCompleted })
    }
    ElMessage.success(!isCompleted ? '恭喜完成该阶段！' : '已重置阶段进度')
  } catch (error) {
    ElMessage.error('更新进度失败')
  }
}

const calculateRoadmapProgress = (roadmap: any) => {
  if (!roadmap.steps || roadmap.steps.length === 0) return 0
  const completedCount = roadmap.steps.filter((s: any) => isStepCompleted(s.id)).length
  return Math.round((completedCount / roadmap.steps.length) * 100)
}

onMounted(fetchData)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 px-8 flex items-center justify-between shrink-0 border-b transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <Map class="w-5 h-5 text-emerald-600" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">学习路径</h1>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Roadmap Selector Sidebar -->
      <div class="w-80 border-r flex flex-col shrink-0 overflow-y-auto p-6 space-y-4" style="background-color: var(--bg-card); border-color: var(--border-base)">
        <h2 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">可用的路线</h2>
        
        <div v-for="roadmap in roadmaps" :key="roadmap.id" 
             @click="selectedRoadmap = roadmap"
             class="group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden"
             :class="selectedRoadmap?.id === roadmap.id ? 'border-accent bg-accent/5 ring-1 ring-accent/20 shadow-lg shadow-accent/5' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'">
          
          <div class="relative z-10">
            <h3 class="text-sm font-bold mb-1" :class="selectedRoadmap?.id === roadmap.id ? 'text-accent' : 'text-slate-700 dark:text-slate-200'">{{ roadmap.title }}</h3>
            <p class="text-[10px] line-clamp-2 mb-4" style="color: var(--text-secondary)">{{ roadmap.description }}</p>
            
            <div class="flex items-center justify-between">
              <div class="flex -space-x-1">
                <div v-for="i in 3" :key="i" class="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                   {{ i }}
                </div>
              </div>
              <span class="text-[10px] font-black text-accent">{{ calculateRoadmapProgress(roadmap) }}%</span>
            </div>
            
            <div class="mt-2 w-full h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div class="h-full bg-accent transition-all duration-500" :style="{ width: calculateRoadmapProgress(roadmap) + '%' }"></div>
            </div>
          </div>
          
          <ChevronRight class="absolute top-1/2 -translate-y-1/2 -right-2 w-12 h-12 text-accent/5 group-hover:text-accent/10 transition-colors" />
        </div>
      </div>

      <!-- Roadmap Detail Timeline -->
      <div class="flex-1 overflow-y-auto p-12 scrollbar-hide">
        <div v-if="selectedRoadmap" class="max-w-3xl mx-auto">
          <div class="mb-12 text-center">
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent text-[10px] font-bold rounded-full mb-4">
              <Sparkles class="w-3 h-3" /> 推荐学习路径
            </div>
            <h2 class="text-4xl font-black mb-4" style="color: var(--text-primary)">{{ selectedRoadmap.title }}</h2>
            <p class="text-sm leading-relaxed max-w-xl mx-auto" style="color: var(--text-secondary)">{{ selectedRoadmap.description }}</p>
          </div>

          <!-- Timeline -->
          <div class="relative space-y-0">
            <!-- Timeline Line -->
            <div class="absolute left-[27px] top-8 bottom-8 w-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>

            <div v-for="(step, index) in selectedRoadmap.steps" :key="step.id" class="relative pl-20 pb-12 group last:pb-0">
              <!-- Timeline Dot -->
              <div @click="toggleStep(step.id)" 
                   class="absolute left-0 top-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all cursor-pointer z-10 border-4 border-white dark:border-slate-950 shadow-xl"
                   :class="isStepCompleted(step.id) ? 'bg-emerald-500 text-white scale-110 shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'">
                <CheckCircle2 v-if="isStepCompleted(step.id)" class="w-6 h-6" />
                <span v-else class="text-lg font-black">{{ index + 1 }}</span>
              </div>

              <!-- Step Content -->
              <div class="p-8 rounded-3xl border transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-1"
                   :class="isStepCompleted(step.id) ? 'bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-500/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 group-hover:border-accent/30'">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xl font-bold" :class="isStepCompleted(step.id) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'">{{ step.title }}</h3>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded">阶段 {{ index + 1 }}</span>
                  </div>
                </div>
                
                <p class="text-sm leading-relaxed mb-8" style="color: var(--text-secondary)">{{ step.description }}</p>
                
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <div class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <BookOpen class="w-3.5 h-3.5" /> 建议学习课程
                    </div>
                  </div>
                  <button @click="toggleStep(step.id)" 
                          class="px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                          :class="isStepCompleted(step.id) ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-accent'">
                    {{ isStepCompleted(step.id) ? '已达成' : '标记完成' }} 
                    <ArrowRight v-if="!isStepCompleted(step.id)" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Goal Node -->
            <div class="relative pl-20 pt-12">
               <div class="absolute left-0 top-12 w-14 h-14 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xl shadow-amber-500/30 z-10 border-4 border-white dark:border-slate-950 scale-125 animate-pulse">
                 <Trophy class="w-6 h-6" />
               </div>
               <div class="p-8 rounded-3xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-500/20">
                 <h3 class="text-xl font-black text-amber-600 dark:text-amber-400 mb-2">终点：3D 专家认证</h3>
                 <p class="text-sm text-slate-500">完成该路径的所有阶段，即可解锁专属勋章并获得平台实战推荐。</p>
               </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="h-full flex flex-col items-center justify-center text-slate-400">
          <Map class="w-16 h-16 mb-6 opacity-10" />
          <p class="text-lg font-bold">选择一个学习路径开始你的旅程</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

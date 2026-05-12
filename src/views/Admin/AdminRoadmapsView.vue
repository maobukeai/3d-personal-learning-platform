<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Plus,
  Trash2,
  Edit2,
  Milestone
} from 'lucide-vue-next'
import api from '@/utils/api'

const roadmaps = ref<any[]>([])
const isLoading = ref(true)
const showRoadmapModal = ref(false)
const showStepModal = ref(false)
const currentRoadmap = ref<any>(null)
const currentStep = ref<any>(null)

const roadmapForm = ref({
  title: '',
  description: ''
})

const stepForm = ref({
  title: '',
  description: '',
  order: 0,
  roadmapId: ''
})

const fetchRoadmaps = async () => {
  try {
    isLoading.value = true
    const { data } = await api.get('/api/admin/roadmaps')
    roadmaps.value = data
  } catch (error) {
    console.error('Fetch roadmaps error:', error)
  } finally {
    isLoading.value = false
  }
}

const handleSaveRoadmap = async () => {
  try {
    if (currentRoadmap.value) {
      await api.put(`/api/admin/roadmaps/${currentRoadmap.value.id}`, roadmapForm.value)
    } else {
      await api.post('/api/admin/roadmaps', roadmapForm.value)
    }
    showRoadmapModal.value = false
    fetchRoadmaps()
  } catch (error) {
    console.error('Save roadmap error:', error)
  }
}

const handleDeleteRoadmap = async (id: string) => {
  if (!confirm('确定要删除这个路线吗？所有步骤将被删除。')) return
  try {
    await api.delete(`/api/admin/roadmaps/${id}`)
    fetchRoadmaps()
  } catch (error) {
    console.error('Delete roadmap error:', error)
  }
}

const openRoadmapModal = (roadmap: any = null) => {
  currentRoadmap.value = roadmap
  if (roadmap) {
    roadmapForm.value = {
      title: roadmap.title,
      description: roadmap.description
    }
  } else {
    roadmapForm.value = { title: '', description: '' }
  }
  showRoadmapModal.value = true
}

const openStepModal = (roadmap: any, step: any = null) => {
  currentRoadmap.value = roadmap
  currentStep.value = step
  if (step) {
    stepForm.value = {
      title: step.title,
      description: step.description,
      order: step.order,
      roadmapId: roadmap.id
    }
  } else {
    stepForm.value = {
      title: '',
      description: '',
      order: (roadmap.steps?.length || 0) + 1,
      roadmapId: roadmap.id
    }
  }
  showStepModal.value = true
}

const handleSaveStep = async () => {
  try {
    if (currentStep.value) {
      await api.put(`/api/admin/roadmaps/steps/${currentStep.value.id}`, stepForm.value)
    } else {
      await api.post('/api/admin/roadmaps/steps', stepForm.value)
    }
    showStepModal.value = false
    fetchRoadmaps()
  } catch (error) {
    console.error('Save step error:', error)
  }
}

const handleDeleteStep = async (id: string) => {
  if (!confirm('确定要删除这个步骤吗？')) return
  try {
    await api.delete(`/api/admin/roadmaps/steps/${id}`)
    fetchRoadmaps()
  } catch (error) {
    console.error('Delete step error:', error)
  }
}

onMounted(() => {
  fetchRoadmaps()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-20 border-b px-8 flex items-center justify-between shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">学习路线管理</h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">规划和编辑针对新手的 3D 学习路径</p>
      </div>
      
      <button @click="openRoadmapModal()" class="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-all shadow-lg shadow-accent/20">
        <Plus class="w-4 h-4" />
        新建路线
      </button>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 text-slate-400">
        <div class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-sm font-bold">加载学习路线...</p>
      </div>

      <div v-else class="max-w-5xl mx-auto space-y-8">
        <div v-for="roadmap in roadmaps" :key="roadmap.id" 
             class="group rounded-3xl border overflow-hidden transition-all hover:shadow-lg"
             style="background-color: var(--bg-card); border-color: var(--border-base)">
          <div class="p-8">
            <div class="flex items-start justify-between mb-6">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center">
                  <Milestone class="w-6 h-6" />
                </div>
                <div>
                  <h3 class="font-bold text-xl mb-1 truncate" style="color: var(--text-primary)">{{ roadmap.title }}</h3>
                  <p class="text-xs text-slate-400 max-w-2xl">{{ roadmap.description }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button @click="openRoadmapModal(roadmap)" class="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 transition-colors">
                  <Edit2 class="w-4 h-4" />
                </button>
                <button @click="handleDeleteRoadmap(roadmap.id)" class="p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Steps Progress Line -->
            <div class="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-white/5">
              <div v-for="step in roadmap.steps" :key="step.id" 
                   class="relative group/step">
                <div class="absolute -left-[23px] top-2 w-[18px] h-[18px] rounded-full bg-white dark:bg-slate-900 border-2 border-accent z-10"></div>
                
                <div class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all">
                  <div class="flex items-center gap-4">
                    <span class="text-[10px] font-black text-slate-400 w-4">{{ step.order }}</span>
                    <div>
                      <h4 class="text-sm font-bold" style="color: var(--text-primary)">{{ step.title }}</h4>
                      <p class="text-[10px] text-slate-400 mt-0.5">{{ step.description }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 opacity-0 group-hover/step:opacity-100 transition-opacity">
                    <button @click="openStepModal(roadmap, step)" class="p-1.5 rounded-lg text-slate-400 hover:text-accent">
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button @click="handleDeleteStep(step.id)" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <button @click="openStepModal(roadmap)" class="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/5 text-slate-400 hover:text-accent hover:border-accent/40 transition-all text-xs font-bold flex items-center justify-center gap-2">
                <Plus class="w-4 h-4" />
                添加步骤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Roadmap Modal -->
    <div v-if="showRoadmapModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-xl rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">{{ currentRoadmap ? '编辑路线' : '新建路线' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">路线标题</label>
            <input v-model="roadmapForm.title" type="text" placeholder="例如：从零开始的 Blender 大师之路" 
                   class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                   style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">路线描述</label>
            <textarea v-model="roadmapForm.description" rows="3" placeholder="简述该路线的学习目标..." 
                      class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
                      style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"></textarea>
          </div>
        </div>
        <div class="flex items-center gap-4 mt-8">
          <button @click="showRoadmapModal = false" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">取消</button>
          <button @click="handleSaveRoadmap" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20">保存路线</button>
        </div>
      </div>
    </div>

    <!-- Step Modal -->
    <div v-if="showStepModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-xl rounded-3xl p-8 shadow-2xl transition-colors duration-300" style="background-color: var(--bg-card)">
        <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">{{ currentStep ? '编辑步骤' : '新建步骤' }}</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-4 gap-4">
            <div class="col-span-3">
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">步骤名称</label>
              <input v-model="stepForm.title" type="text" placeholder="例如：掌握基础快捷键" 
                     class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">阶段排序</label>
              <input v-model="stepForm.order" type="number" 
                     class="w-full px-4 py-3 rounded-2xl border transition-all outline-none text-center font-bold"
                     style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">详细说明</label>
            <textarea v-model="stepForm.description" rows="3" placeholder="该阶段具体需要学习哪些内容..." 
                      class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
                      style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"></textarea>
          </div>
        </div>
        <div class="flex items-center gap-4 mt-8">
          <button @click="showStepModal = false" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">取消</button>
          <button @click="handleSaveStep" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20">保存步骤</button>
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

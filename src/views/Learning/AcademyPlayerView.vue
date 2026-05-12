<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  CheckCircle2, 
  MessageSquare, 
  Share2, 
  Info,
  Layers,
  FileText,
  Layout,
  Clock,
  Menu,
  X,
  Box,
  Users
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import ModelViewer from '@/components/ModelViewer.vue'

const route = useRoute()
const router = useRouter()
const courseId = route.params.id as string

const course = ref<any>(null)
const lessons = ref<any[]>([])
const currentLessonIndex = ref(0)
const isLoading = ref(true)
const isSidebarOpen = ref(true)
const activeTab = ref('content') // 'content', 'info', 'discussion'
const progress = ref(0)

const currentLesson = computed(() => lessons.value[currentLessonIndex.value])

const fetchCourseData = async () => {
  isLoading.value = true
  try {
    const [courseRes, enrollmentRes] = await Promise.all([
      api.get(`/api/courses/${courseId}`),
      api.get('/api/courses/my-enrollments')
    ])
    
    course.value = courseRes.data
    lessons.value = course.value.lessons || []
    
    const enrollment = enrollmentRes.data.find((e: any) => e.courseId === courseId)
    if (enrollment) {
      progress.value = enrollment.progress
      // Simple logic: if progress is 50%, start at the middle lesson
      if (lessons.value.length > 0) {
        const index = Math.floor((progress.value / 100) * lessons.value.length)
        currentLessonIndex.value = Math.min(index, lessons.value.length - 1)
      }
    }
  } catch (error) {
    ElMessage.error('加载课程失败')
    router.push('/academy')
  } finally {
    isLoading.value = false
  }
}

const updateProgress = async () => {
  if (!course.value || lessons.value.length === 0) return
  
  const newProgress = Math.round(((currentLessonIndex.value + 1) / lessons.value.length) * 100)
  if (newProgress > progress.value) {
    try {
      await api.patch('/api/courses/progress', {
        courseId,
        progress: newProgress
      })
      progress.value = newProgress
    } catch (error) {
      console.error('Update progress error:', error)
    }
  }
}

const nextLesson = () => {
  if (currentLessonIndex.value < lessons.value.length - 1) {
    currentLessonIndex.value++
    updateProgress()
  }
}

const prevLesson = () => {
  if (currentLessonIndex.value > 0) {
    currentLessonIndex.value--
  }
}

const selectLesson = (index: number) => {
  currentLessonIndex.value = index
  if (window.innerWidth < 1024) isSidebarOpen.value = false
}

// Check if a URL is a 3D model (ends in .glb or .gltf)
const is3DModel = (url?: string) => {
  if (!url) return false
  return url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf')
}

onMounted(fetchCourseData)
</script>

<template>
  <div class="flex h-full overflow-hidden bg-slate-950 text-slate-200">
    <!-- Main Player Area -->
    <div class="flex-1 flex flex-col relative overflow-hidden">
      <!-- Player Top Nav -->
      <div class="h-14 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md border-b border-white/5 z-20">
        <div class="flex items-center gap-4">
          <button @click="router.push('/academy')" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft class="w-5 h-5" />
          </button>
          <div class="h-4 w-px bg-white/10"></div>
          <div>
            <h1 class="text-sm font-bold truncate max-w-[200px] md:max-w-md">{{ course?.title }}</h1>
            <p class="text-[10px] text-slate-400">正在学习: {{ currentLesson?.title }}</p>
          </div>
        </div>
        
        <div class="flex items-center gap-3">
          <div class="hidden md:flex flex-col items-end mr-2">
            <div class="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
              <div class="h-full bg-accent transition-all duration-1000" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="text-[9px] font-bold mt-1 text-accent">已完成 {{ progress }}%</span>
          </div>
          <button @click="isSidebarOpen = !isSidebarOpen" class="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden">
            <Menu class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Content Renderer -->
      <div class="flex-1 relative bg-black flex items-center justify-center">
        <div v-if="isLoading" class="flex flex-col items-center gap-4">
          <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs font-bold text-slate-500">正在加载学习内容...</p>
        </div>

        <template v-else-if="currentLesson">
          <!-- 3D Model Mode -->
          <div v-if="is3DModel(currentLesson.videoUrl)" class="w-full h-full relative">
            <ModelViewer :model-url="currentLesson.videoUrl" auto-rotate />
            <div class="absolute bottom-6 right-6 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-xl border border-white/10 pointer-events-none">
              <div class="flex items-center gap-2">
                <Box class="w-4 h-4 text-accent" />
                <span class="text-[10px] font-bold">3D 实操教学模式</span>
              </div>
            </div>
          </div>

          <!-- Video Mode -->
          <div v-else-if="currentLesson.videoUrl" class="w-full h-full flex items-center justify-center bg-slate-900">
             <video 
               :src="currentLesson.videoUrl" 
               controls 
               class="max-w-full max-h-full"
               @ended="updateProgress"
             ></video>
          </div>

          <!-- Text/Doc Mode -->
          <div v-else class="w-full h-full p-8 md:p-16 overflow-y-auto bg-slate-900 scrollbar-hide">
            <div class="max-w-3xl mx-auto space-y-8">
              <div class="space-y-4">
                <span class="px-3 py-1 bg-accent/20 text-accent text-[10px] font-bold rounded-full">文字教程</span>
                <h2 class="text-3xl font-black">{{ currentLesson.title }}</h2>
              </div>
              <div class="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed" v-html="currentLesson.content"></div>
              <div class="pt-12 flex justify-center">
                <button @click="nextLesson" class="px-8 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 flex items-center gap-2">
                  完成学习 <ChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Player Bottom Controls -->
      <div class="h-20 px-8 flex items-center justify-between bg-slate-900 border-t border-white/5">
        <div class="flex items-center gap-2">
          <button 
            @click="prevLesson"
            :disabled="currentLessonIndex === 0"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
            :class="currentLessonIndex > 0 ? 'hover:bg-white/5 bg-white/5' : 'bg-transparent'"
          >
            <ChevronLeft class="w-4 h-4" /> 上一节
          </button>
          <button 
            @click="nextLesson"
            :disabled="currentLessonIndex === lessons.length - 1"
            class="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30 shadow-lg shadow-accent/10"
          >
            下一节 <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <div class="hidden md:flex items-center gap-6">
          <button 
            v-for="tab in [{id:'content', icon:FileText, label:'课程内容'}, {id:'discussion', icon:MessageSquare, label:'参与讨论'}]"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="flex items-center gap-2 text-xs font-medium transition-all"
            :class="activeTab === tab.id ? 'text-accent' : 'text-slate-500 hover:text-slate-300'"
          >
            <component :is="tab.icon" class="w-4 h-4" /> {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Right Sidebar (Lessons List) -->
    <Transition name="slide-right">
      <div v-if="isSidebarOpen" class="w-full lg:w-80 h-full flex flex-col bg-slate-900 border-l border-white/5 z-30 absolute lg:relative inset-0 lg:inset-auto">
        <div class="h-14 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
          <h2 class="text-sm font-bold">课程大纲</h2>
          <button @click="isSidebarOpen = false" class="lg:hidden p-2 hover:bg-white/10 rounded-lg">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          <div v-for="(lesson, index) in lessons" :key="lesson.id" 
               @click="selectLesson(index)"
               class="group p-4 rounded-2xl cursor-pointer transition-all border border-transparent"
               :class="currentLessonIndex === index ? 'bg-accent/10 border-accent/20' : 'hover:bg-white/5'">
            <div class="flex gap-4">
              <div class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-colors"
                   :class="currentLessonIndex === index ? 'bg-accent text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'">
                {{ index + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-xs font-bold truncate mb-1" :class="currentLessonIndex === index ? 'text-accent' : 'text-slate-200'">{{ lesson.title }}</h3>
                <div class="flex items-center gap-3">
                  <span class="flex items-center gap-1 text-[10px] text-slate-500">
                    <component :is="is3DModel(lesson.videoUrl) ? Box : (lesson.videoUrl ? Play : FileText)" class="w-3 h-3" />
                    {{ is3DModel(lesson.videoUrl) ? '3D 交互' : (lesson.videoUrl ? '视频' : '图文') }}
                  </span>
                  <CheckCircle2 v-if="index < currentLessonIndex || (index === lessons.length-1 && progress === 100)" class="w-3 h-3 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Instructor Info Card -->
        <div class="p-6 border-t border-white/5 bg-slate-900/50">
           <div class="flex items-center gap-3 mb-4">
             <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
               <img v-if="course?.instructor?.avatar" :src="course.instructor.avatar" class="w-full h-full object-cover" />
               <Users v-else class="w-5 h-5 text-slate-600" />
             </div>
             <div>
               <p class="text-xs font-bold">{{ course?.instructor?.name || '平台认证导师' }}</p>
               <p class="text-[10px] text-slate-500">3D 设计专家</p>
             </div>
           </div>
           <p class="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
             {{ course?.description }}
           </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.3s ease; }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }
@media (max-width: 1024px) {
  .slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }
}
</style>

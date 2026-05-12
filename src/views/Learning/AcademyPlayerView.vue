<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle2,
  MessageSquare,
  FileText,
  Clock,
  Menu,
  X,
  Box,
  Users,
  StickyNote,
  Send,
  Trash2,
  Circle
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
const activeTab = ref<'content' | 'notes' | 'discussion'>('content')
const progress = ref(0)
const lessonProgressMap = ref<Record<string, boolean>>({})
const notes = ref<any[]>([])
const newNoteContent = ref('')
const isSavingNote = ref(false)
const isTogglingComplete = ref(false)
const autoPlayNext = ref(true)
const showCompletionModal = ref(false)

const currentLesson = computed(() => lessons.value[currentLessonIndex.value])

const completedCount = computed(() => {
  return Object.values(lessonProgressMap.value).filter(Boolean).length
})

const isLessonCompleted = (lessonId: string) => {
  return !!lessonProgressMap.value[lessonId]
}

const fetchCourseData = async () => {
  isLoading.value = true
  try {
    const { data } = await api.get(`/api/courses/${courseId}`)

    course.value = data
    lessons.value = data.lessons || []
    lessonProgressMap.value = data.lessonProgressMap || {}

    if (data.userEnrollment) {
      progress.value = data.userEnrollment.progress
      if (lessons.value.length > 0 && progress.value > 0) {
        let lastIncompleteIndex = lessons.value.findIndex((l: any) => !lessonProgressMap.value[l.id])
        if (lastIncompleteIndex === -1) lastIncompleteIndex = lessons.value.length - 1
        currentLessonIndex.value = Math.max(0, lastIncompleteIndex)
      }
    }
  } catch (error) {
    ElMessage.error('加载课程失败')
    router.push('/academy')
  } finally {
    isLoading.value = false
  }
}

const fetchNotes = async () => {
  if (!currentLesson.value) return
  try {
    const { data } = await api.get(`/api/courses/lessons/${currentLesson.value.id}/notes`)
    notes.value = data
  } catch (error) {
    console.error('Fetch notes error:', error)
  }
}

const toggleLessonComplete = async () => {
  if (!currentLesson.value || isTogglingComplete.value) return
  isTogglingComplete.value = true
  const newCompleted = !isLessonCompleted(currentLesson.value.id)
  try {
    const { data } = await api.patch(`/api/courses/lessons/${currentLesson.value.id}/complete`, {
      completed: newCompleted
    })
    lessonProgressMap.value = { ...lessonProgressMap.value, [currentLesson.value.id]: newCompleted }
    progress.value = data.courseProgress

    if (data.courseProgress === 100 && newCompleted) {
      showCompletionModal.value = true
    }
  } catch (error) {
    console.error('Toggle complete error:', error)
  } finally {
    isTogglingComplete.value = false
  }
}

const handleSaveNote = async () => {
  if (!newNoteContent.value.trim() || !currentLesson.value || isSavingNote.value) return
  isSavingNote.value = true
  try {
    const { data } = await api.post('/api/courses/notes', {
      lessonId: currentLesson.value.id,
      content: newNoteContent.value.trim()
    })
    notes.value.unshift(data)
    newNoteContent.value = ''
  } catch (error) {
    ElMessage.error('保存笔记失败')
  } finally {
    isSavingNote.value = false
  }
}

const handleDeleteNote = async (noteId: string) => {
  try {
    await api.delete(`/api/courses/notes/${noteId}`)
    notes.value = notes.value.filter(n => n.id !== noteId)
  } catch (error) {
    ElMessage.error('删除笔记失败')
  }
}

const nextLesson = () => {
  if (currentLessonIndex.value < lessons.value.length - 1) {
    currentLessonIndex.value++
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

const handleVideoEnded = () => {
  if (!isLessonCompleted(currentLesson.value.id)) {
    toggleLessonComplete()
  }
  if (autoPlayNext.value && currentLessonIndex.value < lessons.value.length - 1) {
    setTimeout(() => {
      nextLesson()
    }, 1500)
  }
}

const is3DModel = (url?: string) => {
  if (!url) return false
  return url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf')
}

const isBilibili = (url?: string) => {
  if (!url) return false
  return url.includes('player.bilibili.com') || url.includes('bilibili.com') || url.includes('b23.tv')
}

const isYoutube = (url?: string) => {
  if (!url) return false
  return url.includes('youtube.com') || url.includes('youtu.be')
}

const formatBilibiliUrl = (url: string) => {
  if (url.includes('player.bilibili.com')) return url
  const bvidMatch = url.match(/video\/(BV[a-zA-Z0-9]+)/)
  if (bvidMatch) {
    const bvid = bvidMatch[1]
    const pMatch = url.match(/\?p=(\d+)/)
    const page = pMatch ? pMatch[1] : '1'
    return `https://player.bilibili.com/player.html?bvid=${bvid}&page=${page}&high_quality=1&as_wide=1&danmaku=0`
  }
  return url
}

const formatYoutubeUrl = (url: string) => {
  if (url.includes('youtube.com/embed')) return url
  const videoIdMatch = url.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/|watch\?.*v=)([^#\&\?]*).*/)
  if (videoIdMatch) {
    return `https://www.youtube.com/embed/${videoIdMatch[1]}`
  }
  return url
}

watch(currentLessonIndex, () => {
  activeTab.value = 'content'
  if (currentLesson.value) {
    fetchNotes()
  }
})

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

          <!-- Bilibili Video Mode -->
          <div v-else-if="isBilibili(currentLesson.videoUrl)" class="w-full h-full flex items-center justify-center bg-black">
            <iframe
              :src="formatBilibiliUrl(currentLesson.videoUrl)"
              class="w-full h-full border-0"
              scrolling="no"
              frameborder="0"
              framespacing="0"
              referrerpolicy="no-referrer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>

          <!-- YouTube Video Mode -->
          <div v-else-if="isYoutube(currentLesson.videoUrl)" class="w-full h-full flex items-center justify-center bg-black">
            <iframe
              :src="formatYoutubeUrl(currentLesson.videoUrl)"
              class="w-full h-full border-0"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>

          <!-- Native Video Mode -->
          <div v-else-if="currentLesson.videoUrl" class="w-full h-full flex items-center justify-center bg-slate-900">
             <video
               :src="currentLesson.videoUrl"
               controls
               class="max-w-full max-h-full"
               @ended="handleVideoEnded"
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
                <button @click="handleVideoEnded" class="px-8 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 flex items-center gap-2">
                  完成学习 <ChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Player Bottom Controls -->
      <div class="px-8 py-4 flex items-center justify-between bg-slate-900 border-t border-white/5">
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

        <!-- Center: Complete toggle -->
        <div class="hidden md:flex items-center gap-4">
          <button @click="toggleLessonComplete" :disabled="isTogglingComplete"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  :class="currentLesson && isLessonCompleted(currentLesson.id) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:text-white'">
            <CheckCircle2 v-if="currentLesson && isLessonCompleted(currentLesson.id)" class="w-4 h-4" />
            <Circle v-else class="w-4 h-4" />
            {{ currentLesson && isLessonCompleted(currentLesson.id) ? '已完成' : '标记完成' }}
          </button>

          <label class="flex items-center gap-2 text-[10px] text-slate-500 cursor-pointer">
            <input type="checkbox" v-model="autoPlayNext" class="accent-accent w-3 h-3" />
            自动播放下一节
          </label>
        </div>

        <!-- Right: Tab buttons -->
        <div class="hidden md:flex items-center gap-6">
          <button
            v-for="tab in [{id:'content' as const, icon:FileText, label:'课程内容'}, {id:'notes' as const, icon:StickyNote, label:'学习笔记'}, {id:'discussion' as const, icon:MessageSquare, label:'参与讨论'}]"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="flex items-center gap-2 text-xs font-medium transition-all"
            :class="activeTab === tab.id ? 'text-accent' : 'text-slate-500 hover:text-slate-300'"
          >
            <component :is="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
            <span v-if="tab.id === 'notes' && notes.length" class="px-1.5 py-0.5 rounded text-[9px] bg-accent/20 text-accent font-bold">{{ notes.length }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Right Sidebar -->
    <Transition name="slide-right">
      <div v-if="isSidebarOpen" class="w-full lg:w-96 h-full flex flex-col bg-slate-900 border-l border-white/5 z-30 absolute lg:relative inset-0 lg:inset-auto">
        <!-- Sidebar Header -->
        <div class="h-14 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
          <div class="flex items-center gap-3">
            <h2 class="text-sm font-bold">课程大纲</h2>
            <span class="text-[10px] text-slate-500 font-bold">{{ completedCount }}/{{ lessons.length }}</span>
          </div>
          <button @click="isSidebarOpen = false" class="lg:hidden p-2 hover:bg-white/10 rounded-lg">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto scrollbar-hide">
          <!-- Content Tab: Lesson List -->
          <template v-if="activeTab === 'content'">
            <div class="p-4 space-y-2">
              <div v-for="(lesson, index) in lessons" :key="lesson.id"
                   @click="selectLesson(index)"
                   class="group p-4 rounded-2xl cursor-pointer transition-all border border-transparent"
                   :class="currentLessonIndex === index ? 'bg-accent/10 border-accent/20' : 'hover:bg-white/5'">
                <div class="flex gap-4">
                  <div class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-colors"
                       :class="isLessonCompleted(lesson.id) ? 'bg-emerald-500 text-white' : (currentLessonIndex === index ? 'bg-accent text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700')">
                    <CheckCircle2 v-if="isLessonCompleted(lesson.id)" class="w-4 h-4" />
                    <span v-else>{{ index + 1 }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="text-xs font-bold truncate mb-1" :class="currentLessonIndex === index ? 'text-accent' : (isLessonCompleted(lesson.id) ? 'text-emerald-400' : 'text-slate-200')">{{ lesson.title }}</h3>
                    <div class="flex items-center gap-3">
                      <span class="flex items-center gap-1 text-[10px] text-slate-500">
                        <component :is="is3DModel(lesson.videoUrl) ? Box : (lesson.videoUrl ? Play : FileText)" class="w-3 h-3" />
                        {{ is3DModel(lesson.videoUrl) ? '3D 交互' : (lesson.videoUrl ? '视频' : '图文') }}
                      </span>
                      <span v-if="lesson.duration" class="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock class="w-3 h-3" /> {{ lesson.duration }}分钟
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Notes Tab -->
          <template v-if="activeTab === 'notes'">
            <div class="p-4 space-y-4">
              <!-- Add Note -->
              <div class="space-y-3">
                <div class="flex items-center gap-2 text-xs text-slate-400">
                  <StickyNote class="w-3.5 h-3.5" />
                  <span class="font-bold">{{ currentLesson?.title }} 的笔记</span>
                </div>
                <textarea v-model="newNoteContent" rows="3" placeholder="记录你的学习心得..."
                          class="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/5 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-accent/30 transition-colors"></textarea>
                <div class="flex justify-end">
                  <button @click="handleSaveNote" :disabled="!newNoteContent.trim() || isSavingNote"
                          class="flex items-center gap-2 px-4 py-2 bg-accent text-white text-xs font-bold rounded-lg disabled:opacity-40 transition-all">
                    <Send class="w-3.5 h-3.5" />
                    保存笔记
                  </button>
                </div>
              </div>

              <!-- Notes List -->
              <div class="space-y-2">
                <div v-for="note in notes" :key="note.id"
                     class="group p-4 rounded-xl bg-slate-800/50 border border-white/5">
                  <p class="text-xs text-slate-300 leading-relaxed mb-2">{{ note.content }}</p>
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] text-slate-600">{{ new Date(note.createdAt).toLocaleString('zh-CN') }}</span>
                    <button @click="handleDeleteNote(note.id)" class="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 transition-all">
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div v-if="!notes.length" class="py-8 text-center">
                  <StickyNote class="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  <p class="text-[10px] text-slate-600">还没有笔记，开始记录吧</p>
                </div>
              </div>
            </div>
          </template>

          <!-- Discussion Tab -->
          <template v-if="activeTab === 'discussion'">
            <div class="p-4">
              <div class="space-y-4">
                <div class="text-center py-8">
                  <MessageSquare class="w-8 h-8 mx-auto mb-3 text-slate-700" />
                  <p class="text-xs text-slate-500 mb-3">课程讨论区</p>
                  <button @click="router.push(`/discussions`)"
                          class="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-lg transition-colors">
                    前往讨论区
                  </button>
                </div>
              </div>
            </div>
          </template>
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

    <!-- Course Completion Modal -->
    <div v-if="showCompletionModal" class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-3xl p-10 text-center bg-slate-900 border border-white/10 shadow-2xl">
        <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 class="w-10 h-10 text-emerald-400" />
        </div>
        <h2 class="text-2xl font-black text-white mb-3">🎉 恭喜完成课程！</h2>
        <p class="text-sm text-slate-400 mb-8">你已经完成了「{{ course?.title }}」的全部课时学习</p>
        <div class="flex gap-4">
          <button @click="showCompletionModal = false; router.push('/academy')"
                  class="flex-1 py-3 rounded-xl font-bold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors">
            返回课程列表
          </button>
          <button @click="showCompletionModal = false"
                  class="flex-1 py-3 rounded-xl bg-accent text-white font-bold shadow-lg shadow-accent/20 transition-all">
            继续复习
          </button>
        </div>
      </div>
    </div>
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

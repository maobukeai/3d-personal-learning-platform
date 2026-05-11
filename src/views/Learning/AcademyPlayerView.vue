<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ChevronLeft, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Settings, 
  Maximize, 
  CheckCircle2, 
  Lock,
  MessageSquare,
  FileText,
  Share2,
  ThumbsUp,
  Download
} from 'lucide-vue-next'

const router = useRouter()
const videoRef = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(70)
const isMuted = ref(false)
const currentLessonId = ref(1)

const courseData = {
  title: 'Blender 3.5 核心技术进阶',
  instructor: 'Alex Rivera',
  description: '本章节将深入探讨复杂的 PBR 材质节点设置，包括如何使用噪声纹理创建真实的磨损效果，以及通过着色器编辑器实现次表面散射。',
  syllabus: [
    { id: 1, title: '01. 课程导论与环境准备', duration: '05:20', completed: true, locked: false, url: 'https://vjs.zencdn.net/v/oceans.mp4' },
    { id: 2, title: '02. PBR 材质基础理论回顾', duration: '12:45', completed: true, locked: false, url: 'https://vjs.zencdn.net/v/oceans.mp4' },
    { id: 3, title: '03. 噪声纹理的高级应用', duration: '18:10', completed: false, locked: false, url: 'https://vjs.zencdn.net/v/oceans.mp4' },
    { id: 4, title: '04. 磨损与脏迹效果实操', duration: '22:30', completed: false, locked: false, url: 'https://vjs.zencdn.net/v/oceans.mp4' },
    { id: 5, title: '05. 次表面散射 (SSS) 实战', duration: '15:15', completed: false, locked: true, url: '' },
    { id: 6, title: '06. 渲染参数优化技巧', duration: '09:50', completed: false, locked: true, url: '' },
  ]
}

const currentLesson = computed(() => courseData.syllabus.find(s => s.id === currentLessonId.value))

const togglePlay = () => {
  if (!videoRef.value) return
  if (videoRef.value.paused) {
    videoRef.value.play()
    isPlaying.value = true
  } else {
    videoRef.value.pause()
    isPlaying.value = false
  }
}

const onTimeUpdate = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

const onLoadedMetadata = () => {
  if (videoRef.value) {
    duration.value = videoRef.value.duration
  }
}

const handleSeek = (e: any) => {
  if (videoRef.value) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    videoRef.value.currentTime = percentage * duration.value
  }
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' + s : s}`
}

const handleLessonChange = (item: any) => {
  if (item.locked) return
  currentLessonId.value = item.id
  isPlaying.value = false
  if (videoRef.value) {
    videoRef.value.load()
  }
}

const resources = [
  { name: '课程工程文件 (.blend)', size: '42.5 MB' },
  { name: '参考贴图压缩包', size: '128.0 MB' },
  { name: '快捷键 PDF 手册', size: '2.1 MB' }
]

const comments = [
  { user: 'Sarah', avatar: 'https://i.pravatar.cc/150?img=32', content: '这个噪声纹理的混合逻辑讲得太清晰了！解决了困扰我很久的问题！', time: '2小时前' },
  { user: 'David', avatar: 'https://i.pravatar.cc/150?img=12', content: '请问 3.6 版本里的节点分布是一样的吗？', time: '5小时前' }
]

const handleBack = () => router.back()
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app); color: var(--text-primary)">
    <!-- Top Header -->
    <header class="h-16 shrink-0 border-b px-6 flex items-center justify-between transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-4">
        <button 
          @click="handleBack"
          class="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-sm font-bold" style="color: var(--text-primary)">{{ courseData.title }}</h1>
          <p class="text-[10px] font-bold uppercase tracking-widest mt-0.5" style="color: var(--text-secondary)">正在播放：{{ currentLesson?.title }}</p>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <div class="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
          <span class="text-[10px] font-bold" style="color: var(--text-secondary)">245 位同学正在学习</span>
        </div>
        <button class="w-10 h-10 rounded-full bg-accent hover:bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/20 transition-all">
          <Share2 class="w-4 h-4" />
        </button>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden">
      <!-- Left: Player and Content -->
      <div class="flex-1 flex flex-col overflow-y-auto scrollbar-hide transition-colors duration-300" style="background-color: var(--bg-app)">
        <!-- Video Area -->
        <div class="aspect-video bg-slate-900 relative group shadow-2xl">
          <!-- Video Element -->
          <video 
            ref="videoRef"
            :src="currentLesson?.url"
            class="w-full h-full object-contain"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @click="togglePlay"
          ></video>

          <!-- Play Overlay -->
          <div v-if="!isPlaying" class="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <button 
              class="w-20 h-20 rounded-full bg-accent/90 text-white flex items-center justify-center scale-90 group-hover:scale-100 transition-all duration-500 shadow-2xl shadow-accent/40 pointer-events-auto"
              @click="togglePlay"
            >
              <Play class="w-8 h-8 fill-current ml-1" />
            </button>
          </div>

          <!-- Video Controls Bar -->
          <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white">
            <!-- Progress Bar -->
            <div 
              class="h-1.5 w-full bg-white/20 rounded-full mb-6 overflow-hidden cursor-pointer relative group/progress"
              @click="handleSeek"
            >
              <div 
                class="h-full bg-accent rounded-full absolute left-0 top-0 transition-all"
                :style="{ width: (duration > 0 ? (currentTime / duration * 100) : 0) + '%' }"
              ></div>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-6">
                <button @click="togglePlay">
                  <Pause v-if="isPlaying" class="w-5 h-5 cursor-pointer hover:text-accent transition-colors" />
                  <Play v-else class="w-5 h-5 cursor-pointer hover:text-accent transition-colors" />
                </button>
                <div class="flex items-center gap-3 group/volume">
                  <button @click="isMuted = !isMuted">
                    <VolumeX v-if="isMuted || volume === 0" class="w-5 h-5 text-slate-400" />
                    <Volume2 v-else class="w-5 h-5 cursor-pointer" />
                  </button>
                  <div class="w-20 h-1 bg-white/20 rounded-full relative cursor-pointer">
                    <div class="h-full bg-white rounded-full" :style="{ width: (isMuted ? 0 : volume) + '%' }"></div>
                  </div>
                </div>
                <span class="text-xs font-mono tabular-nums">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
              </div>
              <div class="flex items-center gap-6">
                <Settings class="w-5 h-5 cursor-pointer hover:text-accent transition-colors" />
                <Maximize class="w-5 h-5 cursor-pointer hover:text-accent transition-colors" />
              </div>
            </div>
          </div>
        </div>

        <!-- Course Info Tabs Area -->
        <div class="p-10">
          <div class="max-w-4xl mx-auto">
            <div class="flex items-center gap-8 border-b mb-8 transition-colors duration-300" style="border-color: var(--border-base)">
              <button class="pb-4 text-sm font-black border-b-2 border-accent text-accent">课程介绍</button>
              <button class="pb-4 text-sm font-black transition-colors" style="color: var(--text-secondary)">讨论互动 (32)</button>
              <button class="pb-4 text-sm font-black transition-colors" style="color: var(--text-secondary)">课程资源</button>
            </div>

            <div class="space-y-10">
              <section>
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-2xl font-black italic uppercase tracking-tight" style="color: var(--text-primary)">核心技术进阶</h2>
                  <div class="flex items-center gap-2 text-accent">
                    <ThumbsUp class="w-4 h-4" />
                    <span class="text-sm font-bold">1.2k 赞点</span>
                  </div>
                </div>
                <p class="leading-relaxed text-lg" style="color: var(--text-secondary)">
                  {{ courseData.description }}
                </p>
              </section>

              <section class="grid grid-cols-2 gap-6">
                <div class="p-6 rounded-[32px] border shadow-sm hover:shadow-md transition-all" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <div class="flex items-center gap-4 mb-4">
                    <div class="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                      <FileText class="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 class="font-bold" style="color: var(--text-primary)">相关资源</h3>
                  </div>
                  <div class="space-y-3">
                    <div v-for="res in resources" :key="res.name" class="flex items-center justify-between group cursor-pointer">
                      <span class="text-xs transition-colors" style="color: var(--text-secondary)">{{ res.name }}</span>
                      <Download class="w-3.5 h-3.5 group-hover:text-accent transition-colors" style="color: var(--text-muted)" />
                    </div>
                  </div>
                </div>

                <div class="p-6 rounded-[32px] border shadow-sm hover:shadow-md transition-all" style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <div class="flex items-center gap-4 mb-4">
                    <div class="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <MessageSquare class="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 class="font-bold" style="color: var(--text-primary)">最新提问</h3>
                  </div>
                  <div class="space-y-4">
                    <div v-for="comment in comments" :key="comment.user" class="flex items-start gap-3">
                      <img :src="comment.avatar" class="w-6 h-6 rounded-full object-cover">
                      <div>
                        <p class="text-[10px] font-bold" style="color: var(--text-secondary)">{{ comment.user }} · {{ comment.time }}</p>
                        <p class="text-[11px] mt-1 line-clamp-1" style="color: var(--text-primary)">{{ comment.content }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Syllabus Sidebar -->
      <aside class="w-[400px] shrink-0 border-l flex flex-col h-full transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
        <div class="p-6 border-b" style="border-color: var(--border-base)">
          <h2 class="font-black flex items-center gap-2" style="color: var(--text-primary)">
            课程目录
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold" style="background-color: var(--bg-app); color: var(--text-secondary)">2 / 12</span>
          </h2>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
          <div 
            v-for="item in courseData.syllabus" 
            :key="item.id"
            @click="handleLessonChange(item)"
            :style="currentLessonId !== item.id ? 'background-color: var(--bg-card); border-color: var(--border-base)' : ''"
            :class="[
              'group p-4 rounded-[24px] border-2 transition-all cursor-pointer relative',
              currentLessonId === item.id ? 'bg-accent border-accent shadow-lg text-white' : 'hover:opacity-80',
              item.locked ? 'opacity-40 cursor-not-allowed' : ''
            ]"
          >
            <div class="flex items-start gap-4">
              <div 
                :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
                  currentLessonId === item.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/5 group-hover:bg-slate-200 dark:group-hover:bg-white/10'
                ]"
              >
                <Lock v-if="item.locked" class="w-3.5 h-3.5" />
                <CheckCircle2 v-else-if="item.completed" class="w-4 h-4 text-emerald-500" />
                <span v-else class="text-[10px] font-black">{{ item.id }}</span>
              </div>

              <div class="flex-1">
                <h4 :class="['text-xs font-bold leading-snug']" :style="currentLessonId === item.id ? 'color: white' : 'color: var(--text-primary)'">{{ item.title }}</h4>
                <div class="flex items-center gap-3 mt-2">
                  <span :class="['text-[10px] font-black uppercase tracking-wider']" :style="currentLessonId === item.id ? 'color: white/60' : 'color: var(--text-secondary)'">{{ item.duration }}</span>
                  <div v-if="currentLessonId === item.id" class="px-2 py-0.5 rounded-full bg-white text-accent text-[8px] font-black italic">NOW PLAYING</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="p-6 border-t transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <button class="w-full py-4 rounded-full bg-slate-900 dark:bg-slate-800 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 transition-all">
            下载全部课件
          </button>
        </div>
      </aside>
    </main>
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

/* Specific player styling to enhance the vibe */
::selection {
  background: rgba(37, 99, 235, 0.3);
}

.lesson-card-active {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
}
</style>

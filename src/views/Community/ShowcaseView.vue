<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { 
  Search,
  MonitorPlay,
  Heart,
  MessageCircle,
  Share2,
  Play,
  Trophy,
  Flame,
  User,
  Eye,
  ChevronRight,
  Plus,
  X,
  UploadCloud
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const searchQuery = ref('')
const activeFilter = ref('热门')
const showcases = ref<any[]>([])
const isLoading = ref(false)

const filters = ['热门', '最新']

// Publish related
const isPublishDialogOpen = ref(false)
const isPublishing = ref(false)
const publishForm = ref({
  title: '',
  videoUrl: '',
  isVideo: false,
  thumbnail: null as File | null
})

const fetchShowcases = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/showcase', {
      params: { filter: activeFilter.value }
    })
    showcases.value = response.data
  } catch (error) {
    ElMessage.error('获取作品展示失败')
  } finally {
    isLoading.value = false
  }
}

const handleThumbnailChange = (e: any) => {
  const file = e.target.files[0]
  if (file) {
    publishForm.value.thumbnail = file
  }
}

const handlePublish = async () => {
  if (!publishForm.value.title) {
    ElMessage.warning('请输入作品标题')
    return
  }
  if (!publishForm.value.thumbnail) {
    ElMessage.warning('请上传作品封面图')
    return
  }

  isPublishing.value = true
  const formData = new FormData()
  formData.append('thumbnail', publishForm.value.thumbnail)
  formData.append('title', publishForm.value.title)
  formData.append('videoUrl', publishForm.value.videoUrl)
  formData.append('isVideo', String(publishForm.value.isVideo))

  try {
    await api.post('/api/showcase', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    ElMessage.success('作品已成功发布到展示墙')
    isPublishDialogOpen.value = false
    publishForm.value = { title: '', videoUrl: '', isVideo: false, thumbnail: null }
    fetchShowcases()
  } catch (error) {
    ElMessage.error('发布失败')
  } finally {
    isPublishing.value = false
  }
}

const toggleLike = async (item: any) => {
  try {
    const response = await api.post(`/api/showcase/${item.id}/like`)
    item.isLiked = response.data.liked
    item.likesCount += item.isLiked ? 1 : -1
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const filteredShowcases = computed(() => {
  return showcases.value.filter(s => 
    s.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    (s.user.name || s.user.email).toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

onMounted(fetchShowcases)
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b px-8 flex items-center justify-between shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          <MonitorPlay class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">作品展示</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-muted)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索优秀作品..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button @click="isPublishDialogOpen = true" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center gap-2">
          发布我的作品
        </button>
      </div>
    </div>

    <!-- Featured Banner (Static for now) -->
    <div class="px-8 py-6 shrink-0">
      <div class="relative h-48 rounded-3xl overflow-hidden bg-slate-900 group cursor-pointer">
        <img src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=1200&auto=format&fit=crop&q=80" class="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
        <div class="absolute inset-0 p-8 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent">
          <div class="flex items-center gap-2 mb-2">
            <span class="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">社区精选</span>
            <div class="flex items-center gap-1 text-white/60 text-xs">
              <Flame class="w-3 h-3 text-orange-500" /> 推荐作品
            </div>
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">展示你的 3D 创意</h2>
          <p class="text-white/70 text-sm max-w-xl">发布你的渲染成品或动画短片，与全球创作者交流心得，获得专业点评。</p>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="px-8 mb-6 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button 
          v-for="f in filters" 
          :key="f"
          @click="activeFilter = f; fetchShowcases()"
          class="px-5 py-1.5 rounded-full text-xs font-bold transition-all"
          :class="activeFilter === f ? 'bg-indigo-600 text-white shadow-md' : 'hover:opacity-80'"
          :style="activeFilter !== f ? 'color: var(--text-secondary); background-color: var(--bg-card)' : ''"
        >
          {{ f }}
        </button>
      </div>
      <div class="flex items-center gap-2 text-xs font-bold" style="color: var(--text-muted)">
        <Trophy class="w-4 h-4 text-amber-500" />
        年度优秀作品选拔进行中
        <ChevronRight class="w-3 h-3" />
      </div>
    </div>

    <!-- Showcase Grid -->
    <div class="flex-1 overflow-y-auto p-8 pt-0 scrollbar-hide">
      <div class="max-w-7xl mx-auto">
        <div v-if="filteredShowcases.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          <div v-for="item in filteredShowcases" :key="item.id" 
               class="group rounded-3xl border overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <!-- Cover -->
            <div class="aspect-video relative overflow-hidden" style="background-color: var(--bg-app)">
              <img :src="item.thumbnailUrl" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div v-if="item.isVideo" class="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                <Play class="w-2.5 h-2.5 fill-white" /> 视频
              </div>
              <div class="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>

            <!-- Content -->
            <div class="p-5 flex-1 flex flex-col">
              <h3 class="text-sm font-bold mb-4 line-clamp-1 group-hover:text-indigo-600 transition-colors" style="color: var(--text-primary)">{{ item.title }}</h3>
              
              <div class="flex items-center justify-between mt-auto">
                <div class="flex items-center gap-2">
                  <img :src="item.user.avatarUrl || `https://ui-avatars.com/api/?name=${item.user.name || item.user.email}`" class="w-6 h-6 rounded-full border" style="border-color: var(--border-base)" />
                  <span class="text-[11px] font-bold hover:opacity-80 cursor-pointer" style="color: var(--text-secondary)">{{ item.user.name || item.user.email }}</span>
                </div>
                
                <div class="flex items-center gap-3">
                  <button @click="toggleLike(item)" class="flex items-center gap-1 text-[10px] font-bold transition-all" :class="item.isLiked ? 'text-rose-500' : 'text-slate-400'">
                    <Heart class="w-3 h-3" :class="item.isLiked ? 'fill-rose-500' : ''" /> {{ item.likesCount }}
                  </button>
                  <div class="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <MessageCircle class="w-3 h-3" /> {{ item.commentsCount }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="h-64 flex flex-col items-center justify-center text-slate-400">
           <MonitorPlay class="w-12 h-12 mb-4 opacity-10" />
           <p class="text-sm font-bold">还没有人发布作品，成为第一个吧！</p>
        </div>
      </div>
    </div>

    <!-- Publish Dialog -->
    <Transition name="fade">
      <div v-if="isPublishDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="isPublishDialogOpen = false"></div>
        <div class="relative w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6" style="background-color: var(--bg-card)">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">发布新作品</h3>
            <button @click="isPublishDialogOpen = false" style="color: var(--text-secondary)"><X class="w-5 h-5" /></button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">作品标题</label>
              <input v-model="publishForm.title" type="text" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="给作品起个响亮的名字" />
            </div>

            <div>
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">封面图</label>
              <div class="relative group h-32">
                <input type="file" @change="handleThumbnailChange" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-indigo-500 group-hover:bg-indigo-500/5" style="border-color: var(--border-base)">
                  <UploadCloud class="w-6 h-6 text-indigo-500/40" />
                  <p class="text-xs font-medium" style="color: var(--text-secondary)">
                    {{ publishForm.thumbnail ? publishForm.thumbnail.name : '点击上传高清渲染图' }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 py-2">
              <el-switch v-model="publishForm.isVideo" active-color="var(--accent)" />
              <span class="text-xs font-bold" style="color: var(--text-secondary)">这是一个视频作品 (Unreal/Eevee 渲染)</span>
            </div>

            <div v-if="publishForm.isVideo">
              <label class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">视频链接 (可选)</label>
              <input v-model="publishForm.videoUrl" type="text" class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="请输入外部视频平台链接" />
            </div>
          </div>

          <button 
            @click="handlePublish"
            :disabled="isPublishing"
            class="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <div v-if="isPublishing" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            {{ isPublishing ? '正在发布...' : '立即发布作品' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

<script setup lang="ts">
import { ref } from 'vue'
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
  ChevronRight
} from 'lucide-vue-next'

const searchQuery = ref('')
const activeFilter = ref('热门')

const filters = ['热门', '最新', '精选', '挑战赛']

const showcases = [
  {
    id: 1,
    title: '虚幻引擎 5 森林实时渲染',
    author: '建模师小李',
    authorAvatar: 'https://i.pravatar.cc/150?img=11',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
    likes: '2.4k',
    comments: 156,
    views: '12k',
    isVideo: true
  },
  {
    id: 2,
    title: '未来城市概念设计 - 2077',
    author: 'Sarah.C',
    authorAvatar: 'https://i.pravatar.cc/150?img=32',
    thumbnail: 'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800&auto=format&fit=crop&q=60',
    likes: '1.8k',
    comments: 89,
    views: '8.5k',
    isVideo: false
  },
  {
    id: 3,
    title: '硬表面建模：科幻机甲手办',
    author: 'Alex Rivera',
    authorAvatar: 'https://i.pravatar.cc/150?img=12',
    thumbnail: 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=800&auto=format&fit=crop&q=60',
    likes: '3.1k',
    comments: 210,
    views: '15k',
    isVideo: true
  },
  {
    id: 4,
    title: '中式古建斗拱结构研究',
    author: '古风匠人',
    authorAvatar: 'https://i.pravatar.cc/150?img=13',
    thumbnail: 'https://images.unsplash.com/photo-1528154291023-a6525fabe5b4?w=800&auto=format&fit=crop&q=60',
    likes: '950',
    comments: 42,
    views: '3.2k',
    isVideo: false
  }
]
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
        <button class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center gap-2">
          发布我的作品
        </button>
      </div>
    </div>

    <!-- Featured Banner -->
    <div class="px-8 py-6 shrink-0">
      <div class="relative h-48 rounded-3xl overflow-hidden bg-slate-900 group cursor-pointer">
        <img src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=1200&auto=format&fit=crop&q=80" class="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
        <div class="absolute inset-0 p-8 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent">
          <div class="flex items-center gap-2 mb-2">
            <span class="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">今日精选</span>
            <div class="flex items-center gap-1 text-white/60 text-xs">
              <Flame class="w-3 h-3 text-orange-500" /> 2.4k 热度
            </div>
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">程序化环境生成的无限可能</h2>
          <p class="text-white/70 text-sm max-w-xl">探索如何利用几何节点与着色器编辑器，在几秒钟内生成一个完整的赛博朋克城市景观。</p>
        </div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
          <Play class="w-6 h-6 text-white fill-white" />
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="px-8 mb-6 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button 
          v-for="f in filters" 
          :key="f"
          @click="activeFilter = f"
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
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          <div v-for="item in showcases" :key="item.id" 
               class="group rounded-3xl border overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <!-- Cover -->
            <div class="aspect-video relative overflow-hidden" style="background-color: var(--bg-app)">
              <img :src="item.thumbnail" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
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
                  <img :src="item.authorAvatar" class="w-6 h-6 rounded-full border" style="border-color: var(--border-base)" />
                  <span class="text-[11px] font-bold hover:opacity-80 cursor-pointer" style="color: var(--text-secondary)">{{ item.author }}</span>
                </div>
                
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-1 text-[10px] font-bold" style="color: var(--text-muted)">
                    <Heart class="w-3 h-3 group-hover:text-rose-500 transition-colors" /> {{ item.likes }}
                  </div>
                  <div class="flex items-center gap-1 text-[10px] font-bold" style="color: var(--text-muted)">
                    <MessageCircle class="w-3 h-3" /> {{ item.comments }}
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
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

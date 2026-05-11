<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Heart, 
  MessageCircle, 
  Globe, 
  Lock,
  Edit3,
  Trash2,
  ExternalLink,
  X
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'

const searchQuery = ref('')
const activeTab = ref('全部作品')
const showAddModal = ref(false)

const tabs = ['全部作品', '已发布', '草稿箱', '私有']

const myWorks = ref([
  {
    id: 1,
    title: '赛博朋克霓虹街区',
    thumbnail: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=800&auto=format&fit=crop&q=60',
    status: '已发布',
    visibility: 'public',
    updatedAt: '2小时前',
    stats: { views: '1.2k', likes: 85, comments: 12 }
  },
  {
    id: 2,
    title: '写实室内绿植组合',
    thumbnail: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&auto=format&fit=crop&q=60',
    status: '已发布',
    visibility: 'public',
    updatedAt: '昨天',
    stats: { views: '450', likes: 32, comments: 5 }
  },
  {
    id: 3,
    title: '低多边形小岛场景',
    thumbnail: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&auto=format&fit=crop&q=60',
    status: '草稿箱',
    visibility: 'private',
    updatedAt: '3天前',
    stats: { views: '-', likes: '-', comments: '-' }
  },
  {
    id: 4,
    title: '硬表面机器人概念设计',
    thumbnail: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800&auto=format&fit=crop&q=60',
    status: '私有',
    visibility: 'private',
    updatedAt: '1周前',
    stats: { views: '12', likes: 0, comments: 0 }
  }
])

const filteredWorks = computed(() => {
  return myWorks.value.filter(work => {
    const matchesSearch = work.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesTab = activeTab.value === '全部作品' || work.status === activeTab.value
    return matchesSearch && matchesTab
  })
})

const handleAddWork = () => {
  const newWork = {
    id: Date.now(),
    title: '未命名项目 ' + (myWorks.value.length + 1),
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=60',
    status: '草稿箱',
    visibility: 'private',
    updatedAt: '刚刚',
    stats: { views: '0', likes: 0, comments: 0 }
  }
  myWorks.value.unshift(newWork)
  ElMessage.success('已创建新草稿项目')
}

const handleDeleteWork = (work: any) => {
  ElMessageBox.confirm(
    `确定要删除作品 "${work.title}" 吗？此操作无法撤销。`,
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    myWorks.value = myWorks.value.filter(w => w.id !== work.id)
    ElMessage.success('作品已删除')
  })
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b px-8 flex items-center justify-between shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">我的作品</h1>
        <span class="bg-accent-subtle text-accent text-[10px] font-bold px-2 py-0.5 rounded-full">共 {{ myWorks.length }} 个项目</span>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-secondary)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索我的作品..." 
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button @click="handleAddWork" class="bg-accent text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-lg shadow-accent/20 dark:shadow-none flex items-center gap-2">
          <Plus class="w-4 h-4" /> 上传作品
        </button>
      </div>
    </div>

    <!-- Tabs Area -->
    <div class="border-b px-8 py-2 shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-6">
        <button 
          v-for="tab in tabs" 
          :key="tab"
          @click="activeTab = tab"
          class="relative py-2 text-sm font-medium transition-all"
          :class="activeTab === tab ? 'text-accent' : 'hover:text-accent'"
          :style="activeTab !== tab ? 'color: var(--text-secondary)' : ''"
        >
          {{ tab }}
          <div v-if="activeTab === tab" class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"></div>
        </button>
      </div>
    </div>

    <!-- Works Grid Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto">
        <div v-if="filteredWorks.length > 0 || searchQuery" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div v-for="work in filteredWorks" :key="work.id" 
               class="group rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col relative"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <!-- Thumbnail -->
            <div class="aspect-[4/3] relative overflow-hidden" style="background-color: var(--bg-app)">
              <img :src="work.thumbnail" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              
              <!-- Visibility Overlay -->
              <div class="absolute top-3 left-3 flex gap-2">
                <div class="bg-black/40 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-white flex items-center gap-1">
                  <Globe v-if="work.visibility === 'public'" class="w-3 h-3" />
                  <Lock v-else class="w-3 h-3" />
                  {{ work.visibility === 'public' ? '公开' : '私有' }}
                </div>
              </div>

              <!-- Action Overlay -->
              <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button class="p-2.5 rounded-xl hover:bg-accent-subtle hover:text-accent transition-all shadow-lg"
                        style="background-color: var(--bg-card); color: var(--text-primary)">
                  <Edit3 class="w-5 h-5" />
                </button>
                <button @click="handleDeleteWork(work)" class="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-all shadow-lg"
                        style="background-color: var(--bg-card)">
                  <Trash2 class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Info Panel -->
            <div class="p-5 flex-1 flex flex-col">
              <div class="flex items-start justify-between mb-2">
                <h3 class="text-sm font-bold truncate pr-4" style="color: var(--text-primary)">{{ work.title }}</h3>
                <button class="hover:text-accent shrink-0" style="color: var(--text-secondary)">
                  <MoreHorizontal class="w-4 h-4" />
                </button>
              </div>
              
              <p class="text-[11px] mb-4" style="color: var(--text-secondary)">最后修改于 {{ work.updatedAt }}</p>

              <!-- Stats & Status -->
              <div class="mt-auto flex items-center justify-between pt-4 border-t" style="border-color: var(--border-base)">
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-1 text-[10px] font-bold" style="color: var(--text-secondary)">
                    <Eye class="w-3 h-3" /> {{ work.stats.views }}
                  </div>
                  <div class="flex items-center gap-1 text-[10px] font-bold" style="color: var(--text-secondary)">
                    <Heart class="w-3 h-3" /> {{ work.stats.likes }}
                  </div>
                </div>
                
                <span class="text-[10px] font-bold px-2 py-0.5 rounded"
                      :class="work.status === '已发布' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : work.status === '草稿箱' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : ''"
                      :style="work.status !== '已发布' && work.status !== '草稿箱' ? 'background-color: var(--bg-app); color: var(--text-secondary)' : ''">
                  {{ work.status }}
                </span>
              </div>
            </div>
          </div>

          <!-- Add New Placeholder Card -->
          <div @click="handleAddWork" class="border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 hover:border-accent hover:bg-accent-subtle hover:text-accent transition-all cursor-pointer group aspect-[4/3] h-full"
               style="border-color: var(--border-base); color: var(--text-secondary)">
            <div class="p-4 rounded-full mb-3 group-hover:bg-accent-subtle transition-colors" style="background-color: var(--bg-app)">
              <Plus class="w-8 h-8" />
            </div>
            <p class="text-sm font-bold">创建新项目</p>
            <p class="text-xs opacity-60 mt-1">点击创建新草稿</p>
          </div>
        </div>

        <!-- Empty Search Result -->
        <div v-else class="h-64 flex flex-col items-center justify-center rounded-3xl border" style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-secondary)">
          <Box class="w-12 h-12 mb-4 opacity-10" />
          <p class="text-sm">没有找到相关的作品</p>
          <button @click="searchQuery = ''; activeTab = '全部作品'" class="mt-4 text-xs text-accent font-bold hover:underline">
            清除所有过滤条件
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>

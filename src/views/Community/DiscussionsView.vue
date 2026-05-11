<script setup lang="ts">
import { ref } from 'vue'
import { Search, MessageSquare, ThumbsUp, Eye, Flame, Filter, Edit3, Image as ImageIcon, Video, Link as LinkIcon } from 'lucide-vue-next'

const categories = ['全部讨论', '技术问答', '资源分享', '日常交流', '作品点评']
const activeCategory = ref('全部讨论')
const showCreateModal = ref(false)
const isSelectingAsset = ref(false)

const postForm = ref({
  title: '',
  category: '技术问答',
  content: '',
  tags: [] as string[],
  selectedAssetId: null as number | null,
  visibility: 'public' as 'public' | 'team'
})

const myAssets = [
  { id: 101, title: '我的写实沙发', image: '/asset_sofa.png' },
  { id: 102, title: '盆栽模型 B', image: '/asset_plant.png' },
]

const posts = ref([
  {
    id: 1,
    author: { name: 'Alex', avatar: 'https://i.pravatar.cc/150?img=33' },
    title: '请教：如何在 Blender 中制作真实的玻璃材质？',
    excerpt: '我最近在尝试渲染一个香水瓶，但是玻璃的折射率和焦散总是调整得不自然，尤其是在 Cycles 渲染器下。有没有大佬分享一下节点连接思路或者推荐的教程？',
    tags: ['Blender', '材质节点', 'Cycles'],
    likes: 24,
    comments: 8,
    views: 342,
    isHot: true,
    time: '2小时前',
    type: 'discussion',
    visibility: 'public'
  },
  {
    id: 2,
    author: { name: 'Sarah', avatar: 'https://i.pravatar.cc/150?img=47' },
    title: '【作品展示】我的第一个赛博朋克风格场景渲染',
    excerpt: '练习了三个月，终于完成了这个稍微复杂点的场景。主要使用了几何节点来生成建筑细节，材质大部分是自制的 PBR。欢迎大家点评！',
    tags: ['作品集', '赛博朋克', '渲染'],
    likes: 156,
    comments: 42,
    views: 1205,
    isHot: true,
    time: '昨天',
    type: 'showcase',
    thumbnail: '/asset_sofa.png',
    visibility: 'public'
  },
  {
    id: 3,
    author: { name: 'David_Design', avatar: 'https://i.pravatar.cc/150?img=12' },
    title: '求助：导入的 FBX 模型法线反了怎么批量修复？',
    excerpt: '从其他软件导出的几十个 FBX 零件，导入到平台后发现很多面的法线是反的，一个个重计算太慢了，有什么插件或者快捷方法可以批量解决吗？',
    tags: ['工作流', 'FBX', '法线'],
    likes: 3,
    comments: 1,
    views: 56,
    isHot: false,
    time: '3天前',
    type: 'discussion',
    visibility: 'team'
  }
])

const handleSelectAsset = (asset: any) => {
  postForm.value.selectedAssetId = asset.id
  isSelectingAsset.value = false
}

const handleCreatePost = () => {
  // Mock adding a post
  const selectedAsset = myAssets.find(a => a.id === postForm.value.selectedAssetId)
  
  posts.value.unshift({
    id: Date.now(),
    author: { name: 'Current User', avatar: 'https://i.pravatar.cc/150?img=11' },
    title: postForm.value.title,
    excerpt: postForm.value.content,
    tags: ['新发布'],
    likes: 0,
    comments: 0,
    views: 0,
    isHot: false,
    time: '刚刚',
    type: selectedAsset ? 'showcase' : 'discussion',
    thumbnail: selectedAsset?.image,
    visibility: postForm.value.visibility
  })
  showCreateModal.value = false
  postForm.value = { title: '', category: '技术问答', content: '', tags: [], selectedAssetId: null, visibility: 'public' }
}
</script>

<template>
  <div class="flex flex-col h-full bg-white">
    <!-- Header -->
    <div class="h-16 border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div class="flex items-center gap-6">
        <h1 class="text-xl font-semibold text-slate-800">交流社区</h1>
        <div class="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg">
          <button v-for="cat in categories" :key="cat"
            @click="activeCategory = cat"
            class="px-3 py-1.5 text-xs rounded-md transition-all"
            :class="activeCategory === cat ? 'bg-white text-blue-600 font-medium shadow-sm' : 'text-slate-500 hover:text-slate-800'">
            {{ cat }}
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="搜索讨论..." 
            class="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-48 md:w-60 transition-all"
          />
        </div>
        <button 
          @click="showCreateModal = true"
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-blue-100"
        >
          <Edit3 class="w-4 h-4" /> 发起讨论
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto bg-[#f8fafc] p-6">
      <div class="max-w-4xl mx-auto space-y-4">
        
        <!-- Toolbar -->
        <div class="flex justify-between items-center mb-6">
          <div class="flex items-center gap-4">
            <h2 class="text-slate-800 font-semibold text-sm">最新动态</h2>
            <div class="h-4 w-px bg-slate-200"></div>
            <span class="text-xs text-slate-400">共 {{ posts.length * 420 }} 篇相关讨论</span>
          </div>
          <button class="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-xs font-medium bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm transition-colors">
            <Filter class="w-3.5 h-3.5" /> 排序: 最近更新
          </button>
        </div>

        <!-- Post Feed -->
        <div v-for="post in posts" :key="post.id" class="group bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-5">
          <!-- Left: User Avatar & Type Icon -->
          <div class="flex flex-col items-center gap-3 shrink-0">
            <div class="relative">
              <img :src="post.author.avatar" alt="Avatar" class="w-12 h-12 rounded-full border-2 border-slate-50 shadow-sm" />
              <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <ImageIcon v-if="post.type === 'showcase'" class="w-3 h-3 text-orange-500" />
                <MessageSquare v-else class="w-3 h-3 text-blue-500" />
              </div>
            </div>
          </div>

          <!-- Right: Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">{{ post.author.name }}</span>
              <span class="text-[11px] text-slate-400 font-medium">· {{ post.time }}</span>
              <div v-if="post.visibility === 'team'" class="flex items-center gap-1 text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-bold ml-2">
                <Users class="w-3 h-3 shrink-0" /> TEAM
              </div>
              <div v-if="post.isHot" class="flex items-center gap-1 text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded text-[10px] font-bold ml-2">
                <Flame class="w-3 h-3 shrink-0" /> HOT
              </div>
            </div>
            
            <div class="flex gap-4">
              <div class="flex-1">
                <h3 class="text-base font-bold text-slate-900 mb-2 leading-tight group-hover:text-blue-600 transition-colors truncate">
                  {{ post.title }}
                </h3>
                <p class="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed font-normal">
                  {{ post.excerpt }}
                </p>
              </div>
              <div v-if="post.type === 'showcase' && post.thumbnail" class="w-24 h-16 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden shrink-0 hidden sm:block">
                <img :src="post.thumbnail" class="w-full h-full object-cover mix-blend-multiply opacity-80 group-hover:scale-110 transition-transform duration-500" />
              </div>
            </div>
            
            <div class="flex items-center justify-between mt-auto">
              <!-- Tags -->
              <div class="flex gap-2">
                <span v-for="tag in post.tags" :key="tag" class="px-2 py-1 bg-slate-50 text-slate-500 text-[10px] font-medium rounded border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                  #{{ tag }}
                </span>
              </div>
              
              <!-- Stats -->
              <div class="flex items-center gap-4 text-slate-400 text-[11px] font-medium">
                <div class="flex items-center gap-1.5 hover:text-rose-500 transition-colors group/stat">
                  <ThumbsUp class="w-3.5 h-3.5 group-hover/stat:fill-rose-50" />
                  <span>{{ post.likes }}</span>
                </div>
                <div class="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                  <MessageSquare class="w-3.5 h-3.5" />
                  <span>{{ post.comments }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Eye class="w-3.5 h-3.5" />
                  <span>{{ post.views }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Post Modal -->
    <el-dialog
      v-model="showCreateModal"
      title="发布新讨论"
      width="600px"
      class="rounded-2xl overflow-hidden"
    >
      <div v-if="!isSelectingAsset" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">发布范围</label>
          <div class="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button 
              @click="postForm.visibility = 'public'"
              class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
              :class="postForm.visibility === 'public' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'"
            >
              公开社区
            </button>
            <button 
              @click="postForm.visibility = 'team'"
              class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
              :class="postForm.visibility === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'"
            >
              仅限团队
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">标题</label>
          <el-input v-model="postForm.title" placeholder="给你的讨论起个吸引人的标题..." />
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">分类</label>
            <el-select v-model="postForm.category" class="w-full">
              <el-option v-for="cat in categories.slice(1)" :key="cat" :label="cat" :value="cat" />
            </el-select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">关联资产 (可选)</label>
            <button 
              @click="isSelectingAsset = true"
              class="w-full h-[32px] border border-dashed border-slate-300 rounded-md text-[11px] font-medium text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
            >
              <Box v-if="!postForm.selectedAssetId" class="w-3.5 h-3.5" />
              <Check v-else class="w-3.5 h-3.5 text-emerald-500" />
              {{ postForm.selectedAssetId ? '已关联 1 个作品' : '从我的作品库选择' }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">内容</label>
          <el-input
            v-model="postForm.content"
            type="textarea"
            :rows="4"
            placeholder="分享你的想法、教程或遇到的问题..."
          />
        </div>
        
        <div class="flex gap-2">
          <button class="p-2 bg-slate-100 rounded-md text-slate-600 hover:bg-slate-200 transition-colors">
            <ImageIcon class="w-4 h-4" />
          </button>
          <button class="p-2 bg-slate-100 rounded-md text-slate-600 hover:bg-slate-200 transition-colors">
            <Video class="w-4 h-4" />
          </button>
          <button class="p-2 bg-slate-100 rounded-md text-slate-600 hover:bg-slate-200 transition-colors">
            <LinkIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Asset Selection View -->
      <div v-else class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-slate-800">选择要分享的作品</h3>
          <button @click="isSelectingAsset = false" class="text-xs text-blue-600 font-bold">返回编辑</button>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div 
            v-for="asset in myAssets" 
            :key="asset.id"
            @click="handleSelectAsset(asset)"
            class="group cursor-pointer border-2 rounded-xl p-2 transition-all hover:border-blue-300"
            :class="postForm.selectedAssetId === asset.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50'"
          >
            <div class="aspect-square rounded-lg overflow-hidden bg-white p-2 mb-2">
              <img :src="asset.image" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform" />
            </div>
            <p class="text-[10px] font-bold text-slate-700 truncate text-center">{{ asset.title }}</p>
          </div>
        </div>
      </div>

      <template #footer>
        <div v-if="!isSelectingAsset" class="flex justify-end gap-3">
          <el-button @click="showCreateModal = false">取消</el-button>
          <el-button type="primary" class="bg-blue-600" @click="handleCreatePost">发布讨论</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, MessageSquare, ThumbsUp, Eye, Flame, Filter, Edit3, Image as ImageIcon, Video, Link as LinkIcon, Box, Check, Users } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'

const categories = ['全部讨论', '技术问答', '资源分享', '日常交流', '作品点评']
const activeCategory = ref('全部讨论')
const showCreateModal = ref(false)
const isSelectingAsset = ref(false)
const searchQuery = ref('')

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
    hasLiked: false,
    comments: 8,
    views: 342,
    isHot: true,
    time: '2小时前',
    type: 'discussion' as 'discussion' | 'showcase',
    visibility: 'public',
    category: '技术问答'
  },
  {
    id: 2,
    author: { name: 'Sarah', avatar: 'https://i.pravatar.cc/150?img=47' },
    title: '【作品展示】我的第一个赛博朋克风格场景渲染',
    excerpt: '练习了三个月，终于完成了这个稍微复杂点的场景。主要使用了几何节点来生成建筑细节，材质大部分是自制的 PBR。欢迎大家点评！',
    tags: ['作品集', '赛博朋克', '渲染'],
    likes: 156,
    hasLiked: true,
    comments: 42,
    views: 1205,
    isHot: true,
    time: '昨天',
    type: 'showcase' as 'discussion' | 'showcase',
    thumbnail: '/asset_sofa.png',
    visibility: 'public',
    category: '作品点评'
  },
  {
    id: 3,
    author: { name: 'David_Design', avatar: 'https://i.pravatar.cc/150?img=12' },
    title: '求助：导入的 FBX 模型法线反了怎么批量修复？',
    excerpt: '从其他软件导出的几十个 FBX 零件，导入到平台后发现很多面的法线是反的，一个个重计算太慢了，有什么插件或者快捷方法可以批量解决吗？',
    tags: ['工作流', 'FBX', '法线'],
    likes: 3,
    hasLiked: false,
    comments: 1,
    views: 56,
    isHot: false,
    time: '3天前',
    type: 'discussion' as 'discussion' | 'showcase',
    visibility: 'team',
    category: '技术问答'
  }
])

const filteredPosts = computed(() => {
  return posts.value.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          post.excerpt.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = activeCategory.value === '全部讨论' || post.category === activeCategory.value
    return matchesSearch && matchesCategory
  })
})

const toggleLike = (post: any) => {
  if (post.hasLiked) {
    post.likes--
    post.hasLiked = false
  } else {
    post.likes++
    post.hasLiked = true
    ElMessage.success('感谢你的点赞！')
  }
}

const handleSelectAsset = (asset: any) => {
  postForm.value.selectedAssetId = asset.id
  isSelectingAsset.value = false
}

const handleCreatePost = () => {
  if (!postForm.value.title || !postForm.value.content) {
    ElMessage.warning('请填写完整的标题和内容')
    return
  }

  const selectedAsset = myAssets.find(a => a.id === postForm.value.selectedAssetId)
  
  posts.value.unshift({
    id: Date.now(),
    author: { name: '当前用户', avatar: 'https://i.pravatar.cc/150?img=11' },
    title: postForm.value.title,
    excerpt: postForm.value.content,
    tags: ['新发布'],
    likes: 0,
    hasLiked: false,
    comments: 0,
    views: 0,
    isHot: false,
    time: '刚刚',
    type: selectedAsset ? 'showcase' : 'discussion',
    thumbnail: selectedAsset?.image,
    visibility: postForm.value.visibility,
    category: postForm.value.category
  })
  showCreateModal.value = false
  postForm.value = { title: '', category: '技术问答', content: '', tags: [], selectedAssetId: null, visibility: 'public' }
  ElMessage.success('讨论发布成功！')
}
</script>

<template>
  <div class="flex flex-col h-full" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b flex items-center justify-between px-6 shrink-0 transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-6">
        <h1 class="text-xl font-semibold" style="color: var(--text-primary)">交流社区</h1>
        <div class="hidden lg:flex items-center p-1 rounded-lg transition-colors duration-300" style="background-color: var(--bg-app)">
          <button v-for="cat in categories" :key="cat"
            @click="activeCategory = cat"
            class="px-3 py-1.5 text-xs rounded-md transition-all"
            :class="activeCategory === cat ? 'bg-white dark:bg-accent text-accent dark:text-white font-bold shadow-sm' : 'hover:opacity-80'"
            :style="activeCategory !== cat ? 'color: var(--text-secondary)' : ''">
            {{ cat }}
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style="color: var(--text-muted)" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索讨论..." 
            class="pl-9 pr-4 py-2 border rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-48 md:w-60 transition-all"
            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
          />
        </div>
        <button 
          @click="showCreateModal = true"
          class="bg-accent hover:bg-accent text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-accent/20"
        >
          <Edit3 class="w-4 h-4" /> 发起讨论
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-6 scrollbar-hide">
      <div class="max-w-4xl mx-auto space-y-4">
        
        <!-- Toolbar -->
        <div class="flex justify-between items-center mb-6">
          <div class="flex items-center gap-4">
            <h2 class="font-semibold text-sm" style="color: var(--text-primary)">最新动态</h2>
            <div class="h-4 w-px" style="background-color: var(--border-base)"></div>
            <span class="text-xs" style="color: var(--text-secondary)">共 {{ filteredPosts.length }} 篇相关讨论</span>
          </div>
          <button class="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border shadow-sm transition-colors"
                  style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-secondary)">
            <Filter class="w-3.5 h-3.5" /> 排序: 最近更新
          </button>
        </div>

        <!-- Post Feed -->
        <div v-if="filteredPosts.length > 0" class="space-y-4">
          <div v-for="post in filteredPosts" :key="post.id" 
               class="group p-5 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-5"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            <!-- Left: User Avatar & Type Icon -->
            <div class="flex flex-col items-center gap-3 shrink-0">
              <div class="relative">
                <img :src="post.author.avatar" alt="Avatar" class="w-12 h-12 rounded-full border-2 shadow-sm" style="border-color: var(--bg-app)" />
                <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-sm"
                     style="background-color: var(--bg-card); border-color: var(--border-base)">
                  <ImageIcon v-if="post.type === 'showcase'" class="w-3 h-3 text-orange-500" />
                  <MessageSquare v-else class="w-3 h-3 text-accent" />
                </div>
              </div>
            </div>

            <!-- Right: Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-sm font-bold hover:text-accent transition-colors" style="color: var(--text-primary)">{{ post.author.name }}</span>
                <span class="text-[11px] font-medium" style="color: var(--text-secondary)">· {{ post.time }}</span>
                <div v-if="post.visibility === 'team'" class="flex items-center gap-1 text-accent dark:text-accent bg-accent-subtle dark:bg-accent-subtle px-1.5 py-0.5 rounded text-[10px] font-bold ml-2">
                  <Users class="w-3 h-3 shrink-0" /> TEAM
                </div>
                <div v-if="post.isHot" class="flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded text-[10px] font-bold ml-2">
                  <Flame class="w-3 h-3 shrink-0" /> HOT
                </div>
              </div>
              
              <div class="flex gap-4">
                <div class="flex-1">
                  <h3 class="text-base font-bold mb-2 leading-tight group-hover:text-accent transition-colors truncate" style="color: var(--text-primary)">
                    {{ post.title }}
                  </h3>
                  <p class="text-sm line-clamp-2 mb-4 leading-relaxed font-normal" style="color: var(--text-secondary)">
                    {{ post.excerpt }}
                  </p>
                </div>
                <div v-if="post.type === 'showcase' && post.thumbnail" class="w-24 h-16 rounded-lg border overflow-hidden shrink-0 hidden sm:block transition-colors duration-300"
                     style="background-color: var(--bg-app); border-color: var(--border-base)">
                  <img :src="post.thumbnail" class="w-full h-full object-cover dark:brightness-90 group-hover:scale-110 transition-transform duration-500" />
                </div>
              </div>
              
              <div class="flex items-center justify-between mt-auto">
                <!-- Tags -->
                <div class="flex gap-2">
                  <span v-for="tag in post.tags" :key="tag" 
                        class="px-2 py-1 text-[10px] font-bold rounded border group-hover:bg-accent-subtle dark:group-hover:bg-accent-subtle group-hover:text-accent dark:group-hover:text-accent group-hover:border-accent-subtle dark:group-hover:border-accent-subtle transition-colors"
                        style="background-color: var(--bg-app); color: var(--text-secondary); border-color: var(--border-base)">
                    #{{ tag }}
                  </span>
                </div>
                
                <!-- Stats -->
                <div class="flex items-center gap-4 text-[11px] font-bold" style="color: var(--text-muted)">
                  <div 
                    class="flex items-center gap-1.5 transition-colors group/stat"
                    :class="post.hasLiked ? 'text-rose-500' : 'hover:text-rose-500'"
                    @click.stop="toggleLike(post)"
                  >
                    <ThumbsUp class="w-3.5 h-3.5" :class="post.hasLiked ? 'fill-rose-500' : 'group-hover/stat:fill-rose-50'" />
                    <span>{{ post.likes }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 hover:text-accent transition-colors">
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

        <!-- Empty State -->
        <div v-else class="h-64 flex flex-col items-center justify-center rounded-2xl border transition-colors duration-300"
             style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-muted)">
          <MessageSquare class="w-12 h-12 mb-4 opacity-10" />
          <p class="text-sm">没有找到相关的讨论内容</p>
          <button @click="searchQuery = ''; activeCategory = '全部讨论'" class="mt-4 text-xs text-accent font-bold hover:underline">
            查看全部讨论
          </button>
        </div>
      </div>
    </div>

    <!-- Create Post Modal -->
    <el-dialog
      v-model="showCreateModal"
      title="发布新讨论"
      width="600px"
      class="custom-rounded-dialog"
    >
      <div v-if="!isSelectingAsset" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">发布范围</label>
          <div class="flex p-1 rounded-xl w-fit transition-colors duration-300" style="background-color: var(--bg-app)">
            <button 
              @click="postForm.visibility = 'public'"
              class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
              :class="postForm.visibility === 'public' ? 'bg-white dark:bg-accent text-accent dark:text-white shadow-sm' : ''"
              :style="postForm.visibility !== 'public' ? 'color: var(--text-secondary)' : ''"
            >
              公开社区
            </button>
            <button 
              @click="postForm.visibility = 'team'"
              class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
              :class="postForm.visibility === 'team' ? 'bg-white dark:bg-accent text-accent dark:text-white shadow-sm' : ''"
              :style="postForm.visibility !== 'team' ? 'color: var(--text-secondary)' : ''"
            >
              仅限团队
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">标题</label>
          <el-input v-model="postForm.title" placeholder="给你的讨论起个吸引人的标题..." />
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">分类</label>
            <el-select v-model="postForm.category" class="w-full">
              <el-option v-for="cat in categories.slice(1)" :key="cat" :label="cat" :value="cat" />
            </el-select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">关联资产 (可选)</label>
            <button 
              @click="isSelectingAsset = true"
              class="w-full h-[32px] border border-dashed rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-2"
              style="border-color: var(--border-strong); color: var(--text-secondary)"
            >
              <Box v-if="!postForm.selectedAssetId" class="w-3.5 h-3.5" />
              <Check v-else class="w-3.5 h-3.5 text-emerald-500" />
              {{ postForm.selectedAssetId ? '已关联 1 个作品' : '从我的作品库选择' }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1" style="color: var(--text-primary)">内容</label>
          <el-input
            v-model="postForm.content"
            type="textarea"
            :rows="4"
            placeholder="分享你的想法、教程或遇到的问题..."
          />
        </div>
        
        <div class="flex gap-2">
          <button class="p-2 rounded-md hover:opacity-80 transition-colors" style="background-color: var(--bg-app); color: var(--text-secondary)">
            <ImageIcon class="w-4 h-4" />
          </button>
          <button class="p-2 rounded-md hover:opacity-80 transition-colors" style="background-color: var(--bg-app); color: var(--text-secondary)">
            <Video class="w-4 h-4" />
          </button>
          <button class="p-2 rounded-md hover:opacity-80 transition-colors" style="background-color: var(--bg-app); color: var(--text-secondary)">
            <LinkIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Asset Selection View -->
      <div v-else class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-bold" style="color: var(--text-primary)">选择要分享的作品</h3>
          <button @click="isSelectingAsset = false" class="text-xs text-accent font-bold hover:underline">返回编辑</button>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div 
            v-for="asset in myAssets" 
            :key="asset.id"
            @click="handleSelectAsset(asset)"
            class="group cursor-pointer border-2 rounded-xl p-2 transition-all hover:border-accent dark:hover:border-accent"
            :class="postForm.selectedAssetId === asset.id ? 'border-accent dark:bg-accent-subtle/40' : 'border-transparent dark:bg-white/5'"
            :style="postForm.selectedAssetId !== asset.id ? 'background-color: var(--bg-app)' : ''"
          >
            <div class="aspect-square rounded-lg overflow-hidden p-2 mb-2 transition-colors duration-300" style="background-color: var(--bg-card)">
              <img :src="asset.image" class="w-full h-full object-contain dark:brightness-90 group-hover:scale-110 transition-transform" />
            </div>
            <p class="text-[10px] font-bold truncate text-center" style="color: var(--text-primary)">{{ asset.title }}</p>
          </div>
        </div>
      </div>

      <template #footer>
        <div v-if="!isSelectingAsset" class="flex justify-end gap-3">
          <el-button @click="showCreateModal = false">取消</el-button>
          <el-button type="primary" class="bg-accent border-none" @click="handleCreatePost">发布讨论</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

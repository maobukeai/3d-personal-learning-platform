<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Search, MessageSquare, Edit3, X } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'

const searchQuery = ref('')
const showCreateModal = ref(false)
const discussions = ref<any[]>([])
const isLoading = ref(false)

const pagination = ref({
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0
})

watch(searchQuery, () => {
  pagination.value.page = 1
  fetchDiscussions()
})

const postForm = ref({
  title: '',
  content: '',
})

const selectedDiscussion = ref<any>(null)
const isDetailOpen = ref(false)
const newComment = ref('')
const isSubmittingComment = ref(false)

const fetchDiscussions = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/api/discussions', {
      params: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        search: searchQuery.value
      }
    })
    discussions.value = response.data.discussions
    pagination.value = response.data.pagination
  } catch (error) {
    console.error('Fetch discussions error:', error)
  } finally {
    isLoading.value = false
  }
}

const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchDiscussions()
}

const filteredDiscussions = computed(() => {
  // Backend handles search now
  return discussions.value
})

const handleCreateDiscussion = async () => {
  if (!postForm.value.title || !postForm.value.content) {
    ElMessage.warning('请填写标题和内容')
    return
  }

  try {
    await api.post('/api/discussions', postForm.value)
    ElMessage.success('发布成功')
    showCreateModal.value = false
    postForm.value = { title: '', content: '' }
    fetchDiscussions()
  } catch (error) {
    ElMessage.error('发布失败')
  }
}

const openDiscussion = async (id: string) => {
  try {
    const response = await api.get(`/api/discussions/${id}`)
    selectedDiscussion.value = response.data
    isDetailOpen.value = true
  } catch (error) {
    ElMessage.error('无法加载讨论详情')
  }
}

const handleAddComment = async () => {
  if (!newComment.value) return
  isSubmittingComment.value = true
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: selectedDiscussion.value.id,
      content: newComment.value
    })
    selectedDiscussion.value.comments.push(response.data)
    newComment.value = ''
    ElMessage.success('评论已发表')
    fetchDiscussions() // Update comment count in list
  } catch (error) {
    ElMessage.error('发表评论失败')
  } finally {
    isSubmittingComment.value = false
  }
}

onMounted(() => {
  fetchDiscussions()
})
</script>

<template>
  <div class="flex flex-col h-full" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div class="h-16 border-b flex items-center justify-between px-6 shrink-0" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-6">
        <h1 class="text-xl font-semibold" style="color: var(--text-primary)">交流社区</h1>
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
        
        <div v-if="filteredDiscussions.length > 0" class="space-y-4">
          <div v-for="d in filteredDiscussions" :key="d.id" 
               @click="openDiscussion(d.id)"
               class="group p-5 rounded-xl border shadow-sm hover:shadow-md transition-all flex gap-5 cursor-pointer"
               style="background-color: var(--bg-card); border-color: var(--border-base)">
            
            <img :src="d.user?.avatarUrl || `https://ui-avatars.com/api/?name=${d.user?.name || 'User'}`" class="w-12 h-12 rounded-full shrink-0" />

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-sm font-bold" style="color: var(--text-primary)">{{ d.user?.name || '匿名用户' }}</span>
                <span class="text-[11px] font-medium" style="color: var(--text-secondary)">· {{ new Date(d.createdAt).toLocaleDateString() }}</span>
              </div>
              
              <h3 class="text-base font-bold mb-2 group-hover:text-accent transition-colors">{{ d.title }}</h3>
              <p class="text-sm line-clamp-2 mb-4" style="color: var(--text-secondary)">{{ d.content }}</p>
              
              <div class="flex items-center gap-4 text-[11px] font-bold" style="color: var(--text-muted)">
                <div class="flex items-center gap-1.5">
                  <MessageSquare class="w-3.5 h-3.5" />
                  <span>{{ d._count?.comments || 0 }} 回复</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="h-64 flex flex-col items-center justify-center rounded-2xl border transition-colors duration-300"
             style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-muted)">
          <MessageSquare class="w-12 h-12 mb-4 opacity-10" />
          <p class="text-sm">暂无讨论内容</p>
        </div>

        <!-- Pagination Footer -->
        <div v-if="pagination.totalPages > 1" class="py-8 flex justify-center">
          <el-pagination
            v-model:current-page="pagination.page"
            :page-size="pagination.limit"
            :total="pagination.total"
            layout="prev, pager, next"
            background
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Discussion Detail Modal -->
    <Transition name="fade">
      <div v-if="isDetailOpen && selectedDiscussion" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="isDetailOpen = false"></div>
        <div class="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden" style="background-color: var(--bg-card)">
          <!-- Modal Header -->
          <div class="p-6 border-b flex items-center justify-between shrink-0" style="border-color: var(--border-base)">
            <div class="flex items-center gap-3">
              <img :src="selectedDiscussion.user?.avatarUrl || `https://ui-avatars.com/api/?name=${selectedDiscussion.user?.name || 'User'}`" class="w-8 h-8 rounded-full" />
              <div>
                <p class="text-xs font-bold" style="color: var(--text-primary)">{{ selectedDiscussion.user?.name || '匿名用户' }}</p>
                <p class="text-[10px] text-slate-400">发表于 {{ new Date(selectedDiscussion.createdAt).toLocaleString() }}</p>
              </div>
            </div>
            <button @click="isDetailOpen = false" style="color: var(--text-secondary)"><X class="w-5 h-5" /></button>
          </div>

          <!-- Modal Scrollable Content -->
          <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
            <h2 class="text-2xl font-black mb-6" style="color: var(--text-primary)">{{ selectedDiscussion.title }}</h2>
            <div class="prose prose-sm dark:prose-invert max-w-none mb-12" style="color: var(--text-secondary); white-space: pre-wrap;">
              {{ selectedDiscussion.content }}
            </div>

            <!-- Comments Section -->
            <div class="space-y-8">
              <div class="flex items-center gap-2 border-b pb-4" style="border-color: var(--border-base)">
                <MessageSquare class="w-4 h-4 text-accent" />
                <h3 class="text-sm font-black uppercase tracking-widest">全部回复 ({{ selectedDiscussion.comments?.length || 0 }})</h3>
              </div>

              <div v-for="comment in selectedDiscussion.comments" :key="comment.id" class="flex gap-4">
                <img :src="comment.user?.avatarUrl || `https://ui-avatars.com/api/?name=${comment.user?.name || 'User'}`" class="w-8 h-8 rounded-full shrink-0" />
                <div class="flex-1 p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold" style="color: var(--text-primary)">{{ comment.user?.name || '匿名用户' }}</span>
                    <span class="text-[10px] text-slate-400">{{ new Date(comment.createdAt).toLocaleDateString() }}</span>
                  </div>
                  <p class="text-sm leading-relaxed" style="color: var(--text-secondary)">{{ comment.content }}</p>
                </div>
              </div>

              <div v-if="!selectedDiscussion.comments?.length" class="py-8 text-center text-slate-400 italic text-xs">
                暂无回复，快来抢沙发吧！
              </div>
            </div>
          </div>

          <!-- Comment Input Footer -->
          <div class="p-6 border-t bg-slate-50 dark:bg-white/5 shrink-0" style="border-color: var(--border-base)">
            <div class="flex gap-4">
              <input 
                v-model="newComment"
                type="text" 
                placeholder="撰写你的回复..." 
                class="flex-1 px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
                @keyup.enter="handleAddComment"
              />
              <button 
                @click="handleAddComment"
                :disabled="!newComment || isSubmittingComment"
                class="px-6 py-2 bg-accent text-white font-bold rounded-xl text-sm shadow-lg shadow-accent/20 disabled:opacity-50 transition-all"
              >
                发表
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Create Post Modal -->
    <Transition name="fade">
      <div v-if="showCreateModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showCreateModal = false"></div>
        <div class="relative w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6" style="background-color: var(--bg-card)">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">发布新讨论</h3>
            <button @click="showCreateModal = false" style="color: var(--text-secondary)"><X class="w-5 h-5" /></button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">标题</label>
              <input v-model="postForm.title" type="text" class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" placeholder="给讨论起个标题" />
            </div>
            
            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1" style="color: var(--text-secondary)">内容</label>
              <textarea v-model="postForm.content" rows="4" class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)" placeholder="你想说点什么？"></textarea>
            </div>
          </div>

          <button 
            @click="handleCreateDiscussion"
            class="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all flex items-center justify-center gap-2"
          >
            立即发布
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.scrollbar-hide::-webkit-scrollbar { display: none; }
</style>

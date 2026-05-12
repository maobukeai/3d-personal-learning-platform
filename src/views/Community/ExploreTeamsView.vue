<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Users, 
  Plus, 
  Search, 
  ArrowRight, 
  Sparkles, 
  Trophy, 
  Globe,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  Check,
  Send
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import CreateTeamDialog from '@/components/CreateTeamDialog.vue'
import api from '@/utils/api'
import { useWorkspaceStore } from '@/stores/workspace'

const router = useRouter()
const workspaceStore = useWorkspaceStore()

const isCreateTeamVisible = ref(false)
const searchQuery = ref('')
const isLoading = ref(false)
const publicTeams = ref<any[]>([])
const myTeamIds = ref<Set<string>>(new Set())
const applyingIds = ref<Set<string>>(new Set())

// Fetch both public teams and current user's memberships for badge logic
const fetchData = async () => {
  isLoading.value = true
  try {
    const [publicRes, myRes] = await Promise.all([
      api.get('/api/teams/public', { params: { search: searchQuery.value } }),
      api.get('/api/teams')
    ])
    publicTeams.value = publicRes.data
    myTeamIds.value = new Set(myRes.data.map((t: any) => t.id))
  } catch (error) {
    console.error('Fetch teams error:', error)
    ElMessage.error('获取小组失败')
  } finally {
    isLoading.value = false
  }
}

let debounceTimer: any = null
watch(searchQuery, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchData, 400)
})

const handleTeamCreated = (team: any) => {
  workspaceStore.fetchWorkspaces()
  // Navigate to the newly created team
  if (team?.id) {
    router.push(`/team/${team.id}`)
  } else {
    router.push('/dashboard')
  }
}

const handleApplyToJoin = async (group: any) => {
  if (myTeamIds.value.has(group.id)) {
    router.push(`/team/${group.id}`)
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `你正在申请加入 "${group.name}"，申请信息将发送给团队管理员。`,
      '申请加入团队',
      {
        confirmButtonText: '提交申请',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    applyingIds.value.add(group.id)
    await api.post('/api/teams/apply', { teamId: group.id })
    ElMessage.success(`申请已提交！等待 "${group.name}" 管理员审批`)
    fetchData()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '申请失败，请稍后重试')
    }
  } finally {
    applyingIds.value.delete(group.id)
  }
}

const handleViewTeam = (group: any) => {
  if (myTeamIds.value.has(group.id)) {
    router.push(`/team/${group.id}`)
  } else {
    handleApplyToJoin(group)
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-y-auto scrollbar-hide" style="background-color: var(--bg-app)">
    <!-- Header Section -->
    <div class="relative px-8 py-12 overflow-hidden bg-white dark:bg-slate-900 border-b" style="border-color: var(--border-base)">
      <div class="max-w-6xl mx-auto relative z-10">
        <button @click="router.back()" class="inline-flex items-center gap-2 text-slate-400 hover:text-accent transition-colors mb-8 group">
          <ChevronLeft class="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span class="text-xs font-bold uppercase tracking-widest">返回上一页</span>
        </button>

        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent rounded-full mb-4">
              <Sparkles class="w-3 h-3" />
              <span class="text-[10px] font-black uppercase tracking-wider">探索协作空间</span>
            </div>
            <h1 class="text-4xl font-black tracking-tight" style="color: var(--text-primary)">
              找到属于你的 <span class="text-accent">创意团队</span>
            </h1>
            <p class="mt-4 text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
              在这里，你可以创建自己的学习小组，或者加入志同道合的团队。共享 3D 资产、协作完成项目，共同见证创意的诞生。
            </p>
          </div>
        </div>
      </div>
      
      <!-- Background Decorative -->
      <div class="absolute -right-20 -top-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
    </div>

    <div class="px-8 py-10">
      <div class="max-w-6xl mx-auto space-y-12">
        <!-- Main Actions: Create vs Explore -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Create Team Card -->
          <div @click="isCreateTeamVisible = true" 
               class="group relative bg-white dark:bg-slate-800 p-8 rounded-[40px] border hover:border-accent hover:shadow-2xl transition-all cursor-pointer overflow-hidden"
               style="border-color: var(--border-base)">
            <div class="absolute -right-6 -top-6 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors"></div>
            
            <div class="relative z-10">
              <div class="w-16 h-16 bg-accent rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-accent/20 group-hover:scale-110 transition-transform">
                <Plus class="w-8 h-8 text-white" />
              </div>
              
              <h3 class="text-2xl font-black mb-3" style="color: var(--text-primary)">创建我的团队</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed max-w-xs">
                开启全新的协作篇章。作为创始人，你可以邀请成员、管理资产并主导项目进度。
              </p>
              
              <div class="flex items-center gap-2 font-bold text-accent group-hover:gap-4 transition-all">
                立即开始创建 <ArrowRight class="w-4 h-4" />
              </div>
            </div>
          </div>

          <!-- Benefits Card -->
          <div class="bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden flex flex-col justify-center">
            <div class="relative z-10 space-y-6">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Trophy class="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 class="font-bold text-lg">为什么要加入团队？</h4>
                  <p class="text-xs text-slate-400">协作学习效率提升 3 倍以上</p>
                </div>
              </div>
              
              <ul class="space-y-4">
                <li class="flex items-center gap-3">
                  <CheckCircle2 class="w-5 h-5 text-accent shrink-0" />
                  <span class="text-sm font-medium">访问团队专属的 3D 资产库</span>
                </li>
                <li class="flex items-center gap-3">
                  <CheckCircle2 class="w-5 h-5 text-accent shrink-0" />
                  <span class="text-sm font-medium">参与大型多人协作项目</span>
                </li>
                <li class="flex items-center gap-3">
                  <CheckCircle2 class="w-5 h-5 text-accent shrink-0" />
                  <span class="text-sm font-medium">获得资深成员的实时指导</span>
                </li>
              </ul>
            </div>
            <div class="absolute -right-20 -bottom-20 opacity-10 pointer-events-none">
              <Globe class="w-80 h-80 rotate-12" />
            </div>
          </div>
        </div>

        <!-- Exploration Section -->
        <div class="space-y-8">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h2 class="text-2xl font-black flex items-center gap-3" style="color: var(--text-primary)">
              <Globe class="w-6 h-6 text-accent" />
              探索公开小组
              <span class="text-sm font-normal text-slate-400">({{ publicTeams.length }} 个)</span>
            </h2>
            
            <div class="relative w-full md:w-80 group">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors" />
              <input 
                v-model="searchQuery"
                type="text" 
                placeholder="搜索小组名称或描述..."
                class="w-full pl-11 pr-4 py-3 border-2 rounded-2xl focus:border-accent outline-none transition-all text-sm"
                style="background-color: var(--bg-card); border-color: var(--border-base); color: var(--text-primary)"
              >
            </div>
          </div>

          <!-- Loading -->
          <div v-if="isLoading" class="flex flex-col items-center justify-center py-24">
            <Loader2 class="w-10 h-10 text-accent animate-spin mb-4" />
            <p class="text-sm font-bold text-slate-400">正在努力寻找小组...</p>
          </div>

          <!-- Team Grid -->
          <div v-else-if="publicTeams.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div 
              v-for="group in publicTeams" 
              :key="group.id"
              class="group relative bg-white dark:bg-slate-800 rounded-[32px] border overflow-hidden hover:shadow-2xl hover:border-accent/30 hover:-translate-y-2 transition-all duration-500 cursor-pointer"
              style="border-color: var(--border-base)"
              @click="handleViewTeam(group)"
            >
              <!-- Already Joined Badge -->
              <div v-if="myTeamIds.has(group.id)" class="absolute top-4 right-4 z-20 flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg">
                <Check class="w-3 h-3" /> 已加入
              </div>

              <div class="h-40 relative overflow-hidden">
                <img :src="group.avatarUrl || `https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=400&q=80`" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
              </div>
              
              <div class="p-6">
                <h3 class="font-black text-slate-900 dark:text-white text-lg group-hover:text-accent transition-colors truncate">{{ group.name }}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed" style="min-height: 2rem">
                  {{ group.description || '这个小组很神秘，还没有写下自我介绍。' }}
                </p>
                
                <div class="flex items-center justify-between mt-6 pt-5 border-t" style="border-color: var(--border-base)">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                      <Users class="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <span class="text-xs font-black block" style="color: var(--text-primary)">{{ group._count?.members || 0 }}</span>
                      <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">活跃成员</span>
                    </div>
                  </div>

                  <!-- Action Button -->
                  <div @click.stop>
                    <button v-if="myTeamIds.has(group.id)"
                      @click="router.push(`/team/${group.id}`)"
                      class="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all"
                    >
                      <ArrowRight class="w-4 h-4" /> 进入团队
                    </button>
                    <button v-else
                      @click="handleApplyToJoin(group)"
                      :disabled="applyingIds.has(group.id)"
                      class="flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-xl text-xs font-bold hover:bg-accent hover:text-white transition-all disabled:opacity-50"
                    >
                      <Send class="w-3.5 h-3.5" />
                      {{ applyingIds.has(group.id) ? '申请中...' : '申请加入' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="flex flex-col items-center justify-center py-24 rounded-[40px] border-2 border-dashed" style="border-color: var(--border-base)">
            <Users class="w-16 h-16 mb-6 opacity-10" style="color: var(--text-muted)" />
            <h4 class="text-lg font-bold" style="color: var(--text-primary)">暂未发现匹配的小组</h4>
            <p class="text-xs mt-2 text-slate-400">试着更换关键词，或者成为第一个创建小组的人！</p>
            <button @click="isCreateTeamVisible = true" class="mt-8 px-8 py-3 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all">
              创建小组
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Team Dialog -->
    <CreateTeamDialog 
      v-model:visible="isCreateTeamVisible"
      @success="handleTeamCreated"
    />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>

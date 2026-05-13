<script setup lang="ts">
import { ref, watch } from 'vue'
import { 
  X, 
  MapPin, 
  Calendar, 
  Box, 
  MessageSquare, 
  Link as LinkIcon 
} from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import api from '@/utils/api'
import { useRouter } from 'vue-router'
import UserAvatar from './UserAvatar.vue'

const props = defineProps<{
  modelValue: boolean
  userId: string | null
}>()

const emit = defineEmits(['update:modelValue', 'chat'])

const router = useRouter()
const userProfile = ref<any>(null)
const isLoading = ref(false)

const fetchProfile = async () => {
  if (!props.userId) return
  isLoading.value = true
  try {
    const response = await api.get(`/api/auth/users/${props.userId}`)
    userProfile.value = response.data
  } catch (error) {
    ElMessage.error('获取用户信息失败')
    emit('update:modelValue', false)
  } finally {
    isLoading.value = false
  }
}

watch(() => props.modelValue, (val) => {
  if (val && props.userId) {
    fetchProfile()
  } else if (!val) {
    userProfile.value = null
  }
})

const startChat = () => {
  if (!userProfile.value) return
  emit('chat', userProfile.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    width="440px"
    class="custom-dialog profile-dialog"
    :show-close="false"
    destroy-on-close
    append-to-body
  >
    <div v-if="isLoading" class="py-20 text-center">
      <div class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
    </div>
    <template v-else-if="userProfile">
      <div class="h-32 bg-gradient-to-br from-accent to-indigo-600 relative -mx-8 -mt-6 mb-12">
        <button @click="emit('update:modelValue', false)" class="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-xl hover:bg-black/40 transition-all">
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="px-2 pb-2 -mt-20 relative">
        <UserAvatar :user="userProfile" size="xl" class="shadow-xl mb-4" />
        <div class="flex items-center justify-between mb-2">
          <div>
            <h3 class="text-2xl font-bold" style="color: var(--text-primary)">{{ userProfile.name || '未命名用户' }}</h3>
            <p class="text-sm" style="color: var(--text-muted)">{{ userProfile.email }}</p>
          </div>
          <div class="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-bold">
            {{ userProfile.role === 'ADMIN' ? '管理员' : '正式成员' }}
          </div>
        </div>

        <p class="text-sm mt-4 mb-6 italic" style="color: var(--text-secondary)">
          {{ userProfile.bio || '这位小伙伴很神秘，什么都没写~' }}
        </p>

        <div class="grid grid-cols-2 gap-4 mb-8">
          <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
            <div class="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
              <MapPin class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] text-slate-400 font-bold uppercase">所在地</p>
              <p class="text-xs font-bold truncate" style="color: var(--text-primary)">{{ userProfile.location || '未知' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
            <div class="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
              <Calendar class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] text-slate-400 font-bold uppercase">加入时间</p>
              <p class="text-xs font-bold truncate" style="color: var(--text-primary)">{{ new Date(userProfile.createdAt).toLocaleDateString() }}</p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-around py-6 border-y mb-8" style="border-color: var(--border-base)">
          <div class="text-center">
            <div class="flex items-center gap-2 mb-1 justify-center">
              <Box class="w-4 h-4 text-accent" />
              <span class="text-xl font-black" style="color: var(--text-primary)">{{ userProfile._count?.assets || 0 }}</span>
            </div>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">发布资产</p>
          </div>
          <div class="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
          <div class="text-center">
            <div class="flex items-center gap-2 mb-1 justify-center">
              <MessageSquare class="w-4 h-4 text-emerald-500" />
              <span class="text-xl font-black" style="color: var(--text-primary)">{{ userProfile._count?.discussions || 0 }}</span>
            </div>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">发起讨论</p>
          </div>
          <div v-if="userProfile.website" class="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
          <div v-if="userProfile.website" class="text-center">
            <a :href="userProfile.website" target="_blank" class="flex items-center gap-2 mb-1 justify-center group">
              <LinkIcon class="w-4 h-4 text-orange-500 group-hover:scale-110 transition-all" />
            </a>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">个人主页</p>
          </div>
        </div>

        <button 
          @click="startChat" 
          class="w-full py-4 bg-accent text-white rounded-2xl font-black shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <MessageSquare class="w-5 h-5" />
          立即联系
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style>
.custom-dialog {
  border-radius: 2rem !important;
  overflow: hidden;
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-base) !important;
}
.profile-dialog .el-dialog__header {
  display: none;
}
.profile-dialog .el-dialog__body {
  padding: 1.5rem 2rem 2rem;
}
</style>

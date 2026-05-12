<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Users, Check, Loader2 } from 'lucide-vue-next'
import api from '@/utils/api'

const props = defineProps<{
  visible: boolean
  invitationId: string | null
}>()

const emit = defineEmits(['update:visible', 'success'])

const invitation = ref<any>(null)
const loading = ref(false)
const processing = ref(false)

const fetchInvitation = async () => {
  if (!props.invitationId) return
  loading.value = true
  try {
    // We can use the getMyInvitations endpoint and find the specific one
    const { data } = await api.get('/api/teams/invitations/my')
    invitation.value = data.find((i: any) => i.id === props.invitationId)
    if (!invitation.value) {
      ElMessage.warning('该邀请已失效或不存在')
      emit('update:visible', false)
    }
  } catch (error) {
    ElMessage.error('获取邀请详情失败')
    emit('update:visible', false)
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal && props.invitationId) {
    fetchInvitation()
  }
})

const handleRespond = async (accept: boolean) => {
  if (!props.invitationId) return
  processing.value = true
  try {
    await api.post('/api/teams/invitations/respond', {
      invitationId: props.invitationId,
      accept
    })
    ElMessage.success(accept ? '已成功加入团队！' : '已拒绝邀请')
    emit('success', { accept, teamId: invitation.value?.teamId })
    emit('update:visible', false)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败')
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="(val: any) => emit('update:visible', val)"
    title="团队加入邀请"
    width="440px"
    class="custom-rounded-dialog"
    :show-close="!processing"
    :close-on-click-modal="!processing"
  >
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <Loader2 class="w-10 h-10 text-accent animate-spin mb-4" />
      <p class="text-sm font-bold text-slate-400">正在加载邀请信息...</p>
    </div>

    <div v-else-if="invitation" class="space-y-8 py-2">
      <div class="flex flex-col items-center text-center space-y-4">
        <div class="w-24 h-24 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800">
          <img v-if="invitation.team.avatarUrl" :src="invitation.team.avatarUrl" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full bg-gradient-to-br from-accent to-accent-subtle flex items-center justify-center text-white text-3xl font-black">
            {{ invitation.team.name.charAt(0).toUpperCase() }}
          </div>
        </div>
        
        <div class="space-y-1">
          <h3 class="text-xl font-black text-slate-900 dark:text-white">{{ invitation.team.name }}</h3>
          <p class="text-sm text-slate-500">邀请你加入协作团队</p>
        </div>
      </div>

      <div class="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Users class="w-5 h-5 text-accent" />
          </div>
          <div class="flex-1 text-left">
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-0.5">团队成员</p>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-200">加入后即可访问团队项目与资源</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 pt-2">
        <button 
          @click="handleRespond(false)"
          :disabled="processing"
          class="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50"
        >
          暂时拒绝
        </button>
        <button 
          @click="handleRespond(true)"
          :disabled="processing"
          class="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-accent hover:shadow-xl hover:shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
          <Check v-else class="w-5 h-5" />
          接受加入
        </button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
</style>

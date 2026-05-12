<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Users, Check } from 'lucide-vue-next'

import api from '@/utils/api'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['update:visible', 'success'])

const teamName = ref('')
const teamDescription = ref('')
const teamCategory = ref('建模')
const teamType = ref('public')
const loading = ref(false)

const categories = ['建模', '渲染', '动画', '材质', '游戏引擎']

const handleClose = () => {
  emit('update:visible', false)
}

const handleCreate = async () => {
  if (!teamName.value) {
    ElMessage.warning('请输入团队名称')
    return
  }
  
  loading.value = true
  try {
    const { data: team } = await api.post('/api/teams', {
      name: teamName.value,
      description: teamDescription.value,
      category: teamCategory.value,
      visibility: teamType.value === 'public' ? 'PUBLIC' : 'PRIVATE'
    })
    ElMessage.success('团队创建成功！')
    emit('success', team)  // pass team object so caller can navigate to /team/:id
    handleClose()
    // Reset form
    teamName.value = ''
    teamDescription.value = ''
    teamType.value = 'public'
  } catch (error) {
    ElMessage.error('创建团队失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="(val: any) => emit('update:visible', val)"
    title="创建新团队"
    width="500px"
    class="custom-rounded-dialog"
    :show-close="true"
  >
    <div class="space-y-6 py-2">
      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">团队名称</label>
        <input 
          v-model="teamName"
          type="text" 
          placeholder="例如：3D 建模进阶小组"
          class="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-accent focus:ring-4 focus:ring-accent-subtle outline-none transition-all placeholder:text-slate-300"
        >
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">团队描述</label>
        <textarea 
          v-model="teamDescription"
          rows="3"
          placeholder="简要介绍一下你的团队..."
          class="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-accent focus:ring-4 focus:ring-accent-subtle outline-none transition-all resize-none placeholder:text-slate-300"
        ></textarea>
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">团队分类</label>
        <el-select v-model="teamCategory" class="w-full custom-select" placeholder="选择团队分类">
          <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </div>

      <div class="space-y-2">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">团队类型</label>
        <div class="grid grid-cols-2 gap-4">
          <button 
            @click="teamType = 'public'"
            :class="teamType === 'public' ? 'border-accent bg-accent-subtle/50' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'"
            class="flex flex-col items-start p-4 border-2 rounded-2xl transition-all text-left group"
          >
            <div class="flex items-center justify-between w-full mb-2">
              <Users class="w-5 h-5" :class="teamType === 'public' ? 'text-accent' : 'text-slate-400'" />
              <div v-if="teamType === 'public'" class="w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-lg shadow-accent/20">
                <Check class="w-3 h-3 text-white" />
              </div>
            </div>
            <span class="text-sm font-black text-slate-900">公开</span>
          </button>

          <button 
            @click="teamType = 'private'"
            :class="teamType === 'private' ? 'border-accent bg-accent-subtle/50' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'"
            class="flex flex-col items-start p-4 border-2 rounded-2xl transition-all text-left group"
          >
            <div class="flex items-center justify-between w-full mb-2">
              <Plus class="w-5 h-5" :class="teamType === 'private' ? 'text-accent' : 'text-slate-400'" />
              <div v-if="teamType === 'private'" class="w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-lg shadow-accent/20">
                <Check class="w-3 h-3 text-white" />
              </div>
            </div>
            <span class="text-sm font-black text-slate-900">私密</span>
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-3 pt-2">
        <button 
          @click="handleClose"
          class="px-6 py-2.5 rounded-full font-bold text-slate-500 hover:bg-slate-100 transition-colors"
        >
          取消
        </button>
        <button 
          @click="handleCreate"
          :disabled="loading"
          class="px-8 py-2.5 rounded-full font-bold text-white bg-accent hover:bg-accent shadow-xl shadow-accent/20 transition-all disabled:opacity-50 active:scale-95"
        >
          {{ loading ? '创建中...' : '立即创建' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Users, Star, ArrowRight } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import GroupDetailDialog from '@/components/GroupDetailDialog.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['update:visible'])

const searchQuery = ref('')
const selectedCategory = ref('全部')
const showDetail = ref(false)
const selectedGroup = ref<any>(null)

const categories = ['全部', '建模', '渲染', '动画', '材质', '游戏引擎']

const handleJoinGroup = (groupName: string) => {
  ElMessage.success(`申请加入小组 "${groupName}" 成功！`)
}

const handleViewDetails = (group: any) => {
  selectedGroup.value = group
  showDetail.value = true
}

const groups = [
  {
    id: 1,
    name: '3D 建模大师班',
    description: '深入探讨 Blender 和 ZBrush 建模技巧。',
    members: 1250,
    rating: 4.9,
    category: '建模',
    image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 2,
    name: 'UE5 开发者联盟',
    description: '专注于 Unreal Engine 5 高级功能研究。',
    members: 840,
    rating: 4.8,
    category: '游戏引擎',
    image: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=400&auto=format&fit=crop&q=60'
  },
  {
    id: 3,
    name: '材质与渲染艺术',
    description: '探索 Octane 和 Substance 的极致表现。',
    members: 620,
    rating: 4.7,
    category: '渲染',
    image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&auto=format&fit=crop&q=60'
  }
]

const filteredGroups = computed(() => {
  return groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          group.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = selectedCategory.value === '全部' || group.category === selectedCategory.value
    return matchesSearch && matchesCategory
  })
})
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="val => emit('update:visible', val)"
    title="探索学习小组"
    width="840px"
    class="custom-rounded-dialog"
  >
    <div class="space-y-8">
      <div class="relative group">
        <Search class="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-accent transition-all" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索小组名称或关键词..."
          class="pl-14 pr-6 py-4 w-full rounded-2xl border-2 border-slate-100 focus:border-accent focus:ring-4 focus:ring-accent-subtle outline-none transition-all text-base placeholder:text-slate-300"
        >
      </div>

      <div class="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <button 
          v-for="cat in categories" 
          :key="cat"
          @click="selectedCategory = cat"
          :class="selectedCategory === cat ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700'"
          class="px-6 py-2 rounded-full border-2 font-black text-xs transition-all whitespace-nowrap uppercase tracking-wider"
        >
          {{ cat }}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          v-for="group in filteredGroups" 
          :key="group.id"
          @click="handleViewDetails(group)"
          class="group bg-white rounded-[32px] border-2 border-slate-50 overflow-hidden hover:shadow-2xl hover:border-accent/10 hover:-translate-y-2 transition-all duration-500 cursor-pointer"
        >
          <div class="h-32 relative">
            <img :src="group.image" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" :alt="group.name">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
          </div>
          
          <div class="p-5">
            <h3 class="font-black text-slate-900 group-hover:text-accent transition-colors truncate">{{ group.name }}</h3>
            <p class="text-xs text-slate-500 mt-2 line-clamp-1 italic font-medium">
              {{ group.description }}
            </p>
            
            <div class="flex items-center justify-between mt-5 pt-4 border-t border-slate-50">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-accent-subtle flex items-center justify-center">
                  <Users class="w-4 h-4 text-accent" />
                </div>
                <span class="text-xs font-black text-slate-700">{{ group.members }}</span>
              </div>
              <button 
                @click.stop="handleJoinGroup(group.name)"
                class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:!bg-accent hover:!text-white hover:rotate-[-45deg] transition-all duration-300"
              >
                <ArrowRight class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Dialog -->
    <GroupDetailDialog 
      v-model:visible="showDetail" 
      :group="selectedGroup"
      @join="handleJoinGroup"
    />
  </el-dialog>
</template>

<style scoped>
</style>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Search, Users, ArrowRight, Loader2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import GroupDetailDialog from '@/components/GroupDetailDialog.vue';
import api from '@/utils/api';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible']);

const searchQuery = ref('');
const selectedCategory = ref('全部');
const showDetail = ref(false);
const selectedGroup = ref<any>(null);
const isLoading = ref(false);
const publicTeams = ref<any[]>([]);

const categories = ['全部', '建模', '渲染', '动画', '材质', '游戏引擎'];

const fetchPublicTeams = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/teams/public', {
      params: {
        search: searchQuery.value,
        category: selectedCategory.value,
      },
    });
    publicTeams.value = response.data;
  } catch (error) {
    console.error('Fetch public teams error:', error);
    ElMessage.error('获取小组失败');
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) fetchPublicTeams();
  },
);

watch(searchQuery, () => {
  fetchPublicTeams();
});

watch(selectedCategory, () => {
  fetchPublicTeams();
});

const handleJoinGroup = (groupName: string) => {
  ElMessage.success(`申请加入小组 "${groupName}" 成功！请等待管理员审核。`);
};

const handleViewDetails = (group: any) => {
  selectedGroup.value = group;
  showDetail.value = true;
};

const filteredGroups = computed(() => {
  return publicTeams.value;
});

onMounted(() => {
  if (props.visible) fetchPublicTeams();
});
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="探索学习小组"
    width="840px"
    class="custom-rounded-dialog"
    @update:model-value="(val: any) => emit('update:visible', val)"
  >
    <div class="space-y-8">
      <div class="relative group">
        <Search
          class="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-accent transition-all"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索小组名称或关键词..."
          class="pl-14 pr-6 py-4 w-full rounded-2xl border-2 border-slate-100 focus:border-accent focus:ring-4 focus:ring-accent-subtle outline-none transition-all text-base placeholder:text-slate-300"
        />
      </div>

      <div class="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <button
v-for="cat in categories" :key="cat" type="button" :class="
            selectedCategory === cat
              ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
              : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700'
          " class="px-6 py-2 rounded-full border-2 font-black text-xs transition-all whitespace-nowrap uppercase tracking-wider" @click="selectedCategory = cat">
          {{ cat }}
        </button>
      </div>

      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <Loader2 class="w-10 h-10 text-accent animate-spin mb-4" />
        <p class="text-sm font-bold text-slate-400">正在搜寻优秀的小组...</p>
      </div>

      <div v-else-if="filteredGroups.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="group in filteredGroups"
          :key="group.id"
          class="group bg-white rounded-[32px] border-2 border-slate-50 overflow-hidden hover:shadow-2xl hover:border-accent/10 hover:-translate-y-2 transition-all duration-500 cursor-pointer"
          @click="handleViewDetails(group)"
        >
          <div class="h-32 relative">
            <img
:src="
                group.avatarUrl ||
                'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&auto=format&fit=crop&q=60'
              " class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" :alt="group.name" />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
            ></div>
          </div>

          <div class="p-5">
            <h3
              class="font-black text-slate-900 group-hover:text-accent transition-colors truncate"
            >
              {{ group.name }}
            </h3>
            <p class="text-xs text-slate-500 mt-2 line-clamp-1 italic font-medium">
              {{ group.description || '暂无小组描述' }}
            </p>

            <div class="flex items-center justify-between mt-5 pt-4 border-t border-slate-50">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-accent-subtle flex items-center justify-center">
                  <Users class="w-4 h-4 text-accent" />
                </div>
                <span class="text-xs font-black text-slate-700">{{
                  group._count?.members || 0
                }}</span>
              </div>
              <button type="button" class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:!bg-accent hover:!text-white hover:rotate-[-45deg] transition-all duration-300" @click.stop="handleJoinGroup(group.name)">
                <ArrowRight class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-20 text-slate-400">
        <Users class="w-12 h-12 mb-4 opacity-10" />
        <p class="text-sm font-bold">暂无公开小组，试着创建一个吧！</p>
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

<style scoped></style>

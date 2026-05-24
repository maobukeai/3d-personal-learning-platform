<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search, Plus, User as UserIcon } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'start-chat', user: any): void;
}>();

const { t } = useI18n();
const userSearchQuery = ref('');
const publicUsers = ref<any[]>([]);
const isLoadingUsers = ref(false);

const filteredPublicUsers = computed(() => {
  const query = userSearchQuery.value.toLowerCase();
  return publicUsers.value.filter(
    (u) => (u.name || '').toLowerCase().includes(query) || u.email.toLowerCase().includes(query),
  );
});

const fetchPublicUsers = async () => {
  isLoadingUsers.value = true;
  try {
    const response = await api.get('/api/auth/users/public');
    publicUsers.value = response.data;
  } catch (error) {
    console.error('Fetch users error:', error);
    ElMessage.error('获取用户列表失败');
  } finally {
    isLoadingUsers.value = false;
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val && publicUsers.value.length === 0) {
      fetchPublicUsers();
    }
  },
);

const handleStartChat = (user: any) => {
  emit('start-chat', user);
};

const handleClose = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('messages.startNewChat') || '发起新聊天'"
    width="min(400px, 95%)"
    class="custom-dialog"
    :show-close="true"
    destroy-on-close
    @update:model-value="handleClose"
  >
    <div class="space-y-4">
      <div class="relative">
        <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="userSearchQuery"
          type="text"
          placeholder="搜索用户姓名或邮箱..."
          class="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
          style="color: var(--text-primary)"
        />
      </div>

      <div class="max-h-64 overflow-y-auto scrollbar-hide space-y-1">
        <div v-if="isLoadingUsers" class="py-6 text-center">
          <div
            class="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-1"
          ></div>
        </div>

        <div
          v-for="user in filteredPublicUsers"
          :key="user.id"
          class="p-2 flex items-center gap-2.5 rounded-xl hover:bg-accent/10 cursor-pointer transition-all group"
          @click.stop="handleStartChat(user)"
        >
          <UserAvatar :user="user" size="sm" />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold truncate" style="color: var(--text-primary)">
              {{ user.name || '未命名用户' }}
            </p>
            <p class="text-[9px] text-slate-400 truncate">{{ user.email }}</p>
          </div>
          <div
            class="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all shrink-0"
          >
            <Plus class="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          v-if="filteredPublicUsers.length === 0 && !isLoadingUsers"
          class="py-6 text-center text-slate-400"
        >
          <UserIcon class="w-6 h-6 mx-auto mb-1.5 opacity-10" />
          <p class="text-xs">未找到匹配的用户</p>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

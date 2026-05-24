<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Search, Plus, Users, X } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'create-group', payload: { name: string; participantIds: string[] }): void;
}>();

const groupChatName = ref('');
const groupChatParticipants = ref<any[]>([]);
const groupChatSearchQuery = ref('');
const publicUsers = ref<any[]>([]);
const isLoadingUsers = ref(false);

const filteredGroupUsers = computed(() => {
  const query = groupChatSearchQuery.value.toLowerCase();
  return publicUsers.value.filter((u) => {
    const isAlreadyAdded = groupChatParticipants.value.some((p) => p.id === u.id);
    return (
      !isAlreadyAdded &&
      ((u.name || '').toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    );
  });
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
    if (val) {
      groupChatName.value = '';
      groupChatParticipants.value = [];
      groupChatSearchQuery.value = '';
      if (publicUsers.value.length === 0) {
        fetchPublicUsers();
      }
    }
  },
);

const addGroupParticipant = (user: any) => {
  if (!groupChatParticipants.value.some((p) => p.id === user.id)) {
    groupChatParticipants.value.push(user);
  }
};

const removeGroupParticipant = (userId: string) => {
  groupChatParticipants.value = groupChatParticipants.value.filter((p) => p.id !== userId);
};

const handleCreateGroup = () => {
  if (!groupChatName.value.trim()) {
    ElMessage.warning('请输入群聊名称');
    return;
  }
  if (groupChatParticipants.value.length === 0) {
    ElMessage.warning('请选择至少一名成员');
    return;
  }
  emit('create-group', {
    name: groupChatName.value.trim(),
    participantIds: groupChatParticipants.value.map((p) => p.id),
  });
};

const handleClose = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="创建群聊"
    width="min(440px, 95%)"
    class="custom-dialog"
    :show-close="true"
    destroy-on-close
    @update:model-value="handleClose"
  >
    <div class="space-y-3.5">
      <div>
        <label
          class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block"
          style="color: var(--text-muted)"
          >群聊名称</label
        >
        <input
          v-model="groupChatName"
          type="text"
          placeholder="输入群聊名称..."
          class="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          style="color: var(--text-primary)"
        />
      </div>

      <!-- Selected Members -->
      <div v-if="groupChatParticipants.length > 0">
        <label
          class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block"
          style="color: var(--text-muted)"
          >已选择 ({{ groupChatParticipants.length }})</label
        >
        <div class="flex flex-wrap gap-1 max-h-20 overflow-y-auto scrollbar-hide py-0.5">
          <div
            v-for="user in groupChatParticipants"
            :key="user.id"
            class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
            style="
              background-color: var(--bg-app);
              color: var(--text-primary);
              border: 1px solid var(--border-base);
            "
          >
            <UserAvatar :user="user" size="xs" />
            <span class="max-w-[80px] md:max-w-[120px] truncate text-[11px]">{{ user.name || user.email }}</span>
            <button type="button" class="hover:text-rose-500 transition-colors" @click="removeGroupParticipant(user.id)">
              <X class="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <label
          class="text-[10px] font-bold uppercase tracking-wider mb-1.5 block"
          style="color: var(--text-muted)"
          >添加成员</label
        >
        <div class="relative mb-2">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="groupChatSearchQuery"
            type="text"
            placeholder="搜索用户..."
            class="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            style="color: var(--text-primary)"
          />
        </div>

        <div class="max-h-40 overflow-y-auto scrollbar-hide space-y-1">
          <div v-if="isLoadingUsers" class="py-6 text-center">
            <div
              class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-1"
            ></div>
          </div>

          <div
            v-for="user in filteredGroupUsers"
            :key="user.id"
            class="p-2 flex items-center gap-2.5 rounded-lg hover:bg-indigo-500/10 cursor-pointer transition-all group"
            @click="addGroupParticipant(user)"
          >
            <UserAvatar :user="user" size="sm" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold truncate" style="color: var(--text-primary)">
                {{ user.name || '未命名用户' }}
              </p>
              <p class="text-[9px] text-slate-400 truncate">{{ user.email }}</p>
            </div>
            <div
              class="w-7 h-7 rounded-lg bg-indigo-500/5 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0"
            >
              <Plus class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      <button type="button" :disabled="!groupChatName.trim() || groupChatParticipants.length === 0" class="w-full py-2.5 bg-indigo-500 text-white rounded-lg font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-xs hover:scale-102" @click="handleCreateGroup">
        <Users class="w-3.5 h-3.5" />
        创建群聊
      </button>
    </div>
  </el-dialog>
</template>

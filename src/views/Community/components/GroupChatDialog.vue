<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search, Plus, Users, X } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';
import type { User } from '@/types';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'create-group', payload: { name: string; participantIds: string[] }): void;
}>();

const { t } = useI18n();
const groupChatName = ref('');
const groupChatParticipants = ref<User[]>([]);
const groupChatSearchQuery = ref('');
const publicUsers = ref<User[]>([]);
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
    ElMessage.error(t('community.teamDetail.fetchFailed'));
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

const addGroupParticipant = (user: User) => {
  if (!groupChatParticipants.value.some((p) => p.id === user.id)) {
    groupChatParticipants.value.push(user);
  }
};

const removeGroupParticipant = (userId: string) => {
  groupChatParticipants.value = groupChatParticipants.value.filter((p) => p.id !== userId);
};

const handleCreateGroup = () => {
  if (!groupChatName.value.trim()) {
    ElMessage.warning(t('team.nameRequired'));
    return;
  }
  if (groupChatParticipants.value.length === 0) {
    ElMessage.warning(t('community.teamDetail.selectMemberWarning') || '请选择至少一名成员');
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
  <Modal
    :show="modelValue"
    :title="t('community.chat.groupChat') || '发起群聊'"
    size="sm"
    @close="handleClose"
  >
    <div class="space-y-4">
      <div>
        <label
          class="text-[10px] font-bold uppercase tracking-wider mb-2 block"
          style="color: var(--text-muted)"
          >{{ t('messages.groupName') }}</label
        >
        <Input v-model="groupChatName" :placeholder="t('messages.groupName') + '...'" />
      </div>

      <!-- Selected Members -->
      <div v-if="groupChatParticipants.length > 0">
        <label
          class="text-[10px] font-bold uppercase tracking-wider mb-2 block"
          style="color: var(--text-muted)"
          >{{
            t('community.teamDetail.selectedCount', { n: groupChatParticipants.length }) || '已选择'
          }}
          ({{ groupChatParticipants.length }})</label
        >
        <div class="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-hide py-0.5">
          <div
            v-for="user in groupChatParticipants"
            :key="user.id"
            class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-white/5 text-[var(--text-primary)] border border-[var(--border-base)]"
          >
            <UserAvatar :user="user" size="xs" />
            <span class="max-w-[80px] md:max-w-[120px] truncate text-[11px]">{{
              user.name || user.email
            }}</span>
            <button
              type="button"
              class="hover:text-rose-500 transition-colors cursor-pointer"
              @click="removeGroupParticipant(user.id)"
            >
              <X class="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <label
          class="text-[10px] font-bold uppercase tracking-wider mb-2 block"
          style="color: var(--text-muted)"
          >{{ t('community.teamDetail.addMemberTitle') }}</label
        >
        <div class="mb-2">
          <Input
            v-model="groupChatSearchQuery"
            :placeholder="t('community.teamDetail.searchUserPlaceholder')"
            :icon="Search"
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
                {{ user.name || t('community.chat.unnamedUser') }}
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

      <div class="pt-2">
        <Button
          variant="primary"
          size="md"
          full-width
          :disabled="!groupChatName.trim() || groupChatParticipants.length === 0"
          :icon="Users"
          @click="handleCreateGroup"
        >
          {{ t('community.chat.groupChat') }}
        </Button>
      </div>
    </div>
  </Modal>
</template>

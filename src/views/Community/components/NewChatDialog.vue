<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search, Plus, User as UserIcon } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { ElMessage } from '@/utils/feedbackBridge';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';

interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'start-chat', user: ChatUser): void;
}>();

const { t } = useI18n();
const userSearchQuery = ref('');
const publicUsers = ref<ChatUser[]>([]);
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
    publicUsers.value = ((response.data || []) as ChatUser[]).map((user) => ({
      ...user,
      name: user.name || user.email,
    }));
  } catch (error) {
    logError(error, { operation: 'chat.fetchPublicUsers', component: 'NewChatDialog' });
    ElMessage.error(t('community.teamDetail.fetchFailed'));
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

const handleStartChat = (user: ChatUser) => {
  emit('start-chat', user);
};

const handleClose = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <Modal
    :show="modelValue"
    :title="t('messages.startNewChat') || '发起新聊天'"
    size="sm"
    class="mobile-adaptive"
    @close="handleClose"
  >
    <div class="space-y-4">
      <div>
        <Input
          v-model="userSearchQuery"
          :placeholder="t('community.teamDetail.searchUserPlaceholder')"
          :icon="Search"
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
              {{ user.name || t('community.chat.unnamedUser') }}
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
          <p class="text-xs">{{ t('search.noResults', { query: userSearchQuery }) }}</p>
        </div>
      </div>
    </div>
  </Modal>
</template>

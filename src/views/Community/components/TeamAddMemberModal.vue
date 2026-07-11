<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useCommunityI18n } from '@/composables/useCommunityI18n';
import { Search, Mail, Plus } from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import { getApiErrorMessage, logError } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import type { TeamUser } from './teamDetailTypes';

const props = defineProps<{
  show: boolean;
  teamId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'added'): void;
}>();

const { t } = useCommunityI18n();

const userSearchQuery = ref('');
const searchResults = ref<TeamUser[]>([]);
const isSearchingUsers = ref(false);
const inviteEmailInput = ref('');

const searchUsers = async () => {
  if (!userSearchQuery.value) {
    searchResults.value = [];
    return;
  }
  isSearchingUsers.value = true;
  try {
    const { data } = await api.get(`/api/auth/users/public?search=${userSearchQuery.value}`);
    searchResults.value = data;
  } catch (error) {
    logError(error, { operation: 'team.searchUsers', component: 'TeamAddMemberModal' });
  } finally {
    isSearchingUsers.value = false;
  }
};

let _searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(userSearchQuery, () => {
  if (_searchTimer) clearTimeout(_searchTimer);
  _searchTimer = setTimeout(searchUsers, 300);
});

onUnmounted(() => {
  if (_searchTimer) clearTimeout(_searchTimer);
});

const handleAddUser = async (user: TeamUser) => {
  try {
    await api.post('/api/teams/invite', {
      teamId: props.teamId,
      inviteeEmail: user.email,
    });
    ElMessage.success(t('teamDetail.inviteSent', { name: user.name }));
    userSearchQuery.value = '';
    searchResults.value = [];
    emit('added');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('teamDetail.inviteFailed')));
  }
};

const handleSendInvite = async () => {
  if (!inviteEmailInput.value) return;
  try {
    await api.post('/api/teams/invite', {
      teamId: props.teamId,
      inviteeEmail: inviteEmailInput.value,
    });
    ElMessage.success(t('teamDetail.inviteSent', { name: inviteEmailInput.value }));
    inviteEmailInput.value = '';
    emit('added');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('teamDetail.inviteFailed')));
  }
};
</script>

<template>
  <Modal :show="show" size="md" @close="$emit('close')">
    <template #header>
      <div>
        <h3
          class="text-xl md:text-2xl font-black tracking-tight"
          style="color: var(--text-primary)"
        >
          {{ t('teamDetail.addMemberTitle') }}
        </h3>
        <p class="text-xs text-[var(--text-secondary)] opacity-75 font-semibold mt-1">
          {{ t('teamDetail.addMemberSubtitle') }}
        </p>
      </div>
    </template>

    <div class="space-y-6">
      <!-- Search Users -->
      <div class="space-y-3">
        <label
          class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1"
        >
          {{ t('teamDetail.internalSearchLabel') }}
        </label>
        <div class="relative group">
          <Search
            class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors"
          />
          <input
            v-model="userSearchQuery"
            type="text"
            :placeholder="t('teamDetail.searchUserPlaceholder')"
            class="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-sm focus:border-accent dark:focus:border-accent focus:bg-white dark:focus:bg-slate-950 outline-none transition-all duration-300 shadow-2xs focus:shadow-md focus:shadow-accent/5"
            style="color: var(--text-primary)"
          />
        </div>

        <!-- Search Results -->
        <div
          v-if="searchResults.length > 0"
          class="max-h-56 overflow-y-auto space-y-2 p-1 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl scrollbar-hide border border-slate-100 dark:border-slate-800/40"
        >
          <div
            v-for="user in searchResults"
            :key="user.id"
            class="flex items-center justify-between p-3 bg-white/70 dark:bg-slate-900/40 rounded-lg border border-slate-100/80 dark:border-slate-800/40 hover:border-accent/50 dark:hover:border-accent/50 hover:bg-white dark:hover:bg-slate-900 hover:shadow-xs transition-all duration-300 group"
          >
            <div class="flex items-center gap-3">
              <UserAvatar :user="user" size="md" />
              <div>
                <p class="text-sm font-bold" style="color: var(--text-primary)">
                  {{ user.name }}
                </p>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  {{ user.email }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="p-2 bg-accent/15 hover:bg-accent text-accent hover:text-white rounded-lg transition-all duration-300 shadow-sm active:scale-90"
              @click="handleAddUser(user)"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div
          v-else-if="userSearchQuery && !isSearchingUsers"
          class="text-center py-4 text-slate-400 dark:text-slate-500 text-xs italic font-medium"
        >
          {{ t('teamDetail.noUsersFound') }}
        </div>
      </div>

      <!-- Divider -->
      <div class="relative flex items-center justify-center my-2">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-slate-100 dark:border-slate-800/80"></div>
        </div>
        <span
          class="relative px-4 bg-white/90 dark:bg-slate-900/90 rounded-full text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] backdrop-blur-md"
        >
          {{ t('teamDetail.orLabel') }}
        </span>
      </div>

      <!-- Email Invite -->
      <div class="space-y-3">
        <label
          class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1"
        >
          {{ t('teamDetail.emailInviteLabel') }}
        </label>
        <div class="flex gap-3">
          <div class="relative flex-1 group">
            <Mail
              class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors"
            />
            <input
              v-model="inviteEmailInput"
              type="email"
              placeholder="example@email.com"
              class="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-sm focus:border-accent dark:focus:border-accent focus:bg-white dark:focus:bg-slate-950 outline-none transition-all duration-300 shadow-2xs focus:shadow-md focus:shadow-accent/5"
              style="color: var(--text-primary)"
            />
          </div>
          <Button
            variant="primary"
            size="lg"
            :disabled="!inviteEmailInput"
            class="shrink-0"
            @click="handleSendInvite"
          >
            {{ t('teamDetail.sendBtn') }}
          </Button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Search,
  Users,
  MessageSquare,
  MoreHorizontal,
  UserPlus,
  ShieldCheck,
  Circle,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import UserAvatar from '@/components/UserAvatar.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import api from '@/utils/api';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import type { User } from '@/types';

const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

const searchQuery = ref('');
const activeFilter = ref('all');
const members = ref<User[]>([]);
const isLoading = ref(false);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

onMounted(async () => {
  if (workspaceStore.activeTeamId) {
    router.replace(`/team/${workspaceStore.activeTeamId}`);
  } else if (authStore.user?.role !== 'ADMIN') {
    // If not in a team context and not an admin, redirect to dashboard
    // Regular users should not see the platform-wide member list
    router.replace('/dashboard');
  } else {
    await fetchMembers();
  }
});

const filters = ['all', 'ADMIN', 'USER'];
const roleLabels = computed<Record<string, string>>(() => ({
  all: t('members.all'),
  ADMIN: t('members.roleAdmin'),
  USER: t('members.roleUser'),
}));

const fetchMembers = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/auth/users/public');
    members.value = response.data;
  } catch (_error) {
    ElMessage.error(t('members.fetchFailed'));
  } finally {
    isLoading.value = false;
  }
};

const filteredMembers = computed(() => {
  return members.value.filter((member) => {
    const name = (member.name || '').toLowerCase();
    const email = member.email.toLowerCase();
    const matchesSearch =
      name.includes(searchQuery.value.toLowerCase()) ||
      email.includes(searchQuery.value.toLowerCase());
    const matchesFilter = activeFilter.value === 'all' || member.role === activeFilter.value;
    return matchesSearch && matchesFilter;
  });
});

const handleChatWithMember = async (member: User) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [member.id],
      isGroup: false,
    });
    router.push('/messages');
  } catch (_error) {
    ElMessage.error(t('members.chatInitFailed'));
  }
};

// fetchMembers is now handled in the top-level onMounted for redirection logic
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div
      class="min-h-16 py-4 lg:h-16 lg:py-0 border-b px-4 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-purple-50 rounded-lg">
          <Users class="w-5 h-5 text-purple-600" />
        </div>
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">{{ t('members.platformTitle') }}</h1>
      </div>

      <div class="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
        <div class="relative flex-1 lg:flex-none">
          <Search
            class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--text-muted)"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('members.searchPlaceholder')"
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-full lg:w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button type="button" class="bg-accent text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-lg shadow-accent/20 flex items-center gap-2 shrink-0">
          <UserPlus class="w-4 h-4" /> <span class="hidden sm:inline">{{ t('members.invitePartner') }}</span>
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div
      class="border-b px-4 sm:px-8 py-2 shrink-0 overflow-x-auto scrollbar-hide transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2 min-w-max">
        <button
v-for="filter in filters" :key="filter" type="button" class="px-4 py-1.5 rounded-lg text-sm font-bold transition-all" :class="
            activeFilter === filter ? 'bg-slate-800 dark:bg-accent text-white' : 'hover:opacity-80'
          " :style="
            activeFilter !== filter
              ? 'color: var(--text-secondary); background-color: var(--bg-app)'
              : ''
          " @click="activeFilter = filter">
          {{ roleLabels[filter] || filter }}
        </button>
      </div>
    </div>

    <!-- Members List Area -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div
        class="max-w-none rounded-3xl border shadow-sm overflow-hidden transition-colors duration-300"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <!-- Desktop Table -->
        <table class="hidden md:table w-full text-left border-collapse">
          <thead>
            <tr
              class="border-b transition-colors duration-300"
              style="background-color: var(--bg-app); border-color: var(--border-base)"
            >
              <th
                class="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                style="color: var(--text-muted)"
              >
                {{ t('members.info') }}
              </th>
              <th
                class="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                style="color: var(--text-muted)"
              >
                {{ t('members.role') }}
              </th>
              <th
                class="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                style="color: var(--text-muted)"
              >
                {{ t('members.status') }}
              </th>
              <th
                class="px-6 py-4 text-xs font-bold uppercase tracking-wider"
                style="color: var(--text-muted)"
              >
                {{ t('members.joinTime') }}
              </th>
              <th
                class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right"
                style="color: var(--text-muted)"
              >
                {{ t('members.action') }}
              </th>
            </tr>
          </thead>
          <tbody
            class="divide-y transition-colors duration-300"
            style="border-color: var(--border-base)"
          >
            <tr
              v-for="member in filteredMembers"
              :key="member.id"
              class="hover:opacity-90 transition-colors group"
            >
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <UserAvatar
                    :user="member"
                    size="md"
                    class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
                    @click="openUserProfile(member.id)"
                  />
                  <div>
                    <p
                      class="text-sm font-bold cursor-pointer hover:text-accent transition-colors"
                      style="color: var(--text-primary)"
                      @click="openUserProfile(member.id)"
                    >
                      {{ member.name || t('members.noNickname') }}
                    </p>
                    <p class="text-xs" style="color: var(--text-muted)">{{ member.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-1.5">
                  <ShieldCheck v-if="member.role === 'ADMIN'" class="w-3.5 h-3.5 text-accent" />
                  <span class="text-xs font-bold" style="color: var(--text-secondary)">{{
                    roleLabels[member.role] || member.role
                  }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <Circle
                    class="w-2 h-2 fill-current"
                    :class="
                      authStore.isUserOnline(member.id) ? 'text-emerald-500' : 'text-slate-300'
                    "
                  />
                  <span class="text-xs font-bold" style="color: var(--text-secondary)">{{
                    authStore.isUserOnline(member.id) ? t('members.online') : t('members.offline')
                  }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-xs font-bold" style="color: var(--text-secondary)">
                {{ new Date(member.createdAt).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 text-right">
                <div
                  class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <button type="button" class="p-2 hover:text-accent hover:bg-accent-subtle rounded-lg transition-all" style="color: var(--text-muted)" :title="t('members.sendMessage')" @click="handleChatWithMember(member)">
                    <MessageSquare class="w-4 h-4" />
                  </button>
                  <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all" style="color: var(--text-muted)">
                    <MoreHorizontal class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Mobile Card Grid (2 Columns) -->
        <div class="md:hidden grid grid-cols-2 gap-3 p-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div
            v-for="member in filteredMembers"
            :key="member.id"
            class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-4 flex flex-col items-center text-center shadow-sm relative group min-w-0"
          >
            <!-- Online status dot in top-right -->
            <div class="absolute top-3 right-3 flex items-center gap-1 shrink-0">
              <Circle
                class="w-1.5 h-1.5 fill-current"
                :class="
                  authStore.isUserOnline(member.id) ? 'text-emerald-500' : 'text-slate-300'
                "
              />
              <span class="text-[9px] font-bold" style="color: var(--text-secondary)">{{
                authStore.isUserOnline(member.id) ? t('members.online') : t('members.offline')
              }}</span>
            </div>

            <!-- Avatar -->
            <div class="mt-2 mb-3 shrink-0">
              <UserAvatar
                :user="member"
                size="md"
                class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
                @click="openUserProfile(member.id)"
              />
            </div>

            <!-- Name & Email -->
            <h3
              class="text-xs sm:text-sm font-bold truncate w-full cursor-pointer hover:text-accent transition-colors"
              style="color: var(--text-primary)"
              @click="openUserProfile(member.id)"
            >
              {{ member.name || t('members.noNickname') }}
            </h3>
            <p class="text-[9px] sm:text-[10px] text-muted-foreground truncate w-full mb-3" style="color: var(--text-muted)">
              {{ member.email }}
            </p>

            <!-- Role Badge -->
            <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[9px] font-bold mb-4 shrink-0">
              <ShieldCheck v-if="member.role === 'ADMIN'" class="w-2.5 h-2.5 text-accent" />
              <span style="color: var(--text-secondary)">{{
                roleLabels[member.role] || member.role
              }}</span>
            </div>

            <!-- Action Buttons -->
            <div class="w-full flex gap-1.5 mt-auto">
              <button type="button" class="flex-1 py-1.5 bg-accent text-white rounded-xl text-[10px] font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1" @click="handleChatWithMember(member)">
                <MessageSquare class="w-3 h-3" /> {{ t('members.sendMessage') }}
              </button>
              <button type="button" class="px-2 py-1.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-[var(--border-base)] transition-all hover:bg-slate-200 dark:hover:bg-white/10 shrink-0" style="color: var(--text-secondary)" @click="openUserProfile(member.id)">
                <MoreHorizontal class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleChatWithMember"
    />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>

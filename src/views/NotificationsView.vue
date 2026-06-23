<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  Bell,
  CheckCheck,
  Trash2,
  Search,
  MessageSquare,
  Users,
  Briefcase,
  Info,
  ChevronRight,
  Inbox,
  Loader2,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { logError } from '@/utils/error';

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

const { t } = useI18n();
const router = useRouter();
const notifications = ref<NotificationItem[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const activeFilter = ref('all');
const activeCategory = ref('all');

const fetchNotifications = async () => {
  try {
    isLoading.value = true;
    const type = activeCategory.value === 'all' ? '' : activeCategory.value;
    const response = await api.get(`/api/notifications${type ? `?type=${type}` : ''}`);
    notifications.value = response.data.notifications || [];
  } catch (error) {
    logError(error, { operation: 'notifications.fetch', component: 'NotificationsView' });
    ElMessage.error(t('notifications.fetch_failed'));
  } finally {
    isLoading.value = false;
  }
};

const handleCategoryChange = (catId: string) => {
  activeCategory.value = catId;
  activeFilter.value = 'all';
  fetchNotifications();
};

const filteredNotifications = computed(() => {
  let result = notifications.value;

  if (activeFilter.value === 'unread') {
    result = result.filter((n) => !n.isRead);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (n) => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query),
    );
  }

  return result;
});

const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length);

const processingInvitations = ref<Record<string, boolean>>({});
const respondedInvitations = ref<Record<string, 'ACCEPTED' | 'REJECTED'>>({});

const getInvitationIdFromLink = (link?: string | null) => {
  if (!link) return null;
  try {
    const url = new URL(link, window.location.origin);
    return url.searchParams.get('invitationId');
  } catch {
    const match = link.match(/[?&]invitationId=([^&]+)/);
    return match ? match[1] : null;
  }
};

const handleProjectInvitation = async (notification: NotificationItem, accept: boolean) => {
  const inviteId = getInvitationIdFromLink(notification.link);
  if (!inviteId) {
    ElMessage.warning(t('notifications.get_invite_id_failed'));
    return;
  }

  processingInvitations.value[notification.id] = true;
  try {
    const endpoint = accept ? 'accept' : 'reject';
    await api.post(`/api/projects/invitations/${inviteId}/${endpoint}`);
    respondedInvitations.value[notification.id] = accept ? 'ACCEPTED' : 'REJECTED';
    ElMessage.success(
      accept
        ? t('notifications.invitation_accept_success')
        : t('notifications.invitation_reject_success'),
    );

    // Auto mark notification as read
    if (!notification.isRead) {
      await api.put(`/api/notifications/${notification.id}/read`);
      notification.isRead = true;
    }
  } catch (error) {
    logError(error, {
      operation: 'notifications.handleInvitation',
      component: 'NotificationsView',
    });
    ElMessage.error(
      accept
        ? t('notifications.invitation_accept_failed')
        : t('notifications.invitation_reject_failed'),
    );
  } finally {
    processingInvitations.value[notification.id] = false;
  }
};

const handleMarkAsRead = async (notification: NotificationItem) => {
  if (!notification.isRead) {
    try {
      await api.put(`/api/notifications/${notification.id}/read`);
      notification.isRead = true;
    } catch (error) {
      logError(error, { operation: 'notifications.markRead', component: 'NotificationsView' });
    }
  }

  if (notification.link && notification.type !== 'PROJECT_INVITE') {
    router.push(notification.link);
  }
};

const handleMarkAllRead = async () => {
  try {
    await api.put('/api/notifications/read-all');
    notifications.value.forEach((n) => (n.isRead = true));
    ElMessage.success(t('notifications.mark_all_success'));
  } catch {
    ElMessage.error(t('notifications.mark_all_failed'));
  }
};

const handleDeleteAll = async () => {
  try {
    await ElMessageBox.confirm(
      t('notifications.clear_confirm_text'),
      t('notifications.clear_confirm_title'),
      {
        confirmButtonText: t('notifications.clear_confirm_btn'),
        cancelButtonText: t('notifications.clear_cancel_btn'),
        type: 'warning',
      },
    );
    await api.delete('/api/notifications');
    notifications.value = [];
    ElMessage.success(t('notifications.clear_all_success'));
  } catch (error) {
    if (error !== 'cancel') {
      logError(error, { operation: 'notifications.deleteAll', component: 'NotificationsView' });
      ElMessage.error(t('notifications.mark_all_failed'));
    }
  }
};

const getIcon = (type: string) => {
  switch (type) {
    case 'TEAM':
    case 'PROJECT_INVITE':
      return Users;
    case 'TASK':
      return Briefcase;
    case 'MESSAGE':
    case 'REPLY':
      return MessageSquare;
    case 'SYSTEM':
      return Info;
    default:
      return Info;
  }
};

const getIconColor = (type: string) => {
  switch (type) {
    case 'TEAM':
    case 'PROJECT_INVITE':
      return 'text-blue-500 bg-blue-500/10';
    case 'TASK':
      return 'text-amber-500 bg-amber-500/10';
    case 'MESSAGE':
    case 'REPLY':
      return 'text-emerald-500 bg-emerald-500/10';
    case 'SYSTEM':
      return 'text-indigo-500 bg-indigo-500/10';
    default:
      return 'text-indigo-500 bg-indigo-500/10';
  }
};

onMounted(() => {
  fetchNotifications();
});
</script>

<template>
  <div
    class="mobile-adaptive flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-black/20"
  >
    <div
      class="min-h-[3.5rem] md:min-h-[4rem] py-2 md:py-3 px-4 md:px-8 flex items-center justify-between mobile-row shrink-0 border-b backdrop-blur-md bg-white/40 dark:bg-slate-900/40 sticky top-0 z-20 gap-4"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2 md:gap-4 min-w-0">
        <div
          class="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-accent/10 flex items-center justify-center text-accent shrink-0"
        >
          <Bell class="w-4 h-4 md:w-6 md:h-6" />
        </div>
        <div class="min-w-0">
          <h1 class="text-sm md:text-xl font-bold text-slate-900 dark:text-white truncate">
            {{ $t('notifications.title') }}
          </h1>
          <p class="hidden md:block text-xs text-slate-500 dark:text-slate-400 truncate">
            {{ $t('notifications.subtitle') }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 md:gap-3 shrink-0">
        <button
          type="button"
          :disabled="unreadCount === 0"
          class="flex items-center justify-center gap-1.5 px-2 md:px-4 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold text-accent bg-accent/5 md:bg-transparent border border-accent/10 md:border-none hover:bg-accent/10 transition-all disabled:opacity-40"
          title="{{ $t('notifications.mark_all_read') }}"
          @click="handleMarkAllRead"
        >
          <CheckCheck class="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span class="hidden sm:inline whitespace-nowrap">{{
            $t('notifications.mark_all_read')
          }}</span>
        </button>
        <button
          type="button"
          :disabled="notifications.length === 0"
          class="flex items-center justify-center gap-1.5 px-2 md:px-4 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold text-rose-500 bg-rose-500/5 md:bg-transparent border border-rose-500/10 md:border-none hover:bg-rose-50 transition-all disabled:opacity-40"
          title="{{ $t('notifications.clear_all') }}"
          @click="handleDeleteAll"
        >
          <Trash2 class="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span class="hidden sm:inline whitespace-nowrap">{{
            $t('notifications.clear_all')
          }}</span>
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      <!-- Sidebar / Mobile Tabs -->
      <div
        class="hidden lg:block lg:w-60 xl:w-72 border-b md:border-b-0 md:border-r shrink-0 backdrop-blur-sm bg-white/20 dark:bg-slate-900/20 z-10"
        style="border-color: var(--border-base)"
      >
        <div class="p-3 md:p-6 flex flex-col gap-3 md:gap-8">
          <!-- Search box: Full width on mobile -->
          <div class="relative w-full">
            <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('notifications.search_placeholder')"
              class="w-full pl-9 pr-3 py-2 rounded-xl border bg-white/50 dark:bg-slate-800/50 text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              style="border-color: var(--border-base)"
            />
          </div>

          <!-- Tabs / Filters: Horizontal scroll on mobile -->
          <div
            class="flex md:flex-col gap-2 overflow-x-auto scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0"
          >
            <!-- Quick Filters (All/Unread) -->
            <div class="flex md:flex-col gap-1.5 md:gap-1 shrink-0">
              <button
                v-for="filter in [
                  {
                    id: 'all',
                    label: $t('notifications.filter_all'),
                    icon: Inbox,
                    count: notifications.length,
                  },
                  {
                    id: 'unread',
                    label: $t('notifications.filter_unread'),
                    icon: Bell,
                    count: unreadCount,
                  },
                ]"
                :key="filter.id"
                type="button"
                class="flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-xs font-medium transition-all whitespace-nowrap shrink-0 min-w-[70px] md:min-w-0"
                :class="
                  activeFilter === filter.id
                    ? 'bg-accent text-white shadow-md shadow-accent/20'
                    : 'text-slate-600 dark:text-slate-400 bg-white/40 dark:bg-white/5 hover:bg-white/60'
                "
                @click="activeFilter = filter.id"
              >
                <div class="flex items-center gap-1.5 md:gap-2">
                  <component :is="filter.icon" class="w-3.5 h-3.5" />
                  {{ filter.label }}
                </div>
                <span
                  v-if="filter.count > 0"
                  class="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px]"
                  :class="
                    activeFilter === filter.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  "
                  >{{ filter.count }}</span
                >
              </button>
            </div>

            <!-- Separator on mobile -->
            <div
              class="md:hidden w-px h-6 bg-slate-200 dark:bg-slate-800 shrink-0 my-auto mx-1"
            ></div>

            <!-- Category List: Also in horizontal scroll on mobile -->
            <div class="flex md:flex-col gap-1.5 md:gap-1 shrink-0">
              <button
                v-for="cat in [
                  {
                    id: 'all',
                    label: $t('notifications.cat_all'),
                    icon: Inbox,
                    color: 'text-slate-400',
                    desktopOnly: true,
                  },
                  {
                    id: 'SYSTEM',
                    label: $t('notifications.cat_system'),
                    icon: Info,
                    color: 'text-indigo-500',
                  },
                  {
                    id: 'TEAM',
                    label: $t('notifications.cat_team'),
                    icon: Users,
                    color: 'text-blue-500',
                  },
                  {
                    id: 'TASK',
                    label: $t('notifications.cat_task'),
                    icon: Briefcase,
                    color: 'text-amber-500',
                  },
                  {
                    id: 'MESSAGE',
                    label: $t('notifications.cat_message'),
                    icon: MessageSquare,
                    color: 'text-emerald-500',
                  },
                ]"
                :key="cat.id"
                type="button"
                class="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-xs transition-all whitespace-nowrap shrink-0"
                :class="[
                  cat.desktopOnly ? 'hidden md:flex' : 'flex',
                  activeCategory === cat.id
                    ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-800 dark:text-white ring-1 ring-accent/10'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5',
                ]"
                @click="handleCategoryChange(cat.id)"
              >
                <component
                  :is="cat.icon"
                  class="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0"
                  :class="cat.color"
                />
                {{ cat.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div
        class="flex-1 overflow-y-auto p-3.5 md:p-8 scrollbar-hide bg-gradient-to-br from-transparent to-accent/5"
      >
        <div class="lg:hidden flex overflow-x-auto gap-2 px-4 py-2 -mx-3.5 mb-4 scrollbar-hide">
          <button
            v-for="cat in [
              { id: 'all', label: $t('notifications.filter_all'), icon: Inbox },
              { id: 'SYSTEM', label: $t('notifications.cat_system'), icon: Info },
              { id: 'TEAM', label: $t('notifications.cat_team'), icon: Users },
              { id: 'TASK', label: $t('notifications.cat_task'), icon: Briefcase },
              { id: 'MESSAGE', label: $t('notifications.cat_message'), icon: MessageSquare },
            ]"
            :key="cat.id"
            type="button"
            class="px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors"
            :class="
              activeCategory === cat.id
                ? 'bg-accent text-white'
                : 'bg-slate-100 dark:bg-white/5 text-slate-500'
            "
            @click="handleCategoryChange(cat.id)"
          >
            <component :is="cat.icon" class="w-3.5 h-3.5" />
            {{ cat.label }}
          </button>
        </div>

        <div class="max-w-5xl mx-auto space-y-4">
          <div v-if="isLoading" class="space-y-4">
            <div
              v-for="i in 5"
              :key="i"
              class="h-24 rounded-2xl md:rounded-3xl bg-white/40 dark:bg-slate-800/40 animate-pulse border border-white/20"
            ></div>
          </div>

          <template v-else-if="filteredNotifications.length > 0">
            <div
              v-for="n in filteredNotifications"
              :key="n.id"
              class="group px-4 py-3.5 md:p-6 glass-card transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-accent/5"
              :class="[!n.isRead ? 'ring-1 ring-accent/30' : '']"
              @click="handleMarkAsRead(n)"
            >
              <div class="flex gap-3 md:gap-4">
                <div
                  class="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                  :class="getIconColor(n.type)"
                >
                  <component :is="getIcon(n.type)" class="w-[18px] h-[18px] md:w-6 md:h-6" />
                </div>
                <div class="flex-1 min-w-0">
                  <div
                    class="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4 mb-1"
                  >
                    <h3
                      class="text-sm font-bold truncate pr-4"
                      :class="
                        n.isRead
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-900 dark:text-white'
                      "
                    >
                      {{ n.title }}
                    </h3>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-[10px] text-slate-400 whitespace-nowrap">{{
                        new Date(n.createdAt).toLocaleString([], {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }}</span>
                      <div
                        v-if="!n.isRead"
                        class="w-2 h-2 rounded-full bg-accent animate-pulse"
                      ></div>
                    </div>
                  </div>
                  <p
                    class="text-xs leading-relaxed mb-3 line-clamp-3 md:line-clamp-none"
                    :class="
                      n.isRead
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-slate-600 dark:text-slate-300'
                    "
                  >
                    {{ n.content }}
                  </p>
                  <div class="flex items-center gap-4 mobile-row">
                    <!-- Standard Notification Actions -->
                    <template v-if="n.type !== 'PROJECT_INVITE'">
                      <button
                        v-if="n.link"
                        type="button"
                        class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                        @click.stop="handleMarkAsRead(n)"
                      >
                        {{ $t('notifications.process_now') }} <ChevronRight class="w-3 h-3" />
                      </button>
                      <button
                        v-if="!n.isRead"
                        type="button"
                        class="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        @click.stop="handleMarkAsRead(n)"
                      >
                        {{ $t('notifications.mark_read') }}
                      </button>
                    </template>

                    <!-- Project Invite Actions -->
                    <template v-else>
                      <div
                        v-if="respondedInvitations[n.id]"
                        class="text-[10px] font-bold text-slate-400"
                      >
                        {{
                          respondedInvitations[n.id] === 'ACCEPTED'
                            ? t('notifications.invitation_accept_success')
                            : t('notifications.invitation_reject_success')
                        }}
                      </div>
                      <div v-else class="flex items-center gap-2 mobile-row" @click.stop>
                        <button
                          type="button"
                          :disabled="processingInvitations[n.id]"
                          class="px-2.5 py-1 rounded bg-accent text-white text-[10px] font-bold hover:shadow hover:shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                          @click="handleProjectInvitation(n, true)"
                        >
                          <Loader2
                            v-if="processingInvitations[n.id]"
                            class="w-3 h-3 animate-spin"
                          />
                          {{ $t('notifications.accept') }}
                        </button>
                        <button
                          type="button"
                          :disabled="processingInvitations[n.id]"
                          class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          @click="handleProjectInvitation(n, false)"
                        >
                          {{ $t('notifications.reject') }}
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="py-32 text-center space-y-4">
            <div
              class="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto text-slate-300"
            >
              <Inbox class="w-10 h-10" />
            </div>
            <div class="space-y-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                {{ $t('notifications.no_notifications_title') }}
              </h3>
              <p class="text-xs text-slate-400">{{ $t('notifications.no_notifications_desc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.animate-in {
  animation: animate-in 0.5s ease-out;
}

@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

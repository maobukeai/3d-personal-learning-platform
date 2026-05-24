<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Bell } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import {
  fetchNotifications as fetchNotificationsRequest,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type AppNotification,
} from '@/services/notification.service';

const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const notifications = ref<AppNotification[]>([]);
const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length);

const emit = defineEmits<{
  (e: 'show-invitation', invitationId: string): void;
}>();

const fetchNotifications = async () => {
  if (!authStore.isAuthenticated) return;

  try {
    notifications.value = await fetchNotificationsRequest();
    if (authStore.user?.role === 'ADMIN') {
      workspaceStore.fetchAdminStats();
    }
  } catch (error) {
    console.error('Fetch notifications error:', error);
  }
};

const addNotification = (notification: AppNotification) => {
  notifications.value.unshift(notification);
};

const handleMarkAsRead = async (notification: AppNotification) => {
  if (!notification.isRead) {
    try {
      await markNotificationAsRead(notification.id);
      const n = notifications.value.find((notif) => notif.id === notification.id);
      if (n) n.isRead = true;
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  }

  // Handle specific notification types
  if (notification.title === '收到团队邀请' && notification.link) {
    const url = new URL(notification.link, window.location.origin);
    const invitationId = url.searchParams.get('invitationId');
    if (invitationId) {
      emit('show-invitation', invitationId);
    }
  } else if (notification.link) {
    const resolved = router.resolve(notification.link);
    if (resolved.name) {
      router.push(notification.link);
    } else {
      console.warn('Notification link points to unknown route:', notification.link);
    }
  }
};

const handleMarkAllRead = async () => {
  try {
    await markAllNotificationsAsRead();
    notifications.value.forEach((n) => (n.isRead = true));
    ElMessage.success('已全部标记为已读');
  } catch (error) {
    console.error('Mark all read error:', error);
  }
};

defineExpose({
  fetchNotifications,
  addNotification,
  notifications,
  unreadCount,
});
</script>

<template>
  <el-dropdown trigger="click" placement="bottom-end" popper-class="notification-glass">
    <button type="button" class="topbar-icon-btn w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
      <Bell class="w-4.5 h-4.5" style="color: var(--text-muted)" />
      <div
        v-if="unreadCount > 0"
        class="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"
      ></div>
    </button>
    <template #dropdown>
      <div
        class="notification-panel w-80 p-0 rounded-3xl overflow-hidden border border-white/20 dark:border-white/10 shadow-2xl"
      >
        <div
          class="notification-header px-4 py-3 flex items-center justify-between border-b border-white/10"
        >
          <span
            class="text-xs font-bold uppercase tracking-wider text-slate-500/80 dark:text-slate-400/80"
            >通知中心</span
          >
          <div class="flex items-center gap-3">
            <button type="button" class="text-[10px] font-bold text-accent hover:underline" @click="handleMarkAllRead">
              全部忽略
            </button>
            <button type="button" class="text-[10px] font-bold text-slate-400 hover:text-accent" @click="router.push('/notifications')">
              查看全部
            </button>
          </div>
        </div>
        <div class="max-h-96 overflow-y-auto scrollbar-hide">
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notification-item p-4 cursor-pointer transition-colors"
            :class="!n.isRead ? 'bg-accent/[0.04] dark:bg-accent/[0.08]' : ''"
            @click="handleMarkAsRead(n)"
          >
            <p
              class="text-xs font-bold mb-1"
              :class="!n.isRead ? 'text-accent' : 'text-slate-700/90 dark:text-slate-300/90'"
            >
              {{ n.title }}
            </p>
            <p
              class="text-[11px] text-slate-500/80 dark:text-slate-400/80 leading-relaxed mb-2"
            >
              {{ n.content }}
            </p>
            <p class="text-[9px] text-slate-400/60 dark:text-slate-500/60">
              {{ new Date(n.createdAt).toLocaleString() }}
            </p>
          </div>
          <div v-if="notifications.length === 0" class="py-10 text-center text-slate-400/60">
            <Bell class="w-8 h-8 mx-auto mb-2 opacity-10" />
            <p class="text-xs">暂无新通知</p>
          </div>
        </div>
      </div>
    </template>
  </el-dropdown>
</template>

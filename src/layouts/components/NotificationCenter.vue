<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, Loader2 } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import api from '@/utils/api';
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

const processingInvitations = ref<Record<string, boolean>>({});
const respondedInvitations = ref<Record<string, 'ACCEPTED' | 'REJECTED'>>({});

const getInvitationIdFromLink = (link?: string | null) => {
  if (!link) return null;
  try {
    const url = new URL(link, window.location.origin);
    return url.searchParams.get('invitationId');
  } catch (e) {
    const match = link.match(/[?&]invitationId=([^&]+)/);
    return match ? match[1] : null;
  }
};

const handleProjectInvitation = async (notification: AppNotification, accept: boolean) => {
  const inviteId = getInvitationIdFromLink(notification.link);
  if (!inviteId) {
    ElMessage.warning('未能获取邀请 ID');
    return;
  }

  processingInvitations.value[notification.id] = true;
  try {
    const endpoint = accept ? 'accept' : 'reject';
    await api.post(`/api/projects/invitations/${inviteId}/${endpoint}`);
    respondedInvitations.value[notification.id] = accept ? 'ACCEPTED' : 'REJECTED';
    ElMessage.success(accept ? '已成功加入项目！' : '已拒绝邀请');
    
    // Auto mark notification as read
    if (!notification.isRead) {
      await markNotificationAsRead(notification.id);
      const n = notifications.value.find((notif) => notif.id === notification.id);
      if (n) n.isRead = true;
    }
  } catch (error) {
    console.error('Handle project invitation error:', error);
    ElMessage.error(accept ? '接受邀请失败' : '拒绝邀请失败');
  } finally {
    processingInvitations.value[notification.id] = false;
  }
};

const handleMarkAsRead = async (notification: AppNotification) => {
  if (notification.type === 'PROJECT_INVITE') {
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification.id);
        const n = notifications.value.find((notif) => notif.id === notification.id);
        if (n) n.isRead = true;
      } catch (error) {
        console.error('Mark as read error:', error);
      }
    }
    return;
  }

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
        class="notification-panel w-[420px] p-0 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div
          class="notification-header px-5 py-4 flex items-center justify-between"
        >
          <span
            class="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-450"
            >通知中心</span
          >
          <div class="flex items-center gap-4">
            <button type="button" class="text-xs font-bold text-accent hover:underline" @click="handleMarkAllRead">
              全部忽略
            </button>
            <button type="button" class="text-xs font-bold text-slate-450 hover:text-accent dark:text-slate-400" @click="router.push('/notifications')">
              查看全部
            </button>
          </div>
        </div>
        <div class="max-h-[420px] overflow-y-auto scrollbar-hide">
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notification-item p-5 cursor-pointer transition-colors border-b last:border-0 border-slate-100/50 dark:border-white/5"
            :class="!n.isRead ? 'bg-accent/[0.04] dark:bg-accent/[0.08]' : ''"
            @click="handleMarkAsRead(n)"
          >
            <p
              class="text-sm font-bold mb-1.5"
              :class="!n.isRead ? 'text-accent' : 'text-slate-700 dark:text-slate-300'"
            >
              {{ n.title }}
            </p>
            <p
              class="text-xs text-slate-500 dark:text-slate-450 leading-relaxed mb-2.5"
            >
              {{ n.content }}
            </p>
            
            <!-- Project Invite Actions -->
            <div v-if="n.type === 'PROJECT_INVITE'" class="mb-2.5 flex items-center gap-2" @click.stop>
              <template v-if="respondedInvitations[n.id]">
                <span class="text-[10px] font-bold text-slate-400">
                  {{ respondedInvitations[n.id] === 'ACCEPTED' ? '已接受邀请' : '已拒绝邀请' }}
                </span>
              </template>
              <template v-else>
                <button 
                  type="button" 
                  :disabled="processingInvitations[n.id]" 
                  class="px-2.5 py-1 rounded bg-accent text-white text-[10px] font-bold hover:shadow hover:shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  @click="handleProjectInvitation(n, true)"
                >
                  <Loader2 v-if="processingInvitations[n.id]" class="w-3 h-3 animate-spin" />
                  接受
                </button>
                <button 
                  type="button" 
                  :disabled="processingInvitations[n.id]" 
                  class="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-350 text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  @click="handleProjectInvitation(n, false)"
                >
                  拒绝
                </button>
              </template>
            </div>

            <p class="text-[10px] text-slate-400 dark:text-slate-500">
              {{ new Date(n.createdAt).toLocaleString() }}
            </p>
          </div>
          <div v-if="notifications.length === 0" class="py-16 text-center text-slate-400/60">
            <Bell class="w-12 h-12 mx-auto mb-3 opacity-15" />
            <p class="text-sm font-medium">暂无新通知</p>
          </div>
        </div>
      </div>
    </template>
  </el-dropdown>
</template>

<style scoped>
.notification-panel {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 
    0 10px 30px rgba(0, 0, 0, 0.04),
    0 1px 3px rgba(0, 0, 0, 0.02),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: all 0.3s ease;
}

:deep(.dark) .notification-panel {
  background: rgba(13, 13, 15, 0.85) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.5),
    0 10px 10px -5px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

.notification-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
:deep(.dark) .notification-header {
  border-bottom-color: rgba(255, 255, 255, 0.08) !important;
}

.notification-item {
  transition: all 0.2s ease;
}
.notification-item:hover {
  background: rgba(99, 102, 241, 0.04) !important;
}
:deep(.dark) .notification-item:hover {
  background: rgba(255, 255, 255, 0.02) !important;
}

/* Glassmorphism theme integration */
:deep(.theme-glass) .notification-panel {
  background: rgba(255, 255, 255, 0.65) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
}
:deep(.dark.theme-glass) .notification-panel {
  background: rgba(18, 18, 24, 0.7) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}
</style>

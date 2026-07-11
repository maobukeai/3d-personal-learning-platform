import { onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElNotification } from '@/utils/feedbackBridge';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import type { AppNotification } from '@/services/notification.service';
import { renderMarkdown } from '@/utils/aiHelpers';

type SocketService = (typeof import('@/utils/socket'))['socketService'];

interface ChatMessageEvent {
  conversationId: string;
  message: {
    type: string;
    content?: string;
    sender: {
      name: string;
    };
  };
}

interface MirrorSyncStartedEvent {
  sourceName: string;
  type: 'FULL' | 'INCREMENTAL' | string;
}

interface MirrorSyncFinishedEvent {
  sourceName: string;
  status: 'SUCCESS' | 'CANCELLED' | 'FAILED' | string;
  result?: {
    resourcesCreated?: number;
    resourcesUpdated?: number;
  };
  error?: string;
}

export function useLayoutSocket(options: {
  fetchNotifications: () => Promise<void>;
  fetchUnreadMessagesCount: () => Promise<void>;
  onNewNotificationCallback?: (notification: AppNotification) => void;
}) {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();
  const workspaceStore = useWorkspaceStore();

  const onNewNotification = (notification: AppNotification) => {
    if (options.onNewNotificationCallback) {
      options.onNewNotificationCallback(notification);
    }

    // Immediate sync when notification arrives
    if (authStore.user?.role === 'ADMIN') {
      workspaceStore.fetchAdminStats();
    }

    ElNotification({
      title: notification.title,
      message: renderMarkdown(notification.content),
      dangerouslyUseHTMLString: true,
      type: 'info',
      duration: 10000,
      position: 'top-right',
      onClick: () => {
        if (notification.link) {
          const resolved = router.resolve(notification.link);
          if (resolved.name) {
            router.push(notification.link);
          }
        }
      },
    });
  };

  const onOnlineUsersList = (ids: string[]) => {
    authStore.setOnlineUsers(ids);
  };

  const onUserStatus = ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
    authStore.updateUserStatus(userId, status);
  };

  const onMessageReceived = ({ conversationId: _conversationId, message }: ChatMessageEvent) => {
    const isMessagesPage = route.path === '/messages';

    if (!isMessagesPage) {
      authStore.incrementUnreadMessagesCount();

      ElNotification({
        title: `来自 ${message.sender.name} 的新消息`,
        message: message.type === 'TEXT' ? message.content : '[图片/文件]',
        type: 'success',
        duration: 3000,
        position: 'bottom-right',
        onClick: () => {
          router.push('/messages');
        },
      });
    }
  };

  const onMirrorSyncStarted = ({ sourceName, type }: MirrorSyncStartedEvent) => {
    ElNotification({
      title: '镜像同步开始',
      message: `镜像源「${sourceName}」的${type === 'FULL' ? '全量' : '增量'}同步任务已启动...`,
      type: 'info',
      duration: 4000,
      position: 'top-right',
    });
  };

  const onMirrorSyncFinished = ({ sourceName, status, result, error }: MirrorSyncFinishedEvent) => {
    if (status === 'SUCCESS') {
      ElNotification({
        title: '镜像同步成功',
        message: `镜像源「${sourceName}」同步完成！新增 ${result?.resourcesCreated || 0} 个资源，更新 ${result?.resourcesUpdated || 0} 个资源。`,
        type: 'success',
        duration: 6000,
        position: 'top-right',
      });
    } else if (status === 'CANCELLED') {
      ElNotification({
        title: '镜像同步已取消',
        message: `镜像源「${sourceName}」的同步任务已由用户手动取消。`,
        type: 'warning',
        duration: 4000,
        position: 'top-right',
      });
    } else {
      ElNotification({
        title: '镜像同步失败',
        message: `镜像源「${sourceName}」同步遇到错误：${error || '未知错误'}`,
        type: 'error',
        duration: 6000,
        position: 'top-right',
      });
    }
    workspaceStore.fetchWorkspaces();
  };

  const onRefreshAdminStats = () => {
    if (authStore.user?.role === 'ADMIN') {
      workspaceStore.fetchAdminStats();
    }
  };

  let socketService: SocketService | null = null;
  let statsInterval: ReturnType<typeof setInterval> | null = null;
  let isRealtimeStarted = false;
  let isStartingRealtime = false;
  let isDisposed = false;

  const stopRealtime = (disconnect = false) => {
    if (statsInterval) clearInterval(statsInterval);
    statsInterval = null;

    if (socketService) {
      socketService.off('new_notification', onNewNotification);
      socketService.off('message_received', onMessageReceived);
      socketService.off('online_users_list', onOnlineUsersList);
      socketService.off('user_status', onUserStatus);
      socketService.off('mirror_sync_started', onMirrorSyncStarted);
      socketService.off('mirror_sync_finished', onMirrorSyncFinished);
      socketService.off('refresh_admin_stats', onRefreshAdminStats);
      if (disconnect) {
        socketService.disconnect();
      }
    }

    isRealtimeStarted = false;
  };

  const startRealtime = async () => {
    if (isDisposed || isRealtimeStarted || isStartingRealtime || !authStore.isAuthenticated) {
      return;
    }

    isStartingRealtime = true;
    try {
      const socketModule = await import('@/utils/socket');
      if (isDisposed || !authStore.isAuthenticated) return;

      socketService = socketModule.socketService;
      // Pass the current access token so the Socket.IO handshake auth object
      // includes it — the server's fastifyAuthenticate checks auth.token first.
      socketService.connect(authStore.accessToken);

      socketService.on('new_notification', onNewNotification);
      socketService.on('online_users_list', onOnlineUsersList);
      socketService.on('user_status', onUserStatus);
      socketService.on('message_received', onMessageReceived);
      socketService.on('mirror_sync_started', onMirrorSyncStarted);
      socketService.on('mirror_sync_finished', onMirrorSyncFinished);
      socketService.on('refresh_admin_stats', onRefreshAdminStats);

      statsInterval = setInterval(() => {
        if (!authStore.isAuthenticated) return;
        options.fetchNotifications();
        if (authStore.user?.role === 'ADMIN') {
          workspaceStore.fetchAdminStats();
        }
      }, 15000);

      isRealtimeStarted = true;
    } finally {
      isStartingRealtime = false;
    }
  };

  // Watch the access token rather than onMounted.
  // Reason: composable onMounted hooks run BEFORE the host component's
  // onMounted, so authStore.accessToken is still null when this composable
  // would fire — the socket handshake would fail immediately with
  // "No token provided". By watching the token, we connect the moment it
  // becomes non-null (after fetchMe → refresh cycle completes).
  watch(
    () => authStore.accessToken,
    (token) => {
      if (token) {
        void startRealtime();
      }
    },
    { immediate: true },
  );

  watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
      if (!isAuthenticated) {
        stopRealtime(true);
      }
    },
  );

  onUnmounted(() => {
    isDisposed = true;
    stopRealtime();
  });
}

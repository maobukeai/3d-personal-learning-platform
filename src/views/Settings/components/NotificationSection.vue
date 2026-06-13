<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Bell, CheckCircle2, ChevronRight, Mail, MessageCircle, RotateCcw, Save, Send } from 'lucide-vue-next';
import {
  type AppNotification,
  type NotificationPreferences,
  defaultNotificationPreferences,
  fetchNotificationPreferences,
  fetchNotifications,
  updateNotificationPreferences,
} from '@/services/notification.service';

type PreferenceKey = keyof NotificationPreferences;

const router = useRouter();

const notificationPrefs = ref(defaultNotificationPreferences());
const savedSnapshot = ref(JSON.stringify(notificationPrefs.value));
const recentNotifications = ref<AppNotification[]>([]);
const isLoading = ref(false);
const isSavingPrefs = ref(false);
const browserPermission = ref(
  typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
);

const preferenceItems: Array<{
  key: PreferenceKey;
  title: string;
  description: string;
  channel: string;
  icon: typeof Mail;
}> = [
  {
    key: 'emailSystemUpdates',
    title: '系统更新与公告',
    description: '平台新功能、维护计划和重要服务通知。',
    channel: '邮件',
    icon: Mail,
  },
  {
    key: 'emailTeamActivity',
    title: '团队活动通知',
    description: '团队邀请、任务分配、项目协作进展。',
    channel: '邮件',
    icon: Send,
  },
  {
    key: 'emailDirectMessages',
    title: '私信邮件提醒',
    description: '未打开对应会话时发送邮件提醒，并自动合并短时间连续消息。',
    channel: '邮件',
    icon: Mail,
  },
  {
    key: 'emailMarketing',
    title: '活动与产品资讯',
    description: '官方活动、会员权益和学习资源推荐。',
    channel: '邮件',
    icon: Mail,
  },
  {
    key: 'pushMentions',
    title: '提及与回复',
    description: '讨论区、项目评论和作品反馈里的直接互动。',
    channel: '站内',
    icon: MessageCircle,
  },
  {
    key: 'pushDirectMessages',
    title: '私信通知',
    description: '新私信、群聊消息和协作会话提醒。',
    channel: '站内',
    icon: Bell,
  },
];

const enabledCount = computed(
  () => preferenceItems.filter((item) => notificationPrefs.value[item.key]).length,
);

const hasChanges = computed(() => JSON.stringify(notificationPrefs.value) !== savedSnapshot.value);

const browserPermissionLabel = computed(() => {
  if (browserPermission.value === 'granted') return '已授权';
  if (browserPermission.value === 'denied') return '已拒绝';
  if (browserPermission.value === 'default') return '待授权';
  return '不支持';
});

const setPreference = (key: PreferenceKey, value: boolean) => {
  notificationPrefs.value = {
    ...notificationPrefs.value,
    [key]: value,
  };
};

const fetchNotificationPrefs = async () => {
  try {
    isLoading.value = true;
    const [prefs, notifications] = await Promise.all([
      fetchNotificationPreferences(),
      fetchNotifications().catch(() => []),
    ]);
    notificationPrefs.value = prefs;
    savedSnapshot.value = JSON.stringify(prefs);
    recentNotifications.value = notifications.slice(0, 4);
  } catch {
    ElMessage.error('加载通知偏好失败');
  } finally {
    isLoading.value = false;
  }
};

const saveNotificationPrefs = async () => {
  try {
    isSavingPrefs.value = true;
    await updateNotificationPreferences(notificationPrefs.value);
    savedSnapshot.value = JSON.stringify(notificationPrefs.value);
    ElMessage.success('通知偏好已保存');
  } catch {
    ElMessage.error('保存通知偏好失败');
  } finally {
    isSavingPrefs.value = false;
  }
};

const resetDefaults = () => {
  notificationPrefs.value = defaultNotificationPreferences();
};

const requestBrowserPermission = async () => {
  if (!('Notification' in window)) {
    ElMessage.warning('当前浏览器不支持桌面通知');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    browserPermission.value = permission;
    if (permission === 'granted') {
      ElMessage.success('浏览器通知已授权');
    }
  } catch {
    ElMessage.error('浏览器通知授权失败');
  }
};

onMounted(fetchNotificationPrefs);
</script>

<template>
  <div class="notification-section">
    <section class="notification-overview">
      <div>
        <p class="section-kicker">通知策略</p>
        <h3>{{ enabledCount }}/{{ preferenceItems.length }} 项已启用</h3>
        <span>把重要协作信息留在前台，把低优先级消息降噪。</span>
      </div>
      <div class="overview-actions">
        <button type="button" class="secondary-action" @click="router.push('/notifications')">
          通知中心
          <ChevronRight />
        </button>
        <button type="button" class="primary-action" :disabled="!hasChanges || isSavingPrefs" @click="saveNotificationPrefs">
          <Save />
          {{ isSavingPrefs ? '保存中...' : '保存偏好' }}
        </button>
      </div>
    </section>

    <section class="notification-grid">
      <div class="preference-panel">
        <div class="panel-title">
          <span>接收渠道</span>
          <button type="button" @click="resetDefaults">
            <RotateCcw />
            恢复默认
          </button>
        </div>

        <div v-if="isLoading" class="loading-list">
          <i v-for="item in 5" :key="item"></i>
        </div>

        <div v-else class="preference-list">
          <article v-for="item in preferenceItems" :key="item.key" class="preference-row">
            <div class="row-icon">
              <component :is="item.icon" />
            </div>
            <div class="row-copy">
              <div>
                <strong>{{ item.title }}</strong>
                <em>{{ item.channel }}</em>
              </div>
              <span>{{ item.description }}</span>
            </div>
            <button
              type="button"
              class="toggle-button"
              :class="{ on: notificationPrefs[item.key] }"
              :aria-pressed="notificationPrefs[item.key]"
              @click="setPreference(item.key, !notificationPrefs[item.key])"
            >
              <i></i>
            </button>
          </article>
        </div>
      </div>

      <aside class="side-stack">
        <section class="browser-panel">
          <div class="panel-title">
            <span>桌面通知</span>
            <strong>{{ browserPermissionLabel }}</strong>
          </div>
          <p>浏览器授权后，重要私信和提及可以在后台弹出提醒。</p>
          <button type="button" :disabled="browserPermission === 'granted' || browserPermission === 'unsupported'" @click="requestBrowserPermission">
            <Bell />
            {{ browserPermission === 'granted' ? '已授权' : '请求授权' }}
          </button>
        </section>

        <section class="recent-panel">
          <div class="panel-title">
            <span>最近通知</span>
            <CheckCircle2 />
          </div>
          <div v-if="recentNotifications.length > 0" class="recent-list">
            <button
              v-for="item in recentNotifications"
              :key="item.id"
              type="button"
              @click="item.link ? router.push(item.link) : router.push('/notifications')"
            >
              <strong>{{ item.title }}</strong>
              <span>{{ item.content }}</span>
            </button>
          </div>
          <p v-else class="empty-copy">暂无通知，协作信息会在这里快速预览。</p>
        </section>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.notification-section {
  display: grid;
  gap: 12px;
}

.notification-overview,
.preference-panel,
.browser-panel,
.recent-panel {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.notification-overview {
  min-height: 82px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
}

.section-kicker,
.panel-title,
.row-copy span,
.notification-overview span,
.browser-panel p,
.empty-copy {
  color: var(--text-muted);
  font-size: 12px;
}

.section-kicker,
.panel-title {
  font-size: 11px;
  font-weight: 900;
}

h3 {
  margin: 2px 0 4px;
  font-size: 20px;
  font-weight: 900;
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-action,
.secondary-action,
.panel-title button,
.browser-panel button {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 0 12px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
}

.primary-action {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.secondary-action,
.panel-title button,
.browser-panel button {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
}

.primary-action:disabled,
.browser-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

button svg {
  width: 15px;
  height: 15px;
}

.notification-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 12px;
}

.preference-panel,
.browser-panel,
.recent-panel {
  padding: 12px;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.panel-title strong {
  color: var(--text-primary);
}

.loading-list,
.preference-list,
.side-stack,
.recent-list {
  display: grid;
  gap: 8px;
}

.loading-list i {
  height: 54px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
  animation: pulse 1.1s ease-in-out infinite;
}

.preference-row {
  min-height: 62px;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 46px;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.row-icon {
  width: 36px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.row-icon svg {
  width: 17px;
  height: 17px;
}

.row-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.row-copy div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-copy strong,
.recent-list strong,
.recent-list span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-copy strong {
  font-size: 13px;
  font-weight: 900;
}

.row-copy em {
  border-radius: 4px;
  padding: 1px 6px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
}

.toggle-button {
  width: 42px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  padding: 3px;
  background: color-mix(in srgb, var(--text-muted) 22%, transparent);
  cursor: pointer;
}

.toggle-button i {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #ffffff;
  transition: transform 0.18s ease;
}

.toggle-button.on {
  background: var(--accent);
}

.toggle-button.on i {
  transform: translateX(18px);
}

.browser-panel {
  display: grid;
  gap: 10px;
}

.browser-panel p {
  margin: 0;
  line-height: 1.6;
}

.browser-panel button {
  justify-content: center;
  width: 100%;
}

.recent-panel {
  min-height: 180px;
}

.recent-list button {
  min-height: 50px;
  display: grid;
  gap: 4px;
  border: 0;
  border-radius: 8px;
  padding: 8px;
  background: var(--bg-app);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.recent-list button:hover {
  color: var(--accent);
}

.recent-list strong {
  font-size: 12px;
  font-weight: 900;
}

.recent-list span {
  color: var(--text-muted);
  font-size: 11px;
}

.empty-copy {
  margin: 0;
  line-height: 1.6;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 960px) {
  .notification-overview,
  .notification-grid {
    grid-template-columns: 1fr;
  }

  .notification-overview {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 620px) {
  .overview-actions {
    width: 100%;
    flex-direction: column;
  }

  .primary-action,
  .secondary-action {
    justify-content: center;
    width: 100%;
  }
}
</style>

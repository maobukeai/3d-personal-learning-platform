<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Mail,
  MessageCircle,
  RotateCcw,
  Send,
  Users,
  Sparkles,
  ShieldAlert,
} from 'lucide-vue-next';
import Switch from '@/components/ui/Switch.vue';
import Button from '@/components/ui/Button.vue';
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
  typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'unsupported',
);

const pushPreferenceItems = [
  {
    key: 'pushSystemUpdates' as PreferenceKey,
    title: '系统公告与维护',
    description: '平台重大功能发布、维护计划与系统服务中断的即时通知。',
    icon: ShieldAlert,
  },
  {
    key: 'pushTeamActivity' as PreferenceKey,
    title: '协作与任务动态',
    description: '被分配新任务、项目状态更新或团队加入邀请的实时推送。',
    icon: Users,
  },
  {
    key: 'pushMentions' as PreferenceKey,
    title: '互动提及与回复',
    description: '他人在讨论区或作品展示中发表评论、回复及点赞的即时反馈。',
    icon: MessageCircle,
  },
  {
    key: 'pushDirectMessages' as PreferenceKey,
    title: '实时私信与群聊',
    description: '团队成员或好友发来的即时聊天消息与新对话提醒。',
    icon: Bell,
  },
  {
    key: 'pushMarketing' as PreferenceKey,
    title: '活动与学习推荐',
    description: '官方推荐的精品公开课、平台福利以及活动资讯提醒。',
    icon: Sparkles,
  },
] as const;

const emailPreferenceItems = [
  {
    key: 'emailSystemUpdates' as PreferenceKey,
    title: '系统公告邮件',
    description: '接收平台重磅功能上线、系统维护以及服务保障的重要邮件。',
    icon: Mail,
  },
  {
    key: 'emailTeamActivity' as PreferenceKey,
    title: '任务与协作邮件',
    description: '项目关键里程碑、任务到期提醒及团队动态的周期性邮件。',
    icon: Mail,
  },
  {
    key: 'emailMentions' as PreferenceKey,
    title: '互动回复邮件',
    description: '讨论区及个人作品收到他人点赞、@提及或回复时的实时邮件。',
    icon: Mail,
  },
  {
    key: 'emailDirectMessages' as PreferenceKey,
    title: '私信未读邮件',
    description: '离线或不处于聊天窗口时，自动合并短时间连续私信发送的提醒邮件。',
    icon: Mail,
  },
  {
    key: 'emailMarketing' as PreferenceKey,
    title: '活动与推广邮件',
    description: '订阅会员专属福利、折扣优惠以及最新课程推荐的邮件。',
    icon: Mail,
  },
] as const;

const totalItemsCount = pushPreferenceItems.length + emailPreferenceItems.length;

const enabledCount = computed(() => {
  let count = 0;
  for (const item of pushPreferenceItems) {
    if (notificationPrefs.value[item.key]) count++;
  }
  for (const item of emailPreferenceItems) {
    if (notificationPrefs.value[item.key]) count++;
  }
  return count;
});

const browserPermissionLabel = computed(() => {
  if (browserPermission.value === 'granted') return '已授权';
  if (browserPermission.value === 'denied') return '已拒绝';
  if (browserPermission.value === 'default') return '待授权';
  return '不支持';
});

const setPreference = async (key: PreferenceKey, value: boolean) => {
  const updatedPrefs = {
    ...notificationPrefs.value,
    [key]: value,
  };
  notificationPrefs.value = updatedPrefs;
  
  try {
    isSavingPrefs.value = true;
    await updateNotificationPreferences(updatedPrefs);
    savedSnapshot.value = JSON.stringify(updatedPrefs);
    ElMessage.success('通知偏好已更新');
  } catch {
    ElMessage.error('更新通知偏好失败');
    // Revert local state on failure
    notificationPrefs.value = {
      ...notificationPrefs.value,
      [key]: !value,
    };
  } finally {
    isSavingPrefs.value = false;
  }
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

const resetDefaults = async () => {
  try {
    isLoading.value = true;
    const defaults = defaultNotificationPreferences();
    notificationPrefs.value = defaults;
    await updateNotificationPreferences(defaults);
    savedSnapshot.value = JSON.stringify(defaults);
    ElMessage.success('已恢复默认配置');
  } catch {
    ElMessage.error('恢复默认配置失败');
  } finally {
    isLoading.value = false;
  }
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
        <h3>{{ enabledCount }}/{{ totalItemsCount }} 项已启用</h3>
        <span>把重要协作信息留在前台，把低优先级消息降噪。</span>
      </div>
      <div class="overview-actions">
        <span v-if="isSavingPrefs" class="text-xs text-slate-400 flex items-center gap-1 select-none">
          <svg class="animate-spin h-3.5 w-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          正在保存...
        </span>
        <span v-else class="text-xs text-slate-400 flex items-center gap-1 select-none">
          <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
          已自动保存
        </span>
        <Button
          variant="secondary"
          :icon="ChevronRight"
          icon-position="right"
          @click="router.push('/notifications')"
        >
          通知中心
        </Button>
      </div>
    </section>

    <section class="notification-grid">
      <div class="main-stack">
        <!-- 站内通知 Panel -->
        <div class="preference-panel">
          <div class="panel-header">
            <div class="header-copy">
              <span class="category-header">
                <Bell class="w-4.5 h-4.5 text-indigo-500 mr-1.5" />
                站内通知 (In-App Push)
              </span>
              <span class="category-subheader">实时接收站内动态与即时消息</span>
            </div>
            <Button size="sm" variant="secondary" :icon="RotateCcw" @click="resetDefaults">
              恢复默认
            </Button>
          </div>

          <div v-if="isLoading" class="loading-list">
            <i v-for="item in 5" :key="item"></i>
          </div>

          <div v-else class="preference-list">
            <article v-for="item in pushPreferenceItems" :key="item.key" class="preference-row">
              <div class="row-icon push-icon">
                <component :is="item.icon" />
              </div>
              <div class="row-copy">
                <div>
                  <strong>{{ item.title }}</strong>
                  <em class="badge-push">站内</em>
                </div>
                <span>{{ item.description }}</span>
              </div>
              <Switch
                :model-value="notificationPrefs[item.key]"
                @update:model-value="(val) => setPreference(item.key, val)"
              />
            </article>
          </div>
        </div>

        <!-- 站外通知 Panel -->
        <div class="preference-panel mt-6">
          <div class="panel-header">
            <div class="header-copy">
              <span class="category-header">
                <Mail class="w-4.5 h-4.5 text-indigo-500 mr-1.5" />
                站外通知 (Email Alerts)
              </span>
              <span class="category-subheader">通过注册邮箱接收未读提醒与更新汇总</span>
            </div>
          </div>

          <div v-if="isLoading" class="loading-list">
            <i v-for="item in 5" :key="item"></i>
          </div>

          <div v-else class="preference-list">
            <article v-for="item in emailPreferenceItems" :key="item.key" class="preference-row">
              <div class="row-icon email-icon">
                <component :is="item.icon" />
              </div>
              <div class="row-copy">
                <div>
                  <strong>{{ item.title }}</strong>
                  <em class="badge-email">邮箱</em>
                </div>
                <span>{{ item.description }}</span>
              </div>
              <Switch
                :model-value="notificationPrefs[item.key]"
                @update:model-value="(val) => setPreference(item.key, val)"
              />
            </article>
          </div>
        </div>
      </div>

      <aside class="side-stack">
        <section class="browser-panel">
          <div class="panel-title">
            <span>桌面通知</span>
            <strong>{{ browserPermissionLabel }}</strong>
          </div>
          <p>浏览器授权后，重要私信和提及可以在后台弹出提醒。</p>
          <Button
            variant="secondary"
            full-width
            :disabled="browserPermission === 'granted' || browserPermission === 'unsupported'"
            :icon="Bell"
            @click="requestBrowserPermission"
          >
            {{ browserPermission === 'granted' ? '已授权' : '请求授权' }}
          </Button>
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
  padding: 16px;
}

.main-stack {
  display: grid;
  gap: 16px;
}

.mt-6 {
  margin-top: 24px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-base);
  padding-bottom: 12px;
}

.header-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-header {
  display: inline-flex;
  align-items: center;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
}

.category-subheader {
  font-size: 11px;
  color: var(--text-muted);
}

.badge-push,
.badge-email {
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  border: 1px solid transparent;
}

.badge-push {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  border-color: rgba(99, 102, 241, 0.2);
}

.badge-email {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.2);
}

.push-icon {
  background: rgba(99, 102, 241, 0.12) !important;
  color: #6366f1 !important;
}

.email-icon {
  background: rgba(16, 185, 129, 0.12) !important;
  color: #10b981 !important;
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

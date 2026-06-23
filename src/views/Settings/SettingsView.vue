<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Component } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Bell,
  ChevronRight,
  Download,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
  Cloud,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { preferences } from '@/utils/preferences';

import ProfileSection from './components/ProfileSection.vue';
import NotificationSection from './components/NotificationSection.vue';
import SecuritySection from './components/SecuritySection.vue';
import AppearanceSection from './components/AppearanceSection.vue';
import TeamsSection from './components/TeamsSection.vue';
import DataSection from './components/DataSection.vue';
import BackupSection from './components/BackupSection.vue';
import { useLabel } from '@/utils/i18n';

type SectionId =
  | 'profile'
  | 'notifications'
  | 'security'
  | 'appearance'
  | 'teams'
  | 'data'
  | 'backup';
type SectionTone = 'green' | 'amber' | 'red' | 'blue' | 'slate';

interface SettingsSection {
  id: SectionId;
  label: string;
  subtitle: string;
  icon: Component;
  keywords: string[];
  status: string;
  metric: string;
  tone: SectionTone;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const getInitialSection = (): SectionId => {
  const tab = route.query.tab;
  const validIds = [
    'profile',
    'notifications',
    'security',
    'appearance',
    'teams',
    'data',
    'backup',
  ];
  if (typeof tab === 'string' && validIds.includes(tab)) {
    return tab as SectionId;
  }
  const saved = localStorage.getItem('user_settings_active_tab') as SectionId;
  if (saved && validIds.includes(saved)) {
    return saved;
  }
  return 'profile';
};

const activeSection = ref<SectionId>(getInitialSection());
const searchTerm = ref('');
const isRefreshing = ref(false);
const label = useLabel();

const profileCompletion = computed(() => {
  const user = authStore.user;
  if (!user) return 0;
  const fields = [user.name, user.avatarUrl, user.bio, user.location, user.website].filter(Boolean);
  return Math.round((fields.length / 5) * 100);
});

const currentTheme = computed(() => {
  const theme = preferences.getTheme();
  const map: Record<string, string> = {
    'glass-light': label('浅色玻璃', 'Light Glass'),
    'glass-dark': label('深色玻璃', 'Dark Glass'),
    'glass-auto': label('跟随系统', 'Auto'),
  };
  return map[theme] || theme;
});

const securityScore = computed(() => {
  let score = 45;
  if (authStore.user?.emailVerified) score += 20;
  if (authStore.user?.twoFactorEnabled) score += 25;
  if (authStore.user?.avatarUrl) score += 10;
  return Math.min(score, 100);
});

const sections = computed<SettingsSection[]>(() => [
  {
    id: 'profile',
    label: label('个人资料', 'Profile'),
    subtitle: label('头像、简介、作品主页', 'Avatar, bio, portfolio'),
    icon: User,
    keywords: ['profile', 'avatar', 'bio', '个人', '资料', '头像'],
    status:
      profileCompletion.value >= 80 ? label('资料完整', 'Complete') : label('待完善', 'Needs Work'),
    metric: `${profileCompletion.value}%`,
    tone: profileCompletion.value >= 80 ? 'green' : 'amber',
  },
  {
    id: 'notifications',
    label: label('通知偏好', 'Notifications'),
    subtitle: label('邮件、站内、团队动态', 'Email, in-app, team activity'),
    icon: Bell,
    keywords: ['notice', 'email', 'push', '通知', '邮件'],
    status: label('可配置', 'Configurable'),
    metric: label('6 项', '6 items'),
    tone: 'blue',
  },
  {
    id: 'security',
    label: label('账号安全', 'Security'),
    subtitle: label('邮箱、密码、2FA、设备', 'Email, password, 2FA, devices'),
    icon: ShieldCheck,
    keywords: ['security', 'password', '2fa', '安全', '密码', '邮箱'],
    status: securityScore.value >= 80 ? label('高强度', 'Strong') : label('建议加固', 'Improve'),
    metric: `${securityScore.value}%`,
    tone: securityScore.value >= 80 ? 'green' : 'amber',
  },
  {
    id: 'appearance',
    label: label('外观语言', 'Appearance'),
    subtitle: label('主题、强调色、多语言', 'Theme, accent, language'),
    icon: Palette,
    keywords: ['theme', 'language', 'color', '主题', '颜色', '语言'],
    status: currentTheme.value,
    metric: preferences.getLanguage() === 'zh-CN' ? label('中文', 'ZH') : 'EN',
    tone: 'blue',
  },
  {
    id: 'teams',
    label: label('团队空间', 'Teams'),
    subtitle: label('空间、协作、成员关系', 'Spaces, collaboration, members'),
    icon: Users,
    keywords: ['team', 'workspace', 'member', '团队', '空间', '成员'],
    status: label('实时同步', 'Synced'),
    metric: label('空间', 'Spaces'),
    tone: 'slate',
  },
  {
    id: 'data',
    label: label('数据与风险', 'Data & Risk'),
    subtitle: label('导出、注销、不可逆操作', 'Export, deletion, irreversible actions'),
    icon: Download,
    keywords: ['data', 'export', 'delete', '数据', '导出', '注销'],
    status: label('谨慎操作', 'Sensitive'),
    metric: label('高风险', 'High risk'),
    tone: 'red',
  },
  {
    id: 'backup',
    label: label('备份与同步', 'Backup & Sync'),
    subtitle: label('WebDAV 备份与精细化恢复', 'WebDAV backup & fine-grained restore'),
    icon: Cloud,
    keywords: ['backup', 'restore', 'webdav', 'sync', '备份', '恢复', '同步'],
    status: label('多平台', 'Multi-platform'),
    metric: label('云同步', 'Cloud sync'),
    tone: 'blue',
  },
]);

const filteredSections = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  if (!keyword) return sections.value;
  return sections.value.filter((section) => {
    const haystack = [section.label, section.subtitle, section.status, ...section.keywords]
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
});

const activeSectionMeta = computed(
  () => sections.value.find((section) => section.id === activeSection.value) || sections.value[0],
);

const initials = computed(() => {
  const source = authStore.user?.name || authStore.user?.email || 'U';
  return source.slice(0, 1).toUpperCase();
});

const setSection = (sectionId: SectionId) => {
  activeSection.value = sectionId;
  localStorage.setItem('user_settings_active_tab', sectionId);
  router.replace({ query: { ...route.query, tab: sectionId } });
};

const syncSectionFromRoute = () => {
  const tab = route.query.tab;
  if (typeof tab === 'string' && sections.value.some((section) => section.id === tab)) {
    activeSection.value = tab as SectionId;
    localStorage.setItem('user_settings_active_tab', tab);
  }
};

const refreshAccount = async () => {
  try {
    isRefreshing.value = true;
    await authStore.fetchMe();
    ElMessage.success(label('账号状态已刷新', 'Account status refreshed'));
  } catch {
    ElMessage.error(label('刷新账号状态失败', 'Failed to refresh account status'));
  } finally {
    isRefreshing.value = false;
  }
};

onMounted(syncSectionFromRoute);

watch(() => route.query.tab, syncSectionFromRoute);

watch(filteredSections, (next) => {
  if (next.length > 0 && !next.some((section) => section.id === activeSection.value)) {
    setSection(next[0].id);
  }
});
</script>

<template>
  <div class="settings-workbench mobile-adaptive">
    <aside class="section-rail">
      <div class="rail-title">
        <p class="eyebrow">{{ label('系统设置', 'System Settings') }}</p>
        <h1>{{ label('设置中心', 'Settings Center') }}</h1>
      </div>

      <div class="account-strip">
        <div class="avatar-chip">{{ initials }}</div>
        <div>
          <strong>{{ authStore.user?.name || label('未命名用户', 'Unnamed User') }}</strong>
          <span>{{ authStore.user?.email || label('未登录', 'Not signed in') }}</span>
        </div>
      </div>

      <div class="rail-search-wrap">
        <label class="search-box !min-h-0 !h-8 w-full shrink-0">
          <Search />
          <input
            v-model="searchTerm"
            type="text"
            :placeholder="label('搜索设置项', 'Search settings')"
          />
        </label>
      </div>

      <div class="rail-heading">
        <span>{{ label('设置项', 'Sections') }}</span>
        <strong>{{ filteredSections.length }}</strong>
      </div>

      <nav class="section-list">
        <button
          v-for="section in filteredSections"
          :key="section.id"
          type="button"
          :class="{ active: activeSection === section.id }"
          @click="setSection(section.id)"
        >
          <component :is="section.icon" />
          <span>
            <strong>{{ section.label }}</strong>
            <small>{{ section.subtitle }}</small>
          </span>
          <ChevronRight />
        </button>
      </nav>

      <div v-if="filteredSections.length === 0" class="empty-search">
        <Search />
        <span>{{ label('没有匹配的设置项', 'No matching settings') }}</span>
      </div>
    </aside>

    <main class="settings-main">
      <header v-if="activeSectionMeta" class="content-toolbar mobile-row">
        <div class="content-title">
          <div class="title-icon" :class="`tone-${activeSectionMeta.tone}`">
            <component :is="activeSectionMeta.icon" />
          </div>
          <div>
            <p class="eyebrow">{{ activeSectionMeta.status }}</p>
            <h2>{{ activeSectionMeta.label }}</h2>
            <span>{{ activeSectionMeta.subtitle }}</span>
          </div>
        </div>

        <div class="toolbar-actions mobile-row">
          <span class="section-status" :class="`tone-${activeSectionMeta.tone}`">
            {{ activeSectionMeta.metric }}
          </span>
          <button
            type="button"
            class="icon-action"
            :title="label('通知中心', 'Notifications')"
            @click="router.push('/notifications')"
          >
            <Bell />
          </button>
          <button
            type="button"
            class="icon-action"
            :title="label('刷新账号状态', 'Refresh account status')"
            :disabled="isRefreshing"
            @click="refreshAccount"
          >
            <RefreshCw :class="{ spinning: isRefreshing }" />
          </button>
        </div>
      </header>

      <div class="section-content">
        <ProfileSection v-if="activeSection === 'profile'" />
        <NotificationSection v-else-if="activeSection === 'notifications'" />
        <SecuritySection v-else-if="activeSection === 'security'" />
        <AppearanceSection v-else-if="activeSection === 'appearance'" />
        <TeamsSection v-else-if="activeSection === 'teams'" />
        <DataSection v-else-if="activeSection === 'data'" />
        <BackupSection v-else-if="activeSection === 'backup'" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.settings-workbench {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  overflow: hidden;
  background: transparent !important;
  color: var(--text-primary);
}

.section-rail,
.settings-main {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-enterprise);
}

.rail-title {
  min-width: 0;
  display: grid;
  gap: 2px;
  padding: 2px 2px 6px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 21px;
  font-weight: 900;
  line-height: 1.1;
}

h2 {
  font-size: 22px;
  font-weight: 900;
}

.content-title span,
.account-strip span {
  color: var(--text-muted);
  font-size: 12px;
}

.eyebrow {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0;
}

.rail-search-wrap {
  padding: 4px 0 8px;
}

.settings-search {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.settings-search svg {
  width: 16px;
  height: 16px;
}

.settings-search svg {
  color: var(--text-muted);
}

.settings-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.icon-action {
  width: 38px;
  height: 38px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
}

.icon-action:hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border-base));
}

.icon-action:disabled {
  cursor: wait;
  opacity: 0.65;
}

.icon-action svg {
  width: 16px;
  height: 16px;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

.section-rail,
.settings-main {
  min-height: 0;
  overflow: auto;
}

.section-rail {
  padding: 10px;
}

.account-strip {
  min-height: 58px;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 9px;
  border-radius: 8px;
  background: var(--bg-app);
}

.avatar-chip {
  width: 40px;
  height: 40px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), #10b981);
  color: #ffffff;
  font-weight: 900;
}

.account-strip strong,
.account-strip span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-strip strong {
  font-size: 13px;
  font-weight: 900;
}

.rail-heading,
.section-status {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.rail-heading strong {
  min-width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: var(--bg-app);
  color: var(--text-primary);
}

.section-list {
  display: grid;
  gap: 5px;
}

.section-list button {
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 14px;
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.section-list button:hover,
.section-list button.active {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-base));
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

.section-list button > svg {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.section-list button.active > svg {
  color: var(--accent);
}

.section-list span {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.section-list strong,
.section-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-list strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.section-list small {
  color: var(--text-muted);
  font-size: 11px;
}

.section-list em,
.section-status {
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  font-style: normal;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.section-list button > svg:last-child {
  width: 14px;
  height: 14px;
}

.empty-search {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 110px;
  color: var(--text-muted);
  font-size: 12px;
}

.empty-search svg {
  width: 18px;
  height: 18px;
}

.settings-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 0;
}

.content-toolbar {
  min-height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-base);
}

.content-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  width: 42px;
  height: 42px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
}

.title-icon svg {
  width: 18px;
  height: 18px;
}

.toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.section-content {
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.tone-green {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

.tone-amber {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.tone-red {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.12);
}

.tone-blue {
  color: #2563eb;
  background: rgba(59, 130, 246, 0.12);
}

.tone-slate {
  color: var(--text-secondary);
  background: var(--bg-app);
}

.text-green {
  color: #047857;
}

.text-amber {
  color: #b45309;
}

.text-blue {
  color: #2563eb;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .settings-workbench {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .section-rail,
  .settings-main {
    overflow: visible;
  }

  .section-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .settings-workbench {
    padding: 8px;
    gap: 8px;
  }

  .section-list {
    grid-template-columns: 1fr;
  }
}
</style>

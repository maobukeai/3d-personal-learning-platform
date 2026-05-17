<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  User,
  Lock,
  ShieldCheck,
  MapPin,
  Globe,
  Camera,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  Bell,
  Palette,
  Users,
  Plus,
  Monitor,
  Sun,
  Moon,
  ExternalLink,
  Trash2,
  Smartphone,
  Languages,
  Download,
  AtSign,
  ShieldAlert,
  RefreshCw,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const activeSection = ref('profile');

const profileForm = ref({
  name: authStore.user?.name || '',
  bio: authStore.user?.bio || '',
  location: authStore.user?.location || '',
  website: authStore.user?.website || '',
});

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const is2FALoading = ref(false);
const qrCodeUrl = ref('');
const tfaCode = ref('');
const show2FASetup = ref(false);
const recoveryCodes = ref<string[]>([]);
const showRecoveryCodes = ref(false);

const currentTheme = ref(localStorage.getItem('theme') || 'light');
const currentAccent = ref(localStorage.getItem('accentColor') || '#3b82f6');
const currentLanguage = ref(localStorage.getItem('language') || 'zh-CN');
const accentColors = [
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
  { name: '翠绿', value: '#10b981' },
  { name: '橙色', value: '#f59e0b' },
  { name: '靛青', value: '#6366f1' },
];

const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

const notificationPrefs = ref({
  emailSystemUpdates: true,
  emailTeamActivity: true,
  emailMarketing: false,
  pushMentions: true,
  pushDirectMessages: true,
});

const emailChangeForm = ref({
  newEmail: '',
  code: '',
  step: 1 as 1 | 2,
});

const trustedDevices = ref<any[]>([]);
const isLoadingDevices = ref(false);

const isDeletingAccount = ref(false);
const deleteAccountConfirm = ref('');
const delete2FACode = ref('');
const showDelete2FAStep = ref(false);

const myTeams = ref<any[]>([]);
const isLoadingTeams = ref(false);

const handleUpdateProfile = async () => {
  try {
    await authStore.updateProfile(profileForm.value);
    ElMessage.success(t('settings.successUpdate'));
  } catch (error) {
    ElMessage.error('更新失败');
  }
};

const handleChangePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致');
    return;
  }
  if (passwordForm.value.newPassword.length < 6) {
    ElMessage.warning('新密码长度至少为 6 位');
    return;
  }
  try {
    await authStore.changePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    ElMessage.success('密码已成功修改');
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '修改密码失败');
  }
};

const handleAvatarUpload = async (e: any) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await authStore.uploadAvatar(file);
    ElMessage.success('头像已更新');
  } catch (error) {
    ElMessage.error('头像上传失败');
  }
};

const start2FASetup = async () => {
  is2FALoading.value = true;
  try {
    const data = await authStore.setup2FA();
    qrCodeUrl.value = data.qrCodeUrl;
    recoveryCodes.value = data.recoveryCodes || [];
    show2FASetup.value = true;
  } catch (error) {
    ElMessage.error('无法启动两步验证设置');
  } finally {
    is2FALoading.value = false;
  }
};

const fetchRecoveryCodes = async () => {
  try {
    const { data } = await api.get('/api/auth/2fa/recovery-codes');
    recoveryCodes.value = data.recoveryCodes;
    showRecoveryCodes.value = true;
  } catch (error) {
    ElMessage.error('无法获取恢复代码');
  }
};

const regenerateRecoveryCodes = async () => {
  try {
    const { data } = await api.post('/api/auth/2fa/recovery-codes/regenerate');
    recoveryCodes.value = data.recoveryCodes;
    ElMessage.success('已重新生成恢复代码');
  } catch (error) {
    ElMessage.error('重新生成失败');
  }
};

const confirm2FA = async () => {
  try {
    await authStore.enable2FA(tfaCode.value);
    ElMessage.success('两步验证已成功启用');
    show2FASetup.value = false;
    tfaCode.value = '';
  } catch (error) {
    ElMessage.error('验证码错误');
  }
};

const disable2FA = async () => {
  try {
    await authStore.disable2FA();
    ElMessage.success('两步验证已禁用');
  } catch (error) {
    ElMessage.error('禁用失败');
  }
};

const applyTheme = (theme: string) => {
  currentTheme.value = theme;
  localStorage.setItem('theme', theme);
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', isDark);
  }
};

const applyAccentColor = (color: string) => {
  currentAccent.value = color;
  localStorage.setItem('accentColor', color);
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--el-color-primary', color);
  root.style.setProperty('--el-color-primary-light-3', `${color}b3`);
  root.style.setProperty('--el-color-primary-light-5', `${color}80`);
  root.style.setProperty('--el-color-primary-light-9', `${color}1a`);
};

const applyLanguage = (lang: string) => {
  currentLanguage.value = lang;
  localStorage.setItem('language', lang);
  locale.value = lang;
  ElMessage.success(t('settings.successLanguage'));
};

const fetchNotificationPrefs = async () => {
  try {
    const { data } = await api.get('/api/notifications/preferences');
    notificationPrefs.value = {
      emailSystemUpdates: data.emailSystemUpdates ?? true,
      emailTeamActivity: data.emailTeamActivity ?? true,
      emailMarketing: data.emailMarketing ?? false,
      pushMentions: data.pushMentions ?? true,
      pushDirectMessages: data.pushDirectMessages ?? true,
    };
  } catch (error) {
    console.error('Fetch notification prefs error:', error);
  }
};

const isSavingPrefs = ref(false);
const saveNotificationPrefs = async () => {
  try {
    isSavingPrefs.value = true;
    await api.put('/api/notifications/preferences', notificationPrefs.value);
    ElMessage.success(t('settings.successSavePrefs'));
  } catch (error) {
    ElMessage.error(t('settings.errorSavePrefs'));
  } finally {
    isSavingPrefs.value = false;
  }
};

const isSendingEmailCode = ref(false);
const isConfirmingEmail = ref(false);
const emailCodeCountdown = ref(0);
let countdownTimer: any = null;

const startEmailCountdown = () => {
  emailCodeCountdown.value = 60;
  countdownTimer = setInterval(() => {
    if (emailCodeCountdown.value > 0) {
      emailCodeCountdown.value--;
    } else {
      clearInterval(countdownTimer);
    }
  }, 1000);
};

const sendEmailChangeCode = async () => {
  if (!emailChangeForm.value.newEmail) {
    return ElMessage.warning('请输入新邮箱地址');
  }
  if (emailCodeCountdown.value > 0) return;

  try {
    isSendingEmailCode.value = true;
    await api.post('/api/auth/email/send-code-new', { newEmail: emailChangeForm.value.newEmail });
    ElMessage.success('验证码已发送到新邮箱');
    emailChangeForm.value.step = 2;
    startEmailCountdown();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '发送验证码失败');
  } finally {
    isSendingEmailCode.value = false;
  }
};

const confirmEmailChange = async () => {
  if (!emailChangeForm.value.code) {
    return ElMessage.warning('请输入验证码');
  }
  try {
    isConfirmingEmail.value = true;
    await api.put('/api/auth/email/change', {
      newEmail: emailChangeForm.value.newEmail,
      code: emailChangeForm.value.code,
    });
    ElMessage.success('邮箱已成功更换');
    emailChangeForm.value = { newEmail: '', code: '', step: 1 };
    await authStore.fetchMe();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更换邮箱失败');
  } finally {
    isConfirmingEmail.value = false;
  }
};

const fetchTrustedDevices = async () => {
  isLoadingDevices.value = true;
  try {
    const { data } = await api.get('/api/auth/trusted-devices');
    trustedDevices.value = data;
  } catch (error) {
    console.error('Fetch trusted devices error:', error);
  } finally {
    isLoadingDevices.value = false;
  }
};

const revokeDevice = async (deviceId: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要移除此受信任设备吗？移除后该设备登录时需要重新验证。',
      '移除设备',
      {
        confirmButtonText: '确认移除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    await api.delete(`/api/auth/trusted-devices/${deviceId}`);
    ElMessage.success('设备已移除');
    fetchTrustedDevices();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('移除设备失败');
    }
  }
};

const handleDeleteAccount = async () => {
  if (deleteAccountConfirm.value !== 'DELETE') {
    return ElMessage.warning('请输入 DELETE 以确认删除');
  }

  if (authStore.user?.twoFactorEnabled && !showDelete2FAStep.value) {
    showDelete2FAStep.value = true;
    return;
  }

  if (authStore.user?.twoFactorEnabled && !delete2FACode.value) {
    return ElMessage.warning('请输入两步验证码');
  }

  try {
    isDeletingAccount.value = true;
    await api.delete('/api/auth/account', {
      data: authStore.user?.twoFactorEnabled ? { twoFactorCode: delete2FACode.value } : {},
    });
    ElMessage.success('账号已成功注销');
    localStorage.removeItem('token');
    router.push('/login');
  } catch (error: any) {
    const errData = error.response?.data;
    if (errData?.twoFactorRequired) {
      showDelete2FAStep.value = true;
      ElMessage.warning('此账号已启用两步验证，请输入验证码');
    } else {
      ElMessage.error(errData?.error || '注销账号失败');
    }
  } finally {
    isDeletingAccount.value = false;
  }
};

const exportData = async () => {
  try {
    ElMessage.info('正在准备数据导出...');
    const [profileRes, teamsRes] = await Promise.all([
      api.get('/api/auth/me'),
      api.get('/api/teams'),
    ]);
    const exportObj = {
      exportDate: new Date().toISOString(),
      profile: profileRes.data,
      teams: teamsRes.data,
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('数据导出成功');
  } catch (error) {
    ElMessage.error('数据导出失败');
  }
};

const fetchMyTeams = async () => {
  isLoadingTeams.value = true;
  try {
    const response = await api.get('/api/teams');
    myTeams.value = response.data;
  } catch (error) {
    console.error('Fetch teams error:', error);
  } finally {
    isLoadingTeams.value = false;
  }
};

const sections = [
  { id: 'profile', label: t('settings.profile'), icon: User },
  { id: 'notifications', label: t('settings.notifications'), icon: Bell },
  { id: 'security', label: t('settings.account'), icon: ShieldCheck },
  { id: 'appearance', label: t('settings.appearance'), icon: Palette },
  { id: 'teams', label: t('settings.teams'), icon: Users },
  { id: 'data', label: t('settings.dangerZone'), icon: Download },
];

watch(
  () => authStore.user,
  (newUser) => {
    if (newUser) {
      profileForm.value = {
        name: newUser.name || '',
        bio: newUser.bio || '',
        location: newUser.location || '',
        website: newUser.website || '',
      };
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (route.query.tab) {
    activeSection.value = route.query.tab as string;
  }
  if (activeSection.value === 'teams') {
    fetchMyTeams();
  }
  fetchNotificationPrefs();
});

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab) activeSection.value = newTab as string;
  },
);

watch(activeSection, (newSection) => {
  if (newSection === 'teams' && myTeams.value.length === 0) {
    fetchMyTeams();
  }
  if (newSection === 'security') {
    fetchTrustedDevices();
  }
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <div
      class="h-16 px-4 sm:px-8 flex items-center justify-between shrink-0 border-b transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold" style="color: var(--text-primary)">
          {{ t('settings.title') }}
        </h1>
      </div>
    </div>

    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <div
        class="w-full lg:w-64 border-b lg:border-b-0 lg:border-r shrink-0 overflow-y-auto p-4 transition-colors duration-300"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="px-4 mb-4 hidden lg:block">
          <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">设置选项</h2>
        </div>
        <nav class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide">
          <button
            v-for="section in sections"
            :key="section.id"
            class="flex-1 lg:flex-none w-auto lg:w-full flex items-center justify-between px-4 py-2.5 lg:py-3 rounded-xl text-sm font-medium transition-all shrink-0 whitespace-nowrap"
            :class="
              activeSection === section.id
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
            "
            @click="activeSection = section.id"
          >
            <div class="flex items-center gap-2 lg:gap-3">
              <component :is="section.icon" class="w-4 h-4 shrink-0" />
              <span>{{ section.label }}</span>
            </div>
            <ChevronRight class="w-3.5 h-3.5 opacity-50 hidden lg:block" />
          </button>
        </nav>
      </div>

      <div class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12 scrollbar-hide">
        <div class="max-w-2xl mx-auto">
          <!-- Profile Section -->
          <div
            v-if="activeSection === 'profile'"
            class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8 text-center sm:text-left">
              <label class="relative group/avatar-upload cursor-pointer block shrink-0">
                <UserAvatar :user="authStore.user ?? undefined" size="xl" />
                <div
                  class="absolute inset-0 rounded-2xl bg-black/0 group-hover/avatar-upload:bg-black/40 transition-all duration-300 flex items-center justify-center z-10"
                >
                  <div
                    class="opacity-0 group-hover/avatar-upload:opacity-100 transition-all duration-300 transform scale-75 group-hover/avatar-upload:scale-100 flex flex-col items-center gap-1"
                  >
                    <Camera class="w-6 h-6 text-white drop-shadow-lg" />
                    <span class="text-[10px] text-white font-bold drop-shadow-lg">更换头像</span>
                  </div>
                </div>
                <input type="file" class="hidden" accept="image/*" @change="handleAvatarUpload" />
              </label>
              <div>
                <h2 class="text-xl font-bold" style="color: var(--text-primary)">
                  {{ t('settings.profile') }}
                </h2>
                <p class="text-xs mt-1" style="color: var(--text-secondary)">
                  点击头像即可更换，建议上传 500x500px 以上的 JPG 或 PNG 格式图片
                </p>
              </div>
            </div>

            <div class="space-y-6">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div class="space-y-2">
                  <label
                    class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                    >昵称</label
                  >
                  <input
                    v-model="profileForm.name"
                    type="text"
                    class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                    style="
                      background-color: var(--bg-card);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                    >所在地</label
                  >
                  <div class="relative">
                    <MapPin
                      class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      v-model="profileForm.location"
                      type="text"
                      class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                      style="
                        background-color: var(--bg-card);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                      placeholder="城市, 国家"
                    />
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                  >个人简介</label
                >
                <textarea
                  v-model="profileForm.bio"
                  rows="4"
                  class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                  style="
                    background-color: var(--bg-card);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  placeholder="向大家介绍一下你自己吧..."
                ></textarea>
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                  >个人主页/作品集</label
                >
                <div class="relative">
                  <Globe class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    v-model="profileForm.website"
                    type="text"
                    class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                    style="
                      background-color: var(--bg-card);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                    placeholder="https://yourportfolio.com"
                  />
                </div>
              </div>

              <div class="pt-4">
                <button
                  class="px-8 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 hover:scale-105 transition-all"
                  @click="handleUpdateProfile"
                >
                  {{ t('common.save') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Notifications Section -->
          <div
            v-if="activeSection === 'notifications'"
            class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div
              class="p-8 rounded-3xl border border-accent/20 bg-accent/[0.02] flex items-center justify-between transition-all hover:bg-accent/[0.05]"
            >
              <div class="flex items-center gap-4">
                <div
                  class="w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/20"
                >
                  <Bell class="w-6 h-6" />
                </div>
                <div>
                  <h3 class="text-lg font-bold" style="color: var(--text-primary)">通知中心</h3>
                  <p class="text-xs text-slate-500 mt-1">查看所有历史通知、系统消息和团队动态</p>
                </div>
              </div>
              <button
                class="flex items-center gap-2 px-6 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 hover:scale-105 transition-all"
                @click="router.push('/notifications')"
              >
                进入通知中心
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>

            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                <h3 class="text-lg font-bold" style="color: var(--text-primary)">邮件通知</h3>
              </div>

              <div class="space-y-8">
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <p class="text-sm font-bold" style="color: var(--text-primary)">
                      系统更新与公告
                    </p>
                    <p class="text-[11px]" style="color: var(--text-secondary)">
                      接收关于平台新功能、维护计划的邮件。
                    </p>
                  </div>
                  <el-switch
                    v-model="notificationPrefs.emailSystemUpdates"
                    active-color="var(--accent)"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <p class="text-sm font-bold" style="color: var(--text-primary)">团队活动通知</p>
                    <p class="text-[11px]" style="color: var(--text-secondary)">
                      当您的团队有新动态或任务分配时通知您。
                    </p>
                  </div>
                  <el-switch
                    v-model="notificationPrefs.emailTeamActivity"
                    active-color="var(--accent)"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <p class="text-sm font-bold" style="color: var(--text-primary)">
                      市场营销与活动
                    </p>
                    <p class="text-[11px]" style="color: var(--text-secondary)">
                      接收关于特惠、研讨会及行业资讯的邮件。
                    </p>
                  </div>
                  <el-switch
                    v-model="notificationPrefs.emailMarketing"
                    active-color="var(--accent)"
                  />
                </div>
              </div>
            </div>

            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <div class="w-1.5 h-6 bg-accent rounded-full"></div>
                <h3 class="text-lg font-bold" style="color: var(--text-primary)">推送通知</h3>
              </div>

              <div class="space-y-8">
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <p class="text-sm font-bold" style="color: var(--text-primary)">提及与回复</p>
                    <p class="text-[11px]" style="color: var(--text-secondary)">
                      当有人在讨论中提到您或回复您的内容时。
                    </p>
                  </div>
                  <el-switch
                    v-model="notificationPrefs.pushMentions"
                    active-color="var(--accent)"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <div class="space-y-1">
                    <p class="text-sm font-bold" style="color: var(--text-primary)">私信通知</p>
                    <p class="text-[11px]" style="color: var(--text-secondary)">
                      当您收到新的私信消息时。
                    </p>
                  </div>
                  <el-switch
                    v-model="notificationPrefs.pushDirectMessages"
                    active-color="var(--accent)"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end">
              <button
                class="px-8 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 hover:scale-105 transition-all"
                @click="saveNotificationPrefs"
              >
                保存通知偏好
              </button>
            </div>
          </div>

          <!-- Security Section -->
          <div
            v-if="activeSection === 'security'"
            class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <!-- Email Change -->
            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <div class="p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-violet-600">
                  <AtSign class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="text-lg font-bold" style="color: var(--text-primary)">邮箱地址</h3>
                  <p class="text-[10px] font-medium text-slate-400 mt-0.5">
                    当前邮箱: {{ authStore.user?.email }}
                  </p>
                </div>
              </div>

              <div v-if="emailChangeForm.step === 1" class="space-y-4">
                <div class="space-y-2">
                  <label
                    class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                    >新邮箱地址</label
                  >
                  <input
                    v-model="emailChangeForm.newEmail"
                    type="email"
                    class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                    placeholder="newemail@example.com"
                  />
                </div>
                <button
                  :disabled="isSendingEmailCode || emailCodeCountdown > 0"
                  class="px-6 py-2.5 bg-accent text-white font-bold rounded-xl text-xs hover:scale-105 transition-all disabled:opacity-50"
                  @click="sendEmailChangeCode"
                >
                  {{
                    isSendingEmailCode
                      ? '正在发送...'
                      : emailCodeCountdown > 0
                        ? `重试 (${emailCodeCountdown}s)`
                        : '发送验证码'
                  }}
                </button>
              </div>

              <div v-else class="space-y-4">
                <div
                  class="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-2xl border border-violet-100 dark:border-violet-900/20"
                >
                  <p class="text-xs text-violet-700 dark:text-violet-300 font-medium">
                    验证码已发送至 {{ emailChangeForm.newEmail }}
                  </p>
                </div>
                <div class="space-y-2">
                  <label
                    class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                    >验证码</label
                  >
                  <div class="flex gap-3">
                    <input
                      v-model="emailChangeForm.code"
                      type="text"
                      maxlength="6"
                      class="flex-1 px-4 py-3 rounded-2xl border text-center font-black tracking-[0.5em] transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                      placeholder="000000"
                    />
                    <button
                      :disabled="isConfirmingEmail || emailChangeForm.code.length !== 6"
                      class="px-6 py-3 bg-accent text-white font-bold rounded-2xl text-xs disabled:opacity-50"
                      @click="confirmEmailChange"
                    >
                      {{ isConfirmingEmail ? '更换中...' : '确认更换' }}
                    </button>
                  </div>
                </div>
                <button
                  class="text-xs text-slate-400 hover:text-slate-600"
                  @click="emailChangeForm.step = 1"
                >
                  返回上一步
                </button>
              </div>
            </div>

            <!-- Password Change -->
            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                  <Lock class="w-5 h-5" />
                </div>
                <h3 class="text-lg font-bold" style="color: var(--text-primary)">修改密码</h3>
              </div>

              <div class="space-y-6">
                <div class="space-y-2">
                  <label
                    class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                    >当前密码</label
                  >
                  <input
                    v-model="passwordForm.currentPassword"
                    type="password"
                    class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>
                <div class="grid grid-cols-2 gap-6">
                  <div class="space-y-2">
                    <label
                      class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                      >新密码</label
                    >
                    <input
                      v-model="passwordForm.newPassword"
                      type="password"
                      class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                    />
                  </div>
                  <div class="space-y-2">
                    <label
                      class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                      >确认新密码</label
                    >
                    <input
                      v-model="passwordForm.confirmPassword"
                      type="password"
                      class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                    />
                  </div>
                </div>
                <div class="pt-2">
                  <button
                    class="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:opacity-80 transition-all"
                    @click="handleChangePassword"
                  >
                    更新密码
                  </button>
                </div>
              </div>
            </div>

            <!-- Two Factor Auth -->
            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
                    <Fingerprint class="w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="text-lg font-bold" style="color: var(--text-primary)">
                      两步验证 (2FA)
                    </h3>
                    <p class="text-[10px] font-medium text-slate-400 mt-0.5">
                      为你的账号增加额外安全屏障
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    :class="
                      authStore.user?.twoFactorEnabled
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-400'
                    "
                  >
                    {{ authStore.user?.twoFactorEnabled ? '已启用' : '未启用' }}
                  </span>
                </div>
              </div>

              <div v-if="!authStore.user?.twoFactorEnabled">
                <p class="text-xs leading-relaxed mb-6" style="color: var(--text-secondary)">
                  启用两步验证后，在登录时除了输入密码，还需要输入手机身份验证器（如 Google
                  Authenticator）生成的动态验证码。
                </p>
                <button
                  v-if="!show2FASetup"
                  class="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-500 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
                  @click="start2FASetup"
                >
                  <Plus class="w-4 h-4" /> 开启两步验证
                </button>

                <div v-else class="space-y-6 animate-in zoom-in-95 duration-300">
                  <div
                    class="flex flex-col md:flex-row gap-8 items-center bg-slate-50 dark:bg-white/5 p-6 rounded-2xl"
                  >
                    <div class="p-2 bg-white rounded-xl shadow-lg">
                      <img :src="qrCodeUrl" class="w-32 h-32" />
                    </div>
                    <div class="flex-1 space-y-3">
                      <p class="text-xs font-bold">1. 扫描二维码</p>
                      <p class="text-[10px] text-slate-500 leading-relaxed">
                        使用手机上的 Authenticator App
                        扫描左侧二维码。如果无法扫描，可以手动输入密钥。
                      </p>

                      <div
                        v-if="recoveryCodes.length > 0"
                        class="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl space-y-2"
                      >
                        <p
                          class="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1"
                        >
                          <ShieldAlert class="w-3 h-3" /> 请保存这些恢复代码
                        </p>
                        <div class="grid grid-cols-2 gap-2">
                          <code
                            v-for="code in recoveryCodes"
                            :key="code"
                            class="text-[10px] bg-white dark:bg-slate-900 px-2 py-1 rounded border border-amber-200 dark:border-amber-900/30 text-center"
                            >{{ code }}</code
                          >
                        </div>
                        <p class="text-[9px] text-amber-600/70 dark:text-amber-500/50">
                          如果丢失手机，您可以使用这些代码登录。每个代码只能使用一次。
                        </p>
                      </div>

                      <div class="flex gap-2">
                        <input
                          v-model="tfaCode"
                          type="text"
                          maxlength="6"
                          class="flex-1 px-4 py-2 rounded-xl border text-sm text-center font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-accent/20"
                          placeholder="000000"
                        />
                        <button
                          class="px-6 py-2 bg-accent text-white font-bold rounded-xl text-xs"
                          @click="confirm2FA"
                        >
                          验证并启用
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    class="text-xs text-slate-400 hover:text-slate-600"
                    @click="show2FASetup = false"
                  >
                    取消设置
                  </button>
                </div>
              </div>

              <div v-else class="space-y-6">
                <div
                  class="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20"
                >
                  <CheckCircle2 class="w-5 h-5 text-emerald-500" />
                  <p class="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                    您的账号正在受到两步验证的保护。
                  </p>
                </div>

                <div class="space-y-4">
                  <div
                    v-if="showRecoveryCodes"
                    class="p-6 bg-slate-50 dark:bg-white/5 border rounded-2xl space-y-4 animate-in zoom-in-95 duration-300"
                    style="border-color: var(--border-base)"
                  >
                    <div class="flex items-center justify-between">
                      <h4 class="text-xs font-bold" style="color: var(--text-primary)">恢复代码</h4>
                      <button
                        class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
                        @click="regenerateRecoveryCodes"
                      >
                        <RefreshCw class="w-3 h-3" /> 重新生成
                      </button>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <code
                        v-for="code in recoveryCodes"
                        :key="code"
                        class="text-xs bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-center font-mono tracking-wider"
                        >{{ code }}</code
                      >
                    </div>
                    <p class="text-[10px] text-slate-400 leading-relaxed">
                      这些代码可以用于在丢失身份验证器时找回账号。请将它们保存在安全的地方。
                    </p>
                  </div>

                  <div class="flex items-center gap-4">
                    <button
                      class="text-xs font-bold text-accent hover:underline"
                      @click="
                        showRecoveryCodes ? (showRecoveryCodes = false) : fetchRecoveryCodes()
                      "
                    >
                      {{ showRecoveryCodes ? '隐藏恢复代码' : '查看恢复代码' }}
                    </button>
                    <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                    <button
                      class="text-xs font-bold text-rose-500 hover:underline"
                      @click="disable2FA"
                    >
                      关闭两步验证
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Trusted Devices -->
            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <div class="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600">
                  <Smartphone class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="text-lg font-bold" style="color: var(--text-primary)">受信任设备</h3>
                  <p class="text-[10px] font-medium text-slate-400 mt-0.5">
                    这些设备在两步验证时被标记为信任，登录时无需再次验证
                  </p>
                </div>
              </div>

              <div v-if="isLoadingDevices" class="space-y-3">
                <div
                  v-for="i in 2"
                  :key="i"
                  class="h-14 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse"
                ></div>
              </div>

              <div v-else-if="trustedDevices.length > 0" class="space-y-3">
                <div
                  v-for="device in trustedDevices"
                  :key="device.id"
                  class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5"
                >
                  <div class="flex items-center gap-3">
                    <Smartphone class="w-4 h-4 text-slate-400" />
                    <div>
                      <p class="text-xs font-bold" style="color: var(--text-primary)">受信任设备</p>
                      <p class="text-[10px] text-slate-400">
                        添加于 {{ new Date(device.createdAt).toLocaleDateString() }}
                      </p>
                    </div>
                  </div>
                  <button
                    class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-all"
                    @click="revokeDevice(device.id)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div v-else class="text-center py-8">
                <p class="text-xs text-slate-400">暂无受信任设备</p>
              </div>
            </div>
          </div>

          <!-- Appearance Section -->
          <div
            v-if="activeSection === 'appearance'"
            class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <h3 class="text-lg font-bold mb-6" style="color: var(--text-primary)">
                {{ t('settings.theme') }}
              </h3>
              <div class="grid grid-cols-3 gap-4">
                <button
                  v-for="theme in [
                    { id: 'light', label: t('settings.themeLight'), icon: Sun },
                    { id: 'dark', label: t('settings.themeDark'), icon: Moon },
                    { id: 'system', label: t('settings.themeSystem'), icon: Monitor },
                  ]"
                  :key="theme.id"
                  class="flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all"
                  :class="
                    currentTheme === theme.id
                      ? 'border-accent bg-accent/5 ring-1 ring-accent'
                      : 'hover:bg-slate-50 dark:hover:bg-white/5'
                  "
                  style="border-color: currentTheme === theme.id ? 'var(--accent)' : 'var(--border-base)'"
                  @click="applyTheme(theme.id)"
                >
                  <component
                    :is="theme.icon"
                    class="w-6 h-6"
                    :class="currentTheme === theme.id ? 'text-accent' : 'text-slate-400'"
                  />
                  <span
                    class="text-xs font-bold"
                    :class="
                      currentTheme === theme.id
                        ? 'text-accent'
                        : 'text-slate-600 dark:text-slate-400'
                    "
                    >{{ theme.label }}</span
                  >
                </button>
              </div>
            </div>

            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <h3 class="text-lg font-bold mb-6" style="color: var(--text-primary)">
                {{ t('settings.accentColor') }}
              </h3>
              <div class="flex flex-wrap gap-4">
                <button
                  v-for="color in accentColors"
                  :key="color.value"
                  class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  :style="{ backgroundColor: color.value }"
                  @click="applyAccentColor(color.value)"
                >
                  <div
                    v-if="currentAccent === color.value"
                    class="w-2 h-2 rounded-full bg-white shadow-sm"
                  ></div>
                </button>
              </div>
              <p class="text-[10px] text-slate-400 mt-6">
                选择一个你喜欢的颜色，它将作为平台的主要按钮和交互高亮色。
              </p>
            </div>

            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-6">
                <Languages class="w-5 h-5 text-accent" />
                <h3 class="text-lg font-bold" style="color: var(--text-primary)">语言偏好</h3>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <button
                  v-for="lang in languageOptions"
                  :key="lang.value"
                  class="flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all text-sm font-bold"
                  :class="
                    currentLanguage === lang.value
                      ? 'border-accent bg-accent/5 ring-1 ring-accent text-accent'
                      : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
                  "
                  style="border-color: currentLanguage === lang.value ? 'var(--accent)' : 'var(--border-base)'"
                  @click="applyLanguage(lang.value)"
                >
                  {{ lang.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Teams Section -->
          <div
            v-if="activeSection === 'teams'"
            class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold" style="color: var(--text-primary)">我的团队</h2>
                <p class="text-xs mt-1" style="color: var(--text-secondary)">
                  管理你创建或加入的所有协作团队
                </p>
              </div>
            </div>

            <div v-if="isLoadingTeams" class="space-y-4">
              <div
                v-for="i in 3"
                :key="i"
                class="h-24 rounded-3xl bg-slate-100 dark:bg-white/5 animate-pulse"
              ></div>
            </div>

            <div v-else-if="myTeams.length > 0" class="grid gap-4">
              <div
                v-for="team in myTeams"
                :key="team.id"
                class="p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none"
                style="background-color: var(--bg-card); border-color: var(--border-base)"
              >
                <div class="flex items-center gap-4">
                  <div
                    class="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg"
                  >
                    {{ team.name.charAt(0) }}
                  </div>
                  <div>
                    <h3 class="font-bold" style="color: var(--text-primary)">{{ team.name }}</h3>
                    <div class="flex items-center gap-3 mt-1">
                      <span
                        class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500"
                        >{{ team._count?.members || 0 }} 名成员</span
                      >
                      <span
                        v-if="team.ownerId === authStore.user?.id"
                        class="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold"
                        >创建者</span
                      >
                    </div>
                  </div>
                </div>
                <RouterLink
                  :to="`/team/${team.id}`"
                  class="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 hover:text-accent transition-all"
                >
                  <ExternalLink class="w-5 h-5" />
                </RouterLink>
              </div>
            </div>

            <div
              v-else
              class="text-center py-20 border-2 border-dashed rounded-3xl transition-colors duration-300"
              style="border-color: var(--border-base)"
            >
              <div
                class="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Users class="w-8 h-8 text-slate-300" />
              </div>
              <h3 class="text-sm font-bold mb-1" style="color: var(--text-primary)">暂无团队</h3>
              <p class="text-xs text-slate-400 mb-6">你还没有加入任何团队，快去创建一个吧！</p>
            </div>
          </div>

          <!-- Data & Privacy Section -->
          <div
            v-if="activeSection === 'data'"
            class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div
              class="p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                  <Download class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="text-lg font-bold" style="color: var(--text-primary)">数据导出</h3>
                  <p class="text-[10px] font-medium text-slate-400 mt-0.5">下载您的个人数据副本</p>
                </div>
              </div>
              <p class="text-xs leading-relaxed mb-6" style="color: var(--text-secondary)">
                您可以随时导出您的个人资料、团队信息等数据。导出文件为 JSON
                格式，包含您在平台上的所有个人数据。
              </p>
              <button
                class="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:scale-105 transition-all flex items-center gap-2"
                @click="exportData"
              >
                <Download class="w-4 h-4" />
                导出我的数据
              </button>
            </div>

            <div
              class="p-8 rounded-3xl border border-rose-200 dark:border-rose-900/50 transition-colors duration-300"
              style="background-color: var(--bg-card)"
            >
              <div class="flex items-center gap-3 mb-8">
                <div class="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600">
                  <ShieldAlert class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="text-lg font-bold text-rose-600">危险区域</h3>
                  <p class="text-[10px] font-medium text-slate-400 mt-0.5">
                    以下操作不可逆，请谨慎操作
                  </p>
                </div>
              </div>

              <div class="space-y-6">
                <div
                  class="p-6 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30"
                >
                  <h4 class="text-sm font-bold text-rose-700 dark:text-rose-400 mb-2">注销账号</h4>
                  <p class="text-xs text-rose-600/70 dark:text-rose-400/70 leading-relaxed mb-4">
                    注销后，您的所有数据将被永久删除且无法恢复，包括个人资料、资产、讨论、团队关系等。此操作不可逆。
                  </p>
                  <div class="space-y-3">
                    <div class="space-y-2">
                      <label
                        class="text-[10px] font-black uppercase tracking-widest text-rose-500 ml-1"
                        >请输入 DELETE 以确认</label
                      >
                      <input
                        v-model="deleteAccountConfirm"
                        type="text"
                        class="w-full px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        placeholder="DELETE"
                      />
                    </div>
                    <div
                      v-if="showDelete2FAStep && authStore.user?.twoFactorEnabled"
                      class="space-y-2 animate-in zoom-in-95 duration-300"
                    >
                      <div
                        class="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30"
                      >
                        <ShieldCheck class="w-4 h-4 text-amber-600 shrink-0" />
                        <p class="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                          此账号已启用两步验证，请输入验证器中的动态验证码
                        </p>
                      </div>
                      <div class="flex gap-3">
                        <input
                          v-model="delete2FACode"
                          type="text"
                          maxlength="6"
                          class="flex-1 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-rose-950/30 text-center font-black tracking-[0.5em] text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                          placeholder="000000"
                        />
                      </div>
                    </div>
                    <button
                      :disabled="
                        isDeletingAccount ||
                        deleteAccountConfirm !== 'DELETE' ||
                        (showDelete2FAStep && authStore.user?.twoFactorEnabled && !delete2FACode)
                      "
                      class="px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                      @click="handleDeleteAccount"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                      {{
                        isDeletingAccount
                          ? '正在注销...'
                          : showDelete2FAStep
                            ? '验证并注销账号'
                            : '永久注销账号'
                      }}
                    </button>
                  </div>
                </div>
              </div>
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
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

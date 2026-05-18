<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import {
  Settings,
  Mail,
  Shield,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Layout,
  UserPlus,
  Lock,
  Globe,
  Image,
  FileText,
  Upload,
  Clock,
  KeyRound,
  AlertTriangle,
  RotateCcw,
  MonitorSmartphone,
  Sparkles,
  Palette,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useSystemStore } from '@/stores/system';
import { sanitizeHtml } from '@/utils/sanitize';

const systemStore = useSystemStore();
const isLoading = ref(false);
const isSaving = ref(false);
const isTestingSmtp = ref(false);
const showPassword = ref(false);
const hasUnsavedChanges = ref(false);
const showEmailPreview = ref(false);
const activeTab = ref('general');

const defaultSettings = {
  SMTP_HOST: '',
  SMTP_PORT: '465',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: '',
  SMTP_FROM_NAME: '',
  SMTP_SECURE: 'true',
  EMAIL_VERIFY_SUBJECT: '您的邮箱验证码',
  EMAIL_VERIFY_BODY: '您好，您的验证码是：{{code}}。请在 10 分钟内输入。',
  PLATFORM_NAME: '3D Personal Learning Hub',
  PLATFORM_LOGO_URL: '',
  PLATFORM_DESCRIPTION: '',
  ALLOW_REGISTRATION: true,
  MAINTENANCE_MODE: false,
  DEFAULT_USER_ROLE: 'USER',
  PASSWORD_MIN_LENGTH: '6',
  SESSION_TIMEOUT: '7d',
  AUTO_APPROVE_MATERIALS: false,
  AUTO_APPROVE_SHOWCASES: false,
  MAX_UPLOAD_SIZE_MB: '100',
  ALLOWED_FILE_TYPES: '.glb, .gltf, .fbx, .obj, .stl, .zip',
  FOOTER_TEXT: '',
  OAUTH_GOOGLE_ENABLED: false,
  OAUTH_GOOGLE_CLIENT_ID: '',
  OAUTH_GOOGLE_CLIENT_SECRET: '',
  OAUTH_GITHUB_ENABLED: false,
  OAUTH_GITHUB_CLIENT_ID: '',
  OAUTH_GITHUB_CLIENT_SECRET: '',
};

const settings = ref({ ...defaultSettings });
const originalSettings = ref({ ...defaultSettings });

const tabs = [
  { id: 'general', label: '基础运营', icon: Globe },
  { id: 'branding', label: '平台品牌', icon: Palette },
  { id: 'security', label: '安全策略', icon: Shield },
  { id: 'upload', label: '上传限制', icon: Upload },
  { id: 'smtp', label: '邮件服务', icon: Mail },
  { id: 'social', label: '社交登录', icon: Sparkles },
  { id: 'template', label: '邮件模板', icon: Layout },
];

const sessionTimeoutOptions = [
  { label: '1 天', value: '1d' },
  { label: '3 天', value: '3d' },
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
];

const defaultRoleOptions = [
  { label: '普通用户', value: 'USER' },
  { label: '讲师', value: 'INSTRUCTOR' },
];

watch(
  settings,
  () => {
    hasUnsavedChanges.value =
      JSON.stringify(settings.value) !== JSON.stringify(originalSettings.value);
  },
  { deep: true },
);

const emailPreviewHtml = computed(() => {
  let html = settings.value.EMAIL_VERIFY_BODY || '';
  html = html.replace(
    /\{\{code\}\}/g,
    '<span style="background:#f4f4f4;padding:8px 16px;font-size:24px;font-weight:bold;letter-spacing:5px;text-align:center;display:inline-block;border-radius:8px;">836425</span>',
  );
  return html;
});

const fetchSettings = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/admin/settings');

    // Support both array and object formats for backward compatibility during transition
    if (Array.isArray(data)) {
      data.forEach((s: any) => {
        if (
          s.key === 'ALLOW_REGISTRATION' ||
          s.key === 'MAINTENANCE_MODE' ||
          s.key === 'AUTO_APPROVE_MATERIALS' ||
          s.key === 'AUTO_APPROVE_SHOWCASES' ||
          s.key.endsWith('_ENABLED')
        ) {
          (settings.value as any)[s.key] = s.value === 'true';
        } else if (
          s.key === 'MATERIAL_CATEGORIES' ||
          s.key === 'ALLOWED_FILE_TYPES' ||
          s.key === 'ALLOWED_EXTENSIONS'
        ) {
          try {
            const arr: string[] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
            (settings.value as any)[s.key] = arr.join(', ');
          } catch {
            (settings.value as any)[s.key] = (defaultSettings as any)[s.key];
          }
        } else if (Object.keys(settings.value).includes(s.key)) {
          (settings.value as any)[s.key] = s.value;
        }
      });
    } else {
      // Object format
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          (settings.value as any)[key] = value;
        } else if (Array.isArray(value)) {
          (settings.value as any)[key] = value.join(', ');
        } else if (Object.keys(settings.value).includes(key)) {
          (settings.value as any)[key] = value;
        }
      });
    }

    originalSettings.value = JSON.parse(JSON.stringify(settings.value));
    hasUnsavedChanges.value = false;
  } catch (error) {
    console.error('Fetch settings error:', error);
    ElMessage.error('获取设置失败');
  } finally {
    isLoading.value = false;
  }
};

const saveSettings = async () => {
  if (!settings.value.PLATFORM_NAME?.trim()) {
    return ElMessage.warning('平台名称不能为空');
  }

  try {
    isSaving.value = true;
    const settingsPayload = Object.entries(settings.value).map(([key, value]) => {
      if (key === 'MATERIAL_CATEGORIES' || key === 'ALLOWED_FILE_TYPES') {
        const arr = (value as string)
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s);
        return { key, value: JSON.stringify(arr) };
      }
      return { key, value: typeof value === 'boolean' ? String(value) : value };
    });

    await api.post('/api/admin/settings', { settings: settingsPayload });
    ElMessage.success('系统设置已成功保存');

    originalSettings.value = JSON.parse(JSON.stringify(settings.value));
    hasUnsavedChanges.value = false;

    if (systemStore.settings) {
      systemStore.settings.PLATFORM_NAME = settings.value.PLATFORM_NAME;
      systemStore.settings.ALLOW_REGISTRATION = settings.value.ALLOW_REGISTRATION === true;
      systemStore.settings.MAINTENANCE_MODE = settings.value.MAINTENANCE_MODE === true;
      document.title = settings.value.PLATFORM_NAME;
    }
  } catch (error: any) {
    console.error('Save settings error:', error);
    ElMessage.error(error.response?.data?.error || '保存设置失败');
  } finally {
    isSaving.value = false;
  }
};

const handleToggleMaintenance = async (val: boolean) => {
  if (val) {
    try {
      await ElMessageBox.confirm(
        '开启维护模式后，所有非管理员用户将无法访问平台。确定要开启吗？',
        '确认开启维护模式',
        {
          confirmButtonText: '确认开启',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger',
        },
      );
    } catch {
      settings.value.MAINTENANCE_MODE = false;
    }
  }
};

const resetToDefaults = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将所有设置恢复为默认值，未保存的更改将丢失。确定继续？',
      '重置为默认值',
      {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    settings.value = { ...defaultSettings };
    ElMessage.info('已恢复默认值，请点击保存以生效');
  } catch {}
};

const testSmtp = async () => {
  try {
    isTestingSmtp.value = true;
    const { data } = await api.post('/api/admin/settings/test-smtp', {
      host: settings.value.SMTP_HOST,
      port: settings.value.SMTP_PORT,
      user: settings.value.SMTP_USER,
      pass: settings.value.SMTP_PASS,
      from: settings.value.SMTP_FROM,
      secure: settings.value.SMTP_SECURE === 'true',
    });
    ElMessage.success(data.message);
  } catch (error: any) {
    console.error('Test SMTP error:', error);
    ElMessage.error(error.response?.data?.error || 'SMTP 测试失败');
  } finally {
    isTestingSmtp.value = false;
  }
};

onMounted(fetchSettings);

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault();
  }
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <div
      class="min-h-20 py-4 lg:py-0 lg:h-20 border-b px-4 sm:px-8 flex flex-col lg:flex-row gap-4 lg:items-center justify-between shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 sm:gap-4">
        <div class="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl shrink-0">
          <Settings class="w-5.5 h-5.5 sm:w-6 sm:h-6 text-slate-600" />
        </div>
        <div>
          <h1 class="text-xl sm:text-2xl font-black tracking-tight" style="color: var(--text-primary)">
            全局系统设置
          </h1>
          <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">
            配置平台核心参数、自动化邮件及安全开关
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap w-full lg:w-auto">
        <div
          v-if="hasUnsavedChanges"
          class="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 shrink-0"
        >
          <AlertTriangle class="w-3.5 h-3.5 text-amber-500" />
          <span class="text-[11px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap"
            >有未保存的更改</span
          >
        </div>
        <button
          class="flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-all hover:bg-slate-50 dark:hover:bg-white/5 shrink-0 whitespace-nowrap"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          @click="resetToDefaults"
        >
          <RotateCcw class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>恢复默认</span>
        </button>
        <button
          :disabled="isSaving"
          class="flex items-center gap-1.5 px-4 py-2 sm:px-6 sm:py-2.5 bg-accent text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 shrink-0 whitespace-nowrap"
          @click="saveSettings"
        >
          <Save v-if="!isSaving" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <RefreshCw v-else class="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
          <span>{{ isSaving ? '正在保存...' : '保存全局设置' }}</span>
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <div
        class="w-full lg:w-56 border-b lg:border-b-0 lg:border-r shrink-0 overflow-y-auto p-4 transition-colors duration-300"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="px-3 mb-4 hidden lg:block">
          <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">设置分类</h2>
        </div>
        <nav class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="flex-1 lg:flex-none w-auto lg:w-full flex items-center gap-2 lg:gap-3 px-4 py-2.5 lg:py-3 rounded-xl text-sm font-medium transition-all shrink-0 whitespace-nowrap"
            :class="
              activeTab === tab.id
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
            "
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" class="w-4 h-4 shrink-0" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
        <div class="max-w-3xl mx-auto space-y-8 pb-12">
          <!-- General Settings -->
          <div
            v-if="activeTab === 'general'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <Globe class="w-5 h-5 text-indigo-600" />
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">基础运营配置</h2>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >平台显示名称</label
                  >
                  <input
                    v-model="settings.PLATFORM_NAME"
                    type="text"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>

                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >新用户默认角色</label
                  >
                  <select
                    v-model="settings.DEFAULT_USER_ROLE"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all appearance-none cursor-pointer"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  >
                    <option v-for="opt in defaultRoleOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div class="flex flex-col justify-center space-y-4 md:col-span-2">
                  <div
                    class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
                  >
                    <div class="flex items-center gap-3">
                      <UserPlus class="w-4 h-4 text-emerald-500" />
                      <div>
                        <span class="text-xs font-bold" style="color: var(--text-primary)"
                          >允许新用户注册</span
                        >
                        <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                          关闭后仅管理员可创建新账号
                        </p>
                      </div>
                    </div>
                    <el-switch v-model="settings.ALLOW_REGISTRATION" active-color="#10b981" />
                  </div>

                  <div
                    class="flex items-center justify-between p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all"
                  >
                    <div class="flex items-center gap-3">
                      <Lock class="w-4 h-4 text-rose-500" />
                      <div>
                        <span class="text-xs font-bold" style="color: var(--text-primary)"
                          >维护模式</span
                        >
                        <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                          开启后仅管理员可登入平台
                        </p>
                      </div>
                    </div>
                    <el-switch
                      v-model="settings.MAINTENANCE_MODE"
                      active-color="#f43f5e"
                      @change="handleToggleMaintenance"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Branding Settings -->
          <div
            v-if="activeTab === 'branding'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <Palette class="w-5 h-5 text-pink-500" />
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">平台品牌配置</h2>
              </div>

              <div class="space-y-6">
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >平台 Logo URL</label
                  >
                  <div class="flex items-center gap-4">
                    <div
                      v-if="settings.PLATFORM_LOGO_URL"
                      class="w-12 h-12 rounded-xl border overflow-hidden flex items-center justify-center shrink-0"
                      style="border-color: var(--border-base)"
                    >
                      <img
                        :src="settings.PLATFORM_LOGO_URL"
                        class="w-full h-full object-contain p-1"
                      />
                    </div>
                    <div
                      v-else
                      class="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
                      style="border-color: var(--border-base); background-color: var(--bg-app)"
                    >
                      <Image class="w-5 h-5 text-slate-300" />
                    </div>
                    <input
                      v-model="settings.PLATFORM_LOGO_URL"
                      type="text"
                      placeholder="https://example.com/logo.png"
                      class="flex-1 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                    />
                  </div>
                  <p class="text-[10px] px-1" style="color: var(--text-muted)">
                    推荐尺寸 128x128px，支持 PNG/SVG 格式
                  </p>
                </div>

                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >平台描述</label
                  >
                  <textarea
                    v-model="settings.PLATFORM_DESCRIPTION"
                    rows="3"
                    placeholder="一句话介绍你的平台..."
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  ></textarea>
                  <p class="text-[10px] px-1" style="color: var(--text-muted)">
                    将显示在登录页面和 SEO 元数据中
                  </p>
                </div>

                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >页脚文字</label
                  >
                  <input
                    v-model="settings.FOOTER_TEXT"
                    type="text"
                    placeholder="© 2026 Your Company. All rights reserved."
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                  <p class="text-[10px] px-1" style="color: var(--text-muted)">
                    显示在页面底部，支持 HTML
                  </p>
                </div>
              </div>
            </section>
          </div>

          <!-- Security Settings -->
          <div
            v-if="activeTab === 'security'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <Shield class="w-5 h-5 text-blue-500" />
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">安全策略配置</h2>
              </div>

              <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-2">
                    <label
                      class="text-xs font-bold px-1 flex items-center gap-2"
                      style="color: var(--text-secondary)"
                    >
                      <KeyRound class="w-3.5 h-3.5" />
                      密码最小长度
                    </label>
                    <input
                      v-model="settings.PASSWORD_MIN_LENGTH"
                      type="number"
                      min="4"
                      max="128"
                      class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                    />
                    <p class="text-[10px] px-1" style="color: var(--text-muted)">
                      用户注册和修改密码时的最低长度要求
                    </p>
                  </div>

                  <div class="space-y-2">
                    <label
                      class="text-xs font-bold px-1 flex items-center gap-2"
                      style="color: var(--text-secondary)"
                    >
                      <Clock class="w-3.5 h-3.5" />
                      会话超时时间
                    </label>
                    <select
                      v-model="settings.SESSION_TIMEOUT"
                      class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all appearance-none cursor-pointer"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                    >
                      <option
                        v-for="opt in sessionTimeoutOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                    <p class="text-[10px] px-1" style="color: var(--text-muted)">
                      用户登录后保持登录状态的时间
                    </p>
                  </div>
                </div>

                <div class="space-y-4 pt-2">
                  <div
                    class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
                  >
                    <div class="flex items-center gap-3">
                      <Sparkles class="w-4 h-4 text-violet-500" />
                      <div>
                        <span class="text-xs font-bold" style="color: var(--text-primary)"
                          >自动审核通过材料</span
                        >
                        <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                          开启后用户上传的材料无需人工审核即可发布
                        </p>
                      </div>
                    </div>
                    <el-switch v-model="settings.AUTO_APPROVE_MATERIALS" active-color="#8b5cf6" />
                  </div>

                  <div
                    class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
                  >
                    <div class="flex items-center gap-3">
                      <MonitorSmartphone class="w-4 h-4 text-cyan-500" />
                      <div>
                        <span class="text-xs font-bold" style="color: var(--text-primary)"
                          >自动审核通过作品</span
                        >
                        <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                          开启后用户发布的作品无需人工审核即可展示
                        </p>
                      </div>
                    </div>
                    <el-switch v-model="settings.AUTO_APPROVE_SHOWCASES" active-color="#06b6d4" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Upload Limits Settings -->
          <div
            v-if="activeTab === 'upload'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <Upload class="w-5 h-5 text-emerald-500" />
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">上传与存储限制</h2>
              </div>

              <div class="space-y-6">
                <div class="space-y-2">
                  <label
                    class="text-xs font-bold px-1 flex items-center gap-2"
                    style="color: var(--text-secondary)"
                  >
                    <Upload class="w-3.5 h-3.5" />
                    单文件最大上传大小 (MB)
                  </label>
                  <input
                    v-model="settings.MAX_UPLOAD_SIZE_MB"
                    type="number"
                    min="1"
                    max="2048"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                  <p class="text-[10px] px-1" style="color: var(--text-muted)">
                    限制用户上传的单个文件大小，建议不超过 500MB
                  </p>
                </div>

                <div class="space-y-2">
                  <label
                    class="text-xs font-bold px-1 flex items-center gap-2"
                    style="color: var(--text-secondary)"
                  >
                    <FileText class="w-3.5 h-3.5" />
                    允许的文件类型 (使用逗号分隔)
                  </label>
                  <textarea
                    v-model="settings.ALLOWED_FILE_TYPES"
                    rows="2"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  ></textarea>
                  <p class="text-[10px] px-1" style="color: var(--text-muted)">
                    仅允许上传指定扩展名的文件，留空则不限制
                  </p>
                </div>
              </div>
            </section>
          </div>

          <!-- SMTP Settings -->
          <div
            v-if="activeTab === 'smtp'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-3">
                  <Mail class="w-5 h-5 text-accent" />
                  <h2 class="text-lg font-bold" style="color: var(--text-primary)">
                    SMTP 邮件服务配置
                  </h2>
                </div>
                <button
                  :disabled="isTestingSmtp"
                  class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors disabled:opacity-50"
                  @click="testSmtp"
                >
                  {{ isTestingSmtp ? '正在尝试握手...' : '测试连接' }}
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >服务器地址</label
                  >
                  <input
                    v-model="settings.SMTP_HOST"
                    type="text"
                    placeholder="smtp.gmail.com"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >端口</label
                  >
                  <input
                    v-model="settings.SMTP_PORT"
                    type="text"
                    placeholder="465"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >账号 (USER)</label
                  >
                  <input
                    v-model="settings.SMTP_USER"
                    type="text"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >授权码 (PASS)</label
                  >
                  <div class="relative">
                    <input
                      v-model="settings.SMTP_PASS"
                      :type="showPassword ? 'text' : 'password'"
                      class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                      style="
                        background-color: var(--bg-app);
                        border-color: var(--border-base);
                        color: var(--text-primary);
                      "
                    />
                    <button
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                      @click="showPassword = !showPassword"
                    >
                      <Eye v-if="!showPassword" class="w-4 h-4" />
                      <EyeOff v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >发件人名称</label
                  >
                  <input
                    v-model="settings.SMTP_FROM_NAME"
                    type="text"
                    placeholder="3D Learning Hub"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                  <p class="text-[10px] px-1" style="color: var(--text-muted)">
                    收件人看到的发件人名称
                  </p>
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >发件人邮箱 (FROM)</label
                  >
                  <input
                    v-model="settings.SMTP_FROM"
                    type="text"
                    placeholder="noreply@example.com"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>
                <div class="flex items-center gap-3 pt-4 md:col-span-2">
                  <el-switch
                    v-model="settings.SMTP_SECURE"
                    active-value="true"
                    inactive-value="false"
                    active-color="#6366f1"
                  />
                  <span class="text-xs font-bold" style="color: var(--text-primary)"
                    >启用 SSL/TLS 连接</span
                  >
                  <span class="text-[10px] ml-2" style="color: var(--text-muted)"
                    >端口 465 通常需要开启，587 通常关闭</span
                  >
                </div>
              </div>
            </section>
          </div>

          <!-- OAuth Settings -->
          <div
            v-if="activeTab === 'social'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <Chrome class="w-5 h-5 text-accent" />
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">Google OAuth 配置</h2>
              </div>

              <div class="space-y-6">
                <div class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all">
                  <div class="flex items-center gap-3">
                    <Chrome class="w-4 h-4 text-accent" />
                    <div>
                      <span class="text-xs font-bold" style="color: var(--text-primary)">开启 Google 登录</span>
                      <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">允许用户使用 Google 账号直接登录平台</p>
                    </div>
                  </div>
                  <el-switch v-model="settings.OAUTH_GOOGLE_ENABLED" active-color="#4f46e5" />
                </div>

                <div v-if="settings.OAUTH_GOOGLE_ENABLED" class="grid grid-cols-1 gap-6 animate-in fade-in duration-300">
                  <div class="space-y-2">
                    <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">Client ID</label>
                    <input v-model="settings.OAUTH_GOOGLE_CLIENT_ID" type="text" class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);" />
                  </div>
                  <div class="space-y-2">
                    <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">Client Secret</label>
                    <div class="relative">
                      <input v-model="settings.OAUTH_GOOGLE_CLIENT_SECRET" :type="showPassword ? 'text' : 'password'" class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);" />
                      <button class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" @click="showPassword = !showPassword">
                        <Eye v-if="!showPassword" class="w-4 h-4" />
                        <EyeOff v-else class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div class="p-4 rounded-xl bg-slate-100 dark:bg-white/5 space-y-2">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Google 回调地址 (Authorized Redirect URI)</p>
                    <code class="text-xs break-all text-accent font-mono">{{ api.defaults.baseURL }}/api/auth/google/callback</code>
                  </div>
                </div>
              </div>
            </section>

            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <Github class="w-5 h-5 text-slate-800 dark:text-white" />
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">GitHub OAuth 配置</h2>
              </div>

              <div class="space-y-6">
                <div class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all">
                  <div class="flex items-center gap-3">
                    <Github class="w-4 h-4 text-slate-800 dark:text-white" />
                    <div>
                      <span class="text-xs font-bold" style="color: var(--text-primary)">开启 GitHub 登录</span>
                      <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">允许用户使用 GitHub 账号直接登录平台</p>
                    </div>
                  </div>
                  <el-switch v-model="settings.OAUTH_GITHUB_ENABLED" active-color="#000" />
                </div>

                <div v-if="settings.OAUTH_GITHUB_ENABLED" class="grid grid-cols-1 gap-6 animate-in fade-in duration-300">
                  <div class="space-y-2">
                    <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">Client ID</label>
                    <input v-model="settings.OAUTH_GITHUB_CLIENT_ID" type="text" class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);" />
                  </div>
                  <div class="space-y-2">
                    <label class="text-xs font-bold px-1" style="color: var(--text-secondary)">Client Secret</label>
                    <div class="relative">
                      <input v-model="settings.OAUTH_GITHUB_CLIENT_SECRET" :type="showPassword ? 'text' : 'password'" class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all" style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);" />
                      <button class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" @click="showPassword = !showPassword">
                        <Eye v-if="!showPassword" class="w-4 h-4" />
                        <EyeOff v-else class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div class="p-4 rounded-xl bg-slate-100 dark:bg-white/5 space-y-2">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">GitHub 回调地址 (Authorization callback URL)</p>
                    <code class="text-xs break-all text-accent font-mono">{{ api.defaults.baseURL }}/api/auth/github/callback</code>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Email Template Settings -->
          <div
            v-if="activeTab === 'template'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-3">
                  <Layout class="w-5 h-5 text-indigo-600" />
                  <h2 class="text-lg font-bold" style="color: var(--text-primary)">验证邮件模版</h2>
                </div>
                <button
                  class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors"
                  @click="showEmailPreview = !showEmailPreview"
                >
                  {{ showEmailPreview ? '关闭预览' : '预览邮件' }}
                </button>
              </div>

              <div class="space-y-6">
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >邮件主题 (Subject)</label
                  >
                  <input
                    v-model="settings.EMAIL_VERIFY_SUBJECT"
                    type="text"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-xs font-bold px-1 flex justify-between items-center"
                    style="color: var(--text-secondary)"
                  >
                    <span>正文内容 (支持 HTML)</span>
                    <span v-pre class="text-[10px] opacity-60">可用占位符: {{ code }}</span>
                  </label>
                  <textarea
                    v-model="settings.EMAIL_VERIFY_BODY"
                    rows="8"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none font-mono text-sm"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  ></textarea>
                </div>
              </div>
            </section>

            <section
              v-if="showEmailPreview"
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-6">
                <Eye class="w-5 h-5 text-accent" />
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">邮件预览</h2>
              </div>
              <div
                class="rounded-2xl border overflow-hidden"
                style="border-color: var(--border-base)"
              >
                <div
                  class="px-6 py-3 border-b flex items-center gap-4"
                  style="background-color: var(--bg-app); border-color: var(--border-base)"
                >
                  <div class="space-y-1">
                    <p class="text-[10px] font-bold" style="color: var(--text-muted)">主题</p>
                    <p class="text-xs font-medium" style="color: var(--text-primary)">
                      {{ settings.EMAIL_VERIFY_SUBJECT }}
                    </p>
                  </div>
                </div>
                <div class="p-6 bg-white" v-html="sanitizeHtml(emailPreviewHtml)"></div>
              </div>
            </section>
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

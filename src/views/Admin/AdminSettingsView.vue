<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted, watch, computed } from 'vue';
import {
  Settings,
  Mail,
  Shield,
  Save,
  RefreshCw,
  Layout,
  Globe,
  Upload,
  Download,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Palette,
  Cpu,
  CheckCircle,
  Cloud,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useSystemStore } from '@/stores/system';
import { getApiErrorMessage } from '@/utils/error';

// Import subcomponents
import GeneralSettingsTab from './components/GeneralSettingsTab.vue';
import BrandingSettingsTab from './components/BrandingSettingsTab.vue';
import SecuritySettingsTab from './components/SecuritySettingsTab.vue';
import UploadSettingsTab from './components/UploadSettingsTab.vue';
import SmtpSettingsTab from './components/SmtpSettingsTab.vue';
import SocialSettingsTab from './components/SocialSettingsTab.vue';
import TemplateSettingsTab from './components/TemplateSettingsTab.vue';
import AiSettingsTab from './components/AiSettingsTab.vue';
import StorageSettingsTab from './components/StorageSettingsTab.vue';

const systemStore = useSystemStore();
const isLoading = ref(false);
const isSaving = ref(false);

const activeTab = ref('general');
const hasUnsavedChanges = ref(false);

const defaultSettings = {
  SMTP_HOST: '',
  SMTP_PORT: '465',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: '',
  SMTP_FROM_NAME: '',
  SMTP_SECURE: 'true',
  SMTP_CONFIGS: '[]',
  SMTP_ACTIVE_CONFIG_ID: 'default',
  SYSTEM_EMAIL_PROVIDER: 'SMTP',
  MICROSOFT_POOL_FAILBACK: true,
  EMAIL_VERIFY_SUBJECT: t('admin.your_email_verification_code'),
  EMAIL_VERIFY_BODY: t('admin.hello_your_verification_code'),
  PLATFORM_NAME: '3D Personal Learning Hub',
  PLATFORM_SUBTITLE: '一起学 Blender，创造无限可能',
  BROWSER_TITLE: '',
  PLATFORM_LOGO_URL: '',
  PLATFORM_FAVICON_URL: '',
  PLATFORM_DESCRIPTION: '',
  ALLOW_REGISTRATION: true,
  MAINTENANCE_MODE: false,
  FORCE_R2_STORAGE: true,
  DEFAULT_USER_ROLE: 'USER',
  PASSWORD_MIN_LENGTH: '6',
  SESSION_TIMEOUT: '7d',
  AUTO_APPROVE_MATERIALS: false,
  AUTO_APPROVE_SHOWCASES: false,
  MAX_UPLOAD_SIZE_MB: '100',
  ALLOWED_FILE_TYPES: '.glb, .gltf, .fbx, .obj, .stl, .zip, .jpg, .jpeg, .png, .gif, .webp, .svg',
  FOOTER_TEXT: '',
  OAUTH_GOOGLE_ENABLED: false,
  OAUTH_GOOGLE_CLIENT_ID: '',
  OAUTH_GOOGLE_CLIENT_SECRET: '',
  OAUTH_GITHUB_ENABLED: false,
  OAUTH_GITHUB_CLIENT_ID: '',
  OAUTH_GITHUB_CLIENT_SECRET: '',
  AI_IMPORT_ENABLED: false,
  AI_PROVIDER: 'DEEPSEEK',
  AI_API_KEY: '',
  AI_API_ENDPOINT: 'https://api.deepseek.com/v1',
  AI_MODEL_NAME: 'deepseek-chat',
  AI_MODEL_OPTIONS: '[]',
  AI_MODEL_CUSTOM_CATEGORIES: '[]',
};

type SettingValue = string | boolean;
type SettingsRecord = Record<string, SettingValue>;

interface ApiSetting {
  key: string;
  value: unknown;
}

interface SmtpConfig {
  id: string;
  name: string;
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
  secure: string;
}

interface AiModelConfig {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
  description: string;
  capabilities: string[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  showAdvanced?: boolean;
  customFamilyKey?: string;
  customFamilyLabel?: string;
}

const settings = ref({ ...defaultSettings });
const originalSettings = ref({ ...defaultSettings });
const aiModelConfigs = ref<AiModelConfig[]>([]);
const pendingModelFamilyIds = ref<string[]>([]);
const smtpConfigs = ref<SmtpConfig[]>([]);

const SECRET_PLACEHOLDER = '__REDACTED_SECRET__';
const SECRET_SETTING_KEYS = new Set([
  'AI_API_KEY',
  'SMTP_PASS',
  'OAUTH_GOOGLE_CLIENT_SECRET',
  'OAUTH_GITHUB_CLIENT_SECRET',
]);

const clonePlain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const isRedactedSecret = (value: unknown) => value === SECRET_PLACEHOLDER;

const isKnownSettingKey = (key: string): key is keyof typeof defaultSettings => {
  return Object.prototype.hasOwnProperty.call(defaultSettings, key);
};

const setSettingValue = (key: string, value: SettingValue) => {
  if (isKnownSettingKey(key)) {
    (settings.value as SettingsRecord)[key] = value;
  }
};

const getDefaultSettingValue = (key: string): SettingValue => {
  return (defaultSettings as SettingsRecord)[key] ?? '';
};

const normalizeSmtpConfigs = (value: unknown): SmtpConfig[] => {
  let raw = value;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): SmtpConfig | null => {
      if (!item || typeof item !== 'object') return null;
      const config = item as Record<string, unknown>;
      const id = String(config.id || '').trim();
      if (!id) return null;
      return {
        id,
        name: String(config.name || id),
        host: String(config.host || ''),
        port: String(config.port || '465'),
        user: String(config.user || ''),
        pass: String(config.pass || ''),
        from: String(config.from || ''),
        secure: String(config.secure ?? 'true'),
      };
    })
    .filter((item): item is SmtpConfig => Boolean(item));
};

const normalizeAiModels = (value: unknown): AiModelConfig[] => {
  let raw = value;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index): AiModelConfig | null => {
      if (!item || typeof item !== 'object') return null;
      const model = item as Record<string, unknown>;
      const provider = String(model.provider || 'DEEPSEEK').toUpperCase();
      const modelName = String(model.modelName || '').trim();
      return {
        // Spread ALL original fields first so no extra fields (apiKeys, failoverEnabled, priority…) are lost
        ...(model as Partial<AiModelConfig>),
        id: String(model.id || `model_${index + 1}`),
        name: String(model.name || `${provider} ${modelName}`),
        provider,
        modelName,
        endpoint: String(model.endpoint || ''),
        apiKey: typeof model.apiKey === 'string' ? model.apiKey : '',
        enabled: model.enabled === true || model.enabled === 'true',
        isDefault: model.isDefault === true || model.isDefault === 'true',
        description: typeof model.description === 'string' ? model.description : '',
        capabilities: Array.isArray(model.capabilities) ? model.capabilities.map(String) : ['chat'],
        temperature: typeof model.temperature === 'number' ? model.temperature : 0.7,
        maxTokens: typeof model.maxTokens === 'number' ? model.maxTokens : 2000,
        systemPrompt: typeof model.systemPrompt === 'string' ? model.systemPrompt : '',
        showAdvanced: false,
        customFamilyKey:
          typeof model.customFamilyKey === 'string' ? model.customFamilyKey : undefined,
        customFamilyLabel:
          typeof model.customFamilyLabel === 'string' ? model.customFamilyLabel : undefined,
      };
    })
    .filter((item): item is AiModelConfig => Boolean(item));
};

watch(
  () => settings.value.SMTP_CONFIGS,
  (val) => {
    try {
      smtpConfigs.value = normalizeSmtpConfigs(val);
    } catch {
      smtpConfigs.value = [];
    }
  },
  { immediate: true },
);

const tabs = [
  { id: 'general', label: t('admin.basic_operations'), icon: Globe },
  { id: 'branding', label: t('admin.platform_brand'), icon: Palette },
  { id: 'security', label: t('admin.security_policy'), icon: Shield },
  { id: 'upload', label: t('admin.upload_limit'), icon: Upload },
  { id: 'storage', label: '云端存储配置', icon: Cloud },
  { id: 'smtp', label: t('admin.mail_service'), icon: Mail },
  { id: 'social', label: t('admin.social_login'), icon: Sparkles },
  { id: 'template', label: t('admin.email_template'), icon: Layout },
  { id: 'ai', label: t('admin.ai_intelligent_assistance'), icon: Cpu },
];

const activeTabMeta = computed(() => tabs.find((tab) => tab.id === activeTab.value) || tabs[0]);

const enabledAiModelCount = computed(
  () => aiModelConfigs.value.filter((model) => model.enabled).length,
);

const defaultAiModelLabel = computed(() => {
  const defaultModel =
    aiModelConfigs.value.find((model) => model.enabled && model.isDefault) ||
    aiModelConfigs.value.find((model) => model.enabled);
  return defaultModel?.name || defaultModel?.modelName || '未配置';
});

const configuredSmtpCount = computed(
  () => smtpConfigs.value.filter((config) => config.host && config.user).length,
);

const configurationCompleteness = computed(() => {
  const checks = [
    Boolean(String(settings.value.PLATFORM_NAME || '').trim()),
    Boolean(String(settings.value.PLATFORM_SUBTITLE || '').trim()),
    Boolean(String(settings.value.DEFAULT_USER_ROLE || '').trim()),
    Number(settings.value.PASSWORD_MIN_LENGTH || 0) >= 6,
    Boolean(String(settings.value.MAX_UPLOAD_SIZE_MB || '').trim()),
    settings.value.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL' || configuredSmtpCount.value > 0,
    !settings.value.AI_IMPORT_ENABLED || enabledAiModelCount.value > 0,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
});

const settingsSignalCards = computed(() => [
  {
    label: '配置完整度',
    value: `${configurationCompleteness.value}%`,
    detail: configurationCompleteness.value >= 85 ? '核心项已就绪' : '还有关键项待完善',
    icon: CheckCircle,
    tone: configurationCompleteness.value >= 85 ? 'emerald' : 'amber',
  },
  {
    label: '发信通道',
    value:
      settings.value.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'
        ? '账号池'
        : `${configuredSmtpCount.value}/${smtpConfigs.value.length || 1}`,
    detail:
      settings.value.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'
        ? 'Microsoft 账号池'
        : 'SMTP 配置方案',
    icon: Mail,
    tone:
      settings.value.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'
        ? 'sky'
        : configuredSmtpCount.value > 0
          ? 'sky'
          : 'amber',
  },
  {
    label: 'AI 模型池',
    value: `${enabledAiModelCount.value}/${aiModelConfigs.value.length}`,
    detail: defaultAiModelLabel.value,
    icon: Cpu,
    tone: settings.value.AI_IMPORT_ENABLED ? 'violet' : 'amber',
  },
  {
    label: '安全状态',
    value: settings.value.MAINTENANCE_MODE ? '维护中' : '在线',
    detail: `密码不少于 ${settings.value.PASSWORD_MIN_LENGTH || 6} 位`,
    icon: Shield,
    tone: settings.value.MAINTENANCE_MODE ? 'rose' : 'emerald',
  },
]);

// Compare via serialized snapshot instead of deep-watching the entire object:
// deep watch fires on every nested mutation and re-serializes twice per tick.
const settingsSnapshot = computed(() => JSON.stringify(settings.value));
const originalSnapshot = computed(() => JSON.stringify(originalSettings.value));
watch(
  [settingsSnapshot, originalSnapshot],
  () => {
    hasUnsavedChanges.value = settingsSnapshot.value !== originalSnapshot.value;
  },
);

// Keep settings.value.AI_MODEL_OPTIONS in sync with aiModelConfigs so that
// saveSettings() always writes the latest user edits (e.g. capabilities changes).
// Guard: don't fire during fetchSettings to avoid overwriting with a stripped version.
let _isLoadingSettings = false;
watch(
  aiModelConfigs,
  (newVal) => {
    if (_isLoadingSettings) return;
    settings.value.AI_MODEL_OPTIONS = JSON.stringify(newVal);
  },
  { deep: true },
);


const fetchSettings = async () => {
  try {
    _isLoadingSettings = true;
    isLoading.value = true;
    const { data } = await api.get('/api/admin/settings');

    if (Array.isArray(data)) {
      data.forEach((s: ApiSetting) => {
        if (
          s.key === 'ALLOW_REGISTRATION' ||
          s.key === 'MAINTENANCE_MODE' ||
          s.key === 'AUTO_APPROVE_MATERIALS' ||
          s.key === 'AUTO_APPROVE_SHOWCASES' ||
          s.key === 'MICROSOFT_POOL_FAILBACK' ||
          s.key === 'FORCE_R2_STORAGE' ||
          s.key.endsWith('_ENABLED')
        ) {
          setSettingValue(s.key, s.value === 'true' || s.value === true);
        } else if (
          s.key === 'MATERIAL_CATEGORIES' ||
          s.key === 'ALLOWED_FILE_TYPES' ||
          s.key === 'ALLOWED_EXTENSIONS'
        ) {
          try {
            const arr = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
            setSettingValue(s.key, Array.isArray(arr) ? arr.join(', ') : String(arr || ''));
          } catch {
            setSettingValue(s.key, getDefaultSettingValue(s.key));
          }
        } else if (s.key === 'AI_MODEL_OPTIONS') {
          setSettingValue(
            s.key,
            typeof s.value === 'string' ? s.value : JSON.stringify(s.value || []),
          );
        } else if (Object.keys(settings.value).includes(s.key)) {
          setSettingValue(s.key, typeof s.value === 'boolean' ? s.value : String(s.value ?? ''));
        }
      });
    } else {
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'MICROSOFT_POOL_FAILBACK') {
          setSettingValue(key, value === true || value === 'true');
        } else if (typeof value === 'boolean') {
          setSettingValue(key, value);
        } else if (Array.isArray(value)) {
          setSettingValue(
            key,
            key === 'AI_MODEL_OPTIONS' ? JSON.stringify(value) : value.join(', '),
          );
        } else if (Object.keys(settings.value).includes(key)) {
          if (
            key !== 'SMTP_CONFIGS' &&
            key !== 'AI_MODEL_OPTIONS' &&
            typeof value === 'string' &&
            value.trim().startsWith('[')
          ) {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                setSettingValue(key, parsed.join(', '));
                return;
              }
            } catch (_e) {}
          }
          setSettingValue(key, typeof value === 'boolean' ? value : String(value ?? ''));
        }
      });
    }

    aiModelConfigs.value = normalizeAiModels(settings.value.AI_MODEL_OPTIONS);
    if (aiModelConfigs.value.length === 0) {
      aiModelConfigs.value = [
        {
          id: 'default',
          name: `${settings.value.AI_PROVIDER} ${settings.value.AI_MODEL_NAME}`.trim(),
          provider: settings.value.AI_PROVIDER,
          modelName: settings.value.AI_MODEL_NAME,
          endpoint: settings.value.AI_API_ENDPOINT,
          apiKey: settings.value.AI_API_KEY,
          enabled: true,
          isDefault: true,
          description: t('admin.automatically_generated_from_legacy'),
          capabilities: ['chat'],
        },
      ];
    }

    try {
      smtpConfigs.value = normalizeSmtpConfigs(settings.value.SMTP_CONFIGS);
    } catch {
      smtpConfigs.value = [];
    }

    if (smtpConfigs.value.length === 0) {
      const defaultCfg: SmtpConfig = {
        id: 'default',
        name: t('admin.default_configuration'),
        host: settings.value.SMTP_HOST || '',
        port: settings.value.SMTP_PORT || '465',
        user: settings.value.SMTP_USER || '',
        pass: settings.value.SMTP_PASS || '',
        from: settings.value.SMTP_FROM || '',
        secure: settings.value.SMTP_SECURE || 'true',
      };
      smtpConfigs.value = [defaultCfg];
      settings.value.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);
      settings.value.SMTP_ACTIVE_CONFIG_ID = 'default';
    }

    originalSettings.value = JSON.parse(JSON.stringify(settings.value));
    hasUnsavedChanges.value = false;
  } catch (error) {
    console.error('Fetch settings error:', error);
    ElMessage.error(t('admin.failed_to_get_settings'));
  } finally {
    _isLoadingSettings = false;
    isLoading.value = false;
  }
};

const saveSettings = async () => {
  if (!settings.value.PLATFORM_NAME?.trim()) {
    return ElMessage.warning(t('admin.platform_name_cannot_be'));
  }

  try {
    isSaving.value = true;
    const settingsPayload = Object.entries(settings.value).map(([key, value]) => {
      return { key, value: typeof value === 'boolean' ? String(value) : value };
    });

    await api.post('/api/admin/settings', { settings: settingsPayload });
    ElMessage.success(t('admin.system_settings_saved_successfully'));

    originalSettings.value = JSON.parse(JSON.stringify(settings.value));
    hasUnsavedChanges.value = false;

    if (systemStore.settings) {
      systemStore.settings.PLATFORM_NAME = settings.value.PLATFORM_NAME;
      systemStore.settings.PLATFORM_SUBTITLE = settings.value.PLATFORM_SUBTITLE;
      systemStore.settings.BROWSER_TITLE = settings.value.BROWSER_TITLE;
      systemStore.settings.PLATFORM_LOGO_URL = settings.value.PLATFORM_LOGO_URL;
      systemStore.settings.PLATFORM_FAVICON_URL = settings.value.PLATFORM_FAVICON_URL;
      systemStore.settings.PLATFORM_DESCRIPTION = settings.value.PLATFORM_DESCRIPTION;
      systemStore.settings.ALLOW_REGISTRATION = settings.value.ALLOW_REGISTRATION === true;
      systemStore.settings.MAINTENANCE_MODE = settings.value.MAINTENANCE_MODE === true;
      systemStore.settings.FOOTER_TEXT = settings.value.FOOTER_TEXT;
      systemStore.settings.AI_IMPORT_ENABLED = settings.value.AI_IMPORT_ENABLED === true;
      systemStore.settings.AI_MODEL_OPTIONS = aiModelConfigs.value
        .filter((model) => model.enabled)
        .map((model) => ({
          id: model.id,
          name: model.name,
          provider: model.provider,
          modelName: model.modelName,
          enabled: model.enabled,
          isDefault: model.isDefault,
          description: model.description,
          capabilities: model.capabilities,
        }));
      systemStore.updateBrowserBranding();
    }
  } catch (error: unknown) {
    console.error('Save settings error:', error);
    ElMessage.error(getApiErrorMessage(error, t('admin.failed_to_save_settings')));
  } finally {
    isSaving.value = false;
  }
};

const resetToDefaults = async () => {
  try {
    await ElMessageBox.confirm(t('admin.this_action_returns_all'), t('admin.reset_to_default'), {
      confirmButtonText: t('admin.confirm_reset_1'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
    });
    settings.value = { ...defaultSettings };
    smtpConfigs.value = [
      {
        id: 'default',
        name: t('admin.default_configuration'),
        host: '',
        port: '465',
        user: '',
        pass: '',
        from: '',
        secure: 'true',
      },
    ];
    aiModelConfigs.value = [
      {
        id: 'default',
        name: 'DeepSeek Chat',
        provider: 'DEEPSEEK',
        modelName: 'deepseek-chat',
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: '',
        enabled: true,
        isDefault: true,
        description: '',
        capabilities: ['chat'],
      },
    ];
    settings.value.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);
    settings.value.AI_MODEL_OPTIONS = JSON.stringify(aiModelConfigs.value);
    ElMessage.info(t('admin.default_values_have_been'));
  } catch {}
};

const redactSettingsForExport = () => {
  return clonePlain(settings.value) as SettingsRecord;
};

const redactAiModelConfigsForExport = () => clonePlain(aiModelConfigs.value);

const findExistingAiModel = (model: AiModelConfig) =>
  aiModelConfigs.value.find((item) => item.id === model.id) ||
  aiModelConfigs.value.find(
    (item) =>
      item.provider === model.provider &&
      item.endpoint === model.endpoint &&
      item.modelName === model.modelName,
  );

const normalizeImportedAiModels = (value: unknown) =>
  normalizeAiModels(value).map((model) => {
    if (!isRedactedSecret(model.apiKey)) return model;
    return {
      ...model,
      apiKey: findExistingAiModel(model)?.apiKey || '',
    };
  });

const applyImportedSettings = (value: unknown) => {
  if (!value || typeof value !== 'object') return;

  const existingSmtpConfigs = normalizeSmtpConfigs(settings.value.SMTP_CONFIGS);
  Object.entries(value as Record<string, unknown>).forEach(([key, incomingValue]) => {
    if (!isKnownSettingKey(key)) return;
    if (SECRET_SETTING_KEYS.has(key) && isRedactedSecret(incomingValue)) return;

    if (key === 'SMTP_CONFIGS') {
      const smtpValue = normalizeSmtpConfigs(incomingValue).map((config) => {
        if (!isRedactedSecret(config.pass)) return config;
        return {
          ...config,
          pass: existingSmtpConfigs.find((existing) => existing.id === config.id)?.pass || '',
        };
      });
      setSettingValue(key, JSON.stringify(smtpValue));
      return;
    }

    setSettingValue(key, incomingValue as SettingValue);
  });
};

const importFileInputRef = ref<HTMLInputElement | null>(null);

const triggerImport = () => {
  importFileInputRef.value?.click();
};

const importSettingsFile = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target?.result as string;
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object' || data.platform !== '3d-personal-learning-platform') {
        return ElMessage.error('无效的配置文件格式！');
      }

      await ElMessageBox.confirm(
        '导入配置将覆盖当前页面上所有未保存的配置设置。是否继续？',
        '确认导入',
        {
          confirmButtonText: '确定导入',
          cancelButtonText: '取消',
          type: 'warning',
        },
      );

      if (data.settings) {
        applyImportedSettings(data.settings);
      }
      if (data.aiModelConfigs) {
        aiModelConfigs.value = normalizeImportedAiModels(data.aiModelConfigs);
      } else if (data.settings?.AI_MODEL_OPTIONS) {
        aiModelConfigs.value = normalizeImportedAiModels(data.settings.AI_MODEL_OPTIONS);
      }

      ElMessage.success('配置导入成功，请确认无误后点击“保存全局设置”保存至数据库！');
    } catch (error) {
      if (error !== 'cancel') {
        console.error('Import error:', error);
        ElMessage.error('配置文件解析失败，请检查文件内容是否正确！');
      }
    } finally {
      target.value = '';
    }
  };
  reader.readAsText(file);
};

const exportSettings = () => {
  const exportData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    platform: '3d-personal-learning-platform',
    settings: redactSettingsForExport(),
    aiModelConfigs: redactAiModelConfigsForExport(),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `system_settings_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success('配置导出成功。');
};

onMounted(() => {
  fetchSettings();
});
</script>

<template>
  <div v-loading="isLoading" class="h-full flex flex-col min-w-0">
    <!-- Top Action Bar -->
    <div
      class="border-b px-4 py-3 sm:px-6 shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center text-accent bg-accent/10"
          >
            <Settings class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-sm sm:text-base font-black" style="color: var(--text-primary)">
              {{ $t('admin.system_control_center') }}
            </h1>
            <p class="text-[10px] sm:text-xs mt-0.5" style="color: var(--text-muted)">
              {{ $t('admin.manage_global_variables_mail') }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto">
          <div
            v-if="hasUnsavedChanges"
            class="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-bold animate-pulse"
          >
            <AlertTriangle class="w-3.5 h-3.5" />
            <span>{{ $t('admin.there_are_unsaved_changes') }}</span>
          </div>
          <input
            ref="importFileInputRef"
            type="file"
            accept=".json"
            class="hidden"
            @change="importSettingsFile"
          />
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            title="一键导出所有系统配置"
            @click="exportSettings"
          >
            <Download class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">导出配置</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            title="一键从文件导入配置"
            @click="triggerImport"
          >
            <Upload class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">导入配置</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            :title="$t('admin.restore_default')"
            @click="resetToDefaults"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ $t('admin.restore_default') }}</span>
          </button>
          <button
            type="button"
            :disabled="isSaving"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-[11px] hover:bg-indigo-700 transition-all disabled:opacity-50 shrink-0 whitespace-nowrap shadow-sm cursor-pointer"
            :title="isSaving ? $t('admin.saving_1') : $t('admin.save_global_settings')"
            @click="saveSettings"
          >
            <Save v-if="!isSaving" class="w-3.5 h-3.5" />
            <RefreshCw v-else class="w-3.5 h-3.5 animate-spin" />
            <span class="hidden sm:inline">{{
              isSaving ? $t('admin.saving_1') : $t('admin.save_global_settings')
            }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 grid grid-cols-1 xl:grid-cols-[13.5rem_minmax(0,1fr)] overflow-hidden">
      <!-- Side Tab Navigation -->
      <div
        class="w-full border-b xl:border-b-0 xl:border-r shrink-0 overflow-y-auto p-3 transition-colors duration-300"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="px-2 mb-3 hidden xl:block">
          <h2 class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {{ $t('admin.set_categories') }}
          </h2>
          <p class="mt-1 text-[10px] font-semibold" style="color: var(--text-muted)">
            {{ activeTabMeta.label }} / {{ configurationCompleteness }}%
          </p>
        </div>
        <nav
          class="flex flex-row flex-nowrap xl:flex-col gap-1 pb-2 xl:pb-0 overflow-x-auto xl:overflow-visible scrollbar-hide"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="flex-none w-auto xl:w-full flex items-center justify-center xl:justify-start gap-2 px-3 py-2 xl:px-3 xl:py-2.5 rounded-lg text-[11px] xl:text-xs font-black transition-all shrink-0 whitespace-nowrap cursor-pointer"
            :class="
              activeTab === tab.id
                ? 'bg-accent text-white shadow-md shadow-accent/15'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
            "
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" class="w-3.5 h-3.5 shrink-0" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Tab Content Area -->
      <div class="min-w-0 overflow-y-auto p-3 sm:p-4 lg:p-5 scrollbar-hide">
        <div class="w-full max-w-none space-y-4 pb-8">
          <!-- Signal Cards -->
          <section class="settings-command-center">
            <div class="settings-command-copy">
              <span class="settings-eyebrow">SYSTEM CONTROL</span>
              <h2>{{ activeTabMeta.label }}</h2>
              <p>
                当前配置完整度
                {{ configurationCompleteness }}%，修改会先在页面暂存，保存后同步到服务端配置中心。
              </p>
            </div>
            <div class="settings-signal-grid">
              <article
                v-for="card in settingsSignalCards"
                :key="card.label"
                class="settings-signal-card"
                :data-tone="card.tone"
              >
                <component :is="card.icon" class="settings-signal-icon" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-1.5 leading-none mb-0.5">
                    <strong class="settings-signal-value">{{ card.value }}</strong>
                    <span class="settings-signal-label">{{ card.label }}</span>
                  </div>
                  <small class="settings-signal-detail">{{ card.detail }}</small>
                </div>
              </article>
            </div>
          </section>

          <!-- Tab panels -->
          <div class="w-full">
            <main class="settings-main-column min-w-0 space-y-4">
              <!-- General Settings -->
              <GeneralSettingsTab v-if="activeTab === 'general'" v-model:settings="settings" />

              <!-- Branding Settings -->
              <BrandingSettingsTab v-if="activeTab === 'branding'" v-model:settings="settings" />

              <!-- Security Settings -->
              <SecuritySettingsTab v-if="activeTab === 'security'" v-model:settings="settings" />

              <!-- Upload Settings -->
              <UploadSettingsTab
                v-if="activeTab === 'upload'"
                v-slot="{}"
                v-model:settings="settings"
              />

              <!-- Cloud Storage Settings -->
              <StorageSettingsTab v-slot="{}" v-if="activeTab === 'storage'" />

              <!-- SMTP Settings -->
              <SmtpSettingsTab
                v-if="activeTab === 'smtp'"
                v-slot="{}"
                v-model:settings="settings"
              />

              <!-- Social Settings -->
              <SocialSettingsTab v-if="activeTab === 'social'" v-model:settings="settings" />

              <!-- Email Template Settings -->
              <TemplateSettingsTab v-if="activeTab === 'template'" v-model:settings="settings" />

              <!-- AI Configuration Tab -->
              <AiSettingsTab
                v-if="activeTab === 'ai'"
                v-model:settings="settings"
                v-model:ai-model-configs="aiModelConfigs"
                v-model:pending-model-family-ids="pendingModelFamilyIds"
              />
            </main>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-command-center {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 16px 20px;
}

.settings-command-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-eyebrow {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.settings-command-copy h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 900;
  line-height: 1.2;
}

.settings-command-copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.settings-signal-grid {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  max-width: 48rem;
}

.settings-signal-card {
  --settings-tone: #2563eb;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--settings-tone) 22%, var(--border-base));
  border-radius: 6px;
  background: color-mix(in srgb, var(--settings-tone) 7%, var(--bg-card));
  padding: 6px 10px;
}

.settings-signal-card[data-tone='emerald'] {
  --settings-tone: #059669;
}

.settings-signal-card[data-tone='sky'] {
  --settings-tone: #0284c7;
}

.settings-signal-card[data-tone='amber'] {
  --settings-tone: #d97706;
}

.settings-signal-card[data-tone='rose'] {
  --settings-tone: #e11d48;
}

.settings-signal-card[data-tone='violet'] {
  --settings-tone: #7c3aed;
}

.settings-signal-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  color: var(--settings-tone);
}

.settings-signal-value {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.settings-signal-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
}

.settings-signal-detail {
  display: block;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-main-column .rounded-3xl,
.settings-main-column .rounded-2xl,
.settings-main-column .rounded-xl {
  border-radius: 8px !important;
}

.settings-main-column > div > section {
  padding: 18px !important;
}

.settings-main-column > div {
  gap: 12px !important;
}

.settings-main-column section .grid {
  gap: 12px !important;
}

.settings-main-column section > div:first-child.flex {
  margin-bottom: 12px !important;
}

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

@media (max-width: 1120px) {
  .settings-command-center {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .settings-signal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: none;
  }
}

@media (max-width: 720px) {
  .settings-command-copy p {
    display: none;
  }

  .settings-signal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .settings-command-center {
    padding: 6px 10px;
  }

  .settings-signal-grid {
    gap: 4px;
  }

  .settings-signal-card {
    padding: 4px 8px;
    gap: 6px;
  }

  .settings-signal-icon {
    width: 13px;
    height: 13px;
  }

  .settings-signal-value {
    font-size: 11px;
  }

  .settings-signal-label {
    font-size: 8px;
  }

  .settings-signal-detail {
    font-size: 8px;
  }
}
</style>

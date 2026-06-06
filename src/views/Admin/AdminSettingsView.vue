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
  Chrome,
  Github,
  Trash2,
  Cpu,
  Plus,
  Star,
  GripVertical,
  Sliders,
  Cloud,
  Database,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { useSystemStore } from '@/stores/system';
import SafeHtml from '@/components/SafeHtml.vue';
import { getApiErrorMessage } from '@/utils/error';

const systemStore = useSystemStore();
const isLoading = ref(false);
const isSaving = ref(false);
const isUploadingLogo = ref(false);
const isUploadingFavicon = ref(false);
const isTestingSmtp = ref(false);
const isCleaning = ref(false);

const handleLogoUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    return ElMessage.warning(t('admin.logo_image_size_cannot'));
  }

  try {
    isUploadingLogo.value = true;
    const formData = new FormData();
    formData.append('logo', file);
    const { data } = await api.post('/api/admin/settings/upload-logo', formData);
    settings.value.PLATFORM_LOGO_URL = data.url;
    ElMessage.success(t('admin.logo_uploaded_successfully_click'));
  } catch (error) {
    console.error('Logo upload error:', error);
    ElMessage.error(t('admin.logo_upload_failed'));
  } finally {
    isUploadingLogo.value = false;
    target.value = '';
  }
};

const handleFaviconUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 1 * 1024 * 1024) {
    return ElMessage.warning(t('admin.favicon_image_size_cannot'));
  }

  try {
    isUploadingFavicon.value = true;
    const formData = new FormData();
    formData.append('favicon', file);
    const { data } = await api.post('/api/admin/settings/upload-favicon', formData);
    settings.value.PLATFORM_FAVICON_URL = data.url;
    ElMessage.success(t('admin.favicon_uploaded_successfully_click'));
  } catch (error) {
    console.error('Favicon upload error:', error);
    ElMessage.error(t('admin.favicon_upload_failed'));
  } finally {
    isUploadingFavicon.value = false;
    target.value = '';
  }
};

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
};

type SettingValue = string | boolean;
type SettingsRecord = Record<string, SettingValue>;

interface ApiSetting {
  key: string;
  value: unknown;
}

interface MicrosoftEmailAccount {
  id: string;
  email: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ERROR' | string;
  statusMessage?: string | null;
  proxy?: string | null;
  dailyLimit?: number;
  sentCountToday?: number;
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
}

const settings = ref({ ...defaultSettings });
const originalSettings = ref({ ...defaultSettings });
const aiModelConfigs = ref<AiModelConfig[]>([]);

const aiProviderDefaults: Record<string, { endpoint: string; model: string; name: string }> = {
  DEEPSEEK: { endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat', name: 'DeepSeek Chat' },
  OPENAI: { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini', name: 'OpenAI GPT-4o mini' },
  OLLAMA: { endpoint: 'http://localhost:11434/api', model: 'llama3', name: 'Ollama Llama3' },
  QWEN: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', name: 'Qwen Plus' },
  GEMINI: { endpoint: 'https://generativelanguage.googleapis.com', model: 'gemini-1.5-flash', name: 'Gemini Flash' },
  AZURE: { endpoint: 'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2023-05-15', model: 'gpt-4o', name: 'Azure OpenAI' },
  CUSTOM: { endpoint: '', model: '', name: t('admin.custom_model') },
};

const createAiModelConfig = (provider = 'DEEPSEEK'): AiModelConfig => {
  const defaults = aiProviderDefaults[provider] || aiProviderDefaults.DEEPSEEK;
  return {
    id: `model_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: defaults.name,
    provider,
    modelName: defaults.model,
    endpoint: defaults.endpoint,
    apiKey: '',
    enabled: true,
    isDefault: aiModelConfigs.value.length === 0,
    description: '',
    capabilities: ['chat'],
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: '',
    showAdvanced: false,
  };
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
      const defaults = aiProviderDefaults[provider] || aiProviderDefaults.CUSTOM;
      const modelName = String(model.modelName || defaults.model || '').trim();
      if (!modelName && provider !== 'CUSTOM') return null;
      return {
        id: String(model.id || `model_${index + 1}`),
        name: String(model.name || defaults.name || `${provider} ${modelName}`),
        provider,
        modelName,
        endpoint: String(model.endpoint || defaults.endpoint || ''),
        apiKey: typeof model.apiKey === 'string' ? model.apiKey : '',
        enabled: model.enabled === true || model.enabled === 'true',
        isDefault: model.isDefault === true || model.isDefault === 'true',
        description: typeof model.description === 'string' ? model.description : '',
        capabilities: Array.isArray(model.capabilities) ? model.capabilities.map(String) : ['chat'],
        temperature: typeof model.temperature === 'number' ? model.temperature : 0.7,
        maxTokens: typeof model.maxTokens === 'number' ? model.maxTokens : 2000,
        systemPrompt: typeof model.systemPrompt === 'string' ? model.systemPrompt : '',
        showAdvanced: false,
      };
    })
    .filter((item): item is AiModelConfig => Boolean(item));
};

const syncAiModelsToSettings = () => {
  if (aiModelConfigs.value.length > 0 && !aiModelConfigs.value.some((model) => model.isDefault)) {
    aiModelConfigs.value[0].isDefault = true;
  }
  settings.value.AI_MODEL_OPTIONS = JSON.stringify(aiModelConfigs.value);

  const defaultModel =
    aiModelConfigs.value.find((model) => model.isDefault) || aiModelConfigs.value[0];
  if (defaultModel) {
    settings.value.AI_PROVIDER = defaultModel.provider;
    settings.value.AI_API_ENDPOINT = defaultModel.endpoint;
    settings.value.AI_MODEL_NAME = defaultModel.modelName;
    settings.value.AI_API_KEY = defaultModel.apiKey;
  }
};

const addAiModel = () => {
  aiModelConfigs.value.push(createAiModelConfig());
  syncAiModelsToSettings();
};

const removeAiModel = async (id: string) => {
  if (aiModelConfigs.value.length <= 1) {
    return ElMessage.warning(t('admin.keep_at_least_one'));
  }
  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you'), t('admin.delete_model'), {
      confirmButtonText: t('admin.delete'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
    });
    const removed = aiModelConfigs.value.find((model) => model.id === id);
    aiModelConfigs.value = aiModelConfigs.value.filter((model) => model.id !== id);
    if (removed?.isDefault && aiModelConfigs.value[0]) {
      aiModelConfigs.value[0].isDefault = true;
    }
    syncAiModelsToSettings();
  } catch {}
};

const setDefaultAiModel = (id: string) => {
  aiModelConfigs.value.forEach((model) => {
    model.isDefault = model.id === id;
    if (model.id === id) model.enabled = true;
  });
  syncAiModelsToSettings();
};

const handleAiProviderChange = (model: AiModelConfig) => {
  const defaults = aiProviderDefaults[model.provider] || aiProviderDefaults.CUSTOM;
  model.endpoint = defaults.endpoint;
  model.modelName = defaults.model;
  if (!model.name || Object.values(aiProviderDefaults).some((item) => item.name === model.name)) {
    model.name = defaults.name;
  }
  syncAiModelsToSettings();
};

const updateAiModelCapabilities = (model: AiModelConfig, event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  model.capabilities = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  syncAiModelsToSettings();
};

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

const smtpConfigs = ref<SmtpConfig[]>([]);
const activeConfigId = ref<string>('');

const selectSmtpConfig = (configId: string) => {
  const cfg = smtpConfigs.value.find((c) => c.id === configId);
  if (cfg) {
    activeConfigId.value = cfg.id;
    settings.value.SMTP_ACTIVE_CONFIG_ID = cfg.id;

    // Copy values to form fields
    settings.value.SMTP_HOST = cfg.host;
    settings.value.SMTP_PORT = cfg.port;
    settings.value.SMTP_USER = cfg.user;
    settings.value.SMTP_PASS = cfg.pass;
    settings.value.SMTP_FROM = cfg.from;
    settings.value.SMTP_SECURE = cfg.secure;
  }
};

const addNewSmtpConfig = async () => {
  try {
    const { value: name } = await ElMessageBox.prompt(t('admin.please_enter_a_new'), t('admin.added_email_configuration_plan'), {
      confirmButtonText: t('admin.ok'),
      cancelButtonText: t('admin.cancel'),
      inputPattern: /\S+/,
      inputErrorMessage: t('admin.scheme_name_cannot_be'),
    });

    const newId = 'cfg_' + Date.now();
    const newCfg: SmtpConfig = {
      id: newId,
      name,
      host: '',
      port: '465',
      user: '',
      pass: '',
      from: '',
      secure: 'true',
    };

    smtpConfigs.value.push(newCfg);
    settings.value.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);

    // Auto select the new configuration
    selectSmtpConfig(newId);
    ElMessage.success(t('admin.scheme_name_has_been', { name: name }));
  } catch (_error) {
    // User canceled
  }
};

const renameSmtpConfig = async () => {
  const activeCfg = smtpConfigs.value.find((c) => c.id === activeConfigId.value);
  if (!activeCfg) return;

  try {
    const { value: name } = await ElMessageBox.prompt(t('admin.please_enter_a_new'), t('admin.rename_configuration_scheme'), {
      confirmButtonText: t('admin.ok'),
      cancelButtonText: t('admin.cancel'),
      inputPattern: /\S+/,
      inputErrorMessage: t('admin.scheme_name_cannot_be'),
      inputValue: activeCfg.name,
    });

    activeCfg.name = name;
    settings.value.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);
    ElMessage.success(t('admin.scheme_renamed_successfully'));
  } catch (_error) {
    // User canceled
  }
};

const deleteSmtpConfig = async () => {
  if (smtpConfigs.value.length <= 1) {
    return ElMessage.warning(t('admin.at_least_one_configuration'));
  }

  const activeCfg = smtpConfigs.value.find((c) => c.id === activeConfigId.value);
  if (!activeCfg) return;

  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you_17', { activeCfgname: activeCfg.name }), t('admin.delete_configuration_plan'), {
      confirmButtonText: t('admin.confirm_deletion'),
      cancelButtonText: t('admin.cancel'),
      type: 'warning',
    });

    const index = smtpConfigs.value.findIndex((c) => c.id === activeConfigId.value);
    if (index !== -1) {
      smtpConfigs.value.splice(index, 1);
      settings.value.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);

      // Select the first configuration
      selectSmtpConfig(smtpConfigs.value[0].id);
      ElMessage.success(t('admin.plan_deleted'));
    }
  } catch {
    // User canceled
  }
};

watch(
  [
    () => settings.value.SMTP_HOST,
    () => settings.value.SMTP_PORT,
    () => settings.value.SMTP_USER,
    () => settings.value.SMTP_PASS,
    () => settings.value.SMTP_FROM,
    () => settings.value.SMTP_SECURE,
  ],
  () => {
    const activeCfg = smtpConfigs.value.find((cfg) => cfg.id === activeConfigId.value);
    if (activeCfg) {
      activeCfg.host = settings.value.SMTP_HOST || '';
      activeCfg.port = settings.value.SMTP_PORT || '465';
      activeCfg.user = settings.value.SMTP_USER || '';
      activeCfg.pass = settings.value.SMTP_PASS || '';
      activeCfg.from = settings.value.SMTP_FROM || '';
      activeCfg.secure = settings.value.SMTP_SECURE || 'true';

      settings.value.SMTP_CONFIGS = JSON.stringify(smtpConfigs.value);
    }
  },
);

const tabs = [
  { id: 'general', label: t('admin.basic_operations'), icon: Globe },
  { id: 'branding', label: t('admin.platform_brand'), icon: Palette },
  { id: 'security', label: t('admin.security_policy'), icon: Shield },
  { id: 'upload', label: t('admin.upload_limit'), icon: Upload },
  { id: 'smtp', label: t('admin.mail_service'), icon: Mail },
  { id: 'social', label: t('admin.social_login'), icon: Sparkles },
  { id: 'template', label: t('admin.email_template'), icon: Layout },
  { id: 'ai', label: t('admin.ai_intelligent_assistance'), icon: Cpu },
];

const sessionTimeoutOptions = [
  { label: t('admin.1_day'), value: '1d' },
  { label: t('admin.3_days'), value: '3d' },
  { label: t('admin.7_days'), value: '7d' },
  { label: t('admin.30_days'), value: '30d' },
];

const defaultRoleOptions = [
  { label: t('admin.ordinary_user'), value: 'USER' },
  { label: t('admin.lecturer'), value: 'INSTRUCTOR' },
];

watch(
  settings,
  () => {
    hasUnsavedChanges.value =
      JSON.stringify(settings.value) !== JSON.stringify(originalSettings.value);
  },
  { deep: true },
);

watch(
  aiModelConfigs,
  () => {
    syncAiModelsToSettings();
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
      data.forEach((s: ApiSetting) => {
        if (
          s.key === 'ALLOW_REGISTRATION' ||
          s.key === 'MAINTENANCE_MODE' ||
          s.key === 'AUTO_APPROVE_MATERIALS' ||
          s.key === 'AUTO_APPROVE_SHOWCASES' ||
          s.key === 'MICROSOFT_POOL_FAILBACK' ||
          s.key.endsWith('_ENABLED')
        ) {
          setSettingValue(s.key, s.value === 'true');
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
          setSettingValue(s.key, typeof s.value === 'string' ? s.value : JSON.stringify(s.value || []));
        } else if (Object.keys(settings.value).includes(s.key)) {
          setSettingValue(s.key, typeof s.value === 'boolean' ? s.value : String(s.value ?? ''));
        }
      });
    } else {
      // Object format
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'MICROSOFT_POOL_FAILBACK') {
          setSettingValue(key, value === true || value === 'true');
        } else if (typeof value === 'boolean') {
          setSettingValue(key, value);
        } else if (Array.isArray(value)) {
          setSettingValue(key, key === 'AI_MODEL_OPTIONS' ? JSON.stringify(value) : value.join(', '));
        } else if (Object.keys(settings.value).includes(key)) {
          if (key !== 'SMTP_CONFIGS' && key !== 'AI_MODEL_OPTIONS' && typeof value === 'string' && value.trim().startsWith('[')) {
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
    syncAiModelsToSettings();

    // Parse SMTP_CONFIGS
    try {
      smtpConfigs.value = JSON.parse(settings.value.SMTP_CONFIGS || '[]');
    } catch {
      smtpConfigs.value = [];
    }

    // Downward compatibility: if empty, pack current SMTP settings into a default scheme
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

    // Set active config
    const activeId = settings.value.SMTP_ACTIVE_CONFIG_ID || 'default';
    const activeCfg = smtpConfigs.value.find((c) => c.id === activeId) || smtpConfigs.value[0];
    activeConfigId.value = activeCfg.id;
    settings.value.SMTP_ACTIVE_CONFIG_ID = activeCfg.id;

    // Copy active configuration to form fields to display
    settings.value.SMTP_HOST = activeCfg.host;
    settings.value.SMTP_PORT = activeCfg.port;
    settings.value.SMTP_USER = activeCfg.user;
    settings.value.SMTP_PASS = activeCfg.pass;
    settings.value.SMTP_FROM = activeCfg.from;
    settings.value.SMTP_SECURE = activeCfg.secure;

    originalSettings.value = JSON.parse(JSON.stringify(settings.value));
    hasUnsavedChanges.value = false;
  } catch (error) {
    console.error('Fetch settings error:', error);
    ElMessage.error(t('admin.failed_to_get_settings'));
  } finally {
    isLoading.value = false;
  }
};

const saveSettings = async () => {
  if (!settings.value.PLATFORM_NAME?.trim()) {
    return ElMessage.warning(t('admin.platform_name_cannot_be'));
  }

  try {
    isSaving.value = true;
    syncAiModelsToSettings();
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

const handleToggleMaintenance = async (val: string | number | boolean) => {
  if (val === true || val === 'true') {
    try {
      await ElMessageBox.confirm(
        t('admin.after_maintenance_mode_is'),
        t('admin.confirm_to_enable_maintenance'),
        {
          confirmButtonText: t('admin.confirm_to_open'),
          cancelButtonText: t('admin.cancel'),
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
      t('admin.this_action_returns_all'),
      t('admin.reset_to_default'),
      {
        confirmButtonText: t('admin.confirm_reset_1'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
      },
    );
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
    activeConfigId.value = 'default';
    aiModelConfigs.value = [createAiModelConfig()];
    syncAiModelsToSettings();
    ElMessage.info(t('admin.default_values_have_been'));
  } catch {}
};

const testSmtp = async () => {
  try {
    const { value: testRecipient } = await ElMessageBox.prompt(
      t('admin.please_enter_the_email'),
      t('admin.test_smtp_connection'),
      {
        confirmButtonText: t('admin.start_testing'),
        cancelButtonText: t('admin.cancel'),
        inputPattern:
          /[\w!#$%&'*+/=?^_`{|}~-]+(?:\.[\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\w](?:[\w-]*[\w])?\.)+[\w](?:[\w-]*[\w])?/,
        inputErrorMessage: t('admin.email_format_is_incorrect'),
        inputValue: settings.value.SMTP_FROM || settings.value.SMTP_USER || '',
      },
    );

    isTestingSmtp.value = true;
    const { data } = await api.post('/api/admin/settings/test-smtp', {
      host: settings.value.SMTP_HOST,
      port: settings.value.SMTP_PORT,
      user: settings.value.SMTP_USER,
      pass: settings.value.SMTP_PASS,
      from: settings.value.SMTP_FROM,
      secure: settings.value.SMTP_SECURE === 'true',
      to: testRecipient,
    });
    ElMessage.success(data.message);
  } catch (error: unknown) {
    if (error === 'cancel') return;
    console.error('Test SMTP error:', error);
    ElMessage.error(getApiErrorMessage(error, t('admin.smtp_test_failed')));
  } finally {
    isTestingSmtp.value = false;
  }
};

const isTestingAi = ref(false);
const testingAiModelId = ref('');
const expandedModelId = ref<string | null>(null);

const toggleModelExpand = (id: string) => {
  expandedModelId.value = expandedModelId.value === id ? null : id;
};

const dragIndex = ref<number | null>(null);
const isDraggable = ref(false);

const handleDragStart = (event: DragEvent, index: number) => {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
};

const handleDrop = (_event: DragEvent, toIndex: number) => {
  if (dragIndex.value !== null && dragIndex.value !== toIndex) {
    const list = [...aiModelConfigs.value];
    const draggedItem = list.splice(dragIndex.value, 1)[0];
    list.splice(toIndex, 0, draggedItem);
    aiModelConfigs.value = list;
    syncAiModelsToSettings();
    ElMessage.success(t('admin.updated_model_prioritization'));
  }
};

const handleDragEnd = () => {
  dragIndex.value = null;
  isDraggable.value = false;
};

const providerMeta: Record<string, { color: string; bg: string; border: string; label: string; lucideIcon: any }> = {
  DEEPSEEK: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.25)', label: 'DeepSeek', lucideIcon: Cpu },
  OPENAI: { color: '#10a37f', bg: 'rgba(16,163,127,0.08)', border: 'rgba(16,163,127,0.25)', label: 'OpenAI', lucideIcon: Sparkles },
  OLLAMA: { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)', label: 'Ollama', lucideIcon: Database },
  QWEN: { color: '#ea580c', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.25)', label: 'Qwen', lucideIcon: Globe },
  GEMINI: { color: '#db2777', bg: 'rgba(219,39,119,0.08)', border: 'rgba(219,39,119,0.25)', label: 'Gemini', lucideIcon: Sparkles },
  AZURE: { color: '#0284c7', bg: 'rgba(2,132,199,0.08)', border: 'rgba(2,132,199,0.25)', label: 'Azure', lucideIcon: Cloud },
  CUSTOM: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)', label: 'Custom', lucideIcon: Settings },
};

const getProviderMeta = (provider: string) => providerMeta[provider] || providerMeta.CUSTOM;
const testAi = async (model?: AiModelConfig) => {
  const provider = model?.provider || settings.value.AI_PROVIDER;
  const apiKey = model?.apiKey || settings.value.AI_API_KEY;
  const endpoint = model?.endpoint || settings.value.AI_API_ENDPOINT;
  const modelName = model?.modelName || settings.value.AI_MODEL_NAME;

  if (!provider) {
    return ElMessage.warning(t('admin.please_select_an_ai'));
  }
  if (!apiKey && provider !== 'OLLAMA') {
    return ElMessage.warning(t('admin.please_enter_api_key'));
  }
  if (!modelName) {
    return ElMessage.warning(t('admin.please_enter_model_name'));
  }

  try {
    isTestingAi.value = true;
    testingAiModelId.value = model?.id || '__legacy__';
    const { data } = await api.post('/api/admin/settings/test-ai', {
      provider,
      endpoint,
      apiKey,
      modelName,
      capabilities: model?.capabilities,
    });
    if (data.success) {
      ElMessage.success(data.message || t('admin.ai_interface_test_successful'));
    } else {
      ElMessage.error(t('admin.the_test_failed_and'));
    }
  } catch (error: any) {
    console.error('Test AI error:', error);
    ElMessage.error(getApiErrorMessage(error, t('admin.ai_connection_test_failed')));
  } finally {
    isTestingAi.value = false;
    testingAiModelId.value = '';
  }
};

watch(
  () => settings.value.AI_PROVIDER,
  (newProvider) => {
    if (aiModelConfigs.value.length > 0) return;
    const defaultsMap: Record<string, { endpoint: string; model: string }> = {
      DEEPSEEK: { endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
      OPENAI: { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      OLLAMA: { endpoint: 'http://localhost:11434/api', model: 'llama3' },
      QWEN: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
      GEMINI: { endpoint: 'https://generativelanguage.googleapis.com', model: 'gemini-1.5-flash' },
      AZURE: { endpoint: 'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2023-05-15', model: 'gpt-4o' },
      CUSTOM: { endpoint: '', model: '' },
    };

    if (newProvider && defaultsMap[newProvider as string]) {
      const newDefaults = defaultsMap[newProvider as string]!;
      const currentEndpoint = settings.value.AI_API_ENDPOINT;
      const currentModel = settings.value.AI_MODEL_NAME;

      const isEndpointDefaultOrEmpty = !currentEndpoint || Object.values(defaultsMap).some(d => d.endpoint === currentEndpoint);
      const isModelDefaultOrEmpty = !currentModel || Object.values(defaultsMap).some(d => d.model === currentModel);

      if (isEndpointDefaultOrEmpty) {
        settings.value.AI_API_ENDPOINT = newDefaults.endpoint;
      }
      if (isModelDefaultOrEmpty) {
        settings.value.AI_MODEL_NAME = newDefaults.model;
      }
    }
  }
);

const handleCleanupStorage = async () => {
  try {
    await ElMessageBox.confirm(
      t('admin.this_operation_will_scan'),
      t('admin.confirm_to_clear_storage'),
      {
        confirmButtonText: t('admin.clean_up_now'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );

    isCleaning.value = true;
    const { data } = await api.post('/api/admin/settings/cleanup-storage');
    const stats = data.stats || { scanned: 0, deleted: 0, errors: 0 };

    await ElMessageBox.alert(
      `<div class="space-y-2">
        <p class="text-sm font-bold text-emerald-600">{{ $t('admin.storage_space_cleared_successfully') }}</p>
        <div class="text-xs space-y-1 bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/10 font-mono">
          <p>{{ $t('admin.number_of_scanned_files') }} <span class="font-bold text-slate-800 dark:text-slate-200">${stats.scanned}</span></p>
          <p>{{ $t('admin.number_of_files_to') }} <span class="font-bold text-emerald-600">${stats.deleted}</span></p>
          <p>{{ $t('admin.failed_or_skipped') }} <span class="font-bold text-rose-500">${stats.errors}</span></p>
        </div>
        <p class="text-[10px] text-slate-400">{{ $t('admin.local_disk_space_has') }}</p>
      </div>`,
      t('admin.clean_results'),
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: t('admin.ok'),
        type: 'success',
      },
    );
  } catch (error: unknown) {
    if (error !== 'cancel') {
      console.error('Cleanup storage error:', error);
      ElMessage.error(getApiErrorMessage(error, t('admin.failed_to_clear_storage')));
    }
  } finally {
    isCleaning.value = false;
  }
};

const microsoftAccounts = ref<MicrosoftEmailAccount[]>([]);
const isLoadingAccounts = ref(false);

const fetchMicrosoftAccounts = async () => {
  try {
    isLoadingAccounts.value = true;
    const { data } = await api.get('/api/email/accounts');
    microsoftAccounts.value = data;
  } catch (error) {
    console.error('Failed to fetch Microsoft email accounts:', error);
  } finally {
    isLoadingAccounts.value = false;
  }
};

const microsoftPoolStats = computed(() => {
  const accounts = microsoftAccounts.value || [];
  const total = accounts.length;
  const active = accounts.filter((a) => a.status === 'ACTIVE').length;
  const expired = accounts.filter((a) => a.status === 'EXPIRED').length;
  const error = accounts.filter((a) => a.status === 'ERROR').length;

  const totalSentToday = accounts.reduce((acc, curr) => acc + (curr.sentCountToday || 0), 0);
  const totalDailyLimit = accounts.reduce((acc, curr) => acc + (curr.dailyLimit || 50), 0);

  const activeWithProxy = accounts.filter((a) => a.status === 'ACTIVE' && a.proxy).length;

  return {
    total,
    active,
    expired,
    error,
    totalSentToday,
    totalDailyLimit,
    activeWithProxy,
  };
});

onMounted(async () => {
  await fetchSettings();
  await fetchMicrosoftAccounts();
});

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
    <!-- 奢华顶栏 (超紧凑高阶版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-slate-500/10 via-zinc-500/5 to-transparent pointer-events-none"
      ></div>

      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-slate-500/10 text-slate-500 shadow-sm border border-slate-500/20"
          >
            <Settings class="w-4 h-4" />
          </span>
          <div>
            <h1 class="text-sm font-black tracking-tight" style="color: var(--text-primary)">
              全局系统设置
            </h1>
            <p
              class="text-[10px] font-medium mt-0.5 hidden sm:block"
              style="color: var(--text-muted)"
            >
              配置平台核心参数、自动化邮件及安全开关
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div
            v-if="hasUnsavedChanges"
            class="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0"
            :title="$t('admin.there_are_unsaved_changes')"
          >
            <AlertTriangle class="w-3 h-3 text-amber-500" />
            <span class="text-[10px] font-bold whitespace-nowrap hidden md:inline"
              >{{ $t('admin.there_are_unsaved_changes') }}</span
            >
          </div>
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
            <span class="hidden sm:inline">{{ isSaving ? $t('admin.saving_1') : $t('admin.save_global_settings') }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <div
        class="w-full lg:w-56 border-b lg:border-b-0 lg:border-r shrink-0 overflow-y-auto p-4 transition-colors duration-300"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="px-3 mb-4 hidden lg:block">
          <h2 class="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{{ $t('admin.set_categories') }}</h2>
        </div>
        <nav
          class="flex flex-row flex-nowrap lg:flex-col gap-0.5 lg:gap-1 pb-2 lg:pb-0 overflow-hidden"
        >
          <button
v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="flex-1 lg:flex-none w-auto lg:w-full flex items-center justify-center lg:justify-start gap-0.5 lg:gap-3 px-1 py-1 sm:px-2 lg:px-4 lg:py-3 rounded-lg lg:rounded-xl text-[8px] xs:text-[9px] lg:text-sm font-bold transition-all shrink-0 whitespace-nowrap"
            :class="
              activeTab === tab.id
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
            "
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" class="w-3 h-3 lg:w-4 lg:h-4 shrink-0" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
        <div class="max-w-6xl mx-auto space-y-8 pb-12">
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
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ $t('admin.basic_operational_configuration') }}</h2>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >{{ $t('admin.platform_display_name') }}</label
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
                    >{{ $t('admin.platform_subtitle') }}</label
                  >
                  <input
                    v-model="settings.PLATFORM_SUBTITLE"
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
                    >{{ $t('admin.new_user_default_role') }}</label
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
                          >{{ $t('admin.allow_new_users_to') }}</span
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
                          >{{ $t('admin.maintenance_mode') }}</span
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
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ $t('admin.platform_brand_configuration') }}</h2>
              </div>

              <div class="space-y-6">
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >{{ $t('admin.platform_logo') }}</label
                  >
                  <div class="flex items-center gap-4">
                    <div
                      class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative"
                      style="border-color: var(--border-base); background-color: var(--bg-app)"
                    >
                      <img
v-if="settings.PLATFORM_LOGO_URL"
                        alt=""
                        :src="getAssetUrl(settings.PLATFORM_LOGO_URL)"
                        class="w-full h-full object-contain p-1"
                      />
                      <Image v-else class="w-6 h-6 text-slate-300" />

                      <label
                        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                      >
                        <Upload v-if="!isUploadingLogo" class="w-5 h-5 text-white" />
                        <RefreshCw v-else class="w-5 h-5 text-white animate-spin" />
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="handleLogoUpload"
                        />
                      </label>
                    </div>
                    <div class="flex-1 space-y-2">
                      <input
                        v-model="settings.PLATFORM_LOGO_URL"
                        type="text"
                        :placeholder="$t('admin.or_enter_the_logo')"
                        class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                      />
                      <p class="text-[10px] px-1" style="color: var(--text-muted)">
                        推荐尺寸 128x128px，支持 PNG/SVG/JPG，文件小于 2MB
                      </p>
                    </div>
                  </div>
                </div>

                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >{{ $t('admin.browser_favicon') }}</label
                  >
                  <div class="flex items-center gap-4">
                    <div
                      class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative"
                      style="border-color: var(--border-base); background-color: var(--bg-app)"
                    >
                      <img
v-if="settings.PLATFORM_FAVICON_URL || settings.PLATFORM_LOGO_URL"
                        alt=""
                        :src="
                          getAssetUrl(settings.PLATFORM_FAVICON_URL || settings.PLATFORM_LOGO_URL)
                        "
                        class="w-8 h-8 object-contain"
                      />
                      <Sparkles v-else class="w-6 h-6 text-slate-300" />

                      <label
                        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                      >
                        <Upload v-if="!isUploadingFavicon" class="w-5 h-5 text-white" />
                        <RefreshCw v-else class="w-5 h-5 text-white animate-spin" />
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="handleFaviconUpload"
                        />
                      </label>
                    </div>
                    <div class="flex-1 space-y-2">
                      <input
                        v-model="settings.PLATFORM_FAVICON_URL"
                        type="text"
                        :placeholder="$t('admin.if_left_blank_the')"
                        class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                      />
                      <p class="text-[10px] px-1" style="color: var(--text-muted)">
                        推荐尺寸 32x32px 或 64x64px，支持 .ico/PNG/SVG
                      </p>
                    </div>
                  </div>
                </div>

                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >{{ $t('admin.platform_description') }}</label
                  >
                  <textarea
                    v-model="settings.PLATFORM_DESCRIPTION"
                    rows="3"
                    :placeholder="$t('admin.introduce_your_platform_in')"
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
                    >{{ $t('admin.browser_window_title') }}</label
                  >
                  <input
                    v-model="settings.BROWSER_TITLE"
                    type="text"
                    :placeholder="$t('admin.for_example_3d_community')"
                    class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    style="
                      background-color: var(--bg-app);
                      border-color: var(--border-base);
                      color: var(--text-primary);
                    "
                  />
                  <p class="text-[10px] px-1" style="color: var(--text-muted)">
                    显示在浏览器标签页上的文字，不填则默认与平台名称一致
                  </p>
                </div>

                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >{{ $t('admin.footer_text') }}</label
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
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ $t('admin.security_policy_configuration') }}</h2>
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
                          >{{ $t('admin.automatically_review_approved_materials') }}</span
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
                          >{{ $t('admin.automatically_review_and_pass') }}</span
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
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ $t('admin.upload_and_storage_limits') }}</h2>
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

            <section
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-8">
                <Trash2 class="w-5 h-5 text-rose-500" />
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ $t('admin.storage_space_cleanup') }}</h2>
              </div>

              <div class="space-y-6">
                <div
                  class="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-amber-600 dark:text-amber-400 space-y-2"
                >
                  <div class="flex items-start gap-2.5">
                    <AlertTriangle class="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                    <div>
                      <p class="text-xs font-bold">{{ $t('admin.important_tips_and_cleaning') }}</p>
                      <p class="text-[10px] mt-1 leading-relaxed opacity-90">
                        该操作将扫描服务器上的本地上传目录（如
                        branding、discussions、feedback、messages、users
                        等文件夹），比对数据库中的所有关联字段。任何在数据库中已无记录对应的残留本地物理文件（孤儿文件）都将被永久物理删除，以便释放磁盘存储空间。该操作不可逆，请谨慎执行。
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent"
                >
                  <div>
                    <span class="text-xs font-bold" style="color: var(--text-primary)"
                      >{{ $t('admin.clean_up_orphan_files') }}</span
                    >
                    <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                      安全清理无用的冗余文件资源，自动保留有效的品牌、课程与讨论资源
                    </p>
                  </div>
                  <button
type="button"
                    :disabled="isCleaning"
                    class="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-600/50 text-white rounded-xl font-bold text-xs transition-all shadow-sm shrink-0 cursor-pointer"
                    @click="handleCleanupStorage"
                  >
                    <Trash2 v-if="!isCleaning" class="w-3.5 h-3.5" />
                    <RefreshCw v-else class="w-3.5 h-3.5 animate-spin" />
                    <span>{{ isCleaning ? $t('admin.cleaning_up') : $t('admin.clean_up_now') }}</span>
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div
            v-if="activeTab === 'smtp'"
            class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <!-- Unsaved changes warning banner for email provider -->
            <div
              v-if="settings.SYSTEM_EMAIL_PROVIDER !== originalSettings.SYSTEM_EMAIL_PROVIDER"
              class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-2.5 text-xs font-bold animate-pulse shadow-sm"
            >
              <AlertTriangle class="w-4 h-4 text-amber-500 shrink-0" />
              <span>{{ $t('admin.you_have_switched_the', { mode: settings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL' ? $t('admin.microsoft_account_pool') : $t('admin.standard_smtp') }) }}</span>
            </div>

            <!-- Mode selection -->
            <!-- Mode selection -->
            <section
              class="p-4 sm:p-5 rounded-2xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-2 mb-4">
                <Settings class="w-4 h-4 text-indigo-500" />
                <h2 class="text-sm font-bold" style="color: var(--text-primary)">
                  系统发信模式选择
                </h2>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Option 1: SMTP -->
                <div
                  class="p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-4"
                  :style="
                    settings.SYSTEM_EMAIL_PROVIDER === 'SMTP'
                      ? { borderColor: 'var(--accent)', backgroundColor: 'rgba(99,102,241,0.04)' }
                      : { borderColor: 'var(--border-base)', backgroundColor: 'transparent' }
                  "
                  @click="settings.SYSTEM_EMAIL_PROVIDER = 'SMTP'"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0"
                    >
                      <Mail class="w-4 h-4" />
                    </div>
                    <div>
                      <h3 class="text-xs font-bold" style="color: var(--text-primary)">
                        标准 SMTP 发信
                      </h3>
                      <p class="text-[10px] mt-0.5 leading-normal" style="color: var(--text-muted)">
                        通过独立 SMTP 服务器进行发信，支持 SSL/TLS 握手
                      </p>
                    </div>
                  </div>
                  <div class="shrink-0 flex items-center">
                    <div
                      class="w-4 h-4 rounded-full border flex items-center justify-center transition-all"
                      :style="
                        settings.SYSTEM_EMAIL_PROVIDER === 'SMTP'
                          ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent)' }
                          : { borderColor: 'var(--border-base)' }
                      "
                    >
                      <div
                        v-if="settings.SYSTEM_EMAIL_PROVIDER === 'SMTP'"
                        class="w-1.5 h-1.5 rounded-full bg-white"
                      ></div>
                    </div>
                  </div>
                </div>

                <!-- Option 2: Microsoft Account Pool -->
                <div
                  class="p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-4"
                  :style="
                    settings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'
                      ? { borderColor: 'var(--accent)', backgroundColor: 'rgba(99,102,241,0.04)' }
                      : { borderColor: 'var(--border-base)', backgroundColor: 'transparent' }
                  "
                  @click="settings.SYSTEM_EMAIL_PROVIDER = 'MICROSOFT_POOL'"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0"
                    >
                      <Sparkles class="w-4 h-4" />
                    </div>
                    <div>
                      <h3 class="text-xs font-bold" style="color: var(--text-primary)">
                        微软 Graph 账号池 (防封版)
                      </h3>
                      <p class="text-[10px] mt-0.5 leading-normal" style="color: var(--text-muted)">
                        支持 Outlook/Hotmail 轮询发信，抗封锁且支持代理
                      </p>
                    </div>
                  </div>
                  <div class="shrink-0 flex items-center">
                    <div
                      class="w-4 h-4 rounded-full border flex items-center justify-center transition-all"
                      :style="
                        settings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'
                          ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent)' }
                          : { borderColor: 'var(--border-base)' }
                      "
                    >
                      <div
                        v-if="settings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'"
                        class="w-1.5 h-1.5 rounded-full bg-white"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Microsoft Account Pool Settings -->
            <section
              v-if="settings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'"
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300 space-y-6 animate-in"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Sparkles class="w-5 h-5 text-indigo-500" />
                  <h2 class="text-lg font-bold" style="color: var(--text-primary)">
                    微软邮箱账号池统计与配置
                  </h2>
                </div>
                <router-link
                  to="/tools/email"
                  class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors"
                >
                  去账号池管理中心
                </router-link>
              </div>

              <!-- Pool Stats Grid -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                  class="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
                >
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
                    >{{ $t('admin.total_account_in_the') }}</span
                  >
                  <span class="text-xl font-bold mt-2" style="color: var(--text-primary)"
                    >{{ $t('admin.microsoftpoolstats_total', { count: microsoftPoolStats.total }) }}</span
                  >
                </div>
                <div
                  class="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col justify-between"
                >
                  <span
                    class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
                    >{{ $t('admin.running_healthily') }}</span
                  >
                  <span class="text-xl font-bold mt-2 text-emerald-600 dark:text-emerald-400"
                    >{{ $t('admin.microsoftpoolstats_active', { count: microsoftPoolStats.active }) }}</span
                  >
                </div>
                <div
                  class="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col justify-between"
                >
                  <span
                    class="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
                    >{{ $t('admin.today_s_delivery_ratio') }}</span
                  >
                  <span class="text-xl font-bold mt-2 text-amber-600 dark:text-amber-400">
                    {{ microsoftPoolStats.totalSentToday }} /
                    {{ microsoftPoolStats.totalDailyLimit }} 封
                  </span>
                </div>
                <div
                  class="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col justify-between"
                >
                  <span
                    class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold"
                    >{{ $t('admin.proxy_server_protection') }}</span
                  >
                  <span class="text-xl font-bold mt-2 text-indigo-600 dark:text-indigo-400"
                    >{{ $t('admin.microsoftpoolstats_activewithproxy', { count: microsoftPoolStats.activeWithProxy }) }}</span
                  >
                </div>
              </div>

              <!-- Anti-Ban Configurations -->
              <div class="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <Shield class="w-4 h-4 text-indigo-600" />
                    <div>
                      <span class="text-xs font-bold" style="color: var(--text-primary)"
                        >{{ $t('admin.automatic_downgrade_and_disaster') }}</span
                      >
                      <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                        当账号池为空、所有账号均达到每日限量，或发信异常时，系统自动切换为传统的
                        SMTP 通道发送以防漏信
                      </p>
                    </div>
                  </div>
                  <el-switch v-model="settings.MICROSOFT_POOL_FAILBACK" active-color="#6366f1" />
                </div>
              </div>

              <!-- Active Accounts List -->
              <div class="space-y-3">
                <h3 class="text-xs font-bold" style="color: var(--text-secondary)">
                  发信账户池负载列表
                </h3>
                <div
                  v-if="microsoftAccounts.length === 0"
                  class="text-center py-6 text-xs text-slate-400 border border-dashed rounded-2xl"
                >
                  暂无微软邮箱账号，请点击右上角去“账号池管理中心”导入账号
                </div>
                <div
                  v-else
                  class="max-h-60 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800"
                >
                  <div
                    v-for="account in microsoftAccounts"
                    :key="account.id"
                    class="p-3.5 flex items-center justify-between text-xs"
                  >
                    <div class="flex items-center gap-2.5">
                      <span class="font-medium" style="color: var(--text-primary)">{{
                        account.email
                      }}</span>
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-bold"
                        :class="{
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':
                            account.status === 'ACTIVE',
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400':
                            account.status === 'EXPIRED',
                          'bg-rose-500/10 text-rose-600 dark:text-rose-400':
                            account.status === 'ERROR',
                        }"
                      >
                        {{
                          account.status === 'ACTIVE'
                            ? t('admin.normal') : account.status === 'EXPIRED'
                              ? t('admin.token_expires') : $t('admin.abnormal')
                        }}
                      </span>
                    </div>
                    <div class="flex items-center gap-4 text-slate-400 text-[10px]">
                      <span v-if="account.proxy"
                        >{{ $t('admin.proxy_account_proxy_split', { host: account.proxy.split('@').pop() }) }}</span
                      >
                      <span
                        >今日发信:
                        <strong style="color: var(--text-secondary)">{{
                          account.sentCountToday
                        }}</strong>
                        / {{ account.dailyLimit }} 封</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- SMTP Settings -->
            <section
              v-if="settings.SYSTEM_EMAIL_PROVIDER === 'SMTP' || settings.MICROSOFT_POOL_FAILBACK"
              class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300 animate-in"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 dark:border-white/5 pb-4"
              >
                <div class="flex flex-wrap items-center gap-3">
                  <div class="flex items-center gap-2">
                    <Mail class="w-5 h-5 text-accent" />
                    <h2
                      class="text-sm sm:text-base font-bold whitespace-nowrap"
                      style="color: var(--text-primary)"
                    >
                      SMTP 配置
                      <span
                        v-if="settings.SYSTEM_EMAIL_PROVIDER === 'MICROSOFT_POOL'"
                        class="text-[10px] font-normal text-amber-500 ml-1"
                        >{{ $t('admin.standby') }}</span
                      >
                    </h2>
                  </div>

                  <!-- 分割线 -->
                  <span class="text-slate-300 dark:text-white/10">|</span>

                  <!-- 一行展示：配置方案与管理按钮 -->
                  <div class="flex items-center gap-2 text-xs">
                    <span class="font-bold text-slate-400 whitespace-nowrap">{{ $t('admin.solution') }}</span>
                    <el-select
                      v-model="activeConfigId"
                      :placeholder="$t('admin.options')"
                      size="small"
                      style="width: 110px"
                      class="shrink-0 cursor-pointer"
                      @change="selectSmtpConfig"
                    >
                      <el-option
                        v-for="cfg in smtpConfigs"
                        :key="cfg.id"
                        :label="cfg.name"
                        :value="cfg.id"
                      />
                    </el-select>

                    <button
                      type="button"
                      class="text-accent hover:underline font-medium px-1 whitespace-nowrap cursor-pointer"
                      @click="addNewSmtpConfig"
                    >
                      新增
                    </button>
                    <button
                      type="button"
                      class="text-amber-500 hover:underline font-medium px-1 whitespace-nowrap cursor-pointer"
                      @click="renameSmtpConfig"
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      :disabled="smtpConfigs.length <= 1"
                      class="text-rose-500 hover:underline font-medium px-1 whitespace-nowrap disabled:opacity-30 disabled:no-underline cursor-pointer"
                      @click="deleteSmtpConfig"
                    >
                      删除
                    </button>
                  </div>
                </div>

                <button
type="button"
                  :disabled="isTestingSmtp"
                  class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                  @click="testSmtp"
                >
                  {{ isTestingSmtp ? t('admin.trying_to_shake_hands') : $t('admin.test_connection') }}
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >{{ $t('admin.server_address') }}</label
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
                    >{{ $t('admin.port') }}</label
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
                    >{{ $t('admin.account_user') }}</label
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
                    >{{ $t('admin.authorization_code_pass') }}</label
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
type="button"
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
                    >{{ $t('admin.sender_name') }}</label
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
                    >{{ $t('admin.sender_email_from') }}</label
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
                    >{{ $t('admin.enable_ssl_tls_connections') }}</span
                  >
                  <span class="text-[10px] ml-2" style="color: var(--text-muted)"
                    >{{ $t('admin.port_465_usually_needs') }}</span
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
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">
                  Google OAuth 配置
                </h2>
              </div>

              <div class="space-y-6">
                <div
                  class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
                >
                  <div class="flex items-center gap-3">
                    <Chrome class="w-4 h-4 text-accent" />
                    <div>
                      <span class="text-xs font-bold" style="color: var(--text-primary)"
                        >{{ $t('admin.turn_on_google_sign') }}</span
                      >
                      <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                        允许用户使用 Google 账号直接登录平台
                      </p>
                    </div>
                  </div>
                  <el-switch v-model="settings.OAUTH_GOOGLE_ENABLED" active-color="#4f46e5" />
                </div>

                <div
                  v-if="settings.OAUTH_GOOGLE_ENABLED"
                  class="grid grid-cols-1 gap-6 animate-in fade-in duration-300"
                >
                  <div class="space-y-2">
                    <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                      >Client ID</label
                    >
                    <input
                      v-model="settings.OAUTH_GOOGLE_CLIENT_ID"
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
                      >Client Secret</label
                    >
                    <div class="relative">
                      <input
                        v-model="settings.OAUTH_GOOGLE_CLIENT_SECRET"
                        :type="showPassword ? 'text' : 'password'"
                        class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                      />
                      <button
type="button"
                        class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                        @click="showPassword = !showPassword"
                      >
                        <Eye v-if="!showPassword" class="w-4 h-4" />
                        <EyeOff v-else class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div class="p-4 rounded-xl bg-slate-100 dark:bg-white/5 space-y-2">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Google 回调地址 (Authorized Redirect URI)
                    </p>
                    <code class="text-xs break-all text-accent font-mono"
                      >{{ api.defaults.baseURL }}/api/auth/google/callback</code
                    >
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
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">
                  GitHub OAuth 配置
                </h2>
              </div>

              <div class="space-y-6">
                <div
                  class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
                >
                  <div class="flex items-center gap-3">
                    <Github class="w-4 h-4 text-slate-800 dark:text-white" />
                    <div>
                      <span class="text-xs font-bold" style="color: var(--text-primary)"
                        >{{ $t('admin.enable_github_login') }}</span
                      >
                      <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                        允许用户使用 GitHub 账号直接登录平台
                      </p>
                    </div>
                  </div>
                  <el-switch v-model="settings.OAUTH_GITHUB_ENABLED" active-color="#000" />
                </div>

                <div
                  v-if="settings.OAUTH_GITHUB_ENABLED"
                  class="grid grid-cols-1 gap-6 animate-in fade-in duration-300"
                >
                  <div class="space-y-2">
                    <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                      >Client ID</label
                    >
                    <input
                      v-model="settings.OAUTH_GITHUB_CLIENT_ID"
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
                      >Client Secret</label
                    >
                    <div class="relative">
                      <input
                        v-model="settings.OAUTH_GITHUB_CLIENT_SECRET"
                        :type="showPassword ? 'text' : 'password'"
                        class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                        style="
                          background-color: var(--bg-app);
                          border-color: var(--border-base);
                          color: var(--text-primary);
                        "
                      />
                      <button
type="button"
                        class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                        @click="showPassword = !showPassword"
                      >
                        <Eye v-if="!showPassword" class="w-4 h-4" />
                        <EyeOff v-else class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div class="p-4 rounded-xl bg-slate-100 dark:bg-white/5 space-y-2">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      GitHub 回调地址 (Authorization callback URL)
                    </p>
                    <code class="text-xs break-all text-accent font-mono"
                      >{{ api.defaults.baseURL }}/api/auth/github/callback</code
                    >
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
                  <h2 class="text-lg font-bold" style="color: var(--text-primary)">
                    邮箱验证邮件模板
                  </h2>
                </div>
                <button
type="button"
                  class="text-xs font-bold text-accent px-4 py-2 rounded-lg border border-accent/20 hover:bg-accent/5 transition-colors"
                  @click="showEmailPreview = !showEmailPreview"
                >
                  {{ showEmailPreview ? t('admin.close_preview') : $t('admin.preview_message') }}
                </button>
              </div>

              <div class="space-y-6">
                <div class="space-y-2">
                  <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
                    >{{ $t('admin.email_subject_subject') }}</label
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
                    <span>{{ $t('admin.text_content_html_supported') }}</span>
                    <span v-pre class="text-[10px] opacity-60">{{ $t('admin.available_placeholders_code') }}</span>
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
                <h2 class="text-lg font-bold" style="color: var(--text-primary)">{{ $t('admin.email_preview') }}</h2>
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
                    <p class="text-[10px] font-bold" style="color: var(--text-muted)">{{ $t('admin.topic') }}</p>
                    <p class="text-xs font-medium" style="color: var(--text-primary)">
                      {{ settings.EMAIL_VERIFY_SUBJECT }}
                    </p>
                  </div>
                </div>
                <SafeHtml class="p-6 bg-white" :html="emailPreviewHtml" />
              </div>
            </section>
          </div>

          <!-- AI Settings Tab -->
          <div
            v-if="activeTab === 'ai'"
            class="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <!-- Header Card -->
            <div
              class="relative overflow-hidden rounded-3xl border p-6"
              style="background: linear-gradient(135deg, var(--bg-card) 0%, rgba(99,102,241,0.04) 100%); border-color: var(--border-base);"
            >
              <div class="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-[0.06]" style="background: radial-gradient(circle, #6366f1 0%, transparent 70%)"></div>
              <div class="absolute -right-2 top-10 w-20 h-20 rounded-full opacity-[0.04]" style="background: radial-gradient(circle, #8b5cf6 0%, transparent 70%)"></div>

              <div class="relative flex items-start justify-between gap-4">
                <div class="flex items-start gap-4">
                  <div class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 15px rgba(99,102,241,0.3);">
                    <Cpu class="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 class="text-base font-black mb-1" style="color: var(--text-primary)">{{ $t('admin.ai_intelligent_assistance_system') }}</h2>
                    <p class="text-xs leading-relaxed max-w-lg" style="color: var(--text-secondary)">
                      启用后，用户可以使用 AI 一键生成项目、AI 写作助手等智能功能。API Key 仅保存在服务端，不会暴露给前台用户。
                    </p>
                  </div>
                </div>
                <div class="flex-shrink-0">
                  <div class="flex flex-col items-center gap-1.5">
                    <el-switch
                      v-model="settings.AI_IMPORT_ENABLED"
                      inline-prompt
                      :active-text="$t('admin.opened')"
                      :inactive-text="$t('admin.closed')"
                      style="--el-switch-on-color: #6366f1; --el-switch-off-color: #94a3b8;"
                    />
                    <span
                      class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      :style="settings.AI_IMPORT_ENABLED
                        ? 'background: rgba(99,102,241,0.12); color: #6366f1;'
                        : 'background: var(--bg-app); color: var(--text-muted);'"
                    >{{ settings.AI_IMPORT_ENABLED ? $t('admin.function_activated') : $t('admin.feature_not_enabled') }}</span>
                  </div>
                </div>
              </div>

              <div v-if="settings.AI_IMPORT_ENABLED" class="mt-4 pt-4 border-t flex flex-wrap gap-2" style="border-color: var(--border-base)">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(99,102,241,0.1); color: #6366f1;">{{ $t('admin.one_click_generation_of') }}</span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(99,102,241,0.1); color: #6366f1;">{{ $t('admin.ai_writing_assistant') }}</span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(99,102,241,0.1); color: #6366f1;">{{ $t('admin.model_thinking_flow_display') }}</span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold" style="background: rgba(99,102,241,0.1); color: #6366f1;">{{ $t('admin.real_time_streaming_output') }}</span>
              </div>
            </div>

            <!-- Models Panel -->
            <div v-if="settings.AI_IMPORT_ENABLED" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-black" style="color: var(--text-primary)">{{ $t('admin.model_pool_configuration') }}</h3>
                  <p class="text-[11px] mt-0.5" style="color: var(--text-muted)">{{ $t('admin.ai_models_status_count', { total: aiModelConfigs.length, enabled: aiModelConfigs.filter(m => m.enabled).length }) }}</p>
                </div>
                <button
                  type="button"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                  style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; box-shadow: 0 2px 12px rgba(99,102,241,0.35);"
                  @click="addAiModel"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>{{ $t('admin.add_model') }}</span>
                </button>
              </div>

              <!-- Model Cards -->
              <div class="space-y-3">
                <div
                  v-for="(model, index) in aiModelConfigs"
                  :key="model.id"
                  :draggable="isDraggable"
                  class="rounded-2xl border overflow-hidden transition-all duration-300"
                  :class="{ 'opacity-50 border-indigo-400 scale-[0.99]': dragIndex === index }"
                  :style="model.isDefault
                    ? 'border-color: rgba(99,102,241,0.4); background-color: var(--bg-card);'
                    : 'border-color: var(--border-base); background-color: var(--bg-card);'"
                  @dragstart="handleDragStart($event, index)"
                  @dragover.prevent
                  @drop="handleDrop($event, index)"
                  @dragend="handleDragEnd"
                >
                  <!-- Card Header -->
                  <div
                    class="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors duration-200"
                    :style="expandedModelId === model.id ? 'background: var(--bg-app);' : ''"
                    @click="toggleModelExpand(model.id)"
                  >
                    <!-- Drag handle -->
                    <div
                      class="flex items-center justify-center p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors duration-150 cursor-grab active:cursor-grabbing flex-shrink-0"
                      :title="$t('admin.drag_and_drop_to')"
                      @mouseenter="isDraggable = true"
                      @mouseleave="isDraggable = false"
                      @click.stop
                    >
                      <GripVertical class="w-3.5 h-3.5 text-slate-400" />
                    </div>

                    <div
                      class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                      :style="`background: ${getProviderMeta(model.provider).bg}; border: 1px solid ${getProviderMeta(model.provider).border};`"
                    >
                      <component
                        :is="getProviderMeta(model.provider).lucideIcon"
                        class="w-4.5 h-4.5"
                        :style="`color: ${getProviderMeta(model.provider).color};`"
                      />
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-black truncate" style="color: var(--text-primary);">{{ model.name || model.modelName || $t('admin.unnamed_model') }}</span>
                        <span v-if="model.isDefault" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style="background: rgba(251,191,36,0.12); color: #d97706;">{{ $t('admin.default') }}</span>
                        <span v-if="!model.enabled" class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold" style="background: rgba(100,116,139,0.1); color: var(--text-muted);">{{ $t('admin.disabled') }}</span>
                      </div>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <span
                          class="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          :style="`background: ${getProviderMeta(model.provider).bg}; color: ${getProviderMeta(model.provider).color};`"
                        >{{ getProviderMeta(model.provider).label }}</span>
                        <span class="text-[10px] font-mono" style="color: var(--text-muted);">{{ model.modelName }}</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 flex-shrink-0" @click.stop>
                      <el-switch v-model="model.enabled" size="small" style="--el-switch-on-color: #6366f1;" />

                      <button
                        type="button"
                        class="w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-200"
                        :style="model.isDefault
                          ? 'color: #d97706; background: rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.3);'
                          : 'color: var(--text-muted); border-color: var(--border-base); background: transparent;'"
                        :title="model.isDefault ? $t('admin.current_default_model') : $t('admin.set_as_default_model')"
                        @click="setDefaultAiModel(model.id)"
                      >
                        <Star class="w-3.5 h-3.5" :class="model.isDefault ? 'fill-current' : ''" />
                      </button>

                      <button
                        type="button"
                        :disabled="isTestingAi && testingAiModelId === model.id"
                        class="h-7 px-2.5 rounded-lg flex items-center gap-1 text-[10px] font-bold border transition-all duration-200 disabled:opacity-50"
                        style="border-color: rgba(99,102,241,0.25); color: #6366f1; background: rgba(99,102,241,0.05);"
                        @click="testAi(model)"
                      >
                        <RefreshCw
                          class="w-3 h-3"
                          :class="isTestingAi && testingAiModelId === model.id ? 'animate-spin' : ''"
                        />
                        <span>{{ (isTestingAi && testingAiModelId === model.id) ? $t('admin.testing') : $t('admin.test_connection') }}</span>
                      </button>

                      <button
                        type="button"
                        class="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-500"
                        style="color: var(--text-muted);"
                        :title="$t('admin.delete_model')"
                        @click="removeAiModel(model.id)"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>

                      <div
                        class="w-5 h-5 flex items-center justify-center transition-transform duration-300"
                        :class="expandedModelId === model.id ? 'rotate-180' : ''"
                        style="color: var(--text-muted);"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      </div>
                    </div>
                  </div>

                  <!-- Expandable Body -->
                  <div v-show="expandedModelId === model.id">
                    <div class="px-4 pb-5 pt-4 space-y-4" style="border-top: 1px solid var(--border-base);">
                      <!-- Provider chips -->
                      <div class="space-y-2">
                        <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">{{ $t('admin.ai_provider') }}</label>
                        <div class="flex flex-wrap gap-2">
                          <button
                            v-for="(meta, key) in providerMeta"
                            :key="key"
                            type="button"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-200"
                            :style="model.provider === key
                              ? `background: ${meta.bg}; border-color: ${meta.border}; color: ${meta.color};`
                              : 'background: var(--bg-app); border-color: var(--border-base); color: var(--text-secondary);'"
                            @click="model.provider = key; handleAiProviderChange(model)"
                          >
                            <component
                              :is="meta.lucideIcon"
                              class="w-3.5 h-3.5"
                              :style="model.provider === key ? `color: ${meta.color};` : 'color: var(--text-muted);'"
                            />
                            <span>{{ meta.label }}</span>
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                          <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">{{ $t('admin.display_name') }}</label>
                          <input
                            v-model="model.name"
                            type="text"
                            :placeholder="$t('admin.for_example_deepseek_chat_1')"
                            class="w-full px-3 py-2.5 rounded-xl border text-xs outline-none transition-colors"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                          />
                        </div>
                        <div class="space-y-1.5">
                          <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">{{ $t('admin.model_id') }}</label>
                          <input
                            v-model="model.modelName"
                            type="text"
                            :placeholder="$t('admin.for_example_deepseek_chat')"
                            class="w-full px-3 py-2.5 rounded-xl border text-xs outline-none font-mono transition-colors"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                          />
                        </div>
                      </div>

                      <div class="space-y-1.5">
                        <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">API Endpoint</label>
                        <div class="relative">
                          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black select-none" style="color: var(--text-muted);">URL</span>
                          <input
                            v-model="model.endpoint"
                            type="text"
                            :placeholder="$t('admin.for_example_https_api')"
                            class="w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs outline-none font-mono transition-colors"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                          />
                        </div>
                      </div>

                      <div v-if="model.provider !== 'OLLAMA'" class="space-y-1.5">
                        <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">API Key <span class="ml-1 text-[10px] font-normal normal-case" style="color: var(--text-muted);">{{ $t('admin.only_exists_on_the') }}</span></label>
                        <div class="relative">
                          <input
                            v-model="model.apiKey"
                            :type="showPassword ? 'text' : 'password'"
                            placeholder="sk-..."
                            class="w-full px-3 py-2.5 pr-10 rounded-xl border text-xs outline-none font-mono transition-colors"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                          />
                          <button
                            type="button"
                            class="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-indigo-500"
                            style="color: var(--text-muted);"
                            @click="showPassword = !showPassword"
                          >
                            <Eye v-if="!showPassword" class="w-4 h-4" />
                            <EyeOff v-else class="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                          <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">{{ $t('admin.capability_label') }} <span class="font-normal normal-case">{{ $t('admin.comma_separated') }}</span></label>
                          <input
                            :value="model.capabilities.join(', ')"
                            type="text"
                            placeholder="chat, vision, code"
                            class="w-full px-3 py-2.5 rounded-xl border text-xs outline-none transition-colors"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                            @input="updateAiModelCapabilities(model, $event)"
                          />
                        </div>
                        <div class="space-y-1.5">
                          <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">{{ $t('admin.description_1') }}</label>
                          <input
                            v-model="model.description"
                            type="text"
                            :placeholder="$t('admin.for_example_suitable_for')"
                            class="w-full px-3 py-2.5 rounded-xl border text-xs outline-none transition-colors"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                          />
                        </div>
                      </div>

                      <div v-if="model.provider === 'OLLAMA'" class="flex items-start gap-2 p-3 rounded-xl" style="background: rgba(124,58,237,0.06); border: 1px dashed rgba(124,58,237,0.25);">
                        <span class="text-sm mt-0.5">🦙</span>
                        <p class="text-[11px] leading-relaxed" style="color: var(--text-secondary);">{{ $t('admin.ollama_local_models_do_1') }} <code class="font-mono bg-black/10 px-1 rounded">ollama pull</code> {{ $t('admin.download') }}</p>
                      </div>

                      <!-- Advanced settings toggle button -->
                      <div class="pt-2 border-t" style="border-color: var(--border-base);">
                        <button
                          type="button"
                          class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-500 hover:text-indigo-600 transition-colors"
                          @click="model.showAdvanced = !model.showAdvanced"
                        >
                          <Sliders class="w-3.5 h-3.5" />
                          <span>{{ model.showAdvanced ? $t('admin.hide_advanced_parameters') : $t('admin.expand_advanced_parameter_settings') }}</span>
                        </button>
                      </div>

                      <!-- Advanced parameters configuration panel -->
                      <div
                        v-show="model.showAdvanced"
                        class="p-4 rounded-xl border border-dashed space-y-4 transition-all duration-300"
                        style="border-color: var(--border-base); background: rgba(99,102,241,0.02);"
                      >
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <!-- Temperature Slider -->
                          <div class="space-y-1.5">
                            <label class="text-[11px] font-black uppercase tracking-wider px-1 flex items-center justify-between" style="color: var(--text-muted);">
                              <span>{{ $t('admin.temperature') }}</span>
                              <span class="text-[10px] font-mono text-indigo-500">{{ $t('admin.current_model_temperature_tofixed', { temp: model.temperature?.toFixed(1) ?? '0.7' }) }}</span>
                            </label>
                            <div class="flex items-center gap-3">
                              <input
                                v-model.number="model.temperature"
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                class="flex-1 accent-indigo-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <span
                                class="text-xs font-mono font-bold px-2 py-0.5 rounded border select-none"
                                style="border-color: var(--border-base); color: var(--text-primary); background-color: var(--bg-app);"
                              >
                                {{ model.temperature?.toFixed(1) ?? '0.7' }}
                              </span>
                            </div>
                          </div>

                          <!-- Max Tokens -->
                          <div class="space-y-1.5">
                            <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">{{ $t('admin.single_maximum_generation_max') }}</label>
                            <input
                              v-model.number="model.maxTokens"
                              type="number"
                              min="1"
                              max="128000"
                              :placeholder="$t('admin.default_2000')"
                              class="w-full px-3 py-2 rounded-xl border text-xs outline-none font-mono transition-colors"
                              style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                            />
                          </div>
                        </div>

                        <!-- System Prompt -->
                        <div class="space-y-1.5">
                          <label class="text-[11px] font-black uppercase tracking-wider px-1" style="color: var(--text-muted);">{{ $t('admin.system_prompt') }}</label>
                          <textarea
                            v-model="model.systemPrompt"
                            rows="3"
                            :placeholder="$t('admin.for_example_you_are')"
                            class="w-full px-3 py-2 rounded-xl border text-xs outline-none transition-colors resize-none font-sans"
                            style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary);"
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-if="aiModelConfigs.length === 0" class="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed" style="border-color: var(--border-base);">
                <div class="text-4xl mb-3">🤖</div>
                <p class="text-sm font-bold" style="color: var(--text-primary);">{{ $t('admin.no_models_have_been') }}</p>
                <p class="text-xs mt-1 mb-4" style="color: var(--text-muted);">{{ $t('admin.click_add_model_to') }}</p>
                <button
                  type="button"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                  style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;"
                  @click="addAiModel"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>{{ $t('admin.add_model') }}</span>
                </button>
              </div>

              <!-- Stats + Test row -->
              <div v-if="aiModelConfigs.length > 0" class="flex items-center justify-between p-4 rounded-2xl" style="background-color: var(--bg-app); border: 1px solid var(--border-base);">
                <div class="flex items-center gap-4">
                  <div class="text-center">
                    <p class="text-lg font-black" style="color: var(--text-primary);">{{ aiModelConfigs.length }}</p>
                    <p class="text-[10px]" style="color: var(--text-muted);">{{ $t('admin.total_number_of_models') }}</p>
                  </div>
                  <div class="w-px h-8" style="background: var(--border-base);"></div>
                  <div class="text-center">
                    <p class="text-lg font-black" style="color: #6366f1;">{{ aiModelConfigs.filter(m => m.enabled).length }}</p>
                    <p class="text-[10px]" style="color: var(--text-muted);">{{ $t('admin.enabled') }}</p>
                  </div>
                  <div class="w-px h-8" style="background: var(--border-base);"></div>
                  <div class="text-center">
                    <p class="text-lg font-black" style="color: #d97706;">{{ aiModelConfigs.filter(m => m.isDefault).length }}</p>
                    <p class="text-[10px]" style="color: var(--text-muted);">{{ $t('admin.default_model') }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <p class="text-[10px] hidden sm:block" style="color: var(--text-muted);">{{ $t('admin.please_test_connectivity_before') }}</p>
                  <button
                    type="button"
                    :disabled="isTestingAi"
                    class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 disabled:opacity-50"
                    style="border-color: rgba(99,102,241,0.3); color: #6366f1; background: rgba(99,102,241,0.06);"
                    @click="testAi(aiModelConfigs.find(model => model.isDefault) || aiModelConfigs[0])"
                  >
                    <RefreshCw
                      class="w-3.5 h-3.5"
                      :class="isTestingAi && testingAiModelId ? 'animate-spin' : ''"
                    />
                    <span>{{ isTestingAi ? $t('admin.testing') : $t('admin.test_default_model_connections') }}</span>
                  </button>
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

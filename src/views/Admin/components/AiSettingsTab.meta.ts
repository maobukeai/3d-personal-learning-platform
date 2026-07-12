import { useI18n } from 'vue-i18n';
import { Cpu, Sparkles, Database, Globe, Cloud, Settings, Sliders } from 'lucide-vue-next';
import { PENDING_MODEL_FAMILY_KEY, titleCaseModelFamily } from '@/utils/aiModelFamilies';
import type { ProviderMeta, AiModelCategory } from './AiSettingsTab.types';

export const useAiSettingsMeta = () => {
  const { t } = useI18n();

  const aiProviderDefaults: Record<string, { endpoint: string; model: string; name: string }> = {
    AGNES: {
      endpoint: 'https://apihub.agnes-ai.com/v1',
      model: 'agnes-2.0-flash',
      name: 'Agnes 2.0 Flash',
    },
    DEEPSEEK: {
      endpoint: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      name: 'DeepSeek Chat',
    },
    OPENAI: {
      endpoint: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      name: 'OpenAI GPT-4o mini',
    },
    OLLAMA: { endpoint: 'http://localhost:11434/api', model: 'llama3', name: 'Ollama Llama3' },
    QWEN: {
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      name: 'Qwen Plus',
    },
    GEMINI: {
      endpoint: 'https://generativelanguage.googleapis.com',
      model: 'gemini-1.5-flash',
      name: 'Gemini Flash',
    },
    AZURE: {
      endpoint:
        'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT_NAME/chat/completions?api-version=2023-05-15',
      model: 'gpt-4o',
      name: 'Azure OpenAI',
    },
    CUSTOM: { endpoint: '', model: '', name: t('admin.custom_model') },
  };

  const providerMeta: Record<string, ProviderMeta> = {
    AGNES: {
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.08)',
      border: 'rgba(139,92,246,0.25)',
      label: 'Agnes',
      lucideIcon: Cpu,
    },
    DEEPSEEK: {
      color: '#2563eb',
      bg: 'rgba(37,99,235,0.08)',
      border: 'rgba(37,99,235,0.25)',
      label: 'DeepSeek',
      lucideIcon: Cpu,
    },
    OPENAI: {
      color: '#10a37f',
      bg: 'rgba(16,163,127,0.08)',
      border: 'rgba(16,163,127,0.25)',
      label: 'OpenAI',
      lucideIcon: Sparkles,
    },
    OLLAMA: {
      color: '#7c3aed',
      bg: 'rgba(124,58,237,0.08)',
      border: 'rgba(124,58,237,0.25)',
      label: 'Ollama',
      lucideIcon: Database,
    },
    QWEN: {
      color: '#ea580c',
      bg: 'rgba(234,88,12,0.08)',
      border: 'rgba(234,88,12,0.25)',
      label: 'Qwen',
      lucideIcon: Globe,
    },
    GEMINI: {
      color: '#db2777',
      bg: 'rgba(219,39,119,0.08)',
      border: 'rgba(219,39,119,0.25)',
      label: 'Gemini',
      lucideIcon: Sparkles,
    },
    AZURE: {
      color: '#0284c7',
      bg: 'rgba(2,132,199,0.08)',
      border: 'rgba(2,132,199,0.25)',
      label: 'Azure',
      lucideIcon: Cloud,
    },
    CUSTOM: {
      color: '#64748b',
      bg: 'rgba(100,116,139,0.08)',
      border: 'rgba(100,116,139,0.25)',
      label: 'Custom',
      lucideIcon: Settings,
    },
  };

  const getProviderMeta = (provider: string) => providerMeta[provider] || providerMeta.CUSTOM;

  const modelFamilyMeta: Record<string, ProviderMeta> = {
    [PENDING_MODEL_FAMILY_KEY]: {
      color: '#64748b',
      bg: 'rgba(100,116,139,0.08)',
      border: 'rgba(100,116,139,0.25)',
      label: t('admin.ai_pending_configuration'),
      lucideIcon: Sliders,
    },
    agnes: {
      color: '#0891b2',
      bg: 'rgba(8,145,178,0.08)',
      border: 'rgba(8,145,178,0.25)',
      label: 'Agnes',
      lucideIcon: Sparkles,
    },
    gemini: providerMeta.GEMINI,
    deepseek: providerMeta.DEEPSEEK,
    qwen: providerMeta.QWEN,
    openai: providerMeta.OPENAI,
    gpt: providerMeta.OPENAI,
    skywork: {
      color: '#4f46e5',
      bg: 'rgba(79,70,229,0.08)',
      border: 'rgba(79,70,229,0.25)',
      label: 'Skywork',
      lucideIcon: Cpu,
    },
    llama: {
      color: '#7c3aed',
      bg: 'rgba(124,58,237,0.08)',
      border: 'rgba(124,58,237,0.25)',
      label: 'Llama',
      lucideIcon: Database,
    },
    claude: {
      color: '#d97706',
      bg: 'rgba(217,119,6,0.08)',
      border: 'rgba(217,119,6,0.25)',
      label: 'Claude',
      lucideIcon: Sparkles,
    },
    mistral: {
      color: '#dc2626',
      bg: 'rgba(220,38,38,0.08)',
      border: 'rgba(220,38,38,0.25)',
      label: 'Mistral',
      lucideIcon: Cpu,
    },
    gemma: {
      color: '#db2777',
      bg: 'rgba(219,39,119,0.08)',
      border: 'rgba(219,39,119,0.25)',
      label: 'Gemma',
      lucideIcon: Sparkles,
    },
  };

  const modelFamilyPalette = [
    { color: '#0f766e', bg: 'rgba(15,118,110,0.08)', border: 'rgba(15,118,110,0.25)' },
    { color: '#4338ca', bg: 'rgba(67,56,202,0.08)', border: 'rgba(67,56,202,0.25)' },
    { color: '#be123c', bg: 'rgba(190,18,60,0.08)', border: 'rgba(190,18,60,0.25)' },
    { color: '#9333ea', bg: 'rgba(147,51,234,0.08)', border: 'rgba(147,51,234,0.25)' },
    { color: '#ca8a04', bg: 'rgba(202,138,4,0.08)', border: 'rgba(202,138,4,0.25)' },
  ];

  const getModelFamilyMeta = (key: string, customLabel?: string) => {
    if (modelFamilyMeta[key]) {
      return customLabel ? { ...modelFamilyMeta[key], label: customLabel } : modelFamilyMeta[key];
    }
    const hash = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const palette = modelFamilyPalette[hash % modelFamilyPalette.length];
    return {
      ...palette,
      label: customLabel || titleCaseModelFamily(key) || 'Custom',
      lucideIcon: Cpu,
    };
  };

  const getCapabilityLabel = (cap: string) => {
    switch (cap) {
      case 'chat':
        return '对话';
      case 'image':
        return '画图';
      case 'video':
        return '视频';
      case 'translate':
        return '翻译';
      default:
        return cap;
    }
  };

  const getCapabilityStyle = (cap: string) => {
    switch (cap) {
      case 'chat':
        return 'background: rgba(99, 102, 241, 0.1); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.15);';
      case 'image':
        return 'background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.15);';
      case 'video':
        return 'background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.15);';
      case 'translate':
        return 'background: rgba(245, 158, 11, 0.1); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.15);';
      default:
        return 'background: rgba(100, 116, 139, 0.1); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.15);';
    }
  };

  const normalizeCustomCategories = (value: unknown): AiModelCategory[] => {
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

    const seenKeys = new Set<string>();
    return raw
      .map((item): AiModelCategory | null => {
        if (!item || typeof item !== 'object') return null;
        const category = item as Record<string, unknown>;
        const key = String(category.key || '').trim();
        const label = String(category.label || '').trim();
        if (!key || !label || seenKeys.has(key)) return null;
        seenKeys.add(key);
        return { key, label };
      })
      .filter((item): item is AiModelCategory => Boolean(item));
  };

  return {
    aiProviderDefaults,
    providerMeta,
    getProviderMeta,
    modelFamilyMeta,
    modelFamilyPalette,
    getModelFamilyMeta,
    getCapabilityLabel,
    getCapabilityStyle,
    normalizeCustomCategories,
  };
};

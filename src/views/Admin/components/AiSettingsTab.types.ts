import type { Component } from 'vue';

export interface AiModelConfig {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  endpoint: string;
  apiKey: string;
  apiKeys?: string[];
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
  failoverEnabled?: boolean;
  priority?: number;
}

export interface AiModelCategory {
  key: string;
  label: string;
}

export interface AiProviderModelOption {
  id: string;
  name?: string;
  ownedBy?: string;
}

export interface ProviderMeta {
  color: string;
  bg: string;
  border: string;
  label: string;
  lucideIcon: Component;
}

export interface ModelFamilyGroup {
  key: string;
  label: string;
  provider: string;
  providerLabel: string;
  models: AiModelConfig[];
  enabledCount: number;
  defaultModel?: AiModelConfig;
  endpointLabel: string;
  meta: ProviderMeta;
}

export interface CategoryDialogState {
  show: boolean;
  mode: 'create' | 'rename';
  groupKey: string;
  name: string;
}

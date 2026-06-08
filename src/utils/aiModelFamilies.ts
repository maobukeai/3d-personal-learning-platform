export interface AiModelFamilyCandidate {
  id?: string;
  name?: string;
  provider?: string;
  modelName?: string;
  customFamilyKey?: string;
  customFamilyLabel?: string;
}

export const PENDING_MODEL_FAMILY_KEY = 'pending';

export const MODEL_FAMILY_RULES: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: 'agnes', label: 'Agnes', pattern: /^agnes(?:[-_/]|$)/ },
  { key: 'gemini', label: 'Gemini', pattern: /^gemini(?:[-_/]|$)/ },
  { key: 'deepseek', label: 'DeepSeek', pattern: /^deepseek(?:[-_/]|$)/ },
  { key: 'qwen', label: 'Qwen', pattern: /^qwen(?:[-_/]|$)/ },
  { key: 'openai', label: 'OpenAI', pattern: /^(gpt|o[134])(?:[-_/]|$)/ },
  { key: 'skywork', label: 'Skywork', pattern: /^skywork(?:[-_/]|$)/ },
  { key: 'llama', label: 'Llama', pattern: /^llama(?:[-_/]|$)/ },
  { key: 'claude', label: 'Claude', pattern: /^claude(?:[-_/]|$)/ },
  { key: 'mistral', label: 'Mistral', pattern: /^(mistral|mixtral)/ },
  { key: 'gemma', label: 'Gemma', pattern: /^gemma(?:[-_/]|$)/ },
];

export const parseModelNameLines = (value: string): string[] => {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const titleCaseModelFamily = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const normalizeModelFamilySource = (model: AiModelFamilyCandidate) => {
  const rawName = (model.modelName || model.name || '').trim().toLowerCase();
  if (!rawName) return '';
  const normalized = rawName.replace(/^models\//, '');
  return normalized.includes('/') ? normalized.split('/')[0] : normalized;
};

export const inferModelFamilyKey = (
  model: AiModelFamilyCandidate,
  options: { isPending?: boolean } = {},
) => {
  if (options.isPending) return PENDING_MODEL_FAMILY_KEY;
  if (model.customFamilyKey) return model.customFamilyKey;

  const firstPathPart = normalizeModelFamilySource(model);
  if (!firstPathPart) return (model.provider || 'custom').toLowerCase();

  const matched = MODEL_FAMILY_RULES.find((rule) => rule.pattern.test(firstPathPart));
  if (matched) return matched.key;

  return (
    firstPathPart.split(/[-_.:]/).filter(Boolean)[0] || (model.provider || 'custom').toLowerCase()
  );
};

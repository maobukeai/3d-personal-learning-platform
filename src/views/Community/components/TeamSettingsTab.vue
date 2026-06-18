<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Shield, Sparkles, Zap, Compass, Award } from 'lucide-vue-next';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import { useSystemStore } from '@/stores/system';
import { ElMessage } from 'element-plus';
import { createJsonHeaders, readFetchErrorMessage } from '@/utils/aiHelpers';

interface EditForm {
  name: string;
  description: string;
  avatarUrl: string;
  visibility: string;
  category: string;
}

const props = defineProps<{
  editForm: EditForm;
  isPersonalSpace: boolean;
  isOwner: boolean;
  isSaving: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:editForm', val: EditForm): void;
  (e: 'update-team'): void;
  (e: 'delete-team'): void;
}>();

const { t: i18nT } = useI18n();

const t = (key: string, ...args: unknown[]) => {
  const prefixes = ['showcase.', 'teams.', 'members.', 'teamDetail.', 'discussions.', 'chat.'];
  if (prefixes.some((p) => key.startsWith(p))) {
    return (i18nT as (key: string, ...args: unknown[]) => string)(`community.${key}`, ...args);
  }
  return (i18nT as (key: string, ...args: unknown[]) => string)(key, ...args);
};

const localEditForm = computed({
  get: () => props.editForm,
  set: (val) => emit('update:editForm', val),
});

const systemStore = useSystemStore();
const categories = computed(() => systemStore.settings.TEAM_CATEGORIES);

const isGenerating = ref(false);

const plainDescription = ref('');
const coreValuesList = ref([
  { title: '', desc: '' },
  { title: '', desc: '' },
  { title: '', desc: '' },
]);

const parseDescriptionAndCoreValues = (rawDesc: string) => {
  const separator = '\n\n===CORE_VALUES===\n';
  const parts = rawDesc.split(separator);
  let desc = parts[0];
  let values = [
    {
      title: '技术共享',
      desc: '从基础几何体到复杂着色器与实时动画，汇聚前沿 3D 渲染与WebGL技术方案。',
    },
    {
      title: '协同创作',
      desc: '联合不同背景 of 创作者，在云端工作流中共同迭代 3D 交互场景与产品级案例。',
    },
    {
      title: '共同成长',
      desc: '通过每周命题挑战赛与同行评议机制，全方位锤炼 3D 艺术品与技术深度。',
    },
  ];
  if (parts.length > 1) {
    try {
      const parsedValues = JSON.parse(parts[1]);
      if (Array.isArray(parsedValues.values) && parsedValues.values.length > 0) {
        values = parsedValues.values.map((v: { title?: string; desc?: string }) => ({
          title: v.title || '',
          desc: v.desc || '',
        }));
        while (values.length < 3) {
          values.push({ title: '', desc: '' });
        }
        values = values.slice(0, 3);
      }
    } catch {
      // ignore
    }
  }
  return { desc, values };
};

watch(
  () => props.editForm.description,
  (newVal) => {
    const { desc, values } = parseDescriptionAndCoreValues(newVal || '');
    const currentSerializedValues = JSON.stringify({
      values: coreValuesList.value.map((v) => ({ title: v.title, desc: v.desc })),
    });
    const incomingSerializedValues = JSON.stringify({ values });
    if (plainDescription.value !== desc || currentSerializedValues !== incomingSerializedValues) {
      plainDescription.value = desc;
      coreValuesList.value = values;
    }
  },
  { immediate: true },
);

const updateParentDescription = () => {
  const separator = '\n\n===CORE_VALUES===\n';
  const payload = JSON.stringify({
    values: coreValuesList.value.map((v) => ({ title: v.title, desc: v.desc })),
  });
  const newRawDesc = plainDescription.value + separator + payload;
  if (props.editForm.description !== newRawDesc) {
    emit('update:editForm', { ...props.editForm, description: newRawDesc });
  }
};

watch(
  [plainDescription, coreValuesList],
  () => {
    updateParentDescription();
  },
  { deep: true },
);

const handleAiGenerateDescription = async () => {
  if (!localEditForm.value.name) {
    ElMessage.warning('请先输入小组名称，以便 AI 能够针对性生成描述和核心价值。');
    return;
  }
  isGenerating.value = true;
  try {
    const response = await fetch('/api/ai/write-assist', {
      method: 'POST',
      headers: createJsonHeaders(),
      body: JSON.stringify({
        action: 'generate',
        text: `小组名称：${localEditForm.value.name}`,
        prompt:
          '请根据小组名称，生成一段简短有活力的小组介绍描述（关于小组，控制在 100 字左右），并同时设计三条独特的小组核心价值。请严格按照 JSON 格式返回，格式如下，不要带有任何 Markdown 包裹标记或代码块：\n{\n  "description": "这是介绍...",\n  "value1_title": "标题1",\n  "value1_desc": "描述1",\n  "value2_title": "标题2",\n  "value2_desc": "描述2",\n  "value3_title": "标题3",\n  "value3_desc": "描述3"\n}',
        tone: 'friendly',
        length: 'balanced',
        format: 'keep',
      }),
    });

    if (!response.ok) {
      const errMsg = await readFetchErrorMessage(response);
      throw new Error(errMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('流式读取不受支持');

    const decoder = new TextDecoder();
    let resultText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE lines
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              resultText += data.text;
            }
          } catch {
            // ignore parse errors of stream chunks
          }
        }
      }
    }

    // Attempt to parse resultText as JSON
    let cleanText = resultText.trim();
    if (cleanText.startsWith('```')) {
      const match = cleanText.match(/^(?:```[a-zA-Z]*\n?)([\s\S]*?)(?:\n?```)$/);
      if (match) {
        cleanText = match[1].trim();
      }
    }
    const parsed = JSON.parse(cleanText);
    if (parsed.description) {
      plainDescription.value = parsed.description;
      coreValuesList.value = [
        { title: parsed.value1_title || '核心价值一', desc: parsed.value1_desc || '' },
        { title: parsed.value2_title || '核心价值二', desc: parsed.value2_desc || '' },
        { title: parsed.value3_title || '核心价值三', desc: parsed.value3_desc || '' },
      ];
      updateParentDescription();
      ElMessage.success('AI 已成功为您策划了小组介绍与核心价值！');
    }
  } catch (err: unknown) {
    console.error(err);
    ElMessage.error((err instanceof Error ? err.message : null) || 'AI 策划失败，请尝试手动填写');
  } finally {
    isGenerating.value = false;
  }
};
</script>

<template>
  <div class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
    <!-- Basic Profile Section -->
    <div class="space-y-4 text-left">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-lg font-black" style="color: var(--text-primary)">
            {{ t('teamDetail.basicProfile') }}
          </h3>
          <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">
            {{ t('teamDetail.basicProfileDesc') }}
          </p>
        </div>
        <Button
          variant="primary"
          :loading="isSaving"
          class="!px-6 !py-2.5 !rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-accent/10 shrink-0 text-xs border-none cursor-pointer"
          @click="emit('update-team')"
        >
          {{ isSaving ? t('teamDetail.syncing') : t('teamDetail.saveChanges') }}
        </Button>
      </div>
      <div
        class="backdrop-blur-md bg-white/40 dark:bg-slate-900/30 p-6 sm:p-8 rounded-3xl border shadow-md space-y-6"
        style="border-color: var(--border-base)"
      >
        <Input
          v-model="localEditForm.name"
          type="text"
          :label="t('teamDetail.teamNameLabel')"
          input-class="!px-5 !py-3.5 !rounded-2xl"
        />
        <div class="space-y-2">
          <div class="flex items-center justify-between ml-1">
            <label
              class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest"
              >{{ t('teamDetail.teamDescLabel') }}</label
            >
            <Button
              variant="glass"
              size="sm"
              :icon="Sparkles"
              class="!h-6 !px-2.5 !rounded-lg text-accent border-none !bg-accent/5 hover:!bg-accent/10 active:scale-95 cursor-pointer"
              :loading="isGenerating"
              @click="handleAiGenerateDescription"
            >
              AI 智能生成
            </Button>
          </div>
          <textarea
            v-model="plainDescription"
            rows="2"
            class="w-full px-5 py-3.5 glass-input rounded-2xl focus:ring-4 focus:ring-accent/10 outline-none transition-all resize-none text-sm"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="填写小组描述信息，支持保存自定义的核心价值"
          ></textarea>
        </div>

        <!-- Core Values Settings -->
        <div class="space-y-3">
          <label
            class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1"
          >
            团队核心价值
          </label>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              v-for="(val, index) in coreValuesList"
              :key="index"
              class="p-4 rounded-2xl border bg-white/20 dark:bg-slate-900/10 backdrop-blur-md space-y-3 hover:border-accent/15 transition-all"
              style="border-color: var(--border-base)"
            >
              <div class="flex items-center gap-2">
                <div
                  class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  :class="[
                    index === 0
                      ? 'bg-amber-500/10 text-amber-500'
                      : index === 1
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-emerald-500/10 text-emerald-500',
                  ]"
                >
                  <component
                    :is="index === 0 ? Zap : index === 1 ? Compass : Award"
                    class="w-3.5 h-3.5"
                  />
                </div>
                <span
                  class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                >
                  核心价值 {{ index + 1 }}
                </span>
              </div>

              <div class="space-y-2.5">
                <input
                  v-model="val.title"
                  type="text"
                  placeholder="标题"
                  class="w-full px-3 py-2 text-xs font-bold bg-white/40 dark:bg-slate-950/20 border rounded-xl focus:ring-4 focus:ring-accent/10 outline-none transition-all"
                  style="border-color: var(--border-base); color: var(--text-primary)"
                />
                <textarea
                  v-model="val.desc"
                  rows="2"
                  placeholder="描述内容"
                  class="w-full px-3 py-2 text-[11px] font-medium bg-white/40 dark:bg-slate-950/20 border rounded-xl focus:ring-4 focus:ring-accent/10 outline-none transition-all resize-none leading-normal"
                  style="border-color: var(--border-base); color: var(--text-primary)"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="space-y-2">
            <label
              class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1"
              >{{ t('team.category') }}</label
            >
            <el-select
              v-model="localEditForm.category"
              class="w-full custom-select"
              :placeholder="t('team.categoryPlaceholder')"
            >
              <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
            </el-select>
          </div>
          <div v-if="!isPersonalSpace" class="space-y-2">
            <label
              class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1"
              >{{ t('teamDetail.privacyLabel') }}</label
            >
            <el-select
              v-model="localEditForm.visibility"
              class="w-full custom-select"
              :placeholder="t('teamDetail.visibilityPlaceholder')"
            >
              <el-option :label="t('teamDetail.visibilityPublic')" value="PUBLIC" />
              <el-option :label="t('teamDetail.visibilityPrivate')" value="PRIVATE" />
            </el-select>
          </div>
        </div>
      </div>
    </div>

    <!-- Danger Zone Section -->
    <div
      v-if="!isPersonalSpace"
      class="pt-6 border-t space-y-4 text-left"
      style="border-color: var(--border-base)"
    >
      <div>
        <h3 class="text-lg font-black text-rose-500">
          {{ t('teamDetail.dangerZone') }}
        </h3>
        <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">
          {{ t('teamDetail.dangerZoneDesc') }}
        </p>
      </div>
      <div
        class="bg-rose-500/5 dark:bg-rose-500/10 p-6 sm:p-8 rounded-3xl border border-rose-500/20 flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div class="text-left w-full">
          <h4 class="text-base font-black text-rose-600 dark:text-rose-400 mb-1">
            {{ t('teamDetail.dissolveTitle') }}
          </h4>
          <p class="text-xs text-rose-500/80 leading-relaxed">
            {{ t('teamDetail.dissolveDesc') }}
          </p>
        </div>
        <Button
          v-if="isOwner"
          variant="danger"
          class="!px-8 !py-3.5 !rounded-2xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-rose-600/10 whitespace-nowrap !bg-rose-600 hover:!bg-rose-700 text-white border-none shrink-0 text-xs cursor-pointer"
          @click="emit('delete-team')"
        >
          {{ t('teamDetail.dissolveBtn') }}
        </Button>
        <div
          v-else
          class="flex items-center gap-2 text-rose-500/80 font-bold text-xs italic shrink-0"
        >
          <Shield class="w-4 h-4" /> {{ t('teamDetail.dissolveOwnerOnly') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-select :deep(.el-select__wrapper) {
  border-radius: 1rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  height: 52px;
  transition: all 0.2s ease !important;
}
.dark .custom-select :deep(.el-select__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-select :deep(.el-select__wrapper.is-focused) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}

@media (max-width: 768px) {
  .custom-select :deep(.el-select__wrapper) {
    height: 44px !important;
    border-radius: 0.75rem !important;
  }
}
</style>

<script setup lang="ts">
import { ref } from 'vue';
import { Save, Eye, EyeOff } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';

const showSecret = ref(false);
import type {
  AiBotEntitlement,
  AiBotIntegrationForm,
  AiBotModelOption,
} from '../../aiRobotAccessModel';

interface Props {
  isEditing: boolean;
  editingId: string;
  isSaving: boolean;
  modelOptions: AiBotModelOption[];
  formSelectedModel: AiBotModelOption | null;
  isLocked: boolean;
  entitlement: AiBotEntitlement | null;
  canCreateMore: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  save: [];
  close: [];
  'open-create': [];
}>();

const show = defineModel<boolean>('show', { required: true });
const form = defineModel<AiBotIntegrationForm>('form', { required: true });

const platformOptions = [
  { value: 'WEWORK', label: '企业微信', tone: 'emerald' },
  { value: 'DINGTALK', label: '钉钉', tone: 'sky' },
  { value: 'FEISHU', label: '飞书', tone: 'rose' },
  { value: 'CUSTOM', label: '通用 Webhook', tone: 'amber' },
];

const AI_BOT_RESPONSE_MODE = {
  BACKGROUND_WEBHOOK: 'BACKGROUND_WEBHOOK',
  CALLBACK_AND_WEBHOOK: 'CALLBACK_AND_WEBHOOK',
  CALLBACK_ONLY: 'CALLBACK_ONLY',
} as const;

const responseModeOptions = [
  {
    value: AI_BOT_RESPONSE_MODE.BACKGROUND_WEBHOOK,
    label: '后台运行',
    description: '外部平台立即收到入队结果，网站后台继续生成并通过 Webhook 推送。',
  },
  {
    value: AI_BOT_RESPONSE_MODE.CALLBACK_AND_WEBHOOK,
    label: '同步响应',
    description: '回调请求等待 AI 完成后再返回，同时可推送外发 Webhook。',
  },
  {
    value: AI_BOT_RESPONSE_MODE.CALLBACK_ONLY,
    label: '仅回调',
    description: '只把 AI 回复放在本次回调响应中，不主动推送外发 Webhook。',
  },
];

const responseModeDescription = (mode?: string | null) =>
  responseModeOptions.find((option) => option.value === mode)?.description || '';
</script>

<template>
  <Modal
    :show="show"
    :title="isEditing ? '配置机器人接入' : '新增机器人接入'"
    size="lg"
    @close="emit('close')"
  >
    <div class="space-y-4 text-left">
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">名称</label>
          <input v-model="form.name" class="form-input" placeholder="例如：设计部 AI 助手" />
        </div>
        <div>
          <label class="field-label">平台</label>
          <select v-model="form.platform" class="form-input">
            <option v-for="option in platformOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label class="field-label">外发 Webhook</label>
          <input
            v-model="form.webhookUrl"
            class="form-input"
            :placeholder="isEditing ? '留空保持不变' : 'https://...'"
          />
        </div>
        <div>
          <label class="field-label">签名密钥</label>
          <div class="relative flex items-center">
            <input
              v-model="form.secret"
              :type="showSecret ? 'text' : 'password'"
              class="form-input w-full pl-3 pr-9 py-2"
              :placeholder="isEditing ? '留空保持不变' : '可选'"
            />
            <button
              type="button"
              class="absolute right-2.5 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center p-1"
              style="background: transparent; border: none; cursor: pointer"
              @click="showSecret = !showSecret"
            >
              <Eye v-if="showSecret" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="isEditing"
        class="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <label
          class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300"
        >
          <input
            v-model="form.clearWebhookUrl"
            type="checkbox"
            class="rounded border-slate-300 text-slate-900"
          />
          清空 Webhook
        </label>
        <label
          class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300"
        >
          <input
            v-model="form.clearSecret"
            type="checkbox"
            class="rounded border-slate-300 text-slate-900"
          />
          清空密钥
        </label>
      </div>

      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_9rem]">
        <div>
          <label class="field-label">AI 模型</label>
          <select v-model="form.aiModelId" class="form-input">
            <option value="">跟随系统默认</option>
            <option v-for="model in modelOptions" :key="model.id" :value="model.id">
              {{ model.name }} · {{ model.provider }}/{{ model.modelName }}
            </option>
          </select>
          <p
            v-if="formSelectedModel"
            class="mt-1 truncate text-[11px] font-semibold text-slate-400"
          >
            {{ formSelectedModel.provider }} · {{ formSelectedModel.modelName }}
          </p>
        </div>
        <div>
          <label class="field-label">温度</label>
          <input
            v-model.number="form.aiTemperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            class="form-input"
            placeholder="默认"
          />
        </div>
        <div>
          <label class="field-label">最大输出</label>
          <input
            v-model.number="form.aiMaxTokens"
            type="number"
            min="256"
            max="32768"
            step="256"
            class="form-input"
            placeholder="默认"
          />
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)]">
        <div>
          <label class="field-label">状态</label>
          <select v-model="form.status" class="form-input">
            <option value="ACTIVE">启用</option>
            <option value="PAUSED">暂停</option>
          </select>
        </div>
        <div>
          <label class="field-label">触发关键词</label>
          <input v-model="form.triggerKeywords" class="form-input" placeholder="@AI, 帮我, /ai" />
        </div>
      </div>

      <div>
        <label class="field-label">处理模式</label>
        <select v-model="form.responseMode" class="form-input">
          <option v-for="option in responseModeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <p class="mt-1 text-[11px] font-semibold text-slate-400">
          {{ responseModeDescription(form.responseMode) }}
        </p>
      </div>

      <div>
        <label class="field-label">系统提示词</label>
        <textarea
          v-model="form.systemPrompt"
          class="form-textarea min-h-[11rem]"
          placeholder="定义机器人身份、回复风格、业务边界"
        ></textarea>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <el-button @click="emit('close')">取消</el-button>
        <el-button type="primary" :loading="isSaving" @click="emit('save')">
          <span class="inline-flex items-center gap-1.5">
            <Save class="h-4 w-4" />
            保存
          </span>
        </el-button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Sparkles, Clock } from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { generateTOTP } from '@/utils/totp';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps<{
  modelValue: boolean;
  allCategories: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'saved'): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const addForm = ref({
  label: '',
  email: '',
  secret: '',
  note: '',
  category: '',
});

const addSecretPreview = ref<string>('------');
const addSecretTimeLeft = ref<number>(0);
const secretValidationError = ref<string>('');

function getSecretStrength(secret: string): { label: string; color: string; percent: number } {
  const clean = secret.replace(/[\s=]/g, '');
  if (!clean) return { label: '无', color: '#94a3b8', percent: 0 };
  if (clean.length < 16) return { label: '弱', color: '#ef4444', percent: 33 };
  if (clean.length === 16) return { label: '中 (标准)', color: '#eab308', percent: 66 };
  return { label: '强 (高安全)', color: '#10b981', percent: 100 };
}

async function checkFormSecret() {
  const secretInput = addForm.value.secret.trim();
  if (!secretInput) {
    addSecretPreview.value = '------';
    addSecretTimeLeft.value = 0;
    secretValidationError.value = '';
    return;
  }

  const cleanSecret = secretInput.replace(/[\s=]/g, '').toUpperCase();
  const base32Regex = /^[A-Z2-7]+$/;
  if (!base32Regex.test(cleanSecret)) {
    secretValidationError.value = '无效的密钥格式（只允许 A-Z 和 2-7 的 Base32 编码字符）';
    addSecretPreview.value = '------';
    addSecretTimeLeft.value = 0;
    return;
  }

  secretValidationError.value = '';
  try {
    const preview = await generateTOTP(cleanSecret);
    addSecretPreview.value = preview.code;
    addSecretTimeLeft.value = preview.timeLeft;
  } catch {
    addSecretPreview.value = '------';
    addSecretTimeLeft.value = 0;
  }
}

async function submitAddAccount() {
  if (!addForm.value.label.trim()) {
    ElMessage.warning('请输入账号名称/标签');
    return;
  }
  if (!addForm.value.secret.trim()) {
    ElMessage.warning('请输入2FA密钥');
    return;
  }
  if (secretValidationError.value) {
    ElMessage.warning('2FA密钥格式有误，请修改后提交');
    return;
  }

  try {
    await api.post('/api/two-factor/accounts', addForm.value);
    ElMessage.success('2FA账号保存成功');
    visible.value = false;
    emit('saved');
    resetAddForm();
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '保存2FA账号失败'));
  }
}

function resetAddForm() {
  addForm.value = {
    label: '',
    email: '',
    secret: '',
    note: '',
    category: '',
  };
  addSecretPreview.value = '------';
  addSecretTimeLeft.value = 0;
  secretValidationError.value = '';
}

let previewTimer: NodeJS.Timeout | null = null;

function startPreviewTimer() {
  stopPreviewTimer();
  previewTimer = setInterval(async () => {
    if (visible.value && addForm.value.secret && !secretValidationError.value) {
      try {
        const preview = await generateTOTP(addForm.value.secret);
        addSecretPreview.value = preview.code;
        addSecretTimeLeft.value = preview.timeLeft;
      } catch {
        addSecretPreview.value = '------';
        addSecretTimeLeft.value = 0;
      }
    }
  }, 1000);
}

function stopPreviewTimer() {
  if (previewTimer) {
    clearInterval(previewTimer);
    previewTimer = null;
  }
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      startPreviewTimer();
    } else {
      stopPreviewTimer();
      resetAddForm();
    }
  },
);

onUnmounted(() => {
  stopPreviewTimer();
});
</script>

<template>
  <Modal :show="visible" title="安全添加 2FA 账号" size="md" @close="visible = false">
    <div class="space-y-4">
      <!-- Dialog instruction -->
      <div
        class="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 flex items-start gap-2.5 mb-2"
      >
        <Sparkles class="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
        <p class="text-xs leading-normal" style="color: var(--text-secondary)">
          请输入您的 2FA
          密钥。系统会在输入框下方即时生成验证码预览。添加成功后，将能够生成对应的手机端扫码图像。
        </p>
      </div>

      <!-- Form fields -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold" style="color: var(--text-secondary)"
          >账号名称 / 标签 *</label
        >
        <el-input
          v-model="addForm.label"
          placeholder="如: Github, Google, ChatGPT"
          class="custom-dialog-input"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold" style="color: var(--text-secondary)"
          >账号邮箱 / 用户名</label
        >
        <el-input
          v-model="addForm.email"
          placeholder="如: user@example.com (可选)"
          class="custom-dialog-input"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex justify-between items-center">
          <label class="text-xs font-bold" style="color: var(--text-secondary)">分类 / 分组</label>
          <span class="text-[9px] text-slate-500">用于分类过滤</span>
        </div>
        <el-select
          v-model="addForm.category"
          placeholder="点击选择分组，或输入新分组名称"
          class="custom-dialog-input w-full"
          filterable
          allow-create
          clearable
          default-first-option
        >
          <el-option v-for="cat in allCategories" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold" style="color: var(--text-secondary)"
          >2FA 密匙 (Base32 Key) *</label
        >
        <el-input
          v-model="addForm.secret"
          placeholder="支持包含空格，如: JBSW Y3DP EHPK 3PXP"
          class="custom-dialog-input"
          @input="checkFormSecret"
        />
        <span v-if="secretValidationError" class="text-[10px] text-rose-400 font-bold px-1 mt-0.5">
          {{ secretValidationError }}
        </span>
        <!-- Strength Indicator -->
        <div
          v-if="addForm.secret && !secretValidationError"
          class="flex items-center gap-2 px-1 mt-1"
        >
          <span class="text-[10px] text-slate-400">密钥强度:</span>
          <div class="h-1 w-20 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              class="h-full transition-all duration-300"
              :style="{
                width: `${getSecretStrength(addForm.secret).percent}%`,
                backgroundColor: getSecretStrength(addForm.secret).color,
              }"
            ></div>
          </div>
          <span
            class="text-[10px] font-bold"
            :style="{ color: getSecretStrength(addForm.secret).color }"
          >
            {{ getSecretStrength(addForm.secret).label }}
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold" style="color: var(--text-secondary)">备注说明</label>
        <el-input
          v-model="addForm.note"
          type="textarea"
          :rows="2"
          placeholder="如: 此处用于保存第三方网站认证备份密钥... (可选)"
          class="custom-dialog-input"
        />
      </div>

      <!-- Live Preview Code Block in Add modal -->
      <div
        v-if="addForm.secret && !secretValidationError"
        class="rounded-xl p-3.5 flex items-center justify-between border"
        style="background-color: var(--bg-app); border-color: var(--border-base)"
      >
        <div class="flex flex-col">
          <span
            class="text-[10px] font-bold uppercase tracking-widest"
            style="color: var(--text-muted)"
            >密钥格式正常 • 动态码预览</span
          >
          <span class="text-2xl font-black font-mono text-indigo-400 tracking-wider mt-0.5">
            {{ addSecretPreview.slice(0, 3) + ' ' + addSecretPreview.slice(3) }}
          </span>
        </div>
        <div
          class="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border"
          style="
            color: var(--text-secondary);
            background-color: var(--bg-card);
            border-color: var(--border-base);
          "
        >
          <Clock class="h-3.5 w-3.5 text-indigo-400" />
          更新倒计时: {{ addSecretTimeLeft }}秒
        </div>
      </div>
    </div>

    <template #footer>
      <el-button
        style="
          background-color: var(--bg-app);
          border: 1px solid var(--border-base);
          color: var(--text-secondary);
        "
        class="px-4 py-2 rounded-xl text-xs font-semibold"
        @click="visible = false"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        class="bg-indigo-600 hover:bg-indigo-500 border-none font-semibold px-5 py-2.5 rounded-xl transition-all"
        @click="submitAddAccount"
      >
        保存账号
      </el-button>
    </template>
  </Modal>
</template>

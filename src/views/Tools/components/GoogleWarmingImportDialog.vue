<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from '@/utils/feedbackBridge';
import { Sparkles, RefreshCw, Trash2 } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

interface GoogleAccount {
  id: string;
  email: string;
  password?: string;
  recoveryEmail?: string;
  twoFASecret?: string;
  country?: string;
  note?: string;
  backupCodes?: string;
  category?: string;
  status: 'warming' | 'completed' | 'paused';
  currentDay: number;
  lastWarmedAt?: string;
  createdAt: string;
}

const props = defineProps<{
  show: boolean;
  categoriesList: string[];
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'submit', accounts: Array<Partial<GoogleAccount>>): void;
}>();

const { t } = useI18n();

const importText = ref<string>('');
const parsedAccounts = ref<Array<Partial<GoogleAccount>>>([]);
const importDefaultCategory = ref<string>('未分类');
const autoTranslateCountry = ref<boolean>(true);
const isAiParsing = ref<boolean>(false);

// Watch default category change to update parsed accounts in preview in real-time
watch(importDefaultCategory, (newVal) => {
  if (newVal && parsedAccounts.value.length > 0) {
    parsedAccounts.value.forEach((acc) => {
      acc.category = newVal;
    });
  }
});

const reset = () => {
  importText.value = '';
  parsedAccounts.value = [];
  importDefaultCategory.value = '未分类';
  autoTranslateCountry.value = true;
};

const close = () => {
  emit('update:show', false);
};

const cancel = () => {
  reset();
  close();
};

const submit = () => {
  emit('submit', parsedAccounts.value);
  reset();
  close();
};

// Client-side auto-delimiter parse
const handleStandardParse = () => {
  if (!importText.value.trim()) {
    ElMessage.warning(t('tools.email.import_warning_empty'));
    return;
  }

  const lines = importText.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const tempParsed: Array<Partial<GoogleAccount>> = [];
  const delimiters = ['----', '|', '\t', ',', ';'];

  let bestDelimiter = '----';
  let maxParts = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find best delimiter for the first few lines
    if (i < 5) {
      for (const d of delimiters) {
        const parts = line.split(d);
        if (parts.length > maxParts) {
          maxParts = parts.length;
          bestDelimiter = d;
        }
      }
    }

    const parts = line.split(bestDelimiter).map((p) => p.trim());
    if (parts.length < 2) continue;

    const email = parts[0] || '';
    const password = parts[1] || '';
    const recoveryEmail = parts[2] || '';
    const twoFASecret = parts[3] || '';
    const country = parts[4] || '';
    let backupCodes = '';
    let note = '';
    let parsedCategory = '未分类';

    if (parts.length >= 8) {
      backupCodes = parts[5] || '';
      parsedCategory = parts[6] || '未分类';
      note = parts[7] || '';
    } else if (parts.length === 7) {
      backupCodes = parts[5] || '';
      note = parts[6] || '';
    } else if (parts.length === 6) {
      note = parts[5] || '';
    }

    tempParsed.push({
      email,
      password,
      recoveryEmail,
      twoFASecret,
      country,
      backupCodes,
      category:
        importDefaultCategory.value && importDefaultCategory.value !== '未分类'
          ? importDefaultCategory.value
          : parsedCategory,
      note,
      status: 'warming',
      currentDay: 1,
    });
  }

  if (tempParsed.length === 0) {
    ElMessage.error('快速解析失败，请检查分隔符');
  } else {
    parsedAccounts.value = tempParsed;
    ElMessage.success(
      `成功解析出 ${tempParsed.length} 个账号 (使用分隔符: "${bestDelimiter === '\t' ? '\\t' : bestDelimiter}")`,
    );
  }
};

// AI-based parsing
const handleAiParse = async () => {
  if (!importText.value.trim()) {
    ElMessage.warning(t('tools.email.import_warning_empty'));
    return;
  }

  isAiParsing.value = true;
  try {
    const res = await api.post('/api/google-warming/accounts/ai-parse', {
      text: importText.value,
      translateCountry: autoTranslateCountry.value,
    });
    if (res.data && res.data.success && Array.isArray(res.data.accounts)) {
      parsedAccounts.value = res.data.accounts.map((acc: Partial<GoogleAccount>) => ({
        ...acc,
        category:
          importDefaultCategory.value && importDefaultCategory.value !== '未分类'
            ? importDefaultCategory.value
            : acc.category || '未分类',
        status: acc.status || 'warming',
        currentDay: 1,
      }));
      ElMessage.success(`AI 智能解析成功，提取出 ${parsedAccounts.value.length} 个账号`);
    } else {
      throw new Error('AI 返回数据异常');
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, 'AI 解析失败，请重试或使用快速解析'));
  } finally {
    isAiParsing.value = false;
  }
};

const removeParsedAccount = (idx: number) => {
  parsedAccounts.value.splice(idx, 1);
};
</script>

<template>
  <Modal :show="props.show" :title="t('tools.googleWarming.bulkImport')" size="lg" @close="cancel">
    <div class="space-y-4">
      <div class="gw-import-hint">
        {{ t('tools.googleWarming.importPlaceholder') }}
      </div>

      <textarea
        v-model="importText"
        rows="6"
        placeholder="粘贴账号数据，每行一个..."
        class="gw-textarea"
      ></textarea>

      <div
        class="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
            {{ t('tools.googleWarming.importDefaultCategory') }}:
          </span>
          <Select
            v-model="importDefaultCategory"
            filterable
            allow-create
            default-first-option
            :placeholder="t('tools.googleWarming.defaultCategoryPlaceholder')"
            size="small"
            style="width: 160px"
            class="custom-dialog-input"
          >
            <SelectOption
              v-for="cat in categoriesList.filter((c) => c !== 'all')"
              :key="cat"
              :label="cat === '未分类' ? '未分类 (无分类)' : cat"
              :value="cat"
            />
          </Select>
          <span class="text-[11px] text-slate-400 dark:text-slate-500">
            {{ t('tools.googleWarming.realtimeApplyTip') }}
          </span>
        </div>

        <div class="flex items-center">
          <Checkbox v-model="autoTranslateCountry" size="small">
            {{ t('tools.googleWarming.autoTranslateCountry') }}
          </Checkbox>
        </div>
      </div>

      <div class="flex justify-between items-center gap-3">
        <div class="flex items-center gap-2">
          <button class="gw-btn-secondary text-xs cursor-pointer" @click="handleStandardParse">
            {{ t('tools.googleWarming.standardParseBtn') }}
          </button>
          <button
            :disabled="isAiParsing"
            class="flex items-center gap-1.5 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 dark:from-violet-600/30 dark:to-indigo-600/30 hover:from-violet-600/20 hover:to-indigo-600/20 dark:hover:from-violet-600/50 dark:hover:to-indigo-600/50 text-violet-700 dark:text-violet-400 text-xs px-3.5 py-2 rounded-lg border border-violet-500/30 dark:border-violet-500/20 transition-all cursor-pointer"
            @click="handleAiParse"
          >
            <Sparkles class="w-3.5 h-3.5" :class="{ 'animate-pulse': isAiParsing }" />
            {{ t('tools.googleWarming.aiParseBtn') }}
          </button>
        </div>

        <span
          v-if="isAiParsing"
          class="gw-muted-text text-xs flex items-center gap-1.5 animate-pulse"
        >
          <RefreshCw class="w-3.5 h-3.5 animate-spin" />
          AI 正在努力识别和解析格式，请稍候...
        </span>
      </div>

      <!-- Preview Table -->
      <div v-if="parsedAccounts.length > 0" class="space-y-3 pt-3 gw-border-top">
        <h4 class="gw-label-bold flex items-center justify-between">
          <span>解析预览 ({{ parsedAccounts.length }} 个账号)</span>
          <span class="gw-muted-text text-xs font-normal"
            >双击或直接修改单元格可以校正错误数据</span
          >
        </h4>

        <div class="mobile-table overflow-x-auto gw-table-wrapper">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="gw-table-head">
                <th class="p-3">邮箱</th>
                <th class="p-3">密码</th>
                <th class="p-3">辅助邮箱</th>
                <th class="p-3">2FA密钥</th>
                <th class="p-3">国家</th>
                <th class="p-3">备用密码</th>
                <th class="p-3">分类</th>
                <th class="p-3">状态</th>
                <th class="p-3">备注</th>
                <th class="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(acc, idx) in parsedAccounts" :key="idx" class="gw-table-row">
                <td class="p-2"><input v-model="acc.email" class="gw-table-input" /></td>
                <td class="p-2"><input v-model="acc.password" class="gw-table-input" /></td>
                <td class="p-2">
                  <input v-model="acc.recoveryEmail" class="gw-table-input" />
                </td>
                <td class="p-2"><input v-model="acc.twoFASecret" class="gw-table-input" /></td>
                <td class="p-2"><input v-model="acc.country" class="gw-table-input" /></td>
                <td class="p-2">
                  <input v-model="acc.backupCodes" class="gw-table-input" placeholder="备用密码" />
                </td>
                <td class="p-2">
                  <input v-model="acc.category" class="gw-table-input" placeholder="未分类" />
                </td>
                <td class="p-2">
                  <Select v-model="acc.status" size="small" class="w-24">
                    <SelectOption value="warming" label="养号中" />
                    <SelectOption value="completed" label="已毕业" />
                    <SelectOption value="paused" label="已暂停" />
                  </Select>
                </td>
                <td class="p-2"><input v-model="acc.note" class="gw-table-input" /></td>
                <td class="p-2 text-right">
                  <button
                    class="text-red-400 hover:text-red-300 p-1 transition-colors cursor-pointer"
                    @click="removeParsedAccount(idx)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-end gap-3 pt-3">
          <Button variant="secondary" size="sm" @click="cancel">
            {{ t('tools.googleWarming.cancel_btn') }}
          </Button>
          <Button variant="primary" size="sm" @click="submit">
            {{ t('tools.googleWarming.importConfirm', { count: parsedAccounts.length }) }}
          </Button>
        </div>
      </div>
    </div>
  </Modal>
</template>

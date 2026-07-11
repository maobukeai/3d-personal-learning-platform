<script setup lang="ts">
import { computed, ref } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import type { SingleAccountForm, EditAccountForm } from './email-types';

const showPassword = ref(false);

interface Props {
  show: boolean;
  isEdit: boolean;
  modelValue: SingleAccountForm | EditAccountForm;
  isLoading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: SingleAccountForm | EditAccountForm): void;
  (e: 'close'): void;
  (e: 'submit'): void;
}>();

const form = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});
</script>

<template>
  <Modal
    :show="show"
    :title="isEdit ? '编辑/更新微软邮箱账号' : $t('tools.email.add_single_title')"
    size="md"
    @close="$emit('close')"
  >
    <div class="flex flex-col gap-3.5 text-left">
      <!-- Email (Disabled in Edit Mode) -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-400">
          {{ isEdit ? '微软账号邮箱 (不可更改)' : '微软账号邮箱' }}
        </label>
        <input
          v-model="form.email"
          type="email"
          :disabled="isEdit"
          :placeholder="isEdit ? '' : 'example@outlook.com'"
          :class="[
            'text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none transition-all duration-200',
            isEdit
              ? 'bg-slate-100 dark:bg-slate-900/50 text-slate-400 cursor-not-allowed'
              : 'bg-slate-50 dark:bg-slate-900 focus:border-indigo-400 focus:bg-white',
          ]"
        />
      </div>

      <!-- Password -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-400">
          {{ $t('tools.email.email_pass_label') }}{{ isEdit ? ' (留空表示不修改)' : '' }}
        </label>
        <div class="relative flex items-center">
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            :placeholder="isEdit ? '留空表示不修改密码' : '微软网页登录密码'"
            class="w-full text-xs pl-3 pr-9 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
          />
          <button
            type="button"
            class="absolute right-3.5 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center p-1"
            style="background: transparent; border: none; cursor: pointer"
            @click="showPassword = !showPassword"
          >
            <Eye v-if="showPassword" class="w-4 h-4" />
            <EyeOff v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Client ID -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-400">OAuth Client ID</label>
        <input
          v-model="form.clientId"
          type="text"
          :placeholder="isEdit ? '输入 Client ID' : $t('tools.email.client_id_label')"
          class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
        />
      </div>

      <!-- Refresh Token -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-400">
          {{
            isEdit
              ? '刷新令牌 (Refresh Token) (留空表示不修改)'
              : $t('tools.email.refresh_token_label')
          }}
        </label>
        <input
          v-model="form.refreshToken"
          type="text"
          :placeholder="
            isEdit
              ? '留空表示不更新令牌，若已失效请输入新令牌'
              : $t('tools.email.import_textarea_placeholder')
          "
          class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
        />
      </div>

      <!-- Proxy -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-400">
          {{ $t('tools.email.single_proxy_label') }}
        </label>
        <input
          v-model="form.proxy"
          type="text"
          :placeholder="$t('tools.email.proxy_placeholder')"
          class="text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
        />
      </div>

      <!-- Limits & Delays -->
      <div class="grid grid-cols-3 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-semibold text-slate-400">
            {{ $t('tools.email.daily_limit_cap') }}
          </label>
          <Input-number
            v-model="form.dailyLimit"
            :min="1"
            :max="500"
            size="small"
            controls-position="right"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-semibold text-slate-400">
            {{ $t('tools.email.min_delay_sec') }}
          </label>
          <Input-number
            v-model="form.minDelay"
            :min="1"
            :max="60"
            size="small"
            controls-position="right"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-semibold text-slate-400">
            {{ $t('tools.email.max_delay_sec') }}
          </label>
          <Input-number
            v-model="form.maxDelay"
            :min="2"
            :max="300"
            size="small"
            controls-position="right"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="$emit('close')">取消</Button>
        <Button variant="primary" :loading="isLoading" size="sm" @click="$emit('submit')">
          {{ isEdit ? '保存更改' : $t('tools.email.save_activate_btn') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

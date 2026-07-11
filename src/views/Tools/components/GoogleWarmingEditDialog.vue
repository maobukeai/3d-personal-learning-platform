<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

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

const props = withDefaults(
  defineProps<{
    show: boolean;
    account: Partial<GoogleAccount>;
    categoriesList?: string[];
  }>(),
  {
    categoriesList: () => [],
  },
);

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:account', value: Partial<GoogleAccount>): void;
  (e: 'save'): void;
  (e: 'generate-password', account: Partial<GoogleAccount>): void;
}>();

const { t } = useI18n();

const updateField = <K extends keyof GoogleAccount>(field: K, value: GoogleAccount[K]) => {
  emit('update:account', { ...props.account, [field]: value });
};

const close = () => {
  emit('update:show', false);
};
</script>

<template>
  <Modal
    :show="props.show"
    :title="t('tools.googleWarming.editAccountTitle')"
    size="md"
    @close="close"
  >
    <div class="space-y-2.5">
      <div class="gw-field !gap-1">
        <label class="gw-field-label !text-[10px]">邮箱账号</label>
        <input
          :value="account.email"
          type="text"
          class="gw-input !py-1.5 !text-xs"
          @input="updateField('email', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="gw-field !gap-1">
          <div class="flex items-center justify-between w-full">
            <label class="gw-field-label !text-[10px]">密码</label>
            <button
              type="button"
              class="text-[9px] text-violet-600 dark:text-violet-400 hover:text-violet-500 font-semibold cursor-pointer border-none bg-transparent"
              @click="emit('generate-password', account)"
            >
              一键生成复杂密码
            </button>
          </div>
          <input
            :value="account.password"
            type="text"
            class="gw-input !py-1.5 !text-xs"
            @input="updateField('password', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="gw-field !gap-1">
          <label class="gw-field-label !text-[10px]">辅助邮箱</label>
          <input
            :value="account.recoveryEmail"
            type="text"
            class="gw-input !py-1.5 !text-xs"
            @input="updateField('recoveryEmail', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="gw-field !gap-1">
        <label class="gw-field-label !text-[10px]">2FA 密钥</label>
        <input
          :value="account.twoFASecret"
          type="text"
          class="gw-input !py-1.5 !text-xs font-mono"
          @input="updateField('twoFASecret', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="gw-field !gap-1">
        <label class="gw-field-label !text-[10px]">备用密码 (空格分隔的8位验证码)</label>
        <input
          :value="account.backupCodes"
          type="text"
          class="gw-input !py-1.5 !text-xs font-mono"
          placeholder="例如: 3191 6344 6829 7625..."
          @input="updateField('backupCodes', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div class="gw-field !gap-1">
          <label class="gw-field-label !text-[10px]">国家地区</label>
          <input
            :value="account.country"
            type="text"
            class="gw-input !py-1.5 !text-xs"
            @input="updateField('country', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="gw-field !gap-1">
          <label class="gw-field-label !text-[10px]">当前天数</label>
          <input
            :value="account.currentDay"
            type="number"
            min="1"
            max="14"
            class="gw-input !py-1.5 !text-xs"
            @input="updateField('currentDay', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="gw-field !gap-1 text-left flex flex-col">
          <label class="gw-field-label !text-[10px]">分类</label>
          <Select
            :model-value="account.category || '未分类'"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入新分类"
            size="small"
            class="w-full custom-dialog-input"
            @change="updateField('category', $event)"
          >
            <SelectOption
              v-for="cat in (categoriesList || []).filter((c) => c !== 'all')"
              :key="cat"
              :label="cat === '未分类' ? '未分类' : cat"
              :value="cat"
            />
          </Select>
        </div>
        <div class="gw-field !gap-1 text-left flex flex-col">
          <label class="gw-field-label !text-[10px]">状态</label>
          <Select
            :model-value="account.status"
            placeholder="选择状态"
            size="small"
            class="w-full custom-dialog-input"
            @change="updateField('status', $event as GoogleAccount['status'])"
          >
            <SelectOption value="warming" label="养号中" />
            <SelectOption value="completed" label="已毕业" />
            <SelectOption value="paused" label="已暂停" />
          </Select>
        </div>
        <div class="gw-field col-span-2 !gap-1">
          <label class="gw-field-label !text-[10px]">备注/描述</label>
          <input
            :value="account.note"
            type="text"
            class="gw-input !py-1.5 !text-xs"
            @input="updateField('note', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2 gw-border-top">
        <Button variant="secondary" size="sm" @click="close">
          {{ t('tools.googleWarming.cancel_btn') }}
        </Button>
        <Button variant="primary" size="sm" @click="emit('save')"> 保存修改 </Button>
      </div>
    </div>
  </Modal>
</template>

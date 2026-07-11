<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AdminUser, AdminSubscriptionPlan } from '../UsersView.vue';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps<{
  modelValue: boolean;
  user: AdminUser | null;
  plans: AdminSubscriptionPlan[];
  isSubLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (
    e: 'submit',
    form: {
      planId: string;
      interval: string;
      endDate: string;
      status: string;
    },
  ): void;
  (e: 'cancel-sub'): void;
}>();

const subForm = ref({
  planId: '',
  interval: 'MONTHLY',
  endDate: '',
  status: 'ACTIVE',
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      subForm.value = props.user?.subscription
        ? {
            planId: props.user.subscription.planId,
            interval: props.user.subscription.interval || 'MONTHLY',
            endDate: props.user.subscription.endDate
              ? new Date(props.user.subscription.endDate).toISOString().split('T')[0] || ''
              : '',
            status: props.user.subscription.status || 'ACTIVE',
          }
        : {
            planId: props.plans[0]?.id || '',
            interval: 'MONTHLY',
            endDate: '',
            status: 'ACTIVE',
          };
    }
  },
);

const handleSave = () => {
  emit('submit', { ...subForm.value });
};
</script>

<template>
  <Modal :show="modelValue" title="订阅管理" size="md" @close="emit('update:modelValue', false)">
    <Form label-position="top">
      <FormItem label="用户">
        <Input :model-value="user?.email || ''" disabled />
      </FormItem>
      <FormItem label="订阅计划">
        <Select v-model="subForm.planId" class="full-width" placeholder="选择订阅计划">
          <SelectOption
            v-for="plan in plans"
            :key="plan.id"
            :label="plan.displayName || plan.name"
            :value="plan.id"
          />
        </Select>
      </FormItem>
      <FormItem label="周期">
        <Select v-model="subForm.interval" class="full-width">
          <SelectOption label="月付" value="MONTHLY" />
          <SelectOption label="年付" value="YEARLY" />
        </Select>
      </FormItem>
      <FormItem label="状态">
        <Select v-model="subForm.status" class="full-width">
          <SelectOption label="生效中" value="ACTIVE" />
          <SelectOption label="已暂停" value="PAUSED" />
          <SelectOption label="已取消" value="CANCELED" />
          <SelectOption label="已过期" value="EXPIRED" />
        </Select>
      </FormItem>
      <FormItem label="到期日期">
        <DatePicker
          v-model="subForm.endDate"
          class="full-width"
          placeholder="不填则长期有效"
          type="date"
          value-format="YYYY-MM-DD"
        />
      </FormItem>
    </Form>
    <template #footer>
      <Button v-if="user?.subscription" variant="danger" plain @click="emit('cancel-sub')">
        取消订阅
      </Button>
      <Button @click="emit('update:modelValue', false)">关闭</Button>
      <Button variant="primary" :loading="isSubLoading" @click="handleSave"> 保存订阅 </Button>
    </template>
  </Modal>
</template>

<style scoped>
.full-width {
  width: 100%;
}
</style>

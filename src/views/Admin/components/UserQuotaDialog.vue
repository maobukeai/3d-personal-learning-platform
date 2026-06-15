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
    <el-form label-position="top">
      <el-form-item label="用户">
        <el-input :model-value="user?.email || ''" disabled />
      </el-form-item>
      <el-form-item label="订阅计划">
        <el-select v-model="subForm.planId" class="full-width" placeholder="选择订阅计划">
          <el-option
            v-for="plan in plans"
            :key="plan.id"
            :label="plan.displayName || plan.name"
            :value="plan.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="周期">
        <el-select v-model="subForm.interval" class="full-width">
          <el-option label="月付" value="MONTHLY" />
          <el-option label="年付" value="YEARLY" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="subForm.status" class="full-width">
          <el-option label="生效中" value="ACTIVE" />
          <el-option label="已暂停" value="PAUSED" />
          <el-option label="已取消" value="CANCELED" />
          <el-option label="已过期" value="EXPIRED" />
        </el-select>
      </el-form-item>
      <el-form-item label="到期日期">
        <el-date-picker
          v-model="subForm.endDate"
          class="full-width"
          placeholder="不填则长期有效"
          type="date"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button v-if="user?.subscription" type="danger" plain @click="emit('cancel-sub')">
        取消订阅
      </el-button>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      <el-button type="primary" :loading="isSubLoading" @click="handleSave"> 保存订阅 </el-button>
    </template>
  </Modal>
</template>

<style scoped>
.full-width {
  width: 100%;
}
</style>

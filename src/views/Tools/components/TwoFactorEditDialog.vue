<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import type { TwoFactorAccount } from '@/types';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps<{
  modelValue: boolean;
  allCategories: string[];
  account: TwoFactorAccount | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'saved'): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const editForm = ref({
  id: '',
  label: '',
  email: '',
  note: '',
  category: '',
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && props.account) {
      editForm.value = {
        id: props.account.id,
        label: props.account.label,
        email: props.account.email || '',
        note: props.account.note || '',
        category: props.account.category || '',
      };
    }
  },
);

async function submitEditAccount() {
  if (!editForm.value.label.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }

  try {
    await api.put(`/api/two-factor/accounts/${editForm.value.id}`, editForm.value);
    ElMessage.success('2FA记录更新成功');
    visible.value = false;
    emit('saved');
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '更新2FA记录失败'));
  }
}
</script>

<template>
  <Modal :show="visible" title="修改 2FA 备注信息" size="md" @close="visible = false">
    <div class="space-y-4">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold" style="color: var(--text-secondary)"
          >账号名称 / 标签 *</label
        >
        <el-input
          v-model="editForm.label"
          placeholder="如: Github, Google"
          class="custom-dialog-input"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-bold" style="color: var(--text-secondary)"
          >账号邮箱 / 用户名</label
        >
        <el-input
          v-model="editForm.email"
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
          v-model="editForm.category"
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
        <label class="text-xs font-bold" style="color: var(--text-secondary)">备注说明</label>
        <el-input
          v-model="editForm.note"
          type="textarea"
          :rows="3"
          placeholder="在此添加账号备注描述..."
          class="custom-dialog-input"
        />
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
        @click="submitEditAccount"
      >
        保存修改
      </el-button>
    </template>
  </Modal>
</template>

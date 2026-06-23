<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue';
import UiButton from '@/components/ui/Button.vue';
import type { AdminTeamUser } from './adminTeamsTypes';
import { ownerName } from './adminTeamsUtils';

const props = defineProps<{
  modelValue: boolean;
  availableUsers: AdminTeamUser[];
  selectedUserId: string;
  selectedMemberRole: 'ADMIN' | 'MEMBER';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:selectedUserId', value: string): void;
  (e: 'update:selectedMemberRole', value: 'ADMIN' | 'MEMBER'): void;
  (e: 'add'): void;
}>();
</script>

<template>
  <Modal
    :show="props.modelValue"
    title="添加团队成员"
    size="sm"
    @close="emit('update:modelValue', false)"
  >
    <div class="form-stack">
      <label>
        用户
        <select
          :value="props.selectedUserId"
          @change="emit('update:selectedUserId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">请选择用户</option>
          <option v-for="user in props.availableUsers" :key="user.id" :value="user.id">
            {{ ownerName(user) }}（{{ user.email }}）
          </option>
        </select>
      </label>
      <label>
        角色
        <select
          :value="props.selectedMemberRole"
          @change="
            emit(
              'update:selectedMemberRole',
              ($event.target as HTMLSelectElement).value as 'ADMIN' | 'MEMBER',
            )
          "
        >
          <option value="MEMBER">成员</option>
          <option value="ADMIN">管理员</option>
        </select>
      </label>
    </div>
    <template #footer>
      <UiButton variant="secondary" class="ml-2" @click="emit('update:modelValue', false)">
        取消
      </UiButton>
      <UiButton
        variant="primary"
        class="ml-2"
        :disabled="!props.selectedUserId"
        @click="emit('add')"
      >
        添加
      </UiButton>
    </template>
  </Modal>
</template>

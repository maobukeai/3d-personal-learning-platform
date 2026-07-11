<script setup lang="ts">
import { computed } from 'vue';
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

const userId = computed({
  get: () => props.selectedUserId,
  set: (val) => emit('update:selectedUserId', val || ''),
});

const memberRole = computed({
  get: () => props.selectedMemberRole,
  set: (val) => emit('update:selectedMemberRole', (val || 'MEMBER') as 'ADMIN' | 'MEMBER'),
});
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
        <Select v-model="userId" class="w-full mt-1.5" size="large">
          <SelectOption value="" label="请选择用户" />
          <SelectOption
            v-for="user in props.availableUsers"
            :key="user.id"
            :value="user.id"
            :label="`${ownerName(user)}（${user.email}）`"
          />
        </Select>
      </label>
      <label>
        角色
        <Select v-model="memberRole" class="w-full mt-1.5" size="large">
          <SelectOption value="MEMBER" label="成员" />
          <SelectOption value="ADMIN" label="管理员" />
        </Select>
      </label>
    </div>
    <template #footer>
      <UiButton variant="secondary" size="md" @click="emit('update:modelValue', false)">
        取消
      </UiButton>
      <UiButton variant="primary" size="md" @click="emit('add')">确定</UiButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AdminTeam, AdminTeamUser, TeamVisibility } from './adminTeamsTypes';
import FormDialog from '@/components/FormDialog.vue';

const props = defineProps<{
  modelValue: boolean;
  mode: 'create' | 'edit';
  team: AdminTeam | null;
  users: AdminTeamUser[];
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (
    e: 'submit',
    form: {
      id: string;
      name: string;
      description: string;
      avatarUrl: string;
      coverUrl: string;
      visibility: TeamVisibility;
      category: string;
      ownerId: string;
    },
  ): void;
}>();

const form = ref({
  id: '',
  name: '',
  description: '',
  avatarUrl: '',
  coverUrl: '',
  visibility: 'PRIVATE' as TeamVisibility,
  category: '',
  ownerId: '',
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      if (props.mode === 'edit' && props.team) {
        form.value = {
          id: props.team.id,
          name: props.team.name,
          description: props.team.description || '',
          avatarUrl: props.team.avatarUrl || '',
          coverUrl: props.team.coverUrl || '',
          visibility: props.team.visibility || 'PRIVATE',
          category: props.team.category || '',
          ownerId: props.team.ownerId,
        };
      } else {
        form.value = {
          id: '',
          name: '',
          description: '',
          avatarUrl: '',
          coverUrl: '',
          visibility: 'PRIVATE',
          category: '',
          ownerId: props.users[0]?.id || '',
        };
      }
    }
  },
);

const ownerName = (user?: AdminTeamUser | null) => user?.name || user?.email || '未指定';

const handleSave = () => {
  emit('submit', { ...form.value });
};
</script>

<template>
  <FormDialog
    :visible="modelValue"
    :title="mode === 'create' ? '新建团队' : '编辑团队'"
    :loading="isSubmitting"
    @update:visible="emit('update:modelValue', $event)"
    @cancel="emit('update:modelValue', false)"
    @submit="handleSave"
  >
    <div class="form-stack">
      <label>团队名称<input v-model="form.name" placeholder="例如：角色资产制作组" /></label>
      <label>
        负责人
        <select v-model="form.ownerId">
          <option v-for="user in users" :key="user.id" :value="user.id">
            {{ ownerName(user) }}（{{ user.email }}）
          </option>
        </select>
      </label>
      <div class="form-grid mobile-grid">
        <label>
          可见性
          <select v-model="form.visibility">
            <option value="PRIVATE">私有</option>
            <option value="PUBLIC">公开</option>
          </select>
        </label>
        <label>分类<input v-model="form.category" placeholder="建模 / 材质 / 教学" /></label>
      </div>
      <label>头像 URL<input v-model="form.avatarUrl" placeholder="https://..." /></label>
      <label>封面 URL<input v-model="form.coverUrl" placeholder="https://..." /></label>
      <label
        >描述<textarea
          v-model="form.description"
          rows="4"
          placeholder="团队职责、协作范围、审核要求"
        />
      </label>
    </div>
  </FormDialog>
</template>

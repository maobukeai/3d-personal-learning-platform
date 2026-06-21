<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AdminTeam, AdminTeamUser, TeamVisibility } from '../AdminTeamsView.vue';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

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
  <Modal
    :show="modelValue"
    :title="mode === 'create' ? '新建团队' : '编辑团队'"
    size="md"
    glass-card
    @close="emit('update:modelValue', false)"
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
      <div class="form-grid">
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
    <template #footer>
      <div class="flex items-center gap-3">
        <Button variant="secondary" @click="emit('update:modelValue', false)">取消</Button>
        <Button variant="primary" :loading="isSubmitting" @click="handleSave">保存</Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.form-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-stack label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}

.form-stack input,
.form-stack select,
.form-stack textarea {
  width: 100%;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  outline: none;
  font-size: 13px;
  transition: all 0.2s ease;
}

/* Specific background adjustment for theme compatibility */
html:not(.dark) .form-stack input,
html:not(.dark) .form-stack select,
html:not(.dark) .form-stack textarea {
  background: rgba(0, 0, 0, 0.02);
  border-color: rgba(0, 0, 0, 0.08);
}

.form-stack input:hover,
.form-stack select:hover,
.form-stack textarea:hover {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.08);
}

html:not(.dark) .form-stack input:hover,
html:not(.dark) .form-stack select:hover,
html:not(.dark) .form-stack textarea:hover {
  background: rgba(0, 0, 0, 0.04);
}

.form-stack input:focus,
.form-stack select:focus,
.form-stack textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb, 59, 130, 246), 0.2);
  background: rgba(255, 255, 255, 0.08);
}

html:not(.dark) .form-stack input:focus,
html:not(.dark) .form-stack select:focus,
html:not(.dark) .form-stack textarea:focus {
  background: rgba(0, 0, 0, 0.04);
}

.form-stack textarea {
  padding: 8px 12px;
  resize: vertical;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>

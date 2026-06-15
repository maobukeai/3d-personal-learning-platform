<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Users } from 'lucide-vue-next';
import api from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import type { User } from '@/types';

type TeamMemberResponse = {
  user: User;
};

const props = defineProps<{
  projectId: string;
  teamId: string;
  existingMemberIds: string[];
}>();

const emit = defineEmits<{
  (e: 'invited'): void;
}>();

const visible = ref(false);
const inviteUserIds = ref<string[]>([]);
const teamMembersForInvite = ref<User[]>([]);
const loading = ref(false);

const open = async () => {
  inviteUserIds.value = [];
  teamMembersForInvite.value = [];
  visible.value = true;
  if (!props.teamId) return;
  loading.value = true;
  try {
    const response = await api.get(`/api/teams/${props.teamId}/members`);
    const members = (response.data || []) as TeamMemberResponse[];
    const allMembers = members.map((m) => m.user);
    const filterSet = new Set(props.existingMemberIds);
    teamMembersForInvite.value = allMembers.filter((m) => !filterSet.has(m.id));
  } catch {
    // silently fail
  } finally {
    loading.value = false;
  }
};

const handleInviteMembers = async () => {
  if (!inviteUserIds.value.length) return;
  try {
    await api.post(`/api/projects/${props.projectId}/invite`, { userIds: inviteUserIds.value });
    ElMessage.success(`已发送 ${inviteUserIds.value.length} 份邀请`);
    visible.value = false;
    emit('invited');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '邀请失败'));
  }
};

defineExpose({ open });
</script>

<template>
  <Modal :show="visible" title="邀请加入项目" size="md" @close="visible = false">
    <div class="space-y-4">
      <div v-if="loading" class="text-center py-8">
        <div
          class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"
        ></div>
      </div>
      <div v-else-if="teamMembersForInvite.length === 0" class="text-center py-8 text-slate-400">
        <Users class="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p class="text-sm font-bold">团队中所有成员都已在此项目中</p>
      </div>
      <div v-else>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
          >选择要邀请的成员</label
        >
        <el-select
          v-model="inviteUserIds"
          multiple
          placeholder="选择成员"
          class="!w-full custom-select"
        >
          <el-option
            v-for="m in teamMembersForInvite"
            :key="m.id"
            :label="m.name || m.email"
            :value="m.id"
          >
            <div class="flex items-center gap-3">
              <UserAvatar :user="m" size="xs" />
              <span class="font-bold text-xs sm:text-sm">{{ m.name || m.email }}</span>
            </div>
          </el-option>
        </el-select>
      </div>
    </div>
    <template #footer>
      <div class="flex gap-4">
        <Button variant="secondary" class="flex-1" @click="visible = false"> 取消 </Button>
        <Button
          variant="primary"
          :disabled="inviteUserIds.length === 0 || loading"
          class="flex-[2]"
          @click="handleInviteMembers"
        >
          发送邀请
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.custom-select :deep(.el-select__wrapper) {
  border-radius: 1rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  height: 52px;
  transition: all 0.2s ease !important;
}
.dark .custom-select :deep(.el-select__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-select :deep(.el-select__wrapper.is-focused) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}
</style>

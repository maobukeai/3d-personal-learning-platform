<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Users, X } from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';

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
const teamMembersForInvite = ref<any[]>([]);
const loading = ref(false);

const open = async () => {
  inviteUserIds.value = [];
  teamMembersForInvite.value = [];
  visible.value = true;
  if (!props.teamId) return;
  loading.value = true;
  try {
    const response = await api.get(`/api/teams/${props.teamId}/members`);
    const allMembers = response.data?.map((m: any) => m.user) || [];
    const filterSet = new Set(props.existingMemberIds);
    teamMembersForInvite.value = allMembers.filter((m: any) => !filterSet.has(m.id));
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
  <el-dialog
    v-model="visible"
    title="邀请成员"
    width="440px"
    class="custom-dialog"
    :show-close="false"
  >
    <template #header="{ close }">
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
          邀请加入项目
        </h3>
        <button type="button" class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all cursor-pointer" @click="close">
          <X class="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </template>
    <div class="space-y-4">
      <div v-if="loading" class="text-center py-8 text-slate-400">
        <el-icon class="is-loading" :size="24"><Loading /></el-icon>
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
              <span class="font-bold">{{ m.name || m.email }}</span>
            </div>
          </el-option>
        </el-select>
      </div>
    </div>
    <template #footer>
      <div class="flex gap-4">
        <button type="button" class="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl font-black transition-all cursor-pointer" style="color: var(--text-primary)" @click="visible = false">
          取消
        </button>
        <button type="button" :disabled="inviteUserIds.length === 0 || loading" class="flex-[2] py-3 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer" @click="handleInviteMembers">
          发送邀请
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
:deep(.custom-dialog) {
  border-radius: 1.5rem !important;
}
.custom-select :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 52px;
}
</style>

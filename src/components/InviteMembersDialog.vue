<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Users, Loader2 } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import UserAvatar from '@/components/UserAvatar.vue';

interface UserItem {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface Props {
  visible: boolean;
  loading?: boolean;
  users: UserItem[];
  title?: string;
  placeholder?: string;
  emptyText?: string;
  confirmText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  title: '',
  placeholder: '',
  emptyText: '',
  confirmText: '',
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', userIds: string[]): void;
}>();

const { t } = useI18n();

const selectedUserIds = ref<string[]>([]);

watch(
  () => props.visible,
  (isOpen) => {
    if (isOpen) {
      selectedUserIds.value = [];
    }
  },
);

const handleClose = () => {
  emit('update:visible', false);
};

const handleSubmit = () => {
  if (selectedUserIds.value.length === 0) return;
  emit('submit', selectedUserIds.value);
  selectedUserIds.value = [];
};
</script>

<template>
  <Modal :show="visible" size="sm" @close="handleClose">
    <template #header>
      <h3 class="text-lg sm:text-xl font-bold" style="color: var(--text-primary)">
        {{ title || t('projects.inviteMembersTitle') || '邀请加入项目' }}
      </h3>
    </template>

    <div class="space-y-4 text-left mobile-adaptive">
      <div v-if="loading" class="text-center py-8">
        <Loader2 class="w-8 h-8 text-accent animate-spin mx-auto" />
      </div>

      <div v-else-if="users.length === 0" class="text-center py-6 text-slate-400">
        <Users class="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p class="text-xs font-bold">
          {{ emptyText || t('projects.noOtherMembersToInvite') || '暂无其他可邀请的成员' }}
        </p>
      </div>

      <div v-else>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
        >
          {{ t('projects.selectTeamMembers') || '选择成员' }}
        </label>
        <Select
          v-model="selectedUserIds"
          multiple
          :placeholder="placeholder || t('projects.selectMember') || '选择要邀请的成员'"
          class="!w-full custom-select"
        >
          <SelectOption
            v-for="m in users"
            :key="m.id"
            :label="m.name || m.email || ''"
            :value="m.id"
          >
            <div class="flex items-center gap-3">
              <UserAvatar :user="m" size="xs" />
              <span class="font-bold text-xs sm:text-sm">{{ m.name || m.email }}</span>
            </div>
          </SelectOption>
        </Select>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-4 w-full justify-end">
        <Button variant="secondary" class="text-xs sm:text-sm flex-1" @click="handleClose">
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="primary"
          class="text-xs sm:text-sm flex-[2]"
          :disabled="selectedUserIds.length === 0 || loading"
          @click="handleSubmit"
        >
          {{ confirmText || t('projects.sendInvite') || '发送邀请' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped></style>

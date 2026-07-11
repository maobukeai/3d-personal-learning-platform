<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';
import FormDialog from '@/components/FormDialog.vue';
import type { UserRole, UserStatus, AdminUser } from '../UsersView.vue';

interface Props {
  user: AdminUser | null;
  isSubmitting: boolean;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('modelValue', { required: true });

const isEdit = computed(() => !!props.user);
const showPassword = ref(false);

const form = ref({
  id: '',
  name: '',
  email: '',
  password: '',
  role: 'USER' as UserRole,
  status: 'ACTIVE' as UserStatus,
});

watch(visible, (newVal) => {
  if (newVal) {
    showPassword.value = false;
    if (props.user) {
      form.value = {
        id: props.user.id || '',
        name: props.user.name || '',
        email: props.user.email || '',
        password: '',
        role: props.user.role || 'USER',
        status: props.user.status || 'ACTIVE',
      };
    } else {
      form.value = {
        id: '',
        name: '',
        email: '',
        password: '',
        role: 'USER',
        status: 'ACTIVE',
      };
    }
  }
});

const emit = defineEmits<{
  (e: 'submit', payload: any): void;
}>();

const handleSubmit = () => {
  if (isEdit.value) {
    emit('submit', { ...form.value });
  } else {
    emit('submit', {
      name: form.value.name,
      email: form.value.email,
      password: form.value.password,
      role: form.value.role,
    });
  }
};
</script>

<template>
  <FormDialog
    :visible="visible"
    :title="isEdit ? '编辑用户' : '新建用户'"
    :loading="props.isSubmitting"
    :confirm-text="isEdit ? 'common.save' : '创建'"
    @update:visible="visible = $event"
    @cancel="visible = false"
    @submit="handleSubmit"
  >
    <div class="form-stack">
      <label>
        姓名
        <input v-model="form.name" placeholder="用户昵称或真实姓名" />
      </label>
      <label>
        邮箱
        <input v-model="form.email" placeholder="user@example.com" type="email" />
      </label>

      <!-- Password field (only during creation) -->
      <label v-if="!isEdit">
        初始密码
        <div class="relative flex items-center">
          <input
            v-model="form.password"
            placeholder="至少 6 位"
            :type="showPassword ? 'text' : 'password'"
          />
          <button
            type="button"
            class="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center border-none bg-transparent cursor-pointer"
            @click="showPassword = !showPassword"
          >
            <component :is="showPassword ? EyeOff : Eye" class="w-4.5 h-4.5" />
          </button>
        </div>
      </label>

      <label>
        角色
        <Select v-model="form.role" class="w-full mt-1.5" size="large">
          <SelectOption value="USER" label="普通用户" />
          <SelectOption value="INSTRUCTOR" label="导师" />
          <SelectOption value="ADMIN" label="管理员" />
        </Select>
      </label>

      <!-- Status field (only during editing) -->
      <label v-if="isEdit">
        状态
        <Select v-model="form.status" class="w-full mt-1.5" size="large">
          <SelectOption value="ACTIVE" label="正常" />
          <SelectOption value="BANNED" label="封禁" />
        </Select>
      </label>
    </div>
  </FormDialog>
</template>

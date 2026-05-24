<script setup lang="ts">
import { reactive, watch } from 'vue';
import { Globe, UserPlus, Lock } from 'lucide-vue-next';
import { ElMessageBox } from 'element-plus';

const props = defineProps<{
  settings: {
    PLATFORM_NAME: string;
    DEFAULT_USER_ROLE: string;
    ALLOW_REGISTRATION: boolean;
    MAINTENANCE_MODE: boolean;
  };
}>();

const emit = defineEmits<{
  (e: 'update:settings', val: typeof props.settings): void;
}>();

const localSettings = reactive({ ...props.settings });

watch(
  () => props.settings,
  (newVal) => {
    Object.assign(localSettings, newVal);
  },
  { deep: true }
);

watch(
  localSettings,
  (newVal) => {
    emit('update:settings', { ...props.settings, ...newVal });
  },
  { deep: true }
);

const defaultRoleOptions = [
  { label: '普通用户', value: 'USER' },
  { label: '讲师', value: 'INSTRUCTOR' },
];

const handleToggleMaintenance = async (val: string | number | boolean) => {
  if (val) {
    try {
      await ElMessageBox.confirm(
        '开启维护模式后，所有非管理员用户将无法访问平台。确定要开启吗？',
        '确认开启维护模式',
        {
          confirmButtonText: '确认开启',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger',
        },
      );
    } catch {
      localSettings.MAINTENANCE_MODE = false;
    }
  }
};
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <section
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 mb-8">
        <Globe class="w-5 h-5 text-indigo-600" />
        <h2 class="text-lg font-bold" style="color: var(--text-primary)">基础运营配置</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
            >平台显示名称</label
          >
          <input
            v-model="localSettings.PLATFORM_NAME"
            type="text"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>

        <div class="space-y-2">
          <label class="text-xs font-bold px-1" style="color: var(--text-secondary)"
            >新用户默认角色</label
          >
          <select
            v-model="localSettings.DEFAULT_USER_ROLE"
            class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all appearance-none cursor-pointer"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          >
            <option v-for="opt in defaultRoleOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="flex flex-col justify-center space-y-4 md:col-span-2">
          <div
            class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
          >
            <div class="flex items-center gap-3">
              <UserPlus class="w-4 h-4 text-emerald-500" />
              <div>
                <span class="text-xs font-bold" style="color: var(--text-primary)"
                  >允许新用户注册</span
                >
                <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                  关闭后仅管理员可创建新账号
                </p>
              </div>
            </div>
            <el-switch v-model="localSettings.ALLOW_REGISTRATION" active-color="#10b981" />
          </div>

          <div
            class="flex items-center justify-between p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all"
          >
            <div class="flex items-center gap-3">
              <Lock class="w-4 h-4 text-rose-500" />
              <div>
                <span class="text-xs font-bold" style="color: var(--text-primary)"
                  >维护模式</span
                >
                <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                  开启后仅管理员可登入平台
                </p>
              </div>
            </div>
            <el-switch
              v-model="localSettings.MAINTENANCE_MODE"
              active-color="#f43f5e"
              @change="handleToggleMaintenance"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { reactive, watch } from 'vue';
import { Shield, KeyRound, Clock, Sparkles, MonitorSmartphone } from 'lucide-vue-next';

const props = defineProps<{
  settings: {
    PASSWORD_MIN_LENGTH: string;
    SESSION_TIMEOUT: string;
    AUTO_APPROVE_MATERIALS: boolean;
    AUTO_APPROVE_SHOWCASES: boolean;
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
  { deep: true },
);

watch(
  localSettings,
  (newVal) => {
    emit('update:settings', { ...props.settings, ...newVal });
  },
  { deep: true },
);

const sessionTimeoutOptions = [
  { label: t('admin.1_day'), value: '1d' },
  { label: t('admin.3_days'), value: '3d' },
  { label: t('admin.7_days'), value: '7d' },
  { label: t('admin.30_days'), value: '30d' },
];
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <section
      class="p-4 sm:p-8 rounded-3xl border transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3 mb-8">
        <Shield class="w-5 h-5 text-blue-500" />
        <h2 class="text-lg font-bold" style="color: var(--text-primary)">
          {{ $t('admin.security_policy_configuration') }}
        </h2>
      </div>

      <div class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mobile-grid">
          <div class="space-y-2">
            <label
              class="text-xs font-bold px-1 flex items-center gap-2"
              style="color: var(--text-secondary)"
            >
              <KeyRound class="w-3.5 h-3.5" />
              密码最小长度
            </label>
            <input
              v-model="localSettings.PASSWORD_MIN_LENGTH"
              type="number"
              min="4"
              max="128"
              class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-bold px-1 flex items-center gap-2"
              style="color: var(--text-secondary)"
            >
              <Clock class="w-3.5 h-3.5" />
              会话超时时间
            </label>
            <select
              v-model="localSettings.SESSION_TIMEOUT"
              class="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-accent/20 outline-none transition-all appearance-none cursor-pointer"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option v-for="opt in sessionTimeoutOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <p class="text-[10px] px-1" style="color: var(--text-muted)">
              用户登录后保持登录状态的时间
            </p>
          </div>
        </div>

        <div class="space-y-4 pt-2">
          <div
            class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
          >
            <div class="flex items-center gap-3">
              <Sparkles class="w-4 h-4 text-violet-500" />
              <div>
                <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                  $t('admin.automatically_review_approved_materials')
                }}</span>
                <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                  开启后用户上传的材料无需人工审核即可发布
                </p>
              </div>
            </div>
            <el-switch v-model="localSettings.AUTO_APPROVE_MATERIALS" active-color="#8b5cf6" />
          </div>

          <div
            class="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-accent/20 transition-all"
          >
            <div class="flex items-center gap-3">
              <MonitorSmartphone class="w-4 h-4 text-cyan-500" />
              <div>
                <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                  $t('admin.automatically_review_and_pass')
                }}</span>
                <p class="text-[10px] mt-0.5" style="color: var(--text-muted)">
                  开启后用户发布的作品无需人工审核即可展示
                </p>
              </div>
            </div>
            <el-switch v-model="localSettings.AUTO_APPROVE_SHOWCASES" active-color="#06b6d4" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

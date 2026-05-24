<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Bell, ChevronRight } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import {
  defaultNotificationPreferences,
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '@/services/notification.service';

const { t } = useI18n();
const router = useRouter();

const notificationPrefs = ref(defaultNotificationPreferences());
const isSavingPrefs = ref(false);

const fetchNotificationPrefs = async () => {
  try {
    notificationPrefs.value = await fetchNotificationPreferences();
  } catch (error) {
    console.error('Fetch notification prefs error:', error);
  }
};

const saveNotificationPrefs = async () => {
  try {
    isSavingPrefs.value = true;
    await updateNotificationPreferences(notificationPrefs.value);
    ElMessage.success(t('settings.successSavePrefs'));
  } catch {
    ElMessage.error(t('settings.errorSavePrefs'));
  } finally {
    isSavingPrefs.value = false;
  }
};

onMounted(() => {
  fetchNotificationPrefs();
});
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="p-4 lg:p-8 rounded-2xl lg:rounded-3xl border border-accent/20 bg-accent/[0.02] flex items-center justify-between transition-all hover:bg-accent/[0.05]">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/20">
          <Bell class="w-6 h-6" />
        </div>
        <div>
          <h3 class="text-lg font-bold" style="color: var(--text-primary)">通知中心</h3>
          <p class="text-xs text-slate-500 mt-1">查看所有历史通知、系统消息 and 团队动态</p>
        </div>
      </div>
      <button type="button" class="flex items-center gap-2 px-6 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 hover:scale-105 transition-all" @click="router.push('/notifications')">
        进入通知中心
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>

    <div class="p-4 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3 mb-8">
        <div class="w-1.5 h-6 bg-accent rounded-full"></div>
        <h3 class="text-lg font-bold" style="color: var(--text-primary)">邮件通知</h3>
      </div>

      <div class="space-y-8">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-sm font-bold" style="color: var(--text-primary)">系统更新与公告</p>
            <p class="text-[11px]" style="color: var(--text-secondary)">接收关于平台新功能、维护计划的邮件。</p>
          </div>
          <el-switch v-model="notificationPrefs.emailSystemUpdates" active-color="var(--accent)" />
        </div>
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-sm font-bold" style="color: var(--text-primary)">团队活动通知</p>
            <p class="text-[11px]" style="color: var(--text-secondary)">当您的团队有新动态或任务分配时通知您。</p>
          </div>
          <el-switch v-model="notificationPrefs.emailTeamActivity" active-color="var(--accent)" />
        </div>
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-sm font-bold" style="color: var(--text-primary)">市场营销与活动</p>
            <p class="text-[11px]" style="color: var(--text-secondary)">接收关于特惠、研讨会及行业资讯的邮件。</p>
          </div>
          <el-switch v-model="notificationPrefs.emailMarketing" active-color="var(--accent)" />
        </div>
      </div>
    </div>

    <div class="p-4 lg:p-8 rounded-2xl lg:rounded-3xl border transition-colors duration-300" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-3 mb-8">
        <div class="w-1.5 h-6 bg-accent rounded-full"></div>
        <h3 class="text-lg font-bold" style="color: var(--text-primary)">推送通知</h3>
      </div>

      <div class="space-y-8">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-sm font-bold" style="color: var(--text-primary)">提及与回复</p>
            <p class="text-[11px]" style="color: var(--text-secondary)">当有人在讨论中提到您或回复您的内容时。</p>
          </div>
          <el-switch v-model="notificationPrefs.pushMentions" active-color="var(--accent)" />
        </div>
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-sm font-bold" style="color: var(--text-primary)">私信通知</p>
            <p class="text-[11px]" style="color: var(--text-secondary)">当您收到新的私信消息时。</p>
          </div>
          <el-switch v-model="notificationPrefs.pushDirectMessages" active-color="var(--accent)" />
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <button type="button" class="px-8 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 hover:scale-105 transition-all" :disabled="isSavingPrefs" @click="saveNotificationPrefs">
        {{ isSavingPrefs ? '保存中...' : '保存通知偏好' }}
      </button>
    </div>
  </div>
</template>

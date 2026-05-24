<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { MapPin, Globe, Camera } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';

const { t } = useI18n();
const authStore = useAuthStore();

const profileForm = ref({
  name: authStore.user?.name || '',
  bio: authStore.user?.bio || '',
  location: authStore.user?.location || '',
  website: authStore.user?.website || '',
});

watch(
  () => authStore.user,
  (newUser) => {
    if (newUser) {
      profileForm.value = {
        name: newUser.name || '',
        bio: newUser.bio || '',
        location: newUser.location || '',
        website: newUser.website || '',
      };
    }
  },
  { immediate: true }
);

const handleUpdateProfile = async () => {
  try {
    await authStore.updateProfile(profileForm.value);
    ElMessage.success(t('settings.successUpdate'));
  } catch {
    ElMessage.error('更新失败');
  }
};

const handleAvatarUpload = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    await authStore.uploadAvatar(file);
    ElMessage.success('头像已更新');
  } catch {
    ElMessage.error('头像上传失败');
  }
};
</script>

<template>
  <div class="space-y-8 lg:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-8 text-center lg:text-left">
      <label class="relative group/avatar-upload cursor-pointer block shrink-0">
        <UserAvatar :user="authStore.user" size="xl" />
        <div class="absolute inset-0 rounded-2xl bg-black/0 group-hover/avatar-upload:bg-black/40 transition-all duration-300 flex items-center justify-center z-10">
          <div class="opacity-0 group-hover/avatar-upload:opacity-100 transition-all duration-300 transform scale-75 group-hover/avatar-upload:scale-100 flex flex-col items-center gap-1">
            <Camera class="w-6 h-6 text-white drop-shadow-lg" />
            <span class="text-[10px] text-white font-bold drop-shadow-lg">更换头像</span>
          </div>
        </div>
        <input type="file" class="hidden" accept="image/*" @change="handleAvatarUpload" />
      </label>
      <div>
        <h2 class="text-xl font-bold" style="color: var(--text-primary)">
          {{ t('settings.profile') }}
        </h2>
        <p class="text-xs mt-1" style="color: var(--text-secondary)">
          点击头像即可更换，建议上传 500x500px 以上的 JPG 或 PNG 格式图片
        </p>
      </div>
    </div>

    <div class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">昵称</label>
          <input
            v-model="profileForm.name"
            type="text"
            class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
            style="
              background-color: var(--bg-card);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="space-y-2">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">所在地</label>
          <div class="relative">
            <MapPin class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="profileForm.location"
              type="text"
              class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-card);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="城市, 国家"
            />
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">个人简介</label>
        <textarea
          v-model="profileForm.bio"
          rows="4"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
          style="
            background-color: var(--bg-card);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
          placeholder="向大家介绍一下你自己吧..."
        ></textarea>
      </div>

      <div class="space-y-2">
        <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">个人主页/作品集</label>
        <div class="relative">
          <Globe class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="profileForm.website"
            type="text"
            class="w-full pl-11 pr-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
            style="
              background-color: var(--bg-card);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
            placeholder="https://yourportfolio.com"
          />
        </div>
      </div>

      <div class="pt-4">
        <button type="button" class="px-8 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 hover:scale-105 transition-all" @click="handleUpdateProfile">
          {{ t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

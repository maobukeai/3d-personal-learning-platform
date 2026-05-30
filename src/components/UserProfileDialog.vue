<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, MapPin, Calendar, MessageSquare, Link as LinkIcon, Quote } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import UserAvatar from './UserAvatar.vue';
import type { User } from '@/types';

type UserProfile = User & {
  _count?: {
    assets?: number;
    posts?: number;
    discussions?: number;
    showcases?: number;
  };
};

const props = defineProps<{
  modelValue: boolean;
  userId: string | null;
}>();

const emit = defineEmits(['update:modelValue', 'chat']);

const userProfile = ref<UserProfile | null>(null);
const isLoading = ref(false);

const fetchProfile = async () => {
  if (!props.userId) return;
  isLoading.value = true;
  try {
    const response = await api.get(`/api/auth/users/${props.userId}`);
    userProfile.value = response.data;
  } catch (_error) {
    ElMessage.error('获取用户信息失败');
    emit('update:modelValue', false);
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val && props.userId) {
      fetchProfile();
    } else if (!val) {
      userProfile.value = null;
    }
  },
);

const startChat = () => {
  if (!userProfile.value) return;
  emit('chat', userProfile.value);
  emit('update:modelValue', false);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="min(420px, 95%)"
    class="custom-dialog profile-dialog"
    :show-close="false"
    destroy-on-close
    append-to-body
    align-center
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Loader -->
    <div v-if="isLoading" class="py-24 text-center">
      <div class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-xs text-[var(--text-muted)] mt-4 font-bold tracking-wider">正在载入名片...</p>
    </div>
    
    <template v-else-if="userProfile">
      <!-- Minimalist Dark Header Banner -->
      <div class="h-28 bg-[var(--bg-app)] relative -mx-6 -mt-6 mb-12 border-b border-[var(--border-base)] overflow-hidden select-none">
        <!-- Stripe pattern -->
        <div class="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,0,0,0.02)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.02)_50%,rgba(0,0,0,0.02)_75%,transparent_75%,transparent)] bg-[size:8px_8px] dark:bg-[linear-gradient(45deg,rgba(255,255,255,0.01)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.01)_50%,rgba(255,255,255,0.01)_75%,transparent_75%,transparent)]"></div>
        <div class="absolute inset-0 bg-gradient-to-tr from-accent/5 to-transparent"></div>
        
        <!-- Compact Close Button -->
        <button 
          type="button" 
          class="absolute top-4 right-4 z-20 flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)]/80 text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer shadow-xs" 
          @click="emit('update:modelValue', false)"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Content Area -->
      <div class="px-1 relative">
        
        <!-- Horizontal Profile Header -->
        <div class="flex items-end gap-4 px-1 -mt-20 mb-5 relative z-10">
          <div class="relative shrink-0">
            <!-- Avatar with crisp ring -->
            <UserAvatar :user="userProfile" size="xl" class="rounded-2xl bg-[var(--bg-card)] ring-4 ring-[var(--bg-card)] shadow-md border border-[var(--border-base)]" />
          </div>
          
          <!-- Name, Email, and Role tag -->
          <div class="min-w-0 flex-1 pb-1">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <h3 class="text-base sm:text-lg font-black text-[var(--text-primary)] leading-none truncate">
                {{ userProfile.name || '未命名用户' }}
              </h3>
              <span 
                class="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border"
                :class="[
                  userProfile.role === 'ADMIN' ? 
                  'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20' : 
                  'bg-accent/10 text-accent border-accent/25 dark:bg-accent/20'
                ]"
              >
                {{ userProfile.role === 'ADMIN' ? '管理员' : '成员' }}
              </span>
            </div>
            <p class="text-xs text-[var(--text-muted)] truncate select-all">
              {{ userProfile.email }}
            </p>
          </div>
        </div>

        <!-- Blockquote Bio/Motto Card -->
        <div class="px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border-base)] rounded-2xl text-xs text-[var(--text-secondary)] leading-relaxed flex gap-2.5 items-start my-4 shadow-2xs">
          <Quote class="w-4 h-4 text-accent shrink-0 mt-0.5 opacity-60" />
          <p class="italic font-medium">“ {{ userProfile.bio || '这位小伙伴很神秘，什么都没写~' }} ”</p>
        </div>

        <!-- Numeric Stats Grid -->
        <div class="grid grid-cols-3 gap-2.5 my-4 select-none">
          <div class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-3 text-center transition-all hover:border-accent/40 shadow-2xs">
            <span class="text-base font-black text-[var(--text-primary)] block">{{ userProfile._count?.assets || 0 }}</span>
            <span class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider block mt-1.5">发布资产</span>
          </div>
          <div class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-3 text-center transition-all hover:border-accent/40 shadow-2xs">
            <span class="text-base font-black text-[var(--text-primary)] block">{{ userProfile._count?.showcases || 0 }}</span>
            <span class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider block mt-1.5">作品展示</span>
          </div>
          <div class="bg-[var(--bg-card)] border border-[var(--border-base)] rounded-2xl p-3 text-center transition-all hover:border-accent/40 shadow-2xs">
            <span class="text-base font-black text-[var(--text-primary)] block">{{ userProfile._count?.discussions || 0 }}</span>
            <span class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider block mt-1.5">发起讨论</span>
          </div>
        </div>

        <!-- Tabular User Details -->
        <div class="divide-y divide-[var(--border-base)] my-5 select-none">
          <!-- Location row -->
          <div class="flex items-center justify-between text-xs py-3">
            <span class="text-[var(--text-muted)] flex items-center gap-2">
              <MapPin class="w-3.5 h-3.5 text-[var(--text-muted)]" /> 所在地
            </span>
            <span class="font-extrabold text-[var(--text-primary)]">{{ userProfile.location || '未知' }}</span>
          </div>
          
          <!-- Joined date row -->
          <div class="flex items-center justify-between text-xs py-3">
            <span class="text-[var(--text-muted)] flex items-center gap-2">
              <Calendar class="w-3.5 h-3.5 text-[var(--text-muted)]" /> 加入时间
            </span>
            <span class="font-extrabold text-[var(--text-primary)]">{{ formatDate(userProfile.createdAt) }}</span>
          </div>

          <!-- Website row (Optional) -->
          <div v-if="userProfile.website" class="flex items-center justify-between text-xs py-3">
            <span class="text-[var(--text-muted)] flex items-center gap-2">
              <LinkIcon class="w-3.5 h-3.5 text-[var(--text-muted)]" /> 个人主页
            </span>
            <a 
              :href="userProfile.website" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="font-extrabold text-accent hover:underline flex items-center gap-1"
            >
              <span>{{ userProfile.website.replace(/^https?:\/\//, '') }}</span>
            </a>
          </div>
        </div>

        <!-- Contact CTA Button -->
        <button 
          type="button" 
          class="w-full mt-2 py-3.5 bg-accent hover:bg-accent-dark text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 text-xs tracking-wider cursor-pointer border-0 shadow-sm shadow-accent/15 hover:scale-[1.01] active:scale-[0.99]" 
          @click="startChat"
        >
          <MessageSquare class="w-3.5 h-3.5" />
          立即联系
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style>
.profile-dialog.el-dialog {
  border-radius: 1.75rem !important;
  overflow: hidden;
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-base) !important;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.25) !important;
}
.profile-dialog .el-dialog__header {
  display: none !important;
}
.profile-dialog .el-dialog__body {
  padding: 1.5rem !important;
}
</style>

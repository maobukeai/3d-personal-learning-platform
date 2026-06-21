<script setup lang="ts">
import { formatDate } from '@/utils/format';
import { ref, watch } from 'vue';
import { X, MapPin, Calendar, MessageSquare, Link as LinkIcon, Quote } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import UserAvatar from './UserAvatar.vue';
import type { User } from '@/types';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

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
</script>

<template>
  <Modal
    :show="modelValue"
    size="sm"
    padding="none"
    glass-card
    @close="emit('update:modelValue', false)"
  >
    <!-- Loader -->
    <div v-if="isLoading" class="py-24 text-center">
      <div
        class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"
      ></div>
      <p class="text-xs text-[var(--text-muted)] mt-4 font-bold tracking-wider">正在载入名片...</p>
    </div>

    <template v-else-if="userProfile">
      <!-- Modern Gradient Header Banner -->
      <div class="h-32 relative overflow-hidden select-none">
        <!-- Dynamic Gradient Blobs for background -->
        <div
          class="absolute inset-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-rose-500 opacity-90"
        ></div>
        <div class="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"></div>

        <!-- Abstract glowing circles -->
        <div
          class="absolute -top-12 -left-12 w-32 h-32 bg-sky-400/30 rounded-full blur-2xl animate-pulse"
        ></div>
        <div
          class="absolute -bottom-10 -right-6 w-36 h-36 bg-purple-400/20 rounded-full blur-3xl animate-pulse"
          style="animation-duration: 4s"
        ></div>

        <!-- Stripe pattern -->
        <div
          class="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.03)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.03)_50%,rgba(255,255,255,0.03)_75%,transparent_75%,transparent)] bg-[size:10px_10px]"
        ></div>

        <!-- Glass Close Button -->
        <button
          type="button"
          class="absolute top-4 right-4 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 active:scale-95 border border-white/10 backdrop-blur-md cursor-pointer"
          @click="emit('update:modelValue', false)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Body Container -->
      <div class="px-6 pb-6 relative select-none">
        <!-- Centered Profile Identity Header -->
        <div class="flex flex-col items-center -mt-14 mb-5 relative z-10">
          <!-- Avatar with premium shadow and ring -->
          <div class="relative shrink-0">
            <UserAvatar
              :user="userProfile"
              size="xl"
              class="rounded-3xl bg-[var(--bg-card)] ring-4 ring-[var(--bg-card)] shadow-xl border border-[var(--border-base)] transition-transform duration-500 hover:scale-105"
            />
          </div>

          <!-- Name, Email and Role -->
          <div class="text-center mt-3.5 w-full">
            <div class="flex items-center justify-center gap-2 mb-1.5 flex-wrap">
              <h3 class="text-lg font-black tracking-tight" style="color: var(--text-primary)">
                {{ userProfile.name || '未命名用户' }}
              </h3>

              <!-- Role Badge -->
              <span
                class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border inline-flex items-center"
                :class="[
                  userProfile.role === 'ADMIN'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20'
                    : 'bg-accent/10 text-accent border-accent/20 dark:bg-accent/20',
                ]"
              >
                {{ userProfile.role === 'ADMIN' ? '管理员' : '成员' }}
              </span>
            </div>

            <p
              class="text-xs text-[var(--text-muted)] font-medium truncate select-all px-4 max-w-xs mx-auto"
            >
              {{ userProfile.email }}
            </p>
          </div>
        </div>

        <!-- Biography Quote Section -->
        <div
          class="px-5 py-4 bg-slate-50/80 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 rounded-2xl text-xs text-slate-600 dark:text-slate-300 text-center relative max-w-sm mx-auto my-5 shadow-2xs backdrop-blur-xs"
        >
          <Quote
            class="w-4 h-4 text-accent/50 dark:text-accent/40 absolute -top-2 left-4 bg-[var(--bg-card)] px-0.5"
          />
          <p class="italic font-medium leading-relaxed">
            “ {{ userProfile.bio || '这位小伙伴很神秘，什么都没写~' }} ”
          </p>
        </div>

        <!-- Numeric Stats Grid -->
        <div class="grid grid-cols-3 gap-3 my-5">
          <div
            class="bg-slate-50/50 dark:bg-slate-950/10 border border-slate-100 dark:border-slate-800/30 rounded-2xl p-3 text-center transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-2xs duration-300"
          >
            <span
              class="text-lg font-black block bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent"
              >{{ userProfile._count?.assets || 0 }}</span
            >
            <span
              class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-1"
              >发布资产</span
            >
          </div>
          <div
            class="bg-slate-50/50 dark:bg-slate-950/10 border border-slate-100 dark:border-slate-800/30 rounded-2xl p-3 text-center transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-2xs duration-300"
          >
            <span
              class="text-lg font-black block bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent"
              >{{ userProfile._count?.showcases || 0 }}</span
            >
            <span
              class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-1"
              >作品展示</span
            >
          </div>
          <div
            class="bg-slate-50/50 dark:bg-slate-950/10 border border-slate-100 dark:border-slate-800/30 rounded-2xl p-3 text-center transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-2xs duration-300"
          >
            <span
              class="text-lg font-black block bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent"
              >{{ userProfile._count?.discussions || 0 }}</span
            >
            <span
              class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-1"
              >发起讨论</span
            >
          </div>
        </div>

        <!-- Info List Rows Card -->
        <div
          class="bg-slate-50/50 dark:bg-slate-950/10 border border-slate-100 dark:border-slate-800/30 rounded-2xl p-4 space-y-3.5 my-5"
        >
          <!-- Location row -->
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400 dark:text-slate-500 font-bold flex items-center gap-2.5">
              <MapPin class="w-4 h-4 text-slate-400/80" /> 所在地
            </span>
            <span class="font-black text-slate-700 dark:text-slate-200">{{
              userProfile.location || '未知'
            }}</span>
          </div>

          <!-- Joined date row -->
          <div
            class="flex items-center justify-between text-xs pt-3 border-t border-slate-100 dark:border-slate-800/20"
          >
            <span class="text-slate-400 dark:text-slate-500 font-bold flex items-center gap-2.5">
              <Calendar class="w-4 h-4 text-slate-400/80" /> 加入时间
            </span>
            <span class="font-black text-slate-700 dark:text-slate-200">{{
              formatDate(userProfile.createdAt)
            }}</span>
          </div>

          <!-- Website row (Optional) -->
          <div
            v-if="userProfile.website"
            class="flex items-center justify-between text-xs pt-3 border-t border-slate-100 dark:border-slate-800/20"
          >
            <span class="text-slate-400 dark:text-slate-500 font-bold flex items-center gap-2.5">
              <LinkIcon class="w-4 h-4 text-slate-400/80" /> 个人主页
            </span>
            <a
              :href="userProfile.website"
              target="_blank"
              rel="noopener noreferrer"
              class="font-black text-accent hover:underline flex items-center gap-1 transition-colors"
            >
              <span>{{ userProfile.website.replace(/^https?:\/\//, '') }}</span>
            </a>
          </div>
        </div>

        <!-- Contact CTA Button -->
        <Button
          variant="primary"
          size="lg"
          full-width
          class="mt-2"
          :icon="MessageSquare"
          @click="startChat"
        >
          立即联系
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped></style>

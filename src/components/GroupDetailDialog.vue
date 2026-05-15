<script setup lang="ts">
import { Star, BookOpen, ArrowRight, X, Users } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';

const props = defineProps<{
  visible: boolean;
  group: any;
}>();

const emit = defineEmits(['update:visible', 'join']);

const handleClose = () => {
  emit('update:visible', false);
};

const handleJoin = () => {
  emit('join', props.group.name);
};
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    width="900px"
    class="detail-dialog"
    :show-close="false"
    align-center
    @update:model-value="(val: any) => emit('update:visible', val)"
  >
    <div v-if="props.group" class="relative">
      <!-- Custom Close Button -->
      <button
        class="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/40 transition-all"
        @click="handleClose"
      >
        <X class="w-5 h-5" />
      </button>

      <div
        class="flex flex-col md:flex-row h-[600px] overflow-hidden rounded-[24px] bg-white dark:bg-slate-900 shadow-2xl"
      >
        <!-- Left: Image & Quick Stats -->
        <div class="md:w-5/12 relative">
          <img
            :src="
              props.group.avatarUrl ||
              props.group.image ||
              `https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=500&q=80`
            "
            class="w-full h-full object-cover"
            :alt="props.group.name"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
          ></div>

          <div class="absolute bottom-8 left-8 right-8 text-white">
            <span
              class="px-3 py-1 rounded-full bg-accent text-[10px] font-black uppercase tracking-widest"
            >
              {{ props.group.category || '公开小组' }}
            </span>
            <h2 class="text-3xl font-black mt-3 leading-tight">{{ props.group.name }}</h2>

            <div class="flex items-center gap-6 mt-6">
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-white/60 uppercase tracking-widest"
                  >成员</span
                >
                <span class="text-lg font-black mt-1">{{
                  props.group._count?.members || props.group.members || 1
                }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-white/60 uppercase tracking-widest"
                  >评分</span
                >
                <div class="flex items-center gap-1 mt-1">
                  <Star class="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span class="text-lg font-black">{{ props.group.rating || '5.0' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Detailed Content -->
        <div class="md:w-7/12 bg-white dark:bg-slate-900 p-10 overflow-y-auto scrollbar-hide">
          <div class="space-y-8">
            <section>
              <h3 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                关于小组
              </h3>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {{
                  props.group.description ||
                  '这是一个充满活力的学习社区，我们不仅分享最前沿的 3D 技术，更注重通过实战项目提升每位成员的创作能力。加入我们，与全球优秀的创作者共同进步。'
                }}
              </p>
            </section>

            <section>
              <h3 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                核心价值
              </h3>
              <div class="grid grid-cols-1 gap-3">
                <div
                  v-for="(val, i) in ['技术共享', '协同创作', '共同成长']"
                  :key="i"
                  class="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent hover:border-accent/10 transition-all group"
                >
                  <div
                    class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors"
                  >
                    <BookOpen class="w-5 h-5 text-accent group-hover:text-white" />
                  </div>
                  <div>
                    <h4 class="font-black text-slate-900 dark:text-white text-sm">{{ val }}</h4>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      涵盖了从基础理论到高级商业案例的完整闭环流程。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                活跃成员
              </h3>
              <div class="flex items-center gap-3">
                <div class="flex -space-x-3">
                  <template v-if="props.group.members?.length">
                    <UserAvatar
                      v-for="member in props.group.members"
                      :key="member.id"
                      :user="member.user"
                      size="md"
                      class="ring-4 ring-white dark:ring-slate-900"
                    />
                  </template>
                  <div
                    v-else
                    class="w-10 h-10 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                  >
                    <Users class="w-5 h-5 text-slate-400" />
                  </div>
                </div>
                <span class="text-xs font-bold text-slate-600 dark:text-slate-400 ml-2">
                  {{ props.group._count?.members || 0 }} 位团队成员
                </span>
              </div>
            </section>

            <!-- Sticky Footer Action -->
            <div
              class="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between"
            >
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >加入要求</span
                >
                <span class="text-sm font-black text-slate-900 dark:text-white mt-1">开放加入</span>
              </div>
              <button
                class="px-8 py-3 rounded-full bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:bg-accent-dark hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-2"
                @click="handleJoin"
              >
                申请加入 <ArrowRight class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style>
.detail-dialog.el-dialog {
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
}
.detail-dialog .el-dialog__header {
  display: none !important;
}
.detail-dialog .el-dialog__body {
  padding: 0 !important;
}
</style>

<script setup lang="ts">
import { Star, BookOpen, ArrowRight, X } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  group: any
}>()

const emit = defineEmits(['update:visible', 'join'])

const handleClose = () => {
  emit('update:visible', false)
}

const handleJoin = () => {
  emit('join', props.group.name)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="(val: any) => emit('update:visible', val)"
    width="900px"
    class="detail-dialog"
    :show-close="false"
    align-center
  >
    <div v-if="group" class="relative">
      <!-- Custom Close Button -->
      <button 
        @click="handleClose"
        class="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/40 transition-all"
      >
        <X class="w-5 h-5" />
      </button>

      <div class="flex flex-col md:flex-row h-[600px] overflow-hidden rounded-[32px]">
        <!-- Left: Image & Quick Stats -->
        <div class="md:w-5/12 relative">
          <img :src="group.image" class="w-full h-full object-cover" :alt="group.name">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          
          <div class="absolute bottom-8 left-8 right-8 text-white">
            <span class="px-3 py-1 rounded-full bg-accent text-[10px] font-black uppercase tracking-widest">
              {{ group.category }}
            </span>
            <h2 class="text-3xl font-black mt-3 leading-tight">{{ group.name }}</h2>
            
            <div class="flex items-center gap-6 mt-6">
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-white/60 uppercase tracking-widest">成员</span>
                <span class="text-lg font-black mt-1">{{ group.members }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-white/60 uppercase tracking-widest">评分</span>
                <div class="flex items-center gap-1 mt-1">
                  <Star class="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span class="text-lg font-black">{{ group.rating }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Detailed Content -->
        <div class="md:w-7/12 bg-white p-10 overflow-y-auto scrollbar-hide">
          <div class="space-y-8">
            <section>
              <h3 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">关于小组</h3>
              <p class="text-slate-600 leading-relaxed font-medium">
                {{ group.description }} 这是一个充满活力的学习社区，我们不仅分享最前沿的 3D 技术，更注重通过实战项目提升每位成员的创作能力。加入我们，与全球优秀的创作者共同进步。
              </p>
            </section>

            <section>
              <h3 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">你将学到</h3>
              <div class="grid grid-cols-1 gap-3">
                <div v-for="i in 3" :key="i" class="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border-2 border-transparent hover:border-accent/10 transition-all group">
                  <div class="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                    <BookOpen class="w-5 h-5 text-accent group-hover:text-white" />
                  </div>
                  <div>
                    <h4 class="font-black text-slate-900 text-sm">核心技能阶段 {{ i }}</h4>
                    <p class="text-xs text-slate-500 mt-1">涵盖了从基础理论到高级商业案例的完整闭环流程。</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">导师团队</h3>
              <div class="flex items-center gap-3">
                <div class="flex -space-x-3">
                  <img v-for="i in 4" :key="i" :src="`https://i.pravatar.cc/150?u=${i}`" class="w-10 h-10 rounded-full border-4 border-white object-cover">
                </div>
                <span class="text-xs font-bold text-slate-600 ml-2">+4 位行业资深专家</span>
              </div>
            </section>

            <!-- Sticky Footer Action -->
            <div class="pt-6 border-t border-slate-100 flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">加入要求</span>
                <span class="text-sm font-black text-slate-900 mt-1">需要具备基础建模知识</span>
              </div>
              <button 
                @click="handleJoin"
                class="px-8 py-3 rounded-full bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:bg-accent hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-2"
              >
                立即申请加入 <ArrowRight class="w-4 h-4" />
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

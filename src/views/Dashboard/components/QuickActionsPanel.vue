<script setup lang="ts">
import { useRouter } from 'vue-router';
import {
  FolderOpen,
  BookOpen,
  Users,
  Upload,
  MessageSquare,
  Zap,
} from 'lucide-vue-next';

const router = useRouter();

const actions = [
  {
    icon: BookOpen,
    label: '继续课程',
    desc: '学院',
    color: 'action-blue',
    route: '/academy',
  },
  {
    icon: Upload,
    label: '上传作品',
    desc: '资产库',
    color: 'action-purple',
    route: '/my-works',
  },
  {
    icon: FolderOpen,
    label: '浏览项目',
    desc: '工作区',
    color: 'action-green',
    route: '/workspace',
  },
  {
    icon: Users,
    label: '探索团队',
    desc: '社区',
    color: 'action-orange',
    route: '/explore-teams',
  },
  {
    icon: MessageSquare,
    label: '社区讨论',
    desc: '论坛',
    color: 'action-pink',
    route: '/discussions',
  },
  {
    icon: Zap,
    label: '我的任务',
    desc: '看板',
    color: 'action-yellow',
    route: '/work',
  },
];
</script>

<template>
  <div class="blender-card p-4 sm:p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-sm" style="color: var(--text-primary)">快捷操作</h3>
      <Zap class="w-4 h-4" style="color: var(--text-muted)" />
    </div>
    <div class="grid grid-cols-3 gap-2.5">
      <button
        v-for="action in actions"
        :key="action.label"
        type="button"
        class="quick-action-btn flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer transition-all group"
        @click="router.push(action.route)"
      >
        <div class="action-icon-wrap rounded-xl p-2.5 transition-transform group-hover:scale-110" :class="action.color">
          <component :is="action.icon" class="w-4 h-4" />
        </div>
        <span class="text-[10px] font-bold leading-tight text-center" style="color: var(--text-primary)">{{ action.label }}</span>
        <span class="text-[9px]" style="color: var(--text-muted)">{{ action.desc }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.quick-action-btn {
  background: transparent;
  border: 1px solid transparent;
}

.quick-action-btn:hover {
  background-color: var(--bg-subtle);
  border-color: var(--border-base);
}

.action-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-blue { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.action-purple { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; }
.action-green { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.action-orange { background: rgba(249, 115, 22, 0.12); color: #f97316; }
.action-pink { background: rgba(236, 72, 153, 0.12); color: #ec4899; }
.action-yellow { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
</style>

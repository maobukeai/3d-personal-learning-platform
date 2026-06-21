<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, Plus } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

interface Member {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Project {
  id: string;
  title: string;
}

interface PriorityOption {
  id: string;
  label: string;
  color: string;
  textColor: string;
}

interface Props {
  modelValue: boolean;
  teamMembers: Member[];
  projects: Project[];
  priorityOptions: PriorityOption[];
  defaultStatus?: string;
  defaultPriority?: string;
  defaultProjectId?: string;
  defaultTeamId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultStatus: 'TODO',
  defaultPriority: 'MEDIUM',
  defaultProjectId: '',
  defaultTeamId: '',
});

export interface TaskCreatePayload {
  title: string;
  description: string;
  status: string;
  priority: string;
  tags: string[];
  dueDate: string;
  assigneeId: string;
  projectId: string;
  teamId: string;
  participantIds: string[];
}

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', payload: TaskCreatePayload): void;
}>();

const localNewTask = ref({
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  tags: [] as string[],
  dueDate: '',
  assigneeId: '',
  projectId: '',
  teamId: '',
  participantIds: [] as string[],
});

const tagInput = ref('');

// Watch visibility and reset form when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      localNewTask.value = {
        title: '',
        description: '',
        status: props.defaultStatus,
        priority: props.defaultPriority,
        tags: [],
        dueDate: '',
        assigneeId: '',
        projectId: props.defaultProjectId,
        teamId: props.defaultTeamId,
        participantIds: [],
      };
      tagInput.value = '';
    }
  },
);

const addTag = () => {
  const tag = tagInput.value.trim();
  if (tag && !localNewTask.value.tags.includes(tag)) {
    localNewTask.value.tags.push(tag);
  }
  tagInput.value = '';
};

const removeTag = (tag: string) => {
  localNewTask.value.tags = localNewTask.value.tags.filter((t) => t !== tag);
};

const tagColorMap: Record<string, string> = {
  设计: 'bg-pink-500/10 text-pink-500',
  开发: 'bg-blue-500/10 text-blue-500',
  学习: 'bg-emerald-500/10 text-emerald-500',
  '3D': 'bg-violet-500/10 text-violet-500',
  建模: 'bg-cyan-500/10 text-cyan-500',
  渲染: 'bg-amber-500/10 text-amber-500',
  动画: 'bg-rose-500/10 text-rose-500',
  研究: 'bg-indigo-500/10 text-indigo-500',
  文档: 'bg-teal-500/10 text-teal-500',
  优化: 'bg-lime-500/10 text-lime-500',
};

const defaultTagClass = 'bg-slate-500/10 text-slate-500';

const getTagClass = (tag: string) => tagColorMap[tag] || defaultTagClass;

const handleClose = () => {
  emit('update:modelValue', false);
};

const handleSubmit = () => {
  if (!localNewTask.value.title.trim()) return;
  emit('submit', { ...localNewTask.value });
};
</script>

<template>
  <Modal :show="modelValue" title="新建学习任务" size="xl" glass-card @close="handleClose">
    <div class="space-y-4">
      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
        >
          任务标题
        </label>
        <input
          v-model="localNewTask.title"
          type="text"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm font-bold"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
          placeholder="例如：深入学习 Blender 几何节点系统"
        />
      </div>

      <div>
        <label
          class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
        >
          详细描述 (可选)
        </label>
        <textarea
          v-model="localNewTask.description"
          rows="4"
          class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-sm resize-none leading-relaxed"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
          placeholder="在此输入任务的详细背景、目标、步骤及参考资料..."
        ></textarea>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >
            优先级
          </label>
          <el-select v-model="localNewTask.priority" class="!w-full custom-select">
            <el-option v-for="p in priorityOptions" :key="p.id" :label="p.label" :value="p.id">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" :class="p.color"></div>
                <span class="text-xs sm:text-sm">{{ p.label }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >
            截止日期
          </label>
          <el-date-picker
            v-model="localNewTask.dueDate"
            type="date"
            placeholder="日期"
            class="!w-full !rounded-2xl custom-date-picker"
            popper-class="custom-date-popper"
          />
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >
            关联项目
          </label>
          <el-select
            v-model="localNewTask.projectId"
            clearable
            placeholder="项目"
            class="!w-full custom-select"
          >
            <el-option v-for="p in projects" :key="p.id" :label="p.title" :value="p.id" />
          </el-select>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >
            负责人
          </label>
          <el-select
            v-model="localNewTask.participantIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择负责人"
            class="!w-full custom-select"
          >
            <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
              <div class="flex items-center gap-2">
                <img
                  v-if="m.avatarUrl"
                  alt=""
                  :src="m.avatarUrl"
                  class="w-5 h-5 rounded-lg object-cover"
                />
                <span>{{ m.name }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <!-- Tags -->
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
          >
            标签
          </label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="tag in localNewTask.tags"
              :key="tag"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
              :class="getTagClass(tag)"
            >
              {{ tag }}
              <button
                type="button"
                class="hover:opacity-70 transition-opacity"
                @click="removeTag(tag)"
              >
                <X class="w-2.5 h-2.5" />
              </button>
            </span>
          </div>
          <div class="flex gap-2">
            <input
              v-model="tagInput"
              type="text"
              class="flex-1 px-4 py-2.5 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20 text-xs"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              placeholder="输入标签名"
              @keyup.enter="addTag"
            />
            <Button variant="secondary" size="sm" @click="addTag">
              <Plus class="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div class="pt-4">
        <Button variant="primary" size="lg" full-width @click="handleSubmit"> 创建任务 </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped></style>

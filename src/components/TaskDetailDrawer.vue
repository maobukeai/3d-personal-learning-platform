<script setup lang="ts">
import { ref, watch, type Component } from 'vue';
import { CheckCircle2, Copy, Maximize2, Minimize2, Trash2, X, CheckSquare } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { parseTags } from '@/utils/tags';

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
  icon?: Component;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  tags?: string | null;
  subtasks?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  participants?: { userId: string }[];
}

interface Props {
  modelValue: boolean;
  task: Task | null;
  teamMembers: Member[];
  projects: Project[];
  priorityOptions: PriorityOption[];
  statusColumns: { id: string; title: string }[];
  viewMode: 'drawer' | 'modal';
}

const props = defineProps<Props>();

export interface TaskUpdatePayload {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  projectId: string | null;
  teamId: string | null;
  tags: string | null;
  subtasks: string;
  participantIds: string[];
}

interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:viewMode', value: 'drawer' | 'modal'): void;
  (e: 'close'): void;
  (e: 'delete', task: Task): void;
  (e: 'save', payload: TaskUpdatePayload): void;
  (e: 'user-click', userId: string): void;
}>();

const drawerForm = ref({
  title: '',
  description: '',
  status: '',
  priority: 'MEDIUM',
  tags: [] as string[],
  dueDate: '',
  assigneeId: '',
  projectId: '',
  teamId: '',
  participantIds: [] as string[],
});

const drawerSubtasks = ref<{ id: string; text: string; done: boolean }[]>([]);
const newSubtaskText = ref('');
const detailDrawerTagInput = ref('');

const parseSubtasks = (subtasksStr: string | null | undefined): Subtask[] => {
  if (!subtasksStr) return [];
  try {
    const parsed = JSON.parse(subtasksStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
};

// Initialize form from task prop — react to identity change (task switch)
// rather than deep-watching every nested property, which would overwrite
// in-progress edits whenever any subfield mutates.
watch(
  () => props.task?.id,
  () => {
    const newTask = props.task;
    if (newTask) {
      drawerForm.value = {
        title: newTask.title,
        description: newTask.description || '',
        status: newTask.status,
        priority: newTask.priority || 'MEDIUM',
        tags: parseTags(newTask.tags),
        dueDate: newTask.dueDate || '',
        assigneeId: newTask.assigneeId || '',
        projectId: newTask.projectId || '',
        teamId: newTask.teamId || '',
        participantIds: newTask.participants ? newTask.participants.map((p) => p.userId) : [],
      };
      drawerSubtasks.value = parseSubtasks(newTask.subtasks);
      newSubtaskText.value = '';
      detailDrawerTagInput.value = '';
    }
  },
  { immediate: true },
);

const triggerSave = () => {
  emit('save', {
    title: drawerForm.value.title,
    description: drawerForm.value.description,
    status: drawerForm.value.status,
    priority: drawerForm.value.priority,
    dueDate: drawerForm.value.dueDate || null,
    assigneeId: drawerForm.value.assigneeId || null,
    projectId: drawerForm.value.projectId || null,
    teamId: drawerForm.value.teamId || null,
    tags: drawerForm.value.tags.length > 0 ? JSON.stringify(drawerForm.value.tags) : null,
    subtasks: JSON.stringify(drawerSubtasks.value),
    participantIds: drawerForm.value.participantIds,
  });
};

const copyToClipboard = (text: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success('任务ID已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
};

const toggleDetailViewMode = () => {
  const nextMode = props.viewMode === 'drawer' ? 'modal' : 'drawer';
  emit('update:viewMode', nextMode);
};

const handleDelete = () => {
  if (props.task) {
    emit('delete', props.task);
  }
};

const handleClose = () => {
  emit('close');
};

const addSubtask = () => {
  const text = newSubtaskText.value.trim();
  if (!text) return;
  drawerSubtasks.value.push({
    id: Math.random().toString(36).substring(2, 11),
    text,
    done: false,
  });
  newSubtaskText.value = '';
  triggerSave();
};

const toggleSubtask = (subtask: Subtask) => {
  subtask.done = !subtask.done;
  triggerSave();
};

const removeSubtask = (index: number) => {
  drawerSubtasks.value.splice(index, 1);
  triggerSave();
};

const updateSubtaskText = (index: number, text: string) => {
  drawerSubtasks.value[index].text = text;
  triggerSave();
};

const drawerAddTag = () => {
  const tag = detailDrawerTagInput.value.trim();
  if (tag && !drawerForm.value.tags.includes(tag)) {
    drawerForm.value.tags.push(tag);
    triggerSave();
  }
  detailDrawerTagInput.value = '';
};

const drawerRemoveTag = (tag: string) => {
  drawerForm.value.tags = drawerForm.value.tags.filter((t) => t !== tag);
  triggerSave();
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
</script>

<template>
  <Transition :name="viewMode === 'drawer' ? 'drawer-slide' : 'modal-fade'">
    <div
      v-if="modelValue && task"
      class="fixed inset-0 z-50 flex transition-all duration-300"
      :class="
        viewMode === 'drawer'
          ? 'justify-end'
          : 'items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm'
      "
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 cursor-pointer"
        :class="viewMode === 'drawer' ? 'bg-black/40 backdrop-blur-sm' : ''"
        @click="handleClose"
      ></div>

      <!-- Drawer/Modal Content Container -->
      <div
        class="task-detail-content relative shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
        :class="[
          viewMode === 'drawer'
            ? 'w-full sm:w-[85%] md:w-[75%] lg:w-[65%] xl:w-[55%] h-full'
            : 'w-full max-w-4xl h-[90vh] md:h-[85vh] rounded-2xl border',
        ]"
        :style="{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-base)',
          borderLeftWidth: viewMode === 'drawer' ? '1px' : '0px',
        }"
      >
        <!-- Header -->
        <div
          class="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-2 text-slate-400">
            <CheckCircle2 class="w-4 h-4 text-accent" />
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400">任务详情</span>
            <div
              class="flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-mono font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-slate-300"
              title="点击复制任务ID"
              @click="copyToClipboard(task.id)"
            >
              <span>#{{ task.id.substring(0, 8) }}</span>
              <Copy class="w-3 h-3 text-slate-400" />
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- View Mode Toggle (Drawer vs Modal) -->
            <button
              type="button"
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-500 dark:text-slate-400 cursor-pointer"
              :title="viewMode === 'drawer' ? '切换为弹窗模式' : '切换为抽屉模式'"
              @click="toggleDetailViewMode"
            >
              <component :is="viewMode === 'drawer' ? Maximize2 : Minimize2" class="w-4.5 h-4.5" />
            </button>

            <button
              type="button"
              class="px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all flex items-center gap-1 cursor-pointer"
              @click="handleDelete"
            >
              <Trash2 class="w-3.5 h-3.5" /> 删除任务
            </button>
            <button
              type="button"
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer"
              style="color: var(--text-secondary)"
              @click="handleClose"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Content Body -->
        <div
          class="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-6 md:gap-8 scrollbar-hide"
        >
          <!-- Left Column: Title, Description, Subtasks Checklist -->
          <div class="flex-1 space-y-6 min-w-0">
            <!-- Title Input -->
            <div>
              <label
                class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                >任务标题</label
              >
              <input
                v-model="drawerForm.title"
                type="text"
                class="w-full text-xl sm:text-2xl font-black bg-transparent border-b border-transparent focus:border-accent/30 focus:outline-none py-1.5 transition-all text-primary"
                placeholder="未命名任务"
                style="color: var(--text-primary)"
                @blur="triggerSave"
              />
            </div>

            <!-- Description Textarea -->
            <div>
              <label
                class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-accent"></span> 详细描述
              </label>
              <textarea
                v-model="drawerForm.description"
                rows="6"
                class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none leading-relaxed"
                placeholder="输入任务描述、参考资料或笔记..."
                style="color: var(--text-primary)"
                @blur="triggerSave"
              ></textarea>
            </div>

            <!-- Subtasks Checklist Section -->
            <div class="pt-4 border-t" style="border-color: var(--border-base)">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <CheckSquare class="w-4 h-4 text-accent" />
                  <h3 class="text-sm font-bold" style="color: var(--text-primary)">子任务清单</h3>
                  <span v-if="drawerSubtasks.length > 0" class="text-xs text-slate-400 font-bold">
                    ({{ drawerSubtasks.filter((s) => s.done).length }}/{{ drawerSubtasks.length }})
                  </span>
                </div>
              </div>

              <!-- Subtask Progress Bar -->
              <div
                v-if="drawerSubtasks.length > 0"
                class="w-full bg-slate-100 dark:bg-white/10 h-1.5 rounded-full mb-4 overflow-hidden"
              >
                <div
                  class="bg-accent h-full transition-all duration-300"
                  :style="{
                    width: `${(drawerSubtasks.filter((s) => s.done).length / drawerSubtasks.length) * 100}%`,
                  }"
                ></div>
              </div>

              <!-- Checklist Items -->
              <div class="space-y-2 mb-4">
                <div
                  v-for="(sub, index) in drawerSubtasks"
                  :key="sub.id"
                  class="flex items-center gap-3 group/sub p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <!-- Toggle Checkbox -->
                  <button
                    type="button"
                    class="w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0"
                    :class="
                      sub.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-accent'
                    "
                    @click="toggleSubtask(sub)"
                  >
                    <CheckCircle2 v-if="sub.done" class="w-3.5 h-3.5" />
                  </button>

                  <!-- Editable Subtask Text -->
                  <input
                    v-model="sub.text"
                    type="text"
                    class="flex-1 bg-transparent border-none focus:outline-none text-xs transition-all font-medium"
                    :class="
                      sub.done
                        ? 'line-through text-slate-400'
                        : 'text-slate-750 dark:text-slate-200'
                    "
                    @blur="updateSubtaskText(index, sub.text)"
                    @keyup.enter="($event.target as HTMLInputElement | null)?.blur()"
                  />

                  <!-- Delete Button -->
                  <button
                    type="button"
                    class="opacity-0 group-hover/sub:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-opacity"
                    @click="removeSubtask(index)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Add Subtask Form -->
              <div class="flex gap-2">
                <input
                  v-model="newSubtaskText"
                  type="text"
                  placeholder="+ 添加子任务..."
                  class="flex-1 px-4 py-2 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/40 focus:border-solid transition-all"
                  style="color: var(--text-primary)"
                  @keyup.enter="addSubtask"
                />
                <button
                  type="button"
                  class="px-3 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:opacity-85 transition-all"
                  @click="addSubtask"
                >
                  添加
                </button>
              </div>
            </div>
          </div>

          <!-- Right Column: Metadata Sidebar -->
          <div
            class="w-full lg:w-[320px] xl:w-[360px] shrink-0 space-y-5 p-4 md:p-5 bg-slate-50/50 dark:bg-white/2 rounded-2xl border"
            style="border-color: var(--border-base)"
          >
            <h3
              class="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 pb-2 border-b"
              style="border-color: var(--border-base)"
            >
              任务属性
            </h3>

            <!-- Grid container for compact metadata -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-3.5">
              <!-- Status selector -->
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >当前状态</label
                >
                <el-select
                  v-model="drawerForm.status"
                  class="!w-full custom-select-small"
                  @change="triggerSave"
                >
                  <el-option
                    v-for="c in statusColumns"
                    :key="c.id"
                    :label="c.title"
                    :value="c.id"
                  />
                </el-select>
              </div>

              <!-- Priority selector -->
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >优先级</label
                >
                <el-select
                  v-model="drawerForm.priority"
                  class="!w-full custom-select-small"
                  @change="triggerSave"
                >
                  <el-option
                    v-for="p in priorityOptions"
                    :key="p.id"
                    :label="p.label"
                    :value="p.id"
                  >
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" :class="p.color"></div>
                      <span class="text-xs">{{ p.label }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>

              <!-- Assignee selector -->
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >负责人</label
                >
                <el-select
                  v-model="drawerForm.assigneeId"
                  clearable
                  placeholder="未指派"
                  class="!w-full custom-select-small"
                  @change="triggerSave"
                >
                  <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
                    <div class="flex items-center gap-2">
                      <img
                        v-if="m.avatarUrl"
                        alt=""
                        :src="m.avatarUrl"
                        class="w-4 h-4 rounded-lg object-cover"
                      />
                      <span class="text-xs">{{ m.name }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>

              <!-- Due Date picker -->
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >截止日期</label
                >
                <el-date-picker
                  v-model="drawerForm.dueDate"
                  type="date"
                  placeholder="无截止日期"
                  class="!w-full custom-date-picker-small"
                  @change="triggerSave"
                />
              </div>

              <!-- Project selector -->
              <div class="col-span-2">
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >关联项目</label
                >
                <el-select
                  v-model="drawerForm.projectId"
                  clearable
                  placeholder="未关联"
                  class="!w-full custom-select-small"
                  @change="triggerSave"
                >
                  <el-option v-for="p in projects" :key="p.id" :label="p.title" :value="p.id" />
                </el-select>
              </div>
            </div>

            <!-- Co-participants selector -->
            <div>
              <label
                class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                >参与人员</label
              >
              <el-select
                v-model="drawerForm.participantIds"
                multiple
                placeholder="无其他参与人"
                class="!w-full custom-select-small"
                @change="triggerSave"
              >
                <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="m.avatarUrl"
                      alt=""
                      :src="m.avatarUrl"
                      class="w-4 h-4 rounded-lg object-cover"
                    />
                    <span class="text-xs">{{ m.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>

            <!-- Tags selector / edit -->
            <div>
              <label
                class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                >标签</label
              >
              <div class="flex flex-wrap gap-1 mb-2">
                <span
                  v-for="tag in drawerForm.tags"
                  :key="tag"
                  class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[8px] font-bold"
                  :class="getTagClass(tag)"
                >
                  # {{ tag }}
                  <button type="button" @click="drawerRemoveTag(tag)">
                    <X class="w-2 h-2 hover:opacity-75" />
                  </button>
                </span>
              </div>
              <div class="flex gap-1.5">
                <input
                  v-model="detailDrawerTagInput"
                  type="text"
                  placeholder="新建标签..."
                  class="flex-1 px-2.5 py-1 bg-slate-100 dark:bg-white/5 border-none rounded-lg text-[10px] focus:outline-none"
                  @keyup.enter="drawerAddTag"
                />
                <button
                  type="button"
                  class="p-1 bg-slate-100 dark:bg-white/5 hover:text-accent rounded-lg text-xs"
                  @click="drawerAddTag"
                >
                  +
                </button>
              </div>
            </div>

            <!-- Final Manual Save Feedback -->
            <div class="pt-4 border-t" style="border-color: var(--border-base)">
              <button
                type="button"
                class="w-full py-2.5 bg-accent text-white rounded-xl font-bold text-xs shadow-md shadow-accent/25 hover:shadow-lg hover:shadow-accent/35 transition-all"
                @click="handleClose"
              >
                关闭并保存所有更改
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

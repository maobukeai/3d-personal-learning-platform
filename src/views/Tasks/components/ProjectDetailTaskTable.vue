<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { CheckCircle2, Trash2 } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import { getPriorityBadgeClass, getPriorityOption } from '@/utils/taskDisplay';

interface ProjectUser {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
}

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignee?: ProjectUser | null;
  participants?: {
    id: string;
    userId: string;
    user: ProjectUser;
  }[];
}

interface Props {
  tasks: ProjectTask[];
  teamMembers: ProjectUser[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update-status', task: ProjectTask, newStatus: string): void;
  (e: 'change-assignee', task: ProjectTask, assigneeId: string | null): void;
  (e: 'delete-task', taskId: string): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    v-if="tasks.length === 0"
    class="mobile-adaptive py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl opacity-40 animate-in fade-in"
    style="border-color: var(--border-base)"
  >
    <CheckCircle2 class="w-8 h-8 text-slate-300 mb-2" />
    <p class="text-xs font-bold text-slate-400">{{ t('projects.noTasksLinked') }}</p>
  </div>
  <div
    v-else
    class="mobile-adaptive mobile-table border rounded-xl overflow-hidden"
    style="border-color: var(--border-base)"
  >
    <table class="w-full text-left border-collapse text-xs">
      <thead>
        <tr
          class="bg-slate-50/50 dark:bg-slate-800/50 border-b"
          style="border-color: var(--border-base)"
        >
          <th class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px]">
            {{ t('tasks.taskName') }}
          </th>
          <th
            class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-36"
          >
            {{ t('tasks.assignee') }}
          </th>
          <th
            class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-24"
          >
            {{ t('tasks.priority') }}
          </th>
          <th
            class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-32"
          >
            {{ t('tasks.statusLabel') }}
          </th>
          <th
            class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right w-16"
          >
            {{ t('common.actions') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="task in tasks"
          :key="task.id"
          class="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
          style="border-color: var(--border-base)"
        >
          <td
            class="px-3.5 py-2 font-bold truncate max-w-[200px]"
            :title="task.title"
            style="color: var(--text-primary)"
          >
            {{ task.title }}
          </td>
          <td class="px-3.5 py-2">
            <Dropdown align="left" width-class="w-48">
              <template #trigger>
                <span class="inline-flex items-center cursor-pointer">
                  <template v-if="task.participants && task.participants.length > 0">
                    <div class="flex items-center -space-x-1.5 py-0.5">
                      <UserAvatar
                        v-for="p in task.participants.slice(0, 3)"
                        :key="p.userId"
                        :user="p.user"
                        size="xs"
                        borderless
                        class="ring-2 ring-white dark:ring-slate-900"
                        :title="p.user?.name || p.user?.email"
                      />
                      <span
                        v-if="task.participants.length > 3"
                        class="text-[9px] font-black text-slate-400 pl-1"
                      >
                        +{{ task.participants.length - 3 }}
                      </span>
                    </div>
                  </template>
                  <template v-else-if="task.assignee">
                    <UserAvatar
                      :user="task.assignee"
                      size="xs"
                      borderless
                      :title="task.assignee.name || task.assignee.email"
                    />
                  </template>
                  <span
                    v-else
                    class="text-slate-400 text-[10px] font-bold py-0.5 px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >{{ t('tasks.unassigned') }}</span
                  >
                </span>
              </template>
              <template #content>
                <button
                  type="button"
                  class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/10 border-none bg-transparent cursor-pointer transition-colors"
                  @click="emit('change-assignee', task, null)"
                >
                  {{ t('tasks.clearAssignee') }}
                </button>
                <div class="h-[1px] my-1 bg-slate-100 dark:bg-white/10"></div>
                <button
                  v-for="m in teamMembers"
                  :key="m.id"
                  type="button"
                  class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors flex items-center gap-2"
                  @click="emit('change-assignee', task, m.id)"
                >
                  <img
                    v-if="m.avatarUrl"
                    alt=""
                    :src="m.avatarUrl"
                    class="w-5 h-5 rounded-lg object-cover"
                  />
                  <span>{{ m.name }}</span>
                </button>
              </template>
            </Dropdown>
          </td>
          <td class="px-3.5 py-2">
            <span
              class="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider"
              :class="getPriorityBadgeClass(task.priority)"
            >
              {{ getPriorityOption(task.priority).label }}
            </span>
          </td>
          <td class="px-3.5 py-2">
            <el-select
              v-model="task.status"
              size="small"
              class="!w-24 custom-select-small"
              @change="(val: string) => emit('update-status', task, val)"
            >
              <el-option :label="t('tasks.todo')" value="TODO" />
              <el-option :label="t('tasks.inProgress')" value="IN_PROGRESS" />
              <el-option :label="t('tasks.done')" value="DONE" />
            </el-select>
          </td>
          <td class="px-3.5 py-2 text-right">
            <button
              type="button"
              class="p-1 hover:text-rose-500 text-slate-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer bg-transparent border-none"
              @click="emit('delete-task', task.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

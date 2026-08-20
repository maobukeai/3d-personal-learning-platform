<script setup lang="ts">
import { FolderOpen, Repeat, Clock, Calendar, CheckSquare, User } from 'lucide-vue-next';
import { TaskStatus } from '@/types';
import { parseTags, getTagClass } from '@/utils/tags';
import {
  getPriorityOption,
  getPriorityColorClass,
  getPriorityBadgeClass,
  formatDueDate,
  isOverdue,
} from '@/utils/taskDisplay';
import UserAvatar from '@/components/UserAvatar.vue';
import CardSubtasksSection from '@/components/card/CardSubtasksSection.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import DropdownMenu from '@/components/ui/DropdownMenu.vue';
import DropdownItem from '@/components/ui/DropdownItem.vue';
import { useTaskCardState, type TaskCardProps, type TaskCardEmits } from './useTaskCardState';

const props = withDefaults(defineProps<TaskCardProps>(), {
  layout: 'board',
  config: () => ({
    assignee: true,
    dueDate: true,
    priority: true,
    project: true,
    subtasks: true,
    description: true,
    timeTracking: true,
  }),
  teamMembers: () => [],
});

const emit = defineEmits<TaskCardEmits>();

const {
  isBlocked,
  timeEstimateHours,
  timeSpentHours,
  timePercent,
  parsedSubtasks,
  hasSubtasks,
  subtasksProgress,
  subtasksPercent,
  uncompletedSubtasks,
  updatePriority,
  updateDueDate,
  handleSubtaskStatusChange,
  handleReorderSubtasks,
  isSubtaskPanelOpen,
  isHoverCardOpen,
  toggleSubtaskPanelOpen,
  handlePillMouseEnter,
  handlePillMouseLeave,
  handleAddSubtaskComment,
  handleUploadSubtaskImage,
  activePreviewImage,
  cardCoverImage,
} = useTaskCardState(props, emit);
</script>

<template>
  <div
    class="group p-1 sm:p-2.5 rounded-lg sm:rounded-xl border shadow-sm hover:shadow-md hover:border-accent/30 transition-all cursor-grab active:cursor-grabbing relative glass-real-physical glass-panel-extreme overflow-hidden select-none"
    @click="emit('click', task)"
  >
    <!-- Card Cover Header -->
    <div
      v-if="cardCoverImage && (config.cover ?? true)"
      class="-mx-1 -mt-1 sm:-mx-2.5 sm:-mt-2.5 mb-2 h-24 sm:h-28 overflow-hidden rounded-t-lg sm:rounded-t-xl relative group/cardCover cursor-zoom-in border-b select-none"
      style="border-color: var(--border-base)"
      @click.stop="activePreviewImage = cardCoverImage"
    >
      <img
        :src="cardCoverImage"
        class="w-full h-full object-cover group-hover/cardCover:scale-105 transition-transform duration-500 pointer-events-none select-none"
        alt="Card Cover"
        draggable="false"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-80 pointer-events-none"
      ></div>
    </div>

    <!-- Priority + Title Row -->
    <div class="flex justify-between items-start mb-1 sm:mb-1.5 select-none">
      <div class="flex items-start gap-1 sm:gap-2 flex-1 min-w-0">
        <div
          v-if="task.priority && task.priority !== 'NONE'"
          class="shrink-0 w-1 h-1 sm:w-2 sm:h-2 rounded-full mt-1.5 sm:mt-1"
          :class="getPriorityColorClass(task.priority)"
        ></div>
        <span
          v-if="isBlocked"
          class="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider scale-90 origin-left select-none"
          title="等待前置任务完成"
        >
          等待依赖
        </span>
        <span
          v-if="task.recurrence"
          class="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-black bg-violet-500/10 text-violet-500 border border-violet-500/20 uppercase tracking-wider scale-90 origin-left select-none"
          :title="`循环任务（${
            task.recurrence === 'DAILY' ? '每天' : task.recurrence === 'WEEKLY' ? '每周' : '每月'
          }）完成后自动生成下一期`"
        >
          <Repeat class="w-2 h-2" />
        </span>
        <h3
          class="text-[10px] sm:text-xs font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2 select-none"
          :class="task.status === TaskStatus.CANCELLED ? 'line-through opacity-60' : ''"
          style="color: var(--text-primary)"
        >
          <span
            v-if="task.isSubtask"
            class="shrink-0 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-wider scale-90 mr-1 select-none"
          >
            子任务
          </span>
          {{ task.title }}
        </h3>
      </div>
    </div>

    <!-- Project Tag (Board view) -->
    <div
      v-if="task.project && config.project"
      class="flex items-center gap-1 text-[10px] font-semibold text-accent mb-1.5 truncate select-none"
    >
      <FolderOpen class="w-2.5 h-2.5 text-accent shrink-0" />
      <span>{{ task.project.title }}</span>
    </div>

    <!-- Description -->
    <p
      v-if="task.description && config.description"
      class="hidden sm:block text-[10px] mb-1.5 line-clamp-1 leading-relaxed select-none"
      style="color: var(--text-secondary)"
    >
      {{ task.description }}
    </p>

    <!-- Tags (if any in board mode, parsed) -->
    <div
      v-if="parseTags(task.tags).length > 0"
      class="hidden sm:flex flex-wrap gap-1 mb-1.5 select-none"
    >
      <span
        v-for="tag in parseTags(task.tags)"
        :key="tag"
        class="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold select-none"
        :class="getTagClass(tag)"
      >
        {{ tag }}
      </span>
    </div>

    <!-- Time Tracking Progress Bar -->
    <div
      v-if="task.timeEstimate && config.timeTracking"
      class="hidden sm:block mt-2 mb-2 select-none"
      @click.stop
    >
      <div
        class="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1"
      >
        <span class="flex items-center gap-0.5">
          <Clock class="w-2.5 h-2.5 shrink-0" />
          <span>工时追踪: {{ timePercent }}%</span>
        </span>
        <span>{{ timeSpentHours.toFixed(1) }}h / {{ timeEstimateHours.toFixed(1) }}h</span>
      </div>
      <div
        class="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5"
      >
        <div
          class="h-full rounded-sm transition-all duration-300"
          :class="timeSpentHours > timeEstimateHours ? 'bg-amber-500' : 'bg-emerald-500'"
          :style="{ width: `${timePercent}%` }"
        ></div>
      </div>
    </div>

    <!-- Card Embedded Subtasks Checklist (Collapsible) -->
    <transition name="slide-fade">
      <CardSubtasksSection
        v-if="hasSubtasks && config.subtasks && isSubtaskPanelOpen"
        :parsed-subtasks="parsedSubtasks"
        :subtasks-progress="subtasksProgress"
        :has-subtasks="hasSubtasks"
        :config-subtasks="config.subtasks"
        @update-subtask="handleSubtaskStatusChange"
        @reorder-subtasks="handleReorderSubtasks"
        @upload-image="handleUploadSubtaskImage"
        @add-comment="handleAddSubtaskComment"
        @preview-image="(url) => (activePreviewImage = url)"
      />
    </transition>

    <!-- Footer: Date + Subtasks + Priority + Assignee -->
    <div
      v-if="
        (task.dueDate && config.dueDate) ||
        hasSubtasks ||
        (task.priority && task.priority !== 'NONE' && config.priority) ||
        config.assignee
      "
      class="flex items-center justify-between pt-1 mt-1 border-t select-none"
      style="border-color: var(--border-base)"
    >
      <div class="flex flex-wrap items-center gap-0.5 sm:gap-2 min-w-0 select-none">
        <!-- Due Date with native Picker -->
        <div
          v-if="config.dueDate"
          class="relative flex items-center gap-0.5 text-[10px] sm:text-[10px] font-semibold shrink-0 cursor-pointer hover:text-accent transition-colors select-none"
          :class="
            task.dueDate && isOverdue(task.dueDate, task.status)
              ? 'text-rose-500'
              : 'text-slate-400'
          "
          @click.stop
        >
          <input
            type="date"
            :value="task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''"
            class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 pointer-events-auto"
            @change="(e) => updateDueDate((e.target as HTMLInputElement).value)"
          />
          <Calendar class="w-2.5 h-2.5 text-slate-400 shrink-0" />
          <span v-if="task.dueDate" class="hidden sm:inline">{{
            formatDueDate(task.dueDate)
          }}</span>
          <span v-if="task.dueDate" class="sm:hidden">
            {{ new Date(task.dueDate).getMonth() + 1 }}/{{ new Date(task.dueDate).getDate() }}
          </span>
          <span
            v-else
            class="text-[10px] sm:text-[10px] text-slate-400 hover:text-accent font-semibold"
          >
            + 日期
          </span>
        </div>

        <!-- Subtasks Progress Pill Badge with HoverCard Preview -->
        <div class="relative shrink-0">
          <button
            v-if="hasSubtasks && config.subtasks"
            type="button"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] sm:text-[10px] font-extrabold bg-gradient-to-r from-slate-100/90 via-slate-50/80 to-slate-100/90 dark:from-white/10 dark:via-white/5 dark:to-white/10 hover:from-accent/20 hover:to-accent/10 hover:text-accent border border-slate-200/60 dark:border-white/10 transition-all duration-200 select-none group/pill shadow-sm cursor-pointer"
            :class="{
              'bg-accent/20 text-accent border-accent/40 shadow-accent/10': isSubtaskPanelOpen,
            }"
            @mouseenter="handlePillMouseEnter"
            @mouseleave="handlePillMouseLeave"
            @click.stop="toggleSubtaskPanelOpen"
          >
            <CheckSquare
              class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent shrink-0 group-hover/pill:scale-110 transition-transform"
            />
            <span>{{ subtasksProgress }}</span>
            <div
              class="w-6 sm:w-8 h-1 bg-slate-200/80 dark:bg-slate-700/80 rounded-sm overflow-hidden shrink-0 ml-0.5"
            >
              <div
                class="h-full bg-gradient-to-r from-accent to-emerald-400 transition-all duration-300 rounded-sm"
                :style="{ width: `${subtasksPercent}%` }"
              ></div>
            </div>
          </button>

          <!-- Floating HoverCard Preview (300ms hover trigger) -->
          <transition name="fade">
            <div
              v-if="isHoverCardOpen && !isSubtaskPanelOpen && hasSubtasks"
              class="absolute bottom-full left-0 mb-2 w-48 p-2.5 rounded-xl glass-real-physical shadow-2xl border border-white/20 dark:border-white/10 pointer-events-none animate-in fade-in zoom-in-95 duration-200 select-none"
              style="z-index: var(--z-index-popover)"
            >
              <div
                class="flex items-center justify-between text-[10px] font-bold text-slate-400 border-b border-dashed pb-1.5 mb-1.5"
                style="border-color: var(--border-base)"
              >
                <span>未完成子任务 ({{ uncompletedSubtasks.length }})</span>
                <span class="text-[10px] text-accent">点击展开全量</span>
              </div>
              <div v-if="uncompletedSubtasks.length > 0" class="space-y-1.5">
                <div
                  v-for="sub in uncompletedSubtasks.slice(0, 2)"
                  :key="sub.id"
                  class="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-200 truncate"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-accent shrink-0"></div>
                  <span class="truncate">{{ sub.text }}</span>
                </div>
                <div
                  v-if="uncompletedSubtasks.length > 2"
                  class="text-[10px] text-slate-400 italic"
                >
                  + 仍有 {{ uncompletedSubtasks.length - 2 }} 项未完成
                </div>
              </div>
              <div
                v-else
                class="text-[10px] text-emerald-500 font-bold flex items-center gap-1 py-0.5"
              >
                <span>🎉 全部子任务已完成</span>
              </div>
            </div>
          </transition>
        </div>

        <!-- Priority Badge with Dropdown -->
        <Dropdown
          v-if="task.priority && task.priority !== 'NONE' && config.priority"
          trigger="click"
          @command="(cmd) => updatePriority(cmd as any)"
          @click.stop
        >
          <span
            class="inline-flex items-center gap-0.5 px-0.5 sm:px-1 py-0.5 rounded text-[10px] sm:text-[10px] font-bold shrink-0 cursor-pointer hover:opacity-85 select-none"
            :class="getPriorityBadgeClass(task.priority)"
          >
            <component
              :is="getPriorityOption(task.priority).icon"
              class="w-1.5 h-1.5 sm:w-2 sm:h-2"
            />
            <span>{{ getPriorityOption(task.priority).label }}</span>
          </span>
          <template #dropdown>
            <DropdownMenu>
              <DropdownItem command="URGENT">紧急</DropdownItem>
              <DropdownItem command="HIGH">高</DropdownItem>
              <DropdownItem command="MEDIUM">中</DropdownItem>
              <DropdownItem command="LOW">低</DropdownItem>
              <DropdownItem command="NONE">无</DropdownItem>
            </DropdownMenu>
          </template>
        </Dropdown>
      </div>

      <!-- Assignee Avatar Stack -->
      <div v-if="config.assignee" class="shrink-0 ml-0.5 flex items-center select-none">
        <div
          v-if="task.assigneeId && task.participants && task.participants.length > 0"
          class="flex items-center -space-x-1.5"
        >
          <UserAvatar
            v-for="p in task.participants.slice(0, 3)"
            :key="p.userId"
            :user="p.user"
            size="xs"
            borderless
            class="ring-2 ring-white dark:ring-slate-900 cursor-pointer hover:z-10 hover:scale-105 transition-all"
            :title="p.user?.name"
          />
          <span
            v-if="task.participants.length > 3"
            class="text-[10px] font-black text-slate-400 pl-1 select-none"
          >
            +{{ task.participants.length - 3 }}
          </span>
        </div>
        <div v-else-if="task.assigneeId && task.assignee" class="flex items-center">
          <UserAvatar
            :user="task.assignee"
            size="xs"
            borderless
            class="ring-2 ring-white dark:ring-slate-900 cursor-pointer hover:z-10 hover:scale-105 transition-all"
            :title="task.assignee.name"
          />
        </div>
        <div
          v-else
          class="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-dashed border-slate-300 dark:border-white/10"
          title="未指派负责人"
        >
          <User class="w-2.5 h-2.5 text-slate-400" />
        </div>
      </div>
    </div>
  </div>

  <!-- Subtask Image Lightbox Zoom -->
  <teleport to="body">
    <div
      v-if="activePreviewImage"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm cursor-zoom-out"
      @click="activePreviewImage = null"
    >
      <img
        :src="activePreviewImage"
        class="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl transition-transform duration-300"
      />
    </div>
  </teleport>
</template>

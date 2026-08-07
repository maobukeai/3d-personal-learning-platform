<script setup lang="ts">
import { ref, watch } from 'vue';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import Button from '@/components/ui/Button.vue';
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue';
import type {
  SmartSheetItem,
  SheetTemplateType,
  RecordStatus,
  RecordPriority,
} from '../types/sheet';

const props = defineProps<{
  show: boolean;
  item?: SmartSheetItem | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', item: Omit<SmartSheetItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): void;
}>();

const form = ref({
  templateType: 'STUDY_LOG' as SheetTemplateType,
  title: '',
  category: '前端开发',
  tagsString: '',
  status: 'TODO' as RecordStatus,
  priority: 'MEDIUM' as RecordPriority,
  durationMinutes: 30,
  dueDate: '',
  linkUrl: '',
  content: '',
});

watch(
  () => props.item,
  (val) => {
    if (val) {
      form.value = {
        templateType: val.templateType,
        title: val.title,
        category: val.category,
        tagsString: (val.tags || []).join(', '),
        status: val.status,
        priority: val.priority,
        durationMinutes: val.durationMinutes || 0,
        dueDate: val.dueDate || '',
        linkUrl: val.linkUrl || '',
        content: val.content || '',
      };
    } else {
      form.value = {
        templateType: 'STUDY_LOG',
        title: '',
        category: '前端开发',
        tagsString: '',
        status: 'TODO',
        priority: 'MEDIUM',
        durationMinutes: 30,
        dueDate: new Date().toISOString().slice(0, 10),
        linkUrl: '',
        content: '',
      };
    }
  },
  { immediate: true },
);

const handleSave = () => {
  if (!form.value.title.trim()) return;

  const tags = form.value.tagsString
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);

  emit('save', {
    ...(props.item?.id ? { id: props.item.id } : {}),
    templateType: form.value.templateType,
    title: form.value.title.trim(),
    category: form.value.category.trim() || '通用',
    tags,
    status: form.value.status,
    priority: form.value.priority,
    durationMinutes: Number(form.value.durationMinutes) || 0,
    dueDate: form.value.dueDate,
    linkUrl: form.value.linkUrl.trim(),
    content: form.value.content.trim(),
  });
};
</script>

<template>
  <Modal
    :show="show"
    :title="item ? '编辑备忘条目' : '新建多维备忘项'"
    size="lg"
    @close="emit('close')"
  >
    <div class="space-y-4 py-2">
      <!-- 模板类型与分类 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">记录模板</label>
          <Select v-model="form.templateType" size="sm">
            <SelectOption value="STUDY_LOG" label="学习日志" />
            <SelectOption value="PROJECT_MILESTONE" label="项目里程碑" />
            <SelectOption value="RESOURCE_INVENTORY" label="资料积累" />
          </Select>
        </div>

        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">主题 / 分类</label>
          <Input v-model="form.category" placeholder="例如：Vue3 / 3D渲染 / Shader" size="sm" />
        </div>
      </div>

      <!-- 标题 -->
      <div>
        <label class="block text-xs font-medium text-neutral-300 mb-1">条目标题 *</label>
        <Input v-model="form.title" placeholder="请输入备忘条目标题..." size="sm" />
      </div>

      <!-- 状态、优先级与时长 -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">当前状态</label>
          <Select v-model="form.status" size="sm">
            <SelectOption value="TODO" label="未开始" />
            <SelectOption value="IN_PROGRESS" label="进行中" />
            <SelectOption value="COMPLETED" label="已完成" />
            <SelectOption value="ARCHIVED" label="已归档" />
          </Select>
        </div>

        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">优先级</label>
          <Select v-model="form.priority" size="sm">
            <SelectOption value="LOW" label="低" />
            <SelectOption value="MEDIUM" label="中" />
            <SelectOption value="HIGH" label="高" />
            <SelectOption value="URGENT" label="紧急" />
          </Select>
        </div>

        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">预计/已用时长(分钟)</label>
          <Input
            v-model.number="form.durationMinutes"
            type="number"
            min="0"
            placeholder="分钟"
            size="sm"
          />
        </div>
      </div>

      <!-- 日期与关联链接 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">目标日期</label>
          <CustomDatePicker v-model="form.dueDate" placeholder="选择日期" size="sm" />
        </div>

        <div>
          <label class="block text-xs font-medium text-neutral-300 mb-1">关联参考 URL</label>
          <Input v-model="form.linkUrl" placeholder="https://..." size="sm" />
        </div>
      </div>

      <!-- 标签 -->
      <div>
        <label class="block text-xs font-medium text-neutral-300 mb-1">标签 (逗号分隔)</label>
        <Input v-model="form.tagsString" placeholder="例如: WebGL, 算法, 极客" size="sm" />
      </div>

      <!-- 详细备注 / 文本心得 -->
      <div>
        <label class="block text-xs font-medium text-neutral-300 mb-1">心得与详细备注</label>
        <textarea
          v-model="form.content"
          rows="4"
          class="w-full rounded-lg bg-white/5 border border-white/10 p-2.5 text-xs text-neutral-200 focus:outline-none focus:border-blue-500/50 resize-none"
          placeholder="可录入简短 Markdown 或代码心得笔记..."
        ></textarea>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" @click="emit('close')">取消</Button>
        <Button variant="primary" size="sm" :disabled="!form.title.trim()" @click="handleSave">
          保存记录
        </Button>
      </div>
    </template>
  </Modal>
</template>

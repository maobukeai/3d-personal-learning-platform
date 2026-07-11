<script setup lang="ts">
import { computed, ref } from 'vue';
import { FileImage, Loader2, RotateCcw, Send, X } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';
import type { FeedbackType, FeedbackPriority } from '@/types';

export interface BugFormData {
  type: FeedbackType;
  title: string;
  description: string;
  expected: string;
  actual: string;
  steps: string;
  impact: string;
  pageUrl: string;
  priority: FeedbackPriority;
  attachmentUrl: string;
}

interface Props {
  modelValue: BugFormData;
  previewUrl?: string;
  isUploading?: boolean;
  isSubmitting?: boolean;
  typeOptions: Array<{ value: FeedbackType; label: string; hint: string }>;
  priorityOptions: Array<{ value: FeedbackPriority; label: string; hint: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  previewUrl: '',
  isUploading: false,
  isSubmitting: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: BugFormData): void;
  (e: 'submit'): void;
  (e: 'reset'): void;
  (e: 'fileChange', event: Event): void;
  (e: 'removeAttachment'): void;
}>();

const form = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => {
  fileInput.value?.click();
};

const onFileChange = (event: Event) => {
  emit('fileChange', event);
};
</script>

<template>
  <Card class="form-panel">
    <div class="panel-head mobile-row">
      <div class="min-w-0">
        <p class="eyebrow">新建工单</p>
        <h2 class="truncate">描述问题</h2>
      </div>
      <span class="status-pill tone-amber">草稿</span>
    </div>

    <div class="compact-grid">
      <div class="form-group">
        <label class="form-label">反馈类型</label>
        <div class="relative w-full">
          <Select v-model="form.type" class="w-full custom-select">
            <SelectOption
              v-for="item in typeOptions"
              :key="item.value"
              :label="`${item.label} · ${item.hint}`"
              :value="item.value"
            />
          </Select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">优先级</label>
        <div class="relative w-full">
          <Select v-model="form.priority" class="w-full custom-select">
            <SelectOption
              v-for="item in priorityOptions"
              :key="item.value"
              :label="`${item.label} · ${item.hint}`"
              :value="item.value"
            />
          </Select>
        </div>
      </div>
    </div>

    <UiInput
      v-model="form.title"
      label="工单标题"
      placeholder="例如：学习路线页面保存后步骤顺序错乱"
      :glass="false"
    />

    <div class="form-group">
      <label class="form-label">问题描述</label>
      <textarea
        v-model="form.description"
        class="custom-textarea"
        rows="6"
        maxlength="1500"
        placeholder="请详细描述问题发生的页面、具体现象，或者在此处附带复现步骤、期望与实际结果，方便管理员快速定位。"
      ></textarea>
    </div>

    <div class="compact-grid">
      <UiInput
        v-model="form.impact"
        label="影响范围"
        placeholder="例如：影响团队任务提交 / 仅自己可见"
        :glass="false"
      />
      <UiInput v-model="form.pageUrl" label="页面链接" placeholder="https://..." :glass="false" />
    </div>

    <div class="upload-row">
      <input
        ref="fileInput"
        type="file"
        class="hidden-input"
        accept="image/*"
        @change="onFileChange"
      />
      <button v-if="!previewUrl" type="button" class="upload-box" @click="triggerFileInput">
        <Loader2 v-if="isUploading" class="spinning" />
        <FileImage v-else />
        <span>{{ isUploading ? '上传中...' : '上传截图' }}</span>
        <small>PNG / JPG / WebP，最大 5MB</small>
      </button>
      <div v-else class="attachment-preview">
        <img :src="previewUrl" alt="" />
        <div>
          <strong>截图已附加</strong>
          <span>管理员可直接预览定位问题</span>
        </div>
        <button type="button" class="icon-btn danger" @click="emit('removeAttachment')">
          <X />
        </button>
      </div>
    </div>

    <div class="form-actions mobile-row">
      <UiButton variant="secondary" :icon="RotateCcw" @click="emit('reset')">重置</UiButton>
      <UiButton
        variant="primary"
        :icon="Send"
        :disabled="isSubmitting"
        :loading="isSubmitting"
        @click="emit('submit')"
      >
        {{ isSubmitting ? '提交中' : '提交工单' }}
      </UiButton>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Save } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import type { AiBotKnowledgeSourceForm } from '../../aiRobotAccessModel';

interface Props {
  isKnowledgeEditing: boolean;
  isKnowledgeSaving: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  save: [];
  close: [];
}>();

const show = defineModel<boolean>('show', { required: true });
const knowledgeForm = defineModel<AiBotKnowledgeSourceForm>('knowledgeForm', { required: true });

const knowledgeTypeOptions = [
  { value: 'FAQ', label: 'FAQ' },
  { value: 'DOC', label: '文档' },
  { value: 'URL', label: '外链' },
  { value: 'POLICY', label: '规则' },
  { value: 'PROJECT', label: '项目' },
  { value: 'SUPPORT', label: '客服' },
] as const;

const knowledgeStatusOptions = [
  { value: 'ACTIVE', label: '启用' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PAUSED', label: '暂停' },
] as const;

const knowledgeVisibilityOptions = [
  { value: 'PRIVATE', label: '仅自己' },
  { value: 'TEAM', label: '团队' },
  { value: 'PUBLIC', label: '公开' },
] as const;
</script>

<template>
  <Modal
    :show="show"
    :title="isKnowledgeEditing ? '编辑知识源' : '添加知识源'"
    size="lg"
    @close="emit('close')"
  >
    <div class="space-y-4 text-left">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_9rem]">
        <div>
          <label class="field-label">标题</label>
          <input
            v-model="knowledgeForm.title"
            class="form-input"
            placeholder="例如：素材上传失败排查 FAQ"
          />
        </div>
        <div>
          <label class="field-label">类型</label>
          <Select v-model="knowledgeForm.sourceType" class="w-full" size="large">
            <SelectOption
              v-for="option in knowledgeTypeOptions"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            />
          </Select>
        </div>
        <div>
          <label class="field-label">状态</label>
          <Select v-model="knowledgeForm.status" class="w-full" size="large">
            <SelectOption
              v-for="option in knowledgeStatusOptions"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            />
          </Select>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-[9rem_8rem_minmax(0,1fr)]">
        <div>
          <label class="field-label">可见范围</label>
          <Select v-model="knowledgeForm.visibility" class="w-full" size="large">
            <SelectOption
              v-for="option in knowledgeVisibilityOptions"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            />
          </Select>
        </div>
        <div>
          <label class="field-label">优先级</label>
          <input
            v-model.number="knowledgeForm.priority"
            type="number"
            min="0"
            max="100"
            class="form-input"
          />
        </div>
        <div>
          <label class="field-label">标签</label>
          <input v-model="knowledgeForm.tags" class="form-input" placeholder="上传, GLB, 排查" />
        </div>
      </div>

      <div>
        <label class="field-label">来源链接</label>
        <input v-model="knowledgeForm.url" class="form-input" placeholder="https://... 可选" />
      </div>

      <div>
        <label class="field-label">知识内容</label>
        <textarea
          v-model="knowledgeForm.content"
          class="form-textarea min-h-[16rem]"
          placeholder="写入 FAQ、业务规则、审核标准、项目说明或客服口径。启用后机器人生成回复会参考这些内容。"
        ></textarea>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button @click="emit('close')">取消</Button>
        <Button variant="primary" :loading="isKnowledgeSaving" @click="emit('save')">
          <span class="inline-flex items-center gap-1.5">
            <Save class="h-4 w-4" />
            保存知识源
          </span>
        </Button>
      </div>
    </template>
  </Modal>
</template>

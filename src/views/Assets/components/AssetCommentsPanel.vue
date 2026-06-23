<script setup lang="ts">
import { MessageSquare, Plus, Trash2 } from 'lucide-vue-next';
import { formatDateTime as formatDate } from '@/utils/format';
import type { AssetAnnotation } from './types';
import UiButton from '@/components/ui/Button.vue';

defineProps<{
  annotations: AssetAnnotation[];
  canAnnotate: boolean;
  isAddingAnnotation: boolean;
  annotationCoords: { x: number; y: number; z: number } | null;
  newAnnotationText: string;
  currentUserId: string;
  assetUserId: string;
}>();

const emit = defineEmits<{
  'update:newAnnotationText': [value: string];
  save: [];
  delete: [annotationId: string];
  click: [annotation: AssetAnnotation];
}>();
</script>

<template>
  <div class="comments-panel">
    <div class="comment-tip" :data-disabled="!canAnnotate">
      <MessageSquare class="h-5 w-5" />
      <span>
        {{
          canAnnotate
            ? '点击模型表面可添加空间评论，评论会绑定当前视角。'
            : '你可以查看批注；新增批注需要团队、所有者或管理员权限。'
        }}
      </span>
    </div>
    <div v-if="isAddingAnnotation && annotationCoords" class="comment-editor">
      <span
        >X {{ annotationCoords.x.toFixed(2) }} · Y {{ annotationCoords.y.toFixed(2) }} · Z
        {{ annotationCoords.z.toFixed(2) }}</span
      >
      <textarea
        :value="newAnnotationText"
        rows="3"
        placeholder="输入评论内容"
        @input="emit('update:newAnnotationText', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <UiButton variant="primary" :icon="Plus" @click="emit('save')">保存评论</UiButton>
    </div>
    <article
      v-for="annotation in annotations"
      :key="annotation.id"
      class="comment-card"
      @click="emit('click', annotation)"
    >
      <div class="mobile-row">
        <strong>{{ annotation.user?.name || '团队成员' }}</strong>
        <span>{{ formatDate(annotation.createdAt) }}</span>
      </div>
      <p>{{ annotation.content }}</p>
      <button
        v-if="annotation.userId === currentUserId || assetUserId === currentUserId"
        type="button"
        @click.stop="emit('delete', annotation.id)"
      >
        <Trash2 class="h-4 w-4" />
      </button>
    </article>
    <div v-if="annotations.length === 0" class="empty-panel">暂无评论</div>
  </div>
</template>

<style scoped>
.comments-panel {
  display: block;
}

.comment-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #fbfaff;
  padding: 12px;
  color: #6757ff;
}

.comment-tip[data-disabled='true'] {
  color: #64748b;
  background: #f8fafc;
}

.comment-editor {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
}

.comment-editor span {
  display: block;
  margin-top: 4px;
  color: #7b879d;
  font-size: 12px;
}

.comment-editor textarea {
  width: 100%;
  border: 1px solid #e2e8f2;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  outline: 0;
  resize: vertical;
}

.comment-editor button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: #6757ff;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
}

.comment-card {
  position: relative;
  margin-top: 10px;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
  cursor: pointer;
}

.comment-card > div {
  display: flex;
  align-items: center;
  gap: 12px;
}

.comment-card strong {
  color: #192640;
}

.comment-card span {
  display: block;
  margin-top: 4px;
  color: #7b879d;
  font-size: 12px;
}

.comment-card p {
  color: #65718b;
  font-size: 13px;
  line-height: 1.7;
}

.comment-card button {
  position: absolute;
  right: 10px;
  top: 10px;
  border: 0;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
}

.empty-panel {
  display: grid;
  place-items: center;
  min-height: 120px;
  color: #7b879d;
  font-size: 13px;
}
</style>

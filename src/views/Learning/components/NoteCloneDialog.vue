<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  visibility: string;
  tags?: string;
  category?: string;
  views: number;
  isPinned: boolean;
  isPopular: boolean;
  isLiked: boolean;
  userId: string;
  _count: { likes: number; comments: number };
  user: { id: string; name: string; avatarUrl: string; bio?: string };
  createdAt: string;
  updatedAt: string;
}

const props = defineProps<{
  myNotebooksList: string[];
}>();

const emit = defineEmits<{
  (e: 'cloned', targetCategory: string): void;
}>();

const visible = ref(false);
const cloningNote = ref<Note | null>(null);
const targetCategory = ref('');
const cloning = ref(false);

const open = (note: Note) => {
  cloningNote.value = note;
  targetCategory.value = note.category || '';
  visible.value = true;
};

const handleClone = async () => {
  if (!cloningNote.value) return;
  cloning.value = true;
  try {
    const cat = targetCategory.value.trim() || '默认笔记本';
    const payload = {
      title: cloningNote.value.title,
      content: cloningNote.value.content,
      summary: cloningNote.value.summary || undefined,
      visibility: 'PRIVATE',
      category: cat,
      tags: cloningNote.value.tags || undefined,
    };
    await api.post('/api/notes', payload);
    ElMessage.success(`已成功转存至笔记本「${cat}」！`);

    emit('cloned', cat);
    visible.value = false;
  } catch {
    ElMessage.error('转存失败');
  } finally {
    cloning.value = false;
  }
};

defineExpose({ open });
</script>

<template>
  <Modal :show="visible" title="一键转存笔记" size="sm" @close="visible = false">
    <div v-if="cloningNote" class="mobile-adaptive space-y-4">
      <div class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-[var(--border-base)]">
        <p class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-1">
          转存作品
        </p>
        <h4 class="text-xs font-bold text-[var(--text-primary)] truncate">
          {{ cloningNote.title }}
        </h4>
        <p class="text-[10px] text-[var(--text-muted)] mt-0.5">作者: {{ cloningNote.user.name }}</p>
      </div>

      <div>
        <label
          class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2 block"
          >选择目标笔记本</label
        >
        <Select
          v-model="targetCategory"
          placeholder="请选择或输入分类"
          class="!w-full note-filter-select"
          filterable
          allow-create
          default-first-option
        >
          <SelectOption label="默认笔记本" value="默认笔记本" />
          <SelectOption v-for="cat in props.myNotebooksList" :key="cat" :label="cat" :value="cat" />
        </Select>
      </div>
    </div>
    <template #footer>
      <div class="mobile-row flex justify-end gap-2">
        <Button variant="secondary" size="sm" @click="visible = false">取消</Button>
        <Button
          variant="primary"
          size="sm"
          class="font-bold"
          :loading="cloning"
          @click="handleClone"
        >
          确认转存
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import { Edit3, Layout, Eye, Settings, Check, BookOpen, X } from 'lucide-vue-next';
import api from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
const TiptapMarkdownEditor = defineAsyncComponent(
  () => import('@/components/editor/TiptapMarkdownEditor.vue'),
);
const useTiptapEditor = import.meta.env.VITE_USE_TIPTAP === 'true';

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
  (e: 'saved', category: string): void;
}>();

const modeOptions = [
  { id: 'edit', label: '编辑', icon: Edit3 },
  { id: 'live', label: '实时', icon: Layout },
  { id: 'preview', label: '预览', icon: Eye },
];

const visibilityOptions = [
  { id: 'PRIVATE', label: '私有' },
  { id: 'PUBLIC', label: '公开' },
];

const visible = ref(false);
const previewMode = ref<'edit' | 'live' | 'preview'>('edit');
const editingNote = ref<Note | null>(null);

const formTitle = ref('');
const formContent = ref('');
const formSummary = ref('');
const formVisibility = ref('PRIVATE');
const formTags = ref('');
const formCategory = ref('');
const saving = ref(false);

const open = (note?: Note) => {
  if (note) {
    editingNote.value = note;
    formTitle.value = note.title;
    formContent.value = note.content;
    formSummary.value = note.summary || '';
    formVisibility.value = note.visibility;
    formTags.value = note.tags
      ? Array.isArray(JSON.parse(note.tags))
        ? JSON.parse(note.tags).join(', ')
        : note.tags
      : '';
    formCategory.value = note.category || '';
  } else {
    editingNote.value = null;
    formTitle.value = '';
    formContent.value = '';
    formSummary.value = '';
    formVisibility.value = 'PRIVATE';
    formTags.value = '';
    formCategory.value = '';
  }
  previewMode.value = 'edit';
  visible.value = true;
};

const handleSave = async () => {
  if (!formTitle.value.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  if (!formContent.value.trim()) {
    ElMessage.warning('请输入内容');
    return;
  }

  saving.value = true;
  try {
    const payload = {
      title: formTitle.value.trim(),
      content: formContent.value.trim(),
      summary: formSummary.value.trim() || undefined,
      visibility: formVisibility.value,
      tags: formTags.value
        ? JSON.stringify(
            formTags.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          )
        : undefined,
      category: formCategory.value.trim() || undefined,
    };

    if (editingNote.value) {
      await api.put(`/api/notes/${editingNote.value.id}`, payload);
      ElMessage.success('笔记已更新');
    } else {
      await api.post('/api/notes', payload);
      ElMessage.success('笔记已创建');
    }

    emit('saved', formCategory.value.trim());
    visible.value = false;
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

defineExpose({ open });
</script>

<template>
  <Modal
    :show="visible"
    size="presentation"
    variant="glass"
    padding="none"
    :show-close="false"
    content-class="note-editor-modal-shell"
    :surface-style="{
      width: 'calc(100dvw - clamp(16px, 3vw, 48px))',
      height: 'calc(100dvh - clamp(16px, 3vw, 48px))',
      maxWidth: 'none',
      maxHeight: 'none',
    }"
    @close="visible = false"
  >
    <div class="h-full min-h-0 flex flex-col bg-transparent overflow-hidden">
      <header
        class="shrink-0 z-50 h-14 md:h-16 flex items-center justify-between px-3 md:px-8 bg-white/15 dark:bg-black/10 backdrop-blur-md border-b border-[var(--border-base)]"
      >
        <!-- Left spacer to push content to the right -->
        <div class="flex items-center"></div>

        <div class="mobile-row flex items-center gap-2 md:gap-3 min-w-0">
          <SegmentedControl v-model="previewMode" :options="modeOptions" size="sm" />

          <Dropdown trigger="click" class="lg:hidden">
            <Button
              variant="secondary"
              size="sm"
              :icon="Settings"
              class="!rounded-full !p-0 flex items-center justify-center h-8 w-8 !bg-[var(--bg-card)]"
            />
            <template #dropdown>
              <div class="p-4 w-72 md:w-80 space-y-4">
                <div>
                  <p
                    class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2"
                  >
                    笔记摘要
                  </p>
                  <textarea
                    v-model="formSummary"
                    rows="2"
                    placeholder="简短摘要..."
                    class="w-full text-xs font-medium rounded-xl transition-all duration-300 outline-none focus:outline-none bg-slate-50 dark:bg-zinc-900 border border-[var(--border-base)] text-[var(--text-primary)] focus:border-accent p-2 focus:ring-2 focus:ring-accent/20"
                  ></textarea>
                </div>
                <div>
                  <p
                    class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2"
                  >
                    可见性
                  </p>
                  <SegmentedControl
                    v-model="formVisibility"
                    :options="visibilityOptions"
                    size="sm"
                    full-width
                  />
                </div>
                <div>
                  <p
                    class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2"
                  >
                    分类/笔记本
                  </p>
                  <Select
                    v-model="formCategory"
                    placeholder="选择或输入笔记本"
                    size="small"
                    class="w-full note-filter-select"
                    filterable
                    allow-create
                    default-first-option
                    clearable
                  >
                    <SelectOption label="默认笔记本" value="默认笔记本" />
                    <SelectOption
                      v-for="cat in props.myNotebooksList"
                      :key="cat"
                      :label="cat"
                      :value="cat"
                    />
                  </Select>
                </div>
                <div>
                  <p
                    class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2"
                  >
                    标签
                  </p>
                  <Input v-model="formTags" placeholder="多个标签用逗号分隔" />
                </div>
              </div>
            </template>
          </Dropdown>
          <Button
            variant="primary"
            size="md"
            class="font-bold shadow-lg shrink-0"
            :loading="saving"
            @click="handleSave"
          >
            发布
          </Button>

          <!-- Close Button on the right -->
          <Button
            variant="secondary"
            size="sm"
            :icon="X"
            class="!rounded-full hover:bg-slate-100 dark:hover:bg-white/10 shrink-0 !p-0 flex items-center justify-center h-8 w-8"
            @click="visible = false"
          />
        </div>
      </header>

      <main
        class="flex-1 min-h-0 overflow-y-auto custom-scrollbar max-w-[1550px] mx-auto px-3 md:px-6 pb-20 md:pb-24 pt-4 lg:pt-8 w-full"
      >
        <div class="flex flex-col lg:flex-row gap-6 items-start">
          <!-- Left Column: Writing area -->
          <div
            class="glass-real-physical flex-1 min-w-0 w-full border border-[var(--border-base)] shadow-sm rounded-2xl min-h-[80vh] px-4 md:px-8 lg:px-10 py-6 md:py-12"
          >
            <input
              v-model="formTitle"
              type="text"
              placeholder="无标题"
              class="w-full bg-transparent text-xl md:text-3xl font-extrabold text-[var(--text-primary)] outline-none border-none mb-4 placeholder-slate-300 dark:placeholder-zinc-700"
            />
            <TiptapMarkdownEditor
              v-if="useTiptapEditor"
              v-model="formContent"
              :auto-focus="true"
              class="modern-paper-theme"
            />
            <MarkdownEditor
              v-else
              v-model="formContent"
              auto-height
              class="modern-paper-theme"
              :auto-focus="true"
              :preview="previewMode === 'live'"
              :preview-only="previewMode === 'preview'"
            />
            <div
              class="mt-6 md:mt-12 flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest pt-4 md:pt-8 border-t border-[var(--border-base)]"
            >
              <div class="flex items-center gap-4">
                <span class="flex items-center gap-1"><Check class="w-3 h-3" /> 自动保存</span>
                <span class="hidden sm:flex items-center gap-1"
                  ><BookOpen class="w-3 h-3" /> Markdown 支持</span
                >
              </div>
              <span>共 {{ formContent.length }} 字符</span>
            </div>
          </div>

          <!-- Right Column: Permanent sidebar settings on desktop (lg and up) -->
          <aside
            class="glass-real-physical hidden lg:flex flex-col w-80 shrink-0 border border-[var(--border-base)] rounded-2xl p-5 space-y-5 shadow-sm sticky top-4"
          >
            <div class="border-b border-[var(--border-base)] pb-3">
              <h3
                class="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5"
              >
                <Settings class="w-4 h-4 text-accent" /> 笔记属性设置
              </h3>
            </div>

            <div class="space-y-4">
              <div>
                <p
                  class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2"
                >
                  笔记摘要
                </p>
                <textarea
                  v-model="formSummary"
                  rows="3"
                  placeholder="简短摘要有助于读者在动态中快速了解..."
                  class="w-full text-xs font-medium rounded-xl transition-all duration-300 outline-none focus:outline-none bg-slate-50 dark:bg-zinc-900 border border-[var(--border-base)] text-[var(--text-primary)] focus:border-accent p-3 focus:ring-2 focus:ring-accent/20"
                ></textarea>
              </div>
              <div>
                <p
                  class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2"
                >
                  可见性
                </p>
                <SegmentedControl
                  v-model="formVisibility"
                  :options="visibilityOptions"
                  size="sm"
                  full-width
                />
              </div>
              <div>
                <p
                  class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2"
                >
                  分类/笔记本
                </p>
                <Select
                  v-model="formCategory"
                  placeholder="选择或输入笔记本"
                  size="small"
                  class="w-full note-filter-select"
                  filterable
                  allow-create
                  default-first-option
                  clearable
                >
                  <SelectOption label="默认笔记本" value="默认笔记本" />
                  <SelectOption
                    v-for="cat in props.myNotebooksList"
                    :key="cat"
                    :label="cat"
                    :value="cat"
                  />
                </Select>
              </div>
              <div>
                <p
                  class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2"
                >
                  标签
                </p>
                <Input v-model="formTags" placeholder="多个标签用逗号分隔" />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  </Modal>
</template>

<style scoped>
:global(.note-editor-modal-shell) {
  border-radius: 20px;
}

.preview-mode-toggle {
  background-color: var(--bg-app);
  padding: 2px;
  border-radius: 8px;
  border: 1px solid var(--border-base);
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
</style>

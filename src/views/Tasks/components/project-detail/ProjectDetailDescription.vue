<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import Button from '@/components/ui/Button.vue';

const { t } = useI18n();

interface Props {
  description?: string | null;
  isEditing: boolean;
  tempText: string;
  tempImages: string[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'start-edit'): void;
  (e: 'save'): void;
  (e: 'cancel'): void;
  (e: 'update:tempText', value: string): void;
  (e: 'update:tempImages', value: string[]): void;
  (e: 'paste', event: ClipboardEvent): void;
  (e: 'open-image', url: string): void;
}>();

const parseCommentContent = (content: string) => {
  if (!content) return { text: '', images: [] };
  const regex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    images.push(match[1]);
  }
  const cleanText = content.replace(regex, '').trim();
  return {
    text: cleanText,
    images,
  };
};

const removeImage = (index: number, images: string[]) => {
  const updated = [...images];
  updated.splice(index, 1);
  emit('update:tempImages', updated);
};
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-1.5 ml-1">
      <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {{ t('projects.projectVision') }}
      </h4>
      <button
        v-if="!isEditing"
        type="button"
        class="text-[10px] font-bold text-accent hover:underline cursor-pointer"
        @click="emit('start-edit')"
      >
        编辑描述
      </button>
    </div>

    <div v-if="isEditing" class="space-y-2">
      <textarea
        :value="tempText"
        placeholder="输入项目描述... (支持粘贴图片)"
        rows="4"
        class="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/45 transition-all resize-y"
        style="color: var(--text-primary)"
        @input="emit('update:tempText', ($event.target as HTMLTextAreaElement).value)"
        @paste="emit('paste', $event)"
      ></textarea>

      <div
        v-if="tempImages.length > 0"
        class="flex flex-wrap gap-1.5 p-1.5 bg-slate-50/50 dark:bg-white/2 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg"
      >
        <div
          v-for="(img, idx) in tempImages"
          :key="img"
          class="relative group w-12 h-12 rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          <img
            :src="img"
            class="w-full h-full object-cover cursor-zoom-in"
            @click="emit('open-image', img)"
          />
          <button
            type="button"
            class="absolute top-0.5 right-0.5 p-0.5 bg-black/55 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer flex items-center justify-center"
            @click="removeImage(idx, tempImages)"
          >
            <X class="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          class="!py-1 !px-2.5 !h-7 !text-[10px]"
          @click="emit('cancel')"
        >
          取消
        </Button>
        <Button
          variant="primary"
          size="sm"
          class="!py-1 !px-2.5 !h-7 !text-[10px]"
          @click="emit('save')"
        >
          保存
        </Button>
      </div>
    </div>

    <div
      v-else
      class="p-3 bg-slate-50 dark:bg-slate-800/20 rounded-xl border text-left cursor-pointer hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-all"
      style="border-color: var(--border-base)"
      @click="emit('start-edit')"
    >
      <div
        v-if="!description"
        class="text-xs text-slate-400 dark:text-slate-500 italic py-2 text-center select-none"
      >
        + 点击添加详细项目愿景...
      </div>
      <div
        v-else
        class="text-xs leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300 space-y-2"
      >
        <p>{{ parseCommentContent(description).text }}</p>
        <div
          v-if="parseCommentContent(description).images.length > 0"
          class="flex flex-wrap gap-2 pt-1"
        >
          <img
            v-for="img in parseCommentContent(description).images"
            :key="img"
            :src="img"
            class="max-w-full max-h-[150px] rounded-lg border object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
            style="border-color: var(--border-base)"
            @click.stop="emit('open-image', img)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

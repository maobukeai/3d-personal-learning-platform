<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { Eye, Image as ImageIcon, Plus, Send, Sparkles, Tag, X } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import type { TagInsight } from '../DiscussionsView.vue';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

interface StarterPrompt {
  label: string;
  title: string;
  tags: string;
  content: string;
}

defineProps<{
  show: boolean;
  title: string;
  content: string;
  tags: string;
  selectedImages: File[];
  imagePreviews: string[];
  tagInsights: TagInsight[];
  starterPrompts: StarterPrompt[];
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:title', value: string): void;
  (e: 'update:content', value: string): void;
  (e: 'update:tags', value: string): void;
  (e: 'submit'): void;
  (e: 'reset'): void;
  (e: 'apply-template', template: StarterPrompt): void;
  (e: 'add-tag', tag: string): void;
  (e: 'image-select', event: Event): void;
  (e: 'remove-image', index: number): void;
}>();

const { t } = useI18n();

function handleClose() {
  emit('update:show', false);
}
</script>

<template>
  <Modal :show="show" :title="t('community.discussions.newPost')" size="xl" @close="handleClose">
    <div class="create-grid text-left">
      <section class="create-main">
        <Input
          :model-value="title"
          type="text"
          :label="t('community.discussions.postTitleLabel')"
          :placeholder="t('community.discussions.titlePlaceholder')"
          input-class="!py-2.5 !rounded-lg"
          @update:model-value="emit('update:title', $event)"
        />

        <div class="space-y-2 mt-4 text-left">
          <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">
            {{ t('community.discussions.postContentLabel') }}
          </label>
          <MarkdownEditor
            :model-value="content"
            height="380px"
            :placeholder="t('community.discussions.editorPlaceholder')"
            @update:model-value="emit('update:content', $event)"
          />
        </div>
      </section>

      <aside class="create-side">
        <section>
          <h3>
            <Sparkles class="h-4 w-4 text-accent" /> {{ t('community.discussions.quickDraft') }}
          </h3>
          <div class="template-list flex flex-wrap gap-1.5">
            <Button
              v-for="template in starterPrompts"
              :key="template.label"
              variant="outline"
              size="sm"
              class="!py-1 !px-2.5 !text-[10px] !h-auto !rounded-lg font-bold"
              @click="emit('apply-template', template)"
            >
              {{ template.label }}
            </Button>
          </div>
        </section>

        <section class="mt-4">
          <h3>
            <Tag class="h-4 w-4 text-accent" /> {{ t('community.discussions.postTagsLabel') }}
          </h3>
          <Input
            :model-value="tags"
            type="text"
            :placeholder="t('community.discussions.tagsPlaceholder')"
            input-class="!py-2 !rounded-lg !text-xs"
            @update:model-value="emit('update:tags', $event)"
          />
          <div v-if="tagInsights.length > 0" class="draft-tags flex flex-wrap gap-1.5 mt-2">
            <Button
              v-for="tagItem in tagInsights.slice(0, 10)"
              :key="tagItem.name"
              variant="secondary"
              size="sm"
              class="!py-0.5 !px-2 !text-[9px] !h-auto !rounded-md !bg-slate-100 dark:!bg-white/5 font-bold"
              @click="emit('add-tag', tagItem.name)"
            >
              #{{ tagItem.name }}
            </Button>
          </div>
        </section>

        <section class="mt-4">
          <h3>
            <ImageIcon class="h-4 w-4 text-accent" />
            {{ t('community.discussions.postImagesLabel') }}
          </h3>
          <div class="image-uploader">
            <div v-for="(image, index) in imagePreviews" :key="`${image}-${index}`">
              <img :src="image" alt="" />
              <button type="button" @click="emit('remove-image', index)">
                <X class="h-3 w-3" />
              </button>
            </div>
            <label v-if="imagePreviews.length < 5" class="cursor-pointer">
              <Plus class="h-4 w-4" />
              <span>{{ t('community.discussions.uploadImage') }}</span>
              <input type="file" accept="image/*" multiple @change="emit('image-select', $event)" />
            </label>
          </div>
        </section>

        <section
          class="draft-preview mt-4 p-3 rounded-xl border border-dashed border-base bg-white/20 dark:bg-white/5"
        >
          <h3><Eye class="h-4 w-4 text-accent" /> {{ t('community.discussions.preview') }}</h3>
          <strong class="block text-xs font-bold mb-1 truncate text-primary">{{
            title || t('community.discussions.titlePlaceholder')
          }}</strong>
          <p class="text-[10px] text-secondary line-clamp-3 leading-relaxed">
            {{ content || t('community.discussions.emptyContent') }}
          </p>
        </section>
      </aside>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-3 w-full mobile-row">
        <Button variant="outline" size="sm" @click="emit('reset')">
          {{ t('community.discussions.resetDraft') }}
        </Button>
        <Button variant="primary" size="sm" :icon="Send" @click="emit('submit')">
          {{ t('community.discussions.postSubmit') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.create-side h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.draft-tags button,
.template-list button {
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
</style>

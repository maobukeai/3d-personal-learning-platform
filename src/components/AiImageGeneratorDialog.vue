<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Sparkles, Wand2, Check } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useSystemStore } from '@/stores/system';
import type { AiModelFamilyCandidate } from '@/utils/aiModelFamilies';

interface AiImageModelOption extends AiModelFamilyCandidate {
  endpoint?: string;
  capabilities?: string[];
}
import AiGeneratorBase from '@/components/aiSprite/AiGeneratorBase.vue';
import Button from '@/components/ui/Button.vue';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';

interface Props {
  show: boolean;
  title?: string;
  type?: 'avatar' | 'cover';
}

const props = withDefaults(defineProps<Props>(), {
  title: 'AI 图像生成器',
  type: 'avatar',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', file: File): void;
}>();

const systemStore = useSystemStore();

const prompt = ref('');
const selectedModelId = ref('');
const isOptimizing = ref(false);
const isGenerating = ref(false);
const generatedImageUrl = ref('');
const errorMsg = ref('');

// Filter available image models from system settings
const imageModels = computed(() => {
  const options = systemStore.settings.AI_MODEL_OPTIONS || [];

  const isImageModel = (m: AiImageModelOption) => {
    const name = (m.modelName || '').toLowerCase();
    const endpoint = (m.endpoint || '').toLowerCase();

    if (endpoint.includes('/images/generations')) return true;

    const caps = m.capabilities || [];
    if (
      caps.some((c: string) =>
        ['draw', 'image', 'image_generation', 'paint', 'txt2img', 't2i'].includes(
          c.toLowerCase().trim(),
        ),
      )
    ) {
      return true;
    }

    return (
      name.includes('flux') ||
      name.includes('stable-diffusion') ||
      name.includes('sdxl') ||
      name.includes('sd-') ||
      name.includes('dall-e') ||
      name.includes('midjourney') ||
      name.includes('playground') ||
      name.includes('cogview') ||
      name.includes('kolors') ||
      name.includes('image-gen') ||
      name.includes('generate-image') ||
      name.includes('text-to-image') ||
      name.includes('txt2img') ||
      name.includes('t2i') ||
      /image[s]?[.-]\d/.test(name)
    );
  };

  return options.filter((m) => m.enabled && isImageModel(m));
});

// Watch show prop to reset state on open
watch(
  () => props.show,
  (val) => {
    if (val) {
      prompt.value = '';
      generatedImageUrl.value = '';
      errorMsg.value = '';
      isGenerating.value = false;
      isOptimizing.value = false;
      // Select default model if available
      if (imageModels.value.length > 0) {
        const def = imageModels.value.find((m) => m.isDefault);
        selectedModelId.value = def ? def.id : imageModels.value[0].id;
      } else {
        selectedModelId.value = '';
      }
    }
  },
);

// Optimize prompt using text LLM
const handleOptimizePrompt = async () => {
  if (!prompt.value.trim()) {
    ElMessage.warning('请先输入一些提示词，再进行智能优化');
    return;
  }

  try {
    isOptimizing.value = true;
    errorMsg.value = '';
    const { data } = await api.post('/api/ai/optimize-prompt', {
      prompt: prompt.value,
      type: props.type,
    });
    if (data.optimizedPrompt) {
      prompt.value = data.optimizedPrompt;
      ElMessage.success('提示词优化成功！');
    }
  } catch (err) {
    logError(err, { operation: 'ai.optimizePrompt', component: 'AiImageGeneratorDialog' });
    ElMessage.error(getApiErrorMessage(err, '优化提示词失败'));
  } finally {
    isOptimizing.value = false;
  }
};

// Generate image from prompt
const handleGenerateImage = async () => {
  if (!prompt.value.trim()) {
    ElMessage.warning('提示词不能为空');
    return;
  }

  try {
    isGenerating.value = true;
    errorMsg.value = '';
    generatedImageUrl.value = '';

    const { data } = await api.post('/api/ai/generate-image', {
      prompt: prompt.value,
      modelId: selectedModelId.value || undefined,
      type: props.type,
    });

    const urlOrBase64 = data.b64_json ? `data:image/png;base64,${data.b64_json}` : data.url;
    if (urlOrBase64) {
      generatedImageUrl.value = urlOrBase64;
      ElMessage.success('图片生成成功！');
    } else {
      throw new Error('未获取到生成的图片数据，请重试。');
    }
  } catch (err) {
    logError(err, { operation: 'ai.generateImage', component: 'AiImageGeneratorDialog' });
    errorMsg.value = getApiErrorMessage(err, '生成图片失败');
    ElMessage.error(errorMsg.value);
  } finally {
    isGenerating.value = false;
  }
};

// Apply and save the generated image
const handleSave = async () => {
  if (!generatedImageUrl.value) return;

  try {
    const filename = `${props.type}_ai_${Date.now()}.png`;
    let blob: Blob;

    if (generatedImageUrl.value.startsWith('data:')) {
      // Direct base64 → Blob conversion (avoids fetch(data:URL) Safari compatibility issues)
      const [header, b64] = generatedImageUrl.value.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: mime });
    } else {
      // Remote URL: fetch and convert
      const response = await fetch(generatedImageUrl.value);
      blob = await response.blob();
    }

    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    emit('save', file);
    emit('close');
  } catch (err) {
    logError(err, { operation: 'ai.convertImage', component: 'AiImageGeneratorDialog' });
    ElMessage.error('图片保存失败，请尝试重新生成。');
  }
};
</script>

<template>
  <AiGeneratorBase
    :show="show"
    :title="title"
    subtitle="输入您的创意构想，AI 将为您智能绘制精美画作或头像"
    :is-generating="isGenerating"
    generating-text="AI 正在努力创作中，大约需要 5 - 15 秒..."
    :error-msg="errorMsg"
    @close="emit('close')"
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
      <!-- Input Panel -->
      <div class="flex flex-col gap-4">
        <!-- Model Selection -->
        <div v-if="imageModels.length > 0" class="flex flex-col gap-1.5 text-left">
          <label class="text-xs font-bold text-[var(--text-secondary)] ml-1"
            >选择生图 AI 模型</label
          >
          <el-select
            v-model="selectedModelId"
            class="w-full custom-dialog-input"
            placeholder="选择 AI 模型"
          >
            <el-option
              v-for="m in imageModels"
              :key="m.id"
              :label="`${m.name} (${m.provider})`"
              :value="m.id"
            />
          </el-select>
        </div>

        <!-- Prompt Textarea -->
        <div class="flex flex-col gap-1.5 flex-1 min-h-[160px] text-left">
          <label
            class="text-xs font-bold text-[var(--text-secondary)] flex justify-between items-center"
          >
            <span>输入画面描述 (中英文皆可)</span>
            <span class="text-[10px] text-[var(--text-muted)]">建议使用英文描述以获得最佳效果</span>
          </label>
          <div class="relative flex-1 flex flex-col">
            <textarea
              v-model="prompt"
              rows="6"
              placeholder="例如：一个可爱的 3D 风格的宇航员猫咪头像，治愈系泥塑风，背景是深蓝色星空，柔和光影，高级质感..."
              class="w-full flex-1 bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-primary)] rounded-lg p-3 text-sm outline-none focus:border-accent resize-none placeholder-[var(--text-muted)]"
              :disabled="isGenerating || isOptimizing"
            ></textarea>

            <!-- Optimize Button inside Textarea overlay -->
            <button
              v-if="prompt.trim()"
              type="button"
              class="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 bg-accent/20 hover:bg-accent/35 text-accent text-xs font-bold rounded-md transition-all border border-accent/20 cursor-pointer"
              :disabled="isOptimizing || isGenerating"
              @click="handleOptimizePrompt"
            >
              <Wand2 class="w-3.5 h-3.5" :class="{ 'animate-spin': isOptimizing }" />
              {{ isOptimizing ? '优化中...' : '优化提示词' }}
            </button>
          </div>
        </div>

        <!-- Generate Action -->
        <Button
          variant="primary"
          class="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-md border-none flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
          :disabled="isGenerating || isOptimizing || !prompt.trim()"
          @click="handleGenerateImage"
        >
          <Sparkles class="w-4 h-4" :class="{ 'animate-pulse': isGenerating }" />
          {{ isGenerating ? '正在生成中...' : '生成 AI 图像' }}
        </Button>
      </div>

      <!-- Preview Panel -->
      <div
        class="flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40 p-4 min-h-[300px] relative overflow-hidden"
      >
        <!-- Result image -->
        <div
          v-if="generatedImageUrl"
          class="w-full h-full flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in-95 duration-300"
        >
          <div
            class="overflow-hidden rounded-xl border border-slate-800 shadow-2xl relative bg-slate-900 group"
            :class="props.type === 'avatar' ? 'w-48 h-48 rounded-full' : 'w-full aspect-[21/9]'"
          >
            <img
              :src="generatedImageUrl"
              class="w-full h-full object-cover select-none pointer-events-none"
              alt="Generated Result"
            />
          </div>
          <p class="text-xs text-slate-400 text-center">如果不满意，可以修改提示词重新生成</p>
        </div>

        <!-- Placeholder -->
        <div v-else class="flex flex-col items-center gap-3 text-slate-500 text-center p-6">
          <div class="p-4 bg-slate-900/60 rounded-full border border-slate-800">
            <Sparkles class="w-8 h-8 text-slate-400 opacity-60" />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-bold text-slate-400">图像预览区域</p>
            <p class="text-xs text-slate-500 max-w-[200px] mx-auto">
              在左侧输入你的创意构想，点击生成后在此处查看结果
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer buttons -->
    <template #actions>
      <Button variant="secondary" :disabled="isGenerating || isOptimizing" @click="emit('close')">
        取消
      </Button>
      <Button
        variant="primary"
        class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-none"
        :disabled="!generatedImageUrl || isGenerating || isOptimizing"
        @click="handleSave"
      >
        <Check class="w-4 h-4" />
        使用该图片
      </Button>
    </template>
  </AiGeneratorBase>
</template>

<style scoped>
/* Focus borders */
textarea:focus,
select:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
</style>

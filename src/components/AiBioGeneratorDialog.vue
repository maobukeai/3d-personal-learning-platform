<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Sparkles, Wand2, X, Check, AlertCircle, Plus } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';

interface Props {
  show: boolean;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'AI 个人简介生成器',
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', bio: string): void;
}>();

const selectedRole = ref('3D 艺术家');
const customRole = ref('');
const selectedSkills = ref<string[]>(['Three.js', 'Blender']);
const customSkill = ref('');
const selectedTone = ref<'balanced' | 'professional' | 'friendly' | 'academic' | 'concise'>(
  'balanced',
);
const additionalRequirements = ref('');

const isGenerating = ref(false);
const generatedBio = ref('');
const errorMsg = ref('');

// Predefined roles for quick selection
const predefinedRoles = [
  '3D 艺术家',
  'WebGL 开发者',
  'UI/UX 设计师',
  '全栈工程师',
  '3D 爱好者',
  '其他',
];

// Predefined skills for quick selection
const predefinedSkills = [
  'Three.js',
  'Blender',
  'WebGL',
  'Shader',
  'Vue.js',
  'TypeScript',
  'React',
  'Spline',
  'Unity',
  'GLSL',
];

const tones = [
  { value: 'balanced', label: '自然克制' },
  { value: 'professional', label: '专业干练' },
  { value: 'friendly', label: '亲切风趣' },
  { value: 'concise', label: '极其简练' },
] as const;

// Watch show prop to reset state on open
watch(
  () => props.show,
  (val) => {
    if (val) {
      generatedBio.value = '';
      errorMsg.value = '';
      isGenerating.value = false;
      // Reset to defaults
      selectedRole.value = '3D 艺术家';
      customRole.value = '';
      selectedSkills.value = ['Three.js', 'Blender'];
      customSkill.value = '';
      selectedTone.value = 'balanced';
      additionalRequirements.value = '';
    }
  },
);

// Add custom skill tag
const addCustomSkill = () => {
  const tag = customSkill.value.trim();
  if (tag) {
    if (!selectedSkills.value.includes(tag)) {
      selectedSkills.value.push(tag);
    }
    customSkill.value = '';
  }
};

// Toggle a skill selection
const toggleSkill = (skill: string) => {
  const idx = selectedSkills.value.indexOf(skill);
  if (idx > -1) {
    selectedSkills.value.splice(idx, 1);
  } else {
    selectedSkills.value.push(skill);
  }
};

// Remove a selected skill chip
const removeSkill = (skill: string) => {
  const idx = selectedSkills.value.indexOf(skill);
  if (idx > -1) {
    selectedSkills.value.splice(idx, 1);
  }
};

// Compute prompt for write-assist service
const prompt = computed(() => {
  const role = selectedRole.value === '其他' ? customRole.value.trim() : selectedRole.value;
  const skillsList = selectedSkills.value.join(', ');
  const toneLabel = tones.find((t) => t.value === selectedTone.value)?.label || '自然克制';

  let p = '请为我生成一段个人主页的个人简介（Bio）。';
  if (role) {
    p += `我的角色定位是：${role}。`;
  }
  if (skillsList) {
    p += `我擅长的技术和工都可以有：${skillsList}。`;
  }
  if (additionalRequirements.value.trim()) {
    p += `补充要求：${additionalRequirements.value.trim()}。`;
  }
  p += `要求：请用 ${toneLabel} 的语气，控制在 100-150 字以内，字句精炼、顺畅，展现专业感和个人魅力。请直接输出简介内容本身，千万不要包含任何旁白、JSON包裹、代码块或Markdown标记。`;
  return p;
});

const handleGenerateBio = async () => {
  if (selectedRole.value === '其他' && !customRole.value.trim()) {
    ElMessage.warning('请填写自定义角色定位');
    return;
  }

  isGenerating.value = true;
  generatedBio.value = '';
  errorMsg.value = '';

  try {
    const response = await fetch('/api/ai/write-assist', {
      method: 'POST',
      headers: createJsonHeaders(),
      body: JSON.stringify({
        action: 'generate',
        prompt: prompt.value,
        text: '',
        tone: selectedTone.value,
        length: 'short',
        format: 'keep',
      }),
    });

    if (!response.ok) {
      const errMsg = await readFetchErrorMessage(response);
      throw new Error(errMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('流式读取不受支持');

    await parseSSEStream(
      reader,
      (payload) => {
        if (payload.text) {
          generatedBio.value += payload.text;
        }
      },
      () => {
        isGenerating.value = false;
        ElMessage.success('个人简介生成成功！');
      },
      (err) => {
        console.error('SSE Stream error:', err);
        errorMsg.value = err.message || '生成中途发生错误';
        ElMessage.error(errorMsg.value);
        isGenerating.value = false;
      },
    );
  } catch (err: any) {
    console.error('Generate bio error:', err);
    errorMsg.value = err.message || '生成失败';
    ElMessage.error(errorMsg.value);
    isGenerating.value = false;
  }
};

const handleSave = () => {
  const finalBio = generatedBio.value.trim();
  if (!finalBio) return;
  emit('save', finalBio);
  emit('close');
};
</script>

<template>
  <Modal
    :show="show"
    :title="title"
    size="lg"
    @close="emit('close')"
    class="ai-bio-generator-modal"
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
      <!-- Input Panel -->
      <div class="flex flex-col gap-4">
        <!-- Role Selection -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold text-[var(--text-secondary)]">职业 / 角色定位</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="role in predefinedRoles"
              :key="role"
              type="button"
              class="px-2.5 py-1 text-xs rounded-md border border-[var(--border-base)] transition-all cursor-pointer"
              :class="
                selectedRole === role
                  ? 'bg-accent/10 text-accent border-accent/30 font-bold'
                  : 'bg-[var(--bg-app)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]'
              "
              @click="selectedRole = role"
            >
              {{ role }}
            </button>
          </div>
          <div v-if="selectedRole === '其他'" class="mt-1">
            <input
              v-model="customRole"
              type="text"
              placeholder="请输入您的角色定位，例如：三维动作设计师"
              class="w-full bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
            />
          </div>
        </div>

        <!-- Skills Selection -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold text-[var(--text-secondary)]"
            >专业技能 / 擅长工具 (可选)</label
          >

          <!-- Selected skill tags -->
          <div
            v-if="selectedSkills.length > 0"
            class="flex flex-wrap gap-1.5 p-2 bg-[var(--bg-app)]/50 rounded-lg border border-[var(--border-base)] min-h-[38px] items-center"
          >
            <span
              v-for="skill in selectedSkills"
              :key="skill"
              class="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/20 text-accent text-xs rounded font-medium"
            >
              {{ skill }}
              <X class="w-3 h-3 cursor-pointer hover:text-rose-500" @click="removeSkill(skill)" />
            </span>
          </div>

          <!-- Predefined quick selection chips -->
          <div class="flex flex-wrap gap-1.5 mt-1">
            <button
              v-for="skill in predefinedSkills"
              :key="skill"
              type="button"
              class="px-2 py-0.5 text-[11px] rounded transition-all cursor-pointer"
              :class="
                selectedSkills.includes(skill)
                  ? 'bg-accent text-white font-bold'
                  : 'bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              "
              @click="toggleSkill(skill)"
            >
              {{ skill }}
            </button>
          </div>

          <!-- Custom skill input -->
          <div class="flex gap-1.5 mt-1">
            <input
              v-model="customSkill"
              type="text"
              placeholder="输入其他技能，按 Enter 键添加"
              class="flex-1 bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-primary)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
              @keydown.enter.prevent="addCustomSkill"
            />
            <Button
              type="button"
              variant="secondary"
              class="px-3 h-[32px] flex items-center justify-center border border-[var(--border-base)] bg-[var(--bg-app)] hover:bg-[var(--border-base)] rounded-lg"
              @click="addCustomSkill"
            >
              <Plus class="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <!-- Tone Selection -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold text-[var(--text-secondary)]">风格语气</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="tone in tones"
              :key="tone.value"
              type="button"
              class="py-2 text-xs rounded-lg border border-[var(--border-base)] transition-all cursor-pointer text-center"
              :class="
                selectedTone === tone.value
                  ? 'bg-accent/10 text-accent border-accent/30 font-bold'
                  : 'bg-[var(--bg-app)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              "
              @click="selectedTone = tone.value"
            >
              {{ tone.label }}
            </button>
          </div>
        </div>

        <!-- Additional Requirements -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-bold text-[var(--text-secondary)]"
            >补充要求 / 个人亮点 (可选)</label
          >
          <textarea
            v-model="additionalRequirements"
            rows="2"
            placeholder="例如：突出自己对三维交互和WebGL开发的热爱，或者目前正在寻找远程合作机会..."
            class="w-full bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-primary)] rounded-lg p-2.5 text-xs outline-none focus:border-accent resize-none placeholder-[var(--text-muted)]"
          ></textarea>
        </div>

        <!-- Generate Action -->
        <Button
          variant="primary"
          class="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-md border-none flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
          :disabled="isGenerating || (selectedRole === '其他' && !customRole.trim())"
          @click="handleGenerateBio"
        >
          <Sparkles class="w-4 h-4" :class="{ 'animate-pulse': isGenerating }" />
          {{ isGenerating ? '正在分析并生成中...' : '生成 AI 个人简介' }}
        </Button>
      </div>

      <!-- Preview Panel -->
      <div
        class="flex flex-col border border-dashed border-slate-800 rounded-xl bg-slate-950/40 p-4 min-h-[300px] relative overflow-hidden"
      >
        <!-- Result editor -->
        <div v-if="generatedBio || isGenerating" class="w-full h-full flex flex-col gap-3 flex-1">
          <label class="text-xs font-bold text-[var(--text-secondary)]"
            >生成结果 (支持直接在此处编辑微调)</label
          >
          <textarea
            v-model="generatedBio"
            class="w-full flex-1 bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-primary)] rounded-lg p-3.5 text-sm outline-none focus:border-accent resize-none line-height-relaxed font-sans placeholder-[var(--text-muted)]"
            placeholder="AI 正在为您起草简介，请稍候..."
            :disabled="isGenerating"
          ></textarea>
          <div class="flex justify-between items-center text-xs text-slate-500">
            <span>{{ generatedBio.length }} 字</span>
            <span>修改满意后，点击右下角应用</span>
          </div>
        </div>

        <!-- Placeholder -->
        <div
          v-else
          class="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500 text-center p-6"
        >
          <div class="p-4 bg-slate-900/60 rounded-full border border-slate-800">
            <Wand2 class="w-8 h-8 text-slate-400 opacity-60" />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-bold text-slate-400">个人简介预览区</p>
            <p class="text-xs text-slate-500 max-w-[220px] mx-auto">
              在左侧勾选或填写你的信息，点击生成，即可在这里预览并调整生成的个人简介
            </p>
          </div>
        </div>

        <!-- Loading overlay spinner -->
        <div
          v-if="isGenerating && !generatedBio"
          class="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center gap-4 text-center"
        >
          <div
            class="w-10 h-10 rounded-full border-4 border-indigo-600/20 border-t-indigo-500 animate-spin"
          ></div>
          <div class="space-y-1">
            <p class="text-sm font-bold text-slate-200">AI 正在构思精美简介...</p>
            <p class="text-xs text-slate-500">请稍候数秒</p>
          </div>
        </div>

        <!-- Error state -->
        <div
          v-if="errorMsg"
          class="absolute bottom-4 left-4 right-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 animate-in slide-in-from-bottom-2 duration-300"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ errorMsg }}</span>
        </div>
      </div>
    </div>

    <!-- Footer buttons -->
    <template #footer>
      <Button variant="secondary" @click="emit('close')" :disabled="isGenerating"> 取消 </Button>
      <Button
        variant="primary"
        class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-none"
        :disabled="!generatedBio.trim() || isGenerating"
        @click="handleSave"
      >
        <Check class="w-4 h-4" />
        使用该简介
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
/* Focus borders */
textarea:focus,
input:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
.line-height-relaxed {
  line-height: 1.6;
}
</style>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ImagePlus, Save, Trash2 } from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import { getApiErrorMessage } from '@/utils/error';
import type { TutorialStep } from '../tutorialPackageTypes';

const props = defineProps<{ step: TutorialStep }>();
const emit = defineEmits<{ (event: 'changed'): void }>();
const busy = ref(false);
const form = reactive({
  title: '',
  description: '',
  order: 1,
  startTime: 0,
  endTime: 0,
  shortcuts: '',
  warnings: '',
  parameters: '',
});

const sync = () => {
  form.title = props.step.title;
  form.description = props.step.description;
  form.order = props.step.order;
  form.startTime = props.step.startTime;
  form.endTime = props.step.endTime;
  form.shortcuts = (props.step.shortcuts || []).join(', ');
  form.warnings = (props.step.warnings || []).join('\n');
  form.parameters = (props.step.parameters || [])
    .map((item) => `${item.name}=${item.value}`)
    .join('\n');
};
watch(() => props.step, sync, { immediate: true, deep: true });

const payload = () => ({
  title: form.title.trim(),
  description: form.description,
  order: Number(form.order),
  startTime: Number(form.startTime),
  endTime: Number(form.endTime),
  shortcuts: form.shortcuts
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  warnings: form.warnings
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean),
  parameters: form.parameters
    .split('\n')
    .map((line) => {
      const [name, ...rest] = line.split('=');
      return { name: name?.trim() || '', value: rest.join('=').trim() };
    })
    .filter((item) => item.name),
});

const save = async () => {
  if (!form.title.trim()) return ElMessage.warning('请输入步骤标题');
  busy.value = true;
  try {
    await api.patch(`/api/courses/tutorial-steps/${props.step.id}`, payload());
    ElMessage.success('步骤已保存');
    emit('changed');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存步骤失败'));
  } finally {
    busy.value = false;
  }
};

const remove = async () => {
  if (!window.confirm(`确定删除步骤“${props.step.title}”吗？`)) return;
  busy.value = true;
  try {
    await api.delete(`/api/courses/tutorial-steps/${props.step.id}`);
    emit('changed');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '删除步骤失败'));
  } finally {
    busy.value = false;
  }
};

const replaceImage = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const data = new FormData();
  data.append('image', file);
  busy.value = true;
  try {
    await api.post(`/api/courses/tutorial-steps/${props.step.id}/image`, data);
    ElMessage.success('参考图已替换');
    emit('changed');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '替换参考图失败'));
  } finally {
    busy.value = false;
    (event.target as HTMLInputElement).value = '';
  }
};

const removeImage = async () => {
  if (!props.step.imageUrl || !window.confirm('确定移除这张参考图吗？')) return;
  busy.value = true;
  try {
    await api.delete(`/api/courses/tutorial-steps/${props.step.id}/image`);
    emit('changed');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '移除参考图失败'));
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <article
    class="grid gap-3 rounded-xl border p-3 md:grid-cols-[180px_1fr]"
    style="border-color: var(--border-base); background: var(--bg-app)"
  >
    <div>
      <img
        v-if="step.imageUrl"
        :src="step.imageUrl"
        :alt="step.title"
        class="aspect-video w-full rounded-lg object-cover"
      />
      <div
        v-else
        class="flex aspect-video items-center justify-center rounded-lg border border-dashed text-xs text-slate-400"
      >
        暂无参考图
      </div>
      <label
        class="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs"
        :class="busy && 'pointer-events-none opacity-50'"
      >
        <ImagePlus class="h-3.5 w-3.5" /> 替换图片
        <input
          class="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          @change="replaceImage"
        />
      </label>
      <button
        v-if="step.imageUrl"
        class="tutorial-danger-btn mt-1 w-full justify-center"
        :disabled="busy"
        @click="removeImage"
      >
        <Trash2 class="h-3.5 w-3.5" />移除图片
      </button>
    </div>
    <div class="space-y-2">
      <div class="grid grid-cols-[1fr_70px] gap-2">
        <input v-model="form.title" class="tutorial-input" placeholder="步骤标题" /><input
          v-model.number="form.order"
          class="tutorial-input"
          type="number"
          title="顺序"
        />
      </div>
      <textarea
        v-model="form.description"
        class="tutorial-input min-h-16 w-full resize-y"
        placeholder="步骤说明"
      />
      <div class="grid grid-cols-2 gap-2">
        <input
          v-model.number="form.startTime"
          class="tutorial-input"
          type="number"
          step="0.1"
          placeholder="开始秒数"
        /><input
          v-model.number="form.endTime"
          class="tutorial-input"
          type="number"
          step="0.1"
          placeholder="结束秒数"
        />
      </div>
      <input
        v-model="form.shortcuts"
        class="tutorial-input w-full"
        placeholder="快捷键，用逗号分隔"
      />
      <div class="grid grid-cols-2 gap-2">
        <textarea
          v-model="form.parameters"
          class="tutorial-input min-h-14 resize-y"
          placeholder="参数，每行 名称=值"
        /><textarea
          v-model="form.warnings"
          class="tutorial-input min-h-14 resize-y"
          placeholder="注意事项，每行一条"
        />
      </div>
      <div class="flex justify-end gap-2">
        <button class="tutorial-danger-btn" :disabled="busy" @click="remove">
          <Trash2 class="h-3.5 w-3.5" />删除</button
        ><button class="tutorial-primary-btn" :disabled="busy" @click="save">
          <Save class="h-3.5 w-3.5" />保存步骤
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.tutorial-input {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
  padding: 7px 9px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}
.tutorial-input:focus {
  border-color: var(--color-accent);
}
.tutorial-primary-btn,
.tutorial-danger-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
}
.tutorial-primary-btn {
  background: var(--color-accent);
  color: white;
}
.tutorial-danger-btn {
  color: var(--danger);
}
.tutorial-danger-btn:hover {
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}
button:disabled {
  opacity: 0.5;
}
</style>

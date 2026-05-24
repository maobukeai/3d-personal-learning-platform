<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Loader2, CheckCircle2 } from 'lucide-vue-next';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

const props = defineProps<{
  categories: any[];
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const visible = ref(false);
const externalUrl = ref('');
const isParsing = ref(false);
const parsedMetadata = ref<any>(null);
const selectedCategoryId = ref('');

const open = () => {
  externalUrl.value = '';
  parsedMetadata.value = null;
  selectedCategoryId.value = '';
  isParsing.value = false;
  visible.value = true;
};

const handleParseExternal = async () => {
  const url = externalUrl.value?.trim();
  if (!url) return;
  try {
    isParsing.value = true;
    parsedMetadata.value = null;
    const { data } = await api.post('/api/admin/courses/parse-external', {
      url,
    });
    parsedMetadata.value = data;
    ElMessage.success('解析成功');
  } catch (error) {
    const errorMsg = getApiErrorMessage(error, '解析失败，请检查链接是否正确');
    ElMessage.error(errorMsg);
  } finally {
    isParsing.value = false;
  }
};

const handleImportExternal = async () => {
  if (!parsedMetadata.value) return;
  try {
    isParsing.value = true;
    await api.post('/api/admin/courses/batch', {
      title: parsedMetadata.value.title,
      description: parsedMetadata.value.description,
      thumbnail: parsedMetadata.value.thumbnail,
      lessons: parsedMetadata.value.lessons,
      categoryId: selectedCategoryId.value || undefined,
    });
    ElMessage.success('课程导入成功');
    visible.value = false;
    emit('saved');
  } catch (error) {
    const errorMsg = getApiErrorMessage(error, '导入失败');
    ElMessage.error(errorMsg);
  } finally {
    isParsing.value = false;
  }
};

defineExpose({ open });
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
  >
    <div
      class="w-full max-w-2xl rounded-3xl p-5 sm:p-8 shadow-2xl transition-colors duration-300 animate-fade-in"
      style="background-color: var(--bg-card)"
    >
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold" style="color: var(--text-primary)">从 外部平台 导入课程</h3>
        <button type="button" class="text-slate-400 hover:text-slate-600 cursor-pointer" @click="visible = false">
          <Plus class="w-6 h-6 rotate-45" />
        </button>
      </div>

      <div class="space-y-6">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >课程或项目链接 (支持 B站 / YouTube / GitHub)</label
          >
          <div class="flex gap-2">
            <input
              v-model="externalUrl"
              type="text"
              placeholder="粘贴 B站、YouTube 或 GitHub 链接..."
              class="flex-1 px-4 py-3 rounded-2xl border transition-all outline-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
              @keyup.enter="handleParseExternal"
            />
            <button type="button" :disabled="isParsing || !externalUrl" class="px-6 py-3 rounded-2xl bg-accent text-white font-bold disabled:opacity-50 flex items-center gap-2 cursor-pointer" @click="handleParseExternal">
              <Loader2 v-if="isParsing && !parsedMetadata" class="w-4 h-4 animate-spin" />
              解析
            </button>
          </div>
        </div>

        <!-- Binding Category dropdown -->
        <div v-if="parsedMetadata">
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >绑定导入课程分类</label
          >
          <select
            v-model="selectedCategoryId"
            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none appearance-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          >
            <option value="">不绑定分类 (空)</option>
            <option v-for="cat in props.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>

        <!-- Preview -->
        <div
          v-if="parsedMetadata"
          class="rounded-2xl border p-4 space-y-4 transition-colors duration-300"
          style="background-color: var(--bg-app); border-color: var(--border-base)"
        >
          <div class="flex gap-4">
            <img alt="" :src="parsedMetadata.thumbnail" referrerpolicy="no-referrer" class="w-32 aspect-video rounded-lg object-cover shadow-sm" />
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-sm mb-1 truncate" style="color: var(--text-primary)">
                {{ parsedMetadata.title }}
              </h4>
              <p class="text-[10px] text-slate-400 line-clamp-2">
                {{ parsedMetadata.description }}
              </p>
            </div>
          </div>

          <div class="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            <div
              v-for="lesson in parsedMetadata.lessons"
              :key="lesson.order"
              class="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-white/5 border border-transparent"
            >
              <span class="text-[10px] font-black text-slate-300 w-4">{{ lesson.order }}</span>
              <span
                class="text-xs font-medium truncate flex-1"
                style="color: var(--text-primary)"
                >{{ lesson.title }}</span
              >
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
            </div>
          </div>

          <p class="text-[10px] text-center font-bold text-slate-400">
            共解析出 {{ parsedMetadata.lessons.length }} 个课时
          </p>
        </div>
      </div>

      <div class="flex items-center gap-4 mt-8">
        <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer" @click="visible = false">
          取消
        </button>
        <button type="button" :disabled="!parsedMetadata || isParsing" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer" @click="handleImportExternal">
          <Loader2 v-if="isParsing && parsedMetadata" class="w-4 h-4 animate-spin" />
          确认导入
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
</style>

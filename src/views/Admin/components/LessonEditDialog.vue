<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Plus,
  Trash2,
  Edit2,
  Box,
  Info,
  Layers,
  Camera,
  Sun,
  Palette
} from 'lucide-vue-next';
import api from '@/utils/api';

const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue'));

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

interface CourseForLessonEdit {
  id: string;
  lessons?: unknown[];
}

interface LessonForEdit {
  id: string;
  title?: string | null;
  content?: string | null;
  videoUrl?: string | null;
  order?: number | null;
  duration?: number | null;
  hotspots?: unknown;
  sceneConfig?: unknown;
}

interface Hotspot {
  x: number;
  y: number;
  z: number;
  title: string;
  content: string;
  cameraPos?: { x: number; y: number; z: number };
  cameraTarget?: { x: number; y: number; z: number };
}

interface SceneConfig {
  environment: string;
  exposure: number;
  lights: {
    intensity: number;
    color: string;
  };
}

interface HotspotViewer {
  getCameraState: () => {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null;
}

const defaultSceneConfig = (): SceneConfig => ({
  environment: 'sunset',
  exposure: 1.0,
  lights: { intensity: 1.0, color: '#ffffff' },
});

const visible = ref(false);
const currentCourse = ref<CourseForLessonEdit | null>(null);
const currentLesson = ref<LessonForEdit | null>(null);

const lessonForm = ref({
  title: '',
  content: '',
  videoUrl: '',
  order: 0,
  courseId: '',
  duration: 0,
  hotspots: [] as Hotspot[],
  sceneConfig: defaultSceneConfig(),
});

const hotspotViewer = ref<HotspotViewer | null>(null);
const isHotspotEditorOpen = ref(false);
const isQuickEditOpen = ref(false);
const isSceneSettingsOpen = ref(false);
const currentHotspotIndex = ref(-1);
const hotspotEditForm = ref({ title: '', content: '' });

const sceneConfigForm = ref({
  environment: 'sunset',
  exposure: 1.0,
  lights: {
    intensity: 1.0,
    color: '#ffffff',
  },
});

const is3DModel = (url?: string) => {
  if (!url) return false;
  return url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf');
};

const parseHotspots = (hotspots: unknown): Hotspot[] => {
  if (!hotspots) return [];
  if (typeof hotspots === 'string') {
    try {
      const parsed = JSON.parse(hotspots) as unknown;
      return Array.isArray(parsed) ? (parsed as Hotspot[]) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(hotspots) ? (hotspots as Hotspot[]) : [];
};

const parseSceneConfig = (config: unknown): SceneConfig => {
  if (!config) return defaultSceneConfig();
  if (typeof config === 'string') {
    try {
      return { ...defaultSceneConfig(), ...(JSON.parse(config) as Partial<SceneConfig>) };
    } catch {
      return defaultSceneConfig();
    }
  }
  return { ...defaultSceneConfig(), ...(config as Partial<SceneConfig>) };
};

const open = (course: CourseForLessonEdit, lesson: LessonForEdit | null = null) => {
  currentCourse.value = course;
  currentLesson.value = lesson;
  if (lesson) {
    lessonForm.value = {
      title: lesson.title || '',
      content: lesson.content || '',
      videoUrl: lesson.videoUrl || '',
      order: lesson.order || 0,
      courseId: course.id,
      duration: lesson.duration || 0,
      hotspots: parseHotspots(lesson.hotspots),
      sceneConfig: parseSceneConfig(lesson.sceneConfig),
    };
  } else {
    lessonForm.value = {
      title: '',
      content: '',
      videoUrl: '',
      order: (course.lessons?.length || 0) + 1,
      courseId: course.id,
      duration: 0,
      hotspots: [],
      sceneConfig: {
        environment: 'sunset',
        exposure: 1.0,
        lights: { intensity: 1.0, color: '#ffffff' },
      },
    };
  }
  visible.value = true;
};

const handleSaveLesson = async () => {
  if (!lessonForm.value.title.trim()) {
    ElMessage.warning('请输入课时标题');
    return;
  }
  try {
    const payload = {
      ...lessonForm.value,
      hotspots: JSON.stringify(lessonForm.value.hotspots),
      sceneConfig: JSON.stringify(lessonForm.value.sceneConfig),
    };
    if (currentLesson.value) {
      await api.put(`/api/admin/courses/lessons/${currentLesson.value.id}`, payload);
    } else {
      await api.post('/api/admin/courses/lessons', payload);
    }
    ElMessage.success('课时已保存');
    visible.value = false;
    emit('saved');
  } catch (error) {
    console.error('Save lesson error:', error);
    ElMessage.error('保存课时失败');
  }
};

// Hotspots methods
const handleAddHotspot = (point: { x: number; y: number; z: number }) => {
  lessonForm.value.hotspots.push({
    ...point,
    title: `新热点 ${lessonForm.value.hotspots.length + 1}`,
    content: '点击编辑此热点的详细内容',
  });
};

const openHotspotEditor = () => {
  if (!lessonForm.value.videoUrl) {
    return ElMessage.warning('请先提供 3D 模型链接');
  }
  isHotspotEditorOpen.value = true;
};

const removeHotspot = (index: number) => {
  lessonForm.value.hotspots.splice(index, 1);
  if (currentHotspotIndex.value === index) {
    currentHotspotIndex.value = -1;
  } else if (currentHotspotIndex.value > index) {
    currentHotspotIndex.value--;
  }
};

const startEditHotspot = (index: number) => {
  currentHotspotIndex.value = index;
  hotspotEditForm.value = {
    title: lessonForm.value.hotspots[index].title,
    content: lessonForm.value.hotspots[index].content,
  };
  isQuickEditOpen.value = true;
};

const saveHotspotEdit = () => {
  if (currentHotspotIndex.value === -1) return;
  lessonForm.value.hotspots[currentHotspotIndex.value].title = hotspotEditForm.value.title;
  lessonForm.value.hotspots[currentHotspotIndex.value].content = hotspotEditForm.value.content;
  isQuickEditOpen.value = false;
};

const captureCameraForHotspot = () => {
  if (currentHotspotIndex.value === -1 || !hotspotViewer.value) return;
  const state = hotspotViewer.value.getCameraState();
  if (state) {
    lessonForm.value.hotspots[currentHotspotIndex.value].cameraPos = state.position;
    lessonForm.value.hotspots[currentHotspotIndex.value].cameraTarget = state.target;
    ElMessage.success(
      `已保存当前视角到热点: ${lessonForm.value.hotspots[currentHotspotIndex.value].title}`,
    );
  }
};

// Scene settings methods
const openSceneSettings = () => {
  sceneConfigForm.value = parseSceneConfig(lessonForm.value.sceneConfig);
  isSceneSettingsOpen.value = true;
};

const saveSceneSettings = () => {
  lessonForm.value.sceneConfig = { ...sceneConfigForm.value };
  isSceneSettingsOpen.value = false;
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
      <h3 class="text-xl font-bold mb-6" style="color: var(--text-primary)">
        {{ currentLesson ? '编辑课时' : '新建课时' }}
      </h3>
      <div class="space-y-4">
        <div class="grid grid-cols-4 gap-4">
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >课时标题</label
            >
            <input
              v-model="lessonForm.title"
              type="text"
              placeholder="输入课时标题..."
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >排序</label
            >
            <input
              v-model="lessonForm.order"
              type="number"
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none text-center font-bold"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
              >时长(分钟)</label
            >
            <input
              v-model="lessonForm.duration"
              type="number"
              class="w-full px-4 py-3 rounded-2xl border transition-all outline-none text-center font-bold"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >视频链接</label
          >
          <div class="flex gap-2">
            <input
              v-model="lessonForm.videoUrl"
              type="text"
              placeholder="https://..."
              class="flex-1 px-4 py-3 rounded-2xl border transition-all outline-none"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
            <button v-if="is3DModel(lessonForm.videoUrl)" type="button" class="px-4 py-3 rounded-2xl bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 hover:bg-indigo-600 transition-colors cursor-pointer" @click="openHotspotEditor">
              <Box class="w-4 h-4" />
              设计热点
            </button>
            <button v-if="is3DModel(lessonForm.videoUrl)" type="button" class="px-4 py-3 rounded-2xl bg-amber-500 text-white font-bold text-xs flex items-center gap-2 hover:bg-amber-600 transition-colors cursor-pointer" @click="openSceneSettings">
              <Sun class="w-4 h-4" />
              场景设置
            </button>
          </div>
          <p
            v-if="lessonForm.hotspots.length > 0"
            class="text-[10px] text-emerald-500 font-bold mt-1 ml-1"
          >
            已配置 {{ lessonForm.hotspots.length }} 个交互热点
          </p>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider"
            >课时内容 (Markdown)</label
          >
          <textarea
            v-model="lessonForm.content"
            rows="6"
            placeholder="输入课时详细内容..."
            class="w-full px-4 py-3 rounded-2xl border transition-all outline-none resize-none"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          ></textarea>
        </div>
      </div>
      <div class="flex items-center gap-4 mt-8">
        <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer" @click="visible = false">
          取消
        </button>
        <button type="button" class="flex-1 py-3 rounded-2xl bg-accent text-white font-bold transition-all shadow-lg shadow-accent/20 cursor-pointer" @click="handleSaveLesson">
          保存课时
        </button>
      </div>
    </div>

    <!-- Hotspot Editor Dialog -->
    <el-dialog
      v-model="isHotspotEditorOpen"
      title="3D 交互热点编辑器"
      fullscreen
      append-to-body
      class="hotspot-editor-dialog"
    >
      <div class="h-full flex flex-col">
        <div class="flex-1 flex gap-6 overflow-hidden">
          <!-- Left: 3D Viewer -->
          <div class="flex-1 bg-slate-900 rounded-3xl overflow-hidden relative">
            <ModelViewer
              v-if="isHotspotEditorOpen"
              ref="hotspotViewer"
              :model-url="lessonForm.videoUrl"
              :hotspots="lessonForm.hotspots"
              editable
              @hotspot-added="handleAddHotspot"
            />
            <div
              class="absolute top-6 left-6 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 pointer-events-none"
            >
              <p class="text-white text-xs font-bold flex items-center gap-2">
                <Info class="w-4 h-4 text-accent" />
                点击模型表面即可添加新的交互热点
              </p>
            </div>

            <!-- Camera Preset Controls -->
            <div class="absolute bottom-6 left-6 flex items-center gap-3">
              <button v-if="currentHotspotIndex !== -1" type="button" class="px-4 py-2 bg-accent text-white rounded-xl font-bold text-[10px] flex items-center gap-2 shadow-xl hover:scale-105 transition-all cursor-pointer" @click="captureCameraForHotspot">
                <Camera class="w-3.5 h-3.5" />
                保存当前视角到此热点
              </button>
            </div>
          </div>

          <!-- Right: Hotspots List -->
          <div class="w-80 flex flex-col gap-4 overflow-hidden">
            <div
              class="bg-white dark:bg-slate-900 rounded-3xl border p-6 flex-1 flex flex-col overflow-hidden"
              style="border-color: var(--border-base)"
            >
              <h4
                class="font-black text-sm mb-4 flex items-center gap-2"
                style="color: var(--text-primary)"
              >
                <Layers class="w-4 h-4 text-accent" />
                热点列表 ({{ lessonForm.hotspots.length }})
              </h4>

              <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                <div
                  v-for="(hs, index) in lessonForm.hotspots"
                  :key="index"
                  class="p-4 rounded-2xl border transition-all hover:border-accent/40 group cursor-pointer"
                  :class="
                    currentHotspotIndex === index
                      ? 'border-accent bg-accent/5'
                      : 'bg-slate-50 dark:bg-white/5'
                  "
                  style="border-color: var(--border-base)"
                  @click="currentHotspotIndex = index"
                >
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="w-6 h-6 rounded-lg bg-accent text-white flex items-center justify-center text-[10px] font-black"
                        >{{ index + 1 }}</span
                      >
                      <Camera
                        v-if="hs.cameraPos"
                        class="w-3.5 h-3.5 text-emerald-500"
                        title="已设置视角"
                      />
                    </div>
                    <div
                      class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-accent cursor-pointer" @click.stop="startEditHotspot(index)">
                        <Edit2 class="w-3.5 h-3.5" />
                      </button>
                      <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer" @click.stop="removeHotspot(index)">
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h5 class="text-xs font-bold mb-1 truncate" style="color: var(--text-primary)">
                    {{ hs.title }}
                  </h5>
                  <p class="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                    {{ hs.content }}
                  </p>
                </div>

                <div v-if="lessonForm.hotspots.length === 0" class="py-12 text-center">
                  <div
                    class="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto mb-3"
                  >
                    <Plus class="w-6 h-6 text-slate-200" />
                  </div>
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    暂无热点
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
type="button" class="px-8 py-2.5 rounded-xl border font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer" @click="
              isHotspotEditorOpen = false;
              currentHotspotIndex = -1;
            ">
            关闭并应用
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- Hotspot Quick Edit Modal -->
    <el-dialog v-model="isQuickEditOpen" title="编辑热点详情" width="400px" append-to-body>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2">热点标题</label>
          <input
            v-model="hotspotEditForm.title"
            type="text"
            class="w-full px-4 py-2 rounded-xl border outline-none"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-2">描述内容</label>
          <textarea
            v-model="hotspotEditForm.content"
            rows="4"
            class="w-full px-4 py-2 rounded-xl border outline-none resize-none text-sm"
          ></textarea>
        </div>
        <div class="flex gap-2">
          <button type="button" class="flex-1 py-2 rounded-xl border font-bold text-xs cursor-pointer" @click="isQuickEditOpen = false">
            取消
          </button>
          <button type="button" class="flex-1 py-2 bg-accent text-white rounded-xl font-bold text-xs cursor-pointer" @click="saveHotspotEdit">
            保存
          </button>
        </div>
      </div>
    </el-dialog>

    <!-- Scene Settings Dialog -->
    <el-dialog
      v-model="isSceneSettingsOpen"
      title="3D 场景与灯光设置"
      width="460px"
      append-to-body
      class="custom-rounded-dialog"
    >
      <div class="space-y-6">
        <div class="flex items-center gap-3 p-4 bg-accent/10 rounded-2xl border border-accent/20">
          <Palette class="w-6 h-6 text-accent shrink-0" />
          <p class="text-xs text-accent font-medium">
            自定义 3D 场景的渲染环境、光照强度和色彩表现。
          </p>
        </div>

        <div class="space-y-4">
          <div>
            <label
              class="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
              >渲染环境 (HDR)</label
            >
            <el-select v-model="sceneConfigForm.environment" class="w-full">
              <el-option label="日落余晖 (默认)" value="sunset" />
              <el-option label="专业摄影棚" value="studio" />
              <el-option label="户外自然光" value="forest" />
              <el-option label="室内工作间" value="room" />
            </el-select>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2 ml-1">
              <label class="text-xs font-black uppercase tracking-widest text-slate-400"
                >曝光强度 (Exposure)</label
              >
              <span class="text-xs font-bold text-accent">{{
                sceneConfigForm.exposure.toFixed(1)
              }}</span>
            </div>
            <el-slider v-model="sceneConfigForm.exposure" :min="0.1" :max="3.0" :step="0.1" />
          </div>

          <div class="h-[1px] bg-slate-100 dark:bg-white/5"></div>

          <div>
            <div class="flex items-center justify-between mb-2 ml-1">
              <label class="text-xs font-black uppercase tracking-widest text-slate-400"
                >主灯光强度</label
              >
              <span class="text-xs font-bold text-accent">{{
                sceneConfigForm.lights.intensity.toFixed(1)
              }}</span>
            </div>
            <el-slider v-model="sceneConfigForm.lights.intensity" :min="0" :max="5.0" :step="0.1" />
          </div>

          <div>
            <label
              class="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
              >灯光色调</label
            >
            <div class="flex items-center gap-3">
              <el-color-picker v-model="sceneConfigForm.lights.color" />
              <input
                v-model="sceneConfigForm.lights.color"
                type="text"
                class="flex-1 px-3 py-1.5 rounded-lg border text-xs font-mono"
                style="background-color: var(--bg-app); border-color: var(--border-base)"
              />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-4">
          <button type="button" class="flex-1 py-3 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer" @click="isSceneSettingsOpen = false">
            取消
          </button>
          <button type="button" class="flex-1 py-3 bg-accent text-white rounded-2xl font-bold text-sm shadow-lg shadow-accent/20 hover:scale-105 transition-all cursor-pointer" @click="saveSceneSettings">
            应用配置
          </button>
        </div>
      </template>
    </el-dialog>
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
:deep(.hotspot-editor-dialog) {
  display: flex;
  flex-direction: column;
}
:deep(.hotspot-editor-dialog .el-dialog__body) {
  flex: 1;
  overflow: hidden;
  padding: 24px;
}
</style>

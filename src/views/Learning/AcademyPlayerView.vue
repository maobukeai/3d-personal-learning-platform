<script setup lang="ts">
import { ref, onMounted, computed, watch, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle2,
  MessageSquare,
  FileText,
  Clock,
  Menu,
  X,
  Box,
  Users,
  StickyNote,
  Send,
  Trash2,
  Circle,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';

const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue'));

import { sanitizeHtml } from '@/utils/sanitize';

const route = useRoute();
const router = useRouter();
const courseId = route.params.id as string;

const course = ref<any>(null);
const lessons = ref<any[]>([]);
const currentLessonIndex = ref(0);
const isLoading = ref(true);
const isSidebarOpen = ref(true);
const activeTab = ref<'content' | 'notes' | 'discussion'>('content');
const progress = ref(0);
const lessonProgressMap = ref<Record<string, boolean>>({});
const notes = ref<any[]>([]);
const newNoteContent = ref('');
const isSavingNote = ref(false);
const isTogglingComplete = ref(false);
const autoPlayNext = ref(true);
const showCompletionModal = ref(false);

const currentLesson = computed(() => lessons.value[currentLessonIndex.value]);

const completedCount = computed(() => {
  return Object.values(lessonProgressMap.value).filter(Boolean).length;
});

const isLessonCompleted = (lessonId: string) => {
  return !!lessonProgressMap.value[lessonId];
};

const fetchCourseData = async () => {
  isLoading.value = true;
  try {
    const { data } = await api.get(`/api/courses/${courseId}`);

    course.value = data;
    lessons.value = data.lessons || [];
    lessonProgressMap.value = data.lessonProgressMap || {};

    if (data.userEnrollment) {
      progress.value = data.userEnrollment.progress;

      // Prioritize query param for lesson selection
      const lessonQuery = route.query.lesson;
      if (lessonQuery !== undefined) {
        const index = parseInt(lessonQuery as string, 10);
        if (!isNaN(index) && index >= 0 && index < lessons.value.length) {
          currentLessonIndex.value = index;
          isLoading.value = false;
          return;
        }
      }

      if (lessons.value.length > 0 && progress.value > 0) {
        let lastIncompleteIndex = lessons.value.findIndex(
          (l: any) => !lessonProgressMap.value[l.id],
        );
        if (lastIncompleteIndex === -1) lastIncompleteIndex = lessons.value.length - 1;
        currentLessonIndex.value = Math.max(0, lastIncompleteIndex);
      }
    }
  } catch (error) {
    ElMessage.error('加载课程失败');
    router.push('/academy');
  } finally {
    isLoading.value = false;
  }
};

const fetchNotes = async () => {
  if (!currentLesson.value) return;
  try {
    const { data } = await api.get(`/api/courses/lessons/${currentLesson.value.id}/notes`);
    notes.value = data;
  } catch (error) {
    console.error('Fetch notes error:', error);
  }
};

const toggleLessonComplete = async () => {
  if (!currentLesson.value || isTogglingComplete.value) return;
  isTogglingComplete.value = true;
  const newCompleted = !isLessonCompleted(currentLesson.value.id);
  try {
    const { data } = await api.patch(`/api/courses/lessons/${currentLesson.value.id}/complete`, {
      completed: newCompleted,
    });
    lessonProgressMap.value = {
      ...lessonProgressMap.value,
      [currentLesson.value.id]: newCompleted,
    };
    progress.value = data.courseProgress;

    if (data.courseProgress === 100 && newCompleted) {
      showCompletionModal.value = true;
    }
  } catch (error) {
    console.error('Toggle complete error:', error);
  } finally {
    isTogglingComplete.value = false;
  }
};

const handleSaveNote = async () => {
  if (!newNoteContent.value.trim() || !currentLesson.value || isSavingNote.value) return;
  isSavingNote.value = true;
  try {
    const { data } = await api.post('/api/courses/notes', {
      lessonId: currentLesson.value.id,
      content: newNoteContent.value.trim(),
    });
    notes.value.unshift(data);
    newNoteContent.value = '';
  } catch (error) {
    ElMessage.error('保存笔记失败');
  } finally {
    isSavingNote.value = false;
  }
};

const handleDeleteNote = async (noteId: string) => {
  try {
    await api.delete(`/api/courses/notes/${noteId}`);
    notes.value = notes.value.filter((n) => n.id !== noteId);
  } catch (error) {
    ElMessage.error('删除笔记失败');
  }
};

const nextLesson = () => {
  if (currentLessonIndex.value < lessons.value.length - 1) {
    currentLessonIndex.value++;
  }
};

const prevLesson = () => {
  if (currentLessonIndex.value > 0) {
    currentLessonIndex.value--;
  }
};

const selectLesson = (index: number) => {
  currentLessonIndex.value = index;
  if (window.innerWidth < 1024) isSidebarOpen.value = false;
};

const handleVideoEnded = () => {
  if (!isLessonCompleted(currentLesson.value.id)) {
    toggleLessonComplete();
  }
  if (autoPlayNext.value && currentLessonIndex.value < lessons.value.length - 1) {
    setTimeout(() => {
      nextLesson();
    }, 1500);
  }
};

const is3DModel = (url?: string) => {
  if (!url) return false;
  return url.toLowerCase().endsWith('.glb') || url.toLowerCase().endsWith('.gltf');
};

const isBilibili = (url?: string) => {
  if (!url) return false;
  return (
    url.includes('player.bilibili.com') || url.includes('bilibili.com') || url.includes('b23.tv')
  );
};

const isYoutube = (url?: string) => {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
};

const formatBilibiliUrl = (url: string) => {
  if (url.includes('player.bilibili.com')) return url;
  const bvidMatch = url.match(/video\/(BV[a-zA-Z0-9]+)/);
  if (bvidMatch) {
    const bvid = bvidMatch[1];
    const pMatch = url.match(/\?p=(\d+)/);
    const page = pMatch ? pMatch[1] : '1';
    return `https://player.bilibili.com/player.html?bvid=${bvid}&page=${page}&high_quality=1&as_wide=1&danmaku=0`;
  }
  return url;
};

const formatYoutubeUrl = (url: string) => {
  if (url.includes('youtube.com/embed')) return url;
  const videoIdMatch = url.match(
    /(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/|watch\?.*v=)([^#&?]*).*/,
  );
  if (videoIdMatch) {
    return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
  }
  return url;
};

const parseHotspots = (hotspots: any) => {
  if (!hotspots) return [];
  if (typeof hotspots === 'string') {
    try {
      return JSON.parse(hotspots);
    } catch {
      return [];
    }
  }
  return hotspots;
};

const parseSceneConfig = (config: any) => {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  return config;
};

watch(currentLessonIndex, () => {
  activeTab.value = 'content';
  if (currentLesson.value) {
    fetchNotes();
  }
});

const selectTab = (tabId: 'content' | 'notes' | 'discussion') => {
  activeTab.value = tabId;
  isSidebarOpen.value = true;
};

onMounted(fetchCourseData);
</script>

<template>
  <div class="flex h-full overflow-hidden transition-colors duration-300" style="background-color: var(--bg-app); color: var(--text-primary)">
    <!-- Main Player Area -->
    <div class="flex-1 flex flex-col relative overflow-hidden">
      <!-- Player Top Nav -->
      <div
        class="h-12 flex items-center justify-between px-3 sm:px-4.5 border-b backdrop-blur-md z-20 transition-colors duration-300"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2.5">
          <button
            class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            style="color: var(--text-primary)"
            @click="router.push('/academy')"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <div class="h-3 w-px transition-colors duration-300" style="background-color: var(--border-base)"></div>
          <div>
            <h1 class="text-xs font-bold truncate max-w-[150px] md:max-w-md" style="color: var(--text-primary)">
              {{ course?.title }}
            </h1>
            <p class="text-[9px]" style="color: var(--text-secondary)">正在学习: {{ currentLesson?.title }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <div class="flex flex-col items-end mr-1 sm:mr-1.5">
            <div class="w-12 sm:w-28 h-1 rounded-full overflow-hidden transition-colors duration-300" style="background-color: var(--border-base)">
              <div
                class="h-full bg-accent transition-all duration-1000"
                :style="{ width: progress + '%' }"
              ></div>
            </div>
            <span class="text-[8px] sm:text-[9px] font-bold mt-0.5 text-accent">已完成 {{ progress }}%</span>
          </div>
          <button
            class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors lg:hidden cursor-pointer"
            style="color: var(--text-primary)"
            @click="isSidebarOpen = !isSidebarOpen"
          >
            <Menu class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Content Renderer -->
      <div class="flex-1 relative bg-black flex items-center justify-center">
        <div v-if="isLoading" class="flex flex-col items-center gap-4">
          <div
            class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"
          ></div>
          <p class="text-xs font-bold text-slate-500">正在加载学习内容...</p>
        </div>

        <template v-else-if="currentLesson">
          <!-- 3D Model Mode -->
          <div v-if="is3DModel(currentLesson.videoUrl)" class="w-full h-full relative">
            <ModelViewer
              :model-url="currentLesson.videoUrl"
              :hotspots="parseHotspots(currentLesson.hotspots)"
              :scene-config="parseSceneConfig(currentLesson.sceneConfig)"
              auto-rotate
            />
            <div
              class="absolute bottom-6 right-6 backdrop-blur px-4 py-2 rounded-xl border pointer-events-none transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base); opacity: 0.9"
            >
              <div class="flex items-center gap-2">
                <Box class="w-4 h-4 text-accent" />
                <span class="text-[10px] font-bold" style="color: var(--text-primary)">3D 实操教学模式</span>
              </div>
            </div>
          </div>

          <!-- Bilibili Video Mode -->
          <div
            v-else-if="isBilibili(currentLesson.videoUrl)"
            class="w-full h-full flex items-center justify-center bg-black"
          >
            <iframe
              :src="formatBilibiliUrl(currentLesson.videoUrl)"
              class="w-full h-full border-0"
              scrolling="no"
              frameborder="0"
              framespacing="0"
              referrerpolicy="no-referrer"
              allow="
                accelerometer;
                autoplay;
                clipboard-write;
                encrypted-media;
                gyroscope;
                picture-in-picture;
                web-share;
              "
              allowfullscreen
            ></iframe>
          </div>

          <!-- YouTube Video Mode -->
          <div
            v-else-if="isYoutube(currentLesson.videoUrl)"
            class="w-full h-full flex items-center justify-center bg-black"
          >
            <iframe
              :src="formatYoutubeUrl(currentLesson.videoUrl)"
              class="w-full h-full border-0"
              frameborder="0"
              allow="
                accelerometer;
                autoplay;
                clipboard-write;
                encrypted-media;
                gyroscope;
                picture-in-picture;
                web-share;
              "
              allowfullscreen
            ></iframe>
          </div>

          <!-- Native Video Mode -->
          <div
            v-else-if="currentLesson.videoUrl"
            class="w-full h-full flex items-center justify-center bg-black"
          >
            <video
              :src="currentLesson.videoUrl"
              controls
              class="max-w-full max-h-full"
              @ended="handleVideoEnded"
            ></video>
          </div>

          <!-- Text/Doc Mode -->
          <div v-else class="w-full h-full p-4 sm:p-8 md:p-12 overflow-y-auto scrollbar-hide transition-colors duration-300" style="background-color: var(--bg-app)">
            <div class="max-w-3xl mx-auto space-y-4 sm:space-y-6">
              <div class="space-y-2">
                <span class="px-2 py-0.5 bg-accent/20 text-accent text-[9px] font-bold rounded-full"
                  >文字教程</span
                >
                <h2 class="text-xl sm:text-2xl font-bold" style="color: var(--text-primary)">{{ currentLesson.title }}</h2>
              </div>
              <div
                class="prose dark:prose-invert prose-sm max-w-none leading-relaxed transition-colors duration-300"
                style="color: var(--text-secondary)"
                v-html="sanitizeHtml(currentLesson.content)"
              ></div>
              <div class="pt-6 flex justify-center">
                <button
                  class="px-5 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg shadow-md shadow-accent/15 flex items-center gap-1.5 transition-colors cursor-pointer"
                  @click="handleVideoEnded"
                >
                  完成学习 <ChevronRight class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Player Bottom Controls -->
      <div
        class="px-3 sm:px-6 py-2.5 flex items-center justify-between border-t flex-nowrap overflow-x-auto scrollbar-hide gap-2 transition-colors duration-300"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            :disabled="currentLessonIndex === 0"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all disabled:opacity-30 cursor-pointer"
            :class="currentLessonIndex > 0 ? 'hover:bg-slate-100 dark:hover:bg-white/5 bg-slate-50 dark:bg-white/5' : 'bg-transparent'"
            style="color: var(--text-primary)"
            @click="prevLesson"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
            <span>上一节</span>
          </button>
          <button
            :disabled="currentLessonIndex === lessons.length - 1"
            class="flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-[10px] sm:text-xs font-bold transition-all disabled:opacity-30 shadow-lg shadow-accent/10 cursor-pointer"
            @click="nextLesson"
          >
            <span>下一节</span>
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Center: Complete toggle -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            :disabled="isTogglingComplete"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer"
            :class="
              currentLesson && isLessonCompleted(currentLesson.id)
                ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
            "
            :style="!(currentLesson && isLessonCompleted(currentLesson.id)) ? 'color: var(--text-secondary)' : ''"
            @click="toggleLessonComplete"
          >
            <CheckCircle2
              v-if="currentLesson && isLessonCompleted(currentLesson.id)"
              class="w-3.5 h-3.5"
            />
            <Circle v-else class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ currentLesson && isLessonCompleted(currentLesson.id) ? '已完成' : '标记完成' }}</span>
            <span class="sm:hidden">{{ currentLesson && isLessonCompleted(currentLesson.id) ? '已完成' : '完成' }}</span>
          </button>

          <label class="hidden sm:flex items-center gap-1 text-[10px] cursor-pointer" style="color: var(--text-muted)">
            <input v-model="autoPlayNext" type="checkbox" class="accent-accent w-3 h-3" />
            <span>自动播放</span>
          </label>
        </div>

        <!-- Right: Tab buttons -->
        <div class="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            v-for="tab in [
              { id: 'content' as const, icon: FileText, label: '课程内容', shortLabel: '大纲' },
              { id: 'notes' as const, icon: StickyNote, label: '学习笔记', shortLabel: '笔记' },
              { id: 'discussion' as const, icon: MessageSquare, label: '参与讨论', shortLabel: '讨论' },
            ]"
            :key="tab.id"
            class="flex items-center gap-1 text-[10px] sm:text-xs font-medium transition-all cursor-pointer"
            :class="activeTab === tab.id ? 'text-accent' : 'hover:text-slate-800 dark:hover:text-slate-100'"
            :style="activeTab !== tab.id ? 'color: var(--text-muted)' : ''"
            @click="selectTab(tab.id)"
          >
            <component :is="tab.icon" class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ tab.label }}</span>
            <span class="sm:hidden">{{ tab.shortLabel }}</span>
            <span
              v-if="tab.id === 'notes' && notes.length"
              class="px-1 py-0.5 rounded text-[8px] sm:text-[9px] bg-accent/20 text-accent font-bold"
              >{{ notes.length }}</span
            >
          </button>
        </div>
      </div>
    </div>

    <!-- Right Sidebar -->
    <Transition name="slide-right">
      <div
        v-if="isSidebarOpen"
        class="w-[33.33vw] min-w-[220px] lg:w-80 h-full flex flex-col border-l z-30 absolute lg:relative right-0 top-0 bottom-0 lg:inset-auto transition-colors duration-300"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <!-- Sidebar Header -->
        <div class="h-12 flex items-center justify-between px-4 border-b shrink-0 transition-colors duration-300" style="border-color: var(--border-base)">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-bold" style="color: var(--text-primary)">
              {{ activeTab === 'content' ? '课程大纲' : activeTab === 'notes' ? '学习笔记' : '参与讨论' }}
            </h2>
            <span
              v-if="activeTab === 'content'"
              class="text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors duration-300"
              style="background-color: var(--bg-app); color: var(--text-secondary)"
            >
              {{ completedCount }}/{{ lessons.length }}
            </span>
            <span
              v-else-if="activeTab === 'notes' && notes.length"
              class="text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors duration-300"
              style="background-color: var(--bg-app); color: var(--text-secondary)"
            >
              {{ notes.length }}
            </span>
          </div>
          <button class="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg cursor-pointer" style="color: var(--text-primary)" @click="isSidebarOpen = false">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Sidebar Tabs for mobile & quick switching -->
        <div class="flex border-b shrink-0 transition-colors duration-300" style="border-color: var(--border-base); background-color: var(--bg-card)">
          <button
            v-for="tab in [
              { id: 'content' as const, icon: FileText, label: '大纲' },
              { id: 'notes' as const, icon: StickyNote, label: '笔记' },
              { id: 'discussion' as const, icon: MessageSquare, label: '讨论' },
            ]"
            :key="tab.id"
            class="flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all border-b-2 cursor-pointer"
            :class="activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" class="w-3.5 h-3.5" />
            <span>{{ tab.label }}</span>
            <span
              v-if="tab.id === 'notes' && notes.length"
              class="px-1 py-0.5 rounded text-[8px] sm:text-[9px] bg-accent/20 text-accent font-bold"
              >{{ notes.length }}</span
            >
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto scrollbar-hide">
          <!-- Content Tab: Lesson List -->
          <template v-if="activeTab === 'content'">
            <div class="p-2 sm:p-3 space-y-1">
              <div
                v-for="(lesson, index) in lessons"
                :key="lesson.id"
                class="group p-2.5 rounded-xl cursor-pointer transition-all border border-transparent"
                :class="
                  currentLessonIndex === index
                    ? 'bg-accent/10 border-accent/15'
                    : 'hover:bg-slate-100 dark:hover:bg-white/5'
                "
                @click="selectLesson(index)"
              >
                <div class="flex gap-2.5 items-center">
                  <div
                    class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-black transition-colors"
                    :class="
                      isLessonCompleted(lesson.id)
                        ? 'bg-emerald-500 text-white'
                        : currentLessonIndex === index
                          ? 'bg-accent text-white'
                          : ''
                    "
                    :style="(!isLessonCompleted(lesson.id) && currentLessonIndex !== index) ? 'background-color: var(--bg-app); color: var(--text-secondary)' : ''"
                  >
                    <CheckCircle2 v-if="isLessonCompleted(lesson.id)" class="w-3.5 h-3.5" />
                    <span v-else>{{ index + 1 }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3
                      class="text-xs font-bold truncate mb-0.5"
                      :class="
                        currentLessonIndex === index
                          ? 'text-accent'
                          : isLessonCompleted(lesson.id)
                            ? 'text-emerald-500'
                            : ''
                      "
                      :style="(!isLessonCompleted(lesson.id) && currentLessonIndex !== index) ? 'color: var(--text-primary)' : ''"
                    >
                      {{ lesson.title }}
                    </h3>
                    <div class="flex items-center gap-2">
                      <span class="flex items-center gap-0.5 text-[9px]" style="color: var(--text-muted)">
                        <component
                          :is="is3DModel(lesson.videoUrl) ? Box : lesson.videoUrl ? Play : FileText"
                          class="w-3 h-3"
                        />
                        {{
                          is3DModel(lesson.videoUrl) ? '3D 交互' : lesson.videoUrl ? '视频' : '图文'
                        }}
                      </span>
                      <span
                        v-if="lesson.duration"
                        class="flex items-center gap-0.5 text-[9px]"
                        style="color: var(--text-muted)"
                      >
                        <Clock class="w-3 h-3" /> {{ lesson.duration }}分钟
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Notes Tab -->
          <template v-if="activeTab === 'notes'">
            <div class="p-3 space-y-3">
              <!-- Add Note -->
              <div class="space-y-2">
                <div class="flex items-center gap-1.5 text-xs" style="color: var(--text-secondary)">
                  <StickyNote class="w-3.5 h-3.5" />
                  <span class="font-bold">{{ currentLesson?.title }} 的笔记</span>
                </div>
                <textarea
                  v-model="newNoteContent"
                  rows="3"
                  placeholder="记录你的学习心得..."
                  class="w-full px-3 py-2 rounded-lg border text-xs outline-none resize-none transition-colors focus:border-accent/30"
                  style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-primary)"
                ></textarea>
                <div class="flex justify-end">
                  <button
                    :disabled="!newNoteContent.trim() || isSavingNote"
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-md disabled:opacity-40 transition-all cursor-pointer"
                    @click="handleSaveNote"
                  >
                    <Send class="w-3.5 h-3.5" />
                    保存
                  </button>
                </div>
              </div>

              <!-- Notes List -->
              <div class="space-y-1.5">
                <div
                  v-for="note in notes"
                  :key="note.id"
                  class="group p-3 rounded-lg border transition-colors duration-300"
                  style="background-color: var(--bg-app); border-color: var(--border-base)"
                >
                  <p class="text-xs leading-relaxed mb-1.5" style="color: var(--text-secondary)">{{ note.content }}</p>
                  <div class="flex items-center justify-between">
                    <span class="text-[9px]" style="color: var(--text-muted)">{{
                      new Date(note.createdAt).toLocaleString('zh-CN')
                    }}</span>
                    <button
                      class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-rose-400 transition-all cursor-pointer"
                      style="color: var(--text-muted)"
                      @click="handleDeleteNote(note.id)"
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div v-if="!notes.length" class="py-6 text-center">
                  <StickyNote class="w-6 h-6 mx-auto mb-1.5" style="color: var(--text-muted)" />
                  <p class="text-[10px]" style="color: var(--text-muted)">还没有笔记，开始记录吧</p>
                </div>
              </div>
            </div>
          </template>

          <!-- Discussion Tab -->
          <template v-if="activeTab === 'discussion'">
            <div class="p-3">
              <div class="text-center py-6">
                <MessageSquare class="w-6 h-6 mx-auto mb-2" style="color: var(--text-muted)" />
                <p class="text-xs mb-2" style="color: var(--text-muted)">课程讨论区</p>
                <button
                  class="px-3.5 py-1.5 border hover:bg-slate-100 dark:hover:bg-white/5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  style="border-color: var(--border-base); color: var(--text-primary)"
                  @click="router.push(`/discussions`)"
                >
                  前往讨论区
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- Instructor Info Card -->
        <div class="p-4 border-t transition-colors duration-300" style="background-color: var(--bg-app); border-color: var(--border-base)">
          <div class="flex items-center gap-2 mb-2.5">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0"
              style="background-color: var(--bg-card)"
            >
              <img
                v-if="course?.instructor?.avatar"
                :src="course.instructor.avatar"
                class="w-full h-full object-cover"
              />
              <Users v-else class="w-4 h-4" style="color: var(--text-muted)" />
            </div>
            <div>
              <p class="text-xs font-bold leading-tight" style="color: var(--text-primary)">{{ course?.instructor?.name || '平台认证导师' }}</p>
              <p class="text-[9px] leading-tight" style="color: var(--text-muted)">3D 设计专家</p>
            </div>
          </div>
          <p class="text-[9px] leading-relaxed line-clamp-2" style="color: var(--text-muted)">
            {{ course?.description }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- Course Completion Modal -->
    <div
      v-if="showCompletionModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div
        class="glass-dialog w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl border border-white/10"
      >
        <div
          class="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
        >
          <CheckCircle2 class="w-7 h-7 text-emerald-400" />
        </div>
        <h2 class="text-lg font-bold text-white mb-2">🎉 恭喜完成课程！</h2>
        <p class="text-xs text-slate-400 mb-6">你已经完成了「{{ course?.title }}」的全部课时学习</p>
        <div class="flex gap-3">
          <button
            class="flex-1 py-2 rounded-lg text-xs font-bold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            @click="
              showCompletionModal = false;
              router.push('/academy');
            "
          >
            返回课程列表
          </button>
          <button
            class="flex-1 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-bold shadow-lg shadow-accent/15 transition-all cursor-pointer"
            @click="showCompletionModal = false"
          >
            继续复习
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
@media (max-width: 1024px) {
  .slide-right-enter-from,
  .slide-right-leave-to {
    transform: translateX(100%);
  }
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

<script setup lang="ts">
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  PlayCircle,
  Eye,
  Box,
  Paintbrush,
  Cpu,
  Laptop,
} from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import { getAssetUrl } from '@/utils/api';

defineProps<{
  recentCourses: any[];
  discoveryAssets: any[];
  discoveryMaterials: any[];
  discoveryPlugins: any[];
  discoverySoftwares: any[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string): void;
}>();

const defaultCourseCover =
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60';
const defaultResourceCovers: Record<string, string> = {
  asset:
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
  material:
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=60',
  plugin:
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60',
  software:
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
};

function getDifficultyLabel(diff?: string) {
  if (diff === 'BEGINNER') return '入门';
  if (diff === 'INTERMEDIATE') return '进阶';
  if (diff === 'ADVANCED') return '高级';
  return '系统';
}

function getDifficultyClass(diff?: string) {
  if (diff === 'BEGINNER') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (diff === 'INTERMEDIATE') return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  if (diff === 'ADVANCED') return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
  return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
}
</script>

<template>
  <div class="space-y-4">
    <!-- Section 1: Newly Updated Courses -->
    <Card
      surface="glass"
      padding="sm"
      class="discovery-section space-y-3 shadow-sm border-[var(--border-base)]"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="p-1 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400 rounded-lg border border-emerald-500/20"
          >
            <BookOpen class="w-3.5 h-3.5" />
          </div>
          <h3 class="text-xs font-black text-[var(--text-primary)] tracking-wide">
            新发布主线课程
          </h3>
        </div>
        <Button
          variant="link"
          size="sm"
          :icon="ArrowRight"
          icon-position="right"
          class="text-[10px] !p-0 text-emerald-400 hover:text-emerald-300"
          @click="emit('navigate', '/academy')"
        >
          探索学院
        </Button>
      </div>

      <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div v-for="i in 6" :key="i" class="animate-pulse space-y-2">
          <div class="aspect-video bg-slate-200 dark:bg-white/5 rounded-xl"></div>
          <div class="h-4 bg-slate-200 dark:bg-white/5 rounded w-3/4"></div>
        </div>
      </div>

      <div
        v-else-if="recentCourses.length"
        class="discovery-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3"
      >
        <div
          v-for="course in recentCourses"
          :key="course.id"
          class="group relative overflow-hidden rounded-xl bg-slate-500/5 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.05] cursor-pointer flex flex-col h-full hover:-translate-y-1 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 hover:bg-slate-500/10 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-black/40 transition-all duration-500"
          @click="emit('navigate', `/academy/player/${course.id}`)"
        >
          <div class="relative aspect-video overflow-hidden bg-slate-900 rounded-t-xl">
            <img
              :src="getAssetUrl(course.thumbnail) || defaultCourseCover"
              :alt="course.title"
              class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-70"
            ></div>
            <div class="absolute top-1.5 left-1.5 z-10">
              <span
                class="px-1.5 py-0.5 rounded text-[8px] font-bold backdrop-blur-md"
                :class="getDifficultyClass(course.difficulty)"
              >
                {{ getDifficultyLabel(course.difficulty) }}
              </span>
            </div>
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <PlayCircle
                class="w-8 h-8 text-emerald-400 drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-300"
              />
            </div>
          </div>
          <div class="p-2 flex flex-col justify-between flex-1 space-y-1">
            <h4
              class="text-[10px] font-bold text-[var(--text-primary)] truncate group-hover:text-emerald-400 transition-colors"
            >
              {{ course.title }}
            </h4>
            <div class="flex items-center justify-between text-[8px] text-[var(--text-secondary)]">
              <span>{{ course._count?.lessons || 0 }} 课时</span>
              <span v-if="course.category?.name" class="font-medium text-emerald-400/80">{{
                course.category.name
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-4 border border-dashed border-[var(--border-base)] rounded-xl bg-[var(--bg-app)]/30"
      >
        <p class="text-[10px] text-[var(--text-muted)]">暂无新上架课程</p>
      </div>
    </Card>

    <!-- Section 2: Model Library (模型库) -->
    <Card
      surface="glass"
      padding="sm"
      class="discovery-section space-y-3 shadow-sm border-[var(--border-base)]"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="p-1 bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-400 rounded-lg border border-blue-500/20"
          >
            <Box class="w-3.5 h-3.5" />
          </div>
          <h3 class="text-xs font-black text-[var(--text-primary)] tracking-wide">3D 模型资源库</h3>
        </div>
        <Button
          variant="link"
          size="sm"
          :icon="ArrowRight"
          icon-position="right"
          class="text-[10px] !p-0 text-blue-400 hover:text-blue-300"
          @click="emit('navigate', '/resources?tab=asset')"
        >
          查看全部
        </Button>
      </div>

      <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div v-for="i in 6" :key="i" class="animate-pulse space-y-2">
          <div class="aspect-video bg-slate-200 dark:bg-white/5 rounded-xl"></div>
          <div class="h-4 bg-slate-200 dark:bg-white/5 rounded w-3/4"></div>
        </div>
      </div>

      <div
        v-else-if="discoveryAssets.length"
        class="discovery-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3"
      >
        <div
          v-for="res in discoveryAssets"
          :key="res.id"
          class="group relative overflow-hidden rounded-xl bg-slate-500/5 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.05] cursor-pointer flex flex-col h-full hover:-translate-y-1 hover:border-blue-500/40 dark:hover:border-blue-500/30 hover:bg-slate-500/10 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-black/40 transition-all duration-500"
          @click="emit('navigate', `/resources?tab=asset&id=${res.id}`)"
        >
          <div class="relative aspect-video overflow-hidden bg-slate-900 rounded-t-xl">
            <img
              :src="getAssetUrl(res.previewUrl) || defaultResourceCovers.asset"
              :alt="res.title"
              class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-70"
            ></div>
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <Eye
                class="w-7 h-7 text-blue-400 drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-300"
              />
            </div>
          </div>
          <div class="p-2 flex flex-col justify-between flex-1 space-y-0.5">
            <h4
              class="text-[10px] font-bold text-[var(--text-primary)] truncate group-hover:text-blue-400 transition-colors"
            >
              {{ res.title }}
            </h4>
            <p class="text-[8px] text-[var(--text-secondary)] truncate">By {{ res.author }}</p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-4 border border-dashed border-[var(--border-base)] rounded-xl bg-[var(--bg-app)]/30"
      >
        <p class="text-[10px] text-[var(--text-muted)]">暂无新上架模型</p>
      </div>
    </Card>

    <!-- Section 3: Material Library (材料库) -->
    <Card
      surface="glass"
      padding="sm"
      class="discovery-section space-y-3 shadow-sm border-[var(--border-base)]"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="p-1 bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-400 rounded-lg border border-amber-500/20"
          >
            <Paintbrush class="w-3.5 h-3.5" />
          </div>
          <h3 class="text-xs font-black text-[var(--text-primary)] tracking-wide">
            物理材质贴图库
          </h3>
        </div>
        <Button
          variant="link"
          size="sm"
          :icon="ArrowRight"
          icon-position="right"
          class="text-[10px] !p-0 text-amber-400 hover:text-amber-300"
          @click="emit('navigate', '/resources?tab=material')"
        >
          查看全部
        </Button>
      </div>

      <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div v-for="i in 6" :key="i" class="animate-pulse space-y-2">
          <div class="aspect-video bg-slate-200 dark:bg-white/5 rounded-xl"></div>
          <div class="h-4 bg-slate-200 dark:bg-white/5 rounded w-3/4"></div>
        </div>
      </div>

      <div
        v-else-if="discoveryMaterials.length"
        class="discovery-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3"
      >
        <div
          v-for="res in discoveryMaterials"
          :key="res.id"
          class="group relative overflow-hidden rounded-xl bg-slate-500/5 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.05] cursor-pointer flex flex-col h-full hover:-translate-y-1 hover:border-amber-500/40 dark:hover:border-amber-500/30 hover:bg-slate-500/10 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-black/40 transition-all duration-500"
          @click="emit('navigate', `/resources?tab=material&id=${res.id}`)"
        >
          <div class="relative aspect-video overflow-hidden bg-slate-900 rounded-t-xl">
            <img
              :src="getAssetUrl(res.previewUrl) || defaultResourceCovers.material"
              :alt="res.title"
              class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-70"
            ></div>
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <Eye
                class="w-7 h-7 text-amber-400 drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-300"
              />
            </div>
          </div>
          <div class="p-2 flex flex-col justify-between flex-1 space-y-0.5">
            <h4
              class="text-[10px] font-bold text-[var(--text-primary)] truncate group-hover:text-amber-400 transition-colors"
            >
              {{ res.title }}
            </h4>
            <p class="text-[8px] text-[var(--text-secondary)] truncate">By {{ res.author }}</p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-4 border border-dashed border-[var(--border-base)] rounded-xl bg-[var(--bg-app)]/30"
      >
        <p class="text-[10px] text-[var(--text-muted)]">暂无新上架材质</p>
      </div>
    </Card>

    <!-- Section 4: Plugin Library (插件库) -->
    <Card
      surface="glass"
      padding="sm"
      class="discovery-section space-y-3 shadow-sm border-[var(--border-base)]"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="p-1 bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-400 rounded-lg border border-violet-500/20"
          >
            <Cpu class="w-3.5 h-3.5" />
          </div>
          <h3 class="text-xs font-black text-[var(--text-primary)] tracking-wide">工具及插件库</h3>
        </div>
        <Button
          variant="link"
          size="sm"
          :icon="ArrowRight"
          icon-position="right"
          class="text-[10px] !p-0 text-violet-400 hover:text-violet-300"
          @click="emit('navigate', '/resources?tab=plugin')"
        >
          查看全部
        </Button>
      </div>

      <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div v-for="i in 6" :key="i" class="animate-pulse space-y-2">
          <div class="aspect-video bg-slate-200 dark:bg-white/5 rounded-xl"></div>
          <div class="h-4 bg-slate-200 dark:bg-white/5 rounded w-3/4"></div>
        </div>
      </div>

      <div
        v-else-if="discoveryPlugins.length"
        class="discovery-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3"
      >
        <div
          v-for="res in discoveryPlugins"
          :key="res.id"
          class="group relative overflow-hidden rounded-xl bg-slate-500/5 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.05] cursor-pointer flex flex-col h-full hover:-translate-y-1 hover:border-violet-500/40 dark:hover:border-violet-500/30 hover:bg-slate-500/10 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-black/40 transition-all duration-500"
          @click="emit('navigate', `/resources?tab=plugin&id=${res.id}`)"
        >
          <div class="relative aspect-video overflow-hidden bg-slate-900 rounded-t-xl">
            <img
              :src="getAssetUrl(res.previewUrl) || defaultResourceCovers.plugin"
              :alt="res.title"
              class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-70"
            ></div>
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <Eye
                class="w-7 h-7 text-violet-400 drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-300"
              />
            </div>
          </div>
          <div class="p-2 flex flex-col justify-between flex-1 space-y-0.5">
            <h4
              class="text-[10px] font-bold text-[var(--text-primary)] truncate group-hover:text-violet-400 transition-colors"
            >
              {{ res.title }}
            </h4>
            <p class="text-[8px] text-[var(--text-secondary)] truncate">By {{ res.author }}</p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-4 border border-dashed border-[var(--border-base)] rounded-xl bg-[var(--bg-app)]/30"
      >
        <p class="text-[10px] text-[var(--text-muted)]">暂无新上架插件</p>
      </div>
    </Card>

    <!-- Section 5: Software Library (软件库) -->
    <Card
      surface="glass"
      padding="sm"
      class="discovery-section space-y-3 shadow-sm border-[var(--border-base)]"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="p-1 bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-400 rounded-lg border border-rose-500/20"
          >
            <Laptop class="w-3.5 h-3.5" />
          </div>
          <h3 class="text-xs font-black text-[var(--text-primary)] tracking-wide">
            创意软件与环境
          </h3>
        </div>
        <Button
          variant="link"
          size="sm"
          :icon="ArrowRight"
          icon-position="right"
          class="text-[10px] !p-0 text-rose-400 hover:text-rose-300"
          @click="emit('navigate', '/resources?tab=software')"
        >
          查看全部
        </Button>
      </div>

      <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div v-for="i in 6" :key="i" class="animate-pulse space-y-2">
          <div class="aspect-video bg-slate-200 dark:bg-white/5 rounded-xl"></div>
          <div class="h-4 bg-slate-200 dark:bg-white/5 rounded w-3/4"></div>
        </div>
      </div>

      <div
        v-else-if="discoverySoftwares.length"
        class="discovery-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3"
      >
        <div
          v-for="res in discoverySoftwares"
          :key="res.id"
          class="group relative overflow-hidden rounded-xl bg-slate-500/5 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/[0.05] cursor-pointer flex flex-col h-full hover:-translate-y-1 hover:border-rose-500/40 dark:hover:border-rose-500/30 hover:bg-slate-500/10 dark:hover:bg-white/[0.06] hover:shadow-lg dark:hover:shadow-black/40 transition-all duration-500"
          @click="emit('navigate', `/resources?tab=software&id=${res.id}`)"
        >
          <div class="relative aspect-video overflow-hidden bg-slate-900 rounded-t-xl">
            <img
              :src="getAssetUrl(res.previewUrl) || defaultResourceCovers.software"
              :alt="res.title"
              class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-70"
            ></div>
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <Eye
                class="w-7 h-7 text-rose-400 drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-300"
              />
            </div>
          </div>
          <div class="p-2 flex flex-col justify-between flex-1 space-y-0.5">
            <h4
              class="text-[10px] font-bold text-[var(--text-primary)] truncate group-hover:text-rose-400 transition-colors"
            >
              {{ res.title }}
            </h4>
            <p class="text-[8px] text-[var(--text-secondary)] truncate">By {{ res.author }}</p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-4 border border-dashed border-[var(--border-base)] rounded-xl bg-[var(--bg-app)]/30"
      >
        <p class="text-[10px] text-[var(--text-muted)]">暂无新上架软件</p>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.discovery-section {
  position: relative;
  overflow: hidden;
}

.discovery-section::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  content: '';
  background: linear-gradient(90deg, var(--primary), transparent 42%);
  opacity: 0.55;
}

.discovery-grid > div {
  min-width: 0;
}
</style>

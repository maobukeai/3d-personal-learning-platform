<script setup lang="ts">
import type { PlatformPreviewItem } from '~/composables/usePlatformApi';
import mirrorBanner from '~/assets/images/mirror_network_banner.jpg';

const platform = usePlatformApi();
const config = useRuntimeConfig();
const { data: home } = await useAsyncData('website-home', () => platform.getHome());
const { data: websiteOverview } = await useAsyncData('website-overview', () =>
  platform.getWebsiteOverview(),
);
const { data: mirrors } = await useAsyncData('website-mirrors', () => platform.getMirrors());
const { data: courses } = await useAsyncData('website-courses-preview', () =>
  platform.getCourses(),
);
const { data: showcase } = await useAsyncData('website-home-showcase', async () => {
  const [materials, plugins] = await Promise.allSettled([
    platform.getMaterials(),
    platform.getPlugins(),
  ]);
  return {
    materials: materials.status === 'fulfilled' ? materials.value.items || [] : [],
    plugins: plugins.status === 'fulfilled' ? plugins.value.plugins || [] : [],
  };
});

const copy = computed(() => ({
  eyebrow: String(home.value?.eyebrow || 'PERSONAL LEARNING PLATFORM'),
  title: String(home.value?.title || '把每一次学习，\n变成看得见的成长。'),
  subtitle: String(
    home.value?.subtitle ||
      '一个将课程、资源、3D 创作与协作串联起来的个人学习空间。更专注，也更自由。',
  ),
}));
const moduleVisibility = computed(() => ({
  courses: home.value?.showCoursePreview !== false,
  capabilities: home.value?.showCapabilityMap !== false,
  mirrors: home.value?.showMirrorPreview !== false,
}));
useSeoMeta({
  title: '首页',
  description: '聚合学习、3D 资源与创作协作的一体化个人学习平台。',
});

const coursePreview = computed(() => (courses.value || []).slice(0, 3));
const featuredCourse = computed(() => coursePreview.value[0]);
const featuredMaterial = computed(() => showcase.value?.materials[0]);
const featuredPlugin = computed(() => showcase.value?.plugins[0]);
const resourcePreviews = computed(() => [
  {
    key: 'materials',
    label: '材料库',
    path: '/materials',
    item: featuredMaterial.value,
    fallback: 'TEXTURE',
  },
  {
    key: 'plugins',
    label: '插件库',
    path: '/plugins',
    item: featuredPlugin.value,
    fallback: 'PLUGIN',
  },
]);
const secureImageUrl = (url?: string | null) => url?.replace(/^http:\/\//, 'https://') || '';
const previewImage = (item?: PlatformPreviewItem) =>
  secureImageUrl(item?.previewUrl || item?.thumbnail);
const brokenPreviews = ref(new Set<string>());
const previewFailed = (key: string) => brokenPreviews.value.has(key);
const markPreviewFailed = (key: string) => {
  brokenPreviews.value = new Set([...brokenPreviews.value, key]);
};
const capabilityGroups = [
  {
    number: '01',
    title: '我的学习',
    description: '用工作台、课程、计划和路线图把学习变成可持续的节奏。',
    tone: 'blue',
    items: [
      { label: '工作台概览', path: '/dashboard' },
      { label: '学习路线', path: '/roadmaps' },
      { label: '学院课程', path: '/academy' },
      { label: '我的笔记', path: '/notes' },
      { label: '工作计划', path: '/work' },
    ],
  },
  {
    number: '02',
    title: '团队协作',
    description: '把个人积累带入团队，在项目和空间中完成协作。',
    tone: 'mint',
    items: [
      { label: '探索团队', path: '/explore-teams' },
      { label: '项目', path: '/projects' },
      { label: '我的作品', path: '/my-works' },
    ],
  },
  {
    number: '03',
    title: '资源中心',
    description: '模型、材料、插件、软件与临时网盘，一处管理与复用。',
    tone: 'violet',
    items: [
      { label: '资源中心', path: '/resources' },
      { label: '模型库', path: '/assets' },
      { label: '材料库', path: '/materials' },
      { label: '插件库', path: '/plugins' },
      { label: '软件库', path: '/softwares' },
      { label: '我的作品', path: '/my-works' },
    ],
  },
  {
    number: '04',
    title: '交流社区',
    description: '围绕问题、创作与灵感，找到正在做同类事情的人。',
    tone: 'coral',
    items: [
      { label: '讨论区', path: '/discussions' },
      { label: '消息', path: '/messages' },
      { label: '作品展示', path: '/showcase' },
    ],
  },
  {
    number: '05',
    title: '工具服务',
    description: '从 AI 辅助到账号与邮箱工具，为日常工作流补上关键环节。',
    tone: 'amber',
    items: [
      { label: 'AI 助手', path: '/tools/ai-robots' },
      { label: '邮箱系统', path: '/tools/email' },
      { label: '谷歌账号', path: '/tools/google-warming' },
      { label: '2FA 验证', path: '/tools/two-factor' },
      { label: '临时网盘', path: '/temporary-netdisk' },
    ],
  },
];
</script>

<template>
  <section class="hero section-wrap">
    <div class="hero-copy">
      <p class="eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ copy.title }}</h1>
      <p class="hero-subtitle">{{ copy.subtitle }}</p>
      <div class="hero-actions">
        <a class="button button-primary" :href="config.public.appBase">开始学习 <span>→</span></a>
        <NuxtLink class="button button-quiet" to="/resources">探索资源</NuxtLink>
      </div>
    </div>
    <div class="hero-art hero-dashboard" role="img" aria-label="平台课程与资源工作台预览">
      <div class="dashboard-glow"></div>
      <div class="dashboard-window">
        <div class="dashboard-bar"><i></i><span>我的创作工作台</span><b>本周进度 68%</b></div>
        <div class="dashboard-main">
          <div class="dashboard-course">
            <div class="hero-media-fallback">LEARNING PATH</div>
            <img
              v-if="featuredCourse?.thumbnail && !previewFailed('hero-course')"
              :src="secureImageUrl(featuredCourse.thumbnail)"
              alt=""
              decoding="async"
              @error="markPreviewFailed('hero-course')"
            />
            <span>继续学习</span
            ><strong>{{ featuredCourse?.title || '把课程、笔记和创作放在一起' }}</strong>
          </div>
          <div class="dashboard-side">
            <div>
              <span>资源沉淀</span
              ><strong>{{ websiteOverview?.mirroredResources?.toLocaleString() || '—' }}</strong
              ><small>公开资源</small>
            </div>
            <div>
              <span>创作工具</span><strong>04</strong><small>模型 · 材料 · 插件 · 软件</small>
            </div>
          </div>
        </div>
        <div class="dashboard-tray">
          <div v-for="preview in resourcePreviews" :key="preview.key" class="dashboard-resource">
            <img
              v-if="previewImage(preview.item) && !previewFailed(`hero-${preview.key}`)"
              :src="previewImage(preview.item)"
              alt=""
              decoding="async"
              @error="markPreviewFailed(`hero-${preview.key}`)"
            />
            <span v-else>{{ preview.fallback }}</span>
            <b>{{ preview.label }}</b>
          </div>
          <div class="dashboard-task">
            <span>今日计划</span><b>03 / 05</b><i><em></em></i>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section-wrap platform-proof">
    <p>课程路径</p>
    <i></i>
    <p>3D 资产</p>
    <i></i>
    <p>材料与插件</p>
    <i></i>
    <p>任务协作</p>
    <i></i>
    <p>作品沉淀</p>
  </section>

  <section class="section-wrap platform-metrics" aria-label="平台实时数据">
    <div>
      <strong>{{ websiteOverview?.courses || 0 }}</strong
      ><span>公开课程</span>
    </div>
    <div>
      <strong>{{ websiteOverview?.assets || 0 }}</strong
      ><span>模型资产</span>
    </div>
    <div>
      <strong>{{ websiteOverview?.materials || 0 }}</strong
      ><span>材料资源</span>
    </div>
    <div>
      <strong>{{ (websiteOverview?.plugins || 0) + (websiteOverview?.softwares || 0) }}</strong
      ><span>工具与软件</span>
    </div>
    <div>
      <strong>{{ websiteOverview?.activeMirrors || 0 }}</strong
      ><span>在线镜像源</span>
    </div>
  </section>

  <section v-if="moduleVisibility.courses" class="section-wrap course-preview">
    <div class="section-heading">
      <div>
        <p class="eyebrow">LEARNING LIBRARY</p>
        <h2>把下一段成长，<br />放到眼前。</h2>
      </div>
      <a :href="`${config.public.appBase}/academy`">查看全部课程 <span>→</span></a>
    </div>
    <div class="course-cards">
      <a
        v-for="course in coursePreview"
        :key="course.id"
        class="course-card"
        :href="`${config.public.appBase}/academy/course/${course.id}`"
      >
        <img
          v-if="course.thumbnail && !previewFailed(`course-${course.id}`)"
          :src="secureImageUrl(course.thumbnail)"
          :alt="course.title"
          loading="lazy"
          decoding="async"
          @error="markPreviewFailed(`course-${course.id}`)"
        />
        <div v-else class="course-cover"><span>COURSE</span></div>
        <div class="course-meta">
          <span>{{ course.difficulty || 'LEARNING PATH' }}</span
          ><b>课程</b>
        </div>
        <h3>{{ course.title }}</h3>
        <p>{{ course.description || '从基础到进阶，建立更清晰的创作路径。' }}</p>
      </a>
      <a
        v-if="!coursePreview.length"
        class="course-empty"
        :href="`${config.public.appBase}/academy`"
      >
        <span>COURSE LIBRARY</span><strong>课程正在持续整理中</strong><em>进入学习平台查看 →</em>
      </a>
    </div>
  </section>

  <section class="section-wrap platform-bento">
    <div class="bento-intro">
      <p class="eyebrow">ONE PLATFORM, IN MOTION</p>
      <h2>从第一节课，<br />到下一件作品。</h2>
      <p>
        主站把学习、资源、任务和协作串成一个持续推进的创作流程。每一次收藏、练习和发布，都不会丢失。
      </p>
      <a class="button button-primary" :href="config.public.appBase"
        >进入我的工作台 <span>→</span></a
      >
    </div>
    <a class="bento-card bento-course" :href="`${config.public.appBase}/academy`">
      <img
        v-if="featuredCourse?.thumbnail && !previewFailed('bento-course')"
        :src="secureImageUrl(featuredCourse.thumbnail)"
        alt=""
        loading="lazy"
        decoding="async"
        @error="markPreviewFailed('bento-course')"
      />
      <div>
        <span>01 · 学习学院</span>
        <h3>课程、进度与笔记<br />始终在同一条路径上。</h3>
        <b>探索课程 →</b>
      </div>
    </a>
    <a class="bento-card bento-resource" :href="`${config.public.appBase}/resources`">
      <div class="bento-resource-head"><span>02 · 资源中心</span><b>四类资源库</b></div>
      <div class="bento-resource-stack">
        <div v-for="preview in resourcePreviews" :key="preview.key">
          <img
            v-if="previewImage(preview.item) && !previewFailed(`bento-${preview.key}`)"
            :src="previewImage(preview.item)"
            alt=""
            loading="lazy"
            decoding="async"
            @error="markPreviewFailed(`bento-${preview.key}`)"
          />
          <span v-else>{{ preview.fallback }}</span>
          <b>{{ preview.label }}</b>
        </div>
      </div>
      <h3>模型、材料、插件与软件，<br />不再散落在不同角落。</h3>
    </a>
    <a class="bento-card bento-work" :href="`${config.public.appBase}/work`">
      <span>03 · 创作协作</span>
      <div class="work-lines"><i></i><i></i><i></i></div>
      <h3>将灵感变成可推进的计划。</h3>
      <b>打开任务看板 →</b>
    </a>
  </section>

  <!-- Platform Highlights (Apple Minimalist Feature Grid) -->
  <section class="section-wrap platform-highlights">
    <div class="highlight-heading">
      <p class="eyebrow">FEATURES OVERVIEW</p>
      <h2>赋能 3D 创作者的全能工作台。</h2>
      <p>
        打破零散工具的限制，将灵感收集、知识管理、协作开发和物理资产沉淀融合于一体，为您提供极致的一站式学习创作生态。
      </p>
    </div>

    <div class="highlight-grid">
      <div class="highlight-item">
        <div class="item-icon">📚</div>
        <h3>模块化课程与路线图</h3>
        <p>
          提供从基础到进阶实战的 3D
          课程体系，集成学习进度自动跟踪、笔记双向关联和个人知识树生成，让每一阶段的成长都切实可见。
        </p>
      </div>

      <div class="highlight-item">
        <div class="item-icon">🌱</div>
        <h3>双向关联的 Yjs 知识库</h3>
        <p>
          基于冲突解决的 Yjs
          多人同步笔记，轻松关联您的课程进度、临时云盘文件与团队项目卡片，助您自主编织多维的立体知识网络。
        </p>
      </div>

      <div class="highlight-item">
        <div class="item-icon">💎</div>
        <h3>Draco 10 级 3D 压缩引擎</h3>
        <p>
          无缝整合 R2 存储通道，通过 gltf-transform 进行模型 Draco 10 级无损轻量化压缩，贴图 WebP
          自适应转换，让高精度 3D 资产实现秒级加载。
        </p>
      </div>

      <div class="highlight-item">
        <div class="item-icon">👥</div>
        <h3>多租户团队项目协作</h3>
        <p>
          内置看板任务调度与后台 BullMQ
          队列服务，支持大文件贴图的自动压缩任务，无论是个人创作还是团队大文件项目开发，都能在云端空间流式协作。
        </p>
      </div>
    </div>
  </section>

  <section v-if="moduleVisibility.capabilities" class="capability-section">
    <div class="section-wrap">
      <div class="capability-heading">
        <div>
          <p class="eyebrow">EVERYTHING IN ONE PLACE</p>
          <h2>不止学习，<br />还有完整的创作生态。</h2>
        </div>
        <p>官网把主站的核心功能完整呈现出来。选一个入口，直接开始你的下一步。</p>
      </div>
      <div class="capability-grid">
        <article
          v-for="group in capabilityGroups"
          :key="group.title"
          class="capability-card"
          :class="`tone-${group.tone}`"
        >
          <div class="capability-card-head">
            <span>{{ group.number }}</span
            ><small>{{ group.items.length }} 个入口</small>
          </div>
          <h3>{{ group.title }}</h3>
          <p>{{ group.description }}</p>
          <div class="capability-links">
            <a
              v-for="item in group.items"
              :key="item.path"
              :href="`${config.public.appBase}${item.path}`"
            >
              {{ item.label }} <span>↗</span>
            </a>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section v-if="moduleVisibility.mirrors" class="section-wrap mirror-preview">
    <div class="section-heading">
      <div>
        <p class="eyebrow">MIRROR NETWORK</p>
        <h2>值得反复访问的资源。</h2>
      </div>
      <NuxtLink to="/mirrors">查看全部 <span>→</span></NuxtLink>
    </div>
    <div class="mirror-cards">
      <NuxtLink
        v-for="mirror in mirrors?.slice(0, 3)"
        :key="mirror.id"
        class="mirror-card"
        :to="`/mirrors/${mirror.id}`"
      >
        <img
          v-if="mirror.iconUrl"
          :src="mirror.iconUrl"
          :alt="mirror.displayName"
          loading="lazy"
          decoding="async"
        /><span v-else class="card-icon">✦</span>
        <h3>{{ mirror.displayName }}</h3>
        <p>{{ mirror.description || '持续同步的精选学习资源。' }}</p>
        <small>{{ mirror.totalResources.toLocaleString() }} 项资源</small>
      </NuxtLink>

      <!-- Promo Card for Spacing Fill (Spans 2 columns if 1 mirror exists, 1 column if 2 mirrors exist) -->
      <div
        v-if="mirrors && mirrors.length > 0 && mirrors.length < 3"
        class="mirror-promo-card"
        :class="{ 'span-2': mirrors.length === 1 }"
      >
        <div class="promo-content">
          <span class="promo-badge">FEATURED</span>
          <h3>高速全球节点同步</h3>
          <p>
            主站云端存储与离线镜像站双向打通，集成 Draco 10 级 3D 模型高压缩算法，贴图自适应 WebP
            格式化，为您的学习与创作提供最优质、最快速的网络加载性能。
          </p>
          <div class="promo-features">
            <span class="feat-item">⚡ Draco 压缩</span>
            <span class="feat-item">🌍 多分发节点</span>
            <span class="feat-item">💾 离线高速缓存</span>
          </div>
        </div>
        <div class="promo-image-container">
          <img :src="mirrorBanner" alt="Mirror Network Visual" loading="lazy" />
        </div>
      </div>

      <div v-if="!mirrors?.length" class="mirror-empty">镜像站正在准备中，敬请期待。</div>
    </div>
  </section>
</template>

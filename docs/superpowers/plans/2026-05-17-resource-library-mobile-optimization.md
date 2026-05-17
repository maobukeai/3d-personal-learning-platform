# 资源库移动端全量优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优化 3D 学习平台资源库相关页面（资产、项目、材质、作品）在移动设备上的显示效果，确保 Header、网格、弹窗等 UI 元素在手机端（宽度 < 768px）能完美适配。

**架构：** 利用 Vue 3 的响应式变量（如 `isMobile`）和 Tailwind CSS 的响应式前缀（`md:`, `sm:`, `hidden`, `flex`），动态调整布局属性和组件可见性。

**技术栈：** Vue 3, TypeScript, Tailwind CSS (v4), Element Plus, Lucide Vue Next.

---

### 任务 1：优化 AssetsView.vue (模型资产库)

**文件：**
- 修改：`src/views/Assets/AssetsView.vue`

- [ ] **步骤 1：优化 Header 布局**

缩减内边距，使搜索栏在手机端宽度自适应。

```vue
<!-- 修改前 (约 L230) -->
<div class="h-auto md:h-14 border-b flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-6 py-3 md:py-0 shrink-0 gap-3" ...>
  <div class="flex items-center text-xs gap-1 font-medium" ...>
    <span class="hover:text-accent cursor-pointer transition-colors hidden sm:inline">3D 学习资源库</span>
    <ChevronRight class="w-3.5 h-3.5 hidden sm:inline" />
    <span style="color: var(--text-primary)">我的资源</span>
  </div>
  <div class="flex items-center gap-2 sm:gap-4 w-full md:w-auto">
    <div class="relative flex-1 md:flex-none"> ... <input ... class="... w-full md:w-64 ..." /> </div>
  </div>
</div>

<!-- 修改后 -->
<div class="h-auto md:h-14 border-b flex flex-col md:flex-row md:items-center justify-between px-3 sm:px-6 py-2.5 md:py-0 shrink-0 gap-2.5" ...>
  <div class="flex items-center text-[10px] sm:text-xs gap-1 font-medium" ...>
    <span class="hover:text-accent cursor-pointer transition-colors">3D 资源库</span>
    <ChevronRight class="w-3 h-3" />
    <span style="color: var(--text-primary)">模型资产</span>
  </div>
  <div class="flex items-center gap-2 w-full md:w-auto">
    <div class="relative flex-1"> ... <input ... class="... w-full md:w-64 ..." /> </div>
    <!-- 保持 RotateCw 按钮 -->
  </div>
</div>
```

- [ ] **步骤 2：优化资产网格与内边距**

减小移动端内边距。

```vue
<!-- 修改前 (约 L330) -->
<div class="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide">

<!-- 修改后 -->
<div class="flex-1 overflow-y-auto p-3 sm:p-6 scrollbar-hide">
```

- [ ] **步骤 3：Commit**

```bash
git add src/views/Assets/AssetsView.vue
git commit -m "style(assets): optimize header and padding for mobile"
```

---

### 任务 2：优化 ProjectsView.vue (项目库)

**文件：**
- 修改：`src/views/Assets/ProjectsView.vue`

- [ ] **步骤 1：添加 `isMobile` 逻辑**

```typescript
// 在 <script setup> 中添加
const isMobile = ref(window.innerWidth < 768);
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768;
};
onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  fetchProjects();
});
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
```

- [ ] **步骤 2：优化 Header 与搜索栏**

移除固定宽度 `w-80`，改用响应式类。

```vue
<!-- 修改前 (约 L220) -->
<div class="flex items-center justify-between px-10 pt-10 pb-6 shrink-0">
  <div class="flex items-center gap-4"> ... </div>
  <div class="flex items-center gap-6">
    <div class="relative group"> ... <input ... class="... w-80 ..." /> </div>
    <button class="... px-6 py-3 ..."> ... <span>新建项目</span> </button>
  </div>
</div>

<!-- 修改后 -->
<div class="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-10 pt-6 md:pt-10 pb-4 md:pb-6 shrink-0 gap-4">
  <div class="flex items-center gap-3"> ... </div>
  <div class="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 w-full md:w-auto">
    <div class="relative group w-full sm:w-64 md:w-80"> ... <input ... class="... w-full ..." /> </div>
    <button class="... w-full sm:w-auto px-5 py-2.5 ..."> ... <span>新建项目</span> </button>
  </div>
</div>
```

- [ ] **步骤 3：优化 Stats 卡片**

调整网格列数。

```vue
<!-- 修改前 (约 L247) -->
<div class="grid grid-cols-1 md:grid-cols-4 gap-6 ...">

<!-- 修改后 -->
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 ...">
```

- [ ] **步骤 4：Commit**

```bash
git add src/views/Assets/ProjectsView.vue
git commit -m "style(projects): make header and stats responsive"
```

---

### 任务 3：优化 MaterialsView.vue (材质库)

**文件：**
- 修改：`src/views/Assets/MaterialsView.vue`

- [ ] **步骤 1：添加 `isMobile` 逻辑**

```typescript
// 在 <script setup> 中添加 (参考 AssetsView.vue)
const isMobile = ref(window.innerWidth < 768);
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768;
};
onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  fetchMaterials();
});
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
```

- [ ] **步骤 2：优化 Header**

```vue
<!-- 修改前 (约 L230) -->
<div class="h-16 border-b px-8 flex items-center justify-between shrink-0" ...>
  <div class="flex items-center gap-3"> ... </div>
  <div class="flex items-center gap-4">
    <div class="relative"> ... <input ... class="... w-72 ..." /> </div>
    <button ...> <Plus ... /> 上传新材料 </button>
  </div>
</div>

<!-- 修改后 -->
<div class="h-auto md:h-16 border-b px-4 md:px-8 py-3 md:py-0 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-3" ...>
  <div class="flex items-center gap-2.5"> ... </div>
  <div class="flex items-center gap-2 w-full md:w-auto">
    <div class="relative flex-1"> ... <input ... class="... w-full md:w-72 ..." /> </div>
    <button class="... px-3 py-2 ..." @click="..."> <Plus class="w-4 h-4" /> </button>
  </div>
</div>
```

- [ ] **步骤 3：优化分类工具栏**

确保在移动端不会被截断。

```vue
<!-- 修改前 (约 L255) -->
<div class="border-b px-8 py-2 ...">

<!-- 修改后 -->
<div class="border-b px-4 md:px-8 py-2 ...">
```

- [ ] **步骤 4：Commit**

```bash
git add src/views/Assets/MaterialsView.vue
git commit -m "style(materials): optimize header and padding for small screens"
```

---

### 任务 4：全局弹窗与通用样式微调

**文件：**
- 修改：`src/views/Assets/AssetsView.vue`, `src/views/Assets/ProjectsView.vue`, `src/views/Assets/MaterialsView.vue`

- [ ] **步骤 1：适配 `el-drawer` 和 `el-dialog`**

在手机端将 `el-drawer` 的 `size` 设为 `100%` 或 `90%`。
在手机端将 `el-dialog` 的 `width` 设为 `95%`。

- [ ] **步骤 2：最终验证**

在浏览器中使用移动端模拟器（375px）检查所有资源库页面。

- [ ] **步骤 3：Commit**

```bash
git commit -m "style(ui): final touch for resource library mobile optimization"
```

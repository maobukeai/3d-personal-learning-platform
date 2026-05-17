# Publish/Upload Work Page Mobile Optimization Plan

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 解决 `PublishWorkDialog.vue` 在手机端布局挤压、不可用的问题，确保在窄屏下自动切换为单列布局并优化交互。

**架构：** 使用 Tailwind CSS 的响应式断点（`md:`）对现有布局进行重构。将固定宽度和 Grid 列数改为响应式配置，并为顶部标签和类型选择按钮增加水平滚动支持。

**技术栈：** Vue 3, Tailwind CSS (v4), Lucide Icons, Element Plus (Select/Switch).

---

### 任务 1：对话框容器与顶部标签适配

**文件：**
- 修改：`src/components/PublishWorkDialog.vue`

- [ ] **步骤 1：调整对话框外层容器响应式样式**

修改外层 `div` 的内边距和最大宽度。

```vue
<!-- 修改前 -->
<div
  class="relative w-full max-w-[80vw] max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl scrollbar-hide"
  style="background-color: var(--bg-card)"
>

<!-- 修改后 -->
<div
  class="relative w-full max-w-[95vw] md:max-w-[80vw] max-h-[90vh] overflow-y-auto p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl scrollbar-hide"
  style="background-color: var(--bg-card)"
>
```

- [ ] **步骤 2：优化顶部切换标签 (Category Tabs)**

增加水平滚动支持，防止在窄屏下挤压。

```vue
<!-- 修改前 -->
<div
  class="flex items-center gap-2 p-1 rounded-xl mb-6"
  style="background-color: var(--bg-app)"
>
  <button class="flex-1 ..." ...>...</button>
  ...
</div>

<!-- 修改后 -->
<div
  class="flex items-center gap-2 p-1 rounded-xl mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide"
  style="background-color: var(--bg-app)"
>
  <button
    class="flex-none md:flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
    ...
  >...</button>
  ...
</div>
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/PublishWorkDialog.vue
git commit -m "style(ui): improve dialog container and category tabs responsiveness"
```

---

### 任务 2：3D模型与资产上传布局适配

**文件：**
- 修改：`src/components/PublishWorkDialog.vue`

- [ ] **步骤 1：适配 "3D模型展示" (Model Category) 布局**

将 `grid-cols-2` 改为响应式。

```vue
<!-- 修改前 -->
<div class="grid grid-cols-2 gap-6">

<!-- 修改后 -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
```

- [ ] **步骤 2：适配 "资产上传" (Asset Category) 布局**

同样修改 Grid 布局。

```vue
<!-- 修改前 -->
<div class="grid grid-cols-2 gap-6">

<!-- 修改后 -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/PublishWorkDialog.vue
git commit -m "style(ui): update model and asset category layouts for mobile"
```

---

### 任务 3：创意作品展示布局与编辑器适配

**文件：**
- 修改：`src/components/PublishWorkDialog.vue`

- [ ] **步骤 1：适配 "创意作品展示" (Work Category) 主布局**

将左右分栏改为垂直堆叠。

```vue
<!-- 修改前 -->
<div class="flex gap-6">
  <!-- Left side: Form fields -->
  <div class="w-[40%] space-y-5 shrink-0">
  ...
  <!-- Right side: Markdown editor -->
  <div class="w-full md:w-[60%] min-w-0">

<!-- 修改后 -->
<div class="flex flex-col md:flex-row gap-6">
  <!-- Left side: Form fields -->
  <div class="w-full md:w-[40%] space-y-5 shrink-0">
  ...
  <!-- Right side: Markdown editor -->
  <div class="w-full md:w-[60%] min-w-0">
```

- [ ] **步骤 2：优化作品类型按钮适配**

同样改为水平滚动，防止挤压。

```vue
<!-- 修改前 -->
<div class="flex items-center gap-2">
  <button class="flex-1 ..." ...>...</button>
</div>

<!-- 修改后 -->
<div class="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide p-1">
  <button
    v-for="t in ['IMAGE', 'VIDEO', 'TEXT', 'MODEL', 'OTHER']"
    :key="t"
    class="flex-none md:flex-1 px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
    ...
  >
```

- [ ] **步骤 3：动态调整 MarkdownEditor 高度**

增加一个计算属性或在渲染时判断。

```vue
<!-- 在 script setup 中添加 -->
const isMobile = ref(window.innerWidth < 768);
const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};
onMounted(() => {
  window.addEventListener('resize', handleResize);
});
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

<!-- 在模板中修改 MarkdownEditor 的 height -->
:height="isMobile ? (publishCategory === 'work' ? '400px' : '300px') : (publishCategory === 'work' ? '500px' : '350px')"
```

- [ ] **步骤 4：Commit**

```bash
git add src/components/PublishWorkDialog.vue
git commit -m "style(ui): stack form fields and markdown editor on mobile"
```

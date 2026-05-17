# 团队详情页面手机适配实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 深度优化“团队详情”页面 (`TeamDetailView.vue`)，使其在移动端拥有原生应用般的体验，解决头部排版、标签切换以及按钮布局在小屏幕上的适配问题。

**架构：** 
1. **头部视觉优化**：减小移动端内边距，优化头像大小和文字字号。
2. **操作按钮响应式**：在移动端将主要操作按钮全宽显示或合理堆叠。
3. **滚动标签栏**：确保标签栏在屏幕窄时可以横向滑动，不产生布局错乱。
4. **卡片网格适配**：调整成员卡片在极小屏幕上的间距和圆角。

**技术栈：** Vue 3, Tailwind CSS (v4), Lucide Icons, Element Plus.

---

### 任务 1：优化 Header 区域 (Premium Header)

**文件：**
- 修改：`src/views/Community/TeamDetailView.vue`

- [ ] **步骤 1：调整内边距和容器布局**

修改 `Premium Header` 的内边距，从 `px-8 py-12` 改为响应式。

```html
<!-- 修改前 -->
<div class="max-w-7xl mx-auto px-8 py-12 relative z-10">

<!-- 修改后 -->
<div class="max-w-7xl mx-auto px-4 sm:px-8 py-8 lg:py-12 relative z-10">
```

- [ ] **步骤 2：优化头像尺寸**

在移动端缩小头像尺寸，提升空间利用率。

```html
<!-- 修改前 -->
<div class="w-40 h-40 rounded-[2.5rem] ...">

<!-- 修改后 -->
<div class="w-32 h-32 lg:w-40 lg:h-40 rounded-[2rem] lg:rounded-[2.5rem] ...">
```

- [ ] **步骤 3：调整标题和统计信息**

优化字号和间距。

```html
<!-- 修改标题 -->
<h1 class="text-3xl lg:text-4xl font-black tracking-tight" ...>

<!-- 修改统计信息容器 -->
<div class="flex flex-wrap items-center justify-center lg:justify-start gap-4 lg:gap-8">
  <div class="flex items-center gap-2 bg-slate-100/50 dark:bg-white/5 px-3 py-1.5 rounded-xl">
    ...
  </div>
</div>
```

- [ ] **步骤 4：优化主操作按钮**

在移动端将按钮容器设为全宽并可能垂直排列。

```html
<!-- 修改操作按钮容器 -->
<div class="flex flex-col sm:flex-row items-center gap-3 lg:gap-4 w-full lg:w-auto mt-8 lg:mt-0">
  <template v-if="canManageTeam">
    <button class="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 ...">
      ...管理成员...
    </button>
    <button class="hidden sm:flex p-4 ...">
      ...设置图标...
    </button>
  </template>
  ... (其他按钮同理增加 w-full sm:w-auto) ...
</div>
```

- [ ] **步骤 5：提交变更**

```bash
git add src/views/Community/TeamDetailView.vue
git commit -m "style(team-detail): optimize header for mobile"
```

---

### 任务 2：响应式标签切换 (Modern Tabs)

**文件：**
- 修改：`src/views/Community/TeamDetailView.vue`

- [ ] **步骤 1：实现标签栏横向滚动**

```html
<!-- 修改 Tabs 容器 -->
<div class="flex gap-6 lg:gap-10 mb-8 lg:mb-10 border-b overflow-x-auto scrollbar-hide" ...>
  <button v-for="..." class="flex items-center gap-2 pb-4 text-sm font-bold transition-all relative whitespace-nowrap" ...>
    ...
  </button>
</div>
```

- [ ] **步骤 2：提交变更**

```bash
git add src/views/Community/TeamDetailView.vue
git commit -m "style(team-detail): make tabs scrollable on mobile"
```

---

### 任务 3：优化内容区域与卡片

**文件：**
- 修改：`src/views/Community/TeamDetailView.vue`

- [ ] **步骤 1：调整内容内边距和网格**

```html
<!-- Main Content Container -->
<div class="max-w-7xl mx-auto px-4 sm:px-8 py-6 lg:py-10">
  <!-- 全员看板标题 -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
    ...
  </div>

  <!-- 网格间距调整 -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
    ...
  </div>
</div>
```

- [ ] **步骤 2：提交变更**

```bash
git add src/views/Community/TeamDetailView.vue
git commit -m "style(team-detail): optimize content grid for mobile"
```

---

### 任务 4：验证验证验证

- [ ] **步骤 1：多尺寸验证**

1. 验证 375px (iPhone SE) 宽度下的布局。
2. 验证 768px (iPad) 宽度下的布局。
3. 确保所有操作（解散、申请、管理）在小屏幕上依然触手可及。

- [ ] **步骤 2：最终清理**

```bash
git commit -m "chore(team-detail): final polish for mobile optimization"
```

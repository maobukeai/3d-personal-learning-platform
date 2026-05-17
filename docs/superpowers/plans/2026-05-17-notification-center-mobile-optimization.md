# 消息中心移动端适配实现计划 (Notification Center Mobile Optimization)

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优化消息中心在移动端的布局，由垂直侧边栏改为横向滚动 Tab，并精简卡片样式，提升阅读效率。

**架构：** 利用 Tailwind CSS 的响应式类 (`md:`) 将侧边栏在手机端重构为横向滚动的 Tab 栏；通过调整 padding 和 border-radius 优化移动端视觉密度。

**技术栈：** Vue 3, Tailwind CSS v4, Lucide Vue Next Icons.

---

## 待修改文件清单
- 修改：`src/views/NotificationsView.vue` - 核心布局与样式调整。

---

### 任务 1：重构侧边栏为响应式 Tab 栏

**文件：**
- 修改：`src/views/NotificationsView.vue`

- [ ] **步骤 1：修改侧边栏容器样式**
将原本固定的侧边栏改为手机端横向排列，去掉边框和过大的内边距。

```vue
<!-- 修改前 (约 193 行) -->
<div
  class="w-full md:w-72 border-b md:border-b-0 md:border-r p-4 md:p-6 shrink-0 backdrop-blur-sm bg-white/20 dark:bg-slate-900/20 z-10"
  style="border-color: var(--border-base)"
>

<!-- 修改后 -->
<div
  class="w-full md:w-72 border-b md:border-b-0 md:border-r p-3 md:p-6 shrink-0 backdrop-blur-sm bg-white/20 dark:bg-slate-900/20 z-10 overflow-x-auto scrollbar-hide"
  style="border-color: var(--border-base)"
>
```

- [ ] **步骤 2：重构快捷过滤器布局**
将“全部/未读”过滤器改为手机端并排显示，去掉过大的网格间距。

```vue
<!-- 修改前 (约 208 行) -->
<div class="grid grid-cols-2 md:flex md:flex-col gap-1.5 md:gap-1">

<!-- 修改后 -->
<div class="flex md:flex-col gap-2 md:gap-1 shrink-0">
```

- [ ] **步骤 3：重构分类列表为横向滚动**
将分类列表在移动端改为横向排列，去掉标题。

```vue
<!-- 修改前 (约 238 行) -->
<div class="mt-3 md:mt-8 pt-3 md:pt-6 border-t" style="border-color: var(--border-base)">
  <h3 class="hidden md:block px-4 mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
    分类
  </h3>
  <!-- Category Grid: 3 columns on mobile, no scroll -->
  <div class="grid grid-cols-3 md:flex md:flex-col gap-1.5 md:gap-1">

<!-- 修改后 -->
<div class="mt-2 md:mt-8 pt-2 md:pt-6 border-t md:border-t" style="border-color: var(--border-base)">
  <h3 class="hidden md:block px-4 mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
    分类
  </h3>
  <div class="flex md:flex-col gap-2 md:gap-1 shrink-0">
```

- [ ] **步骤 4：运行验证**
检查手机端（模拟器）侧边栏是否变为横向排列且可滚动。

---

### 任务 2：优化通知卡片与内容区域

**文件：**
- 修改：`src/views/NotificationsView.vue`

- [ ] **步骤 1：调整通知卡片容器与间距**
缩小手机端圆角和内边距，减少内容区域的边距。

```vue
<!-- 内容区域容器 (约 277 行) -->
<div class="flex-1 overflow-y-auto p-3 md:p-8 ...">

<!-- 循环卡片 (约 289 行) -->
<div
  v-for="n in filteredNotifications"
  :key="n.id"
  class="group p-3.5 md:p-6 rounded-2xl md:rounded-3xl border ..."
  ...
>
```

- [ ] **步骤 2：优化卡片内部布局**
减小图标大小，调整标题和日期的分布。

```vue
<!-- 图标容器 (约 300 行) -->
<div class="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl ...">
  <component :is="getIcon(n.type)" class="w-4.5 h-4.5 md:w-6 md:h-6" />
</div>
```

- [ ] **步骤 3：Commit**
```bash
git add src/views/NotificationsView.vue
git commit -m "feat(ui): optimize notification center for mobile"
```

---

### 任务 3：验证与微调

- [ ] **步骤 1：视觉检查**
确保横向滚动的 Tab 栏在两端有适当的留白（通过在容器两端加 `padding` 或 `gap`）。
- [ ] **步骤 2：交互测试**
测试点击 Tab 切换时，列表是否能正确更新。

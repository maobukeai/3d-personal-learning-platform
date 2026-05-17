# My Works Page Mobile Optimization Implementation Plan

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 "我的作品" 页面 (`MyWorksView.vue`) 的全面移动端适配，确保所有功能在小屏幕上正常且美观。

**架构：** 使用 Tailwind CSS 的响应式类 (`md:`, `lg:`) 调整布局。主要涉及：Header 堆叠、统计栏和标签页横向滚动、作品卡片单列显示、以及预览弹窗的垂直堆叠适配。

**技术栈：** Vue 3, TypeScript, Tailwind CSS, Lucide Icons, Element Plus (UI components).

---

## 待修改文件
- `src/views/Assets/MyWorksView.vue`: 核心页面组件，负责布局和交互适配。

---

### 任务 1：Header 响应式布局调整

**文件：**
- 修改：`src/views/Assets/MyWorksView.vue`

- [ ] **步骤 1：调整 Header 外层容器**
将 `h-16` (固定高度) 改为 `min-h-16 h-auto py-4 md:py-0`，以便在手机端内容多时自动撑开。

- [ ] **步骤 2：调整标题与按钮布局**
将内层 `flex items-center justify-between` 在手机端改为 `flex-col items-start gap-4 md:flex-row md:items-center`。

- [ ] **步骤 3：调整搜索框与按钮组**
设置搜索框容器在手机端为 `w-full`。按钮组容器在手机端使用 `flex-wrap` 或 `w-full` 确保不溢出。

- [ ] **步骤 4：Commit**
```bash
git add src/views/Assets/MyWorksView.vue
git commit -m "style(my-works): make header responsive"
```

---

### 任务 2：统计栏 (Stats Bar) 横向滚动适配

**文件：**
- 修改：`src/views/Assets/MyWorksView.vue`

- [ ] **步骤 1：实现统计栏容器滚动**
在统计栏的外层 `div` (包含 5 个卡片) 增加类：`overflow-x-auto flex-nowrap scrollbar-hide`。

- [ ] **步骤 2：保持卡片宽度**
为内部每个统计卡片增加 `shrink-0 w-[140px] md:w-auto`，确保在滚动时不会被挤压变形。

- [ ] **步骤 3：Commit**
```bash
git add src/views/Assets/MyWorksView.vue
git commit -m "style(my-works): enable horizontal scroll for stats bar"
```

---

### 任务 3：标签页与控制栏适配

**文件：**
- 修改：`src/views/Assets/MyWorksView.vue`

- [ ] **步骤 1：实现标签页横向滚动**
将标签页容器 (包含 `v-for="tab in tabs"`) 增加 `overflow-x-auto flex-nowrap scrollbar-hide`，确保在小屏幕上可以滑动切换。

- [ ] **步骤 2：控制栏堆叠**
将外层 `flex items-center justify-between` 在手机端改为 `flex-col items-start gap-4 md:flex-row md:items-center`。

- [ ] **步骤 3：Commit**
```bash
git add src/views/Assets/MyWorksView.vue
git commit -m "style(my-works): optimize tabs and controls for mobile"
```

---

### 任务 4：作品网格单列适配

**文件：**
- 修改：`src/views/Assets/MyWorksView.vue`

- [ ] **步骤 1：调整 Grid 列数**
确保网格容器使用 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`。目前的代码已经是这样，但需要检查内边距 `p-8` 在手机端是否过大，建议改为 `p-4 md:p-8`。

- [ ] **步骤 2：优化列表模式 (List View)**
列表模式在手机端可能过于拥挤，将 `flex items-center` 在手机端改为 `flex-col items-start` 或者隐藏部分非核心列（如文件大小、顶点数）。

- [ ] **步骤 3：Commit**
```bash
git add src/views/Assets/MyWorksView.vue
git commit -m "style(my-works): optimize grid and list view for mobile"
```

---

### 任务 5：预览与编辑弹窗适配

**文件：**
- 修改：`src/views/Assets/MyWorksView.vue`

- [ ] **步骤 1：调整预览 Overlay 布局**
将预览容器的 `flex-col md:flex-row` 确保正确应用。

- [ ] **步骤 2：调整侧边栏宽度与顺序**
侧边栏在手机端应为 `w-full`，且排在预览器下方。移除 `border-l` 增加 `border-t`。

- [ ] **步骤 3：优化移动端操作按钮**
预览下方的悬浮控制条在手机端应居中且图标足够大。

- [ ] **步骤 4：Commit**
```bash
git add src/views/Assets/MyWorksView.vue
git commit -m "style(my-works): optimize preview and edit dialogs for mobile"
```

---

### 任务 6：最终验证

- [ ] **步骤 1：检查所有响应式临界点**
使用浏览器开发工具检查 375px (iPhone SE), 414px (Plus), 768px (iPad) 等尺寸下的显示效果。
- [ ] **步骤 2：检查交互**
确保横向滚动平滑，点击目标（按钮、标签）在手机上易于操作。

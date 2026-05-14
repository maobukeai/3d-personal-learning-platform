# “管理中心” UI 优化实现计划 (方案 B)

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将顶部导航栏的“管理中心”项右移，并为其图标应用现代化渐变及投影效果。

**架构：** 在 `MainLayout.vue` 中通过条件类（Conditional Classes）和内联样式实现针对管理工作空间的特殊视觉效果。

**技术栈：** Vue 3, Tailwind CSS (v4), CSS Gradients, Box Shadows.

---

### 任务 1：修改 MainLayout.vue 实现布局与图标样式优化

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：定位并修改工作空间切换器容器样式**

在 `MainLayout.vue` 的模板中，找到处理工作空间切换的 `el-dropdown` 容器。为其中的 `div` 添加左边距。

```html
<!-- 寻找约 L447 行附近的 el-dropdown -->
<!-- 修改前 -->
<div class="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
  <div class="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm" :class="workspaceStore.currentWorkspace.color">
    {{ workspaceStore.currentWorkspace.name.charAt(0) }}
  </div>
  <span class="text-sm font-bold truncate max-w-[200px]" style="color: var(--text-primary)">{{ workspaceStore.currentWorkspace.name }}</span>
  <ChevronDown class="w-4 h-4 text-slate-400 shrink-0" />
</div>

<!-- 修改后：添加 ml-3 (12px) 偏移，并为图标应用渐变和投影 -->
<div class="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-all duration-300" 
     :class="{ 'ml-3 hover:scale-[1.02]': workspaceStore.isAdminWorkspace }">
  <div class="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-sm shrink-0 transition-all duration-300" 
       :class="workspaceStore.isAdminWorkspace ? '' : workspaceStore.currentWorkspace.color"
       :style="workspaceStore.isAdminWorkspace ? {
         background: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
         boxShadow: '0 4px 10px rgba(225, 29, 72, 0.3)'
       } : {}">
    {{ workspaceStore.currentWorkspace.name.charAt(0) }}
  </div>
  <span class="text-sm font-bold truncate max-w-[200px]" 
        :class="{ 'tracking-wide': workspaceStore.isAdminWorkspace }"
        style="color: var(--text-primary)">
    {{ workspaceStore.currentWorkspace.name }}
  </span>
  <ChevronDown class="w-4 h-4 text-slate-400 shrink-0" :class="{ 'text-rose-400': workspaceStore.isAdminWorkspace }" />
</div>
```

- [ ] **步骤 2：验证代码正确性**

检查是否引入了任何语法错误，并确保 `workspaceStore.isAdminWorkspace` 在该上下文可用。

- [ ] **步骤 3：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "style: optimize admin center ui with gradient and margin"
```

---

### 任务 2：验证与清理

- [ ] **步骤 1：手动验证（需管理员账户）**
  - 切换到“管理中心”空间。
  - 检查左侧间距是否增加。
  - 检查图标是否变为红粉渐变且带有彩色投影。
  - 检查悬停时是否有轻微放大效果。
- [ ] **步骤 2：清理视觉伴侣**
  - 停止并删除视觉伴侣原型文件。

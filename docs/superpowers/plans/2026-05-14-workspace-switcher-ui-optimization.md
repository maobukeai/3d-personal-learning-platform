# 工作空间切换器 UI 优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将工作空间切换器的下拉列表升级为更现代、信息更丰富的样式，添加圆形头像、徽标显示和快捷设置操作。

**架构：** 在 `MainLayout.vue` 中重构 `el-dropdown-menu` 的内容，并添加 `handleQuickSettings` 逻辑。

**技术栈：** Vue 3, Tailwind CSS v4, Lucide Icons, Element Plus.

---

### 文件结构
- 修改：`src/layouts/MainLayout.vue`

---

### 任务 1：导入图标与定义逻辑

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：导入 Settings 图标**

在 `<script setup>` 中确保 `Settings` 已从 `lucide-vue-next` 导入。

- [ ] **步骤 2：定义 handleQuickSettings 方法**

```typescript
const handleQuickSettings = (ws: any) => {
  if (ws.type === 'admin') {
    router.push('/admin/settings');
  } else if (ws.type === 'personal') {
    router.push({ path: '/settings', query: { tab: 'profile' } });
  } else {
    router.push(`/settings/team/${ws.id}`);
  }
};
```

- [ ] **步骤 3：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "feat(ui): add handleQuickSettings logic to workspace switcher"
```

### 任务 2：重构下拉列表模板

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：重构 el-dropdown-item 循环块**

更新 `v-for="ws in workspaceStore.workspaces"` 部分的 HTML 结构。

```html
<el-dropdown-item 
  v-for="ws in workspaceStore.workspaces" 
  :key="ws.id" 
  @click="handleSwitchWorkspace(ws)" 
  class="rounded-2xl my-1 p-2 group transition-all duration-200"
  :class="workspaceStore.currentWorkspace?.id === ws.id ? 'bg-accent/5' : ''"
>
  <div class="flex items-center justify-between w-full">
    <div class="flex items-center gap-3">
      <!-- 圆形头像 -->
      <div class="relative">
        <div class="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm" :class="ws.color">
          {{ ws.name.charAt(0) }}
        </div>
        <!-- 徽标 -->
        <div v-if="ws.badgeCount" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 px-1">
          {{ ws.badgeCount > 99 ? '99+' : ws.badgeCount }}
        </div>
      </div>
      <!-- 文字信息 -->
      <div class="flex flex-col text-left">
        <span class="font-semibold text-sm" :class="workspaceStore.currentWorkspace?.id === ws.id ? 'text-accent' : 'text-slate-700 dark:text-slate-200'">
          {{ ws.name }}
        </span>
        <span class="text-[10px] text-slate-400">
          {{ ws.type === 'admin' ? '系统管理中心' : (ws.type === 'personal' ? '个人工作空间' : '团队协作空间') }}
        </span>
      </div>
    </div>
    <!-- 快捷按钮 -->
    <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button 
        @click.stop="handleQuickSettings(ws)"
        class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-accent transition-colors"
      >
        <Settings class="w-4 h-4" />
      </button>
      <div v-if="workspaceStore.currentWorkspace?.id === ws.id" class="w-1.5 h-1.5 rounded-full bg-accent"></div>
    </div>
  </div>
</el-dropdown-item>
```

- [ ] **步骤 2：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "feat(ui): optimize workspace switcher dropdown with circles, badges and quick actions"
```

# 工作空间切换器优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优化工作空间切换器的视觉效果，并增加动态徽标和悬停快捷设置功能。

**架构：** 扩展 Pinia Store 数据模型以支持徽标和描述；重构 MainLayout 中的下拉列表 UI，采用圆角圆形头像风格，并集成悬停触发的快捷操作。

**技术栈：** Vue 3, TypeScript, Pinia, Tailwind CSS v4, Lucide Icons (已集成)。

---

### 任务 1：扩展 Workspace 数据模型与 Mock 数据

**文件：**
- 修改：`src/stores/workspace.ts`

- [ ] **步骤 1：更新 Workspace 接口**

```typescript
// 修改 src/stores/workspace.ts 中的 Workspace 接口
export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team' | 'admin';
  color: string;
  description?: string; // 新增：副标题
  badgeCount?: number;  // 新增：徽标计数
}
```

- [ ] **步骤 2：在 fetchWorkspaces 中添加 Mock 数据**

```typescript
// 修改 src/stores/workspace.ts 中的 fetchWorkspaces 动作
// 在 fetchedWorkspaces 的映射逻辑中添加 mock 数据
const fetchedWorkspaces = response.data.map((t: any) => ({
  id: t.id,
  name: t.name,
  type: t.type.toLowerCase() as 'personal' | 'team',
  color: t.type === 'PERSONAL' ? 'bg-accent' : 'bg-orange-500',
  description: t.type === 'PERSONAL' ? '默认个人空间' : `${Math.floor(Math.random() * 10) + 1} 名成员`,
  badgeCount: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : 0
}));

// 修改 Admin Workspace 的添加逻辑
if (authStore.user?.role === 'ADMIN') {
  this.workspaces.unshift({
    id: 'admin-workspace',
    name: '管理中心',
    type: 'admin',
    color: 'bg-rose-600',
    description: '系统管理与审核',
    badgeCount: 3 // Mock：3 个待处理项
  });
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/stores/workspace.ts
git commit -m "feat(workspace): extend workspace model with description and badges"
```

---

### 任务 2：重构切换器下拉列表 UI

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：引入图标组件**

确保 `Settings` 图标已从 `lucide-vue-next` 导入。

- [ ] **步骤 2：重构 el-dropdown-item 内容**

修改 `MainLayout.vue` 中的下拉列表循环部分，应用新的视觉规范。

```vue
<!-- 修改 src/layouts/MainLayout.vue 中的切换列表项 -->
<el-dropdown-item v-for="ws in workspaceStore.workspaces" 
                  :key="ws.id" 
                  @click="handleSwitchWorkspace(ws)" 
                  class="rounded-2xl my-1 p-2 group transition-all duration-200"
                  :class="workspaceStore.currentWorkspace?.id === ws.id ? 'bg-slate-50' : ''">
  <div class="flex items-center justify-between w-full gap-3">
    <div class="flex items-center gap-3">
      <!-- 圆形头像 + 徽标 -->
      <div class="relative">
        <div class="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm transition-all"
             :class="ws.type === 'admin' ? 'bg-gradient-to-br from-rose-400 to-rose-600' : ws.color">
          {{ ws.name.charAt(0) }}
        </div>
        <!-- 徽标红点 -->
        <div v-if="ws.badgeCount" 
             class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] text-white font-bold px-1">
          {{ ws.badgeCount > 9 ? '9+' : ws.badgeCount }}
        </div>
      </div>
      
      <!-- 文字信息 -->
      <div class="flex flex-col">
        <span class="text-sm font-semibold" :class="workspaceStore.currentWorkspace?.id === ws.id ? 'text-accent' : 'text-slate-700'">
          {{ ws.name }}
        </span>
        <span class="text-[10px] text-slate-400 leading-tight">
          {{ ws.description }}
        </span>
      </div>
    </div>

    <!-- 快速操作按钮 -->
    <div class="flex items-center gap-2">
      <div v-if="workspaceStore.currentWorkspace?.id === ws.id" class="w-1.5 h-1.5 rounded-full bg-accent"></div>
      <button @click.stop="handleQuickSettings(ws)" 
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 opacity-0 group-hover:opacity-100 transition-all">
        <Settings class="w-4 h-4" />
      </button>
    </div>
  </div>
</el-dropdown-item>
```

- [ ] **步骤 3：实现 handleQuickSettings 方法**

```typescript
// 在 MainLayout.vue 的 script setup 中添加
const handleQuickSettings = (ws: any) => {
  if (ws.type === 'admin') {
    router.push('/admin/settings');
  } else if (ws.type === 'personal') {
    router.push('/settings/profile');
  } else {
    router.push(`/settings/workspace/${ws.id}`);
  }
};
```

- [ ] **步骤 4：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "feat(ui): optimize workspace switcher dropdown with circles, badges and quick actions"
```

---

### 任务 3：同步顶层显示状态

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：将顶层触发器的头像也改为圆形**

修改 `MainLayout.vue` 中 `el-dropdown` 的触发区域。

```vue
<!-- 修改 src/layouts/MainLayout.vue -->
<div class="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm transition-all duration-500"
     :class="workspaceStore.isAdminWorkspace ? 'bg-gradient-to-br from-rose-400 to-rose-600' : workspaceStore.currentWorkspace.color">
  {{ workspaceStore.currentWorkspace.name.charAt(0) }}
</div>
```

- [ ] **步骤 2：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "style(ui): update workspace trigger avatar to circle for consistency"
```

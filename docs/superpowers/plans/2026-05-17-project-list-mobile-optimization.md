# 项目列表页面手机适配实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优化“全部项目”和“团队项目”的项目列表视图，使其在移动端采用卡片式布局，替代现有的表格 (`<table>`) 布局，解决内容溢出和排版混乱问题。

**涉及文件：**
- `src/views/Assets/ProjectsView.vue`
- `src/views/Tasks/TeamTasksView.vue`

---

### 任务 1：优化 `ProjectsView.vue` 项目列表适配

**文件：** `src/views/Assets/ProjectsView.vue`

- [ ] **步骤 1：适配 List View (表格转卡片)**

在 `<!-- List View -->` 部分，为桌面端保留 `<table>`（加 `hidden md:table`），为移动端添加卡片列表（加 `md:hidden`）。

```html
<!-- Mobile Card List (List Mode) -->
<div class="md:hidden divide-y" style="border-color: var(--border-base)">
  <div
    v-for="project in filteredProjects"
    :key="project.id"
    class="p-5 flex flex-col gap-4"
    @click="router.push({ name: 'ProjectDetail', params: { id: project.id } })"
  >
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm" :class="project.color">
          {{ project.title.substring(0, 1) }}
        </div>
        <div>
          <p class="text-sm font-black" style="color: var(--text-primary)">{{ project.title }}</p>
          <p class="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{{ project.description || '暂无描述' }}</p>
        </div>
      </div>
      <el-dropdown trigger="click" @click.stop>
        <MoreHorizontal class="w-4 h-4 text-slate-400" />
        ... (下拉菜单同桌面端)
      </el-dropdown>
    </div>
    
    <!-- Progress Bar -->
    <div class="space-y-1.5">
      <div class="flex justify-between text-[10px] font-black">
        <span style="color: var(--text-secondary)">进度</span>
        <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'">{{ project.progress }}%</span>
      </div>
      <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div class="h-full rounded-full bg-accent" :style="{ width: project.progress + '%' }"></div>
      </div>
    </div>

    <!-- Status & Members -->
    <div class="flex items-center justify-between mt-1">
      <div class="flex items-center -space-x-1.5">
        <UserAvatar v-for="m in project.members.slice(0, 3)" :key="m.userId" :user="m.user" size="xs" class="ring-2 ring-white dark:ring-slate-900" />
      </div>
      <span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-accent/10 text-accent">
        {{ getStatusLabel(project.status) }}
      </span>
    </div>
  </div>
</div>
```

- [ ] **步骤 2：优化页面 Header 和 Stats 间距**

调整 `Top Header` 的高度和统计卡片的网格间距。

- [ ] **步骤 3：提交变更**

---

### 任务 2：优化 `TeamTasksView.vue` 项目列表适配

**文件：** `src/views/Tasks/TeamTasksView.vue`

- [ ] **步骤 1：适配项目 Tab 下的 List View**

参考任务 1，将 `v-show="activeTab === 'projects'"` 下的 `<table>` 优化为移动端友好的卡片布局。

- [ ] **步骤 2：优化看板视图 (Tasks) 在移动端的宽度**

确保看板列 (`columns`) 在小屏幕上占满宽度（目前已有 `min-w-[280px]`，需确认父容器 `overflow-x-auto` 正常工作）。

- [ ] **步骤 3：提交变更**

---

### 任务 3：验证与微调

- [ ] **步骤 1：手动检查两个页面的“列表模式”在手机尺寸下的表现**
- [ ] **步骤 2：确认下拉菜单、新建按钮等交互在小屏幕上可用**
- [ ] **步骤 3：最终清理**

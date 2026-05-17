# 成员页面手机适配实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优化“平台成员”页面 (`MembersView.vue`)，使其在手机端完美显示，解决表格溢出、头部布局混乱以及操作按钮不可见的问题。

**架构：** 
1. **响应式头部**：在移动端采用垂直布局，调整搜索框和按钮的宽度。
2. **移动端卡片布局**：在小屏幕上隐藏表格，显示卡片式的成员列表。
3. **交互优化**：确保移动端操作按钮（发送消息）始终可见或易于触发。

**技术栈：** Vue 3, Tailwind CSS (v4), Lucide Icons, Element Plus.

---

### 任务 1：重构头部布局 (Header)

**文件：**
- 修改：`src/views/Community/MembersView.vue`

- [ ] **步骤 1：调整 Header 容器高度和布局**

修改 `<!-- Header -->` 部分，取消固定高度 `h-16`，改用 `min-h-16` 并增加移动端内边距。

```html
<!-- 原代码 -->
<div class="h-16 border-b px-8 flex items-center justify-between ...">

<!-- 修改为 -->
<div class="min-h-16 py-4 lg:h-16 lg:py-0 border-b px-4 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between shrink-0 transition-colors duration-300" ...>
```

- [ ] **步骤 2：优化搜索框和邀请按钮**

在移动端，搜索框应填满剩余空间，邀请按钮可以放在搜索框旁边或下方。

```html
<!-- 修改搜索和按钮容器 -->
<div class="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
  <div class="relative flex-1 lg:flex-none">
    <Search ... />
    <input
      v-model="searchQuery"
      type="text"
      placeholder="搜索姓名或邮箱..."
      class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-full lg:w-64 transition-all"
      ...
    />
  </div>
  <button class="shrink-0 ...">
    <UserPlus class="w-4 h-4" /> <span class="hidden sm:inline">邀请伙伴</span>
  </button>
</div>
```

- [ ] **步骤 3：提交变更**

```bash
git add src/views/Community/MembersView.vue
git commit -m "style(members): make header responsive"
```

---

### 任务 2：重构过滤栏 (Filter Bar)

**文件：**
- 修改：`src/views/Community/MembersView.vue`

- [ ] **步骤 1：使过滤栏支持横向滚动**

```html
<!-- 修改 Filter Bar 容器 -->
<div class="border-b px-4 sm:px-8 py-2 shrink-0 overflow-x-auto scrollbar-hide ..." ...>
  <div class="flex items-center gap-2 min-w-max">
    ...
  </div>
</div>
```

- [ ] **步骤 2：提交变更**

```bash
git add src/views/Community/MembersView.vue
git commit -m "style(members): make filter bar scrollable on mobile"
```

---

### 任务 3：实现移动端卡片列表布局

**文件：**
- 修改：`src/views/Community/MembersView.vue`

- [ ] **步骤 1：在桌面端隐藏表格，在移动端显示卡片**

将原有的 `<table>` 包装在 `hidden md:table` 中，并添加一个 `grid md:hidden` 的卡片容器。

```html
<!-- Members List Area -->
<div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
  <div class="max-w-6xl mx-auto rounded-3xl border shadow-sm overflow-hidden transition-colors duration-300" ...>
    
    <!-- Desktop Table -->
    <table class="hidden md:table w-full text-left border-collapse">
      ... (现有表格代码) ...
    </table>

    <!-- Mobile Card List -->
    <div class="md:hidden divide-y" style="border-color: var(--border-base)">
      <div
        v-for="member in filteredMembers"
        :key="member.id"
        class="p-4 flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UserAvatar :user="member" size="md" @click="openUserProfile(member.id)" />
            <div>
              <p class="text-sm font-bold" style="color: var(--text-primary)">
                {{ member.name || '未设置昵称' }}
              </p>
              <p class="text-xs" style="color: var(--text-muted)">{{ member.email }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="p-2 bg-accent/10 text-accent rounded-lg"
              @click="handleChatWithMember(member)"
            >
              <MessageSquare class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-[10px] font-bold">
          <div class="flex items-center gap-1.5">
            <ShieldCheck v-if="member.role === 'ADMIN'" class="w-3 h-3 text-accent" />
            <span style="color: var(--text-secondary)">{{ roleLabels[member.role] || member.role }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Circle
              class="w-1.5 h-1.5 fill-current"
              :class="authStore.isUserOnline(member.id) ? 'text-emerald-500' : 'text-slate-300'"
            />
            <span style="color: var(--text-secondary)">{{ authStore.isUserOnline(member.id) ? '在线' : '离线' }}</span>
          </div>
          <div style="color: var(--text-muted)">
            加入于 {{ new Date(member.createdAt).toLocaleDateString() }}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **步骤 2：提交变更**

```bash
git add src/views/Community/MembersView.vue
git commit -m "feat(members): add mobile card layout"
```

---

### 任务 4：验证与清理

- [ ] **步骤 1：手动验证**

1. 缩小浏览器窗口至手机尺寸。
2. 确认 Header 布局正确。
3. 确认过滤栏可以横向滑动。
4. 确认成员列表显示为卡片，且“发送消息”按钮可见并可用。
5. 点击头像确认用户信息弹窗正常打开。

- [ ] **步骤 2：最终提交**

```bash
git commit -m "chore(members): final mobile optimization adjustments"
```

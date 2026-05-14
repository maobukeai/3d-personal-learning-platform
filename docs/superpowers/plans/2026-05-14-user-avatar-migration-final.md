# 用户头像组件迁移（最后阶段）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将项目中最后几个页面的用户头像渲染逻辑迁移到统一的 `<UserAvatar />` 组件，确保视觉一致性和会员/角色状态的正确展示。

**架构：**
- 在各目标组件中引入 `UserAvatar.vue`。
- 替换现有的 `<img>` 标签或 Lucide `User` 图标。
- 传递尽可能完整的用户对象（包含 `role` 和 `subscription`）以启用组件的高级特性。

**技术栈：** Vue 3, TypeScript, Lucide Vue Next, UserAvatar Component.

---

### 待修改文件列表：
1. `src/views/Admin/AdminDashboardView.vue`
2. `src/views/Admin/AdminAuditsView.vue`
3. `src/views/Admin/AdminAuditLogsView.vue`
4. `src/views/Learning/CourseDetailView.vue`
5. `src/views/Assets/MaterialsView.vue`

---

### 任务 1：迁移 AdminDashboardView 中的用户头像

**文件：**
- 修改：`src/views/Admin/AdminDashboardView.vue`

- [ ] **步骤 1：引入 UserAvatar 组件**

```typescript
// 在 script setup 中添加导入
import UserAvatar from '@/components/UserAvatar.vue'
```

- [ ] **步骤 2：替换最新注册用户列表中的头像**

```vue
<!-- 约 317 行附近 -->
<div class="flex items-center gap-4">
  <UserAvatar :user="user" size="md" />
  <div>
    <p class="text-sm font-bold" style="color: var(--text-primary)">{{ user.name || '匿名用户' }}</p>
    <p class="text-[10px]" style="color: var(--text-muted)">{{ user.email }}</p>
  </div>
</div>
```

---

### 任务 2：迁移 AdminAuditsView 中的用户头像

**文件：**
- 修改：`src/views/Admin/AdminAuditsView.vue`

- [ ] **步骤 1：引入 UserAvatar 组件**

```typescript
// 在 script setup 中添加导入
import UserAvatar from '@/components/UserAvatar.vue'
```

- [ ] **步骤 2：替换审核卡片中的作者头像**

```vue
<!-- 约 383 行附近 -->
<div class="flex items-center justify-between bg-slate-50 dark:bg-white/5 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
  <div class="flex items-center gap-2 min-w-0">
    <UserAvatar :user="item.user" size="sm" />
    <span class="text-[11px] font-bold truncate" style="color: var(--text-primary)">
      {{ item.user?.name || item.user?.email?.split('@')[0] || '匿名创作者' }}
    </span>
  </div>
</div>
```

---

### 任务 3：迁移 AdminAuditLogsView 中的用户头像

**文件：**
- 修改：`src/views/Admin/AdminAuditLogsView.vue`

- [ ] **步骤 1：引入 UserAvatar 组件**

```typescript
// 在 script setup 中添加导入
import UserAvatar from '@/components/UserAvatar.vue'
```

- [ ] **步骤 2：替换表格中的操作者头像**

```vue
<!-- 约 160 行附近 -->
<td class="px-8 py-5">
  <div class="flex items-center gap-3">
    <UserAvatar :user="log.user" size="md" />
    <div class="flex flex-col min-w-0">
      <span class="text-xs font-black truncate" style="color: var(--text-primary)">{{ log.user?.name || '系统' }}</span>
      <span class="text-[10px] text-slate-400 truncate">{{ log.user?.email || 'SYSTEM' }}</span>
    </div>
  </div>
</td>
```

---

### 任务 4：迁移 CourseDetailView 中的用户头像

**文件：**
- 修改：`src/views/Learning/CourseDetailView.vue`

- [ ] **步骤 1：引入 UserAvatar 组件**

```typescript
// 在 script setup 中添加导入
import UserAvatar from '@/components/UserAvatar.vue'
```

- [ ] **步骤 2：替换讲师卡片中的头像**

```vue
<!-- 约 414 行附近 -->
<div v-if="instructorInfo" class="p-5 rounded-2xl border flex items-center gap-4" style="background-color: var(--bg-card); border-color: var(--border-base)">
  <UserAvatar :user="instructorInfo" size="lg" />
  <div class="flex-1 min-w-0">
```

- [ ] **步骤 3：替换评论列表中的用户头像**

```vue
<!-- 约 479 行附近 -->
<div v-for="review in course.reviews" :key="review.id"
     class="p-5 rounded-2xl border" style="background-color: var(--bg-card); border-color: var(--border-base)">
  <div class="flex items-center gap-3 mb-3">
    <UserAvatar :user="review.user" size="md" />
    <div class="flex-1 min-w-0">
```

---

### 任务 5：迁移 MaterialsView 中的用户头像

**文件：**
- 修改：`src/views/Assets/MaterialsView.vue`

- [ ] **步骤 1：引入 UserAvatar 组件**

```typescript
// 在 script setup 中添加导入
import UserAvatar from '@/components/UserAvatar.vue'
```

- [ ] **步骤 2：替换详情弹窗中的上传者头像**

```vue
<!-- 约 473 行附近 -->
<!-- Uploader Info -->
<div v-if="selectedMaterial.user" class="flex items-center gap-3 p-3 rounded-xl" style="background-color: var(--bg-app)">
  <UserAvatar :user="selectedMaterial.user" size="md" />
  <div>
    <p class="text-xs font-bold" style="color: var(--text-primary)">{{ selectedMaterial.user.name || '匿名用户' }}</p>
    <p class="text-[10px]" style="color: var(--text-muted)">上传于 {{ new Date(selectedMaterial.createdAt).toLocaleDateString() }}</p>
  </div>
</div>
```

---

### 任务 6：验证与确认

- [ ] **步骤 1：全站搜索 `avatarUrl` 以确认没有遗漏的 `<img>` 或 `User` 图标。**
- [ ] **步骤 2：确认所有修改页面编译无误。**

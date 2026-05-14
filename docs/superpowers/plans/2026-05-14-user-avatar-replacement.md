# UserAvatar 组件替换实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在项目中剩余的页面中，将手动渲染的用户头像替换为统一的 `UserAvatar` 组件，提升 UI 一致性和视觉质量。

**架构：** 遍历已识别的文件，在 `<script setup>` 中导入 `UserAvatar` 组件，并将 `<img>` 标签或占位图标替换为 `<UserAvatar :user="userObject" :size="size" />`。

**技术栈：** Vue 3, Tailwind CSS, UserAvatar component.

---

### 任务 1：更新 ShowcaseView.vue 中的评论区头像

**文件：**
- 修改：`src/views/Community/ShowcaseView.vue`

- [ ] **步骤 1：检查并替换作者/评论者头像**
  - 在 L567 和 L592 附近替换手动 `<img>` 渲染。
  - 确保传入正确的用户对象。

### 任务 2：更新 TeamDetailView.vue 中的成员与申请者头像

**文件：**
- 修改：`src/views/Community/TeamDetailView.vue`

- [ ] **步骤 1：替换申请者列表头像** (L635 附近)
- [ ] **步骤 2：替换团队成员列表头像** (L750 附近)
  - 团队头像 (L426) 保持不变，因为它是 Team 对象的头像，非 User 对象。

### 任务 3：更新 ProjectsView.vue 中的成员头像

**文件：**
- 修改：`src/views/Assets/ProjectsView.vue`

- [ ] **步骤 1：导入 UserAvatar 组件**
- [ ] **步骤 2：替换项目卡片和对话框中的成员头像**
  - L371, L438, L563, L575 附近。

### 任务 4：更新 ProjectDetailView.vue 中的各类头像

**文件：**
- 修改：`src/views/Assets/ProjectDetailView.vue`

- [ ] **步骤 1：导入 UserAvatar 组件**
- [ ] **步骤 2：替换项目详情、任务列表、消息流中的头像**
  - L508, L655, L664, L696, L854, L866, L938, L950, L1000 附近。

### 任务 5：更新 Admin/UsersView.vue 中的用户管理头像

**文件：**
- 修改：`src/views/Admin/UsersView.vue`

- [ ] **步骤 1：导入 UserAvatar 组件**
- [ ] **步骤 2：替换用户详情侧边栏中的头像**
  - L402-404 附近。
- [ ] **步骤 3：移除不再需要的 `handleAvatarError` 函数** (L75)。

### 任务 6：更新 Admin/AdminTeamsView.vue 中的成员头像

**文件：**
- 修改：`src/views/Admin/AdminTeamsView.vue`

- [ ] **步骤 1：导入 UserAvatar 组件**
- [ ] **步骤 2：替换团队成员列表中的头像**
  - L316 附近。
  - 团队头像 (L267) 保持不变。

### 任务 7：更新 Admin/FeedbackView.vue 中的反馈人头像

**文件：**
- 修改：`src/views/Admin/FeedbackView.vue`

- [ ] **步骤 1：导入 UserAvatar 组件**
- [ ] **步骤 2：替换反馈列表中的用户头像**
  - L231-232 附近。

### 任务 8：更新 DashboardView.vue 中的动态与团队头像

**文件：**
- 修改：`src/views/Dashboard/DashboardView.vue`

- [ ] **步骤 1：导入 UserAvatar 组件**
- [ ] **步骤 2：替换活动动态中的头像** (L306)
- [ ] **步骤 3：替换协作邀请中的占位头像** (L336)

### 任务 9：全局搜索并清理遗漏

- [ ] **步骤 1：搜索其他可能遗漏的文件**
  - 搜索 `TeamTasksView.vue`, `MaterialsView.vue`, `AdminAuditLogsView.vue`, `CourseDetailView.vue` 等。

---

## 自检

1. **规格覆盖度：** 计划覆盖了所有提到的文件。
2. **占位符扫描：** 无占位符。
3. **类型一致性：** 传入 `UserAvatar` 的 `:user` 对象应包含 `name`, `avatarUrl`, `role`, `subscription`（如果可用）。

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-05-14-user-avatar-replacement.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**

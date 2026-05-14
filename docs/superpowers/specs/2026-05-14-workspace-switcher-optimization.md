# 规格说明：工作空间切换器视觉与功能优化

## 1. 目标
提升工作空间切换器的视觉精致感和操作效率。采用圆润的现代设计语言，增强信息表达能力（动态提醒），并减少常用操作的点击层级（悬停快捷按钮）。

## 2. 交互与设计细节

### 2.1 视觉风格 (Minimalist Glass)
- **条目布局**：采用圆角卡片式设计 (`rounded-2xl`)，增加条目间的呼吸感。
- **头像系统**：
  - 由原先的圆角矩形改为**圆形头像** (`rounded-full`)。
  - **管理中心**：保留玫瑰红渐变 (`bg-gradient-to-br from-rose-400 to-rose-600`)。
  - **个人空间/团队**：根据 `workspace.color` 动态生成背景，文字颜色与之匹配。
- **背景特效**：当前选中的工作空间条目使用浅色背景（如 `bg-slate-100` 或 `bg-accent/5`），非选中条目在悬停时呈现轻微变色。

### 2.2 动态提醒 (Dynamic Status)
- **状态徽标 (Badge)**：
  - 在头像右上角显示 8px 的实心红点（代表有新动态）。
  - 如果徽标代表具体数值（如管理中心的待审核数），则显示带数值的微型徽标。
- **副标题描述**：
  - 在工作空间名称下方增加一行 10px 的辅助文字。
  - **管理中心**：显示“系统管理权限”或“N 个待处理项”。
  - **团队空间**：显示“N 名成员”或“活跃中”。
  - **个人空间**：显示“默认私有空间”。

### 2.3 悬停快速操作 (Hover Quick Actions)
- **触发机制**：鼠标悬停在单个工作空间条目上时，条目右侧动态淡入操作按钮。
- **可用操作**：
  - **设置图标 (`Settings`)**：直接跳转至对应空间的设置页面。
  - **管理中心**：跳转至 `/admin/settings`。
  - **团队/个人**：跳转至 `/settings/workspace/:id`。
- **逻辑隔离**：点击快捷操作图标时，调用 `event.stopPropagation()`，避免触发切换工作空间的逻辑。

## 3. 技术实现方案

### 3.1 数据结构扩展 (`src/stores/workspace.ts`)
```typescript
export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team' | 'admin';
  color: string;
  // 新增字段
  description?: string;
  badgeCount?: number;
  memberCount?: number;
}
```

### 3.2 UI 结构 (`src/layouts/MainLayout.vue`)
- 在 `el-dropdown-menu` 中重构 `el-dropdown-item` 的内容。
- 使用 `group` 类（Tailwind CSS）控制快捷操作按钮的显隐：`opacity-0 group-hover:opacity-100 transition-opacity`。

### 3.3 状态同步
- 在 `fetchWorkspaces` 动作中，初步 mock 这些新增字段，后续可对接实际的后端通知接口。

## 4. 成功标准
- [ ] 切换器下拉列表呈现出圆润、现代的视觉效果。
- [ ] 徽标红点能正确显示在头像右上角。
- [ ] 悬停时能看到设置图标，且点击后能正确跳转而不切换当前空间。
- [ ] 副标题文字清晰可读，不影响主标题的辨识度。

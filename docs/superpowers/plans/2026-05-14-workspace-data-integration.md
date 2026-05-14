# 工作空间逻辑修复与真实数据集成计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 
1. 修复点击工作空间后的跳转逻辑，统一跳转至 Dashboard（首页）。
2. 将工作空间的“徽标数字”从随机 Mock 改为真实业务数据。
3. 优化描述文案，使其反映真实状态。

**架构：**
- 修改 `MainLayout.vue` 中的 `handleSwitchWorkspace` 导航逻辑。
- 修改 `workspaceStore.ts` 中的 `fetchWorkspaces` 逻辑，对接 `authStore` 的实时数据。

---

### 任务 1：修复工作空间跳转逻辑

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：修改 handleSwitchWorkspace**

将点击团队空间后的跳转目标从 `/team/${ws.id}` 统一改为 `/dashboard`。

```typescript
// 修改 src/layouts/MainLayout.vue 中的 handleSwitchWorkspace
const handleSwitchWorkspace = (ws: any) => {
  workspaceStore.setWorkspace(ws)
  // 无论是什么类型（除了管理中心），统一跳转到 dashboard
  if (ws.type === 'admin') {
    router.push('/admin/dashboard')
  } else {
    router.push('/dashboard')
  }
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "fix(ui): ensure workspace switching always navigates to dashboard"
```

---

### 任务 2：集成真实业务数据（消息/成员）

**文件：**
- 修改：`src/stores/workspace.ts`

- [ ] **步骤 1：链接个人空间徽标至真实未读消息数**

在 `workspaceStore` 中引用 `authStore`，并将个人空间的 `badgeCount` 绑定到 `unreadMessagesCount`。

```typescript
// 修改 src/stores/workspace.ts
import { useAuthStore } from './auth';

// 在 fetchWorkspaces 动作中
const authStore = useAuthStore();
const fetchedWorkspaces = response.data.map((t: any) => ({
  id: t.id,
  name: t.name,
  type: t.type.toLowerCase() as 'personal' | 'team',
  color: t.type === 'PERSONAL' ? 'bg-accent' : 'bg-orange-500',
  // 描述使用真实的成员数 (t._count.members)
  description: t.type === 'PERSONAL' ? '默认个人空间' : `${t._count?.members || 1} 名成员`,
  // 个人空间展示真实未读消息数，团队空间暂时不设徽标（或根据业务逻辑设置）
  badgeCount: t.type === 'PERSONAL' ? authStore.unreadMessagesCount : 0
}));
```

- [ ] **步骤 2：清理随机 Mock 逻辑**

确保删除所有 `Math.random()` 相关的代码，使数据可预期。

- [ ] **步骤 3：Commit**

```bash
git add src/stores/workspace.ts
git commit -m "feat(workspace): link personal workspace badge to real unread messages"
```

---

### 验证与测试

1. **跳转验证**：切换到任意团队空间，确认页面跳转至 `/dashboard`。
2. **数据验证**：
   - 发送一条私聊消息给当前用户，确认“个人空间”右上角的红字/红点出现。
   - 检查团队空间的描述是否正确显示为后端返回的成员总数。

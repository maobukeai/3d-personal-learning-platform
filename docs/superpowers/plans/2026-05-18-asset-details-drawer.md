# 侧边详情面板实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 `AssetDetailsDrawer.vue` 组件，用于展示资产的详细信息、3D 预览和下载附件。

**架构：** 使用 Element Plus 的 `el-drawer` 作为容器，嵌入 `ModelViewer` 进行 3D 预览，使用 `lucide-vue-next` 展示格式图标。

**技术栈：** Vue 3, Element Plus, Lucide Icons, Pinia (workspaceStore).

---

### 任务 1：创建 AssetDetailsDrawer.vue 组件

**文件：**
- 创建：`src/components/AssetDetailsDrawer.vue`

- [ ] **步骤 1：实现基础结构与预览区**
  - 引入 `el-drawer`。
  - 在抽屉顶部嵌入 `ModelViewer`。
  - 绑定 `workspaceStore.isDetailDrawerOpen` 和 `workspaceStore.selectedAsset`。

- [ ] **步骤 2：实现资产信息展示**
  - 展示标题、描述、上传者、大小、分类、创建时间。
  - 处理 `selectedAsset` 为空时的边界情况。

- [ ] **步骤 3：实现格式图标渲染逻辑**
  - 解析 `asset.formats` (JSON.parse)。
  - 定义格式与 Lucide 图标的映射（例如：`FileBox`, `FileCode`, `Package` 等）。
  - 循环渲染图标。

- [ ] **步骤 4：实现交互逻辑**
  - 实现下载按钮：`window.open(selectedAsset.url)`。
  - 实现关闭逻辑：调用 `workspaceStore.closeDetails()`。

- [ ] **步骤 5：Commit**
  ```bash
  git add src/components/AssetDetailsDrawer.vue
  git commit -m "feat(ui): implement AssetDetailsDrawer component"
  ```

### 任务 2：集成到布局中

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：引入并注册组件**
  - 在 `MainLayout.vue` 中引入 `AssetDetailsDrawer`。
  - 将其放置在模板中的合适位置（通常是顶层容器内）。

- [ ] **步骤 2：验证集成**
  - 确保抽屉可以由 `workspaceStore` 正确触发开启和关闭。

- [ ] **步骤 3：Commit**
  ```bash
  git add src/layouts/MainLayout.vue
  git commit -m "feat(ui): integrate AssetDetailsDrawer into MainLayout"
  ```

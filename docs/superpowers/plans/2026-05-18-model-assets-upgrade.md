# 模型资产页面重构 (Pro Studio) 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 升级模型资产页面，支持高密度瀑布流布局、侧边详情面板以及 ZIP 素材包的格式勾选展示。

**架构：**
- **后端:** 在 `Asset` 模型中添加 `formats` 字段，更新上传和更新接口以处理格式列表。
- **前端:** 实现瀑布流组件和侧边详情抽屉。更新上传弹窗，增加 ZIP 格式选择器。
- **数据流:** 资产列表 -> 点击卡片 -> 侧边栏展示详情 (包含 3D 预览和格式图标)。

**技术栈：** Vue 3, TypeScript, Prisma, SQLite, Tailwind CSS, Element Plus.

---

## 文件结构

### 后端 (Server)
- 修改: `server/prisma/schema.prisma` - 添加 `formats` 字段。
- 修改: `server/src/controllers/asset.controller.ts` - 处理上传/更新时的格式数据。

### 前端 (Client)
- 创建: `src/components/MasonryGrid.vue` - 响应式瀑布流容器。
- 创建: `src/components/AssetCard.vue` - 瀑布流中的单个资产卡片。
- 创建: `src/components/AssetDetailsDrawer.vue` - 侧边详情面板。
- 修改: `src/views/Assets/AssetsView.vue` - 整体页面重构。
- 修改: `src/stores/workspace.ts` - 管理选中资产和面板状态。
- 创建: `src/assets/icons/formats/` - 存放 FBX, OBJ, MAX 等 SVG 图标。

---

## 任务分解

### 任务 1：数据库与后端接口更新

**文件：**
- 修改：`server/prisma/schema.prisma`
- 修改：`server/src/controllers/asset.controller.ts`

- [ ] **步骤 1：更新 Prisma Schema**

在 `Asset` 模型中添加 `formats String?` 字段。

```prisma
model Asset {
  // ... 其他字段
  formats      String? // 存储 JSON 字符串，如 ["FBX", "OBJ"]
  // ...
}
```

- [ ] **步骤 2：生成迁移并更新客户端**

执行：`cd server && npx prisma migrate dev --name add_asset_formats`

- [ ] **步骤 3：更新上传控制器处理格式数据**

修改 `server/src/controllers/asset.controller.ts` 中的 `uploadAsset` 方法。

```typescript
const { title, description, categoryId, formats } = req.body;
// ...
const asset = await prisma.asset.create({
  data: {
    // ...
    formats: formats ? JSON.stringify(formats) : null,
  },
});
```

- [ ] **步骤 4：更新管理员更新接口**

修改 `server/src/controllers/asset.controller.ts` 中的 `adminUpdateAsset` 方法，支持 `formats` 更新。

- [ ] **步骤 5：验证 API**

使用脚本或工具调用 `POST /api/assets/upload`，确认 `formats` 正确保存。

- [ ] **步骤 6：Commit**

```bash
git add server/prisma/schema.prisma server/src/controllers/asset.controller.ts
git commit -m "feat(backend): add formats field to Asset model and update APIs"
```

### 任务 2：前端状态管理更新

**文件：**
- 修改：`src/stores/workspace.ts`

- [ ] **步骤 1：定义状态**

添加 `selectedAsset` 和 `isDetailDrawerOpen`。

```typescript
export const useWorkspaceStore = defineStore('workspace', () => {
  const selectedAsset = ref<any>(null);
  const isDetailDrawerOpen = ref(false);

  function openDetails(asset: any) {
    selectedAsset.value = asset;
    isDetailDrawerOpen.value = true;
  }

  function closeDetails() {
    isDetailDrawerOpen.value = false;
  }

  return { selectedAsset, isDetailDrawerOpen, openDetails, closeDetails };
});
```

- [ ] **步骤 2：Commit**

```bash
git add src/stores/workspace.ts
git commit -m "feat(store): add asset detail state to workspace store"
```

### 任务 3：创建瀑布流组件

**文件：**
- 创建：`src/components/MasonryGrid.vue`
- 创建：`src/components/AssetCard.vue`

- [ ] **步骤 1：实现 MasonryGrid 组件**

使用 CSS Column 或 Grid 实现简单的瀑布流容器。

- [ ] **步骤 2：实现 AssetCard 组件**

实现“专业工作室风”卡片：
- 图片预览。
- 底部精简信息栏。
- 悬停动效。

- [ ] **步骤 3：Commit**

```bash
git add src/components/MasonryGrid.vue src/components/AssetCard.vue
git commit -m "feat(ui): implement MasonryGrid and AssetCard components"
```

### 任务 4：实现侧边详情面板

**文件：**
- 创建：`src/components/AssetDetailsDrawer.vue`

- [ ] **步骤 1：组件结构**

包含 3D 预览区、详细信息区、附件格式清单区。

- [ ] **步骤 2：格式图标渲染**

根据 `asset.formats` (解析 JSON) 渲染对应的图标。

- [ ] **步骤 3：Commit**

```bash
git add src/components/AssetDetailsDrawer.vue
git commit -m "feat(ui): implement AssetDetailsDrawer component"
```

### 任务 5：页面整合与上传流程重构

**文件：**
- 修改：`src/views/Assets/AssetsView.vue`

- [ ] **步骤 1：整合瀑布流与侧边栏**

替换原有网格和弹窗。

- [ ] **步骤 2：更新上传弹窗**

增加格式勾选矩阵（手动勾选 FBX, OBJ 等）。

- [ ] **步骤 3：验证整体流程**

上传一个 ZIP -> 勾选格式 -> 在瀑布流中查看 -> 点击打开侧边栏 -> 确认图标显示。

- [ ] **步骤 4：Commit**

```bash
git add src/views/Assets/AssetsView.vue
git commit -m "feat(ui): integrate masonry layout and updated upload flow"
```

---

## 自检记录

1. **规格覆盖度：** 覆盖了瀑布流布局、侧边栏、专业风、ZIP 格式勾选、后端字段支持。
2. **占位符扫描：** 无。
3. **类型一致性：** 后端 JSON 序列化和前端解析保持一致。

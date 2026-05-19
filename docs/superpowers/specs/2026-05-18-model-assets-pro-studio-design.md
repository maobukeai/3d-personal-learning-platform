# 模型资产页面重构设计规格 (Pro Studio Version)

## 1. 目标 (Goals)
重构模型资产页面，提升信息展示密度，优化大批量资源的浏览体验，并支持 ZIP 素材包及其附件清单的展示。

## 2. 核心架构 (Core Architecture)

### 2.1 布局 (Layout)
*   **瀑布流列表 (Masonry Grid):** 主区域采用响应式瀑布流布局。卡片高度根据预览图比例自动调整，消除传统网格的视觉单调。
*   **侧边详情面板 (Side Panel Drawer):** 点击资产卡片后，从右侧滑动进入。
    *   **顶部:** 3D 预览区（支持 GLB/GLTF 在线查看）。
    *   **中部:** 基本信息（名称、描述、分类、标签、文件大小）。
    *   **底部:** **附件格式清单**。展示预设的格式图标，并提供 ZIP 下载按钮。

### 2.2 视觉风格 (Visual Style)
*   **专业工作室风 (Pro Studio):**
    *   采用深色/中性色调，强调内容本身。
    *   卡片带有 1px 细边框 (`var(--border-base)`)。
    *   底部悬浮半透明信息栏，展示核心指标。
    *   悬停时卡片微升，展示操作快捷键。

## 3. 功能特性 (Features)

### 3.1 资产展示
*   **高密度预览:** 卡片间距缩小，去掉冗余占位。
*   **附件清单:** 针对 ZIP 类型的资产，在详情页展示其包含的格式图标（FBX, MAX, OBJ 等）。

### 3.2 发布/上传流程
*   **ZIP 模式支持:** 上传文件时增加对 `.zip` 格式的识别。
*   **格式手动勾选 (Format Selector):** 上传界面提供图标矩阵。
    *   **预设选项:** `FBX`, `OBJ`, `MAX`, `C4D`, `MAYA`, `BLEND`, `ZTL`, `SPP`, `Textures`.
    *   **交互:** 用户通过点击图标来声明 ZIP 包内含有的格式。

## 4. 技术实现 (Technical Implementation)

### 4.1 前端 (Frontend)
*   **组件:** `MasonryLayout.vue` (新组件), `AssetSidePanel.vue` (新组件)。
*   **状态管理:** 在 `stores/workspace.ts` 中管理当前选中的资产和侧边栏开关状态。
*   **图标库:** 使用一套统一的 SVG 格式图标，支持明暗模式。

### 4.2 后端 (Backend)
*   **数据库字段:**
    *   `Asset` 表增加 `formats` 字段 (String/JSON)，存储勾选的格式列表。
*   **API 调整:**
    *   `POST /api/assets/upload` 支持接收并保存 `formats` 数据。
    *   `GET /api/assets/public` 返回数据包含 `formats`。

## 5. 成功标准 (Success Criteria)
*   页面在一屏内能展示比旧版多至少 50% 的资源。
*   点击资源到看到详情的响应无明显延迟。
*   上传 ZIP 并勾选格式后，详情页能正确渲染对应图标。

# 全栈回归恢复与终局执行书（仅未完成项）

> 更新日期：2026-07-11
> 本文覆盖旧版方案，只保留仍存在、未验证或在本轮重构中引入的风险。已完成事项不在本文记录。

## 1. P0 事故：弹窗、玻璃与视觉系统回归

### 1.0 最终审美决策：玻璃是品牌签名，不是应被移除的效果

本平台保留玻璃质感，且将其作为 3D 创作工作台的核心视觉识别：**所有 Modal、Drawer、Dropdown、Select/Popover 菜单和全局搜索面板均采用同一套“高可读物理磨砂玻璃”**。问题从来不是使用玻璃，而是当前玻璃没有统一材质契约：有的只是低 alpha 透明背景、有的只 blur、有的被旧 CSS 改成实色、有的颜色/边框/圆角各不相同。

项目采用的是 **Shadcn Vue 的本地化架构方式**：Radix Vue 负责无障碍行为，CVA/Tailwind v4 负责 variant，`src/components/ui/` 作为可拥有、可修改的组件源码。虽然依赖表未安装名为 `shadcn-vue` 的整包，但这正是 Shadcn 的核心使用方式。继续完善现有 `Modal`、`Drawer`、`Dropdown`、`Select`、`GlassPopover` 与 `CommandPalette`，不再混入第二套成品 UI 库，才能保证主题、交互和体积一致。

统一玻璃材质配方（只由 Token 定义，业务不可覆盖）：

| Token                | 深色                                                           | 浅色                                                | 用途                                        |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| `--glass-modal-bg`   | `rgb(24 30 40 / 0.92)`                                         | `rgb(255 255 255 / 0.84)`                           | Modal / Drawer 主表面，确保正文不“穿透”背景 |
| `--glass-popover-bg` | `rgb(27 34 45 / 0.94)`                                         | `rgb(255 255 255 / 0.90)`                           | Dropdown / Select / Tooltip，优先可读性     |
| `--glass-border`     | 顶部 `rgb(255 255 255 / 0.16)`、其余 `rgb(255 255 255 / 0.08)` | `rgb(255 255 255 / 0.72)` 与 `rgb(15 23 42 / 0.10)` | 双层边缘，形成玻璃厚度                      |
| `--glass-shadow`     | `0 24px 64px rgb(0 0 0 / .42)`                                 | `0 24px 64px rgb(15 23 42 / .16)`                   | 单一浮层投影                                |
| `--glass-blur`       | `blur(18px) saturate(135%)`                                    | `blur(16px) saturate(125%)`                         | 仅 surface 使用；移动端降为不透明近似色     |

每个玻璃浮层均需具备：半透明底色、统一 blur、双层边缘、单层阴影、细微噪点可选层和不透明内容分区。输入框、表格、长正文和卡片不做透明玻璃；它们应嵌在玻璃浮层中的实色/近实色 content surface 上，确保长时间阅读。

### 1.1 已确认的根因

| 编号 | 事实                                                                                                                                          | 用户影响                                                                                     | 必须修复                                                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-01 | `Modal` 的 standard surface 使用 `--surface-overlay`，而该 token 映射到泛用、低 alpha 的 `--bg-elevated`，不是专用玻璃材质                    | 弹窗有时像透明层，有时又像普通卡片；背景内容会干扰表单和正文                                 | 新建专用 `--glass-modal-*` / `--glass-popover-*` token，按上表提供高不透明度底色 + blur + 双层边缘；禁止 Modal 从通用 card token 取色                                                           |
| V-02 | 全仓仍有 **111 处** `glassCard/glass-card` 旧调用；兼容层把它们隐式映射到 immersive，无法表达“这是 Modal 玻璃、Dropdown 玻璃还是 3D 沉浸玻璃” | 玻璃本身被保留，但不同业务调用的透明度、尺寸、移动降级和内容分区不可控                       | 迁移为显式 `variant="glass"`（默认业务 Dialog）、`variant="immersive"`（仅 3D/命令面板）和 `variant="solid"`（全屏编辑/高密度表格）；完成后删除 `glassCard` 兼容 prop，但不删除 Glass Primitive |
| V-03 | `Card` 的 glass 分支仍使用 `rounded-2xl`，且保留发光、缩放、上移等旧反馈组合                                                                  | 圆角和 hover 风格与新 0/6/8/12 规范冲突，视觉显得消费级且不稳定                              | 删除 glass 卡片在普通业务页面的使用；Card 仅保留 8px 内容卡/12px 浮层，hover 只允许背景、边框或 2px 位移中的一种                                                                                |
| V-04 | Modal overlay 与 content 都使用 `--z-modal`；依赖 Portal DOM 顺序决定谁在上层，业务还存在自定义 `z-index=1100`                                | 嵌套 Dialog、Drawer、Toast、搜索面板组合时可能被遮罩盖住或不可点，符合“弹窗显示不出来”的症状 | 定义统一 overlay stack：backdrop=`z-modal-base`、content=`z-modal-base+1`、nested=`+10`、toast=`+100`；禁止业务直接传数字 z-index                                                               |
| V-05 | `Modal` 内使用 `<style scoped>` 的 `.dark .modal-overlay`；主题根节点和 scope 属性组合依赖编译结果，容易失配                                  | 深色遮罩颜色可能不按设计 token 生效，主题下的弹窗表现不一致                                  | 将主题值全部写入 CSS variables；Primitive 不以 scoped 的祖先 `.dark` 选择器切主题                                                                                                               |
| V-06 | FormDialog 仍将任意 `width` 映射到旧尺寸（含已废弃 `xxl`），业务可继续绕过尺寸规则                                                            | 不同表单的宽度、圆角、滚动方式难以统一，移动端继续出现压缩弹窗                               | FormDialog 只暴露 `sm/md/lg/xl/fullscreen` 与 `presentation`；复杂流程改 Drawer/路由；移除 `width` 透传语义                                                                                     |

### 1.2 不允许再发生的 Modal 架构

`Modal` 必须是唯一 Dialog Primitive；`FormDialog` 只能是其薄表单适配器。禁止业务页面自行 Teleport、手写遮罩、手写 `position: fixed` 弹层、传裸 z-index、使用遗留 `glassCard` 或复制 Modal CSS。

```text
OverlayStack
├─ tooltip / dropdown
├─ popover
├─ modal backdrop (z = base)
├─ modal content  (z = base + 1)
├─ nested modal   (z = base + 10)
└─ toast / critical notice

ModalSurface
├─ glass: Modal / Drawer 默认高可读磨砂玻璃
├─ popover: Dropdown / Select / Tooltip 专用高不透明玻璃
├─ immersive: only 3D preview / command palette, approved per call site
├─ solid: fullscreen editor / dense data table, no transparency
└─ mobile sheet: glass near-opaque / top corners 12px only
```

Modal 行为必须遵循 [W3C Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)：打开后焦点进入内容、Tab/Shift+Tab 不越界、Escape 行为明确、背景 inert、关闭后回到触发器。不可逆操作聚焦“取消/返回”等最不具破坏性的动作；长内容焦点进入标题或摘要，不自动滚到第一个输入框。

### 1.3 业务弹窗迁移清单

1. 列出全部 111 个旧 glass 调用，按“短确认 / 短表单 / 长表单 / 详情 / 预览 / 全屏编辑 / 3D”分类，建立迁移表并指定 `glass / popover / immersive / solid` 的唯一目标变体。
2. 优先迁移高频/高风险：登录弹窗、发布、上传、资源详情、笔记编辑、团队/成员、2FA、订阅与管理动作。
3. 详情和预览默认改独立路由；全屏编辑改 solid fullscreen；长表单改 glass Drawer；短确认保留 glass `Modal size=sm`；所有下拉和选择菜单统一 popover glass。
4. 每迁移一个业务 Dialog，删除其 scoped glass 样式、旧 `width`/`zIndex`/`glassCard` 属性和重复 focus/scroll-lock 代码。
5. 删除所有调用后，移除兼容类型与组件；CI 以 AST 扫描 `glassCard`、`glass-card`、`z-index` 数字、业务 Teleport，命中即失败。

### 1.4 可签收的视觉规范

- 品牌为“工业精密工作台”：创作橙 `#F07828` 是唯一主强调色；蓝色只用于链接/信息提示。登录页及主 CTA 不得保留通用 SaaS 蓝。
- 深色 Canvas `#0E1218`，实色内容 surface `#151B23`，玻璃 overlay 使用 `--glass-modal-bg`，border `#2B3644`；浅色 Canvas `#F5F7FA`，实色内容 surface `#FFFFFF`，玻璃 overlay 使用 `--glass-modal-bg`。
- 圆角只允许 0 / 6 / 8 / 12：控件 6、输入和按钮 8、卡片 8、详情分区和 Modal 12、全屏 0。
- 内容卡、表格、表单、资源库、详情正文全部实色；玻璃覆盖所有 Modal、Drawer、Dropdown、Select/Popover、全局搜索、顶级导航和 WebGL Canvas 浮层。
- hover 只改变一个通道（背景、边框或 2px 位移）；禁用发光+重阴影+缩放+透明的组合效果。
- 任何页面必须有一个 h1，正文 14px / 1.55，辅助文字最小 12px；正文和 UI 对比达到 WCAG 2.2 AA，焦点至少 2px 且对比 ≥3:1。[W3C Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance)

## 2. P0：视觉验收、浏览器兼容与回归门禁不足

| 问题             | 现状                                                                                                      | 修复和验收                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 测试覆盖失真     | 标准 Modal 的 Chromium 独立测试可通过，但只覆盖 `/dev/a11y` 试验页，未覆盖真实业务弹窗和真实主题/数据状态 | 为每个弹窗类别选取至少一个真实调用方，覆盖打开、关闭、表单、错误、深浅主题、390px、嵌套层级、触发器焦点返回                                                        |
| Firefox 不可测   | `a11y-modal` 的 Firefox 11 个场景全部因浏览器二进制未安装失败                                             | CI 和本地 bootstrap 必须显式安装 Chromium + Firefox；测试矩阵必须两浏览器全绿，不能将“未安装”当作跳过                                                              |
| 无视觉基线       | 没有业务页面前后截图 diff，无法在重构后发现透明、圆角、遮罩、溢出和层叠退化                               | 用 Playwright 建立 Login、Assets、Materials、Users、AI Workbench、发布、详情的亮/暗 × 1440/768/390 × loading/empty/error/success 截图基线；像素 diff 超阈值阻断 PR |
| 登录后页面未验收 | 当前缺少可用于审计的测试账号/种子数据路径                                                                 | 提供隔离审计账号和稳定 fixture，或在本地 mock server 中注入真实形态数据；以此签收资源、管理和工作台                                                                |
| CSS 构建警告     | `mobile.css` 注释中的 `p-*/`、`gap-*/` 会提前结束注释，构建报 CSS parser warning                          | 修正注释文字，要求 production build 零 warning；将 Vite CSS warning 设为 CI failure                                                                                |

## 3. P0：样式、组件与前端架构债

1. 当前有约 215 个 scoped style 块。按 Token → Primitive → Page Pattern → Domain 的唯一所有权迁移；业务组件不得重定义颜色、圆角、阴影、浮层或响应式策略。
2. 组件和路由重构量极大（数百文件同时变更）。冻结继续“全仓替换”，先以独立分支/PR、截图基线、可回退 feature flag 和小范围域迁移恢复稳定基线。
3. Softwares、Plugins、SidebarMenu、MarkdownAiPanel 等仍为 1600–2200 行级组件。拆为 query/mutation、DTO/view-model、容器、表现 section；任一文件目标 ≤500 行，渲染器例外必须具备独立生命周期测试。
4. 资源、管理、工作台的统一 template 只能在删除旧 Header/Toolbar/Filter/Detail 实现后算完成；禁止“新模板 + 旧样式 + 旧组件”并存。
5. 统一 Query、请求取消、错误边界、空/加载状态、权限和 URL 状态。快速筛选、路由跳转、Socket 推送不得令旧响应覆盖新状态。

## 4. P0：服务端构建与工程可靠性

| 问题                  | 当前表现                                                                    | 完成标准                                                                                                          |
| --------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Prisma Windows 文件锁 | `server npm run build` 在 `prisma generate` 重命名 engine 时出现 EPERM      | 将 generate 从每次 build 中移出，设置受控 generate job；build 只编译；并发 dev/test 下可重复构建且无自动杀进程    |
| 服务端 Lint           | 38 error、351 warning，存在格式错误和大量 `any`                             | 先清零格式 error，再为路由/控制器/服务/队列边界定义 DTO、Zod 推导和 Fastify request 类型；`--max-warnings=0` 通过 |
| Jest 强退             | 测试使用 `--forceExit`，说明资源句柄未闭合                                  | 删除强退；显式关闭 Fastify、Prisma、Redis、BullMQ、Socket、Worker；`--detectOpenHandles` 为 0                     |
| CI 缺口               | 根 CI 未执行服务端 strict lint/build/test、Prisma generate 和 contract test | 增加 server quality job，并将前后端、E2E、视觉、a11y、bundle、安全检查全设为合并门禁                              |

## 5. P1：性能、可观测性与安全

- 入口依赖树和重型 chunk 仍需按真实 gzip/brotli 设预算：登录 ≤180KB、普通路由 ≤300KB、编辑器 ≤550KB、3D ≤700KB；禁止通过提高 chunk warning 阈值掩盖问题。
- 编辑器、3D renderer、worker、CodeMirror 仅在对应动作触发时动态加载；离开路由必须 dispose worker、监听器、纹理、geometry 和 material。
- RUM 采集 LCP、INP、CLS、长任务、资源列表完成、3D 首帧、上传成功率与 API p50/p95/p99；服务端采集队列、错误率、重试、存储和数据库指标。
- API 合同以 Zod/OpenAPI 单一源生成客户端和 contract test；权限矩阵、错误码、幂等键和审计日志成为端到端用例。
- 发布使用不可变构建、私有 source map、CSP、安全头、依赖漏洞扫描、S3/R2 最小权限、密钥轮换与灾难恢复演练。

## 6. 最终执行顺序与停止条件

1. 立即停止继续扩散视觉重构；修复 V-01～V-06，修正 CSS parser warning，建立 overlay stack。
2. 迁移并删除全部 111 个遗留玻璃调用；删除兼容层后才允许宣布“玻璃治理完成”。
3. 安装 Firefox、补齐真实业务弹窗 E2E 与视觉快照；两浏览器、三断点、两主题全部通过。
4. 以 Login、Assets、Users/AI Workbench 为视觉样板签收，再按资源 → 管理 → 任务 → 工具 → 学习/社区推广；每迁移一域，必须删除旧实现。
5. 修复服务端 build/lint/open handles，补全服务端 CI 和 API 合同。
6. 完成组件拆分、性能预算、RUM 和安全门禁后，进行全量回归；任一构建 warning、E2E 失败、视觉 diff 未审批、a11y 失败、性能超预算或服务端门禁失败，均不得标记完成。

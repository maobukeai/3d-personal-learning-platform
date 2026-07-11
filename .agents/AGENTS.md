# 3D个人学习平台全局开发与重构规则（硬核工业风）

## 1. 前端 UI 与视觉规范

- **技术栈与清退**：以 Vue 3.5+ + Vite 8 + TS 6 + Tailwind CSS v4 + Radix Vue 为核心。全面淘汰 Element Plus 存量（30天内清退），禁止新增其依赖。首屏 JS Bundle 控制在 200KB 内。
- **写实磨砂玻璃**：叠加在 3D 画布之上的 2D 面板统一使用 `.glass-real-physical` 类（含 SVG 物理噪点滤镜 + 顶部亮边与底部暗边双层阴影）。
- **性能防卫与降级**：磨砂面板添加 `.glass-panel-extreme`（`will-change` 硬件加速）。当 3D 画布帧率低于 45FPS 时，环境感知模块必须自动关闭 `backdrop-blur` 并平滑降级为纯色半透。
- **Tailwind v4 规范**：废除 `tailwind.config.js`，设计 Token 全部声明在 `tokens.css` 的 `@theme` 内。创建复用样式强制使用 `@utility` 语法，禁用旧版 `@layer`。

## 2. Three.js 3D 渲染规范

- **主线程解耦**：将 `SceneManager` 移入 Web Worker 中，利用 `OffscreenCanvas` 进行渲染。主线程与 Worker 采用统一的数据包格式，且对鼠标/触控高频事件在主线程侧做 16.7ms 节流。
- **显存红线防卫**：内存中维护资产引用计数器，设定 512MB 显存红线。接近红线时自动强制销毁（Dispose）不可见场景的 Geometry/Material/Texture，并调用 `renderer.renderLists.dispose()`。
- **射线剪裁**：使用 `three-mesh-bvh` 代替常规 Raycaster 遍历，将碰撞与选中性能优化至 $O(\log N)$。

## 3. Tiptap 富文本编辑器规范

- **AST 双向同步**：数据库唯一合法格式为 Markdown。前端以 Tiptap 作为 View 层，通过 AST 解析器在保存前双向无损序列化（含 Mermaid、KaTeX、代码块、媒体嵌入）。
- **极简设计**：完全移除顶部工具栏，仅使用选区悬浮气泡菜单 (Bubble Menu)；编辑容器透明并包裹在 Tier 1 磨砂卡片中。
- **安全与协作**：实现 300ms 保存防抖、粘贴清洗、XSS 过滤与 R2/S3 图片直传。底层预留 Yjs / CRDT 接口。

## 4. 后端架构与安全防线

- **Fastify 升级**：淘汰 Express，逐步迁移至 Fastify（旧 Express 路由作为 legacy 兼容并在 30 天内清退完毕）。核心接口使用 ajv + Zod 强类型 DTO 校验。
- **云存储「零本地 IO」**：废除本地存储兜底。媒体大文件通过前端 Presigned URL 直接流式直传 R2/S3；生成件（如缩略图）强制在内存中以 Buffer 形式直传云存储，禁止写入磁盘。
- **异步队列与锁**：HTTP 主进程仅处理轻量级接口（响应 < 50ms）。重型任务（如模型网格压缩、贴图降采样）丢入基于 Redis 的 BullMQ 分布式队列执行。多表变更使用 Prisma 事务加悲观锁或 Redis 分布式锁（Redlock）。

## 5. 绝不妥协的全局红线 (Zero-Tolerance)

1. **主线程阻塞**：无论是前端 3D 计算还是后端大 JSON 解析，单帧阻塞严禁超过 16.7ms (60FPS)。
2. **零裸奔接口**：所有公开读取/写入接口必须配置 Rate Limiting 限流中间件。
3. **资产上线约束**：禁止超过 5MB 的原始模型暴露给客户端。所有上传的 3D 模型必须自动通过 `gltf-pipeline` 执行 Draco 10 级压缩，且贴图转化为最大 2048x2048 分辨率的 WebP 格式。
4. **提交拦截**：在 Git Commit 阶段，通过自定义规则审计并拒绝引入任何虚构 API 或缺失 TS 类型的代码。

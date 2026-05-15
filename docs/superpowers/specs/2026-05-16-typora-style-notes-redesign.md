# 设计规格说明：Typora 风格“现代纸张”笔记编辑页重构

## 1. 目标 (Goals)
重构学习笔记（NotesView.vue）的编辑对话框，消除目前的布局臃肿感和滚动条 Bug，提供一个类似 Typora 的极简、沉浸式、以文档为中心的写作体验。

## 2. 核心设计原则 (Core Principles)
- **极简主义 (Minimalism)**: 移除不必要的边框、背景色和阴影，让文字成为主角。
- **一张白纸 (Paper Concept)**: 模拟在中心化的白纸上写作，内容随长度自然向下延伸。
- **无感交互 (Invisible UI)**: 功能按钮仅在需要时出现，不干扰写作视线。
- **单滚动条 (Single Scrollbar)**: 彻底解决嵌套滚动导致的“无法上滑”问题，实行全局滚动。

## 3. 技术方案 (Technical Solutions)

### 3.1 布局架构重组
- **容器层级**: 
  - `el-dialog (fullscreen)` -> `div (w-screen h-screen overflow-y-auto)` -> `div (max-w-4xl mx-auto)`。
  - 取消 `main` 标签的 `overflow-hidden`，将滚动权限交给最外层容器。
- **纸张效果**:
  - 核心写作区背景为 `var(--bg-card)`，与 App 背景色 `var(--bg-app)` 形成微弱对比。
  - 使用极细边框 `1px solid var(--border-base)` 和微弱投影 `shadow-sm`。

### 3.2 UI 组件调整
- **Header (顶栏)**:
  - 背景透明或与纸张同色，取消底边框。
  - 标题输入框采用 `static` 布局，字体加大加粗（`text-4xl`），作为文档的第一部分，而非独立工具栏。
- **MarkdownEditor**:
  - 设置为 `height: auto` 模式（撑开高度）。
  - 深度定制 CSS，移除其内置的边框、内边距和独立滚动条。
  - 隐藏或透明化工具栏，直到鼠标悬停。
- **Settings (设置)**:
  - 摘要、标签、分类、可见性等元数据收纳进右上角的“设置”按钮（Popconfirm 或 Dropdown），保持主界面干净。

### 3.3 样式细节
- **行间距**: 提高至 `line-height: 1.8`。
- **内边距**: “纸张”四周保留充足的留白（`px-16 py-20`），提供视觉呼吸感。
- **暗色模式**: 完美适配 Dark Mode，保持低对比度，保护视力。

## 4. 成功标准 (Success Criteria)
1. **零 Bug**: 彻底解决长文本下无法滚动到顶部或底部的问题。
2. **零干扰**: 写作时除了文字和光标，屏幕上没有其他夺目元素。
3. **一致性**: 在不同尺寸屏幕下保持居中，移动端自动切换为全屏纸张。

## 5. 待办任务 (Todos)
- [ ] 修改 `MarkdownEditor.vue` 以支持自适应高度和更深度的样式穿透。
- [ ] 重写 `NotesView.vue` 中的 `immersive-editor-dialog` 结构。
- [ ] 验证在超长文本（>10000字）下的性能和滚动流畅度。

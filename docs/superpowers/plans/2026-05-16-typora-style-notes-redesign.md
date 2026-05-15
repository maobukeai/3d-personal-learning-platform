# Typora 风格“现代纸张”笔记编辑页重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 提供一个类似 Typora 的极简、沉浸式、以文档为中心的写作体验，彻底解决滚动条 Bug。

**架构：** 
1. 增强 `MarkdownEditor` 以支持高度自适应和样式穿透。
2. 重构 `NotesView` 编辑弹窗，建立“App 背景 -> 滚动容器 -> 居中纸张 -> 沉浸式内容”的四层结构。
3. 将元数据配置（分类、标签等）移入辅助操作面板。

**技术栈：** Vue 3, TypeScript, md-editor-v3, Element Plus, Tailwind CSS.

---

### 任务 1：增强 MarkdownEditor 组件

**文件：**
- 修改：`src/components/MarkdownEditor.vue`

- [ ] **步骤 1：支持高度自适应和更灵活的 Props**
修改 `props` 定义，增加 `autoHeight` (对应 md-editor-v3 的 `autoHeight`) 和样式穿透支持。

```typescript
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    height?: string;
    previewOnly?: boolean;
    autoFocus?: boolean;
    autoHeight?: boolean; // 新增
  }>(),
  {
    placeholder: '请输入内容，支持 Markdown 格式...',
    height: '500px',
    previewOnly: false,
    autoFocus: false,
    autoHeight: false, // 默认不开启，避免影响其他页面
  },
);
```

- [ ] **步骤 2：在模板中应用 autoHeight**
在 `MdEditor` 组件上绑定 `:autoHeight="autoHeight"`。

- [ ] **步骤 3：注入样式穿透 CSS**
在 `<style>` 中添加专门用于“现代纸张”模式的穿透样式类 `.modern-paper-theme`。

```css
/* 当父级开启现代模式时，移除所有编辑器痕迹 */
.markdown-editor-wrapper.modern-paper-theme .md-editor {
  border: none !important;
  background-color: transparent !important;
}
.markdown-editor-wrapper.modern-paper-theme .md-editor-content {
  background-color: transparent !important;
}
```

- [ ] **步骤 4：Commit**
```bash
git add src/components/MarkdownEditor.vue
git commit -m "feat(editor): support autoHeight and modern-paper theme"
```

---

### 任务 2：重构 NotesView 模板结构

**文件：**
- 修改：`src/views/Learning/NotesView.vue`

- [ ] **步骤 1：重写 el-dialog 内部结构**
建立单滚动条架构。

```html
<el-dialog v-model="showCreateDialog" fullscreen ...>
  <!-- 最外层控制背景和滚动 -->
  <div class="fixed inset-0 bg-[var(--bg-app)] overflow-y-auto custom-scrollbar h-screen">
    <!-- 顶栏：悬浮在上方，透明背景 -->
    <header class="sticky top-0 z-50 h-16 flex items-center justify-between px-8 bg-[var(--bg-app)]/80 backdrop-blur-md">
       <!-- 只有关闭按钮和操作按钮 -->
    </header>

    <!-- 主体：居中纸张 -->
    <main class="max-w-4xl mx-auto px-4 pb-32 pt-10">
      <div class="bg-[var(--bg-card)] border border-[var(--border-base)] shadow-sm rounded-lg min-h-[80vh] px-16 py-20">
        <!-- 标题区域 -->
        <el-input v-model="formTitle" placeholder="无标题" class="editor-modern-title mb-8" />
        <!-- 编辑器 -->
        <MarkdownEditor v-model="formContent" autoHeight class="modern-paper-theme" />
      </div>
    </main>
  </div>
</el-dialog>
```

- [ ] **步骤 2：优化设置项入口**
将分类、标签等功能移入右上角的 `Settings` 下拉菜单或气泡。

- [ ] **步骤 3：Commit**
```bash
git add src/views/Learning/NotesView.vue
git commit -m "feat(notes): implement centered paper layout structure"
```

---

### 任务 3：美化样式与细节打磨

**文件：**
- 修改：`src/views/Learning/NotesView.vue`

- [ ] **步骤 1：定义标题样式**
移除输入框背景，模拟原生文本感。

```css
.editor-modern-title :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background: transparent !important;
  padding: 0 !important;
}
.editor-modern-title :deep(.el-input__inner) {
  font-size: 2.5rem !important;
  font-weight: 800 !important;
  color: var(--text-primary) !important;
  border: none !important;
}
```

- [ ] **步骤 2：调整 Markdown 内容排版**
通过样式穿透优化行高。

- [ ] **步骤 3：Commit**
```bash
git add src/views/Learning/NotesView.vue
git commit -m "style(notes): polish typora-style typography and spacing"
```

---

### 任务 4：验证与清理

- [ ] **步骤 1：运行本地构建**
`npm run build` 确保没有类型错误。

- [ ] **步骤 2：自测滚动行为**
打开笔记编辑页，输入大量文字，验证是否可以使用系统滚动条平滑上下滑动。

- [ ] **步骤 3：Commit**
```bash
git commit -m "chore(notes): final polish and verification"
```

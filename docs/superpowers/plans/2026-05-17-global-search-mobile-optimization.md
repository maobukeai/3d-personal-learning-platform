# 全局搜索手机端适配实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优化全局搜索对话框在移动设备上的显示效果，解决宽度不适配、垂直位置过低以及桌面端 UI 干扰问题。

**架构：** 在 `MainLayout.vue` 中利用已有的 `isMobile` 响应式变量，动态调整 `el-dialog` 的属性和内部组件的可见性。

**技术栈：** Vue 3, Element Plus, Tailwind CSS, Lucide Vue Next.

---

### 任务 1：优化对话框响应式属性

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：修改 `el-dialog` 绑定属性**

找到 `el-dialog` 标签，将其宽度和顶部距离改为响应式绑定。

```vue
<!-- 修改前 -->
<el-dialog
  v-model="isSearchVisible"
  title="全局搜索"
  width="600px"
  top="15vh"
  class="search-dialog custom-rounded-dialog"
  :show-close="false"
>

<!-- 修改后 -->
<el-dialog
  v-model="isSearchVisible"
  :title="isMobile ? '' : '全局搜索'"
  :width="isMobile ? '100%' : '600px'"
  :top="isMobile ? '0' : '15vh'"
  :class="['search-dialog', 'custom-rounded-dialog', isMobile ? 'mobile-search-dialog' : '']"
  :show-close="isMobile"
  :fullscreen="isMobile"
>
```

- [ ] **步骤 2：验证变更**

手动检查代码，确认 `:width`, `:top`, `:show-close`, `:fullscreen` 是否已根据 `isMobile` 动态设置。

- [ ] **步骤 3：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "style(ui): make global search dialog responsive"
```

---

### 任务 2：隐藏移动端非必要 UI 元素

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：隐藏桌面端快捷键提示**

在最近搜索列表中，隐藏 `kbd` 标签（或者使用 Tailwind 类名在移动端隐藏）。

```vue
<!-- 修改前 -->
<kbd
  class="text-[10px] px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity"
  >Enter</kbd
>

<!-- 修改后 -->
<kbd
  class="hidden md:inline-block text-[10px] px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity"
  >Enter</kbd
>
```

- [ ] **步骤 2：隐藏底部关闭提示**

在对话框 footer 中隐藏桌面端关闭提示。

```vue
<!-- 修改前 -->
<template #footer>
  <div class="flex items-center justify-between text-[10px] text-slate-400">
    <div class="flex gap-4">
      <span class="flex items-center gap-1.5"
        ><kbd class="px-1 py-0.5 rounded border bg-slate-50 dark:bg-slate-900">esc</kbd>
        关闭</span
      >
    </div>
  </div>
</template>

<!-- 修改后 -->
<template #footer v-if="!isMobile">
  <!-- ... 保持原有内容 ... -->
</template>
```

- [ ] **步骤 3：验证变更**

确认 `hidden md:inline-block` 已添加到 `kbd` 标签。确认 `v-if="!isMobile"` 已添加到 footer。

- [ ] **步骤 4：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "style(ui): hide desktop-only search hints on mobile"
```

---

### 任务 3：样式精调

**文件：**
- 修改：`src/layouts/MainLayout.vue`

- [ ] **步骤 1：添加移动端专属 CSS 类（可选）**

如果需要对全屏对话框进行额外微调，在 `<style scoped>` 中添加类。

```css
/* 添加到 <style scoped> 底部 */
:deep(.mobile-search-dialog) {
  margin-bottom: 0 !important;
  border-radius: 0 !important;
}
:deep(.mobile-search-dialog .el-dialog__header) {
  padding: 16px;
  margin-right: 0;
}
:deep(.mobile-search-dialog .el-dialog__body) {
  padding: 10px 16px;
}
```

- [ ] **步骤 2：验证样式应用**

确认 CSS 选择器正确匹配了动态添加的 `mobile-search-dialog`。

- [ ] **步骤 3：Commit**

```bash
git add src/layouts/MainLayout.vue
git commit -m "style(ui): add mobile-specific styles for search dialog"
```

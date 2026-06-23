<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next';
</script>

<template>
  <div
    class="flex flex-col items-center justify-center py-20 border border-dashed rounded-2xl bg-slate-900/10"
    style="border-color: var(--border-base)"
  >
    <div class="p-4 bg-slate-800/30 text-slate-500 rounded-full mb-4">
      <FolderOpen class="h-10 w-10 text-indigo-400" />
    </div>
    <p class="text-sm font-semibold mb-1" style="color: var(--text-primary)">
      未找到任何 2FA 安全账号
    </p>
    <p class="text-xs" style="color: var(--text-secondary)">
      可尝试更换筛选分组或修改搜索条件后再试
    </p>
  </div>
</template>

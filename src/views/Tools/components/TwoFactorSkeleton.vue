<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next';
</script>

<template>
  <div class="flex flex-col items-center justify-center py-20 gap-3">
    <el-icon class="is-loading text-3xl text-indigo-500"><RefreshCw /></el-icon>
    <span class="text-slate-400 text-sm">正在加载安全凭据...</span>
  </div>
</template>

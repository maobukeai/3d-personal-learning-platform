<script setup lang="ts">
import { Mail } from 'lucide-vue-next';
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 select-none">
    <div
      class="w-16 h-16 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-300 dark:text-slate-700 mb-4 animate-pulse"
    >
      <Mail class="w-7 h-7" />
    </div>
    <p class="text-sm font-semibold text-slate-600 dark:text-slate-400">
      微软 Graph 安全邮箱管理后台
    </p>
    <p class="text-xs mt-1 text-slate-400 max-w-sm text-center leading-relaxed">
      您可以选择一个账号并同步邮件列表，点击邮件进行阅读；或者点击“{{
        $t('tools.email.compose_btn')
      }}”开始安全邮件群发。
    </p>
  </div>
</template>

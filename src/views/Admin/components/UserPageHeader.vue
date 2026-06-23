<script setup lang="ts">
import { Plus, RefreshCw, Search } from 'lucide-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import type { AdminUserOverview } from '../UsersView.vue';

const props = defineProps<{
  userOverview: AdminUserOverview | null;
  isLoading: boolean;
  isOverviewLoading: boolean;
  subtitle: string;
}>();

const searchQuery = defineModel<string>('searchQuery', { required: true });

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'create'): void;
}>();
</script>

<template>
  <PageHeader title="用户管理" :subtitle="props.subtitle" variant="card">
    <template #title-badge>
      <div v-if="userOverview" class="flex flex-wrap items-center gap-1.5 ml-2">
        <Badge variant="info">封禁: {{ userOverview.totals.banned }}</Badge>
        <Badge variant="info">管理员: {{ userOverview.totals.admins }}</Badge>
        <Badge variant="info">活跃订阅: {{ userOverview.commerce.activeSubscriptions }}</Badge>
      </div>
    </template>

    <template #center>
      <!-- Compact Search Box (Centered) -->
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
        <Search />
        <input v-model="searchQuery" placeholder="搜索姓名、邮箱..." type="search" />
      </label>
    </template>

    <!-- Reusable Buttons -->
    <Button
      variant="secondary"
      size="sm"
      :loading="isLoading || isOverviewLoading"
      :icon="RefreshCw"
      @click="emit('refresh')"
    >
      刷新
    </Button>
    <Button variant="primary" size="sm" :icon="Plus" @click="emit('create')"> 新建用户 </Button>
  </PageHeader>
</template>

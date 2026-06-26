<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

onMounted(() => {
  router.replace({ path: '/plugins', query: { plugin: route.params.id } });
});
</script>

<template>
  <div class="flex items-center justify-center min-h-[50vh] text-[var(--text-muted)] text-sm font-medium">
    Loading plugin details...
  </div>
</template>

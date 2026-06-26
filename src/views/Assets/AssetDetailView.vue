<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

onMounted(() => {
  // Redirect to the main assets view with the asset ID as a query parameter
  // so the list page can trigger the detail modal directly.
  router.replace({ path: '/assets', query: { id: route.params.id } });
});
</script>

<template>
  <div class="flex items-center justify-center min-h-[50vh] text-[var(--text-muted)] text-sm font-medium">
    Loading asset details...
  </div>
</template>

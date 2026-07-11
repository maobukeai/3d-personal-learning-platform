<script setup lang="ts">
interface Props {
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), { disabled: false });
</script>

<template>
  <form novalidate><slot /></form>
</template>

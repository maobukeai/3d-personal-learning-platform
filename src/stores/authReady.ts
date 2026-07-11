/**
 * authReady
 * ---------
 * A shared reactive ref that is set to `true` exactly once, after the
 * auth bootstrap sequence (fetchMe → token refresh) has completed on the
 * first page load.
 *
 * Import this in MainLayout.vue to gate the RouterView so child views
 * (TaskBoard, MaterialsView, …) cannot fire authenticated API requests
 * before `authStore.accessToken` is in memory.
 */
import { ref } from 'vue';

export const authReady = ref(false);

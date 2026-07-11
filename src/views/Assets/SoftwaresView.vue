<script setup lang="ts">
import { ref } from 'vue';
import { useLabel } from '@/utils/i18n';
import { useSoftwaresQuery } from './useSoftwaresQuery';
import { useSoftwaresMutations } from './useSoftwaresMutations';
import type { LibraryTab, SortMode, ViewMode, SoftwareItem } from './softwaresSchema';
import SoftwareFiltersPanel from './components/SoftwareFiltersPanel.vue';
import SoftwareCatalog from './components/SoftwareCatalog.vue';
import HelpRequestsForum from './components/HelpRequestsForum.vue';
import ResourceSearchDialog from './components/ResourceSearchDialog.vue';
import SoftwaresHeader from './components/SoftwaresHeader.vue';
import SoftwaresToolbar from './components/SoftwaresToolbar.vue';
import SoftwaresDetail from './components/SoftwaresDetail.vue';
import SoftwaresForm from './components/SoftwaresForm.vue';
import SoftwaresHelpRequests from './components/SoftwaresHelpRequests.vue';
import SoftwaresFavoriteCategoryModal from './components/SoftwaresFavoriteCategoryModal.vue';
const label = useLabel();
const query = useSoftwaresQuery();
const mutations = useSoftwaresMutations(query);
// Destructure only refs (need template auto-unwrapping); functions stay on objects.
const {
  searchQuery,
  activeTab,
  sortBy,
  viewMode,
  showFavoritesOnly,
  activeCategory,
  myStatusFilter,
  selectedTag,
  selectedFavoriteCategory,
  isLoading,
  favoritedIds,
  favoriteCategoriesList,
  downloadingIds,
  insights,
  helpRequests,
  isHelpRequestsLoading,
  currentUserId,
  visibleSoftwares,
  stats,
  categoryTabOptions,
  statusTabOptions,
  activeFilterChips,
  libraryTabOptions,
  viewModeOptions,
  pluginCategories,
} = query;
const {
  selectedSoftware,
  isDetailDialogOpen,
  isUploadDialogOpen,
  isSearchOpen,
  initialPublishData,
  isSavingReview,
  isBatchMode,
  selectedSoftwareIds,
  isFilterOpen,
  isFilterCollapsed,
  isAdmin,
} = mutations;
const formRef = ref<InstanceType<typeof SoftwaresForm> | null>(null);
const helpRequestsRef = ref<InstanceType<typeof SoftwaresHelpRequests> | null>(null);
const favCatModalRef = ref<InstanceType<typeof SoftwaresFavoriteCategoryModal> | null>(null);
const handleDetailEdit = (software: SoftwareItem) => {
  isDetailDialogOpen.value = false;
  formRef.value?.openEdit(software);
};
const onBatchModeChange = (val: boolean) => {
  isBatchMode.value = val;
  if (!val) selectedSoftwareIds.value = new Set();
};
</script>

<template>
  <div
    class="softwares-page mobile-adaptive flex flex-col h-full overflow-hidden"
    @click="mutations.handleContainerClick"
  >
    <SoftwaresHeader
      v-model:search-query="searchQuery"
      :is-loading="isLoading"
      @open-search="isSearchOpen = true"
      @refresh="
        query.fetchSoftwares();
        query.fetchInsights();
      "
      @upload="mutations.handleUploadClickSoftware"
    />

    <div class="flex-1 overflow-y-auto p-4 pt-2.5 flex flex-col gap-3">
      <div
        class="workspace-shell"
        :class="{ 'single-col': activeTab === 'requests', 'collapsed-shell': isFilterCollapsed }"
      >
        <!-- prettier-ignore -->
        <SoftwareFiltersPanel
            v-if="activeTab !== 'requests'" v-model:collapsed="isFilterCollapsed"
            :is-open="isFilterOpen" :active-category="activeCategory" :active-tab="activeTab"
            :my-status-filter="myStatusFilter" :selected-tag="selectedTag"
            :category-tab-options="categoryTabOptions" :status-tab-options="statusTabOptions"
            :hot-tags="insights?.hotTags || []" :favorite-categories="favoriteCategoriesList"
            :selected-favorite-category="selectedFavoriteCategory"
            @update:active-category="activeCategory = $event"
            @update:my-status-filter="myStatusFilter = $event"
            @update:selected-tag="selectedTag = $event"
            @update:selected-favorite-category="selectedFavoriteCategory = $event"
            @fetch-softwares="query.fetchSoftwares"
            @create-category="favCatModalRef?.openCreateCategory()"
            @rename-category="favCatModalRef?.openRenameCategory($event)"
            @delete-category="favCatModalRef?.handleDeleteFavoriteCategory($event)"
          />
        <main class="content-panel">
          <SoftwaresToolbar
            :search-query="searchQuery"
            :is-loading="isLoading"
            :active-tab="activeTab"
            :library-tab-options="libraryTabOptions"
            :sort-by="sortBy"
            :view-mode="viewMode"
            :view-mode-options="viewModeOptions"
            :show-favorites-only="showFavoritesOnly"
            :is-filter-collapsed="isFilterCollapsed"
            :is-filter-open="isFilterOpen"
            :is-batch-mode="isBatchMode"
            :selected-count="selectedSoftwareIds.size"
            :visible-count="visibleSoftwares.length"
            @update:search-query="searchQuery = $event"
            @update:active-tab="activeTab = $event as LibraryTab"
            @update:sort-by="sortBy = $event as SortMode"
            @update:view-mode="viewMode = $event as ViewMode"
            @update:is-batch-mode="onBatchModeChange"
            @update:is-filter-open="isFilterOpen = $event"
            @update:is-filter-collapsed="isFilterCollapsed = $event"
            @toggle-favorites="showFavoritesOnly = !showFavoritesOnly"
            @select-all="mutations.selectAllSoftwares"
            @bulk-delete="mutations.handleBulkDeleteSoftwares"
            @bulk-unfavorite="mutations.handleBulkUnfavoriteSoftwares"
          />
          <HelpRequestsForum
            v-if="activeTab === 'requests'"
            :forum-title="label('软件求助论坛', 'Software Help Requests Forum')"
            :forum-desc="
              label(
                '找不到需要的软件？发布求助帖，让社区开发者和爱好者来帮助您！',
                'Can\'t find a software? Ask the community for help.',
              )
            "
            :requests="helpRequests"
            :is-loading="isHelpRequestsLoading"
            @open-detail="helpRequestsRef?.openHelpRequestDetail($event)"
            @create-request="helpRequestsRef?.openHelpRequestPostDialog()"
          />
          <!-- prettier-ignore -->
          <SoftwareCatalog
              v-else :softwares="visibleSoftwares" :is-loading="isLoading" :view-mode="viewMode"
              :active-tab="activeTab" :favorited-ids="favoritedIds" :downloading-ids="downloadingIds"
              :active-filter-chips="activeFilterChips" :total-count="stats.total || visibleSoftwares.length"
              :selected-ids="Array.from(selectedSoftwareIds)"
              @open-detail="mutations.openDetail" @select="mutations.toggleSoftwareSelect"
              @toggle-favorite="mutations.toggleFavorite" @download="mutations.handleDownload"
              @reset-filters="mutations.resetFilters" @clear-filter="mutations.clearFilter"
              @upload="mutations.handleUploadClickSoftware"
            />
        </main>
      </div>
    </div>

    <!-- prettier-ignore -->
    <SoftwaresDetail
      :show="isDetailDialogOpen" :item="selectedSoftware"
      :is-favorited="selectedSoftware ? query.isFavorited(selectedSoftware.id) : false"
      :is-downloading="selectedSoftware ? !!downloadingIds[selectedSoftware.id] : false"
      :is-admin="isAdmin" :can-edit="selectedSoftware ? mutations.canEditSoftware(selectedSoftware) : false"
      :is-saving-review="isSavingReview"
      @close="isDetailDialogOpen = false" @favorite="query.fetchFavorites(); query.fetchInsights();"
      @download="mutations.downloadSelectedSoftware" @edit="handleDetailEdit" @delete="mutations.deleteSoftware"
      @review-approved="mutations.handleReviewApproved" @review-rejected="mutations.handleReviewRejected"
      @update="mutations.handleSoftwareUpdate"
    />
    <!-- prettier-ignore -->
    <SoftwaresForm
      ref="formRef" :is-upload-dialog-open="isUploadDialogOpen" :initial-publish-data="initialPublishData"
      :plugin-categories="pluginCategories" @update:is-upload-dialog-open="isUploadDialogOpen = $event"
      @published="query.fetchSoftwares(); query.fetchInsights();" @saved="mutations.handleSoftwareUpdate"
    />
    <!-- prettier-ignore -->
    <SoftwaresHelpRequests
      ref="helpRequestsRef" :help-requests="helpRequests" :is-help-requests-loading="isHelpRequestsLoading"
      :current-user-id="currentUserId" :is-admin="isAdmin" :is-authed="!!currentUserId"
      @open-linked-software="mutations.openLinkedSoftware" @refresh-requests="query.fetchHelpRequests"
    />
    <!-- prettier-ignore -->
    <SoftwaresFavoriteCategoryModal
      ref="favCatModalRef" :favorite-categories="favoriteCategoriesList"
      :selected-favorite-category="selectedFavoriteCategory"
      @update:selected-favorite-category="selectedFavoriteCategory = $event"
      @refresh-favorites="query.fetchFavorites"
    />
    <ResourceSearchDialog
      v-model="isSearchOpen"
      @success="
        query.fetchSoftwares();
        query.fetchInsights();
      "
    />
  </div>
</template>

<style scoped>
.softwares-page {
  height: 100%;
  background: transparent;
  color: var(--text-primary);
}
.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 12px;
  transition: grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.workspace-shell.collapsed-shell {
  grid-template-columns: 1fr;
}
.workspace-shell.single-col {
  grid-template-columns: 1fr;
}
.content-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
@media (max-width: 980px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
</style>

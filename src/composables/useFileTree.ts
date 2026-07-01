import { ref, computed, type Ref } from 'vue';
import type { FlattenedNode } from '@/utils/zipHelper';

/**
 * Shared file-tree expand/collapse logic.
 *
 * Extracted from the duplicated `toggleFolder` / `visibleFileNodes` /
 * `expandedFolders` block that previously appeared verbatim in
 * AssetDetailModal, MaterialDetailPanel, PluginDetailModal, EditWorkDialog,
 * and PublishWorkDialog.
 *
 * @param nodes - reactive source of flattened file-tree nodes (typically a
 *                computed returned by
 *                `flattenFileTree(buildFileTree(files))`)
 *
 * @returns `{ expandedFolders, toggleFolder, visibleFileNodes, resetExpansion }`
 *          - `expandedFolders`: reactive `Set<string>` of currently expanded
 *            folder paths (use `.has(path)` in templates for icon state)
 *          - `toggleFolder(path)`: toggle expansion of a folder
 *          - `visibleFileNodes`: computed list of nodes whose ancestors are
 *            all expanded (root nodes always visible)
 *          - `resetExpansion()`: clear all expansions (call when switching
 *            resources / closing the modal)
 */
export function useFileTree(nodes: Ref<FlattenedNode[]>) {
  const expandedFolders = ref<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    if (expandedFolders.value.has(path)) {
      expandedFolders.value.delete(path);
    } else {
      expandedFolders.value.add(path);
    }
  };

  const visibleFileNodes = computed(() => {
    return nodes.value.filter((node) => {
      const parts = node.path.split('/');
      if (parts.length <= 1) return true;
      let parentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        parentPath = parentPath ? `${parentPath}/${parts[i]}` : parts[i];
        if (!expandedFolders.value.has(parentPath)) {
          return false;
        }
      }
      return true;
    });
  });

  const resetExpansion = () => {
    expandedFolders.value.clear();
  };

  return { expandedFolders, toggleFolder, visibleFileNodes, resetExpansion };
}

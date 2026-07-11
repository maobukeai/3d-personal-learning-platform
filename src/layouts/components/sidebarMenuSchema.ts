import type { SidebarMenuItem, SidebarMenuGroup } from '../composables/useSidebarMenus';

/**
 * Prepared sidebar item — a runtime-enriched menu item with tooltip and
 * active-state flags precomputed by the composable so presentational
 * components stay dumb.
 */
export interface PreparedSidebarItem extends SidebarMenuItem {
  tooltip: string;
  isActive: boolean;
}

/**
 * Prepared sidebar group — a runtime-enriched menu group with a stable key
 * (used for collapse persistence) and a group-level active flag.
 */
export interface PreparedSidebarGroup {
  key: string;
  title: string;
  items: PreparedSidebarItem[];
  isActive: boolean;
}

/** Build a stable key for a group so collapse state can persist across renders. */
export const getGroupKey = (group: SidebarMenuGroup, index: number): string =>
  `${index}:${group.title || 'main'}`;

// --- Sidebar dimension constants (px) -------------------------------------
export const SIDEBAR_RAIL_WIDTH = 60;
export const SIDEBAR_DEFAULT_WIDTH = 196;
export const SIDEBAR_MIN_WIDTH = 130;
export const SIDEBAR_MAX_WIDTH = 450;

/** Below this width during drag, snap to rail mode. */
export const SIDEBAR_RAIL_THRESHOLD = 90;
/** Above this width during drag, snap to expanded mode. */
export const SIDEBAR_EXPAND_THRESHOLD = 110;
export const SIDEBAR_VERY_NARROW_THRESHOLD = 155;
export const SIDEBAR_NARROW_THRESHOLD = 215;
export const SIDEBAR_WIDE_THRESHOLD = 260;

# ADR 0001: Glass Surface Scope Restriction

- **Status:** Accepted
- **Date:** 2026-07-11
- **Supersedes:** Legacy `glass.css` (`.glass-dialog`, `.glass-input`, multi-`@supports backdrop-filter` blocks, business deep selectors, "fallback override" rules)
- **Related:** `docs/design-foundation.md` §6, `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md` §2.3

## Context

Before this decision, glass (translucent surfaces using `backdrop-filter`) was applied broadly across the product. The legacy `glass.css` contained `.glass-dialog`, `.glass-input`, multiple `@supports backdrop-filter` blocks, business-specific deep selectors, and "fallback override" rules. Business components were being styled through theme selectors such as `html.theme-glass .asset-card .footer .action { ... }`.

This caused two classes of problems:

1. **Visual inconsistency.** A single screen could simultaneously show black, blue-black, transparent gray, and semi-transparent white backgrounds with no semantic meaning. The layering hierarchy was unclear and the product lacked a coherent surface language.
2. **Performance issues.** `backdrop-filter` is expensive, especially when animated over a large region. Unrestricted glass meant many simultaneous blur layers, producing jank on mid-range and low-end devices, and large-area animated `backdrop-filter` was listed as a forbidden motion pattern.

Low-end device degradation was handled by adding _another_ layer of override CSS on top, which compounded the maintenance burden and made the cascade harder to reason about.

## Decision

Restrict glass to exactly **three** use cases, and reduce the surface system to exactly **four** tokens.

**Four surface tokens** (no fifth may be invented):

| Token               | Meaning                                                   |
| ------------------- | --------------------------------------------------------- |
| `--canvas`          | App background. Never holds content directly.             |
| `--surface-solid`   | Default content surface. Always opaque.                   |
| `--surface-raised`  | Inset panels, secondary content, hover substrate. Opaque. |
| `--surface-overlay` | Modals, drawers, popovers. **Default is solid.**          |

**Glass is permitted only in:**

1. **Top-level navigation** (app top bar, primary sidebar).
2. **Command palette** (when explicitly `variant="immersive"`).
3. **3D Canvas floating controls** (overlays on top of a WebGL canvas).

Modal and Drawer defaults are **solid** (`--surface-overlay`). Only an `immersive` variant — approved via component review for 3D / command palette use — may use glass, and it must never be implicitly enabled by a business component.

Pages, tables, forms, resource cards, and detail content must use `--surface-solid` / `--surface-raised`.

**Migration requirements:**

- Delete or migrate the legacy `.glass-dialog`, `.glass-input`, multi-`@supports backdrop-filter` blocks, and "fallback override" rules from `glass.css` / `themes.css`.
- Remove all `html.theme-glass .x .y` business-component override selectors.
- Low-end device degradation is achieved by **switching tokens** (the glass token falls back to the matching solid token), never by adding another layer of override CSS.

## Consequences

**Positive:**

- All content surfaces are solid, producing a stable, predictable layering hierarchy.
- CSS is simpler: no cascade of glass overrides, no business-component style penetration via theme classes.
- Performance improves — fewer simultaneous `backdrop-filter` layers, no large-area animated blur.
- Low-end device degradation is a token swap, not a parallel stylesheet.
- Glass becomes a deliberate, reviewed affordance rather than a default.

**Negative:**

- Glass can no longer be used as a quick visual "upgrade" on arbitrary components. Teams must justify the `immersive` variant through component review.
- Existing glass-heavy pages must be migrated to solid surfaces before the new tokens ship; "new/old coexistence" is explicitly forbidden by the execution plan.

**Neutral:**

- The `immersive` variant remains available for genuinely immersive surfaces (3D overlays, command palette), preserving the visual language where it has semantic value.

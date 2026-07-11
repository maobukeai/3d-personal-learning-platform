# Design Foundation — Industrial Craft Workbench

> **Status:** Binding specification. Single source of truth for all design tokens, surfaces, components, and states.
> **Direction:** Industrial Craft Workbench — precise, restrained, built for long sessions of 3D authoring work. Not consumer-grade large radii, neon gradients, full-screen frost, or per-domain color palettes.
> **Scope:** Applies to every rebuild listed in `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md` §2–§4. No component may ship with values that diverge from this document.
> **Last updated:** 2026-07-11

This document supersedes the live values in `src/styles/tokens.css` and `src/styles/themes.css` wherever they conflict. The plan in §2.2 mandates a migration to the palettes below; tokens.css values that differ (e.g. `--bg-app: #0f1319`, `--duration-base: 250ms`, `--radius-lg: 10px`) are **legacy** and must be remapped during the rebuild.

---

## 1. Brand & Color

### 1.1 Brand accent

The single brand accent is **craft orange**. It is the only color that may signal "primary action", "selected", or "brand presence".

| Token             | Value                      | Usage                                                                       |
| ----------------- | -------------------------- | --------------------------------------------------------------------------- |
| `--accent`        | `#F07828`                  | Primary buttons, selected state, focus ring, active indicators, brand marks |
| `--accent-hover`  | `#FF934A`                  | Hover state of primary/accent controls only                                 |
| `--accent-press`  | `#D9651A`                  | Active/pressed state of accent controls                                     |
| `--accent-subtle` | `rgba(240, 120, 40, 0.12)` | Tinted backgrounds for selected rows, chips, active nav items               |
| `--accent-on`     | `#FFFFFF`                  | Foreground on a solid accent fill (icons/text on accent buttons)            |

**Blue is ONLY for links and informational affordances.** It must never be the primary button color, the login brand color, the selected-state color, or the focus ring color. Permitted blue tokens:

| Token           | Dark value | Light value | Usage                                         |
| --------------- | ---------- | ----------- | --------------------------------------------- |
| `--link`        | `#60A5FA`  | `#2563EB`   | Inline text links                             |
| `--link-hover`  | `#93C5FD`  | `#1D4ED8`   | Inline link hover                             |
| `--info-accent` | `#22D3EE`  | `#0E7490`   | Purely informational icons/badges (not links) |

> The login page and primary action buttons must NOT use any blue. Any blue currently used as a primary button in login/register flows is a defect to be fixed in the §2.5 Login样板 rebuild.

### 1.2 Dark theme palette (default)

| Role                                                | Token               | Value     | Contrast on surface      |
| --------------------------------------------------- | ------------------- | --------- | ------------------------ |
| Canvas (app background)                             | `--canvas`          | `#0E1218` | —                        |
| Surface (cards, tables, forms, content)             | `--surface-solid`   | `#151B23` | —                        |
| Raised (insets, secondary panels, hover substrate)  | `--surface-raised`  | `#1C2430` | —                        |
| Overlay (modals, drawers, popovers — solid default) | `--surface-overlay` | `#1C2430` | —                        |
| Border                                              | `--border`          | `#2B3644` | —                        |
| Border strong                                       | `--border-strong`   | `#3A4759` | —                        |
| Text primary                                        | `--text-primary`    | `#F2F5F8` | 15.9:1 on surface ✅ AAA |
| Text secondary                                      | `--text-secondary`  | `#A7B0BB` | 7.9:1 on surface ✅ AA   |
| Text muted (caption)                                | `--text-muted`      | `#7D8593` | 4.7:1 on surface ✅ AA   |
| Accent                                              | `--accent`          | `#F07828` | 6.1:1 on surface ✅ AA   |
| Accent hover                                        | `--accent-hover`    | `#FF934A` | 7.0:1 on surface ✅ AA   |

### 1.3 Light theme palette

| Role                 | Token               | Value     | Contrast on surface        |
| -------------------- | ------------------- | --------- | -------------------------- |
| Canvas               | `--canvas`          | `#F5F7FA` | —                          |
| Surface              | `--surface-solid`   | `#FFFFFF` | —                          |
| Raised               | `--surface-raised`  | `#FFFFFF` | —                          |
| Overlay              | `--surface-overlay` | `#FFFFFF` | —                          |
| Border               | `--border`          | `#D8E0E8` | —                          |
| Border strong        | `--border-strong`   | `#B6C2D0` | —                          |
| Text primary         | `--text-primary`    | `#14202B` | 16.6:1 on white ✅ AAA     |
| Text secondary       | `--text-secondary`  | `#4B5563` | 7.6:1 on white ✅ AA       |
| Text muted (caption) | `--text-muted`      | `#5B6470` | 6.0:1 on white ✅ AA       |
| Accent               | `--accent`          | `#F07828` | 2.8:1 on white ⚠️ see note |
| Accent hover         | `--accent-hover`    | `#FF934A` | 2.2:1 on white ⚠️ see note |

> **Accent-on-light usage constraint.** `#F07828` on white measures ~2.8:1, which is below the 3:1 non-text-UI threshold. Therefore in the **light** theme, craft orange must NOT be used as text or as a thin icon stroke on white. It may be used as:
>
> - a **solid fill** for primary buttons (with `--accent-on` = white text — see contrast note below),
> - a **border/indicator** strip at least 2px thick paired with a non-color cue,
> - a **tinted background** (`--accent-subtle`) for selected states.
>
> **Primary-button text contrast.** White on `#F07828` also measures ~2.8:1, which is below 3:1. Primary button labels must therefore be ≥14px **bold** (large-text tier) and the button fill in light theme should use the press/active variant `#D9651A` (white-on-`#D9651A` ≈ 3.6:1 ✅) when AA conformance is required for the label. This is a tracked exception; component rebuilds must verify the final button fill against the §9 button state table.

### 1.4 Semantic colors

Semantic colors are invariant in meaning across themes. Each is tuned per theme to clear WCAG AA against that theme's surface.

#### Dark theme

| Role    | Token       | Value     | On `--surface-solid` | Usage                                      |
| ------- | ----------- | --------- | -------------------- | ------------------------------------------ |
| Success | `--success` | `#22C55E` | 7.6:1 ✅ AA          | Confirmations, success toasts, valid state |
| Warning | `--warning` | `#F59E0B` | 8.1:1 ✅ AA          | Warnings, pending states                   |
| Danger  | `--danger`  | `#EF4444` | 4.6:1 ✅ AA          | Errors, destructive actions                |
| Info    | `--info`    | `#22D3EE` | 9.6:1 ✅ AA          | Informational badges (non-link)            |

#### Light theme

| Role    | Token       | Value     | On `--surface-solid`             | Usage                        |
| ------- | ----------- | --------- | -------------------------------- | ---------------------------- |
| Success | `--success` | `#059669` | 3.8:1 ✅ large/UI; not body text | Confirmations, success icons |
| Warning | `--warning` | `#D97706` | 3.2:1 ✅ large/UI; not body text | Warnings, pending icons      |
| Danger  | `--danger`  | `#DC2626` | 4.8:1 ✅ AA body text            | Errors, destructive actions  |
| Info    | `--info`    | `#0F766E` | 5.5:1 ✅ AA                      | Informational badges         |

> In light theme, `--success` and `--warning` do not meet 4.5:1 for body text on white. Use them only for icons, badges, and large/bold text (≥14px bold or ≥18px). For success/warning body copy, use `--text-primary` with a leading colored icon.

### 1.5 WCAG AA contrast summary

| Category                                            | Required ratio            | Where it applies                      |
| --------------------------------------------------- | ------------------------- | ------------------------------------- |
| Body text (< 18px regular, < 14px bold)             | ≥ 4.5:1                   | All reading text on `--surface-solid` |
| Large text (≥ 18px regular, or ≥ 14px bold)         | ≥ 3.0:1                   | Headings, stat figures, button labels |
| Non-text UI (icons, borders, focus rings, controls) | ≥ 3.0:1                   | All interactive affordances           |
| Focus indicator change                              | ≥ 3:1 delta vs. unfocused | Per §8                                |

All `--text-primary`, `--text-secondary`, and `--text-muted` pairs in both themes meet AA on `--surface-solid`. The two flagged exceptions (accent-on-light, primary-button label) are documented above and must be verified per component.

---

## 2. Typography

Base body text is **14px / 1.55 line-height**. Hierarchy is created by size, weight, and whitespace — never by color glow or arbitrary pixel sizes. Exactly **one `<h1>` per page**. Auxiliary text minimum is **12px**; no on-screen text may be smaller.

| Level   | Token            | font-size | line-height | font-weight | letter-spacing | Usage                                                         |
| ------- | ---------------- | --------- | ----------- | ----------- | -------------- | ------------------------------------------------------------- |
| H1      | `--typo-h1`      | 24px      | 1.30        | 700         | -0.01em        | Page title. One per page.                                     |
| H2      | `--typo-h2`      | 18px      | 1.35        | 600         | 0              | Section title                                                 |
| H3      | `--typo-h3`      | 16px      | 1.40        | 600         | 0              | Subsection title                                              |
| H4      | `--typo-h4`      | 15px      | 1.45        | 500         | 0              | Card / group heading                                          |
| H5      | `--typo-h5`      | 14px      | 1.50        | 600         | 0              | Inline label / minor heading (weight distinguishes from body) |
| Body    | `--typo-body`    | 14px      | 1.55        | 400         | 0              | Default reading text                                          |
| Caption | `--typo-caption` | 12px      | 1.50        | 400         | 0              | Auxiliary / hint text (minimum size)                          |
| Stat    | `--typo-stat`    | 28px      | 1.20        | 700         | 0              | KPI / numeric metric, `font-variant-numeric: tabular-nums`    |

Font stack: `'Inter', 'Noto Sans SC', ui-sans-serif, system-ui, sans-serif`.

Rules:

- Page text MUST consume the `typo-*` utilities (or the raw `--typo-*` vars). Do NOT use Tailwind arbitrary font sizes (`text-[13px]`, `text-2xl`) or scoped `font-size` literals for page text.
- Long Chinese / English / empty values must NOT truncate or compress: typography utilities set `white-space: normal` and `overflow: visible`. No `line-clamp` on descriptive text.
- Headings are differentiated by size + whitespace, not by making everything bold. Do not bold the entire heading ladder.
- Body and caption text contrast meets WCAG AA (≥4.5:1) on `--surface-solid` in both themes (see §1.5).

---

## 3. Spacing

4px base scale. No value outside this scale may be used for padding, margin, or gap.

| Token        | Value |
| ------------ | ----- |
| `--space-1`  | 4px   |
| `--space-2`  | 8px   |
| `--space-3`  | 12px  |
| `--space-4`  | 16px  |
| `--space-5`  | 20px  |
| `--space-6`  | 24px  |
| `--space-7`  | 28px  |
| `--space-8`  | 32px  |
| `--space-9`  | 36px  |
| `--space-10` | 40px  |

Layout dimensions:

| Token                  | Value              | Usage                                                             |
| ---------------------- | ------------------ | ----------------------------------------------------------------- |
| `--page-max-width`     | 1440px             | Maximum content width for all top-level routes                    |
| `--page-gutter`        | 32px               | Desktop page gutter                                               |
| `--page-gutter-mobile` | 16px               | Mobile page gutter                                                |
| `--content-max-width`  | 1200px             | Readable content column inside a page                             |
| `--page-rhythm-gap`    | 16px (`--space-4`) | Vertical rhythm between Header / Toolbar / Content in `PageFrame` |

All first-level routes use the unified gutter and max-width via `PageFrame`. No page may define its own horizontal padding.

---

## 4. Border Radius

**Only four tiers exist.** No other radius value is permitted anywhere in the product.

| Token              | Value | Usage                                                                         |
| ------------------ | ----- | ----------------------------------------------------------------------------- |
| `--radius-0`       | 0     | Full-screen surfaces, full-bleed images, tables, drawers in fullscreen mode   |
| `--radius-control` | 6px   | Small controls: checkboxes, radios, switches, small chips, segment indicators |
| `--radius-field`   | 8px   | Inputs, buttons, tags, cards, resource cards, list items                      |
| `--radius-section` | 12px  | Detail sections, modals, drawers (exposed corners only), popovers             |

Rules:

- Full-screen surfaces (modals with `size="fullscreen"`, full-screen drawers, full-bleed pages) are always **0**.
- Left/Right Drawers round only the two exposed corners at 12px; the two corners against the viewport edge are 0.
- A single page must not mix more than the four sanctioned radii. In particular, mixing 4/6/8/10/12/14/16px on one page is a defect.

### Explicitly forbidden

- `rounded-2xl` (Tailwind) and any Tailwind radius utility outside the four mapped values.
- Arbitrary `rounded-[npx]` / `rounded-[Nrem]` values.
- Mixing 4px, 6px, 8px, 10px, 12px, 14px, or 16px radii on a single page.
- The legacy `--radius-lg: 10px` and `--radius-xs: 4px` values in `tokens.css`. These are removed; migrate to the four tiers above.

---

## 5. Elevation & Shadows

**Single-layer shadows only.** Each shadow token is exactly one `box-shadow` declaration — no comma-stacked layers. One shadow per floating layer. The default layering mechanism is a 1px semantic border, not shadow.

| Token              | Dark value                       | Light value                       | Usage                                     |
| ------------------ | -------------------------------- | --------------------------------- | ----------------------------------------- |
| `--shadow-rest`    | `0 1px 2px rgba(0, 0, 0, 0.40)`  | `0 1px 2px rgb(16 24 40 / 0.06)`  | Cards and raised surfaces at rest         |
| `--shadow-hover`   | `0 4px 12px rgba(0, 0, 0, 0.50)` | `0 4px 12px rgb(16 24 40 / 0.10)` | Card/element hover, raised popovers       |
| `--shadow-overlay` | `0 8px 24px rgba(0, 0, 0, 0.60)` | `0 8px 24px rgb(16 24 40 / 0.14)` | Modals, drawers, floating command palette |

Rules:

- One shadow per floating layer. A modal uses `--shadow-overlay` only; it does not also add `--shadow-rest` or a glow.
- Rest → hover transitions change shadow OR border OR background, never all three (see §6 single-channel rule and §10).
- No glow tokens (`--glow-orange`, `--glow-orange-strong`) are permitted on content. The legacy glow tokens are removed.

### Forbidden combinations

The following stacking on a single element is forbidden:

- glow + heavy shadow + transparency + scale + border-color change.
- Multiple stacked shadow layers on one card.
- Using shadow as the only separator between two adjacent solid surfaces — use a 1px border instead.

---

## 6. Surfaces

Exactly **four** surface tokens exist. No component may invent a fifth.

| Token               | Dark      | Light     | Meaning                                                   |
| ------------------- | --------- | --------- | --------------------------------------------------------- |
| `--canvas`          | `#0E1218` | `#F5F7FA` | App background. Never holds content directly.             |
| `--surface-solid`   | `#151B23` | `#FFFFFF` | Default content surface. Always opaque.                   |
| `--surface-raised`  | `#1C2430` | `#FFFFFF` | Inset panels, secondary content, hover substrate. Opaque. |
| `--surface-overlay` | `#1C2430` | `#FFFFFF` | Modals, drawers, popovers. **Default is solid.**          |

### Where each surface is used

| Element                                     | Required surface                                         |
| ------------------------------------------- | -------------------------------------------------------- |
| Pages (content area)                        | `--canvas` background, content sits on `--surface-solid` |
| Tables                                      | `--surface-solid`                                        |
| Forms                                       | `--surface-solid`                                        |
| Resource cards (Assets, Materials, etc.)    | `--surface-solid`                                        |
| Detail content (ContentSection)             | `--surface-solid`                                        |
| Inset panels, code blocks, secondary panels | `--surface-raised`                                       |
| Modal (default `variant="standard"`)        | `--surface-overlay` (solid)                              |
| Drawer (default)                            | `--surface-overlay` (solid)                              |
| Popover / Tooltip                           | `--surface-overlay` (solid)                              |

### Glass — strictly scoped

Glass (translucent surface with `backdrop-filter`) is permitted **only** in these three locations:

1. **Top-level navigation** (app top bar, primary sidebar).
2. **Command palette** (when explicitly `variant="immersive"`).
3. **3D Canvas floating controls** (overlays sitting on top of a WebGL canvas).

Modal and Drawer defaults are **solid**. Only an `immersive` variant — approved via component review for 3D / command palette use — may use glass, and it must never be implicitly enabled by a business component.

### Forbidden pattern

Controlling business components through theme selectors is forbidden:

```css
/* FORBIDDEN — business component override via theme class */
html.theme-glass .asset-card .footer .action { ... }
html.theme-glass .users-table tr.selected { ... }
```

Low-end device degradation is achieved by **switching tokens** (e.g. glass token falls back to the matching solid token), never by adding another layer of override CSS. The legacy `.glass-dialog`, `.glass-input`, multi-`@supports backdrop-filter` blocks, and "fallback override" rules in `glass.css` / `themes.css` must be deleted or migrated.

### Card feedback — single-channel rule

A card may use **exactly one** feedback channel on hover/active: border-color OR background OR shadow — never several at once. The default channel is a border-color shift toward the accent:

- `--card-border-rest` = `--border`
- `--card-border-hover` = `color-mix(in srgb, --accent 30%, --border)`

---

## 7. Motion

**Two durations only.**

| Token             | Value | Usage                                                          |
| ----------------- | ----- | -------------------------------------------------------------- |
| `--duration-fast` | 150ms | Micro feedback: hover, focus, toggle, color/border transitions |
| `--duration-base` | 220ms | Structural transitions: fade-in, slide, panel open/close       |

Easing: `--ease-standard` = `cubic-bezier(0.4, 0, 0.2, 1)`.

Allowed motion:

- Fade-in (opacity 0 → 1).
- Small displacement of **2–4px** (e.g. a modal rising 4px, a tooltip sliding 2px).
- Color/border/shadow transitions within the single-channel rule (§6).

`prefers-reduced-motion: reduce`:

- All durations resolve to `0ms`. The page is fully static.
- No fade, no slide, no displacement. State changes are instantaneous.

### Forbidden motion

- The legacy `--duration-slow: 400ms` token is **removed**. No 400ms transitions.
- Continuous floating animations (永驻漂浮).
- Blinking / pulsing attention loops.
- Large-area `blur` animations (animated `backdrop-filter` over a big region).
- Semantic-less scaling (e.g. `scale(1.05)` on hover with no meaning).
- Spring easing (`--ease-spring`) on content UI; reserved for nothing in this spec — do not use.

---

## 8. Focus & Accessibility

WCAG 2.2 AA is the minimum, not the target.

| Requirement                                              | Threshold                     |
| -------------------------------------------------------- | ----------------------------- |
| Body text contrast                                       | ≥ 4.5:1                       |
| Large text (≥18px regular or ≥14px bold) contrast        | ≥ 3.0:1                       |
| Non-text UI (icons, borders, controls) contrast          | ≥ 3.0:1                       |
| Focus ring minimum thickness                             | 2px (outline or ring)         |
| Focus ring contrast change vs. unfocused state           | ≥ 3:1                         |
| Focus ring must not be fully hidden by adjacent elements | Per WCAG 2.2 Focus Appearance |

Focus ring spec:

- `--ring` = `--accent` (`#F07828`).
- Style: `outline: 2px solid var(--ring); outline-offset: 2px;` (or a `box-shadow: 0 0 0 2px var(--ring)` ring of equivalent visible area).
- The ring must be visible against both `--surface-solid` and `--canvas`. On accent-filled elements (primary buttons), use a 2px white ring inside a 1px accent ring, or move the ring outside the element so it is not swallowed by the fill.
- `:focus-visible` only — do not draw the ring on mouse focus of static elements.

Additional accessibility rules (from plan §7):

- Every Modal / Drawer / Dropdown / Select / Tooltip has Playwright keyboard tests: open, initial focus, Tab/Shift+Tab trap, Escape, focus return to trigger, screen-reader name, visible mobile focus.
- Drag / kanban / 3D interactions provide keyboard alternatives, undo, state announcement, and non-color cues.
- Destructive actions default focus to the least-destructive option.
- Tables on narrow screens do not merely shrink font; they convert to summary cards or expose column selection + clear horizontal scroll.
- Icon-only buttons must have an accessible name (`aria-label`).
- Empty / error / loading states must have a readable text explanation, not an icon alone.

---

## 9. States

Every interactive component must implement the relevant subset of: **rest, hover, active, focus, disabled, loading, empty, error**. Each state changes exactly one channel where possible (§6 single-channel rule).

### 9.1 Buttons

| State          | Primary (accent fill)                                                      | Secondary (solid surface + border)                                 | Ghost / Tertiary                            |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| Rest           | bg `--accent`, text `--accent-on`, radius 8px, `--shadow-rest`             | bg `--surface-solid`, border 1px `--border`, text `--text-primary` | bg transparent, text `--text-secondary`     |
| Hover          | bg `--accent-hover`                                                        | bg `--surface-raised`                                              | bg `--accent-subtle`, text `--text-primary` |
| Active / Press | bg `--accent-press`                                                        | border `--border-strong`                                           | bg `--accent-subtle`                        |
| Focus          | 2px `--ring` outline, offset 2px                                           | 2px `--ring` outline                                               | 2px `--ring` outline                        |
| Disabled       | opacity 0.45, cursor `not-allowed`, no hover change                        | same                                                               | same                                        |
| Loading        | bg `--accent`, spinner `--accent-on`, label hidden, button non-interactive | bg `--surface-solid`, spinner `--text-secondary`                   | same as secondary                           |

### 9.2 Inputs (text input, textarea, select trigger)

| State           | Background         | Border                                | Text                                     |
| --------------- | ------------------ | ------------------------------------- | ---------------------------------------- |
| Rest            | `--surface-solid`  | 1px `--border`                        | `--text-primary`                         |
| Hover           | `--surface-solid`  | 1px `--border-strong`                 | `--text-primary`                         |
| Focus           | `--surface-solid`  | 1px `--accent` + 2px `--ring` outline | `--text-primary`                         |
| Filled          | `--surface-solid`  | 1px `--border`                        | `--text-primary`                         |
| Disabled        | `--surface-raised` | 1px `--border`                        | `--text-muted`, cursor `not-allowed`     |
| Error           | `--surface-solid`  | 1px `--danger`                        | `--text-primary`, helper text `--danger` |
| Loading (async) | `--surface-solid`  | 1px `--border`                        | spinner inline, input non-interactive    |

Placeholder text uses `--text-muted`. Helper/error text uses `--typo-caption`.

### 9.3 Cards (resource cards, content sections, list items)

| State             | Border                                               | Background                      | Shadow                           |
| ----------------- | ---------------------------------------------------- | ------------------------------- | -------------------------------- |
| Rest              | 1px `--card-border-rest`                             | `--surface-solid`               | none (border is the separator)   |
| Hover             | 1px `--card-border-hover` (single channel — default) | `--surface-solid`               | none                             |
| Active / Selected | 1px `--accent`                                       | `--accent-subtle`               | none                             |
| Focus             | 1px `--accent` + 2px `--ring` outline                | `--surface-solid`               | none                             |
| Disabled          | 1px `--border`                                       | `--surface-solid`, opacity 0.55 | none                             |
| Loading           | 1px `--border`                                       | `--surface-solid` with skeleton | none                             |
| Empty             | 1px `--border`                                       | `--surface-solid`               | none — show EmptyState component |
| Error             | 1px `--danger`                                       | `--surface-solid`               | none — show ErrorState component |

> Hover changes border-color OR background OR shadow — never more than one. The default is border-color shift.

### 9.4 Tables

| State                  | Row treatment                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Rest                   | Row bg transparent over `--surface-solid`; row separator 1px `--border` (bottom only) |
| Hover                  | Row bg `--surface-raised` (single channel)                                            |
| Selected               | Row bg `--accent-subtle`; left 2px `--accent` inset strip                             |
| Focus (row/row action) | 2px `--ring` outline on the focusable element                                         |
| Loading                | Skeleton rows preserve column widths; no font shrink                                  |
| Empty                  | `EmptyState` in the table body, colspan = full                                        |
| Error                  | `ErrorState` in the table body with retry action                                      |

Narrow screen: tables convert to summary cards or expose column selection + horizontal scroll. Font size is never reduced below `--typo-caption` (12px) to "fit" columns.

### 9.5 Empty / Loading / Error states (shared)

- **EmptyState**: `--typo-h3` title + `--typo-body` description + optional primary action. No illustration larger than 96px. Background `--surface-solid`.
- **LoadingState**: skeleton blocks using `--surface-raised` over `--surface-solid`. No spinner larger than 32px in content area; full-page spinner only on initial route load.
- **ErrorState**: `--typo-h3` title in `--danger` + `--typo-body` description + retry action. No generic "Something went wrong" without a recovery path.

---

## 10. Forbidden Patterns

The following are explicitly forbidden. Any occurrence is a defect blocking merge.

### 10.1 Color & brand

- Blue as the primary button color, login brand color, selected-state color, or focus ring color. Blue is links/informational only.
- Per-business-domain color palettes. There is one accent.
- Hardcoded hex/RGB colors in components. All colors must come from tokens.
- `--glow-orange` / `--glow-orange-strong` applied to content.

### 10.2 Radius

- `rounded-2xl` and any Tailwind radius utility outside the four mapped tiers.
- Arbitrary `rounded-[npx]` / `rounded-[Nrem]`.
- Mixing 4/6/8/10/12/14/16px radii on one page.
- The legacy `--radius-xs: 4px` and `--radius-lg: 10px` tokens.

### 10.3 Elevation & surfaces

- Glow + heavy shadow + transparency + scale + border-color change stacked on one element.
- Multiple stacked shadow layers on a single card.
- Glass on content cards, tables, forms, resource cards, detail sections, or default modals/drawers.
- Glass outside the three permitted locations (top-level nav, command palette, 3D canvas floating controls).
- A fifth surface token.
- `html.theme-glass .x .y` business-component overrides.
- Modal `variant="immersive"` implicitly enabled by a business component.

### 10.4 Typography

- Tailwind arbitrary font sizes (`text-[13px]`, `text-2xl`, …) for page text.
- Scoped `font-size` literals in `<style scoped>` for page text.
- More than one `<h1>` per page.
- Auxiliary text below 12px.
- All headings bold (hierarchy must use size + whitespace, not universal bold).
- `line-clamp` / truncation on descriptive text.

### 10.5 Motion

- `--duration-slow` (400ms) and any duration other than 150ms / 220ms.
- Continuous floating, blinking, pulsing.
- Large-area animated `backdrop-filter` blur.
- Semantic-less `scale()` on hover.
- Spring easing on content UI.
- Motion that does not resolve to static under `prefers-reduced-motion: reduce`.

### 10.6 CSS architecture (from plan §3)

- New global attribute selectors or deep selectors to override UI primitives.
- `html.theme-* .x .y` business-component style penetration. Variants are added via typed props on the primitive, not via external CSS.
- Hardcoded `backdrop-filter`, `z-index`, or arbitrary pixel values outside tokens.
- `!important` to resolve cascade conflicts (resolve via ownership and source order instead).
- New `<style scoped>` blocks that define tokens, primitives, or page patterns — those layers are token / primitive / page-pattern owned.

### 10.7 Modal / Drawer / Form (from plan §2.4)

- Arbitrary width/height props on Modal. Sizes are `sm / md / lg / xl / fullscreen` only.
- Desktop Modal height exceeding `min(720px, calc(100dvh - 48px))`.
- A long Modal carrying complex detail. Detail belongs on its own route; short tasks only in modals.
- Mobile: a cramped centered Modal on a 390px screen. Complex forms become a fullscreen Drawer; short actions become a Bottom Sheet.
- Fullscreen Drawer with non-zero radius (must be 0).
- Left/Right Drawer rounding the viewport-edge corners (only the two exposed corners are 12px).
- Animated `backdrop-filter` blur on the Modal mask. The default mask is a solid color overlay only.

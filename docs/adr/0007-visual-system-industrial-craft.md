# ADR 0007: Visual System — Industrial Craft Workbench

- **Status:** Accepted
- **Date:** 2026-07-11
- **Supersedes:** Legacy values in `src/styles/tokens.css` and `src/styles/themes.css` wherever they conflict (e.g. `--bg-app: #0f1319`, `--duration-base: 250ms`, `--radius-lg: 10px`, `--duration-slow: 400ms`, `--glow-orange`)
- **Related:** `docs/design-foundation.md` (binding spec), `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md` §2.2

## Context

The visual system did not meet the "has a clear design style" goal (plan §2.1). The login page, despite using a dark background, grid, centered card, and blue button, presented a **generic dark SaaS template**:

- The blue primary accent was inconsistent with a Blender/3D-authoring product positioning.
- The grid was purely decorative, not a functional design language.
- Component curvature, shadows, glass usage, and copy hierarchy did not form a **reusable product language**.
- Radius values drifted (4/6/8/10/12/14/16px mixed on a single page).
- Motion had three durations (150/250/400ms) plus spring easing, with continuous floating and pulsing animations.
- Each business domain tended toward its own color palette, and glow + heavy shadow + transparency + scale were stacked on single elements.

The result was a product that looked like many things, not one thing, and performed poorly due to unrestricted glass and large-area animated blur.

## Decision

Adopt the **"Industrial Craft Workbench"** visual direction across the entire product: _precise, restrained, built for long sessions of 3D authoring work._ Not consumer-grade large radii, neon gradients, full-screen frost, or per-domain color palettes.

The system is codified in `docs/design-foundation.md` as the binding single source of truth. Its load-bearing decisions:

1. **Brand color — craft orange.** Single accent `#F07828` (hover `#FF934A`, press `#D9651A`, subtle tint `rgba(240,120,40,0.12)`). It is the only color that may signal primary action, selected state, focus ring, or brand presence. **Blue is only for links and informational affordances** — never the primary button, login brand, selected state, or focus ring.

2. **Four-tier radius.** Only `0` / `6px` / `8px` / `12px`:
   - `0` — full-screen surfaces, full-bleed images, tables, fullscreen drawers.
   - `6px` — small controls (checkboxes, radios, switches, chips).
   - `8px` — inputs, buttons, tags, cards, resource cards, list items.
   - `12px` — detail sections, modals, drawers (exposed corners only), popovers.
   - All other radius values (including Tailwind `rounded-2xl` and arbitrary `rounded-[npx]`) are forbidden.

3. **Two-duration motion.** Only `150ms` (micro feedback) and `220ms` (structural transitions), with `cubic-bezier(0.4, 0, 0.2, 1)` easing. Allowed motion is fade-in and 2–4px displacement. Under `prefers-reduced-motion: reduce`, all durations resolve to `0ms` (fully static). The legacy `400ms` slow duration and spring easing are removed.

4. **Four surface tokens.** `--canvas`, `--surface-solid`, `--surface-raised`, `--surface-overlay` (see ADR 0001). No fifth token. Glass only in the three permitted locations.

5. **Single-channel hover.** A card/element may change **exactly one** channel on hover/active: border-color OR background OR shadow — never several. The default is a border-color shift toward the accent.

6. **Single-layer shadows.** Each shadow token is exactly one `box-shadow` declaration. The default layering mechanism is a 1px semantic border, not shadow. Glow tokens are removed.

7. **Typography.** 14px / 1.55 body. Hierarchy by size + whitespace, not universal bold. Exactly one `<h1>` per page. Minimum auxiliary text 12px. Tailwind arbitrary font sizes and scoped `font-size` literals are forbidden for page text.

## Consequences

**Positive:**

- The product has a single, recognizable visual signature aligned with its 3D-authoring positioning, replacing the generic dark SaaS template.
- The design language is reusable: four radii, two durations, four surfaces, one accent — every component is built from the same small vocabulary.
- Performance improves: no large-area animated blur, no glow stacking, no multi-layer shadows, restricted glass.
- Accessibility is structurally supported: focus ring is the accent (≥3:1 delta), single-channel state changes are easier to perceive, and contrast targets are met per the design-foundation contrast tables.
- The legacy drift (mixed radii, 400ms motion, glow tokens, per-domain palettes) is removed by construction.

**Negative:**

- All existing components must be migrated to the new tokens before shipping; "new/old coexistence" is forbidden by the execution plan, so migration is a prerequisite, not optional.
- Craft orange on white measures ~2.8:1, below the 3:1 non-text-UI threshold — a tracked exception requires primary-button labels to be ≥14px bold and the light-theme button fill to use the press variant `#D9651A`. This is a real constraint that component rebuilds must verify.

**Neutral:**

- The `immersive` glass variant remains available for genuinely immersive surfaces (3D overlays, command palette), so the language is not puritanically solid — it reserves glass for where it has semantic value.

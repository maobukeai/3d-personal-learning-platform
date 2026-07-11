# Signoff Checklist — Frontend Optimization Cycle

> **Cycle:** Industrial Craft Workbench rebuild per `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md`
> **Date:** 2026-07-11
> **Status legend:** ✅ Done · ⏳ In Progress · ❌ Not Started
> **Rule:** No item may be marked ✅ unless it has verifiable evidence (test run, screenshot baseline, CI green, report link). "Looks about right" is not acceptance.

---

## 1. Design Foundation

| Item                                                                | Status | Evidence / Notes                                                                                                                                                    |
| ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design-foundation.md` exists and is binding                   | ✅     | Single source of truth for color, typography, spacing, radius, elevation, motion, surfaces, states, and forbidden patterns. Last updated 2026-07-11.                |
| Tokens migrated: `tokens.css` / `themes.css` legacy values remapped | ⏳     | Legacy `--bg-app: #0f1319`, `--duration-base: 250ms`, `--radius-lg: 10px`, `--duration-slow: 400ms`, `--glow-orange` identified for removal. Migration in progress. |
| `glass.css` legacy removed/migrated                                 | ⏳     | `.glass-dialog`, `.glass-input`, multi-`@supports backdrop-filter`, `html.theme-glass .x .y` overrides slated for deletion per ADR 0001.                            |

---

## 2. Component Catalog (with Story + tests)

Each primitive must have a Storybook story and unit/keyboard tests. Status reflects both implementation and test coverage.

| Component                                                                                                                     | Story | Tests | Status |
| ----------------------------------------------------------------------------------------------------------------------------- | ----- | ----- | ------ |
| Button (primary/secondary/ghost, all §9.1 states)                                                                             | ⏳    | ⏳    | ⏳     |
| Input (text/textarea, all §9.2 states incl. error/loading)                                                                    | ⏳    | ⏳    | ⏳     |
| Select (keyboard: open, initial focus, Tab/Shift+Tab, Escape, focus return)                                                   | ⏳    | ⏳    | ⏳     |
| Tabs                                                                                                                          | ⏳    | ⏳    | ⏳     |
| Table (rest/hover/selected/focus/loading/empty/error; narrow-screen card transform)                                           | ⏳    | ⏳    | ⏳     |
| Modal (`variant="standard"` default solid; `immersive` gated; sizes sm/md/lg/xl/fullscreen; focus trap, Escape, focus return) | ⏳    | ⏳    | ⏳     |
| Drawer (left/right/fullscreen; radius rule; focus behavior)                                                                   | ⏳    | ⏳    | ⏳     |
| Tooltip                                                                                                                       | ⏳    | ⏳    | ⏳     |
| Toast                                                                                                                         | ⏳    | ⏳    | ⏳     |
| EmptyState / LoadingState / ErrorState                                                                                        | ⏳    | ⏳    | ⏳     |

---

## 3. Visual Baselines

Per plan §2.5: 1440×900, 768×1024, 390×844; light/dark themes; six states (loading / empty / error / success / default / filtered-or-selected) per key route.

| Route                              | Light/Dark | 3 Breakpoints | 6 States | Status |
| ---------------------------------- | ---------- | ------------- | -------- | ------ |
| Login / Register / Forgot Password | ⏳         | ⏳            | ⏳       | ⏳     |
| Assets / Materials                 | ⏳         | ⏳            | ⏳       | ⏳     |
| Users / Audits / AI Workbench      | ⏳         | ⏳            | ⏳       | ⏳     |

Signoff requires product + design + engineering co-sign on before/after screenshots. ❌ Not Started until the three sample groups are shot.

---

## 4. API Contract

| Item                                                                                                  | Status | Evidence / Notes                                                          |
| ----------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| OpenAPI / JSON Schema generated from Zod / route definitions                                          | ⏳     | Frontend client and contract tests derive from the same schema (plan §5). |
| Contract tests (frontend ↔ server)                                                                    | ⏳     | ❌ Not Started                                                            |
| Error code catalog (stable, documented)                                                               | ⏳     | ❌ Not Started                                                            |
| Permission matrix (role × action × resource)                                                          | ⏳     | ❌ Not Started                                                            |
| Unified request lifecycle: `AbortController`, error boundary, retry, request ID, stale-response guard | ⏳     | Plan §6.4. ❌ Not Started                                                 |

---

## 5. CI Gates

| Gate                                                                             | Frontend | Server                                 | Status         |
| -------------------------------------------------------------------------------- | -------- | -------------------------------------- | -------------- |
| Lint (strict, `--max-warnings=0`)                                                | ⏳       | ⏳ (38 errors / 351 warnings to clear) | ⏳             |
| Build (type compile only; no `prisma generate` — ADR 0005)                       | ⏳       | ⏳                                     | ⏳             |
| Unit / Integration / E2E tests                                                   | ⏳       | ⏳                                     | ⏳             |
| Bundle budget (login ≤180KB, route ≤300KB, editor ≤550KB, 3D ≤700KB gzip)        | ⏳       | n/a                                    | ❌ Not Started |
| A11y (WCAG 2.2 AA; Playwright keyboard tests per overlay)                        | ⏳       | n/a                                    | ❌ Not Started |
| CSS parser warnings = 0; `!important` = 0 (machine-readable)                     | ⏳       | n/a                                    | ⏳             |
| `--detectOpenHandles` = 0 (no `--forceExit`)                                     | n/a      | ⏳                                     | ⏳             |
| Server CI job: install → generate:client → lint → build → test → schema validate | n/a      | ⏳                                     | ⏳             |

---

## 6. RUM Dashboard

| Metric                                            | Status         |
| ------------------------------------------------- | -------------- |
| LCP / INP / CLS (per route, device tier, network) | ❌ Not Started |
| Long tasks                                        | ❌ Not Started |
| Resource list completion                          | ❌ Not Started |
| 3D first frame                                    | ❌ Not Started |
| Upload completion                                 | ❌ Not Started |
| API p50 / p95 / p99 + error rate                  | ❌ Not Started |
| Queue backlog + worker failure rate               | ❌ Not Started |

---

## 7. Accessibility Report

| Item                                                                            | Status                                                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| WCAG 2.2 AA contrast audit (both themes)                                        | ⏳ (contrast tables in `design-foundation.md` §1.5; per-component verification pending) |
| Focus appearance (≥2px ring, ≥3:1 delta, not obscured)                          | ⏳                                                                                      |
| Modal / Drawer / Dropdown / Select / Tooltip Playwright keyboard tests          | ❌ Not Started                                                                          |
| Drag / kanban / 3D keyboard alternatives + undo + announcement + non-color cues | ❌ Not Started                                                                          |
| Destructive actions focus least-destructive option                              | ❌ Not Started                                                                          |
| Tables narrow-screen → summary card / column select + horizontal scroll         | ❌ Not Started                                                                          |
| Icon-only buttons have `aria-label`                                             | ⏳                                                                                      |
| Empty / error / loading states have readable text explanation                   | ⏳                                                                                      |

---

## 8. Architecture Decision Records

| ADR                                                | Title                                                | Status |
| -------------------------------------------------- | ---------------------------------------------------- | ------ |
| [0001](adr/0001-glass-scope-restriction.md)        | Glass Surface Scope Restriction                      | ✅     |
| [0002](adr/0002-route-state-management.md)         | Route State Management for Details and Complex Flows | ✅     |
| [0003](adr/0003-resource-adapter-pattern.md)       | Resource Adapter Pattern                             | ✅     |
| [0004](adr/0004-3d-lifecycle-management.md)        | 3D / Editor Lifecycle Management                     | ✅     |
| [0005](adr/0005-prisma-generation-strategy.md)     | Prisma Client Generation Strategy                    | ✅     |
| [0006](adr/0006-queue-and-storage-strategy.md)     | Queue and Storage Strategy                           | ✅     |
| [0007](adr/0007-visual-system-industrial-craft.md) | Visual System — Industrial Craft Workbench           | ✅     |

---

## 9. Summary — Completed in This Optimization Cycle

**Specifications and decisions (✅ Done):**

- Authored `docs/design-foundation.md` as the binding design specification: brand color (craft orange `#F07828`), dark/light palettes with WCAG AA contrast tables, typography ladder, 4px spacing scale, four-tier radius (0/6/8/12), single-layer shadows, four surface tokens, two-duration motion (150ms/220ms), focus ring spec, full component state tables (Button/Input/Card/Table/Empty-Loading-Error), and an explicit forbidden-patterns catalog.
- Recorded seven Architecture Decision Records covering: glass scope restriction, route state management, the resource adapter pattern, 3D/editor lifecycle, Prisma generation strategy, queue and storage strategy, and the Industrial Craft Workbench visual direction.

**In progress (⏳):**

- Token migration in `tokens.css` / `themes.css` (legacy values identified, remapping underway).
- Legacy `glass.css` deletion/migration.
- Server lint cleanup (38 errors / 351 warnings) and `--forceExit` removal via unified test teardown.
- Component catalog scaffolding (stories + tests) for the ten primitives.

**Not started (❌):**

- Visual baselines (three sample groups × three breakpoints × two themes × six states).
- API contract generation, contract tests, error-code catalog, permission matrix.
- Bundle budget enforcement, a11y Playwright suite, RUM dashboard.
- Production delivery hardening (immutable artifacts, private source maps, CSP, key-rotation drills).

**Exit criterion:** The optimization cycle is complete only when every item above is ✅ with verifiable evidence, and all CI gates are green on a clean run. Per plan §1, any single failing gate blocks the "architecture optimization complete" declaration.

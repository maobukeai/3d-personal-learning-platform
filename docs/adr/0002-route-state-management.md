# ADR 0002: Route State Management for Details and Complex Flows

- **Status:** Accepted
- **Date:** 2026-07-11
- **Related:** `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md` §4 (Detail & Publishing), §2.4; `docs/design-foundation.md` §10.7; [USWDS Modal Guidance](https://designsystem.digital.gov/components/modal/)

## Context

The detail and editor surfaces had multiple parallel implementations, and complex flows tended to grow into oversized Modal dialogs — the "Dialog giant" anti-pattern. When detail content lived inside a Modal:

- The detail could **not be refreshed** without losing modal state.
- The detail could **not be shared** by URL.
- The detail could **not be backtracked** via browser history.
- Long forms and complex editing were crammed into a centered overlay that broke on narrow screens (a 390px-wide centered Modal is explicitly forbidden).
- Upload cancel, failure retry, and leave-guarding were inconsistent because each flow reimplemented them.

This conflicted with the [USWDS Modal Guidance](https://designsystem.digital.gov/components/modal/) cited as a binding external standard in plan §1: _Modal is for a single, short task; complex editing, long forms, and detail belong on an independent route or Drawer._

## Decision

Adopt three rules for route state and overlay selection:

1. **Detail pages use independent URLs, not Modals.** Any content that a user may want to refresh, share, link to, or navigate back to must live on its own route. Detail/edit/publish flows are route-based.

2. **Modals are only for short, single tasks.** A Modal must address one short interaction (confirm, quick edit, single-field input). Complex editing, long forms, and detail content are forbidden inside a Modal.

3. **Complex flows use Drawers or separate routes.** When a flow is too complex for a Modal but does not warrant a full route, use a Drawer (left/right/fullscreen). Publishing/editing flows are decomposed into discrete stages: schema, upload, preview, permission, submit. Media and model capabilities load **asynchronously** and only when the relevant stage is reached.

**Routing and lifecycle requirements:**

- Detail routes must be refresh-stable, shareable by URL, and back-traversable.
- Upload flows must support cancel, failure retry, and a leave prompt when navigating away with unsaved changes.
- Mobile: complex forms become a fullscreen Drawer (0 radius); short actions become a Bottom Sheet. No cramped centered Modal on narrow screens.

## Consequences

**Positive:**

- Detail content is refreshable, shareable, and back-traversable — the URL is the source of truth for view state.
- The "Dialog giant" anti-pattern is structurally prevented: detail cannot accidentally grow into an oversized Modal.
- Mobile behavior is consistent: complex → fullscreen Drawer, short → Bottom Sheet.
- Upload cancel / retry / leave-guarding are defined once per flow rather than reimplemented.

**Negative:**

- More routes must be defined and guarded; the router config grows.
- Detail pages must manage their own data loading, error, and empty states rather than relying on a parent Modal's context.

**Neutral:**

- Drawers remain available for mid-complexity flows that do not justify a full route, preserving a graduated set of overlay affordances (Modal → Drawer → Route) matched to task complexity.

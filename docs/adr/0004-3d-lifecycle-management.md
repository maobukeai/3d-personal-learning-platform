# ADR 0004: 3D / Editor Lifecycle Management

- **Status:** Accepted
- **Date:** 2026-07-11
- **Related:** `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md` §4 (3D/Editor row), §6 (RUM and bundle budget for 3D)

## Context

The 3D viewer, rich-text editor, and CodeMirror are the heaviest capabilities in the product. Before this decision:

- Heavy resources had a **potential dependency on ordinary pages** — a non-3D route could inadvertently pull 3D modules into its dependency graph, inflating the bundle and risking stray WebGL contexts.
- The 3D and rich-text **lifecycle was not proven**: there was no guarantee that a renderer, Web Worker, or event listener created on entry was disposed on exit.
- VRAM leaks, orphaned workers, and dangling event listeners were realistic failure modes with no test coverage.
- CodeMirror and the editor were loaded eagerly, even on routes that never open an edit action.

This threatened both performance (bundle budget for 3D Viewer routes is ≤700KB gzip, editor routes ≤550KB) and correctness (leaked contexts eventually crash the tab).

## Decision

Adopt four lifecycle rules for 3D and heavy editor capabilities:

1. **Separation of concerns.** The 3D stack is split into four distinct layers:
   - **Renderer** — the WebGL/Three.js render loop and scene graph.
   - **Worker** — off-main-thread work (mesh processing, decoding) via Web Worker.
   - **Loader** — asset/mesh/texture loading, with cancelation.
   - **Overlay** — the HTML floating controls over the canvas (the only place glass is permitted, per ADR 0001).

2. **Viewport-based initialization.** A 3D Renderer initializes **only when its container enters the viewport**, not when the route module is evaluated. Lazy mount + IntersectionObserver gate the creation of the renderer, worker, and loader.

3. **Route-leave disposal.** When the route is left, the renderer, worker, loader, and overlay are explicitly disposed: WebGL context released, worker terminated, listeners removed, loaders canceled. Disposal is verifiable, not best-effort.

4. **Action-triggered import for editors.** The rich-text editor and CodeMirror are dynamically imported **only when the user opens an edit action**, not when the route loads. They are never part of any non-editor route's dependency graph.

## Consequences

**Positive:**

- 3D and editor capabilities do not enter unrelated routes — verified by bundle analysis (3D chunk is isolated; non-3D routes stay within their gzip budget).
- VRAM, worker, and listener leaks are testable: the acceptance criterion is "VRAM, worker, listener leak tests pass."
- Main-thread work is offloaded to workers, keeping the UI responsive during mesh processing.
- Initialization is lazy, so route paint is not blocked by 3D boot.

**Negative:**

- The disposal contract must be implemented and tested for every 3D surface; a missed disposal path regresses to a leak.
- Viewport-gated init introduces a small delay between scroll-into-view and first frame, which must be covered by a loading state (and is a RUM metric: "3D first frame").

**Neutral:**

- The Overlay layer is the designated home for glass surfaces over a 3D canvas, tying this ADR to the glass-scope rule in ADR 0001.

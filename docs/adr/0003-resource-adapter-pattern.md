# ADR 0003: Resource Adapter Pattern as the Single Entry for Resource Domains

- **Status:** Accepted
- **Date:** 2026-07-11
- **Related:** `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md` §4 (Resource domain row)

## Context

The product has multiple resource domains — Assets, Materials, Plugins, Softwares, MyWorks, and ResourceCenter — plus detail and share views for each. Assets and Materials had a basic template, but Plugins, Softwares, MyWorks, ResourceCenter, and the detail/share surfaces had not been unified.

The result was widespread duplication. The same concerns were reimplemented in each domain:

- Filter UI and filter state management.
- Empty state rendering.
- Pagination behavior.
- Permission checks.
- Share flow.
- Mobile responsive behavior (filter Drawer, card layout).

Each domain drifted independently, producing inconsistent UX (different empty states, different pagination, different mobile behavior) and a large maintenance surface. A change to shared behavior (e.g. how an empty state looks) had to be replicated across N domains, and was frequently missed.

## Decision

Establish a single adapter + shell pattern as the **only** entry point for resource domains. Business code provides a schema; the shells provide the behavior.

**The pattern consists of four artifacts:**

| Artifact              | Responsibility                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ResourceAdapter<T>`  | Declares the resource type's field schema, permissions, and action set. Business code implements this; it contains no rendering logic. |
| `ResourceListPage`    | Renders the list (grid/table), filter bar, empty/loading/error states, pagination, and mobile filter Drawer, driven by the adapter.    |
| `ResourceDetailShell` | Renders the detail view (header, content sections, actions, share) driven by the adapter. Lives on its own route per ADR 0002.         |
| `ResourceShareShell`  | Renders the public/share view of a resource, driven by the adapter.                                                                    |

Business domains provide **only** the field/permission/action schema via `ResourceAdapter<T>`. They do not reimplement filtering, empty states, pagination, permissions, share, or mobile behavior.

## Consequences

**Positive:**

- Shared behavior — filtering, empty state, pagination, permissions, share, mobile — is defined once and cannot drift across domains.
- Adding a new resource domain is a schema-authoring task, not a full UI build.
- Visual and interaction consistency is guaranteed by construction, since all domains render through the same shells.
- The acceptance criterion ("the same filter, empty state, pagination, permission, share, and mobile behavior is no longer duplicated") is met by design.

**Negative:**

- The adapter contract must be designed up front and evolved carefully; a schema change affects all domains.
- Domains with genuinely unique needs must negotiate extension points in the shells rather than hand-rolling a one-off page, which can slow highly bespoke features.

**Neutral:**

- The pattern is intentionally narrow: it covers list/detail/share. Domains with behavior outside that scope (e.g. a 3D editor workspace) continue to use their own routes and components, per ADR 0004.

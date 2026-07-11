# ADR 0005: Prisma Client Generation Strategy

- **Status:** Accepted
- **Date:** 2026-07-11
- **Related:** `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md` §5 (Prisma generation lock row), §5 (Backend CI gap row)

## Context

The server build (`server npm run build`) ran `prisma generate` as part of every build invocation. On Windows, this failed at the `prisma generate` stage because the Prisma `query_engine-windows.dll.node` query-engine binary was held open by another process (a running dev server or test process holding the client). The OS returned an `EPERM` (permission) error when Prisma tried to overwrite the locked binary.

The failure was environment-sensitive: it appeared when a dev or test process was running, but not in a clean environment. This made server builds flaky and blocked the "server build is repeatable in the presence of dev/test processes" acceptance criterion.

Worse, there was no clear operational guidance — the build would simply fail with an EPERM traceback, leaving the developer to guess whether to kill processes manually.

## Decision

Remove `prisma generate` from the `build` step and make it an **explicit lifecycle task**.

1. **`build` does only type compilation.** It no longer invokes `prisma generate`. The build step is pure `tsc`/type-check + emit.

2. **`generate:client` is an explicit lifecycle task.** It is run:
   - after `install` (postinstall),
   - in clean CI (before lint/build/test),
   - on demand when the schema has changed.

3. **When the client binary is in use, fail with a clear operational message** instead of an opaque EPERM or auto-killing the holding process. The message tells the developer which process likely holds the file and how to release it (stop dev/test servers, then re-run `generate:client`).

4. **CI runs the lifecycle in order:** `install → generate:client → lint strict → build → test → migration/schema validate`. This sequence is a merge gate, parallel to the frontend job.

## Consequences

**Positive:**

- Server build is repeatable in **both** a clean environment and one with dev/test processes running — no EPERM.
- The build step is fast and pure (type compilation only), with no side effects.
- The schema → client generation is an audited, explicit step, not a hidden side effect of every build.
- The error path is actionable: developers get a human-readable message, not a stack trace.

**Negative:**

- Developers must remember to run `generate:client` after a schema change; forgetting it leads to type drift between schema and client. This is mitigated by postinstall and CI running it automatically.
- CI becomes slightly more steps; the trade-off is correctness and repeatability.

**Neutral:**

- This aligns the server CI gap fix (plan §5) with the build-lock fix: the same `generate:client` task is the bridge between install and lint in the CI pipeline.

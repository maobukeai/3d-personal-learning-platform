# ADR 0006: Queue and Storage Strategy

- **Status:** Accepted
- **Date:** 2026-07-11
- **Related:** `docs/FRONTEND_OPTIMIZATION_EXECUTION_PLAN.md` §5 (test teardown for BullMQ/Redis/Worker), §6 (production delivery: immutable artifacts, S3/R2 minimal permissions, key rotation)

## Context

The platform performs asynchronous work — asset/uploads processing, model decoding, AI workbench jobs — that must survive process restarts, be observable, and be retriable. The server stack already includes BullMQ, Redis, Prisma, Socket, and Worker components (plan §5 lists them as test-teardown targets).

On the storage side, production delivery (plan §6) requires immutable build artifacts, private source-map upload, CSP and security response headers, dependency vulnerability scanning, and **S3/R2 permission minimization with key-rotation drills**. Storage is used for uploaded assets, generated artifacts, and source maps.

The risks being addressed:

- Jobs lost on process crash (in-memory queues).
- Unbounded retry storms.
- Storage credentials with broad write/public access, leaking or destroying data.
- Stale keys with no rotation practice.
- Async handles (Redis/BullMQ/Worker) keeping the test process alive, forcing `--forceExit`.

## Decision

**Queue strategy — BullMQ on Redis:**

1. Use **BullMQ** (backed by **Redis**) as the single queue system for all async work.
2. Jobs are **durable**: they survive process restarts because state lives in Redis, not in process memory.
3. Retries are **bounded and exponential**; dead-letter jobs are retained for inspection, not silently dropped.
4. Each worker is **disposable**: a worker can be stopped and restarted without losing queued jobs.
5. Observability: queue backlog, worker failure rate, and job p50/p95/p99 are RUM/telemetry metrics (plan §6), grouped by job type.

**Storage strategy — S3/R2 with minimal permissions:**

1. Object storage uses **S3 or R2**; the application authenticates via scoped credentials, never root credentials.
2. **Minimal permissions:** the application credential has access only to the buckets/prefixes it needs, with the narrowest read/write/delete actions required. No public-write buckets. Public read, where required, is via a dedicated read-only path or signed URLs, not blanket public access.
3. **Immutable artifacts:** build outputs and source maps are written with immutable semantics (versioned, write-once); source maps are stored privately and never served publicly.
4. **Key rotation drills:** storage credentials are rotated on a schedule, and a rotation drill is rehearsed so the rotation path is proven, not theoretical.
5. **CSP and security headers** are applied at the edge/serving layer, independent of storage.

**Test lifecycle:**

- A unified test teardown closes Fastify, Prisma, Redis, BullMQ, Socket, and Worker handles so the test process exits naturally — `--forceExit` is removed and CI runs with `--detectOpenHandles` until zero open handles remain (plan §5).

## Consequences

**Positive:**

- Async work is durable and observable; a process crash does not lose in-flight jobs.
- Bounded retries prevent retry storms; dead-lettering makes failures inspectable.
- Storage credentials are scoped and rotated, reducing blast radius of a leaked key.
- Immutable artifacts and private source maps align with the production-delivery requirements in plan §6.
- Test processes exit cleanly with zero open handles.

**Negative:**

- Redis becomes a required runtime dependency for the server, not just a cache — its availability and durability must be treated as production-critical.
- Key rotation requires operational discipline and a rehearsed runbook; skipping drills reintroduces stale-key risk.

**Neutral:**

- BullMQ + Redis is the existing stack direction; this ADR codifies the strategy and adds the minimal-permission, rotation, and teardown disciplines rather than introducing new technology.

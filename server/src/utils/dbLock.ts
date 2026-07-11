import { Prisma } from '@prisma/client';

/**
 * The Prisma transaction client — the object passed to the callback of
 * `prisma.$transaction(async (tx) => { ... })`. It exposes every model
 * delegate plus the raw query helpers (`$executeRaw`, `$queryRaw`) but
 * intentionally omits connection/lifecycle methods such as `$connect`,
 * `$disconnect`, `$on`, `$transaction`, `$use` and `$extends`.
 */
export type TransactionClient = Prisma.TransactionClient;

/**
 * Acquire a row-level pessimistic lock (`SELECT ... FOR UPDATE`) on a single
 * row inside a Prisma transaction, then run `fn` with the same transaction
 * client.
 *
 * 铁律六·3 — DB 行级锁。在并发更新同一行（例如用户积分）的场景下，先通过
 * `SELECT ... FOR UPDATE` 锁定目标行，保证后续读写在该事务提交前不会被其他
 * 事务穿插，从而避免 lost update。
 *
 * 必须在 `prisma.$transaction(async (tx) => withRowLock(tx, ...))` 内部调用，
 * 否则 `FOR UPDATE` 不会生效（脱离事务的 SELECT 不会持有行锁）。
 *
 * @param tx     The transaction client from `prisma.$transaction`.
 * @param model  Prisma model name used as the SQL table name (e.g. `'User'`).
 *               Must come from internal callers, not user input.
 * @param id     The primary-key value of the row to lock.
 * @param fn     The work to execute while the row lock is held. Receives the
 *               same `tx` so all writes participate in the same transaction.
 */
export async function withRowLock<T>(
  tx: TransactionClient,
  model: string,
  id: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  // `Prisma.raw(model)` embeds the table name as a raw SQL identifier — this is
  // safe because `model` is a hardcoded/internal constant, never user input.
  // `${id}` is interpolated as a parameterized value, so it is SQL-injection
  // safe even when it originates from request data.
  await tx.$executeRaw`SELECT id FROM ${Prisma.raw(model)} WHERE id = ${id} FOR UPDATE`;
  return fn(tx);
}

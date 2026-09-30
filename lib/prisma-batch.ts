/**
 * createMany() replacement for production (Neon HTTP driver adapter).
 *
 * Prisma executes createMany as a multi-statement transaction on some
 * drivers, and the Neon HTTP adapter throws
 * "Transactions are not supported in HTTP mode" — so every createMany call
 * 500s in production. This inserts rows as individual creates in small
 * parallel chunks instead (the HTTP adapter runs Promise.all batches in
 * parallel; see lib/db.ts). Returns the number of rows inserted.
 *
 * NOTE: unlike createMany, this is not atomic — if a chunk throws, earlier
 * rows stay inserted. Callers that need best-effort semantics should catch.
 */
export async function createManyCompat<T>(
  insert: (data: T) => Promise<unknown>,
  rows: T[],
  chunkSize = 20,
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await Promise.all(chunk.map((data) => insert(data)));
    count += chunk.length;
  }
  return count;
}

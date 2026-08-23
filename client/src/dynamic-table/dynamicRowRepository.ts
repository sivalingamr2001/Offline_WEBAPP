import { db, rowKey } from "../db/database";
import { runSync } from "../sync/syncEngine";

export async function saveRow(
  tableName: string, pk: string | undefined, payload: Record<string, unknown>, allTableNames: string[]
): Promise<string> {
  const id = pk ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await db.transaction("rw", db.rows, db.outbox, async () => {
    const key = rowKey(tableName, id);
    const previous = await db.rows.get(key);
    const operationType: "create" | "update" = previous ? "update" : "create";

    await db.rows.put({
      compositeKey: key, tableName, pk: id, data: { ...payload },
      version: previous?.version ?? 0, deleted: false, syncState: "pending", updatedAtUtc: now
    });

    const existingOutbox = await db.outbox
      .where("[tableName+status]").equals([tableName, "pending"])
      .filter((o) => o.rowPk === id)
      .first();

    if (existingOutbox) {
      await db.outbox.update(existingOutbox.operationId, { payload, occurredAtUtc: now, nextAttemptAtUtc: now, status: "pending" });
    } else {
      await db.outbox.add({
        operationId: crypto.randomUUID(), tableName, rowPk: id, operationType,
        expectedVersion: previous?.version ?? null, payload, occurredAtUtc: now,
        attempts: 0, nextAttemptAtUtc: now, status: "pending"
      });
    }
  });

  void runSync(allTableNames);
  return id;
}

export async function deleteRow(tableName: string, pk: string, allTableNames: string[]): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction("rw", db.rows, db.outbox, async () => {
    const key = rowKey(tableName, pk);
    const existing = await db.rows.get(key);
    if (!existing) return;

    await db.rows.update(key, { deleted: true, syncState: "pending" });
    await db.outbox.add({
      operationId: crypto.randomUUID(), tableName, rowPk: pk, operationType: "delete",
      expectedVersion: existing.version, payload: null, occurredAtUtc: now,
      attempts: 0, nextAttemptAtUtc: now, status: "pending"
    });
  });
  void runSync(allTableNames);
}

export async function resolveConflictKeepLocal(tableName: string, pk: string, allTableNames: string[]): Promise<void> {
  const key = rowKey(tableName, pk);
  const row = await db.rows.get(key);
  if (!row) return;
  await saveRow(tableName, pk, row.data, allTableNames);
}

export async function resolveConflictKeepServer(tableName: string, pk: string, allTableNames: string[]): Promise<void> {
  await db.transaction("rw", db.rows, db.outbox, async () => {
    const stuck = await db.outbox
      .where("[tableName+status]").equals([tableName, "conflict"])
      .filter((o) => o.rowPk === pk)
      .toArray();

    for (const item of stuck) {
      await db.outbox.delete(item.operationId);
    }

    const key = rowKey(tableName, pk);
    await db.rows.update(key, { syncState: "synced" });
  });
  void runSync(allTableNames);
}

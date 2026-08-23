import { db, ensureClientId, rowKey, type OutboxItem } from "../db/database";
import { apiFetch } from "../auth/apiClient";
import { useAuthStore } from "../auth/authStore";

const BATCH_SIZE = 50;
let syncRunning = false;

export async function runSync(tableNames?: string[], options?: { pullOnly?: boolean }): Promise<void> {
  if (syncRunning || !navigator.onLine || !useAuthStore.getState().accessToken) return;
  syncRunning = true;
  try {
    const clientId = await ensureClientId();
    let tablesToSync = tableNames;
    if (!tablesToSync || tablesToSync.length === 0) {
      const outboxItems = await db.outbox.toArray();
      const distinctOutbox = Array.from(new Set(outboxItems.map((o) => o.tableName)));
      const rows = await db.rows.toArray();
      const distinctRows = Array.from(new Set(rows.map((r) => r.tableName)));
      tablesToSync = Array.from(new Set([...distinctOutbox, ...distinctRows]));
    }
    for (const tableName of tablesToSync) {
      if (!options?.pullOnly) {
        await pushTable(clientId, tableName);
      }
      await pullTable(tableName);
    }
  } finally {
    syncRunning = false;
  }
}

async function pushTable(clientId: string, tableName: string): Promise<void> {
  const operations = await db.outbox
    .where("[tableName+status]").equals([tableName, "pending"])
    .filter((item) => item.nextAttemptAtUtc <= new Date().toISOString())
    .limit(BATCH_SIZE)
    .toArray();

  if (operations.length === 0) return;
  await markProcessing(operations);

  const res = await apiFetch("/api/sync/push", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      tableName,
      operations: operations.map((op) => ({
        operationId: op.operationId,
        rowPk: op.rowPk,
        operationType: op.operationType,
        expectedVersion: op.expectedVersion,
        occurredAtUtc: op.occurredAtUtc,
        payload: op.payload
      }))
    })
  });

  if (!res.ok) {
    await releaseForRetry(operations, `Push failed with HTTP ${res.status}`);
    return;
  }

  const body = await res.json();
  await applyPushResults(tableName, body.results);
}

async function applyPushResults(tableName: string, results: any[]): Promise<void> {
  await db.transaction("rw", db.rows, db.outbox, async () => {
    for (const result of results) {
      const item = await db.outbox.get(result.operationId);
      if (!item) continue;

      if (result.status === "accepted") {
        await db.outbox.delete(result.operationId);
        if (result.record) {
          await db.rows.put({
            compositeKey: rowKey(tableName, result.rowPk),
            tableName, pk: result.rowPk, data: result.record,
            version: result.serverVersion ?? 0, deleted: false,
            syncState: "synced", updatedAtUtc: new Date().toISOString()
          });
        }
      } else if (result.status === "conflict") {
        await db.outbox.update(result.operationId, { status: "conflict", lastError: "Server record changed." });
        await db.rows.update(rowKey(tableName, result.rowPk), { syncState: "conflict" });
      } else {
        await db.outbox.update(result.operationId, { status: "failed", lastError: result.message });
        await db.rows.update(rowKey(tableName, result.rowPk), { syncState: "failed" });
      }
    }
  });
}

async function pullTable(tableName: string): Promise<void> {
  const cursorRow = await db.syncMeta.get(`cursor::${tableName}`);
  const cursor = cursorRow ? Number(cursorRow.value) : 0;

  const res = await apiFetch(`/api/sync/pull?tableName=${encodeURIComponent(tableName)}&cursor=${cursor}&limit=200`);
  if (!res.ok) return;
  const payload = await res.json();

  await db.transaction("rw", db.rows, db.syncMeta, async () => {
    for (const change of payload.changes) {
      const key = rowKey(tableName, change.rowPk);
      const local = await db.rows.get(key);
      if (local?.syncState === "pending" || local?.syncState === "conflict") continue;

      if (change.changeType === "deleted") {
        await db.rows.delete(key);
      } else if (change.record) {
        await db.rows.put({
          compositeKey: key, tableName, pk: change.rowPk, data: change.record,
          version: change.record.version ?? 0, deleted: false,
          syncState: "synced", updatedAtUtc: new Date().toISOString()
        });
      }
    }
    await db.syncMeta.put({ key: `cursor::${tableName}`, value: String(payload.nextCursor) });
  });

  if (payload.hasMore) await pullTable(tableName);
}

function nextRetryTime(attempts: number): string {
  return new Date(Date.now() + Math.min(30 * 60_000, 2 ** Math.min(attempts, 10) * 1_000)).toISOString();
}

async function markProcessing(items: OutboxItem[]) {
  await db.transaction("rw", db.outbox, async () => {
    for (const item of items) await db.outbox.update(item.operationId, { status: "processing", attempts: item.attempts + 1 });
  });
}

async function releaseForRetry(items: OutboxItem[], message: string) {
  await db.transaction("rw", db.outbox, async () => {
    for (const item of items) {
      await db.outbox.update(item.operationId, { status: "pending", nextAttemptAtUtc: nextRetryTime(item.attempts), lastError: message });
    }
  });
}

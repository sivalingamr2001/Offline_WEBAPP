import Dexie, { type Table } from "dexie";

export type SyncState = "synced" | "pending" | "conflict" | "failed";

export interface DynamicRow {
  compositeKey: string;   // `${tableName}::${pk}`
  tableName: string;
  pk: string;
  data: Record<string, unknown>;
  version: number;
  deleted: boolean;
  syncState: SyncState;
  updatedAtUtc: string;
}

export interface OutboxItem {
  operationId: string;
  tableName: string;
  rowPk: string;
  operationType: "create" | "update" | "delete";
  expectedVersion: number | null;
  payload: Record<string, unknown> | null;
  occurredAtUtc: string;
  attempts: number;
  nextAttemptAtUtc: string;
  status: "pending" | "processing" | "conflict" | "failed";
  lastError?: string;
}

export interface SyncMeta {
  key: string; // "clientId" | `cursor::${tableName}`
  value: string;
}

class LocalDatabase extends Dexie {
  rows!: Table<DynamicRow, string>;
  outbox!: Table<OutboxItem, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super("portal-offline-db");
    this.version(1).stores({
      rows: "compositeKey, tableName, syncState, [tableName+syncState]",
      outbox: "operationId, tableName, status, nextAttemptAtUtc, [tableName+status]",
      syncMeta: "key"
    });
  }
}

export const db = new LocalDatabase();
export const rowKey = (tableName: string, pk: string) => `${tableName}::${pk}`;

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Safe fallback for non-secure contexts (e.g. testing on LAN IP)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function ensureClientId(): Promise<string> {
  const existing = await db.syncMeta.get("clientId");
  if (existing) return existing.value;
  const id = generateUUID();
  await db.syncMeta.put({ key: "clientId", value: id });
  return id;
}

export async function wipeLocalDatabase(): Promise<void> {
  await db.transaction("rw", db.rows, db.outbox, db.syncMeta, async () => {
    await db.rows.clear();
    await db.outbox.clear();
    await db.syncMeta.clear();
  });
}

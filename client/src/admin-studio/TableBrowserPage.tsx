import { useEffect, useState } from "react";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Settings } from "lucide-react";

interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export default function TableBrowserPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableSearch, setTableSearch] = useState("");
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [pkColumn, setPkColumn] = useState("");
  const [tenantColumn, setTenantColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/connections")
      .then((r) => r.json())
      .then(setConnections);
  }, []);

  useEffect(() => {
    setTableSearch("");
    if (!connectionId) {
      setTables([]);
      setSelectedTable("");
      return;
    }
    apiFetch(`/api/admin/connections/${connectionId}/tables`)
      .then((r) => r.json())
      .then((rows) => setTables(rows.map((t: any) => t.tableName)));
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId || !selectedTable) {
      setColumns([]);
      setPkColumn("");
      setTenantColumn("");
      return;
    }
    apiFetch(`/api/admin/connections/${connectionId}/tables/${selectedTable}/columns`)
      .then((r) => r.json())
      .then((cols: ColumnInfo[]) => {
        setColumns(cols);
        const pk = cols.find((c) => c.isPrimaryKey);
        if (pk) setPkColumn(pk.columnName);
      });
  }, [connectionId, selectedTable]);

  async function enableTable() {
    if (!connectionId || !selectedTable || !pkColumn) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch("/api/admin/sync-tables", {
        method: "POST",
        body: JSON.stringify({
          connectionId,
          tableName: selectedTable,
          primaryKeyColumn: pkColumn,
          tenantColumn: tenantColumn || null,
          allowCreate: true,
          allowUpdate: true,
          allowDelete: true
        })
      });
      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Table "${selectedTable}" successfully configured for offline sync. Select column grid rules next.`
        });
      } else {
        const err = await res.json();
        setStatusMessage({ type: "error", text: err.message ?? "Failed to enable table." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network sync error." });
    } finally {
      setLoading(false);
    }
  }

  const filteredTables = tables.filter((t) => t.toLowerCase().includes(tableSearch.toLowerCase()));

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-200 bg-clip-text text-transparent">Table Introspector</h1>
        <p className="text-zinc-400 text-sm">Select a connection, browse its physical tables, and register them for dynamic sync.</p>
      </div>

      <Card className="glass border-zinc-800">
        <CardHeader>
          <CardTitle>Sync Configuration</CardTitle>
          <CardDescription>Introspect schema parameters from catalog descriptors.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Connection Source</label>
            <Select value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
              <option value="">Select a connection...</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.provider})
                </option>
              ))}
            </Select>
          </div>

          {connectionId && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400">Select Schema Table</label>
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter tables..."
                  className="h-7 w-40 text-xs px-2 py-0 bg-zinc-950 border-zinc-800"
                />
              </div>
              <Select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
                <option value="">Select a table...</option>
                {filteredTables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {columns.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-zinc-800/60 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Primary Key Column</label>
                <Select value={pkColumn} onChange={(e) => setPkColumn(e.target.value)}>
                  {columns.map((c) => (
                    <option key={c.columnName} value={c.columnName}>
                      {c.columnName} ({c.dataType}) {c.isPrimaryKey ? "[Detected PK]" : ""}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Tenant Column (Optional)</label>
                <Select value={tenantColumn} onChange={(e) => setTenantColumn(e.target.value)}>
                  <option value="">None (Global Access)</option>
                  {columns.map((c) => (
                    <option key={c.columnName} value={c.columnName}>
                      {c.columnName}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {statusMessage && (
            <div
              className={`p-3 rounded-md border text-xs font-medium text-center ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-300"
                  : "bg-red-950/20 border-red-900/40 text-red-300"
              }`}
            >
              {statusMessage.text}
            </div>
          )}
        </CardContent>
        {columns.length > 0 && (
          <CardFooter className="border-t border-zinc-800/60 pt-6">
            <Button onClick={enableTable} className="w-full" disabled={loading}>
              <Settings className="h-4 w-4" />
              {loading ? "Registering..." : "Enable Table Sync"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

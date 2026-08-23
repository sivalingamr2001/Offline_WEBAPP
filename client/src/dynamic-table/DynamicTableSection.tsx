import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { db } from "../db/database";
import { fetchGridColumns, type GridColumnConfig } from "./gridColumnConfig";
import { deleteRow, saveRow, resolveConflictKeepLocal, resolveConflictKeepServer } from "./dynamicRowRepository";
import { usePortalManifest } from "../portal/portalRegistry";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Plus, Trash2, Edit2, AlertTriangle, RefreshCw, X, Save } from "lucide-react";
import { runSync } from "../sync/syncEngine";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

function SyncBadge({ state }: { state: string }) {
  let variant: "success" | "warning" | "destructive" | "secondary" = "secondary";
  if (state === "synced") variant = "success";
  else if (state === "pending") variant = "warning";
  else if (state === "conflict" || state === "failed") variant = "destructive";
  return <Badge variant={variant} className="capitalize">{state}</Badge>;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}

export default function DynamicTableSection({ tableName, syncTableId }: { tableName: string; syncTableId: string }) {
  const [columns, setColumns] = useState<GridColumnConfig[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [editingRow, setEditingRow] = useState<{ pk?: string; data: Record<string, any> } | null>(null);
  
  const manifest = usePortalManifest();
  const allTableNames = useMemo(() => manifest?.sections.map((s) => s.tableName) ?? [tableName], [manifest, tableName]);
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    fetchGridColumns(syncTableId).then(setColumns);
  }, [syncTableId]);

  const rows = useLiveQuery(
    () => db.rows.where("tableName").equals(tableName).filter((r) => !r.deleted).toArray(),
    [tableName]
  );

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await runSync(allTableNames);
    } finally {
      setSyncing(false);
    }
  };

  const colDefs = useMemo<ColDef[]>(() => {
    const dataCols: ColDef[] = columns
      .filter((c) => c.isVisible)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => ({
        field: `data.${c.columnName}`,
        headerName: c.displayLabel,
        editable: c.isEditable,
        width: c.width || 150,
        valueGetter: (params) => params.data?.data?.[c.columnName],
        valueSetter: (params) => {
          if (!params.data.data) params.data.data = {};
          params.data.data[c.columnName] = params.newValue;
          return true;
        }
      }));

    return [
      {
        headerName: "Sync Status",
        field: "syncState",
        width: 130,
        cellRenderer: (p: any) => {
          const state = p.value;
          const pk = p.data.pk;
          return (
            <div className="flex flex-col gap-1 py-1">
              <SyncBadge state={state} />
              {state === "conflict" && (
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => resolveConflictKeepLocal(tableName, pk, allTableNames)}
                    className="text-[9px] bg-red-900/60 hover:bg-red-800 text-red-100 px-1 py-0.5 rounded border border-red-800/80 cursor-pointer"
                  >
                    Mine
                  </button>
                  <button
                    onClick={() => resolveConflictKeepServer(tableName, pk, allTableNames)}
                    className="text-[9px] bg-zinc-800 hover:bg-zinc-750 text-zinc-100 px-1 py-0.5 rounded border border-zinc-700 cursor-pointer"
                  >
                    Server
                  </button>
                </div>
              )}
            </div>
          );
        }
      },
      ...dataCols,
      {
        headerName: "",
        width: 80,
        cellRenderer: (p: any) => (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 w-7 p-0"
            onClick={() => deleteRow(tableName, p.data.pk, allTableNames)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )
      }
    ];
  }, [columns, tableName, allTableNames]);

  async function handleCellEdit(pk: string, newData: Record<string, unknown>) {
    await saveRow(tableName, pk, newData, allTableNames);
  }

  function handleSaveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    saveRow(tableName, editingRow.pk, editingRow.data, allTableNames).then(() => {
      setEditingRow(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-200 bg-clip-text text-transparent capitalize">
            {tableName.replace("_", " ")}
          </h1>
          <p className="text-zinc-400 text-sm">Offline sync-enabled business register configuration.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleManualSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync Now
          </Button>
          <Button size="sm" onClick={() => setEditingRow({ data: {} })}>
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      </div>

      {editingRow && (
        <Card className="glass border-zinc-800 max-w-lg mx-auto">
          <form onSubmit={handleSaveForm}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">{editingRow.pk ? "Edit Record" : "Add Record"}</CardTitle>
                <CardDescription>Enter values for configured fields.</CardDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={() => setEditingRow(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {columns
                .filter((c) => c.isVisible && c.isEditable)
                .map((c) => (
                  <div key={c.columnName} className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">{c.displayLabel}</label>
                    <Input
                      value={editingRow.data[c.columnName] ?? ""}
                      onChange={(e) =>
                        setEditingRow((prev) =>
                          prev
                            ? {
                                ...prev,
                                data: { ...prev.data, [c.columnName]: e.target.value }
                              }
                            : null
                        )
                      }
                      type={c.dataType === "number" ? "number" : "text"}
                      placeholder={`Enter ${c.displayLabel}`}
                    />
                  </div>
                ))}
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t border-zinc-800/60 pt-6">
              <Button type="button" variant="outline" onClick={() => setEditingRow(null)}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4" /> Save Record
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {isMobile ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {(!rows || rows.length === 0) ? (
            <div className="sm:col-span-2 text-center text-zinc-500 py-10">
              No entries found. Click "New Entry" to add one.
            </div>
          ) : (
            rows.map((row) => (
              <Card key={row.compositeKey} className="glass border-zinc-800 relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <SyncBadge state={row.syncState} />
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
                        onClick={() => setEditingRow({ pk: row.pk, data: row.data })}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-red-400"
                        onClick={() => deleteRow(tableName, row.pk, allTableNames)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm pt-2">
                  {columns
                    .filter((c) => c.isVisible)
                    .map((c) => (
                      <div key={c.columnName} className="flex justify-between border-b border-zinc-900 pb-1.5">
                        <span className="text-zinc-500 text-xs font-semibold">{c.displayLabel}</span>
                        <span className="text-zinc-200 font-medium">
                          {String(row.data?.[c.columnName] ?? "")}
                        </span>
                      </div>
                    ))}

                  {row.syncState === "conflict" && (
                    <div className="mt-4 border border-red-900/40 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
                        <AlertTriangle className="h-4 w-4 shrink-0" /> Conflict Detected
                      </div>
                      <p className="text-[11px] text-red-300">The server copy contains newer writes.</p>
                      <div className="flex gap-2 mt-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs flex-1"
                          onClick={() => resolveConflictKeepLocal(tableName, row.pk, allTableNames)}
                        >
                          Keep Mine
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-zinc-700 text-zinc-200 flex-1"
                          onClick={() => resolveConflictKeepServer(tableName, row.pk, allTableNames)}
                        >
                          Keep Server
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card className="glass border-zinc-800">
          <CardContent className="p-0">
            <div className="ag-theme-quartz-dark" style={{ height: 500, width: "100%" }}>
              <AgGridReact
                rowData={rows ?? []}
                columnDefs={colDefs}
                getRowId={(p) => p.data.compositeKey}
                onCellValueChanged={(e) => handleCellEdit(e.data.pk, e.data.data)}
                singleClickEdit
                rowHeight={48}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

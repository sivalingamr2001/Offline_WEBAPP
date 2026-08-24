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
import { Checkbox } from "../components/ui/checkbox";
import {
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  RefreshCw,
  X,
  Save,
  Upload,
  Columns,
  Filter,
  Settings,
  Download,
  Search
} from "lucide-react";
import { runPull, runPush } from "../sync/syncEngine";

import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";

import "ag-grid-community/styles/ag-grid.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const myDarkTheme = themeQuartz.withParams({
  accentColor: "#6366f1", // violet-500
  backgroundColor: "#09090b", // zinc-950
  textColor: "#e4e4e7", // zinc-200
  headerBackgroundColor: "#18181b", // zinc-900
  headerTextColor: "#a1a1aa", // zinc-400
  headerFontWeight: 600,
  oddRowBackgroundColor: "#09090b",
  borderColor: "#27272a", // zinc-800
  wrapperBorderRadius: 10,
  rowHoverColor: "#27272a",
});

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
  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>({});
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [editingRow, setEditingRow] = useState<{ pk?: string; data: Record<string, any> } | null>(null);
  
  // Custom Controls State
  const [searchText, setSearchText] = useState("");
  const [density, setDensity] = useState<"compact" | "standard" | "comfortable">("standard");
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [gridApi, setGridApi] = useState<any>(null);

  const manifest = usePortalManifest();
  const allTableNames = useMemo(() => manifest?.sections.map((s) => s.tableName) ?? [tableName], [manifest, tableName]);
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    fetchGridColumns(syncTableId).then((cols) => {
      setColumns(cols);
      const visibility: Record<string, boolean> = {};
      cols.forEach((c) => {
        visibility[c.columnName] = c.isVisible;
      });
      setColVisibility(visibility);
    });
  }, [syncTableId]);

  const rows = useLiveQuery(
    () => db.rows.where("tableName").equals(tableName).filter((r) => !r.deleted).toArray(),
    [tableName]
  );

  const sortedCols = useMemo(() => {
    return [...columns].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [columns]);

  const firstVisibleColName = useMemo(() => {
    const firstVisible = sortedCols.find((c) => colVisibility[c.columnName] !== false);
    return firstVisible?.columnName;
  }, [sortedCols, colVisibility]);

  const handleManualPull = async () => {
    setPulling(true);
    try {
      await runPull(allTableNames);
    } finally {
      setPulling(false);
    }
  };

  const handleManualPush = async () => {
    setPushing(true);
    try {
      await runPush(allTableNames);
    } finally {
      setPushing(false);
    }
  };

  const colDefs = useMemo<ColDef[]>(() => {
    const dataCols: ColDef[] = sortedCols.map((c) => {
      const isFirst = c.columnName === firstVisibleColName;
      return {
        field: `data.${c.columnName}`,
        headerName: c.displayLabel,
        editable: c.isEditable,
        width: c.width || 150,
        hide: colVisibility[c.columnName] === false,
        checkboxSelection: isFirst,
        headerCheckboxSelection: isFirst,
        valueGetter: (params) => params.data?.data?.[c.columnName],
        cellRenderer: c.columnName.toLowerCase() === "status"
          ? (params: any) => {
              const val = params.value;
              if (!val) return "";
              let bg = "bg-zinc-800/40 text-zinc-300 border-zinc-700/50";
              if (val.toLowerCase() === "active" || val.toLowerCase() === "open" || val.toLowerCase() === "synced") {
                bg = "bg-emerald-950/40 text-emerald-300 border-emerald-800/30";
              } else if (val.toLowerCase() === "on leave" || val.toLowerCase() === "pending" || val.toLowerCase() === "progress") {
                bg = "bg-amber-950/40 text-amber-300 border-amber-800/30";
              } else if (val.toLowerCase() === "inactive" || val.toLowerCase() === "closed" || val.toLowerCase() === "failed" || val.toLowerCase() === "delete") {
                bg = "bg-rose-950/40 text-rose-300 border-rose-800/30";
              }
              return `<span class="px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${bg}">${val}</span>`;
            }
          : c.columnName.toLowerCase() === "rating"
            ? (params: any) => {
                const val = Number(params.value) || 0;
                return `<span class="text-amber-500 text-[13px] tracking-wide">${"★".repeat(val) + "☆".repeat(5 - val)}</span>`;
              }
            : undefined,
        valueFormatter: c.dataType === "boolean"
          ? (params) => {
              const val = params.value;
              if (val === true || val === 1 || val === "true" || val === "1") return "True";
              return "False";
            }
          : c.dataType === "number"
            ? (params) => {
                if (params.value == null) return "";
                const isCurrency = c.columnName.toLowerCase().includes("salary") ||
                                   c.columnName.toLowerCase().includes("cost") ||
                                   c.columnName.toLowerCase().includes("price") ||
                                   c.columnName.toLowerCase().includes("amount");
                if (isCurrency) {
                  return "₹" + Number(params.value).toLocaleString("en-IN");
                }
                return Number(params.value).toLocaleString("en-IN");
              }
            : undefined,
        valueSetter: (params) => {
          if (!params.data.data) params.data.data = {};
          let val = params.newValue;
          if (c.dataType === "boolean") {
            val = val === true || val === 1 || String(val).toLowerCase() === "true" || String(val) === "1";
          } else if (c.dataType === "number") {
            val = val !== null && val !== undefined && val !== "" ? Number(val) : null;
          }
          params.data.data[c.columnName] = val;
          return true;
        }
      };
    });

    return [
      {
        headerName: "Sync Status",
        field: "syncState",
        width: 130,
        pinned: "left",
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
                    className="text-[9px] bg-red-900/60 hover:bg-red-800 text-red-100 px-1 py-0.5 rounded border border-red-800/80 cursor-pointer animate-pulse"
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
        headerName: "Actions",
        width: 100,
        pinned: "right",
        cellRenderer: (p: any) => (
          <div className="flex gap-2 items-center h-full py-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 border-zinc-750 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              onClick={() => setEditingRow({ pk: p.data.pk, data: { ...p.data.data } })}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 w-7 p-0 cursor-pointer"
              onClick={() => deleteRow(tableName, p.data.pk, allTableNames)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      }
    ];
  }, [sortedCols, firstVisibleColName, colVisibility, tableName, allTableNames]);

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

  const rowHeight = useMemo(() => {
    const heights = { compact: 32, standard: 44, comfortable: 56 };
    return heights[density];
  }, [density]);

  function toggleColumn(columnName: string) {
    setColVisibility((prev) => ({
      ...prev,
      [columnName]: !prev[columnName],
    }));
  }

  function handleColumnFilterChange(columnName: string, value: string) {
    const nextFilters = { ...columnFilters, [columnName]: value };
    if (!value) delete nextFilters[columnName];
    setColumnFilters(nextFilters);

    const filterModel: Record<string, any> = {};
    Object.entries(nextFilters).forEach(([colName, filterVal]) => {
      const col = columns.find((c) => c.columnName === colName);
      if (!col) return;

      if (col.dataType === "date") {
        filterModel[`data.${colName}`] = {
          filterType: "date",
          type: "equals",
          dateFrom: filterVal
        };
      } else if (col.dataType === "number") {
        filterModel[`data.${colName}`] = {
          filterType: "number",
          type: "equals",
          filter: Number(filterVal)
        };
      } else if (col.dataType === "boolean") {
        filterModel[`data.${colName}`] = {
          filterType: "text",
          type: "equals",
          filter: filterVal === "true" ? "True" : "False"
        };
      } else {
        filterModel[`data.${colName}`] = {
          filterType: "text",
          type: "contains",
          filter: filterVal
        };
      }
    });

    gridApi?.setFilterModel(filterModel);
  }

  function resetFilters() {
    setSearchText("");
    setColumnFilters({});
    gridApi?.setFilterModel(null);
    gridApi?.setGridOption("quickFilterText", "");
  }

  const exportCsv = () => {
    gridApi?.exportDataAsCsv({ fileName: `${tableName}-export-${Date.now()}.csv` });
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    const confirmMsg = selectedRows.length === 1
      ? "Delete the selected record? This cannot be undone."
      : `Delete the ${selectedRows.length} selected records? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      for (const r of selectedRows) {
        await deleteRow(tableName, r.pk, allTableNames);
      }
      setSelectedRows([]);
      gridApi?.deselectAll();
    } catch (err) {
      console.error("Bulk delete failed", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-200 bg-clip-text text-transparent capitalize">
              {tableName.replace(/_TEST$/, "").replace(/_/g, " ")}
            </h1>
            <p className="text-zinc-400 text-sm">Offline sync-enabled business register configurations.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleManualPull} disabled={pulling || pushing} className="cursor-pointer border-zinc-800 hover:bg-zinc-900">
              <RefreshCw className={`h-4 w-4 mr-1 ${pulling ? "animate-spin" : ""}`} />
              Sync Now
            </Button>
            <Button variant="outline" size="sm" onClick={handleManualPush} disabled={pulling || pushing} className="cursor-pointer border-zinc-800 hover:bg-zinc-900">
              <Upload className={`h-4 w-4 mr-1 ${pushing ? "animate-bounce" : ""}`} />
              Push Changes
            </Button>
            <Button size="sm" onClick={() => setEditingRow({ data: {} })} className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white border-0">
              <Plus className="h-4 w-4 mr-1" />
              New Entry
            </Button>
            <Button variant="destructive" size="sm" disabled={selectedRows.length === 0} onClick={handleBulkDelete} className="cursor-pointer">
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected {selectedRows.length > 0 ? `(${selectedRows.length})` : ""}
            </Button>
          </div>
        </div>

        {/* Directory Controls Toolbar */}
        {!isMobile && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/80 backdrop-blur-sm">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Quick search all records..."
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  gridApi?.setGridOption("quickFilterText", e.target.value);
                }}
                className="pl-9 h-9 bg-zinc-950/60 border-zinc-800 focus:border-zinc-700 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Panel Dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                  className={`h-9 border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs cursor-pointer ${filterMenuOpen ? "bg-zinc-900" : ""}`}
                >
                  <Filter className="h-3.5 w-3.5 mr-1" /> Filters
                </Button>
                {filterMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-lg p-3 shadow-xl z-50 flex flex-col gap-2" onMouseLeave={() => setFilterMenuOpen(false)}>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 mb-1">Filter Columns</div>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                      {sortedCols.map((c) => (
                        <div className="grid grid-cols-[100px_1fr] items-center gap-2 px-1 py-1" key={c.columnName}>
                          <span className="text-xs text-zinc-400 font-semibold truncate" title={c.displayLabel}>
                            {c.displayLabel}
                          </span>
                          {c.dataType === "boolean" ? (
                            <select
                              value={columnFilters[c.columnName] || ""}
                              onChange={(e) => handleColumnFilterChange(c.columnName, e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 text-xs py-1 px-2 rounded text-zinc-200 outline-none w-full focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="">All</option>
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          ) : (
                            <input
                              type={c.dataType === "date" ? "date" : c.dataType === "number" ? "number" : "text"}
                              value={columnFilters[c.columnName] || ""}
                              onChange={(e) => handleColumnFilterChange(c.columnName, e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 text-xs py-1 px-2 rounded text-zinc-200 outline-none w-full focus:border-indigo-500"
                              placeholder={`Filter...`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-zinc-800 pt-2 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-zinc-400 hover:bg-zinc-900 h-7 px-2">
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Show / Hide Columns Dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColMenuOpen(!colMenuOpen)}
                  className={`h-9 border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs cursor-pointer ${colMenuOpen ? "bg-zinc-900" : ""}`}
                >
                  <Columns className="h-3.5 w-3.5 mr-1" /> Columns
                </Button>
                {colMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-lg p-3 shadow-xl z-50 flex flex-col gap-1 max-h-72 overflow-y-auto" onMouseLeave={() => setColMenuOpen(false)}>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 mb-1">Show/Hide Columns</div>
                    {sortedCols.map((c) => (
                      <label key={c.columnName} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-zinc-900 text-xs text-zinc-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={colVisibility[c.columnName] !== false}
                          onChange={() => toggleColumn(c.columnName)}
                          className="rounded border-zinc-800 text-indigo-600 bg-zinc-900 focus:ring-0"
                        />
                        {c.displayLabel}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Table Settings Dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                  className={`h-9 border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs cursor-pointer ${settingsMenuOpen ? "bg-zinc-900" : ""}`}
                >
                  <Settings className="h-3.5 w-3.5 mr-1" /> Settings
                </Button>
                {settingsMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-lg p-3 shadow-xl z-50 flex flex-col gap-3" onMouseLeave={() => setSettingsMenuOpen(false)}>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">Grid Density</div>
                    <div className="flex border border-zinc-850 rounded-md overflow-hidden text-xs">
                      {(["compact", "standard", "comfortable"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDensity(d)}
                          className={`flex-1 py-1.5 font-medium border-r last:border-0 border-zinc-850 transition-colors ${
                            density === d ? "bg-indigo-600 text-white animate-fade-in" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-zinc-800 pt-2 flex justify-between gap-2">
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs flex-1 hover:bg-zinc-900 text-zinc-400">
                        Reset Filters
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportCsv} className="text-xs flex-1 border-zinc-800 hover:bg-zinc-900 text-zinc-200">
                        <Download className="h-3 w-3 mr-1" /> Export CSV
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setEditingRow(null)} />
          <Card className="glass border-zinc-800 w-full max-w-lg shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveForm}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-lg">{editingRow.pk ? "Edit Record" : "Add Record"}</CardTitle>
                  <CardDescription>Enter values for configured fields.</CardDescription>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 cursor-pointer" onClick={() => setEditingRow(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
                {columns
                  .filter((c) => c.isVisible && c.isEditable)
                  .map((c) => (
                    <div key={c.columnName} className="space-y-1.5">
                      {c.dataType === "boolean" ? (
                        <div className="flex items-center gap-2 py-1.5">
                          <Checkbox
                            id={`field-${c.columnName}`}
                            checked={
                              editingRow.data[c.columnName] === true ||
                              editingRow.data[c.columnName] === 1 ||
                              String(editingRow.data[c.columnName]).toLowerCase() === "true" ||
                              String(editingRow.data[c.columnName]) === "1"
                            }
                            onChange={(e: any) =>
                              setEditingRow((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      data: { ...prev.data, [c.columnName]: e.target.checked }
                                    }
                                  : null
                              )
                            }
                          />
                          <label htmlFor={`field-${c.columnName}`} className="text-sm font-semibold text-zinc-300 cursor-pointer select-none">
                            {c.displayLabel}
                          </label>
                        </div>
                      ) : (
                        <>
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
                            className="bg-zinc-950/60 border-zinc-800 focus:border-zinc-700 text-zinc-200"
                          />
                        </>
                      )}
                    </div>
                  ))}
              </CardContent>
              <CardFooter className="flex justify-end gap-2 border-t border-zinc-800/60 pt-6">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setEditingRow(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white border-0">
                  <Save className="h-4 w-4 mr-1" /> Save Record
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
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
                        className="h-8 w-8 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        onClick={() => setEditingRow({ pk: row.pk, data: row.data })}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-red-400 cursor-pointer"
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
                    .map((c) => {
                      const rawVal = row.data?.[c.columnName];
                      let displayVal = String(rawVal ?? "");
                      if (c.dataType === "boolean") {
                        displayVal = (rawVal === true || rawVal === 1 || String(rawVal).toLowerCase() === "true" || String(rawVal) === "1") ? "True" : "False";
                      } else if (c.dataType === "number" && rawVal != null) {
                        const isCurrency = c.columnName.toLowerCase().includes("salary") ||
                                           c.columnName.toLowerCase().includes("cost") ||
                                           c.columnName.toLowerCase().includes("price") ||
                                           c.columnName.toLowerCase().includes("amount");
                        displayVal = isCurrency ? "₹" + Number(rawVal).toLocaleString("en-IN") : Number(rawVal).toLocaleString("en-IN");
                      }
                      
                      return (
                        <div key={c.columnName} className="flex justify-between border-b border-zinc-900 pb-1.5 last:border-0 last:pb-0">
                          <span className="text-zinc-500 text-xs font-semibold">{c.displayLabel}</span>
                          {c.columnName.toLowerCase() === "status" ? (
                            <span dangerouslySetInnerHTML={{
                              __html: (() => {
                                const val = String(rawVal ?? "");
                                let bg = "bg-zinc-800/40 text-zinc-300 border-zinc-700/50";
                                if (val.toLowerCase() === "active" || val.toLowerCase() === "open" || val.toLowerCase() === "synced") {
                                  bg = "bg-emerald-950/40 text-emerald-300 border-emerald-800/30";
                                } else if (val.toLowerCase() === "on leave" || val.toLowerCase() === "pending" || val.toLowerCase() === "progress") {
                                  bg = "bg-amber-950/40 text-amber-300 border-amber-800/30";
                                } else if (val.toLowerCase() === "inactive" || val.toLowerCase() === "closed" || val.toLowerCase() === "failed" || val.toLowerCase() === "delete") {
                                  bg = "bg-rose-950/40 text-rose-300 border-rose-800/30";
                                }
                                return `<span class="px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${bg}">${val}</span>`;
                              })()
                            }} />
                          ) : c.columnName.toLowerCase() === "rating" ? (
                            <span className="text-amber-500 text-[13px] tracking-wide">
                              {"★".repeat(Number(rawVal) || 0) + "☆".repeat(5 - (Number(rawVal) || 0))}
                            </span>
                          ) : (
                            <span className="text-zinc-200 font-medium">{displayVal}</span>
                          )}
                        </div>
                      );
                    })}

                  {row.syncState === "conflict" && (
                    <div className="mt-4 border border-red-900/40 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2 animate-pulse">
                      <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
                        <AlertTriangle className="h-4 w-4 shrink-0" /> Conflict Detected
                      </div>
                      <p className="text-[11px] text-red-300">The server copy contains newer writes.</p>
                      <div className="flex gap-2 mt-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs flex-1 cursor-pointer"
                          onClick={() => resolveConflictKeepLocal(tableName, row.pk, allTableNames)}
                        >
                          Keep Mine
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-zinc-700 text-zinc-200 flex-1 cursor-pointer"
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
        <Card className="glass border-zinc-800 overflow-hidden">
          <CardContent className="p-0">
            <div style={{ height: 530, width: "100%" }}>
              <AgGridReact
                theme={myDarkTheme}
                rowData={rows ?? []}
                columnDefs={colDefs}
                getRowId={(p) => p.data.compositeKey}
                onCellValueChanged={(e) => handleCellEdit(e.data.pk, e.data.data)}
                singleClickEdit
                rowHeight={rowHeight}
                rowSelection={{
                  mode: "multiRow",
                  checkboxes: true,
                  headerCheckbox: true,
                  enableClickSelection: false,
                }}
                onSelectionChanged={(e) => {
                  setSelectedRows(e.api.getSelectedRows());
                }}
                onGridReady={(params) => setGridApi(params.api)}
                pagination
                paginationPageSize={50}
                animateRows
                ensureDomOrder
                enableCellTextSelection
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

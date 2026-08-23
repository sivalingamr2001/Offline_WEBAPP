import { useEffect, useState } from "react";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Save, RefreshCw } from "lucide-react";

interface Row {
  columnName: string;
  displayLabel: string;
  dataType: string;
  isVisible: boolean;
  isEditable: boolean;
  displayOrder: number;
  width?: number;
}

export default function GridColumnEditorPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/admin/sync-tables")
      .then((r) => r.json())
      .then(setTables);
  }, []);

  useEffect(() => {
    if (!selectedTableId) {
      setRows([]);
      return;
    }
    setLoading(true);
    // Fetch schema columns directly from introspection to populate config rows
    // Wait, the API endpoint is GET /api/admin/grid-columns/{syncTableId}
    apiFetch(`/api/admin/grid-columns/${selectedTableId}`)
      .then((r) => r.json())
      .then((existing: Row[]) => {
        if (existing.length > 0) {
          setRows(existing);
          setLoading(false);
        } else {
          // If no columns configured yet, we can introspect the columns of that table to populate defaults!
          // Let's find table object
          const tableObj = tables.find((t) => t.id === selectedTableId);
          if (tableObj) {
            apiFetch(`/api/admin/connections/${tableObj.connectionId}/tables/${tableObj.tableName}/columns`)
              .then((r) => r.json())
              .then((cols: any[]) => {
                const defaults = cols.map((c, index) => ({
                  columnName: c.columnName,
                  displayLabel: c.columnName,
                  dataType: mapDataType(c.dataType),
                  isVisible: true,
                  isEditable: !c.isPrimaryKey,
                  displayOrder: (index + 1) * 10,
                  width: 150
                }));
                setRows(defaults);
                setLoading(false);
              })
              .catch(() => setLoading(false));
          } else {
            setLoading(false);
          }
        }
      })
      .catch(() => setLoading(false));
  }, [selectedTableId, tables]);

  function mapDataType(rawType: string): string {
    const type = rawType.toLowerCase();
    if (type.includes("int") || type.includes("num") || type.includes("float") || type.includes("double") || type.includes("real")) {
      return "number";
    }
    if (type.includes("bool")) {
      return "boolean";
    }
    if (type.includes("date") || type.includes("time")) {
      return "date";
    }
    return "string";
  }

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    if (!selectedTableId) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/grid-columns/${selectedTableId}`, {
        method: "PUT",
        body: JSON.stringify(rows)
      });
      if (res.ok) {
        alert("Column grid layout configuration saved successfully.");
      }
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-200 bg-clip-text text-transparent">Column Grid Editor</h1>
        <p className="text-zinc-400 text-sm">Define custom display labels, visibilities, types, and constraints on your synced grids.</p>
      </div>

      <Card className="glass border-zinc-800">
        <CardHeader>
          <CardTitle>Display Mapping Settings</CardTitle>
          <CardDescription>Customize grid parameters without redeploying code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5 max-w-xs">
            <label className="text-xs font-semibold text-zinc-400">Target Table</label>
            <Select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}>
              <option value="">Select a table...</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tableName}
                </option>
              ))}
            </Select>
          </div>

          {loading && (
            <div className="py-10 text-center text-zinc-400 flex items-center justify-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 animate-spin" /> Fetching columns list...
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900/50 text-zinc-400 border-b border-zinc-800/80 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Column</th>
                    <th className="px-4 py-3">Display Label</th>
                    <th className="px-4 py-3">Data Type</th>
                    <th className="px-4 py-3 text-center">Visible</th>
                    <th className="px-4 py-3 text-center">Editable</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Width (px)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {rows.map((row, i) => (
                    <tr key={row.columnName} className="hover:bg-zinc-850/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-zinc-300 text-xs">{row.columnName}</td>
                      <td className="px-4 py-3">
                        <Input
                          value={row.displayLabel}
                          onChange={(e) => update(i, { displayLabel: e.target.value })}
                          className="h-8 bg-zinc-950 border-zinc-800 text-xs w-48"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={row.dataType}
                          onChange={(e) => update(i, { dataType: e.target.value })}
                          className="h-8 bg-zinc-950 border-zinc-800 text-xs py-0 w-32"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="date">Date</option>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Checkbox
                          checked={row.isVisible}
                          onChange={(e: any) => update(i, { isVisible: e.target.checked })}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Checkbox
                          checked={row.isEditable}
                          onChange={(e: any) => update(i, { isEditable: e.target.checked })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          value={row.displayOrder}
                          onChange={(e) => update(i, { displayOrder: Number(e.target.value) })}
                          className="h-8 bg-zinc-950 border-zinc-800 text-xs w-16"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          value={row.width ?? ""}
                          onChange={(e) => update(i, { width: Number(e.target.value) || undefined })}
                          className="h-8 bg-zinc-950 border-zinc-800 text-xs w-20"
                          placeholder="Auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {rows.length > 0 && (
          <CardFooter className="border-t border-zinc-800/60 pt-6">
            <Button onClick={handleSave} className="w-full" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving Changes..." : "Save Config Details"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

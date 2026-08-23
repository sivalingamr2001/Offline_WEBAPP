import { useEffect, useState } from "react";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Navigation } from "lucide-react";

export default function PortalSectionsPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [syncTableId, setSyncTableId] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sectionKey, setSectionKey] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("clipboard-list");
  const [route, setRoute] = useState("");
  const [rolesCsv, setRolesCsv] = useState("admin,planner,supervisor");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/admin/sync-tables")
      .then((r) => r.json())
      .then(setTables);
  }, []);

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!syncTableId || !sectionKey || !label || !route) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/portal-sections", {
        method: "POST",
        body: JSON.stringify({
          syncTableId,
          sectionKey,
          label,
          icon,
          route,
          displayOrder: 100,
          rolesCsv
        })
      });
      if (res.ok) {
        setSyncTableId("");
        setSectionKey("");
        setLabel("");
        setRoute("");
        alert(`Portal Section "${label}" created successfully. Changes will display in sidebar on reload.`);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  const filteredTables = tables.filter((t) => t.tableName.toLowerCase().includes(tableSearch.toLowerCase()));

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-200 bg-clip-text text-transparent">Portal Section Bindings</h1>
        <p className="text-zinc-400 text-sm">Add navigation entries and bind them to your synced offline tables with security role access.</p>
      </div>

      <Card className="glass border-zinc-800">
        <form onSubmit={handleAddSection}>
          <CardHeader>
            <CardTitle>Dynamic Nav Mapping</CardTitle>
            <CardDescription>Setup navigation routing parameters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400">Target Sync Table</label>
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter tables..."
                  className="h-7 w-40 text-xs px-2 py-0 bg-zinc-950 border-zinc-800"
                />
              </div>
              <Select value={syncTableId} onChange={(e) => setSyncTableId(e.target.value)} required>
                <option value="">Select a table...</option>
                {filteredTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tableName}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Section Unique Key</label>
              <Input
                value={sectionKey}
                onChange={(e) => setSectionKey(e.target.value)}
                placeholder="e.g. work-orders"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Navigation Label</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Work Orders"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Icon Name (lucide-react)</label>
              <Select value={icon} onChange={(e) => setIcon(e.target.value)} required>
                <option value="clipboard-list">Clipboard List</option>
                <option value="check-circle">Check Circle</option>
                <option value="users">Users</option>
                <option value="database">Database</option>
                <option value="settings">Settings</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Client Route</label>
              <Input
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g. /work-orders"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Allowed User Roles (comma-separated)</label>
              <Input
                value={rolesCsv}
                onChange={(e) => setRolesCsv(e.target.value)}
                placeholder="admin,planner,supervisor"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="border-t border-zinc-800/60 pt-6">
            <Button type="submit" className="w-full" disabled={loading}>
              <Navigation className="h-4 w-4" />
              {loading ? "Adding..." : "Add Navigation Link"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

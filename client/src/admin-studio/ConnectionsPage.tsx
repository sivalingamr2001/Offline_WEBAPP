import { useEffect, useState } from "react";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Database, Plus, RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface Connection {
  id: string;
  name: string;
  provider: string;
  connectionString: string;
  isActive: boolean;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    try {
      const res = await apiFetch("/api/admin/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch {}
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !connectionString) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/connections", {
        method: "POST",
        body: JSON.stringify({ name, connectionString })
      });
      if (res.ok) {
        setName("");
        setConnectionString("");
        await fetchConnections();
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const res = await apiFetch(`/api/admin/connections/${id}/test`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setTestResults((prev) => ({
          ...prev,
          [id]: { success: data.success, error: data.error }
        }));
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, error: "Network error." }
      }));
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-200 bg-clip-text text-transparent">Database Connections</h1>
        <p className="text-zinc-400 text-sm">Register and test external ERP / business databases to target for no-code introspection.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <Card className="glass border-zinc-800 md:col-span-1">
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle className="text-lg">Add Connection</CardTitle>
              <CardDescription>Setup SQLite or Oracle data source.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Connection Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Oracle ERP Staging"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Connection String</label>
                <textarea
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="Data Source=... or User Id=..."
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-zinc-900/50 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus:border-primary/50 text-zinc-100 font-mono"
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                <Plus className="h-4 w-4" />
                {loading ? "Saving..." : "Add Connection"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="glass border-zinc-800 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Active Connections</CardTitle>
            <CardDescription>Target databases registered inside the workstation.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {connections.length === 0 ? (
              <div className="p-10 text-center text-zinc-500 text-sm">
                No connections registered. Register one to introspect schemas.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {connections.map((c) => (
                  <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary shrink-0" />
                        <h4 className="font-semibold text-zinc-200 truncate">{c.name}</h4>
                        <Badge variant="secondary" className="capitalize text-[10px] py-0">
                          {c.provider}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono truncate">{c.connectionString}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {testResults[c.id] && (
                        <div className="flex items-center gap-1.5 text-xs">
                          {testResults[c.id].success ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" /> Connected
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1" title={testResults[c.id].error}>
                              <XCircle className="h-3.5 w-3.5" /> Failed
                            </span>
                          )}
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(c.id)}
                        disabled={testingId === c.id}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${testingId === c.id ? "animate-spin" : ""}`} />
                        Test
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

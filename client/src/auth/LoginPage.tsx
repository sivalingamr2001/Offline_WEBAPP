import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./authStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Shield } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000";

export default function LoginPage() {
  const [tenantId, setTenantId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, username, password })
      });
      if (!res.ok) {
        setError("Invalid tenant, username, or password.");
        return;
      }
      const data = await res.json();
      setSession(data.accessToken, data.displayName, data.roles);
      navigate("/", { replace: true });
    } catch {
      setError("Cannot connect to server. Check connectivity.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-violet-600/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-indigo-600/10 blur-[80px] pointer-events-none" />

      <Card className="w-full max-w-md glass border-zinc-800 shadow-2xl relative z-10">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 mx-auto shadow-inner shadow-primary/20">
              <Shield className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-transparent">
              Manufacturing Portal
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Enter your credentials to access the offline sync workstation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Tenant ID</label>
              <Input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="e.g. TENANT_A"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="bg-red-950/30 border border-red-900/40 text-red-200 text-xs p-3 rounded-md text-center font-medium">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign In"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

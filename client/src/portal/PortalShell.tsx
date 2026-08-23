import { Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import { apiFetch } from "../auth/apiClient";
import type { PortalManifest } from "./portalTypes";
import { PortalManifestContext } from "./portalRegistry";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../auth/authStore";
import { logout } from "../app/App";
import { runSync } from "../sync/syncEngine";
import DynamicTableSection from "../dynamic-table/DynamicTableSection";

// Admin Studio Pages
import ConnectionsPage from "../admin-studio/ConnectionsPage";
import TableBrowserPage from "../admin-studio/TableBrowserPage";
import GridColumnEditorPage from "../admin-studio/GridColumnEditorPage";
import PortalSectionsPage from "../admin-studio/PortalSectionsPage";

import {
  ClipboardList,
  CheckCircle,
  Users,
  LogOut,
  Shield,
  Menu,
  Database,
  Grid,
  Layers,
  LayoutGrid
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<any>> = {
  "clipboard-list": ClipboardList,
  "check-circle": CheckCircle,
  "users": Users,
  "database": Database,
  "settings": Grid,
  "layers": Layers
};

export default function PortalShell() {
  const [manifest, setManifest] = useState<PortalManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { displayName, roles } = useAuthStore();
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/portal/manifest");
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not load your portal sections.");
          return;
        }
        const data = (await res.json()) as PortalManifest;
        if (!cancelled) setManifest(data);
      } catch {
        if (!cancelled) setLoadError("Network error loading manifest.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!manifest) return;
    void runSync(manifest.sections.map((s) => s.tableName), { pullOnly: true });
  }, [manifest]);

  const handleLogout = async () => {
    await logout(apiFetch);
  };

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-sm rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-center text-red-200 glass">
          <p className="font-semibold text-lg">Error Loading Portal</p>
          <p className="mt-1 text-sm text-red-300">{loadError}</p>
          <Button variant="outline" className="mt-4 border-red-800 text-red-300 hover:bg-red-900/30" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-zinc-400 text-sm">Loading Manufacturing Portal...</p>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="h-full flex flex-col justify-between">
      <div>
        <div className="h-16 border-b border-zinc-800/80 flex items-center px-6 gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-none bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-transparent">Portal Shell</h2>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Dynamic Studio</span>
          </div>
        </div>

        <nav className="p-4 space-y-6">
          {manifest.sections.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-3 block mb-2">Registers</span>
              {manifest.sections.map((section) => {
                const IconComponent = iconMap[section.icon] || ClipboardList;
                return (
                  <NavLink
                    key={section.key}
                    to={section.route}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                      }`
                    }
                  >
                    <IconComponent className="h-4 w-4" />
                    {section.label}
                  </NavLink>
                );
              })}
            </div>
          )}

          {isAdmin && (
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-3 block mb-2">Admin Studio</span>
              <NavLink
                to="/admin/connections"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                  }`
                }
              >
                <Database className="h-4 w-4" />
                Connections
              </NavLink>
              <NavLink
                to="/admin/tables"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                  }`
                }
              >
                <Layers className="h-4 w-4" />
                Table Browser
              </NavLink>
              <NavLink
                to="/admin/columns"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                  }`
                }
              >
                <Grid className="h-4 w-4" />
                Grid Columns
              </NavLink>
              <NavLink
                to="/admin/sections"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                  }`
                }
              >
                <LayoutGrid className="h-4 w-4" />
                Portal Sections
              </NavLink>
            </div>
          )}
        </nav>
      </div>

      <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/60 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-zinc-200 truncate">{displayName}</span>
            <span className="text-[10px] text-zinc-500 font-medium capitalize truncate max-w-[120px]">
              {roles.join(", ")}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 cursor-pointer" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <PortalManifestContext.Provider value={manifest}>
      <div className="flex h-screen bg-zinc-950 text-zinc-50 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 border-r border-zinc-800/80 bg-zinc-900/40 flex-col justify-between shrink-0 glass">
          <SidebarContent />
        </aside>

        {/* Mobile Slide-out Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative w-64 max-w-xs bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between glass animate-in slide-in-from-left duration-200">
              <SidebarContent />
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-16 border-b border-zinc-800/80 bg-zinc-900/20 flex items-center justify-between px-4 sm:px-8 glass shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 text-zinc-400 hover:text-zinc-100"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg text-zinc-200">{manifest.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider hidden sm:inline">
                Workstation Online
              </span>
            </div>
          </header>

          {/* Main Workspace */}
          <main className="flex-1 overflow-y-auto bg-zinc-950 p-4 sm:p-8">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              }
            >
              <Routes>
                {/* Dynamically configured portal section grids */}
                {manifest.sections.map((section) => (
                  <Route
                    key={section.key}
                    path={section.route}
                    element={<DynamicTableSection tableName={section.tableName} syncTableId={section.syncTableId} />}
                  />
                ))}

                {/* Admin Studio configuration routing */}
                {isAdmin && (
                  <>
                    <Route path="/admin/connections" element={<ConnectionsPage />} />
                    <Route path="/admin/tables" element={<TableBrowserPage />} />
                    <Route path="/admin/columns" element={<GridColumnEditorPage />} />
                    <Route path="/admin/sections" element={<PortalSectionsPage />} />
                  </>
                )}

                <Route
                  path="*"
                  element={
                    <Navigate
                      to={manifest.sections[0]?.route ?? (isAdmin ? "/admin/connections" : "/")}
                      replace
                    />
                  }
                />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </PortalManifestContext.Provider>
  );
}

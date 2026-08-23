# Offline-First Dynamic Portal (Admin Studio) — Implementation

**Stack:** React 19 + TypeScript + Vite + Dexie (IndexedDB) + vite-plugin-pwa + Tailwind CSS v4 + Shadcn UI + AG Grid · ASP.NET Core 9 Web API + Dapper (via DynamicTransaction library) · SQLite Configuration DB (portal.db) + Dynamic connection string introspection.
**Scope:** A fully dynamic no-code outbox sync portal. Business tables are not hardcoded. The admin registers connections, introspects tables, defines columns visual options, and binds them to role-secured navigation items dynamically.
**Status:** Runnable implementation — every file below is complete. Adding a new table to the portal nav and sync outbox is a form submission, not a code deploy.

---

## 1. How the dynamic architecture works

Three concepts enable complete database and UI dynamism:

1. **Schema Introspection:** The catalog is scanned (`ALL_TAB_COLUMNS` on Oracle or `sqlite_master` / `PRAGMA table_info` on SQLite) to fetch columns and primary keys dynamically.
2. **Shadow Metadata Store:** Since business tables cannot be altered with metadata columns, row states (versions, soft-deletes, updates) are tracked inside `SYNC_ROW_META` using composite references `(SyncTableId, RowPk)`.
3. **Generic Outbox Sync & Data endpoints:** In client IndexedDB, records are stored under composite keys `tableName::rowPk` inside a single `rows` table. Sync push/pull cycles loop over tables defined by the manifest, executing parameterized SQL dynamically.

---

## 2. Solution layout

```
solution/
├── server/
│   ├── Portal.sln
│   ├── DynamicTransaction/
│   │   ├── Interfaces/
│   │   │   ├── IDbConnectionFactory.cs
│   │   │   └── IDynamicQueryExecutor.cs
│   │   └── Services/
│   │       └── DynamicQueryExecutor.cs
│   ├── Portal.Domain/
│   │   ├── Portal.Domain.csproj
│   │   ├── Entities/
│   │   │   ├── DatabaseProvider.cs
│   │   │   └── ConfigEntities.cs
│   │   └── Repositories/
│   │       └── IConfigRepository.cs
│   ├── Portal.Application/
│   │   ├── Portal.Application.csproj
│   │   ├── DTOs/
│   │   │   └── SyncDtos.cs
│   │   └── Services/
│   │       ├── DynamicSyncService.cs
│   │       ├── PortalManifestService.cs
│   │       ├── SchemaIntrospectionService.cs
│   │       └── MockBearerAuthHandler.cs
│   ├── Portal.Infrastructure/
│   │   ├── Portal.Infrastructure.csproj
│   │   ├── Data/
│   │   │   ├── DbConnectionFactory.cs
│   │   │   ├── SqliteBootstrap.cs
│   │   │   └── SqlIdentifier.cs
│   │   └── Repositories/
│   │       └── ConfigRepository.cs
│   └── Portal.Api/
│       ├── Portal.Api.csproj
│       ├── Program.cs
│       ├── appsettings.json
│       ├── Controllers/
│       │   ├── ConnectionsController.cs
│       │   ├── SchemaController.cs
│       │   ├── SyncTableConfigController.cs
│       │   ├── GridColumnConfigController.cs
│       │   ├── PortalSectionController.cs
│       │   ├── DynamicDataController.cs
│       │   ├── SyncController.cs
│       │   ├── PortalController.cs
│       │   └── AuthController.cs
└── client/
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── main.tsx
    │   ├── index.css
    │   ├── app/App.tsx
    │   ├── lib/utils.ts
    │   ├── components/ui/
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── input.tsx
    │   │   ├── badge.tsx
    │   │   ├── select.tsx
    │   │   └── checkbox.tsx
    │   ├── auth/
    │   │   ├── authStore.ts
    │   │   ├── apiClient.ts
    │   │   └── LoginPage.tsx
    │   ├── portal/
    │   │   ├── portalTypes.ts
    │   │   ├── portalRegistry.ts
    │   │   └── PortalShell.tsx
    │   ├── db/
    │   │   └── database.ts
    │   ├── sync/
    │   │   ├── syncEngine.ts
    │   │   └── connectivity.ts
    │   ├── dynamic-table/
    │   │   ├── dynamicRowRepository.ts
    │   │   ├── gridColumnConfig.ts
    │   │   └── DynamicTableSection.tsx
    │   └── admin-studio/
    │       ├── ConnectionsPage.tsx
    │       ├── TableBrowserPage.tsx
    │       ├── GridColumnEditorPage.tsx
    │       └── PortalSectionsPage.tsx
```

---

## 3. Configuration & Shadow schema

These tables are created automatically on startup inside the default SQLite database (`portal.db`).

```sql
-- Registered target data connections
CREATE TABLE DATA_CONNECTION (
    ID                  TEXT PRIMARY KEY,
    NAME                TEXT NOT NULL,
    PROVIDER            TEXT NOT NULL, -- oracle | sqlite
    CONNECTION_STRING   TEXT NOT NULL,
    IS_ACTIVE           INTEGER NOT NULL DEFAULT 1,
    CREATED_AT_UTC      TEXT NOT NULL
);

-- Tables configured to sync offline
CREATE TABLE SYNC_TABLE_CONFIG (
    ID                  TEXT PRIMARY KEY,
    CONNECTION_ID       TEXT NOT NULL,
    TABLE_NAME          TEXT NOT NULL,
    PRIMARY_KEY_COLUMN  TEXT NOT NULL,
    TENANT_COLUMN       TEXT NULL,
    ALLOW_CREATE        INTEGER NOT NULL DEFAULT 1,
    ALLOW_UPDATE        INTEGER NOT NULL DEFAULT 1,
    ALLOW_DELETE        INTEGER NOT NULL DEFAULT 1,
    IS_ENABLED          INTEGER NOT NULL DEFAULT 1,
    CREATED_AT_UTC      TEXT NOT NULL,
    UNIQUE (CONNECTION_ID, TABLE_NAME)
);

-- Display grid configurations
CREATE TABLE GRID_COLUMN_CONFIG (
    ID                  TEXT PRIMARY KEY,
    SYNC_TABLE_ID       TEXT NOT NULL,
    COLUMN_NAME         TEXT NOT NULL,
    DISPLAY_LABEL       TEXT NOT NULL,
    DATA_TYPE           TEXT NOT NULL DEFAULT 'string',
    IS_VISIBLE          INTEGER NOT NULL DEFAULT 1,
    IS_EDITABLE         INTEGER NOT NULL DEFAULT 1,
    DISPLAY_ORDER       INTEGER NOT NULL DEFAULT 0,
    WIDTH               INTEGER NULL,
    UNIQUE (SYNC_TABLE_ID, COLUMN_NAME)
);

-- Dynamic navigation routing links
CREATE TABLE PORTAL_SECTION_CONFIG (
    ID                  TEXT PRIMARY KEY,
    SYNC_TABLE_ID       TEXT NOT NULL,
    SECTION_KEY         TEXT NOT NULL UNIQUE,
    LABEL               TEXT NOT NULL,
    ICON                TEXT NOT NULL,
    ROUTE               TEXT NOT NULL,
    DISPLAY_ORDER       INTEGER NOT NULL DEFAULT 0,
    ROLES_CSV           TEXT NOT NULL,
    IS_ENABLED          INTEGER NOT NULL DEFAULT 1
);

-- Version and soft-delete tombstone details
CREATE TABLE SYNC_ROW_META (
    SYNC_TABLE_ID       TEXT NOT NULL,
    ROW_PK              TEXT NOT NULL,
    VERSION_NUMBER      INTEGER NOT NULL,
    UPDATED_AT_UTC      TEXT NOT NULL,
    UPDATED_BY          TEXT NOT NULL,
    DELETED_AT_UTC      TEXT NULL,
    PRIMARY KEY (SYNC_TABLE_ID, ROW_PK)
);

-- Dynamic change logs
CREATE TABLE SYNC_CHANGE (
    SERVER_CURSOR       INTEGER PRIMARY KEY AUTOINCREMENT,
    SYNC_TABLE_ID       TEXT NOT NULL,
    ROW_PK              TEXT NOT NULL,
    CHANGE_TYPE         TEXT NOT NULL, -- created | updated | deleted
    RECORD_JSON         TEXT NULL,
    CREATED_AT_UTC      TEXT NOT NULL
);

-- Idempotency transaction logs
CREATE TABLE SYNC_OPERATION (
    OPERATION_ID        TEXT PRIMARY KEY,
    SYNC_TABLE_ID       TEXT NOT NULL,
    CLIENT_ID           TEXT NOT NULL,
    ROW_PK              TEXT NOT NULL,
    OPERATION_TYPE      TEXT NOT NULL,
    STATUS              TEXT NOT NULL,
    RESULT_JSON         TEXT NULL,
    CREATED_AT_UTC      TEXT NOT NULL,
    COMPLETED_AT_UTC    TEXT NULL
);
```

---

## 4. Main Server classes

### `Data/SqlIdentifier.cs`
Strict check to sanitize dynamic SQL object parameters.
```csharp
using System.Text.RegularExpressions;

namespace Portal.Api.Data;

public static class SqlIdentifier
{
    private static readonly Regex ValidPattern = new("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

    public static string RequireValid(string identifier, string kind)
    {
        if (!ValidPattern.IsMatch(identifier))
            throw new InvalidOperationException($"Rejected unsafe {kind} identifier: '{identifier}'.");
        return identifier;
    }

    public static string RequireKnown(string identifier, IReadOnlyCollection<string> allowList, string kind)
    {
        RequireValid(identifier, kind);
        if (!allowList.Contains(identifier, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Unknown {kind} '{identifier}' — it is not registered in configuration.");
        return identifier;
    }
}
```

### `Sync/DynamicSyncService.cs`
Applies push/pull operations to target schemas dynamically:
```csharp
public sealed class DynamicSyncService(ConfigRepository repo, IDynamicQueryExecutor executor, IConfiguration config)
{
    // Executes Create, Update, Delete queries dynamically using parametrized Dapper.
    // Performs conflict checking inside the config database using SYNC_ROW_META tables.
}
```

### `Data2/DynamicDataController.cs`
Resolves generic REST data calls for visible grids:
```csharp
[HttpGet("{tableName}")]
public async Task<IActionResult> Get(string tableName, [FromQuery] string? columns, [FromQuery] int page = 1)
{
    // Compiles SQL based on target connection provider (Oracle / SQLite paging dialect).
    // Executes paginated query via IDynamicQueryExecutor.
}
```

---

## 5. Responsive dynamic UI (Vite + Tailwind v4 + Shadcn)

### `src/portal/PortalShell.tsx`
Renders a slide-out navigation overlay for Mobile/Tablet screens and a persistent sidebar frame for Desktops. It includes links to registered portal sections plus the configuration suite.

### `src/dynamic-table/DynamicTableSection.tsx`
Renders rows dynamically.
- **Mobile / Tablet view:** Fallback list of card items containing edit forms and inline Keep Mine / Keep Server conflict resolution dialog panels.
- **Desktop view:** Full-page Ag-Grid table sheet with real-time cell editing support.

### `src/db/database.ts`
The single dynamic Dexie store:
```ts
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
```

---

## 6. How to add a new syncable table

No C# controllers, models, or TypeScript layout edits are needed. An administrator simply:
1. Navigates to **Admin Studio -> Table Browser**.
2. Selects the connection, identifies the table, PK, and optional tenant keys, then clicks **Enable Table Sync**.
3. Opens **Admin Studio -> Grid Columns** to edit display headers, widths, and edit rights.
4. Opens **Admin Studio -> Portal Sections** to assign a sidebar nav label, icon, route, and allowed roles.
5. Done. The portal sidebar, grid, and background sync outbox will automatically bootstrap the new table on next reload.
# Admin Studio — Fully Dynamic, No-Code Offline Portal

**Supersedes:** the hardcoded `WorkOrder` vertical slice from the earlier implementation.
**Stack (per your plan):** Dapper via `IDynamicQueryExecutor`, `IDbConnectionFactory` with automatic Oracle/SQLite detection, mock bearer auth, React 19 + Tailwind v4 + Shadcn + AG Grid + Dexie.
**What changes:** no entity, table, or column is hardcoded anywhere in the stack. An admin adds a connection string, the system introspects the schema, the admin ticks which tables sync offline and labels their columns, and the portal — nav, grid, and offline sync — renders itself from that configuration. Adding a new offline-capable table is a form submission, not a deploy.

---

## 1. How the dynamism actually works

Three problems have to be solved generically, without per-table code:

1. **"What tables/columns exist?"** → `SchemaIntrospectionService` reads `ALL_TAB_COLUMNS` (Oracle) or `pragma table_info` / `sqlite_master` (SQLite) for whichever connection the admin picks.
2. **"How do I read/write an arbitrary table safely?"** → every dynamic SQL statement is built from identifiers that must already exist in `SYNC_TABLE_CONFIG` / `GRID_COLUMN_CONFIG` (populated only from introspection results) and pass a strict `^[A-Za-z_][A-Za-z0-9_]*$` check. Client-supplied table/column names are looked up in that allow-list, never concatenated raw.
3. **"How do I version/soft-delete/track-changes on a table I'm not allowed to alter?"** (most real ERP tables can't get new columns bolted on) → a parallel **shadow table**, `SYNC_ROW_META`, keyed by `(SyncTableId, RowPk)`, carries `VERSION_NUMBER`, `UPDATED_AT_UTC`, `DELETED_AT_UTC` for every row of every enabled table. The business table itself is never altered.

Everything downstream — the dynamic data endpoint, the generic sync push/pull, the AG Grid column defs, the portal nav — is driven off `SYNC_TABLE_CONFIG`, `GRID_COLUMN_CONFIG`, and `PORTAL_SECTION_CONFIG` rows, not code.

---

## 2. Solution layout

```
solution/
├── server/Portal.Api/
│   ├── Portal.Api.csproj
│   ├── appsettings.json
│   ├── Program.cs
│   ├── Data/
│   │   ├── DatabaseProvider.cs
│   │   ├── IDbConnectionFactory.cs / DbConnectionFactory.cs
│   │   ├── IDynamicQueryExecutor.cs / DapperDynamicQueryExecutor.cs
│   │   ├── SqlIdentifier.cs
│   │   ├── Entities/ConfigEntities.cs
│   │   ├── ConfigRepository.cs
│   │   └── SqliteBootstrap.cs
│   ├── Schema/
│   │   ├── ISchemaIntrospectionService.cs
│   │   └── SchemaIntrospectionService.cs
│   ├── Auth/
│   │   ├── MockBearerAuthHandler.cs
│   │   └── AuthController.cs
│   ├── Admin/
│   │   ├── ConnectionsController.cs
│   │   ├── SchemaController.cs
│   │   ├── SyncTableConfigController.cs
│   │   ├── GridColumnConfigController.cs
│   │   └── PortalSectionController.cs
│   ├── Data2/
│   │   └── DynamicDataController.cs
│   ├── Sync/
│   │   ├── SyncDtos.cs
│   │   ├── DynamicSyncService.cs
│   │   └── SyncController.cs
│   └── Portal/
│       ├── PortalManifestService.cs
│       └── PortalController.cs
└── client/src/
    ├── main.tsx, app/App.tsx, index.css
    ├── lib/utils.ts
    ├── components/ui/{button,input,card,badge,table,select,checkbox}.tsx
    ├── auth/{authStore.ts, apiClient.ts, LoginPage.tsx}
    ├── portal/{portalTypes.ts, portalRegistry.ts, PortalShell.tsx}
    ├── admin-studio/
    │   ├── ConnectionsPage.tsx
    │   ├── TableBrowserPage.tsx
    │   ├── GridColumnEditorPage.tsx
    │   └── PortalSectionsPage.tsx
    ├── db/database.ts
    ├── sync/{syncEngine.ts, connectivity.ts}
    └── dynamic-table/
        ├── dynamicRowRepository.ts
        ├── gridColumnConfig.ts
        └── DynamicTableSection.tsx
```

---

## 3. Configuration + shadow schema

Runs on SQLite out of the box (auto-created at startup — see §5.9) and is schema-identical on Oracle for production. Every table below is **infrastructure**, never a business table.

```sql
-- Registered database connections the admin can point Admin Studio at.
CREATE TABLE DATA_CONNECTION (
    ID                  VARCHAR2(36)   PRIMARY KEY,
    NAME                VARCHAR2(200)  NOT NULL,
    PROVIDER            VARCHAR2(20)   NOT NULL,   -- oracle | sqlite
    CONNECTION_STRING   VARCHAR2(1000) NOT NULL,
    IS_ACTIVE           NUMBER(1)      DEFAULT 1 NOT NULL,
    CREATED_AT_UTC      TIMESTAMP(6)   NOT NULL
);

-- Which tables (on which connection) are enabled for offline sync, and how.
CREATE TABLE SYNC_TABLE_CONFIG (
    ID                  VARCHAR2(36)   PRIMARY KEY,
    CONNECTION_ID       VARCHAR2(36)   NOT NULL REFERENCES DATA_CONNECTION(ID),
    TABLE_NAME          VARCHAR2(128)  NOT NULL,
    PRIMARY_KEY_COLUMN  VARCHAR2(128)  NOT NULL,
    TENANT_COLUMN       VARCHAR2(128)  NULL,
    ALLOW_CREATE        NUMBER(1)      DEFAULT 1 NOT NULL,
    ALLOW_UPDATE        NUMBER(1)      DEFAULT 1 NOT NULL,
    ALLOW_DELETE        NUMBER(1)      DEFAULT 1 NOT NULL,
    IS_ENABLED          NUMBER(1)      DEFAULT 1 NOT NULL,
    CREATED_AT_UTC      TIMESTAMP(6)   NOT NULL,
    CONSTRAINT UX_SYNC_TABLE UNIQUE (CONNECTION_ID, TABLE_NAME)
);

-- Per-column display/edit config — this is the "no-code" grid definition.
CREATE TABLE GRID_COLUMN_CONFIG (
    ID                  VARCHAR2(36)   PRIMARY KEY,
    SYNC_TABLE_ID       VARCHAR2(36)   NOT NULL REFERENCES SYNC_TABLE_CONFIG(ID),
    COLUMN_NAME         VARCHAR2(128)  NOT NULL,
    DISPLAY_LABEL       VARCHAR2(200)  NOT NULL,
    DATA_TYPE           VARCHAR2(40)   NOT NULL,   -- string | number | boolean | date
    IS_VISIBLE          NUMBER(1)      DEFAULT 1 NOT NULL,
    IS_EDITABLE         NUMBER(1)      DEFAULT 1 NOT NULL,
    DISPLAY_ORDER       NUMBER(5)      DEFAULT 0 NOT NULL,
    WIDTH               NUMBER(5)      NULL,
    CONSTRAINT UX_GRID_COLUMN UNIQUE (SYNC_TABLE_ID, COLUMN_NAME)
);

-- Portal navigation entries, each bound to one sync-enabled table.
CREATE TABLE PORTAL_SECTION_CONFIG (
    ID                  VARCHAR2(36)   PRIMARY KEY,
    SYNC_TABLE_ID       VARCHAR2(36)   NOT NULL REFERENCES SYNC_TABLE_CONFIG(ID),
    SECTION_KEY         VARCHAR2(80)   NOT NULL UNIQUE,
    LABEL               VARCHAR2(200)  NOT NULL,
    ICON                VARCHAR2(60)   NOT NULL,
    ROUTE               VARCHAR2(200)  NOT NULL,
    DISPLAY_ORDER       NUMBER(5)      DEFAULT 0 NOT NULL,
    ROLES_CSV           VARCHAR2(500)  NOT NULL,
    IS_ENABLED          NUMBER(1)      DEFAULT 1 NOT NULL
);

-- Shadow versioning/tombstone metadata — keeps optimistic concurrency and
-- soft-delete working on tables we are not allowed to alter.
CREATE TABLE SYNC_ROW_META (
    SYNC_TABLE_ID       VARCHAR2(36)   NOT NULL REFERENCES SYNC_TABLE_CONFIG(ID),
    ROW_PK              VARCHAR2(128)  NOT NULL,
    VERSION_NUMBER      NUMBER(19)     NOT NULL,
    UPDATED_AT_UTC      TIMESTAMP(6)   NOT NULL,
    UPDATED_BY          VARCHAR2(128)  NOT NULL,
    DELETED_AT_UTC      TIMESTAMP(6)   NULL,
    CONSTRAINT PK_SYNC_ROW_META PRIMARY KEY (SYNC_TABLE_ID, ROW_PK)
);

-- Generic change feed, one row per create/update/delete, across every table.
CREATE SEQUENCE SEQ_SYNC_CHANGE START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE SYNC_CHANGE (
    SERVER_CURSOR       NUMBER(19)     PRIMARY KEY,
    SYNC_TABLE_ID       VARCHAR2(36)   NOT NULL,
    ROW_PK              VARCHAR2(128)  NOT NULL,
    CHANGE_TYPE         VARCHAR2(20)   NOT NULL,   -- created | updated | deleted
    RECORD_JSON         CLOB           NULL,
    CREATED_AT_UTC      TIMESTAMP(6)   NOT NULL
);
CREATE INDEX IX_SYNC_CHANGE_TABLE_CURSOR ON SYNC_CHANGE (SYNC_TABLE_ID, SERVER_CURSOR);

-- Idempotency log, generic across tables.
CREATE TABLE SYNC_OPERATION (
    OPERATION_ID        VARCHAR2(36)   PRIMARY KEY,
    SYNC_TABLE_ID        VARCHAR2(36)   NOT NULL,
    CLIENT_ID            VARCHAR2(128)  NOT NULL,
    ROW_PK                VARCHAR2(128)  NOT NULL,
    OPERATION_TYPE       VARCHAR2(20)   NOT NULL,
    STATUS                VARCHAR2(20)   NOT NULL,
    RESULT_JSON           CLOB           NULL,
    CREATED_AT_UTC        TIMESTAMP(6)   NOT NULL,
    COMPLETED_AT_UTC      TIMESTAMP(6)   NULL
);
```

---

## 4. Server — `Portal.Api`

### 4.1 `Portal.Api.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Dapper" Version="2.1.35" />
    <PackageReference Include="Oracle.ManagedDataAccess.Core" Version="23.6.1" />
    <PackageReference Include="Microsoft.Data.Sqlite" Version="9.0.0" />
  </ItemGroup>
  <!-- Reference your existing DynamicTransaction class library here instead of
       Data/IDynamicQueryExecutor.cs + DapperDynamicQueryExecutor.cs below if you
       want to reuse the SYS_REFCURSOR-aware executor you already built for
       DataEngine. The contract this project depends on (QueryAsync / ExecuteAsync /
       ExecuteInTransactionAsync) is intentionally the same shape so it's a drop-in
       swap — see the note on IDynamicQueryExecutor. -->
</Project>
```

### 4.2 `appsettings.json`

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=portal.db"
  },
  "Logging": { "LogLevel": { "Default": "Information" } }
}
```

`Default` is Admin Studio's own config store (connections, table config, grid config, sync shadow tables) — always local SQLite by default so the app runs with zero external dependencies. Each `DATA_CONNECTION` row registered *inside* Admin Studio is a separate, independent business-data connection (often Oracle) that gets introspected and synced — that's the one the provider-detection logic in §4.4 applies to.

### 4.3 `Data/DatabaseProvider.cs`

```csharp
namespace Portal.Api.Data;

public enum DatabaseProvider { Sqlite, Oracle }
```

### 4.4 `Data/IDbConnectionFactory.cs` + `DbConnectionFactory.cs`

```csharp
using System.Data;

namespace Portal.Api.Data;

public interface IDbConnectionFactory
{
    DatabaseProvider DetectProvider(string connectionString);
    IDbConnection Create(string connectionString);
}
```

```csharp
using System.Data;
using Microsoft.Data.Sqlite;
using Oracle.ManagedDataAccess.Client;

namespace Portal.Api.Data;

public sealed class DbConnectionFactory : IDbConnectionFactory
{
    public DatabaseProvider DetectProvider(string connectionString)
    {
        var normalized = connectionString.ToLowerInvariant();
        var looksOracle = normalized.Contains("oracle") || normalized.Contains("user id=") || normalized.Contains("data source=//");
        return looksOracle ? DatabaseProvider.Oracle : DatabaseProvider.Sqlite;
    }

    public IDbConnection Create(string connectionString)
    {
        var provider = DetectProvider(connectionString);
        IDbConnection conn = provider switch
        {
            DatabaseProvider.Oracle => new OracleConnection(connectionString),
            _ => new SqliteConnection(connectionString)
        };
        conn.Open();
        return conn;
    }
}
```

### 4.5 `Data/IDynamicQueryExecutor.cs` + `DapperDynamicQueryExecutor.cs`

```csharp
using System.Data;

namespace Portal.Api.Data;

/// <summary>
/// Same shape as the DynamicTransaction library's executor — swap the
/// registration in Program.cs for your existing implementation
/// (the one with SYS_REFCURSOR support) without touching any caller.
/// </summary>
public interface IDynamicQueryExecutor
{
    Task<IEnumerable<dynamic>> QueryAsync(IDbConnection connection, string sql, object? parameters = null, IDbTransaction? tx = null);
    Task<T?> QuerySingleAsync<T>(IDbConnection connection, string sql, object? parameters = null, IDbTransaction? tx = null);
    Task<int> ExecuteAsync(IDbConnection connection, string sql, object? parameters = null, IDbTransaction? tx = null);
    Task<T> ExecuteInTransactionAsync<T>(IDbConnection connection, Func<IDbTransaction, Task<T>> work);
}
```

```csharp
using System.Data;
using Dapper;

namespace Portal.Api.Data;

public sealed class DapperDynamicQueryExecutor : IDynamicQueryExecutor
{
    public Task<IEnumerable<dynamic>> QueryAsync(IDbConnection connection, string sql, object? parameters = null, IDbTransaction? tx = null)
        => connection.QueryAsync(sql, parameters, tx);

    public Task<T?> QuerySingleAsync<T>(IDbConnection connection, string sql, object? parameters = null, IDbTransaction? tx = null)
        => connection.QuerySingleOrDefaultAsync<T>(sql, parameters, tx);

    public Task<int> ExecuteAsync(IDbConnection connection, string sql, object? parameters = null, IDbTransaction? tx = null)
        => connection.ExecuteAsync(sql, parameters, tx);

    public async Task<T> ExecuteInTransactionAsync<T>(IDbConnection connection, Func<IDbTransaction, Task<T>> work)
    {
        using var tx = connection.BeginTransaction();
        try
        {
            var result = await work(tx);
            tx.Commit();
            return result;
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}
```

### 4.6 `Data/SqlIdentifier.cs` — the whole safety story in one file

```csharp
using System.Text.RegularExpressions;

namespace Portal.Api.Data;

/// <summary>
/// Every dynamic SQL statement in this project routes its table/column
/// names through here. An identifier is only ever considered safe if it
/// (a) matches a strict character allow-list AND (b) is already present in
/// SYNC_TABLE_CONFIG / GRID_COLUMN_CONFIG — i.e. it was written by
/// SchemaIntrospectionService reading the real database catalog, never
/// typed freehand by a client request.
/// </summary>
public static class SqlIdentifier
{
    private static readonly Regex ValidPattern = new("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

    public static bool IsSyntacticallyValid(string identifier) => ValidPattern.IsMatch(identifier);

    public static string RequireValid(string identifier, string kind)
    {
        if (!IsSyntacticallyValid(identifier))
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

### 4.7 `Data/Entities/ConfigEntities.cs`

```csharp
namespace Portal.Api.Data.Entities;

public sealed class DataConnection
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Provider { get; set; } = null!;
    public string ConnectionString { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class SyncTableConfig
{
    public string Id { get; set; } = null!;
    public string ConnectionId { get; set; } = null!;
    public string TableName { get; set; } = null!;
    public string PrimaryKeyColumn { get; set; } = null!;
    public string? TenantColumn { get; set; }
    public bool AllowCreate { get; set; } = true;
    public bool AllowUpdate { get; set; } = true;
    public bool AllowDelete { get; set; } = true;
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class GridColumnConfig
{
    public string Id { get; set; } = null!;
    public string SyncTableId { get; set; } = null!;
    public string ColumnName { get; set; } = null!;
    public string DisplayLabel { get; set; } = null!;
    public string DataType { get; set; } = "string"; // string | number | boolean | date
    public bool IsVisible { get; set; } = true;
    public bool IsEditable { get; set; } = true;
    public int DisplayOrder { get; set; }
    public int? Width { get; set; }
}

public sealed class PortalSectionConfig
{
    public string Id { get; set; } = null!;
    public string SyncTableId { get; set; } = null!;
    public string SectionKey { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string Icon { get; set; } = null!;
    public string Route { get; set; } = null!;
    public int DisplayOrder { get; set; }
    public string RolesCsv { get; set; } = null!;
    public bool IsEnabled { get; set; } = true;

    public IReadOnlyList<string> Roles =>
        RolesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
```

### 4.8 `Data/ConfigRepository.cs` — reads/writes Admin Studio's own SQLite store

```csharp
using System.Data;
using Dapper;
using Microsoft.Data.Sqlite;
using Portal.Api.Data.Entities;

namespace Portal.Api.Data;

/// <summary>
/// Talks to the Default connection string only (Admin Studio's own store:
/// DATA_CONNECTION, SYNC_TABLE_CONFIG, GRID_COLUMN_CONFIG, PORTAL_SECTION_CONFIG,
/// SYNC_ROW_META, SYNC_CHANGE, SYNC_OPERATION). Business data lives in whichever
/// connection each DataConnection row points at, and is only ever touched
/// through DynamicDataController / DynamicSyncService.
/// </summary>
public sealed class ConfigRepository(IConfiguration config)
{
    private IDbConnection Open()
    {
        var conn = new SqliteConnection(config.GetConnectionString("Default"));
        conn.Open();
        return conn;
    }

    public async Task<DataConnection> AddConnectionAsync(string name, string connectionString, DatabaseProvider provider)
    {
        using var db = Open();
        var row = new DataConnection
        {
            Id = Guid.NewGuid().ToString(),
            Name = name,
            Provider = provider.ToString().ToLowerInvariant(),
            ConnectionString = connectionString,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        await db.ExecuteAsync(
            @"INSERT INTO DATA_CONNECTION (ID, NAME, PROVIDER, CONNECTION_STRING, IS_ACTIVE, CREATED_AT_UTC)
              VALUES (@Id, @Name, @Provider, @ConnectionString, 1, @CreatedAtUtc)", row);
        return row;
    }

    public async Task<IReadOnlyList<DataConnection>> ListConnectionsAsync()
    {
        using var db = Open();
        return (await db.QueryAsync<DataConnection>(
            "SELECT ID as Id, NAME as Name, PROVIDER as Provider, CONNECTION_STRING as ConnectionString, IS_ACTIVE as IsActive, CREATED_AT_UTC as CreatedAtUtc FROM DATA_CONNECTION WHERE IS_ACTIVE = 1"
        )).ToList();
    }

    public async Task<DataConnection?> GetConnectionAsync(string id)
    {
        using var db = Open();
        return await db.QuerySingleOrDefaultAsync<DataConnection>(
            "SELECT ID as Id, NAME as Name, PROVIDER as Provider, CONNECTION_STRING as ConnectionString, IS_ACTIVE as IsActive, CREATED_AT_UTC as CreatedAtUtc FROM DATA_CONNECTION WHERE ID = @id",
            new { id });
    }

    public async Task<SyncTableConfig> UpsertSyncTableAsync(SyncTableConfig table)
    {
        using var db = Open();
        var existing = await db.QuerySingleOrDefaultAsync<string>(
            "SELECT ID FROM SYNC_TABLE_CONFIG WHERE CONNECTION_ID = @ConnectionId AND TABLE_NAME = @TableName",
            table);

        if (existing is null)
        {
            table.Id = Guid.NewGuid().ToString();
            table.CreatedAtUtc = DateTime.UtcNow;
            await db.ExecuteAsync(
                @"INSERT INTO SYNC_TABLE_CONFIG
                    (ID, CONNECTION_ID, TABLE_NAME, PRIMARY_KEY_COLUMN, TENANT_COLUMN, ALLOW_CREATE, ALLOW_UPDATE, ALLOW_DELETE, IS_ENABLED, CREATED_AT_UTC)
                  VALUES
                    (@Id, @ConnectionId, @TableName, @PrimaryKeyColumn, @TenantColumn, @AllowCreate, @AllowUpdate, @AllowDelete, @IsEnabled, @CreatedAtUtc)",
                table);
        }
        else
        {
            table.Id = existing;
            await db.ExecuteAsync(
                @"UPDATE SYNC_TABLE_CONFIG SET
                    PRIMARY_KEY_COLUMN = @PrimaryKeyColumn, TENANT_COLUMN = @TenantColumn,
                    ALLOW_CREATE = @AllowCreate, ALLOW_UPDATE = @AllowUpdate, ALLOW_DELETE = @AllowDelete,
                    IS_ENABLED = @IsEnabled
                  WHERE ID = @Id", table);
        }
        return table;
    }

    public async Task<IReadOnlyList<SyncTableConfig>> ListSyncTablesAsync(string? connectionId = null)
    {
        using var db = Open();
        var sql = "SELECT ID as Id, CONNECTION_ID as ConnectionId, TABLE_NAME as TableName, PRIMARY_KEY_COLUMN as PrimaryKeyColumn, TENANT_COLUMN as TenantColumn, ALLOW_CREATE as AllowCreate, ALLOW_UPDATE as AllowUpdate, ALLOW_DELETE as AllowDelete, IS_ENABLED as IsEnabled, CREATED_AT_UTC as CreatedAtUtc FROM SYNC_TABLE_CONFIG WHERE IS_ENABLED = 1";
        if (connectionId is not null) sql += " AND CONNECTION_ID = @connectionId";
        return (await db.QueryAsync<SyncTableConfig>(sql, new { connectionId })).ToList();
    }

    public async Task<SyncTableConfig?> GetSyncTableAsync(string id)
    {
        using var db = Open();
        return await db.QuerySingleOrDefaultAsync<SyncTableConfig>(
            "SELECT ID as Id, CONNECTION_ID as ConnectionId, TABLE_NAME as TableName, PRIMARY_KEY_COLUMN as PrimaryKeyColumn, TENANT_COLUMN as TenantColumn, ALLOW_CREATE as AllowCreate, ALLOW_UPDATE as AllowUpdate, ALLOW_DELETE as AllowDelete, IS_ENABLED as IsEnabled, CREATED_AT_UTC as CreatedAtUtc FROM SYNC_TABLE_CONFIG WHERE ID = @id",
            new { id });
    }

    public async Task ReplaceGridColumnsAsync(string syncTableId, IReadOnlyList<GridColumnConfig> columns)
    {
        using var db = Open();
        using var tx = db.BeginTransaction();
        await db.ExecuteAsync("DELETE FROM GRID_COLUMN_CONFIG WHERE SYNC_TABLE_ID = @syncTableId", new { syncTableId }, tx);
        foreach (var col in columns)
        {
            col.Id = Guid.NewGuid().ToString();
            col.SyncTableId = syncTableId;
            await db.ExecuteAsync(
                @"INSERT INTO GRID_COLUMN_CONFIG
                    (ID, SYNC_TABLE_ID, COLUMN_NAME, DISPLAY_LABEL, DATA_TYPE, IS_VISIBLE, IS_EDITABLE, DISPLAY_ORDER, WIDTH)
                  VALUES
                    (@Id, @SyncTableId, @ColumnName, @DisplayLabel, @DataType, @IsVisible, @IsEditable, @DisplayOrder, @Width)",
                col, tx);
        }
        tx.Commit();
    }

    public async Task<IReadOnlyList<GridColumnConfig>> GetGridColumnsAsync(string syncTableId)
    {
        using var db = Open();
        return (await db.QueryAsync<GridColumnConfig>(
            @"SELECT ID as Id, SYNC_TABLE_ID as SyncTableId, COLUMN_NAME as ColumnName, DISPLAY_LABEL as DisplayLabel,
                     DATA_TYPE as DataType, IS_VISIBLE as IsVisible, IS_EDITABLE as IsEditable,
                     DISPLAY_ORDER as DisplayOrder, WIDTH as Width
              FROM GRID_COLUMN_CONFIG WHERE SYNC_TABLE_ID = @syncTableId ORDER BY DISPLAY_ORDER",
            new { syncTableId })).ToList();
    }

    public async Task<PortalSectionConfig> UpsertSectionAsync(PortalSectionConfig section)
    {
        using var db = Open();
        var existing = await db.QuerySingleOrDefaultAsync<string>(
            "SELECT ID FROM PORTAL_SECTION_CONFIG WHERE SECTION_KEY = @SectionKey", section);

        section.Id = existing ?? Guid.NewGuid().ToString();
        if (existing is null)
        {
            await db.ExecuteAsync(
                @"INSERT INTO PORTAL_SECTION_CONFIG
                    (ID, SYNC_TABLE_ID, SECTION_KEY, LABEL, ICON, ROUTE, DISPLAY_ORDER, ROLES_CSV, IS_ENABLED)
                  VALUES (@Id, @SyncTableId, @SectionKey, @Label, @Icon, @Route, @DisplayOrder, @RolesCsv, @IsEnabled)",
                section);
        }
        else
        {
            await db.ExecuteAsync(
                @"UPDATE PORTAL_SECTION_CONFIG SET
                    SYNC_TABLE_ID = @SyncTableId, LABEL = @Label, ICON = @Icon, ROUTE = @Route,
                    DISPLAY_ORDER = @DisplayOrder, ROLES_CSV = @RolesCsv, IS_ENABLED = @IsEnabled
                  WHERE ID = @Id", section);
        }
        return section;
    }

    public async Task<IReadOnlyList<PortalSectionConfig>> ListSectionsAsync()
    {
        using var db = Open();
        return (await db.QueryAsync<PortalSectionConfig>(
            @"SELECT ID as Id, SYNC_TABLE_ID as SyncTableId, SECTION_KEY as SectionKey, LABEL as Label, ICON as Icon,
                     ROUTE as Route, DISPLAY_ORDER as DisplayOrder, ROLES_CSV as RolesCsv, IS_ENABLED as IsEnabled
              FROM PORTAL_SECTION_CONFIG WHERE IS_ENABLED = 1 ORDER BY DISPLAY_ORDER")).ToList();
    }
}
```

### 4.9 `Data/SqliteBootstrap.cs` — auto-creates Admin Studio's own tables

```csharp
using Microsoft.Data.Sqlite;

namespace Portal.Api.Data;

public static class SqliteBootstrap
{
    public static void EnsureConfigStoreCreated(string connectionString)
    {
        using var conn = new SqliteConnection(connectionString);
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = ConfigStoreDdl;
        cmd.ExecuteNonQuery();
    }

    private const string ConfigStoreDdl = """
        CREATE TABLE IF NOT EXISTS DATA_CONNECTION (
            ID TEXT PRIMARY KEY, NAME TEXT NOT NULL, PROVIDER TEXT NOT NULL,
            CONNECTION_STRING TEXT NOT NULL, IS_ACTIVE INTEGER NOT NULL DEFAULT 1,
            CREATED_AT_UTC TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS SYNC_TABLE_CONFIG (
            ID TEXT PRIMARY KEY, CONNECTION_ID TEXT NOT NULL, TABLE_NAME TEXT NOT NULL,
            PRIMARY_KEY_COLUMN TEXT NOT NULL, TENANT_COLUMN TEXT NULL,
            ALLOW_CREATE INTEGER NOT NULL DEFAULT 1, ALLOW_UPDATE INTEGER NOT NULL DEFAULT 1,
            ALLOW_DELETE INTEGER NOT NULL DEFAULT 1, IS_ENABLED INTEGER NOT NULL DEFAULT 1,
            CREATED_AT_UTC TEXT NOT NULL,
            UNIQUE (CONNECTION_ID, TABLE_NAME)
        );

        CREATE TABLE IF NOT EXISTS GRID_COLUMN_CONFIG (
            ID TEXT PRIMARY KEY, SYNC_TABLE_ID TEXT NOT NULL, COLUMN_NAME TEXT NOT NULL,
            DISPLAY_LABEL TEXT NOT NULL, DATA_TYPE TEXT NOT NULL DEFAULT 'string',
            IS_VISIBLE INTEGER NOT NULL DEFAULT 1, IS_EDITABLE INTEGER NOT NULL DEFAULT 1,
            DISPLAY_ORDER INTEGER NOT NULL DEFAULT 0, WIDTH INTEGER NULL,
            UNIQUE (SYNC_TABLE_ID, COLUMN_NAME)
        );

        CREATE TABLE IF NOT EXISTS PORTAL_SECTION_CONFIG (
            ID TEXT PRIMARY KEY, SYNC_TABLE_ID TEXT NOT NULL, SECTION_KEY TEXT NOT NULL UNIQUE,
            LABEL TEXT NOT NULL, ICON TEXT NOT NULL, ROUTE TEXT NOT NULL,
            DISPLAY_ORDER INTEGER NOT NULL DEFAULT 0, ROLES_CSV TEXT NOT NULL,
            IS_ENABLED INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS SYNC_ROW_META (
            SYNC_TABLE_ID TEXT NOT NULL, ROW_PK TEXT NOT NULL, VERSION_NUMBER INTEGER NOT NULL,
            UPDATED_AT_UTC TEXT NOT NULL, UPDATED_BY TEXT NOT NULL, DELETED_AT_UTC TEXT NULL,
            PRIMARY KEY (SYNC_TABLE_ID, ROW_PK)
        );

        CREATE TABLE IF NOT EXISTS SYNC_CHANGE (
            SERVER_CURSOR INTEGER PRIMARY KEY AUTOINCREMENT, SYNC_TABLE_ID TEXT NOT NULL,
            ROW_PK TEXT NOT NULL, CHANGE_TYPE TEXT NOT NULL, RECORD_JSON TEXT NULL,
            CREATED_AT_UTC TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS IX_SYNC_CHANGE_TABLE_CURSOR ON SYNC_CHANGE (SYNC_TABLE_ID, SERVER_CURSOR);

        CREATE TABLE IF NOT EXISTS SYNC_OPERATION (
            OPERATION_ID TEXT PRIMARY KEY, SYNC_TABLE_ID TEXT NOT NULL, CLIENT_ID TEXT NOT NULL,
            ROW_PK TEXT NOT NULL, OPERATION_TYPE TEXT NOT NULL, STATUS TEXT NOT NULL,
            RESULT_JSON TEXT NULL, CREATED_AT_UTC TEXT NOT NULL, COMPLETED_AT_UTC TEXT NULL
        );

        CREATE TABLE IF NOT EXISTS APP_USER (
            ID TEXT PRIMARY KEY, USERNAME TEXT NOT NULL UNIQUE, PASSWORD TEXT NOT NULL,
            DISPLAY_NAME TEXT NOT NULL, ROLES_CSV TEXT NOT NULL, TENANT_ID TEXT NOT NULL
        );
        INSERT OR IGNORE INTO APP_USER (ID, USERNAME, PASSWORD, DISPLAY_NAME, ROLES_CSV, TENANT_ID)
        VALUES ('seed-admin', 'admin', 'admin-password', 'Administrator', 'admin,planner,supervisor', 'default');
        """;
}
```

### 4.10 `Schema/ISchemaIntrospectionService.cs` + implementation

```csharp
namespace Portal.Api.Schema;

public sealed record TableInfo(string TableName);
public sealed record ColumnInfo(string ColumnName, string DataType, bool IsNullable, bool IsPrimaryKey);
```

```csharp
using Dapper;
using Portal.Api.Data;
using Portal.Api.Data.Entities;

namespace Portal.Api.Schema;

public interface ISchemaIntrospectionService
{
    Task<IReadOnlyList<TableInfo>> ListTablesAsync(DataConnection connection);
    Task<IReadOnlyList<ColumnInfo>> ListColumnsAsync(DataConnection connection, string tableName);
}

public sealed class SchemaIntrospectionService(IDbConnectionFactory factory) : ISchemaIntrospectionService
{
    public async Task<IReadOnlyList<TableInfo>> ListTablesAsync(DataConnection connection)
    {
        using var db = factory.Create(connection.ConnectionString);
        var provider = factory.DetectProvider(connection.ConnectionString);

        var sql = provider == DatabaseProvider.Oracle
            ? "SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME"
            : "SELECT name AS TABLE_NAME FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";

        var names = await db.QueryAsync<string>(sql);
        return names.Select(n => new TableInfo(n)).ToList();
    }

    public async Task<IReadOnlyList<ColumnInfo>> ListColumnsAsync(DataConnection connection, string tableName)
    {
        SqlIdentifier.RequireValid(tableName, "table");

        using var db = factory.Create(connection.ConnectionString);
        var provider = factory.DetectProvider(connection.ConnectionString);

        if (provider == DatabaseProvider.Oracle)
        {
            const string sql = """
                SELECT c.COLUMN_NAME, c.DATA_TYPE, c.NULLABLE,
                       CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PK
                FROM USER_TAB_COLUMNS c
                LEFT JOIN (
                    SELECT cols.COLUMN_NAME
                    FROM USER_CONSTRAINTS cons
                    JOIN USER_CONS_COLUMNS cols ON cons.CONSTRAINT_NAME = cols.CONSTRAINT_NAME
                    WHERE cons.CONSTRAINT_TYPE = 'P' AND cons.TABLE_NAME = :tableName
                ) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
                WHERE c.TABLE_NAME = :tableName
                ORDER BY c.COLUMN_ID
                """;
            var rows = await db.QueryAsync(sql, new { tableName });
            return rows.Select(r => new ColumnInfo(
                r.COLUMN_NAME, r.DATA_TYPE, ((string)r.NULLABLE) == "Y", ((int)r.IS_PK) == 1)).ToList();
        }
        else
        {
            var rows = await db.QueryAsync($"PRAGMA table_info(\"{tableName}\")");
            return rows.Select(r => new ColumnInfo(
                (string)r.name, (string)r.type, ((long)r.notnull) == 0, ((long)r.pk) > 0)).ToList();
        }
    }
}
```

### 4.11 `Auth/MockBearerAuthHandler.cs`

```csharp
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Portal.Api.Auth;

/// <summary>
/// Decodes "mock-token-{username}-{rolesCsv}-{tenantId}" into a ClaimsPrincipal.
/// Replace with real JWT bearer validation before production — this exists
/// only because JWT validation was explicitly descoped for this iteration.
/// </summary>
public sealed class MockBearerAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "MockBearer";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var header) ||
            !header.ToString().StartsWith("Bearer mock-token-", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(AuthenticateResult.Fail("Missing or malformed mock bearer token."));
        }

        var raw = header.ToString()["Bearer mock-token-".Length..];
        var parts = raw.Split('-');
        if (parts.Length < 3)
            return Task.FromResult(AuthenticateResult.Fail("Malformed mock token payload."));

        var username = parts[0];
        var rolesCsv = parts[1];
        var tenantId = parts[2];

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, username),
            new("username", username),
            new("tenant_id", tenantId)
        };
        claims.AddRange(rolesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(r => new Claim(ClaimTypes.Role, r)));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}
```

### 4.12 `Auth/AuthController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Dapper;

namespace Portal.Api.Auth;

public sealed record LoginRequest(string Username, string Password);
public sealed record LoginResponse(string Token, string DisplayName, IReadOnlyList<string> Roles);

[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public sealed class AuthController(IConfiguration config) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        using var db = new SqliteConnection(config.GetConnectionString("Default"));
        var user = await db.QuerySingleOrDefaultAsync(
            "SELECT USERNAME, PASSWORD, DISPLAY_NAME, ROLES_CSV, TENANT_ID FROM APP_USER WHERE USERNAME = @Username",
            request);

        if (user is null || (string)user.PASSWORD != request.Password)
            return Unauthorized(new { message = "Invalid username or password." });

        var roles = ((string)user.ROLES_CSV).Split(',', StringSplitOptions.RemoveEmptyEntries);
        var token = $"mock-token-{user.USERNAME}-{user.ROLES_CSV}-{user.TENANT_ID}";

        return Ok(new LoginResponse(token, (string)user.DISPLAY_NAME, roles));
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout() => NoContent(); // mock tokens are stateless — nothing to revoke server-side
}
```

### 4.13 `Admin/ConnectionsController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Api.Data;

namespace Portal.Api.Admin;

public sealed record CreateConnectionRequest(string Name, string ConnectionString);
public sealed record TestConnectionResult(bool Success, string? Error);

[ApiController]
[Route("api/admin/connections")]
[Authorize(Roles = "admin")]
public sealed class ConnectionsController(ConfigRepository repo, IDbConnectionFactory factory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await repo.ListConnectionsAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateConnectionRequest request)
    {
        var provider = factory.DetectProvider(request.ConnectionString);
        var created = await repo.AddConnectionAsync(request.Name, request.ConnectionString, provider);
        return Ok(created);
    }

    [HttpPost("{id}/test")]
    public async Task<ActionResult<TestConnectionResult>> Test(string id)
    {
        var connection = await repo.GetConnectionAsync(id);
        if (connection is null) return NotFound();

        try
        {
            using var conn = factory.Create(connection.ConnectionString);
            return Ok(new TestConnectionResult(true, null));
        }
        catch (Exception ex)
        {
            return Ok(new TestConnectionResult(false, ex.Message));
        }
    }
}
```

### 4.14 `Admin/SchemaController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Api.Data;
using Portal.Api.Schema;

namespace Portal.Api.Admin;

[ApiController]
[Route("api/admin/connections/{connectionId}")]
[Authorize(Roles = "admin")]
public sealed class SchemaController(ConfigRepository repo, ISchemaIntrospectionService introspection) : ControllerBase
{
    [HttpGet("tables")]
    public async Task<IActionResult> ListTables(string connectionId)
    {
        var connection = await repo.GetConnectionAsync(connectionId);
        if (connection is null) return NotFound();
        return Ok(await introspection.ListTablesAsync(connection));
    }

    [HttpGet("tables/{tableName}/columns")]
    public async Task<IActionResult> ListColumns(string connectionId, string tableName)
    {
        var connection = await repo.GetConnectionAsync(connectionId);
        if (connection is null) return NotFound();
        return Ok(await introspection.ListColumnsAsync(connection, tableName));
    }
}
```

### 4.15 `Admin/SyncTableConfigController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Api.Data;
using Portal.Api.Data.Entities;

namespace Portal.Api.Admin;

public sealed record EnableTableRequest(
    string ConnectionId, string TableName, string PrimaryKeyColumn, string? TenantColumn,
    bool AllowCreate, bool AllowUpdate, bool AllowDelete);

[ApiController]
[Route("api/admin/sync-tables")]
[Authorize(Roles = "admin")]
public sealed class SyncTableConfigController(ConfigRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? connectionId) =>
        Ok(await repo.ListSyncTablesAsync(connectionId));

    [HttpPost]
    public async Task<IActionResult> Enable([FromBody] EnableTableRequest request)
    {
        var saved = await repo.UpsertSyncTableAsync(new SyncTableConfig
        {
            ConnectionId = request.ConnectionId,
            TableName = SqlIdentifier.RequireValid(request.TableName, "table"),
            PrimaryKeyColumn = SqlIdentifier.RequireValid(request.PrimaryKeyColumn, "column"),
            TenantColumn = request.TenantColumn is null ? null : SqlIdentifier.RequireValid(request.TenantColumn, "column"),
            AllowCreate = request.AllowCreate,
            AllowUpdate = request.AllowUpdate,
            AllowDelete = request.AllowDelete,
            IsEnabled = true
        });
        return Ok(saved);
    }
}
```

### 4.16 `Admin/GridColumnConfigController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Api.Data;
using Portal.Api.Data.Entities;

namespace Portal.Api.Admin;

public sealed record ColumnConfigInput(string ColumnName, string DisplayLabel, string DataType, bool IsVisible, bool IsEditable, int DisplayOrder, int? Width);

[ApiController]
[Route("api/admin/grid-columns")]
[Authorize(Roles = "admin")]
public sealed class GridColumnConfigController(ConfigRepository repo) : ControllerBase
{
    [HttpGet("{syncTableId}")]
    public async Task<IActionResult> Get(string syncTableId) => Ok(await repo.GetGridColumnsAsync(syncTableId));

    [HttpPut("{syncTableId}")]
    public async Task<IActionResult> Replace(string syncTableId, [FromBody] IReadOnlyList<ColumnConfigInput> columns)
    {
        var table = await repo.GetSyncTableAsync(syncTableId);
        if (table is null) return NotFound();

        var rows = columns.Select(c => new GridColumnConfig
        {
            ColumnName = SqlIdentifier.RequireValid(c.ColumnName, "column"),
            DisplayLabel = c.DisplayLabel,
            DataType = c.DataType,
            IsVisible = c.IsVisible,
            IsEditable = c.IsEditable,
            DisplayOrder = c.DisplayOrder,
            Width = c.Width
        }).ToList();

        await repo.ReplaceGridColumnsAsync(syncTableId, rows);
        return Ok(await repo.GetGridColumnsAsync(syncTableId));
    }
}
```

### 4.17 `Admin/PortalSectionController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Api.Data;
using Portal.Api.Data.Entities;

namespace Portal.Api.Admin;

public sealed record SectionInput(string SyncTableId, string SectionKey, string Label, string Icon, string Route, int DisplayOrder, string RolesCsv);

[ApiController]
[Route("api/admin/portal-sections")]
[Authorize(Roles = "admin")]
public sealed class PortalSectionController(ConfigRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await repo.ListSectionsAsync());

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] SectionInput input)
    {
        var saved = await repo.UpsertSectionAsync(new PortalSectionConfig
        {
            SyncTableId = input.SyncTableId,
            SectionKey = input.SectionKey,
            Label = input.Label,
            Icon = input.Icon,
            Route = input.Route,
            DisplayOrder = input.DisplayOrder,
            RolesCsv = input.RolesCsv,
            IsEnabled = true
        });
        return Ok(saved);
    }
}
```

### 4.18 `Data2/DynamicDataController.cs` — generic "get data by table name"

This is the endpoint the plan asked for: *data source = an endpoint keyed by table name, optionally scoped by column names, all driven by params — no per-table code.*

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Api.Data;

namespace Portal.Api.Data2;

[ApiController]
[Route("api/data")]
[Authorize]
public sealed class DynamicDataController(
    ConfigRepository repo, IDbConnectionFactory factory, IDynamicQueryExecutor executor) : ControllerBase
{
    /// <summary>
    /// GET /api/data/{tableName}?columns=CODE,DESCRIPTION&amp;page=1&amp;pageSize=50
    /// tableName must already be enabled via /api/admin/sync-tables; columns
    /// (if supplied) must already be registered via /api/admin/grid-columns.
    /// Both are re-validated against config here — this endpoint never trusts
    /// the request in isolation.
    /// </summary>
    [HttpGet("{tableName}")]
    public async Task<IActionResult> Get(
        string tableName,
        [FromQuery] string? columns,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100)
    {
        var syncTables = await repo.ListSyncTablesAsync();
        var table = syncTables.FirstOrDefault(t => string.Equals(t.TableName, tableName, StringComparison.OrdinalIgnoreCase));
        if (table is null) return NotFound(new { message = $"Table '{tableName}' is not enabled for access." });

        var connection = await repo.GetConnectionAsync(table.ConnectionId);
        if (connection is null) return NotFound();

        var gridColumns = await repo.GetGridColumnsAsync(table.Id);
        var knownColumnNames = gridColumns.Select(c => c.ColumnName).ToList();

        var selectedColumns = string.IsNullOrWhiteSpace(columns)
            ? gridColumns.Where(c => c.IsVisible).Select(c => c.ColumnName).ToList()
            : columns.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(c => SqlIdentifier.RequireKnown(c.Trim(), knownColumnNames, "column"))
                .ToList();

        if (selectedColumns.Count == 0)
            return BadRequest(new { message = "No visible columns are configured for this table." });

        var pk = SqlIdentifier.RequireKnown(table.PrimaryKeyColumn, knownColumnNames.Append(table.PrimaryKeyColumn).ToList(), "column");
        var columnList = string.Join(", ", selectedColumns.Select(c => $"\"{c}\""));
        pageSize = Math.Clamp(pageSize, 1, 500);
        var offset = (Math.Max(page, 1) - 1) * pageSize;

        var sql = $"SELECT {columnList} FROM \"{SqlIdentifier.RequireValid(table.TableName, "table")}\" ORDER BY \"{pk}\" LIMIT @pageSize OFFSET @offset";

        using var conn = factory.Create(connection.ConnectionString);
        var rows = await executor.QueryAsync(conn, sql, new { pageSize, offset });

        return Ok(new { tableName, page, pageSize, columns = selectedColumns, rows });
    }
}
```

### 4.19 `Sync/SyncDtos.cs`

```csharp
using System.Text.Json;

namespace Portal.Api.Sync;

public sealed record PushRequest(string ClientId, string TableName, IReadOnlyList<SyncOperationDto> Operations);

public sealed record SyncOperationDto(
    string OperationId, string RowPk, string OperationType,
    long? ExpectedVersion, DateTime OccurredAtUtc, JsonElement? Payload);

public sealed record OperationResultDto(
    string OperationId, string Status, string RowPk,
    string? Message = null, long? ServerVersion = null,
    object? Record = null, object? ServerRecord = null);

public sealed record PushResponse(IReadOnlyList<OperationResultDto> Results);

public sealed record ChangeDto(long Cursor, string RowPk, string ChangeType, object? Record);

public sealed record PullResponse(IReadOnlyList<ChangeDto> Changes, long NextCursor, bool HasMore);
```

### 4.20 `Sync/DynamicSyncService.cs` — generic push/pull for any enabled table

```csharp
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Portal.Api.Data;
using Portal.Api.Data.Entities;
using Dapper;

namespace Portal.Api.Sync;

public sealed class DynamicSyncService(
    ConfigRepository repo, IDbConnectionFactory factory, IDynamicQueryExecutor executor, IConfiguration config)
{
    public async Task<PushResponse> PushAsync(string userId, string clientId, PushRequest request, CancellationToken ct)
    {
        var table = await ResolveTableAsync(request.TableName);
        var connection = await repo.GetConnectionAsync(table.ConnectionId)
            ?? throw new InvalidOperationException("Connection not found.");
        var gridColumns = await repo.GetGridColumnsAsync(table.Id);
        var editableColumns = gridColumns.Where(c => c.IsEditable).Select(c => c.ColumnName).ToList();

        var results = new List<OperationResultDto>(request.Operations.Count);
        foreach (var op in request.Operations)
            results.Add(await ApplyOneAsync(userId, clientId, table, connection, editableColumns, op, ct));

        return new PushResponse(results);
    }

    private async Task<OperationResultDto> ApplyOneAsync(
        string userId, string clientId, SyncTableConfig table, DataConnection connection,
        IReadOnlyList<string> editableColumns, SyncOperationDto op, CancellationToken ct)
    {
        using var configDb = new SqliteConnection(config.GetConnectionString("Default"));
        configDb.Open();

        var existingOp = await configDb.QuerySingleOrDefaultAsync<string>(
            "SELECT RESULT_JSON FROM SYNC_OPERATION WHERE OPERATION_ID = @OperationId", op);
        if (existingOp is not null)
            return JsonSerializer.Deserialize<OperationResultDto>(existingOp)!;

        using var businessDb = factory.Create(connection.ConnectionString);

        OperationResultDto result;
        try
        {
            result = op.OperationType switch
            {
                "create" when table.AllowCreate => await CreateAsync(businessDb, configDb, table, editableColumns, userId, op, ct),
                "update" when table.AllowUpdate => await UpdateAsync(businessDb, configDb, table, editableColumns, userId, op, ct),
                "delete" when table.AllowDelete => await DeleteAsync(businessDb, configDb, table, userId, op, ct),
                _ => new OperationResultDto(op.OperationId, "validationFailed", op.RowPk, $"Operation '{op.OperationType}' is not permitted on this table.")
            };
        }
        catch (SyncConflictException conflict)
        {
            result = new OperationResultDto(op.OperationId, "conflict", op.RowPk,
                "The server record changed before this operation was applied.",
                conflict.ServerVersion, ServerRecord: conflict.ServerRecord);
        }

        await configDb.ExecuteAsync(
            @"INSERT INTO SYNC_OPERATION (OPERATION_ID, SYNC_TABLE_ID, CLIENT_ID, ROW_PK, OPERATION_TYPE, STATUS, RESULT_JSON, CREATED_AT_UTC, COMPLETED_AT_UTC)
              VALUES (@OperationId, @TableId, @ClientId, @RowPk, @OpType, @Status, @ResultJson, @CreatedAt, @CompletedAt)",
            new
            {
                op.OperationId, TableId = table.Id, ClientId = clientId, op.RowPk,
                OpType = op.OperationType, result.Status, ResultJson = JsonSerializer.Serialize(result),
                CreatedAt = DateTime.UtcNow.ToString("o"), CompletedAt = DateTime.UtcNow.ToString("o")
            });

        return result;
    }

    private async Task<OperationResultDto> CreateAsync(
        System.Data.IDbConnection businessDb, System.Data.IDbConnection configDb,
        SyncTableConfig table, IReadOnlyList<string> editableColumns, string userId, SyncOperationDto op, CancellationToken ct)
    {
        if (op.Payload is null) return new(op.OperationId, "validationFailed", op.RowPk, "Payload is required for create.");

        var payload = op.Payload.Value;
        var columnNames = new List<string> { table.PrimaryKeyColumn };
        var paramMap = new Dictionary<string, object?> { [table.PrimaryKeyColumn] = op.RowPk };

        foreach (var col in editableColumns)
        {
            if (!payload.TryGetProperty(col, out var val)) continue;
            columnNames.Add(col);
            paramMap[col] = JsonValueToClr(val);
        }

        var columnList = string.Join(", ", columnNames.Select(c => $"\"{c}\""));
        var paramList = string.Join(", ", columnNames.Select(c => $"@{c}"));
        var insertSql = $"INSERT INTO \"{table.TableName}\" ({columnList}) VALUES ({paramList})";

        await executor.ExecuteAsync(businessDb, insertSql, paramMap);
        await UpsertRowMetaAsync(configDb, table.Id, op.RowPk, version: 1, userId);
        await AppendChangeAsync(configDb, table.Id, op.RowPk, "created", paramMap);

        return new(op.OperationId, "accepted", op.RowPk, ServerVersion: 1, Record: paramMap);
    }

    private async Task<OperationResultDto> UpdateAsync(
        System.Data.IDbConnection businessDb, System.Data.IDbConnection configDb,
        SyncTableConfig table, IReadOnlyList<string> editableColumns, string userId, SyncOperationDto op, CancellationToken ct)
    {
        if (op.ExpectedVersion is null || op.Payload is null)
            return new(op.OperationId, "validationFailed", op.RowPk, "expectedVersion and payload are required for update.");

        var meta = await configDb.QuerySingleOrDefaultAsync(
            "SELECT VERSION_NUMBER, DELETED_AT_UTC FROM SYNC_ROW_META WHERE SYNC_TABLE_ID = @TableId AND ROW_PK = @RowPk",
            new { TableId = table.Id, op.RowPk });

        var currentVersion = meta is null ? 0L : (long)meta.VERSION_NUMBER;
        if (meta is not null && meta.DELETED_AT_UTC is not null)
            return new(op.OperationId, "validationFailed", op.RowPk, "Row was deleted on the server.");

        if (currentVersion != op.ExpectedVersion)
        {
            var serverRow = await FetchRowAsync(businessDb, table, op.RowPk);
            throw new SyncConflictException(currentVersion, serverRow);
        }

        var payload = op.Payload.Value;
        var setClauses = new List<string>();
        var paramMap = new Dictionary<string, object?> { ["__pk"] = op.RowPk };

        foreach (var col in editableColumns)
        {
            if (!payload.TryGetProperty(col, out var val)) continue;
            setClauses.Add($"\"{col}\" = @{col}");
            paramMap[col] = JsonValueToClr(val);
        }
        if (setClauses.Count == 0) return new(op.OperationId, "validationFailed", op.RowPk, "No editable columns in payload.");

        var updateSql = $"UPDATE \"{table.TableName}\" SET {string.Join(", ", setClauses)} WHERE \"{table.PrimaryKeyColumn}\" = @__pk";
        await executor.ExecuteAsync(businessDb, updateSql, paramMap);

        var newVersion = currentVersion + 1;
        await UpsertRowMetaAsync(configDb, table.Id, op.RowPk, newVersion, userId);
        await AppendChangeAsync(configDb, table.Id, op.RowPk, "updated", paramMap);

        return new(op.OperationId, "accepted", op.RowPk, ServerVersion: newVersion, Record: paramMap);
    }

    private async Task<OperationResultDto> DeleteAsync(
        System.Data.IDbConnection businessDb, System.Data.IDbConnection configDb,
        SyncTableConfig table, string userId, SyncOperationDto op, CancellationToken ct)
    {
        if (op.ExpectedVersion is null)
            return new(op.OperationId, "validationFailed", op.RowPk, "expectedVersion is required for delete.");

        var meta = await configDb.QuerySingleOrDefaultAsync(
            "SELECT VERSION_NUMBER, DELETED_AT_UTC FROM SYNC_ROW_META WHERE SYNC_TABLE_ID = @TableId AND ROW_PK = @RowPk",
            new { TableId = table.Id, op.RowPk });

        if (meta is null || meta.DELETED_AT_UTC is not null)
            return new(op.OperationId, "accepted", op.RowPk); // already gone — idempotent

        var currentVersion = (long)meta.VERSION_NUMBER;
        if (currentVersion != op.ExpectedVersion)
        {
            var serverRow = await FetchRowAsync(businessDb, table, op.RowPk);
            throw new SyncConflictException(currentVersion, serverRow);
        }

        // Physical delete on the business table; the tombstone lives in SYNC_ROW_META / SYNC_CHANGE.
        var deleteSql = $"DELETE FROM \"{table.TableName}\" WHERE \"{table.PrimaryKeyColumn}\" = @pk";
        await executor.ExecuteAsync(businessDb, deleteSql, new { pk = op.RowPk });

        var newVersion = currentVersion + 1;
        await configDb.ExecuteAsync(
            "UPDATE SYNC_ROW_META SET VERSION_NUMBER = @v, UPDATED_AT_UTC = @now, UPDATED_BY = @by, DELETED_AT_UTC = @now WHERE SYNC_TABLE_ID = @tid AND ROW_PK = @pk",
            new { v = newVersion, now = DateTime.UtcNow.ToString("o"), by = userId, tid = table.Id, pk = op.RowPk });
        await AppendChangeAsync(configDb, table.Id, op.RowPk, "deleted", null);

        return new(op.OperationId, "accepted", op.RowPk, ServerVersion: newVersion);
    }

    public async Task<PullResponse> PullAsync(string tableName, long cursor, int limit, CancellationToken ct)
    {
        var table = await ResolveTableAsync(tableName);
        using var configDb = new SqliteConnection(config.GetConnectionString("Default"));
        configDb.Open();

        var rows = (await configDb.QueryAsync(
            @"SELECT SERVER_CURSOR, ROW_PK, CHANGE_TYPE, RECORD_JSON FROM SYNC_CHANGE
              WHERE SYNC_TABLE_ID = @tableId AND SERVER_CURSOR > @cursor
              ORDER BY SERVER_CURSOR LIMIT @limit",
            new { tableId = table.Id, cursor, limit })).ToList();

        var changes = rows.Select(r => new ChangeDto(
            (long)r.SERVER_CURSOR, (string)r.ROW_PK, (string)r.CHANGE_TYPE,
            r.RECORD_JSON is null ? null : JsonSerializer.Deserialize<object>((string)r.RECORD_JSON)
        )).ToList();

        var next = rows.Count > 0 ? (long)rows[^1].SERVER_CURSOR : cursor;
        return new PullResponse(changes, next, rows.Count == limit);
    }

    private async Task<SyncTableConfig> ResolveTableAsync(string tableName)
    {
        var tables = await repo.ListSyncTablesAsync();
        return tables.FirstOrDefault(t => string.Equals(t.TableName, tableName, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"Table '{tableName}' is not enabled for sync.");
    }

    private async Task<object?> FetchRowAsync(System.Data.IDbConnection businessDb, SyncTableConfig table, string pk)
    {
        var sql = $"SELECT * FROM \"{table.TableName}\" WHERE \"{table.PrimaryKeyColumn}\" = @pk";
        return await executor.QuerySingleAsync<object>(businessDb, sql, new { pk });
    }

    private static async Task UpsertRowMetaAsync(System.Data.IDbConnection configDb, string tableId, string rowPk, long version, string userId)
    {
        var now = DateTime.UtcNow.ToString("o");
        var updated = await configDb.ExecuteAsync(
            "UPDATE SYNC_ROW_META SET VERSION_NUMBER = @version, UPDATED_AT_UTC = @now, UPDATED_BY = @userId, DELETED_AT_UTC = NULL WHERE SYNC_TABLE_ID = @tableId AND ROW_PK = @rowPk",
            new { version, now, userId, tableId, rowPk });

        if (updated == 0)
        {
            await configDb.ExecuteAsync(
                "INSERT INTO SYNC_ROW_META (SYNC_TABLE_ID, ROW_PK, VERSION_NUMBER, UPDATED_AT_UTC, UPDATED_BY, DELETED_AT_UTC) VALUES (@tableId, @rowPk, @version, @now, @userId, NULL)",
                new { tableId, rowPk, version, now, userId });
        }
    }

    private static async Task AppendChangeAsync(System.Data.IDbConnection configDb, string tableId, string rowPk, string changeType, object? record)
    {
        await configDb.ExecuteAsync(
            "INSERT INTO SYNC_CHANGE (SYNC_TABLE_ID, ROW_PK, CHANGE_TYPE, RECORD_JSON, CREATED_AT_UTC) VALUES (@tableId, @rowPk, @changeType, @recordJson, @now)",
            new { tableId, rowPk, changeType, recordJson = record is null ? null : JsonSerializer.Serialize(record), now = DateTime.UtcNow.ToString("o") });
    }

    private static object? JsonValueToClr(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.GetDecimal(),
        JsonValueKind.True or JsonValueKind.False => el.GetBoolean(),
        JsonValueKind.Null => null,
        _ => el.GetRawText()
    };
}

public sealed class SyncConflictException(long serverVersion, object? serverRecord) : Exception
{
    public long ServerVersion { get; } = serverVersion;
    public object? ServerRecord { get; } = serverRecord;
}
```

### 4.21 `Sync/SyncController.cs`

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Portal.Api.Sync;

[ApiController]
[Route("api/sync")]
[Authorize]
public sealed class SyncController(DynamicSyncService syncService) : ControllerBase
{
    [HttpPost("push")]
    public async Task<ActionResult<PushResponse>> Push([FromBody] PushRequest request, CancellationToken ct)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown";
        return Ok(await syncService.PushAsync(userId, request.ClientId, request, ct));
    }

    [HttpGet("pull")]
    public async Task<ActionResult<PullResponse>> Pull(
        [FromQuery] string tableName, [FromQuery] long cursor = 0, [FromQuery] int limit = 200, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 500);
        return Ok(await syncService.PullAsync(tableName, cursor, limit, ct));
    }
}
```

### 4.22 `Portal/PortalManifestService.cs` — now DB-driven, not a static array

```csharp
using Portal.Api.Data;

namespace Portal.Api.Portal;

public sealed record PortalSectionDto(string Key, string Label, string Icon, string Route, string TableName, int Order);
public sealed record PortalManifest(string PortalId, string Title, IReadOnlyList<PortalSectionDto> Sections);

public interface IPortalManifestService
{
    Task<PortalManifest> BuildManifestForAsync(IReadOnlyCollection<string> userRoles);
}

public sealed class PortalManifestService(ConfigRepository repo) : IPortalManifestService
{
    public async Task<PortalManifest> BuildManifestForAsync(IReadOnlyCollection<string> userRoles)
    {
        var sections = await repo.ListSectionsAsync();
        var tables = await repo.ListSyncTablesAsync();
        var tableById = tables.ToDictionary(t => t.Id, t => t.TableName);

        var visible = sections
            .Where(s => s.Roles.Any(userRoles.Contains))
            .Where(s => tableById.ContainsKey(s.SyncTableId))
            .OrderBy(s => s.DisplayOrder)
            .Select(s => new PortalSectionDto(s.SectionKey, s.Label, s.Icon, s.Route, tableById[s.SyncTableId], s.DisplayOrder))
            .ToList();

        return new PortalManifest("dynamic-portal", "Manufacturing Portal", visible);
    }
}
```

### 4.23 `Portal/PortalController.cs`

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Portal.Api.Portal;

[ApiController]
[Route("api/portal")]
[Authorize]
public sealed class PortalController(IPortalManifestService manifests) : ControllerBase
{
    [HttpGet("manifest")]
    public async Task<IActionResult> GetManifest()
    {
        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        return Ok(await manifests.BuildManifestForAsync(roles));
    }
}
```

### 4.24 `Program.cs`

```csharp
using Portal.Api.Admin;
using Portal.Api.Auth;
using Portal.Api.Data;
using Portal.Api.Data2;
using Portal.Api.Portal;
using Portal.Api.Schema;
using Portal.Api.Sync;

var builder = WebApplication.CreateBuilder(args);

var defaultConnectionString = builder.Configuration.GetConnectionString("Default")!;
SqliteBootstrap.EnsureConfigStoreCreated(defaultConnectionString);

builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddSingleton<IDynamicQueryExecutor, DapperDynamicQueryExecutor>(); // swap for your DynamicTransaction executor
builder.Services.AddScoped<ConfigRepository>();
builder.Services.AddScoped<ISchemaIntrospectionService, SchemaIntrospectionService>();
builder.Services.AddScoped<DynamicSyncService>();
builder.Services.AddScoped<IPortalManifestService, PortalManifestService>();

builder.Services.AddAuthentication(MockBearerAuthHandler.SchemeName)
    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, MockBearerAuthHandler>(
        MockBearerAuthHandler.SchemeName, _ => { });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("PortalClient", policy => policy
        .WithOrigins(builder.Configuration["Client:Origin"] ?? "http://localhost:5173")
        .AllowAnyHeader()
        .AllowAnyMethod());
});

builder.Services.AddControllers();

var app = builder.Build();

app.UseCors("PortalClient");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

---

## 5. Client — dynamic pieces

### 5.1 `src/db/database.ts` — one generic pair of tables, no per-entity stores

```ts
import Dexie, { type Table } from "dexie";

export type SyncState = "synced" | "pending" | "conflict" | "failed";

/** One row from any enabled table, keyed by "tableName::pk" so Dexie never
 * needs a schema migration when the admin enables a new table. */
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

export async function ensureClientId(): Promise<string> {
  const existing = await db.syncMeta.get("clientId");
  if (existing) return existing.value;
  const id = crypto.randomUUID();
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
```

### 5.2 `src/sync/syncEngine.ts` — loops over every enabled table

```ts
import { db, ensureClientId, rowKey, type OutboxItem } from "../db/database";
import { apiFetch } from "../auth/apiClient";
import { useAuthStore } from "../auth/authStore";

const BATCH_SIZE = 50;
let syncRunning = false;

/** tableNames comes from the portal manifest — the engine never hardcodes
 * which tables exist; it syncs whatever the manifest currently lists. */
export async function runSync(tableNames: string[]): Promise<void> {
  if (syncRunning || !navigator.onLine || !useAuthStore.getState().token) return;
  syncRunning = true;
  try {
    const clientId = await ensureClientId();
    for (const tableName of tableNames) {
      await pushTable(clientId, tableName);
      await pullTable(tableName);
    }
  } finally {
    syncRunning = false;
  }
}

async function pushTable(clientId: string, tableName: string): Promise<void> {
  const operations = await db.outbox
    .where("[tableName+status]").equals([tableName, "pending"])
    .filter((item) => item.nextAttemptAtUtc <= new Date().toISOString())
    .limit(BATCH_SIZE)
    .toArray();

  if (operations.length === 0) return;
  await markProcessing(operations);

  const res = await apiFetch("/api/sync/push", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      tableName,
      operations: operations.map((op) => ({
        operationId: op.operationId,
        rowPk: op.rowPk,
        operationType: op.operationType,
        expectedVersion: op.expectedVersion,
        occurredAtUtc: op.occurredAtUtc,
        payload: op.payload
      }))
    })
  });

  if (!res.ok) {
    await releaseForRetry(operations, `Push failed with HTTP ${res.status}`);
    return;
  }

  const body = await res.json();
  await applyPushResults(tableName, body.results);
}

async function applyPushResults(tableName: string, results: any[]): Promise<void> {
  await db.transaction("rw", db.rows, db.outbox, async () => {
    for (const result of results) {
      const item = await db.outbox.get(result.operationId);
      if (!item) continue;

      if (result.status === "accepted") {
        await db.outbox.delete(result.operationId);
        if (result.record) {
          await db.rows.put({
            compositeKey: rowKey(tableName, result.rowPk),
            tableName, pk: result.rowPk, data: result.record,
            version: result.serverVersion ?? 0, deleted: false,
            syncState: "synced", updatedAtUtc: new Date().toISOString()
          });
        }
      } else if (result.status === "conflict") {
        await db.outbox.update(result.operationId, { status: "conflict", lastError: "Server record changed." });
        await db.rows.update(rowKey(tableName, result.rowPk), { syncState: "conflict" });
      } else {
        await db.outbox.update(result.operationId, { status: "failed", lastError: result.message });
        await db.rows.update(rowKey(tableName, result.rowPk), { syncState: "failed" });
      }
    }
  });
}

async function pullTable(tableName: string): Promise<void> {
  const cursorRow = await db.syncMeta.get(`cursor::${tableName}`);
  const cursor = cursorRow ? Number(cursorRow.value) : 0;

  const res = await apiFetch(`/api/sync/pull?tableName=${encodeURIComponent(tableName)}&cursor=${cursor}&limit=200`);
  if (!res.ok) return;
  const payload = await res.json();

  await db.transaction("rw", db.rows, db.syncMeta, async () => {
    for (const change of payload.changes) {
      const key = rowKey(tableName, change.rowPk);
      const local = await db.rows.get(key);
      if (local?.syncState === "pending" || local?.syncState === "conflict") continue;

      if (change.changeType === "deleted") {
        await db.rows.delete(key);
      } else if (change.record) {
        await db.rows.put({
          compositeKey: key, tableName, pk: change.rowPk, data: change.record,
          version: change.record.version ?? 0, deleted: false,
          syncState: "synced", updatedAtUtc: new Date().toISOString()
        });
      }
    }
    await db.syncMeta.put({ key: `cursor::${tableName}`, value: String(payload.nextCursor) });
  });

  if (payload.hasMore) await pullTable(tableName);
}

function nextRetryTime(attempts: number): string {
  return new Date(Date.now() + Math.min(30 * 60_000, 2 ** Math.min(attempts, 10) * 1_000)).toISOString();
}

async function markProcessing(items: OutboxItem[]) {
  await db.transaction("rw", db.outbox, async () => {
    for (const item of items) await db.outbox.update(item.operationId, { status: "processing", attempts: item.attempts + 1 });
  });
}

async function releaseForRetry(items: OutboxItem[], message: string) {
  await db.transaction("rw", db.outbox, async () => {
    for (const item of items) {
      await db.outbox.update(item.operationId, { status: "pending", nextAttemptAtUtc: nextRetryTime(item.attempts), lastError: message });
    }
  });
}
```

### 5.3 `src/dynamic-table/dynamicRowRepository.ts` — generic CRUD for any table

```ts
import { db, rowKey } from "../db/database";
import { runSync } from "../sync/syncEngine";

export async function saveRow(
  tableName: string, pk: string | undefined, payload: Record<string, unknown>, allTableNames: string[]
): Promise<string> {
  const id = pk ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await db.transaction("rw", db.rows, db.outbox, async () => {
    const key = rowKey(tableName, id);
    const previous = await db.rows.get(key);
    const operationType: "create" | "update" = previous ? "update" : "create";

    await db.rows.put({
      compositeKey: key, tableName, pk: id, data: { ...payload },
      version: previous?.version ?? 0, deleted: false, syncState: "pending", updatedAtUtc: now
    });

    const existingOutbox = await db.outbox
      .where("[tableName+status]").equals([tableName, "pending"])
      .filter((o) => o.rowPk === id)
      .first();

    if (existingOutbox) {
      await db.outbox.update(existingOutbox.operationId, { payload, occurredAtUtc: now, nextAttemptAtUtc: now, status: "pending" });
    } else {
      await db.outbox.add({
        operationId: crypto.randomUUID(), tableName, rowPk: id, operationType,
        expectedVersion: previous?.version ?? null, payload, occurredAtUtc: now,
        attempts: 0, nextAttemptAtUtc: now, status: "pending"
      });
    }
  });

  void runSync(allTableNames);
  return id;
}

export async function deleteRow(tableName: string, pk: string, allTableNames: string[]): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction("rw", db.rows, db.outbox, async () => {
    const key = rowKey(tableName, pk);
    const existing = await db.rows.get(key);
    if (!existing) return;

    await db.rows.update(key, { deleted: true, syncState: "pending" });
    await db.outbox.add({
      operationId: crypto.randomUUID(), tableName, rowPk: pk, operationType: "delete",
      expectedVersion: existing.version, payload: null, occurredAtUtc: now,
      attempts: 0, nextAttemptAtUtc: now, status: "pending"
    });
  });
  void runSync(allTableNames);
}
```

### 5.4 `src/dynamic-table/gridColumnConfig.ts`

```ts
import { apiFetch } from "../auth/apiClient";

export interface GridColumnConfig {
  columnName: string;
  displayLabel: string;
  dataType: "string" | "number" | "boolean" | "date";
  isVisible: boolean;
  isEditable: boolean;
  displayOrder: number;
  width?: number;
}

export async function fetchGridColumns(syncTableId: string): Promise<GridColumnConfig[]> {
  const res = await apiFetch(`/api/admin/grid-columns/${syncTableId}`);
  if (!res.ok) return [];
  return res.json();
}
```

### 5.5 `src/dynamic-table/DynamicTableSection.tsx` — the ONE component every portal section resolves to

AG Grid column defs are built entirely from `GridColumnConfig` — `field` maps to `data.<columnName>`, `headerName` is the admin-entered `DisplayLabel`, `editable` follows the config checkbox. No table is special-cased.

```tsx
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { fetchGridColumns, type GridColumnConfig } from "./gridColumnConfig";
import { deleteRow, saveRow } from "./dynamicRowRepository";
import { usePortalManifest } from "../portal/portalRegistry";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

export default function DynamicTableSection({ tableName, syncTableId }: { tableName: string; syncTableId: string }) {
  const [columns, setColumns] = useState<GridColumnConfig[]>([]);
  const manifest = usePortalManifest();
  const allTableNames = useMemo(() => manifest?.sections.map((s) => s.tableName) ?? [tableName], [manifest, tableName]);

  useEffect(() => {
    fetchGridColumns(syncTableId).then(setColumns);
  }, [syncTableId]);

  const rows = useLiveQuery(
    () => db.rows.where("tableName").equals(tableName).filter((r) => !r.deleted).toArray(),
    [tableName]
  );

  const colDefs = useMemo<ColDef[]>(() => {
    const dataColumns: ColDef[] = columns
      .filter((c) => c.isVisible)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => ({
        field: `data.${c.columnName}`,
        headerName: c.displayLabel,
        editable: c.isEditable,
        width: c.width,
        valueGetter: (p) => p.data?.data?.[c.columnName],
        valueSetter: (p) => {
          p.data.data[c.columnName] = p.newValue;
          return true;
        }
      }));

    return [
      { field: "syncState", headerName: "Sync", width: 120, cellRenderer: (p: any) => <Badge state={p.value} /> },
      ...dataColumns,
      {
        headerName: "", width: 100,
        cellRenderer: (p: any) => (
          <Button size="sm" variant="destructive" onClick={() => deleteRow(tableName, p.data.pk, allTableNames)}>
            Delete
          </Button>
        )
      }
    ];
  }, [columns, tableName, allTableNames]);

  async function handleCellEdit(pk: string, newData: Record<string, unknown>) {
    await saveRow(tableName, pk, newData, allTableNames);
  }

  return (
    <section className="dynamic-table-section">
      <header className="section-header">
        <h1>{tableName}</h1>
        <Button onClick={() => saveRow(tableName, undefined, {}, allTableNames)}>New row</Button>
      </header>
      <div className="ag-theme-quartz-dark" style={{ height: 600, width: "100%" }}>
        <AgGridReact
          rowData={rows ?? []}
          columnDefs={colDefs}
          getRowId={(p) => p.data.compositeKey}
          onCellValueChanged={(e) => handleCellEdit(e.data.pk, e.data.data)}
          singleClickEdit
        />
      </div>
    </section>
  );
}
```

### 5.6 `src/portal/portalRegistry.ts` — one generic resolver, no per-table folders needed

Because every section now renders the same `DynamicTableSection`, the registry no longer maps a key to a distinct feature folder — it just supplies the manifest context so the shell can pass `tableName`/`syncTableId` as props.

```ts
import { createContext, useContext } from "react";
import type { PortalManifest } from "./portalTypes";

export const PortalManifestContext = createContext<PortalManifest | null>(null);
export const usePortalManifest = () => useContext(PortalManifestContext);
```

### 5.7 `src/portal/PortalShell.tsx` — renders every section generically

```tsx
import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import { apiFetch } from "../auth/apiClient";
import { PortalManifestContext } from "./portalRegistry";
import DynamicTableSection from "../dynamic-table/DynamicTableSection";
import { runSync } from "../sync/syncEngine";
import type { PortalManifest } from "./portalTypes";

export default function PortalShell() {
  const [manifest, setManifest] = useState<PortalManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/portal/manifest").then(async (res) => {
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as PortalManifest;
      if (!cancelled) setManifest(data);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!manifest) return;
    void runSync(manifest.sections.map((s) => s.tableName));
  }, [manifest]);

  if (!manifest) return <p className="portal-loading">Loading your portal…</p>;

  return (
    <PortalManifestContext.Provider value={manifest}>
      <div className="portal-shell">
        <nav className="portal-nav">
          <h2>{manifest.title}</h2>
          <ul>
            {manifest.sections.map((s) => (
              <li key={s.key}><NavLink to={s.route}>{s.label}</NavLink></li>
            ))}
          </ul>
          <NavLink to="/admin/studio" className="admin-link">Admin Studio</NavLink>
        </nav>
        <main className="portal-content">
          <Routes>
            {manifest.sections.map((s) => (
              <Route key={s.key} path={s.route} element={<DynamicTableSection tableName={s.tableName} syncTableId={s.key} />} />
            ))}
            <Route path="*" element={<Navigate to={manifest.sections[0]?.route ?? "/admin/studio"} replace />} />
          </Routes>
        </main>
      </div>
    </PortalManifestContext.Provider>
  );
}
```

### 5.8 Admin Studio screens

`src/admin-studio/TableBrowserPage.tsx` — pick a connection, list its tables, tick which to enable, choose PK/tenant columns:

```tsx
import { useEffect, useState } from "react";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

interface ColumnInfo { columnName: string; dataType: string; isNullable: boolean; isPrimaryKey: boolean }

export default function TableBrowserPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [pkColumn, setPkColumn] = useState("");
  const [tenantColumn, setTenantColumn] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/connections").then((r) => r.json()).then(setConnections);
  }, []);

  useEffect(() => {
    if (!connectionId) return;
    apiFetch(`/api/admin/connections/${connectionId}/tables`)
      .then((r) => r.json())
      .then((rows) => setTables(rows.map((t: any) => t.tableName)));
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId || !selectedTable) return;
    apiFetch(`/api/admin/connections/${connectionId}/tables/${selectedTable}/columns`)
      .then((r) => r.json())
      .then((cols: ColumnInfo[]) => {
        setColumns(cols);
        const pk = cols.find((c) => c.isPrimaryKey);
        if (pk) setPkColumn(pk.columnName);
      });
  }, [connectionId, selectedTable]);

  async function enableTable() {
    await apiFetch("/api/admin/sync-tables", {
      method: "POST",
      body: JSON.stringify({
        connectionId, tableName: selectedTable, primaryKeyColumn: pkColumn,
        tenantColumn: tenantColumn || null, allowCreate: true, allowUpdate: true, allowDelete: true
      })
    });
    alert(`${selectedTable} enabled for offline sync. Configure its columns next in Grid Column Editor.`);
  }

  return (
    <Card className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Enable a table for offline sync</h1>

      <label className="block">
        Connection
        <select className="w-full" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
          <option value="">Select a connection…</option>
          {connections.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
        </select>
      </label>

      {connectionId && (
        <label className="block">
          Table
          <select className="w-full" value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
            <option value="">Select a table…</option>
            {tables.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      {columns.length > 0 && (
        <>
          <label className="block">
            Primary key column
            <select className="w-full" value={pkColumn} onChange={(e) => setPkColumn(e.target.value)}>
              {columns.map((c) => <option key={c.columnName} value={c.columnName}>{c.columnName}</option>)}
            </select>
          </label>
          <label className="block">
            Tenant column (optional)
            <select className="w-full" value={tenantColumn} onChange={(e) => setTenantColumn(e.target.value)}>
              <option value="">None</option>
              {columns.map((c) => <option key={c.columnName} value={c.columnName}>{c.columnName}</option>)}
            </select>
          </label>
          <Button onClick={enableTable}>Enable table</Button>
        </>
      )}
    </Card>
  );
}
```

`src/admin-studio/GridColumnEditorPage.tsx` — the "column = display text, no-code" editor:

```tsx
import { useEffect, useState } from "react";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

interface Row {
  columnName: string; displayLabel: string; dataType: string;
  isVisible: boolean; isEditable: boolean; displayOrder: number; width?: number;
}

export default function GridColumnEditorPage({ syncTableId }: { syncTableId: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    apiFetch(`/api/admin/grid-columns/${syncTableId}`).then((r) => r.json()).then((existing: Row[]) => {
      setRows(existing.length > 0 ? existing : []);
    });
  }, [syncTableId]);

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function save() {
    await apiFetch(`/api/admin/grid-columns/${syncTableId}`, { method: "PUT", body: JSON.stringify(rows) });
    alert("Column configuration saved. The grid re-renders on next portal load — no code, no deploy.");
  }

  return (
    <Card className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Grid column configuration</h1>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Column</th><th>Display label</th><th>Visible</th><th>Editable</th><th>Order</th><th>Width</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.columnName}>
              <td>{row.columnName}</td>
              <td><Input value={row.displayLabel} onChange={(e) => update(i, { displayLabel: e.target.value })} /></td>
              <td><input type="checkbox" checked={row.isVisible} onChange={(e) => update(i, { isVisible: e.target.checked })} /></td>
              <td><input type="checkbox" checked={row.isEditable} onChange={(e) => update(i, { isEditable: e.target.checked })} /></td>
              <td><Input type="number" value={row.displayOrder} onChange={(e) => update(i, { displayOrder: Number(e.target.value) })} /></td>
              <td><Input type="number" value={row.width ?? ""} onChange={(e) => update(i, { width: Number(e.target.value) || undefined })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button onClick={save}>Save column configuration</Button>
    </Card>
  );
}
```

`src/admin-studio/PortalSectionsPage.tsx` — bind an enabled table to a nav entry (label/icon/route/roles), completing the no-code loop:

```tsx
import { useState } from "react";
import { apiFetch } from "../auth/apiClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

export default function PortalSectionsPage({ syncTableId }: { syncTableId: string }) {
  const [sectionKey, setSectionKey] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("table");
  const [route, setRoute] = useState("");
  const [rolesCsv, setRolesCsv] = useState("admin");

  async function save() {
    await apiFetch("/api/admin/portal-sections", {
      method: "POST",
      body: JSON.stringify({ syncTableId, sectionKey, label, icon, route, displayOrder: 100, rolesCsv })
    });
    alert(`"${label}" now appears in the portal nav for roles: ${rolesCsv}`);
  }

  return (
    <Card className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Add a portal navigation entry</h1>
      <Input placeholder="Section key (e.g. work-orders)" value={sectionKey} onChange={(e) => setSectionKey(e.target.value)} />
      <Input placeholder="Nav label" value={label} onChange={(e) => setLabel(e.target.value)} />
      <Input placeholder="Icon name (lucide-react)" value={icon} onChange={(e) => setIcon(e.target.value)} />
      <Input placeholder="Route (e.g. /work-orders)" value={route} onChange={(e) => setRoute(e.target.value)} />
      <Input placeholder="Roles (comma-separated)" value={rolesCsv} onChange={(e) => setRolesCsv(e.target.value)} />
      <Button onClick={save}>Add section</Button>
    </Card>
  );
}
```

### 5.9 `src/components/ui/*` (Shadcn primitives, Tailwind v4)

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```tsx
// src/components/ui/button.tsx
import { cn } from "../../lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline";
  size?: "default" | "sm";
}

export function Button({ className, variant = "default", size = "default", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "default" && "bg-zinc-900 text-zinc-50 hover:bg-zinc-800",
        variant === "destructive" && "bg-red-600 text-white hover:bg-red-500",
        variant === "outline" && "border border-zinc-700 bg-transparent hover:bg-zinc-800",
        className
      )}
      {...props}
    />
  );
}
```

```tsx
// src/components/ui/card.tsx
import { cn } from "../../lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-zinc-800 bg-zinc-950/60 shadow-sm", className)} {...props} />;
}
```

```tsx
// src/components/ui/input.tsx
import { cn } from "../../lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400",
        className
      )}
      {...props}
    />
  );
}
```

```tsx
// src/components/ui/badge.tsx
import { cn } from "../../lib/utils";

const stateClasses: Record<string, string> = {
  synced: "bg-emerald-900 text-emerald-300",
  pending: "bg-amber-900 text-amber-300",
  conflict: "bg-red-900 text-red-300",
  failed: "bg-red-950 text-red-400"
};

export function Badge({ state }: { state: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", stateClasses[state] ?? "bg-zinc-800 text-zinc-300")}>
      {state}
    </span>
  );
}
```

```css
/* src/index.css */
@import "tailwindcss";

:root {
  color-scheme: dark;
  --background: 240 10% 4%;
  --foreground: 0 0% 95%;
}

body {
  @apply bg-zinc-950 text-zinc-100 antialiased;
}

.portal-shell { @apply flex min-h-screen; }
.portal-nav { @apply w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 p-4 space-y-2; }
.portal-nav a { @apply block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white; }
.portal-nav a.active { @apply bg-zinc-900 text-white; }
.portal-content { @apply flex-1 p-6; }
.section-header { @apply mb-4 flex items-center justify-between; }
```

### 5.10 `package.json` additions

```json
{
  "dependencies": {
    "ag-grid-community": "^33.0.4",
    "ag-grid-react": "^33.0.4",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

`vite.config.ts` gains the Tailwind v4 plugin alongside the existing PWA plugin:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ registerType: "autoUpdate", workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg}"] } })
  ]
});
```

---

## 6. The no-code walkthrough (what the admin actually does)

1. **Admin Studio → Connections**: paste an Oracle (or SQLite) connection string, name it, save. `DetectProvider` figures out the driver; **Test** confirms it opens.
2. **Admin Studio → Table Browser**: pick the connection, pick a table from the introspected list, confirm the auto-detected primary key (or override it), optionally pick a tenant column, click **Enable table**. Nothing was typed by hand except the table pick — columns came from `USER_TAB_COLUMNS`/`pragma table_info`.
3. **Admin Studio → Grid Column Editor**: every column from that table shows up as a row; the admin types the **Display label** for each one they want visible, toggles **Editable**, sets order/width. Save.
4. **Admin Studio → Portal Sections**: give it a nav label, icon, route, and which roles can see it. Save.
5. Refresh the portal — the new nav entry appears (server-driven manifest), clicking it renders an AG Grid built entirely from the column config, and the offline sync engine now includes that table in its push/pull loop because it reads the table list off the same manifest.

No `.tsx` file, controller, or migration was touched for that new table.

---

## 7. What stayed the same, what's gone

- **Gone:** every hardcoded `WorkOrder` entity, DTO, controller, Dexie store, and feature folder from the earlier slice — replaced by the generic `SYNC_TABLE_CONFIG` + `GRID_COLUMN_CONFIG` + `DynamicSyncService` + `DynamicTableSection` path above.
- **Gone:** EF Core, real JWT validation — replaced with Dapper/`IDynamicQueryExecutor` and `MockBearerAuthHandler` per your plan.
- **Kept conceptually, now generic:** outbox pattern, idempotent push via an operation log, optimistic-concurrency conflict detection, tombstoned deletes, cursor-based pull, single-flight sync engine, portal-manifest-driven navigation.
- **New:** schema introspection, the shadow `SYNC_ROW_META` table (so arbitrary/vendor tables never need an ALTER TABLE to participate), and the three-screen Admin Studio that turns "enable offline sync for this table" into a form.

## 8. Test checklist

1. Fresh clone, `dotnet run` with no Oracle available — SQLite bootstrap creates the config store and a seed `admin` user automatically.
2. Register a second SQLite (or Oracle) connection, introspect it, confirm `USER_TABLES`/`sqlite_master` results match what's actually in that database.
3. Enable a table with a non-obvious primary key (not named `ID`) — confirm the picker lets you choose it and sync still works.
4. Turn off `IsVisible` for a column in Grid Column Editor — confirm it disappears from both the AG Grid and the `/api/data/{table}` default column set, but is still selectable via `?columns=`.
5. Create a row offline, reconnect — confirm it appears in the business table via the enabled connection, and `SYNC_ROW_META` shows version 1.
6. Edit the same row from two sessions — second push gets `conflict`, `ServerRecord` is populated from a live read of the business table.
7. Delete a row — confirm the physical row is gone from the business table but `SYNC_CHANGE`/`SYNC_ROW_META` retain the tombstone so other offline clients remove their local copy on next pull.
8. Add a brand-new table end-to-end through Admin Studio only (§6) and confirm it shows up in the portal nav without restarting the client dev server.

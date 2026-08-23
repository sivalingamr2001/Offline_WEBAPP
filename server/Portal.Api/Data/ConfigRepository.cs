using System.Data;
using Dapper;
using Microsoft.Data.Sqlite;
using Portal.Api.Data.Entities;

namespace Portal.Api.Data;

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

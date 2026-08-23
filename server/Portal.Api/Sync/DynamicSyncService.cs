using System.Text.Json;
using Microsoft.Data.Sqlite;
using Portal.Api.Data;
using Portal.Api.Data.Entities;
using Dapper;
using DynamicTransaction.Interfaces;

namespace Portal.Api.Sync;

public sealed class DynamicSyncService(
    ConfigRepository repo, IDynamicQueryExecutor executor, IConfiguration config)
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
            "SELECT RESULT_JSON FROM SYNC_OPERATION WHERE OPERATION_ID = @OperationId", new { op.OperationId });
        if (existingOp is not null)
            return JsonSerializer.Deserialize<OperationResultDto>(existingOp)!;

        // Detect provider from connection string
        var provider = DetectProvider(connection.ConnectionString);

        OperationResultDto result;
        try
        {
            result = op.OperationType.ToLowerInvariant() switch
            {
                "create" when table.AllowCreate => await CreateAsync(configDb, table, provider, connection.ConnectionString, editableColumns, userId, op, ct),
                "update" when table.AllowUpdate => await UpdateAsync(configDb, table, provider, connection.ConnectionString, editableColumns, userId, op, ct),
                "delete" when table.AllowDelete => await DeleteAsync(configDb, table, provider, connection.ConnectionString, userId, op, ct),
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
                op.OperationId,
                TableId = table.Id,
                ClientId = clientId,
                op.RowPk,
                OpType = op.OperationType,
                result.Status,
                ResultJson = JsonSerializer.Serialize(result),
                CreatedAt = DateTime.UtcNow.ToString("o"),
                CompletedAt = DateTime.UtcNow.ToString("o")
            });

        return result;
    }

    private async Task<OperationResultDto> CreateAsync(
        System.Data.IDbConnection configDb, SyncTableConfig table, DatabaseProvider provider, string connectionString, 
        IReadOnlyList<string> editableColumns, string userId, SyncOperationDto op, CancellationToken ct)
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
        var paramPrefix = provider == DatabaseProvider.Oracle ? ":" : "@";
        var paramList = string.Join(", ", columnNames.Select(c => $"{paramPrefix}{c}"));
        var insertSql = $"INSERT INTO \"{table.TableName}\" ({columnList}) VALUES ({paramList})";

        var dynamicParams = new DynamicParameters();
        foreach (var kvp in paramMap)
        {
            dynamicParams.Add(kvp.Key, kvp.Value);
        }

        await executor.ExecuteAsync(insertSql, dynamicParams, connectionString: connectionString, cancellationToken: ct);
        await UpsertRowMetaAsync(configDb, table.Id, op.RowPk, version: 1, userId);
        await AppendChangeAsync(configDb, table.Id, op.RowPk, "created", paramMap);

        return new(op.OperationId, "accepted", op.RowPk, ServerVersion: 1, Record: paramMap);
    }

    private async Task<OperationResultDto> UpdateAsync(
        System.Data.IDbConnection configDb, SyncTableConfig table, DatabaseProvider provider, string connectionString,
        IReadOnlyList<string> editableColumns, string userId, SyncOperationDto op, CancellationToken ct)
    {
        if (op.ExpectedVersion is null || op.Payload is null)
            return new(op.OperationId, "validationFailed", op.RowPk, "expectedVersion and payload are required for update.");

        var meta = await configDb.QuerySingleOrDefaultAsync(
            "SELECT VERSION_NUMBER, DELETED_AT_UTC FROM SYNC_ROW_META WHERE SYNC_TABLE_ID = @TableId AND ROW_PK = @RowPk",
            new { TableId = table.Id, op.RowPk });

        var currentVersion = meta is null ? 0L : Convert.ToInt64(meta.VERSION_NUMBER);
        if (meta is not null && meta.DELETED_AT_UTC is not null)
            return new(op.OperationId, "validationFailed", op.RowPk, "Row was deleted on the server.");

        if (currentVersion != op.ExpectedVersion)
        {
            var serverRow = await FetchRowAsync(table, provider, op.RowPk, connectionString);
            throw new SyncConflictException(currentVersion, serverRow);
        }

        var payload = op.Payload.Value;
        var setClauses = new List<string>();
        var paramMap = new Dictionary<string, object?> { ["__pk"] = op.RowPk };

        foreach (var col in editableColumns)
        {
            if (!payload.TryGetProperty(col, out var val)) continue;
            setClauses.Add($"\"{col}\" = {(provider == DatabaseProvider.Oracle ? ":" : "@")}{col}");
            paramMap[col] = JsonValueToClr(val);
        }
        if (setClauses.Count == 0) return new(op.OperationId, "validationFailed", op.RowPk, "No editable columns in payload.");

        var updateSql = $"UPDATE \"{table.TableName}\" SET {string.Join(", ", setClauses)} WHERE \"{table.PrimaryKeyColumn}\" = {(provider == DatabaseProvider.Oracle ? ":" : "@")}__pk";

        var dynamicParams = new DynamicParameters();
        foreach (var kvp in paramMap)
        {
            dynamicParams.Add(kvp.Key, kvp.Value);
        }

        await executor.ExecuteAsync(updateSql, dynamicParams, connectionString: connectionString, cancellationToken: ct);

        var newVersion = currentVersion + 1;
        await UpsertRowMetaAsync(configDb, table.Id, op.RowPk, newVersion, userId);
        await AppendChangeAsync(configDb, table.Id, op.RowPk, "updated", paramMap);

        return new(op.OperationId, "accepted", op.RowPk, ServerVersion: newVersion, Record: paramMap);
    }

    private async Task<OperationResultDto> DeleteAsync(
        System.Data.IDbConnection configDb, SyncTableConfig table, DatabaseProvider provider, string connectionString,
        string userId, SyncOperationDto op, CancellationToken ct)
    {
        if (op.ExpectedVersion is null)
            return new(op.OperationId, "validationFailed", op.RowPk, "expectedVersion is required for delete.");

        var meta = await configDb.QuerySingleOrDefaultAsync(
            "SELECT VERSION_NUMBER, DELETED_AT_UTC FROM SYNC_ROW_META WHERE SYNC_TABLE_ID = @TableId AND ROW_PK = @RowPk",
            new { TableId = table.Id, op.RowPk });

        if (meta is null || meta.DELETED_AT_UTC is not null)
            return new(op.OperationId, "accepted", op.RowPk); // already gone — idempotent

        var currentVersion = Convert.ToInt64(meta.VERSION_NUMBER);
        if (currentVersion != op.ExpectedVersion)
        {
            var serverRow = await FetchRowAsync(table, provider, op.RowPk, connectionString);
            throw new SyncConflictException(currentVersion, serverRow);
        }

        var deleteSql = $"DELETE FROM \"{table.TableName}\" WHERE \"{table.PrimaryKeyColumn}\" = {(provider == DatabaseProvider.Oracle ? ":" : "@")}pk";
        
        var dynamicParams = new DynamicParameters();
        dynamicParams.Add("pk", op.RowPk);

        await executor.ExecuteAsync(deleteSql, dynamicParams, connectionString: connectionString, cancellationToken: ct);

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
            Convert.ToInt64(r.SERVER_CURSOR), (string)r.ROW_PK, (string)r.CHANGE_TYPE,
            r.RECORD_JSON is null ? null : JsonSerializer.Deserialize<object>((string)r.RECORD_JSON)
        )).ToList();

        var next = rows.Count > 0 ? Convert.ToInt64(rows[^1].SERVER_CURSOR) : cursor;
        return new PullResponse(changes, next, rows.Count == limit);
    }

    private async Task<SyncTableConfig> ResolveTableAsync(string tableName)
    {
        var tables = await repo.ListSyncTablesAsync();
        return tables.FirstOrDefault(t => string.Equals(t.TableName, tableName, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"Table '{tableName}' is not enabled for sync.");
    }

    private async Task<object?> FetchRowAsync(SyncTableConfig table, DatabaseProvider provider, string pk, string connectionString)
    {
        var sql = $"SELECT * FROM \"{table.TableName}\" WHERE \"{table.PrimaryKeyColumn}\" = {(provider == DatabaseProvider.Oracle ? ":" : "@")}pk";
        var dynamicParams = new DynamicParameters();
        dynamicParams.Add("pk", pk);
        return await executor.QueryFirstOrDefaultAsync<dynamic>(sql, dynamicParams, connectionString: connectionString);
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

    private static DatabaseProvider DetectProvider(string connectionString)
    {
        var normalized = connectionString.ToLowerInvariant();
        var looksOracle = normalized.Contains("oracle") || normalized.Contains("user id=") || normalized.Contains("data source=//");
        return looksOracle ? DatabaseProvider.Oracle : DatabaseProvider.Sqlite;
    }

    private static object? JsonValueToClr(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.GetDecimal(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => el.GetRawText()
    };
}

public sealed class SyncConflictException(long serverVersion, object? serverRecord) : Exception
{
    public long ServerVersion { get; } = serverVersion;
    public object? ServerRecord { get; } = serverRecord;
}

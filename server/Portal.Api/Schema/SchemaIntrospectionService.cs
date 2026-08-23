using Dapper;
using Portal.Api.Data;
using Portal.Api.Data.Entities;
using DynamicTransaction.Interfaces;

namespace Portal.Api.Schema;

public sealed record TableInfo(string TableName);
public sealed record ColumnInfo(string ColumnName, string DataType, bool IsNullable, bool IsPrimaryKey);

public interface ISchemaIntrospectionService
{
    Task<IReadOnlyList<TableInfo>> ListTablesAsync(DataConnection connection);
    Task<IReadOnlyList<ColumnInfo>> ListColumnsAsync(DataConnection connection, string tableName);
}

public sealed class SchemaIntrospectionService(IDbConnectionFactory factory) : ISchemaIntrospectionService
{
    public async Task<IReadOnlyList<TableInfo>> ListTablesAsync(DataConnection connection)
    {
        var concrete = (DbConnectionFactory)factory;
        using var db = concrete.Create(connection.ConnectionString);
        db.Open();
        var provider = concrete.DetectProvider(connection.ConnectionString);

        var sql = provider == DatabaseProvider.Oracle
            ? "SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME"
            : "SELECT name AS TABLE_NAME FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";

        var names = await db.QueryAsync<string>(sql);
        return names.Select(n => new TableInfo(n)).ToList();
    }

    public async Task<IReadOnlyList<ColumnInfo>> ListColumnsAsync(DataConnection connection, string tableName)
    {
        SqlIdentifier.RequireValid(tableName, "table");

        var concrete = (DbConnectionFactory)factory;
        using var db = concrete.Create(connection.ConnectionString);
        db.Open();
        var provider = concrete.DetectProvider(connection.ConnectionString);

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
                (string)r.COLUMN_NAME, (string)r.DATA_TYPE, ((string)r.NULLABLE) == "Y", Convert.ToInt32(r.IS_PK) == 1)).ToList();
        }
        else
        {
            var rows = await db.QueryAsync($"PRAGMA table_info(\"{tableName}\")");
            return rows.Select(r => new ColumnInfo(
                (string)r.name, (string)r.type, Convert.ToInt64(r.notnull) == 0, Convert.ToInt64(r.pk) > 0)).ToList();
        }
    }
}

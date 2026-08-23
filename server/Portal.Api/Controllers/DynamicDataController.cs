using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Domain.Repositories;
using Portal.Infrastructure.Data;
using DynamicTransaction.Interfaces;

namespace Portal.Api.Controllers;

[ApiController]
[Route("api/data")]
[Authorize]
public sealed class DynamicDataController(
    IConfigRepository repo, IDbConnectionFactory factory, IDynamicQueryExecutor executor) : ControllerBase
{
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

        var isOracle = connection.Provider.Equals("oracle", StringComparison.OrdinalIgnoreCase);
        var sql = isOracle
            ? $"SELECT {columnList} FROM \"{SqlIdentifier.RequireValid(table.TableName, "table")}\" ORDER BY \"{pk}\" OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY"
            : $"SELECT {columnList} FROM \"{SqlIdentifier.RequireValid(table.TableName, "table")}\" ORDER BY \"{pk}\" LIMIT @pageSize OFFSET @offset";

        var concrete = (DbConnectionFactory)factory;
        using var conn = concrete.Create(connection.ConnectionString);
        conn.Open();
        var rows = await executor.QueryAsync<dynamic>(sql, new { pageSize, offset }, connectionString: connection.ConnectionString);

        return Ok(new { tableName, page, pageSize, columns = selectedColumns, rows });
    }
}

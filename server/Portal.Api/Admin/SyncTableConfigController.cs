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

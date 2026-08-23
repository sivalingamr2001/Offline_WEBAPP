using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Domain.Entities;
using Portal.Domain.Repositories;

namespace Portal.Api.Controllers;

[ApiController]
[Route("api/admin/sync-tables")]
[Authorize(Roles = "admin")]
public sealed class SyncTableConfigController(IConfigRepository repo) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await repo.ListSyncTablesAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SyncTableConfig table)
    {
        var connection = await repo.GetConnectionAsync(table.ConnectionId);
        if (connection is null) return BadRequest(new { message = "Invalid Target ConnectionId." });
        return Ok(await repo.UpsertSyncTableAsync(table));
    }
}

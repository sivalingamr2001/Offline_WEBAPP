using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Domain.Entities;
using Portal.Domain.Repositories;

namespace Portal.Api.Controllers;

[ApiController]
[Route("api/admin/grid-columns")]
[Authorize]
public sealed class GridColumnConfigController(IConfigRepository repo) : ControllerBase
{
    [HttpGet("{syncTableId}")]
    public async Task<IActionResult> Get(string syncTableId) =>
        Ok(await repo.GetGridColumnsAsync(syncTableId));

    [HttpPut("{syncTableId}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Replace(string syncTableId, [FromBody] List<GridColumnConfig> columns)
    {
        var table = await repo.GetSyncTableAsync(syncTableId);
        if (table is null) return NotFound();
        await repo.ReplaceGridColumnsAsync(syncTableId, columns);
        return Ok();
    }
}

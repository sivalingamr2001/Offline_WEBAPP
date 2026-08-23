using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Domain.Entities;
using Portal.Domain.Repositories;

namespace Portal.Api.Controllers;

[ApiController]
[Route("api/admin/portal-sections")]
[Authorize(Roles = "admin")]
public sealed class PortalSectionController(IConfigRepository repo) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PortalSectionConfig section)
    {
        var table = await repo.GetSyncTableAsync(section.SyncTableId);
        if (table is null) return BadRequest(new { message = "Invalid syncTableId." });
        return Ok(await repo.UpsertSectionAsync(section));
    }
}

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
    [HttpGet]
    public async Task<IActionResult> Get() =>
        Ok(await repo.ListSectionsAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PortalSectionConfig section)
    {
        var table = await repo.GetSyncTableAsync(section.SyncTableId);
        if (table is null) return BadRequest(new { message = "Invalid syncTableId." });
        return Ok(await repo.UpsertSectionAsync(section));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await repo.DeleteSectionAsync(id);
        return Ok();
    }
}

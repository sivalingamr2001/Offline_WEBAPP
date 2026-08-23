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

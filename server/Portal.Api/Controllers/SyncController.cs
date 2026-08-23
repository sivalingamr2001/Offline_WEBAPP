using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Application.DTOs;
using Portal.Application.Services;

namespace Portal.Api.Controllers;

[ApiController]
[Route("api/sync")]
[Authorize]
public sealed class SyncController(DynamicSyncService syncService) : ControllerBase
{
    [HttpPost("push")]
    public async Task<IActionResult> Push([FromBody] PushRequest request, CancellationToken ct)
    {
        var username = User.FindFirstValue(ClaimTypes.Name) ?? "anonymous";
        var res = await syncService.PushAsync(username, request.ClientId, request, ct);
        return Ok(res);
    }

    [HttpGet("pull")]
    public async Task<IActionResult> Pull(
        [FromQuery] string tableName,
        [FromQuery] long cursor = 0,
        [FromQuery] int limit = 100,
        CancellationToken ct = default)
    {
        var tenantId = User.FindFirstValue("TenantId");
        var res = await syncService.PullAsync(tableName, cursor, limit, tenantId, ct);
        return Ok(res);
    }
}

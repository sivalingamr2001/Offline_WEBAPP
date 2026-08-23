using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Portal.Api.Sync;

[ApiController]
[Route("api/sync")]
[Authorize]
public sealed class SyncController(DynamicSyncService syncService) : ControllerBase
{
    [HttpPost("push")]
    public async Task<ActionResult<PushResponse>> Push([FromBody] PushRequest request, CancellationToken ct)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown";
        return Ok(await syncService.PushAsync(userId, request.ClientId, request, ct));
    }

    [HttpGet("pull")]
    public async Task<ActionResult<PullResponse>> Pull(
        [FromQuery] string tableName, [FromQuery] long cursor = 0, [FromQuery] int limit = 200, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 500);
        return Ok(await syncService.PullAsync(tableName, cursor, limit, ct));
    }
}

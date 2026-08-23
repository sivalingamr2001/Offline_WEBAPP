using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Application.Services;

namespace Portal.Api.Controllers;

[ApiController]
[Route("api/portal")]
[Authorize]
public sealed class PortalController(IPortalManifestService manifestService) : ControllerBase
{
    [HttpGet("manifest")]
    public async Task<IActionResult> GetManifest()
    {
        var roles = User.FindAll(ClaimTypes.Role).Select(r => r.Value).ToList();
        var manifest = await manifestService.BuildManifestForAsync(roles);
        return Ok(manifest);
    }
}

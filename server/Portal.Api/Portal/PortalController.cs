using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Portal.Api.Portal;

[ApiController]
[Route("api/portal")]
[Authorize]
public sealed class PortalController(IPortalManifestService manifests) : ControllerBase
{
    [HttpGet("manifest")]
    public async Task<IActionResult> GetManifest()
    {
        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        return Ok(await manifests.BuildManifestForAsync(roles));
    }
}

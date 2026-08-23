using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Dapper;
using Microsoft.Data.Sqlite;

namespace Portal.Api.Controllers;

public sealed record LoginRequest(string TenantId, string Username, string Password);
public sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, string DisplayName, IReadOnlyList<string> Roles);

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IConfiguration config) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        using var db = new SqliteConnection(config.GetConnectionString("Default"));
        db.Open();

        var user = await db.QuerySingleOrDefaultAsync(
            "SELECT USERNAME, PASSWORD_HASH, DISPLAY_NAME, ROLES_CSV FROM APP_USER WHERE USERNAME = @Username",
            new { request.Username });

        if (user is null || (string)user.PASSWORD_HASH != request.Password)
            return Unauthorized(new { message = "Invalid credentials." });

        var roles = ((string)user.ROLES_CSV).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, (string)user.USERNAME),
            new("DisplayName", (string)user.DISPLAY_NAME),
            new("TenantId", request.TenantId)
        };
        foreach (var r in roles) claims.Add(new Claim(ClaimTypes.Role, r));

        var identity = new ClaimsIdentity(claims, "MockBearer");
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync("MockBearer", principal);

        var token = "mock-token-xyz-123";
        return Ok(new LoginResponse(token, 3600, (string)user.DISPLAY_NAME, roles));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync("MockBearer");
        return Ok();
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Dapper;

namespace Portal.Api.Auth;

public sealed record LoginRequest(string TenantId, string Username, string Password);
public sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, string DisplayName, IReadOnlyList<string> Roles);

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IConfiguration config) : ControllerBase
{
    private const string RefreshCookieName = "portal_refresh";

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        using var db = new SqliteConnection(config.GetConnectionString("Default"));
        db.Open();
        var user = await db.QuerySingleOrDefaultAsync(
            "SELECT USERNAME, PASSWORD, DISPLAY_NAME, ROLES_CSV, TENANT_ID FROM APP_USER WHERE USERNAME = @Username",
            new { Username = request.Username });

        if (user is null || (string)user.PASSWORD != request.Password)
        {
            return Unauthorized(new { message = "Invalid credentials. Try: admin/admin-password" });
        }

        var roles = ((string)user.ROLES_CSV).Split(',', StringSplitOptions.RemoveEmptyEntries);
        var token = $"mock-token-{user.USERNAME}-{user.ROLES_CSV}-{user.TENANT_ID}";

        SetRefreshCookie(token);

        return Ok(new LoginResponse(token, 15 * 60, (string)user.DISPLAY_NAME, roles));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public ActionResult<LoginResponse> Refresh()
    {
        if (!Request.Cookies.TryGetValue(RefreshCookieName, out var raw) || string.IsNullOrEmpty(raw))
        {
            return Unauthorized(new { message = "No refresh token present." });
        }

        var parts = raw.Split('-');
        if (parts.Length < 5)
        {
            Response.Cookies.Delete(RefreshCookieName);
            return Unauthorized(new { message = "Refresh token invalid." });
        }

        var username = parts[2];
        var rolesCsv = parts[3];
        var tenantId = parts[4];

        var roles = rolesCsv.Split(',');
        var newAccessToken = $"mock-token-{username}-{rolesCsv}-{tenantId}";

        SetRefreshCookie(newAccessToken);

        return Ok(new LoginResponse(newAccessToken, 15 * 60, username.ToUpper(), roles));
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(RefreshCookieName);
        return NoContent();
    }

    private void SetRefreshCookie(string mockToken)
    {
        Response.Cookies.Append(RefreshCookieName, mockToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(14),
            Path = "/api/auth"
        });
    }
}

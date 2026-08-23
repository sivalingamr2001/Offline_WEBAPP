using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Portal.Api.Auth;

public sealed class MockBearerAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "MockBearer";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var header) ||
            !header.ToString().StartsWith("Bearer mock-token-", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(AuthenticateResult.Fail("Missing or malformed mock bearer token."));
        }

        var raw = header.ToString()["Bearer mock-token-".Length..];
        var parts = raw.Split('-');
        if (parts.Length < 3)
            return Task.FromResult(AuthenticateResult.Fail("Malformed mock token payload."));

        var username = parts[0];
        var rolesCsv = parts[1];
        var tenantId = parts[2];

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, username),
            new(ClaimTypes.Name, username),
            new("username", username),
            new("tenant_id", tenantId),
            new("display_name", username.ToUpper())
        };
        claims.AddRange(rolesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(r => new Claim(ClaimTypes.Role, r)));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}

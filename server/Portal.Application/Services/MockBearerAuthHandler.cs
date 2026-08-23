using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Portal.Application.Services;

public class MockBearerAuthOptions : AuthenticationSchemeOptions { }

public class MockBearerAuthHandler : SignInAuthenticationHandler<MockBearerAuthOptions>
{
    private static readonly Dictionary<string, ClaimsPrincipal> Sessions = new(StringComparer.OrdinalIgnoreCase);

    public MockBearerAuthHandler(
        IOptionsMonitor<MockBearerAuthOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder) : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var cookie = Request.Cookies["MockSession"];
            if (cookie is not null && Sessions.TryGetValue(cookie, out var cookiePrincipal))
            {
                var cookieTicket = new AuthenticationTicket(cookiePrincipal, Scheme.Name);
                return Task.FromResult(AuthenticateResult.Success(cookieTicket));
            }
            return Task.FromResult(AuthenticateResult.Fail("Missing authorization header or session cookie."));
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        if (Sessions.TryGetValue(token, out var principal))
        {
            var ticket = new AuthenticationTicket(principal, Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }

        return Task.FromResult(AuthenticateResult.Fail("Invalid session token."));
    }

    protected override Task HandleSignInAsync(ClaimsPrincipal user, AuthenticationProperties? properties)
    {
        var token = "mock-token-xyz-123";
        Sessions[token] = user;

        Response.Cookies.Append("MockSession", token, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.None,
            Secure = true,
            Expires = DateTimeOffset.UtcNow.AddHours(1)
        });

        return Task.CompletedTask;
    }

    protected override Task HandleSignOutAsync(AuthenticationProperties? properties)
    {
        var cookie = Request.Cookies["MockSession"];
        if (cookie is not null)
        {
            Sessions.Remove(cookie);
            Response.Cookies.Delete("MockSession");
        }
        return Task.CompletedTask;
    }
}

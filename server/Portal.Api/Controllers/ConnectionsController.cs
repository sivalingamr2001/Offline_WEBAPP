using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Domain.Entities;
using Portal.Domain.Repositories;
using Portal.Infrastructure.Data;
using DynamicTransaction.Interfaces;

namespace Portal.Api.Controllers;

public sealed record CreateConnectionRequest(string Name, string ConnectionString);
public sealed record TestConnectionResult(bool Success, string? Error);

[ApiController]
[Route("api/admin/connections")]
[Authorize(Roles = "admin")]
public sealed class ConnectionsController(IConfigRepository repo, IDbConnectionFactory factory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(await repo.ListConnectionsAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateConnectionRequest request)
    {
        var concrete = (DbConnectionFactory)factory;
        var provider = concrete.DetectProvider(request.ConnectionString);
        var created = await repo.AddConnectionAsync(request.Name, request.ConnectionString, provider);
        return Ok(created);
    }

    [HttpPost("{id}/test")]
    public async Task<ActionResult<TestConnectionResult>> Test(string id)
    {
        var connection = await repo.GetConnectionAsync(id);
        if (connection is null) return NotFound();

        try
        {
            var concrete = (DbConnectionFactory)factory;
            using var conn = concrete.Create(connection.ConnectionString);
            conn.Open();
            return Ok(new TestConnectionResult(true, null));
        }
        catch (Exception ex)
        {
            return Ok(new TestConnectionResult(false, ex.Message));
        }
    }
}

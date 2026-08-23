using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Domain.Repositories;
using Portal.Application.Services;

namespace Portal.Api.Controllers;

[ApiController]
[Route("api/admin/connections/{connectionId}")]
[Authorize(Roles = "admin")]
public sealed class SchemaController(IConfigRepository repo, ISchemaIntrospectionService schemaService) : ControllerBase
{
    [HttpGet("tables")]
    public async Task<IActionResult> GetTables(string connectionId)
    {
        var connection = await repo.GetConnectionAsync(connectionId);
        if (connection is null) return NotFound();
        return Ok(await schemaService.ListTablesAsync(connection));
    }

    [HttpGet("tables/{tableName}/columns")]
    public async Task<IActionResult> GetColumns(string connectionId, string tableName)
    {
        var connection = await repo.GetConnectionAsync(connectionId);
        if (connection is null) return NotFound();
        return Ok(await schemaService.ListColumnsAsync(connection, tableName));
    }
}

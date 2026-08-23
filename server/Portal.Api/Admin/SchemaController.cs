using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Api.Data;
using Portal.Api.Schema;

namespace Portal.Api.Admin;

[ApiController]
[Route("api/admin/connections/{connectionId}")]
[Authorize(Roles = "admin")]
public sealed class SchemaController(ConfigRepository repo, ISchemaIntrospectionService introspection) : ControllerBase
{
    [HttpGet("tables")]
    public async Task<IActionResult> ListTables(string connectionId)
    {
        var connection = await repo.GetConnectionAsync(connectionId);
        if (connection is null) return NotFound();
        return Ok(await introspection.ListTablesAsync(connection));
    }

    [HttpGet("tables/{tableName}/columns")]
    public async Task<IActionResult> ListColumns(string connectionId, string tableName)
    {
        var connection = await repo.GetConnectionAsync(connectionId);
        if (connection is null) return NotFound();
        return Ok(await introspection.ListColumnsAsync(connection, tableName));
    }
}

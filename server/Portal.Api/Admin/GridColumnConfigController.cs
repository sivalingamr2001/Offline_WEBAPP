using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Portal.Api.Data;
using Portal.Api.Data.Entities;

namespace Portal.Api.Admin;

public sealed record ColumnConfigInput(string ColumnName, string DisplayLabel, string DataType, bool IsVisible, bool IsEditable, int DisplayOrder, int? Width);

[ApiController]
[Route("api/admin/grid-columns")]
[Authorize(Roles = "admin")]
public sealed class GridColumnConfigController(ConfigRepository repo) : ControllerBase
{
    [HttpGet("{syncTableId}")]
    public async Task<IActionResult> Get(string syncTableId) => Ok(await repo.GetGridColumnsAsync(syncTableId));

    [HttpPut("{syncTableId}")]
    public async Task<IActionResult> Replace(string syncTableId, [FromBody] IReadOnlyList<ColumnConfigInput> columns)
    {
        var table = await repo.GetSyncTableAsync(syncTableId);
        if (table is null) return NotFound();

        var rows = columns.Select(c => new GridColumnConfig
        {
            ColumnName = SqlIdentifier.RequireValid(c.ColumnName, "column"),
            DisplayLabel = c.DisplayLabel,
            DataType = c.DataType,
            IsVisible = c.IsVisible,
            IsEditable = c.IsEditable,
            DisplayOrder = c.DisplayOrder,
            Width = c.Width
        }).ToList();

        await repo.ReplaceGridColumnsAsync(syncTableId, rows);
        return Ok(await repo.GetGridColumnsAsync(syncTableId));
    }
}

namespace Portal.Api.Data.Entities;

public sealed class DataConnection
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Provider { get; set; } = null!; // oracle | sqlite
    public string ConnectionString { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class SyncTableConfig
{
    public string Id { get; set; } = null!;
    public string ConnectionId { get; set; } = null!;
    public string TableName { get; set; } = null!;
    public string PrimaryKeyColumn { get; set; } = null!;
    public string? TenantColumn { get; set; }
    public bool AllowCreate { get; set; } = true;
    public bool AllowUpdate { get; set; } = true;
    public bool AllowDelete { get; set; } = true;
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class GridColumnConfig
{
    public string Id { get; set; } = null!;
    public string SyncTableId { get; set; } = null!;
    public string ColumnName { get; set; } = null!;
    public string DisplayLabel { get; set; } = null!;
    public string DataType { get; set; } = "string"; // string | number | boolean | date
    public bool IsVisible { get; set; } = true;
    public bool IsEditable { get; set; } = true;
    public int DisplayOrder { get; set; }
    public int? Width { get; set; }
}

public sealed class PortalSectionConfig
{
    public string Id { get; set; } = null!;
    public string SyncTableId { get; set; } = null!;
    public string SectionKey { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string Icon { get; set; } = null!;
    public string Route { get; set; } = null!;
    public int DisplayOrder { get; set; }
    public string RolesCsv { get; set; } = null!;
    public bool IsEnabled { get; set; } = true;

    public IReadOnlyList<string> Roles =>
        RolesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

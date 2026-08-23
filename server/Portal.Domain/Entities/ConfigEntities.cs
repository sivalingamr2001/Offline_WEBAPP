namespace Portal.Domain.Entities;

public class DataConnection
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty; // oracle | sqlite
    public string ConnectionString { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
}

public class SyncTableConfig
{
    public string Id { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public string TableName { get; set; } = string.Empty;
    public string PrimaryKeyColumn { get; set; } = string.Empty;
    public string? TenantColumn { get; set; }
    public bool AllowCreate { get; set; } = true;
    public bool AllowUpdate { get; set; } = true;
    public bool AllowDelete { get; set; } = true;
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
}

public class GridColumnConfig
{
    public string Id { get; set; } = string.Empty;
    public string SyncTableId { get; set; } = string.Empty;
    public string ColumnName { get; set; } = string.Empty;
    public string DisplayLabel { get; set; } = string.Empty;
    public string DataType { get; set; } = "string"; // string | number | boolean | date
    public bool IsVisible { get; set; } = true;
    public bool IsEditable { get; set; } = true;
    public int DisplayOrder { get; set; }
    public int? Width { get; set; }
}

public class PortalSectionConfig
{
    public string Id { get; set; } = string.Empty;
    public string SyncTableId { get; set; } = string.Empty;
    public string SectionKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string RolesCsv { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;

    public IReadOnlyList<string> Roles =>
        RolesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

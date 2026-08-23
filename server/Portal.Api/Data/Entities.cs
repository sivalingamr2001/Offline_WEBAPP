namespace Portal.Api.Data;

public sealed class WorkOrder
{
    public string Id { get; set; } = null!;
    public string TenantId { get; set; } = null!;
    public string Code { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string Status { get; set; } = "draft";
    public decimal Quantity { get; set; }
    public DateTime? DueDateUtc { get; set; }
    public long VersionNumber { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public string UpdatedBy { get; set; } = null!;
    public DateTime? DeletedAtUtc { get; set; }
}

public sealed class SyncOperation
{
    public string OperationId { get; set; } = null!;
    public string TenantId { get; set; } = null!;
    public string ClientId { get; set; } = null!;
    public string EntityType { get; set; } = null!;
    public string EntityId { get; set; } = null!;
    public string OperationType { get; set; } = null!; // create | update | delete
    public string Status { get; set; } = null!;        // processing | accepted | conflict | failed
    public string? ResultJson { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
}

public sealed class SyncChange
{
    public long ServerCursor { get; set; }
    public string TenantId { get; set; } = null!;
    public string EntityType { get; set; } = null!;
    public string EntityId { get; set; } = null!;
    public string ChangeType { get; set; } = null!;     // created | updated | deleted
    public string? RecordJson { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

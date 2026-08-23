using System.Text.Json;

namespace Portal.Api.Sync;

public sealed record PushRequest(string ClientId, string TableName, IReadOnlyList<SyncOperationDto> Operations);

public sealed record SyncOperationDto(
    string OperationId, string RowPk, string OperationType,
    long? ExpectedVersion, DateTime OccurredAtUtc, JsonElement? Payload);

public sealed record OperationResultDto(
    string OperationId, string Status, string RowPk,
    string? Message = null, long? ServerVersion = null,
    object? Record = null, object? ServerRecord = null);

public sealed record PushResponse(IReadOnlyList<OperationResultDto> Results);

public sealed record ChangeDto(long Cursor, string RowPk, string ChangeType, object? Record);

public sealed record PullResponse(IReadOnlyList<ChangeDto> Changes, long NextCursor, bool HasMore);

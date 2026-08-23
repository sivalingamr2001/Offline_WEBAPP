using Portal.Domain.Entities;

namespace Portal.Domain.Repositories;

public interface IConfigRepository
{
    Task<DataConnection> AddConnectionAsync(string name, string connectionString, DatabaseProvider provider);
    Task<IReadOnlyList<DataConnection>> ListConnectionsAsync();
    Task<DataConnection?> GetConnectionAsync(string id);
    Task<SyncTableConfig> UpsertSyncTableAsync(SyncTableConfig table);
    Task<IReadOnlyList<SyncTableConfig>> ListSyncTablesAsync(string? connectionId = null);
    Task<SyncTableConfig?> GetSyncTableAsync(string id);
    Task ReplaceGridColumnsAsync(string syncTableId, IReadOnlyList<GridColumnConfig> columns);
    Task<IReadOnlyList<GridColumnConfig>> GetGridColumnsAsync(string syncTableId);
    Task<PortalSectionConfig> UpsertSectionAsync(PortalSectionConfig section);
    Task<IReadOnlyList<PortalSectionConfig>> ListSectionsAsync();
    Task DeleteSectionAsync(string id);
}

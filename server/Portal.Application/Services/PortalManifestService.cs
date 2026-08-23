using Portal.Domain.Entities;
using Portal.Domain.Repositories;

namespace Portal.Application.Services;

public sealed record PortalSectionDto(string Key, string Label, string Icon, string Route, string TableName, int Order);
public sealed record PortalManifest(string PortalId, string Title, IReadOnlyList<PortalSectionDto> Sections);

public interface IPortalManifestService
{
    Task<PortalManifest> BuildManifestForAsync(IReadOnlyCollection<string> userRoles);
}

public sealed class PortalManifestService(IConfigRepository repo) : IPortalManifestService
{
    public async Task<PortalManifest> BuildManifestForAsync(IReadOnlyCollection<string> userRoles)
    {
        var sections = await repo.ListSectionsAsync();
        var tables = await repo.ListSyncTablesAsync();
        var tableById = tables.ToDictionary(t => t.Id, t => t.TableName);

        var visible = sections
            .Where(s => s.Roles.Any(userRoles.Contains))
            .Where(s => tableById.ContainsKey(s.SyncTableId))
            .OrderBy(s => s.DisplayOrder)
            .Select(s => new PortalSectionDto(s.SectionKey, s.Label, s.Icon, s.Route, tableById[s.SyncTableId], s.DisplayOrder))
            .ToList();

        return new PortalManifest("dynamic-portal", "Manufacturing Portal", visible);
    }
}

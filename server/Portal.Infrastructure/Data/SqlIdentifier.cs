using System.Text.RegularExpressions;

namespace Portal.Infrastructure.Data;

public static class SqlIdentifier
{
    private static readonly Regex ValidPattern = new("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

    public static string RequireValid(string identifier, string kind)
    {
        if (!ValidPattern.IsMatch(identifier))
            throw new InvalidOperationException($"Rejected unsafe {kind} identifier: '{identifier}'.");
        return identifier;
    }

    public static string RequireKnown(string identifier, IReadOnlyCollection<string> allowList, string kind)
    {
        RequireValid(identifier, kind);
        if (!allowList.Contains(identifier, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Unknown {kind} '{identifier}' — it is not registered in configuration.");
        return identifier;
    }
}

using System.Text.RegularExpressions;

namespace Portal.Api.Data;

public static class SqlIdentifier
{
    private static readonly Regex ValidPattern = new("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

    public static bool IsSyntacticallyValid(string identifier) => ValidPattern.IsMatch(identifier);

    public static string RequireValid(string identifier, string kind)
    {
        if (!IsSyntacticallyValid(identifier))
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

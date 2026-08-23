namespace DynamicTransaction.Interfaces;

/// <summary>
/// Defines a database-agnostic factory responsible for instantiating database connections.
/// </summary>
public interface IDbConnectionFactory
{
    /// <summary>
    /// Creates and returns an isolated, wrapped database connection instance.
    /// </summary>
    /// <param name="connectionStringOverride">
    /// Optional runtime connection string to target secondary databases. 
    /// If null, the factory uses its default configured connection string.
    /// </param>
    IAsyncDbConnectionWrapper CreateConnection(string? connectionStringOverride = null);
}

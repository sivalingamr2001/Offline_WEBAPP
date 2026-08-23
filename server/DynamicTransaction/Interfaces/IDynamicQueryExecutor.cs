using System.Data;

namespace DynamicTransaction.Interfaces;

/// <summary>
/// Executes raw SQL statements at runtime via Dapper with full async, transaction,
/// cancellation-token, and multi-database support.
/// </summary>
public interface IDynamicQueryExecutor
{
    /// <summary>
    /// Executes a SELECT query and returns a (possibly empty) sequence of <typeparamref name="T"/>.
    /// </summary>
    /// <typeparam name="T">The type each row is mapped to.</typeparam>
    /// <param name="sql">Raw SQL SELECT statement.</param>
    /// <param name="parameters">
    ///   Anonymous object (<c>new { Id = 1 }</c>) or a <see cref="DynamicParameters"/> instance.
    /// </param>
    /// <param name="transaction">Optional ambient transaction.</param>
    /// <param name="connectionString">
    ///   Override the factory's default connection string for multi-database scenarios.
    /// </param>
    /// <param name="cancellationToken">Propagates cancellation to the underlying connection.</param>
    Task<IEnumerable<T>> QueryAsync<T>(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default);

    Task<T?> QueryFirstOrDefaultAsync<T>(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes a SELECT query and returns the first row, or <c>default</c> when no row matches.
    /// Throws <see cref="InvalidOperationException"/> if more than one row is returned.
    /// </summary>
    /// <typeparam name="T">The type the row is mapped to.</typeparam>
    /// <param name="sql">Raw SQL SELECT statement.</param>
    /// <param name="parameters">Anonymous object or <see cref="DynamicParameters"/>.</param>
    /// <param name="transaction">Optional ambient transaction.</param>
    /// <param name="connectionString">Override connection string.</param>
    /// <param name="cancellationToken">Propagates cancellation to the underlying connection.</param>
    Task<T?> QuerySingleOrDefaultAsync<T>(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes a non-SELECT statement (INSERT / UPDATE / DELETE / DDL) and returns the
    /// number of rows affected.
    /// </summary>
    /// <param name="sql">Raw SQL non-SELECT statement.</param>
    /// <param name="parameters">Anonymous object or <see cref="DynamicParameters"/>.</param>
    /// <param name="transaction">Optional ambient transaction.</param>
    /// <param name="connectionString">Override connection string.</param>
    /// <param name="cancellationToken">Propagates cancellation to the underlying connection.</param>
    Task<int> ExecuteAsync(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes two queries in a single round-trip: one for a data page and one for the total
    /// count, returning both results together.
    /// </summary>
    /// <typeparam name="T">The type each data row is mapped to.</typeparam>
    /// <param name="dataSql">Raw SQL that returns the current page of rows.</param>
    /// <param name="countSql">Raw SQL that returns a single <see cref="int"/> total count.</param>
    /// <param name="parameters">Shared parameters applied to both statements.</param>
    /// <param name="transaction">Optional ambient transaction.</param>
    /// <param name="connectionString">Override connection string.</param>
    /// <param name="cancellationToken">Propagates cancellation to the underlying connection.</param>
    Task<(IEnumerable<T> Data, int TotalCount)> QueryPagedAsync<T>(
        string dataSql,
        string countSql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes a query that returns a single scalar value (e.g. COUNT, sequence NEXTVAL, RETURNING).
    /// </summary>
    Task<T?> ExecuteScalarAsync<T>(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs <paramref name="work"/> inside a new database transaction, automatically committing
    /// on success and rolling back on any exception.
    /// </summary>
    /// <param name="work">Async delegate that receives the open transaction.</param>
    /// <param name="isolationLevel">Transaction isolation level (defaults to <see cref="IsolationLevel.ReadCommitted"/>).</param>
    /// <param name="connectionString">Override connection string.</param>
    /// <param name="cancellationToken">Propagates cancellation to the underlying connection.</param>
    Task<int> ExecuteInTransactionAsync(
        Func<IDbTransaction, Task<int>> work,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        string? connectionString = null,
        CancellationToken cancellationToken = default);
}

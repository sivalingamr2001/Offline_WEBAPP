using Dapper;
using DynamicTransaction.Interfaces;
using Microsoft.Extensions.Logging;
using System.Data;

namespace DynamicTransaction.Services;

/// <summary>
/// Production-ready, thread-safe implementation of <see cref="IDynamicQueryExecutor"/>.
/// Each public method opens a short-lived connection (or reuses a transactional one),
/// delegates to Dapper, and logs every call with its elapsed time.
/// </summary>
public sealed class DynamicQueryExecutor : IDynamicQueryExecutor
{
    private readonly IDbConnectionFactory _factory;
    private readonly ILogger<DynamicQueryExecutor> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="DynamicQueryExecutor"/>.
    /// </summary>
    /// <param name="factory">Factory used to resolve database connections.</param>
    /// <param name="logger">Logger for query diagnostics.</param>
    public DynamicQueryExecutor(IDbConnectionFactory factory,
                                ILogger<DynamicQueryExecutor> logger)
    {
        _factory = factory ?? throw new ArgumentNullException(nameof(factory));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<T>> QueryAsync<T>(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sql);

        _logger.LogDebug("QueryAsync<{Type}> START  SQL: {Sql}", typeof(T).Name, sql);
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            // Reuse the transactional connection if one is supplied.
            if (transaction is not null)
            {
                var cmd = BuildCommand(sql, parameters, transaction, cancellationToken);
                var result = await transaction.Connection!
                    .QueryAsync<T>(cmd).ConfigureAwait(false);

                LogSuccess(sw, typeof(T).Name, nameof(QueryAsync));
                return result;
            }

            await using var connWrapper = await OpenAsync(connectionString, cancellationToken)
                .ConfigureAwait(false);

            var command = BuildCommand(sql, parameters, null, cancellationToken);
            var rows = await connWrapper.Connection.QueryAsync<T>(command).ConfigureAwait(false);

            LogSuccess(sw, typeof(T).Name, nameof(QueryAsync));
            return rows;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "QueryAsync<{Type}> FAILED  SQL: {Sql}", typeof(T).Name, sql);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<T?> QueryFirstOrDefaultAsync<T>(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sql);

        _logger.LogDebug("QueryFirstOrDefaultAsync<{Type}> START  SQL: {Sql}", typeof(T).Name, sql);
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            if (transaction is not null)
            {
                var cmd = BuildCommand(sql, parameters, transaction, cancellationToken);
                var result = await transaction.Connection!
                    .QueryFirstOrDefaultAsync<T>(cmd).ConfigureAwait(false);

                LogSuccess(sw, typeof(T).Name, nameof(QueryFirstOrDefaultAsync));
                return result;
            }

            await using var connWrapper = await OpenAsync(connectionString, cancellationToken)
                .ConfigureAwait(false);

            var command = BuildCommand(sql, parameters, null, cancellationToken);
            var row = await connWrapper.Connection.QueryFirstOrDefaultAsync<T>(command).ConfigureAwait(false);

            LogSuccess(sw, typeof(T).Name, nameof(QueryFirstOrDefaultAsync));
            return row;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "QueryFirstOrDefaultAsync<{Type}> FAILED  SQL: {Sql}",
                typeof(T).Name, sql);
            throw;
        }
    }


    /// <inheritdoc/>
    public async Task<T?> QuerySingleOrDefaultAsync<T>(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sql);

        _logger.LogDebug("QuerySingleOrDefaultAsync<{Type}> START  SQL: {Sql}", typeof(T).Name, sql);
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            if (transaction is not null)
            {
                var cmd = BuildCommand(sql, parameters, transaction, cancellationToken);
                var result = await transaction.Connection!
                    .QuerySingleOrDefaultAsync<T>(cmd).ConfigureAwait(false);

                LogSuccess(sw, typeof(T).Name, nameof(QuerySingleOrDefaultAsync));
                return result;
            }

            await using var connWrapper = await OpenAsync(connectionString, cancellationToken)
                .ConfigureAwait(false);

            var command = BuildCommand(sql, parameters, null, cancellationToken);
            var row = await connWrapper.Connection.QuerySingleOrDefaultAsync<T>(command).ConfigureAwait(false);

            LogSuccess(sw, typeof(T).Name, nameof(QuerySingleOrDefaultAsync));
            return row;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "QuerySingleOrDefaultAsync<{Type}> FAILED  SQL: {Sql}",
                typeof(T).Name, sql);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<int> ExecuteAsync(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sql);

        _logger.LogDebug("ExecuteAsync START  SQL: {Sql}", sql);
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            if (transaction is not null)
            {
                var cmd = BuildCommand(sql, parameters, transaction, cancellationToken);
                var result = await transaction.Connection!
                    .ExecuteAsync(cmd).ConfigureAwait(false);

                LogSuccess(sw, null, nameof(ExecuteAsync), result);
                return result;
            }

            await using var connWrapper = await OpenAsync(connectionString, cancellationToken)
                .ConfigureAwait(false);

            var command = BuildCommand(sql, parameters, null, cancellationToken);
            var affected = await connWrapper.Connection.ExecuteAsync(command).ConfigureAwait(false);

            LogSuccess(sw, null, nameof(ExecuteAsync), affected);
            return affected;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExecuteAsync FAILED  SQL: {Sql}", sql);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<T?> ExecuteScalarAsync<T>(
        string sql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sql);

        _logger.LogDebug("ExecuteScalarAsync<{Type}> START  SQL: {Sql}", typeof(T).Name, sql);
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            if (transaction is not null)
            {
                var cmd = BuildCommand(sql, parameters, transaction, cancellationToken);
                var result = await transaction.Connection!
                    .ExecuteScalarAsync<T>(cmd).ConfigureAwait(false);

                LogSuccess(sw, typeof(T).Name, nameof(ExecuteScalarAsync));
                return result;
            }

            await using var connWrapper = await OpenAsync(connectionString, cancellationToken)
                .ConfigureAwait(false);

            var command = BuildCommand(sql, parameters, null, cancellationToken);
            var scalar = await connWrapper.Connection.ExecuteScalarAsync<T>(command).ConfigureAwait(false);

            LogSuccess(sw, typeof(T).Name, nameof(ExecuteScalarAsync));
            return scalar;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExecuteScalarAsync<{Type}> FAILED  SQL: {Sql}", typeof(T).Name, sql);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<(IEnumerable<T> Data, int TotalCount)> QueryPagedAsync<T>(
        string dataSql,
        string countSql,
        object? parameters = null,
        IDbTransaction? transaction = null,
        string? connectionString = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(dataSql);
        ArgumentException.ThrowIfNullOrWhiteSpace(countSql);

        _logger.LogDebug("QueryPagedAsync<{Type}> START  DataSQL: {DataSql}  CountSQL: {CountSql}",
            typeof(T).Name, dataSql, countSql);
        var sw = System.Diagnostics.Stopwatch.StartNew();

        IAsyncDbConnectionWrapper? connWrapper = null;
        try
        {
            IDbConnection conn;
            bool owned = transaction is null;

            if (owned)
            {
                connWrapper = await OpenAsync(connectionString, cancellationToken).ConfigureAwait(false);
                conn = connWrapper.Connection;
            }
            else
            {
                conn = transaction!.Connection!;
            }

            try
            {
                var dataCmd = BuildCommand(dataSql, parameters, transaction, cancellationToken);
                var countCmd = BuildCommand(countSql, parameters, transaction, cancellationToken);

                var data = await conn.QueryAsync<T>(dataCmd).ConfigureAwait(false);
                var total = await conn.QuerySingleOrDefaultAsync<int>(countCmd).ConfigureAwait(false);

                _logger.LogInformation(
                    "QueryPagedAsync<{Type}> OK  rows={Rows}  total={Total}  {Elapsed}ms",
                    typeof(T).Name, data.Count(), total, sw.ElapsedMilliseconds);

                return (data, total);
            }
            finally
            {
                if (owned && connWrapper is not null)
                    await connWrapper.DisposeAsync().ConfigureAwait(false);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "QueryPagedAsync<{Type}> FAILED  DataSQL: {Sql}",
                typeof(T).Name, dataSql);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<int> ExecuteInTransactionAsync(
        Func<IDbTransaction, Task<int>> work,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        string? connectionString = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(work);

        _logger.LogDebug("ExecuteInTransactionAsync START  IsolationLevel: {Level}", isolationLevel);
        var sw = System.Diagnostics.Stopwatch.StartNew();

        await using var connWrapper = await OpenAsync(connectionString, cancellationToken)
            .ConfigureAwait(false);

        using var tx = connWrapper.Connection.BeginTransaction(isolationLevel);
        try
        {
            var affectedRows = await work(tx).ConfigureAwait(false);
            tx.Commit();

            _logger.LogInformation("ExecuteInTransactionAsync COMMITTED  {Elapsed}ms",
                sw.ElapsedMilliseconds);
            return affectedRows;
        }
        catch (Exception ex)
        {
            tx.Rollback();
            _logger.LogError(ex, "ExecuteInTransactionAsync ROLLED BACK  {Elapsed}ms",
                sw.ElapsedMilliseconds);
            throw;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Opens a connection via the factory, using the override string when provided.
    /// Returns an <see cref="IAsyncDisposable"/> wrapper so callers can <c>await using</c> it.
    /// </summary>
    private async Task<IAsyncDbConnectionWrapper> OpenAsync(string? connectionString, CancellationToken cancellationToken)
    {
        var connectionWrapper = _factory.CreateConnection(connectionString);

        if (connectionWrapper.Connection.State != ConnectionState.Open)
        {
            if (connectionWrapper.Connection is System.Data.Common.DbConnection commonConn)
            {
                await commonConn.OpenAsync(cancellationToken).ConfigureAwait(false);
            }
            else
            {
                connectionWrapper.Connection.Open();
            }
        }
        return connectionWrapper;
    }

    /// <summary>
    /// Builds a Dapper <see cref="CommandDefinition"/> that carries the SQL, parameters,
    /// transaction, and cancellation token.
    /// </summary>
    private static CommandDefinition BuildCommand(
        string sql,
        object? parameters,
        IDbTransaction? transaction,
        CancellationToken cancellationToken)
        => new(sql,
               parameters: parameters,
               transaction: transaction,
               cancellationToken: cancellationToken);

    private void LogSuccess(System.Diagnostics.Stopwatch sw, string? typeName,
                            string method, int? rows = null)
    {
        if (rows.HasValue)
            _logger.LogInformation("{Method} OK  rowsAffected={Rows}  {Elapsed}ms",
                method, rows.Value, sw.ElapsedMilliseconds);
        else
            _logger.LogInformation("{Method}<{Type}> OK  {Elapsed}ms",
                method, typeName, sw.ElapsedMilliseconds);
    }

    // ── Nested helper: async-disposable connection wrapper ────────────────────

    /// <summary>
    /// Thin wrapper that lets callers dispose an <see cref="IDbConnection"/> with
    /// <c>await using</c>, regardless of whether the connection implements
    /// <see cref="IAsyncDisposable"/> itself.
    /// </summary>
    private sealed class AsyncConnectionWrapper : IAsyncDisposable
    {
        public IDbConnection Connection { get; }

        public AsyncConnectionWrapper(IDbConnection connection)
        {
            Connection = connection ?? throw new ArgumentNullException(nameof(connection));
        }

        public ValueTask DisposeAsync()
        {
            Connection.Dispose();
            return ValueTask.CompletedTask;
        }
    }
}

using System.Data;
using Oracle.ManagedDataAccess.Client;
using Microsoft.Data.Sqlite;
using DynamicTransaction.Interfaces;
using Microsoft.Extensions.Configuration;
using Portal.Domain.Entities;
using Portal.Infrastructure.Data.ExternalSources;

namespace Portal.Infrastructure.Data;

public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("Default") 
            ?? "Data Source=portal.db";
    }

    public DatabaseProvider DetectProvider(string connectionString)
    {
        var normalized = connectionString.ToLowerInvariant();
        var looksOracle = normalized.Contains("oracle") || normalized.Contains("user id=") || normalized.Contains("data source=//");
        return looksOracle ? DatabaseProvider.Oracle : DatabaseProvider.Sqlite;
    }

    public IDbConnection Create(string connectionString)
    {
        var provider = DetectProvider(connectionString);
        if (provider == DatabaseProvider.Oracle)
        {
            var oracleConnStr = new OracleService().GetConnectionString();
            return new OracleConnection(oracleConnStr);
        }
        return new SqliteConnection(connectionString);
    }

    public IAsyncDbConnectionWrapper CreateConnection(string? connectionStringOverride = null)
    {
        var connStr = connectionStringOverride ?? _connectionString;
        var conn = Create(connStr);
        return new AsyncDbConnectionWrapper(conn);
    }
}

public class AsyncDbConnectionWrapper : IAsyncDbConnectionWrapper
{
    public IDbConnection Connection { get; }

    public AsyncDbConnectionWrapper(IDbConnection connection)
    {
        Connection = connection;
    }

    public void Dispose()
    {
        Connection.Dispose();
    }

    public ValueTask DisposeAsync()
    {
        if (Connection is IAsyncDisposable asyncDisposable)
        {
            return asyncDisposable.DisposeAsync();
        }
        Connection.Dispose();
        return ValueTask.CompletedTask;
    }
}

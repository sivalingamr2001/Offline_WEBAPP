using System;
using System.Data;

namespace DynamicTransaction.Interfaces;

/// <summary>
/// Wraps an underlying IDbConnection to provide unified synchronous and asynchronous resource disposal,
/// allowing safe consumption via 'using' or 'await using' code blocks.
/// </summary>
public interface IAsyncDbConnectionWrapper : IDisposable, IAsyncDisposable
{
    /// <summary>
    /// The live underlying ADO.NET database connection resource.
    /// </summary>
    IDbConnection Connection { get; }
}

using DynamicTransaction.Interfaces;
using DynamicTransaction.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DynamicTransaction;

public static class DynamicTransactionExtension
{
    /// <summary>
    /// Registers the infrastructure required to run raw dynamic SQL queries at runtime via Dapper.
    /// </summary>
    /// <typeparam name="TFactory">The concrete implementation type of your IDbConnectionFactory.</typeparam>
    /// <param name="services">The IServiceCollection interface descriptor container.</param>
    /// <returns>The same service collection to allow for method chaining.</returns>
    public static IServiceCollection AddDynamicQueryInfrastructure<TFactory>(this IServiceCollection services)
        where TFactory : class, IDbConnectionFactory
    {
        services.TryAddScoped<IDbConnectionFactory, TFactory>();

        services.TryAddScoped<IDynamicQueryExecutor, DynamicQueryExecutor>();

        return services;
    }
}

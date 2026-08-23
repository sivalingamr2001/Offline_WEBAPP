using Portal.Domain.Repositories;
using Portal.Application.Services;
using Portal.Infrastructure.Data;
using Portal.Infrastructure.Repositories;
using Portal.Api.Auth;
using DynamicTransaction.Services;
using DynamicTransaction.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Bootstrap SQLite settings database configuration
SqliteBootstrap.Initialize(builder.Configuration);

// Add services to the container
builder.Services.AddControllers();

// Clean Architecture Dependency Injection mappings
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddSingleton<IDynamicQueryExecutor, DynamicQueryExecutor>();
builder.Services.AddScoped<IConfigRepository, ConfigRepository>();
builder.Services.AddScoped<IPortalManifestService, PortalManifestService>();
builder.Services.AddScoped<ISchemaIntrospectionService, SchemaIntrospectionService>();
builder.Services.AddScoped<DynamicSyncService>();

// CORS policies to support React client integration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowClient", policy =>
    {
        policy.WithOrigins(builder.Configuration["Cors:Origin"] ?? "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Setup mock authentication cookies and tokens
builder.Services.AddAuthentication("MockBearer")
    .AddScheme<MockBearerAuthOptions, MockBearerAuthHandler>("MockBearer", null);

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseCors("AllowClient");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

using Portal.Domain.Repositories;
using Portal.Application.Services;
using Portal.Infrastructure.Data;
using Portal.Infrastructure.Repositories;
using DynamicTransaction.Services;
using DynamicTransaction.Interfaces;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Bootstrap SQLite settings database configuration
SqliteBootstrap.Initialize(builder.Configuration);

// Add services to the container
builder.Services.AddControllers();

// Configure Swagger generation with Bearer authorization options
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Manufacturing Sync Portal API",
        Version = "v1",
        Description = "Clean Architecture dynamic synchronization endpoint test suite."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Bearer Token header using authentication tokens. Example: \"Bearer mock-token-xyz-123\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

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
        policy.WithOrigins(builder.Configuration["Client:Origin"] ?? "http://192.168.1.2:3000")
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

// Enable Swagger UI generally for testing
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Portal API v1");
    c.RoutePrefix = "swagger"; // Access Swagger UI at root/swagger (e.g. http://localhost:5000/swagger)
});

app.UseCors("AllowClient");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

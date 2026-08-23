using Portal.Api.Admin;
using Portal.Api.Auth;
using Portal.Api.Data;
using Portal.Api.Data2;
using Portal.Api.Portal;
using Portal.Api.Schema;
using Portal.Api.Sync;
using DynamicTransaction;

var builder = WebApplication.CreateBuilder(args);

var defaultConnectionString = builder.Configuration.GetConnectionString("Default") 
    ?? "Data Source=portal.db";
SqliteBootstrap.EnsureConfigStoreCreated(defaultConnectionString);

builder.Services.AddDynamicQueryInfrastructure<DbConnectionFactory>();
builder.Services.AddScoped<ConfigRepository>();
builder.Services.AddScoped<ISchemaIntrospectionService, SchemaIntrospectionService>();
builder.Services.AddScoped<DynamicSyncService>();
builder.Services.AddScoped<IPortalManifestService, PortalManifestService>();

builder.Services.AddAuthentication(MockBearerAuthHandler.SchemeName)
    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, MockBearerAuthHandler>(
        MockBearerAuthHandler.SchemeName, _ => { });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("PortalClient", policy => policy
        .WithOrigins(builder.Configuration["Client:Origin"] ?? "http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

builder.Services.AddControllers();

var app = builder.Build();

app.UseCors("PortalClient");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

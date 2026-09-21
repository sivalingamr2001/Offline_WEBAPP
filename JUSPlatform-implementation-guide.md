# JUSPlatform API — Project Implementation Guide

Publisher: **Janatics India**

This document explains how the **JUSPlatform** ASP.NET Core Web API was built, how a developer should extend it, and how a **similar API** can be created using the same configuration and architecture.

It is written from the **current codebase**, not from generic ASP.NET templates. Day-to-day commands live in [JUSPlatform/README.md](../JUSPlatform/README.md). Auth, tenancy, and layering rules live in [docs/policy.md](policy.md). Security baselines: [docs/security.md](security.md). Runtime history: [docs/migrate-net10.md](migrate-net10.md).

**Do not put real passwords, JWT signing keys, connection strings, internal IPs, or FQDNs in this file, chat, or git.** Use placeholders (`<DB_HOST>`, `CHANGE_ME`, `***`).

---

## Table of contents

1. [How this project was developed](#1-how-this-project-was-developed)
2. [Project purpose and architecture](#2-project-purpose-and-architecture)
3. [Project setup and environment](#3-project-setup-and-environment)
4. [Development standards and patterns](#4-development-standards-and-patterns)
5. [How to build the same project again](#5-how-to-build-the-same-project-again)
6. [Build and run guide](#6-build-and-run-guide)
7. [Deployment-ready considerations](#7-deployment-ready-considerations)
8. [Reuse guide for future projects](#8-reuse-guide-for-future-projects)
9. [Using this guide in Antigravity IDE](#9-using-this-guide-in-antigravity-ide)

---

## 1. How this project was developed

JUSPlatform grew as a **single ASP.NET Core Web SDK project** (`JUSPlatform/JUSPlatform.csproj`) rather than a multi-project Clean Architecture solution. Layers are **folders and namespaces** inside that project, with tests in sibling projects under `tests/`.

Typical evolution (architectural, not a git log):

1. **Web API host** — `Program.cs` as composition root; controllers under `api/v1/`.
2. **PostgreSQL as the product database** — EF Core + Npgsql, snake_case columns, migrate-on-boot, `--seed` CLI for SuperAdmin and the permission catalog.
3. **Identity and tenancy** — JWT Bearer (not cookie auth); permissions as JWT claims; organization id from `org_id`, not from the client body. Contract: [docs/policy.md](policy.md).
4. **Extracted infrastructure** — `AddJUSPlatform*` / `UseJUSPlatform*` extension methods so `Program.cs` stays a thin pipeline.
5. **Consistent HTTP errors** — `ApiErrorResponse`, `ExceptionHandlingMiddleware`, `ApiErrorStatusMiddleware`, FluentValidation via `ValidationFilter`.
6. **Platform capabilities** — Hangfire on PostgreSQL, optional Oracle read context, object storage (local/S3), Redis query cache, Serilog sinks, OpenTelemetry, Scalar UI in Development, SPA files from `wwwroot`.
7. **.NET 10** — TFM `net10.0` and SDK pin in `global.json`. Do not mix TFMs. See [docs/migrate-net10.md](migrate-net10.md).

**What was deliberately not adopted**

- No repository / unit-of-work layer. Application services use `AppDbContext` (and `OracleDbContext` where needed).
- No Swashbuckle Swagger UI. OpenAPI is `Microsoft.AspNetCore.OpenApi`; interactive docs are **Scalar** at `/docs` in Development.
- No `Asp.Versioning` package. Versioning is the URL prefix `api/v1/`.
- Product UI is a separate Vite app (`JUSPlatformUI/`), not Razor Pages.

**Assumption:** Feature modules (Users, Roles, Job Card, and so on) were added as **vertical slices** (entity → Fluent config → service → controller → Bruno → tests), matching [docs/policy.md](policy.md) section 4.

---

## 2. Project purpose and architecture

### 2.1 What the API is used for

The API is the backend for **Janatics Unified Suite**: organization and user administration, roles and permissions, and ERP-adjacent operations (background jobs, job-card status, customer complaints, file storage, optional Oracle connectivity). Authenticated clients are the React UI and other first-party tools. Smoke tests live in Bruno under `apidocs/`.

### 2.2 High-level architecture

```text
Browser / Bruno / SPA
        │
        ▼
 ASP.NET Core host (Kestrel locally; IIS ANCM in Windows hosting)
        │
        ├── Middleware (ids, exceptions, CORS, rate limit, logging, SPA, JWT)
        ├── Controllers (HTTP only)
        ├── Application (use cases, DTOs, validators, org scoping)
        ├── Domain (entities, enums, domain exceptions)
        └── Infrastructure (EF, JWT AuthService, Hangfire, storage, seed, sinks)
                ├── PostgreSQL  (AppDbContext — product data)
                └── Oracle      (OracleDbContext — optional; InMemory when disabled)
```

Mental model (non-negotiable):

| Concern | Mechanism |
|---------|-----------|
| Authentication | JWT Bearer |
| Authorization | Permission claims + named policies |
| Tenancy | JWT claim `org_id` via `ICurrentUser` |

### 2.3 Main layers and components

| Folder | Role |
|--------|------|
| `JUSPlatform/Controllers/` | Thin HTTP adapters |
| `JUSPlatform/Application/` | Feature use cases, contracts, FluentValidation validators |
| `JUSPlatform/Domain/` | Entities (`EntityBase`, `OrgScopedEntity`), enums, exceptions |
| `JUSPlatform/Authorization/` | Permission codes, policy names, claim type constants |
| `JUSPlatform/Infrastructure/` | DI, EF, JWT implementation, Hangfire, logging, storage, seed |
| `JUSPlatform/Middleware/` | Pipeline + MVC validation filter + API error JSON |
| `JUSPlatform/OpenApi/` | Document `v1` + Bearer scheme transformer |
| `JUSPlatform/Mock/` | Optional mock HTTP integrations |
| `JUSPlatform/wwwroot/` | Published SPA static files |
| `tests/JUSPlatform.UnitTests/` | Feature tests mirroring Application / Middleware |
| `tests/JUSPlatform.IntegrationTests/` | `WebApplicationFactory` HTTP tests |
| `apidocs/` | Bruno collection |

**Application feature folders today:** `Access`, `AppCatalog`, `Auth`, `Common`, `CustomerComplaint`, `Email`, `JobCard`, `Jobs`, `Oracle`, `Organizations`, `Roles`, `Storage`, `Users`.

**Controllers (route prefix unless noted):**

| Controller | Route |
|------------|--------|
| `AuthController` | `api/v1/auth` |
| `UsersController` | `api/v1/users` |
| `UserOrganizationsController` | `api/v1/users/{userId}/organizations` |
| `OrganizationsController` | `api/v1/organizations` |
| `OperatingUnitsController` | `api/v1/operating-units` |
| `RolesController` | `api/v1/roles` |
| `AppModulesController` | `api/v1/app-modules` |
| `AppMenusController` | `api/v1/app-menus` |
| `JobsController` | `api/v1/jobs` |
| `StorageController` | `api/v1/storage` |
| `CustomerComplaints` | `api/v1/customer-complaints` |
| `JobCardStatusController` | `api/v1/job-card-status` |
| `HealthController` | `/api`, `/api/heath`, `/api/oracle/connection` (anonymous) |
| `DemoController` | `api/v1/demo` (hidden unless `AppDebug`) |

### 2.4 Request and response flow

```text
1. Client sends HTTP (JSON, camelCase). Optional header X-Request-Id.
2. Forwarded headers (when RateLimit:TrustForwardedHeaders is on).
3. ResponseIdMiddleware sets X-Response-Id (and X-Trace-Id when observability is on).
4. ExceptionHandlingMiddleware wraps the rest of the pipeline.
5. CORS policy JUSPlatformUi.
6. ASP.NET rate limiter.
7. Serilog request logging (enriched with ResponseId).
8. SPA static files (if present).
9. Development only: /openapi/v1.json and Scalar /docs.
10. Authentication (JWT). Failed challenge → JSON 401 via ApiErrorResponseWriter.
11. Authorization (policies). Failed forbid → JSON 403 via ApiAuthorizationMiddlewareResultHandler.
12. Hangfire dashboard (when enabled).
13. ApiErrorStatusMiddleware: empty 401/403/404 on /api/* become ApiErrorResponse.
14. MVC: ValidationFilter + QueryResponseCacheFilter → controller.
15. Controller binds input, enforces [Authorize], calls I*Service, returns ActionResult.
16. Service uses ICurrentUser for tenant, AppDbContext for data, throws domain exceptions on failure.
17. Success: DTO or ApiPagedResponse. Failure: exception → ExceptionHandlingMiddleware → ApiErrorResponse.
18. Unmatched routes: MapJUSPlatformSpaAndApiFallback (JSON 404 for /api/*, SPA fallback otherwise).
```

**Exception → HTTP status** (`ExceptionHandlingMiddleware`):

| Exception | Status |
|-----------|--------|
| `FluentValidation.ValidationException` | 400 |
| `BusinessRuleException` | 400 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `UnauthorizedAccessException` | 401 |
| Anything else | 500 (logged; optional Bugsink) |

---

## 3. Project setup and environment

### 3.1 Required .NET version

| Item | Value |
|------|--------|
| SDK | `10.0.0` with `rollForward: latestFeature` (`global.json`) |
| Target framework | `net10.0` (API, unit tests, integration tests) |
| Default OS | Windows (PowerShell). Linux is supported. |
| EF tools | Repo-local `dotnet-ef` 9.0.19 (`.config/dotnet-tools.json`) |

If `dotnet --version` is still 8.x, put `%USERPROFILE%\.dotnet` first on `PATH` (see root [README.md](../README.md)).

### 3.2 NuGet packages (from `JUSPlatform.csproj`)

Keep versions aligned with the csproj; do not mix major TFMs.

| Package | Role |
|---------|------|
| `Microsoft.AspNetCore.Authentication.JwtBearer` | JWT |
| `System.IdentityModel.Tokens.Jwt` | Token create/parse |
| `Microsoft.AspNetCore.OpenApi` | OpenAPI document |
| `Scalar.AspNetCore` | `/docs` UI (Development) |
| `Microsoft.EntityFrameworkCore.Relational` / `Design` | EF Core 9 |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | PostgreSQL |
| `Oracle.EntityFrameworkCore` | Optional Oracle |
| `Microsoft.EntityFrameworkCore.InMemory` | Tests / Oracle disabled |
| `FluentValidation` + `FluentValidation.DependencyInjectionExtensions` | Validators |
| `Hangfire.AspNetCore` + `Hangfire.PostgreSql` | Background jobs |
| `Serilog.AspNetCore` + Console/File/Seq/OpenTelemetry sinks | Logging |
| `OpenTelemetry.*` | Traces, metrics, OTLP |
| `Sentry.AspNetCore` + `Sentry.Serilog` | Bugsink-compatible error capture |
| `StackExchange.Redis` | Optional query cache |
| `AWSSDK.S3` | S3-compatible storage |
| `Dapper` | Log sink / some Oracle reads |
| `Newtonsoft.Json` | Remaining JSON interop |

### 3.3 Configuration files

| File | In git? | Purpose |
|------|---------|---------|
| `JUSPlatform/appsettings.json` | Yes — placeholders only | Base keys |
| `JUSPlatform/appsettings.Development.json` | **No** (gitignored) | Local overrides |
| `JUSPlatform/appsettings.Development.json.example` | Yes | Copy template |
| `JUSPlatform/appsettings.Testing.json` | Yes | Test host |
| `JUSPlatform/Properties/launchSettings.json` | Yes | Local URLs and non-secret env |
| `tests/JUSPlatform.IntegrationTests/appsettings.Testing.json` | Yes | Integration tests |
| User secrets | Outside repo | Connection strings, JWT key |
| Environment variables | Host-specific | IIS / systemd / Docker |

**Load order (Development `dotnet run`):** `appsettings.json` → `appsettings.{Environment}.json` → user secrets → environment variables → command line. Later wins.

`UserSecretsId` is in `JUSPlatform.csproj`. The id is not a secret; the JSON in the user-secrets folder is.

### 3.4 Environment variables and app settings

Nested keys use `__` in environment variables (`ConnectionStrings__Default`, `Jwt__SigningKey`).

**Sections bound in code (values must stay placeholders in git):**

- `ConnectionStrings:Default` — PostgreSQL (Npgsql shape)
- `ConnectionStrings:Oracle` — required only when `Oracle:Enabled` is true
- `ConnectionStrings:Redis` or `Redis:ConnectionString`
- `Jwt` — `Issuer`, `Audience`, `SigningKey`, `ExpiryMinutes`
- `Cors:Origins` — default `http://localhost:5173`
- `RateLimit`, `Email`, `Oracle`, `Storage`, `Redis`, `Jobs`, `Hangfire`
- `Observability`, `MockIntegrations`, `Bugsink`, `Seed`, `OpenApi`
- `LogSink`, `Serilog`, `Logging`, `ErrorResponse`, `AppDebug`
- `UseInMemoryDatabase` — testing
- `AllowedHosts`

Example **shape** (never commit real secrets):

```json
{
  "ConnectionStrings": {
    "Default": "Host=<DB_HOST>;Port=5432;Database=<DB_NAME>;Username=<DB_USER>;Password=<DB_PASSWORD>"
  },
  "Jwt": {
    "Issuer": "JUSPlatform",
    "Audience": "JUSPlatform",
    "SigningKey": "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_KEY_32+",
    "ExpiryMinutes": 60
  },
  "Cors": {
    "Origins": [ "http://localhost:5173" ]
  },
  "OpenApi": {
    "Title": "Janatics Unified Suite API",
    "Version": "v1"
  }
}
```

User-secrets (this machine only):

```powershell
dotnet user-secrets set "ConnectionStrings:Default" "Host=<DB_HOST>;Port=5432;Database=<DB_NAME>;Username=<DB_USER>;Password=<DB_PASSWORD>" --project JUSPlatform\JUSPlatform.csproj
dotnet user-secrets set "Jwt:SigningKey" "CHANGE_ME" --project JUSPlatform\JUSPlatform.csproj
```

### 3.5 Database connection

- **Product engine is PostgreSQL.** Do not point `ConnectionStrings:Default` at MariaDB, MySQL, SQL Server, or SQLite.
- Npgsql shape: `Host=<DB_HOST>;Port=5432;Database=<DB_NAME>;Username=<DB_USER>;Password=<DB_PASSWORD>`
- If the key is missing, DI falls back to localhost `jusplatform` with an empty password (local only).
- `DatabaseInitializationHostedService` applies **pending EF migrations on boot**. It does **not** seed. Seed: `dotnet run --project JUSPlatform\JUSPlatform.csproj -- --seed` then exit.
- Testing: `UseInMemoryDatabase: true`.
- Oracle: `Oracle:Enabled` false → `OracleDbContext` uses InMemory. True → `ConnectionStrings:Oracle` is required.

C# properties stay PascalCase (`CreatedAt`); PostgreSQL columns are snake_case (`created_at`) via the EF name rewriter.

---

## 4. Development standards and patterns

Full contract: [docs/policy.md](policy.md). Summary below.

### 4.1 Controllers

- `[ApiController]`, `[Route("api/v1/...")`, `[Tags("...")]`, `[Authorize]` at class level unless the endpoint is anonymous.
- Inject `I*Service` via primary constructor. No EF in controllers.
- `[EndpointName("camelCaseOperationId")]`, `[EndpointSummary]`, typed `[ProducesResponseType]`.
- Capability checks: `[Authorize(Policy = Policies.UsersRead)]`, never `if (user.Role == "Admin")`.
- JSON: camelCase; enums as strings.

Example (existing `UsersController`):

```csharp
[ApiController]
[Route("api/v1/users")]
[Tags("Users")]
[Authorize]
[Produces("application/json")]
public sealed class UsersController(IUserService service) : ControllerBase
{
    [HttpGet("me")]
    [EndpointName("getCurrentUser")]
    [EndpointSummary("Get current user")]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> Me(CancellationToken cancellationToken)
        => Ok(await service.GetCurrentAsync(cancellationToken));

    [HttpGet]
    [Authorize(Policy = Policies.UsersRead)]
    [EndpointName("listUsers")]
    public async Task<ActionResult<ApiPagedResponse<UserDto>>> List(
        [FromQuery] UserListQuery query,
        CancellationToken cancellationToken)
        => Ok(await service.ListAsync(query, cancellationToken));
}
```

### 4.2 Services (not repositories)

- Interface + implementation in `Application/<Feature>/` (example: `IUserService` / `UserService`).
- **Auth** is the exception: `IAuthService` in Application, `AuthService` in `Infrastructure/Authentication/`.
- Scoped lifetime. Inject `AppDbContext`, `ICurrentUser`, other application services.
- Tenant: `ICurrentUser.RequireOrganizationId()` for org users. Do not take `organizationId` from the client for tenant scope.
- Throw `NotFoundException`, `BusinessRuleException`, `ConflictException` — do not return ad-hoc error objects from controllers.

### 4.3 Models and DTOs

- **Entities** in `Domain/Entities/`, inherit `EntityBase` or `OrgScopedEntity`.
- **Fluent API** in `Infrastructure/Persistence/Configurations/` — one type per file.
- **Requests / DTOs / list queries** next to the feature in Application (not a global `Models/` dump).
- List endpoints use shared paging types in `Application/Common` (`ApiPagedResponse`, `PagedListQuery`).

`EntityBase` fields: `Id`, `CreatedAt`, `UpdatedAt`, `IsDeleted`, `DeletedAt`, `DeletedByUserId`. Soft-delete filters belong in EF configuration.

### 4.4 Dependency injection

Register **new** application services in `AddJUSPlatformInfrastructure` (`Infrastructure/DependencyInjection/ServiceCollectionExtensions.cs`):

```csharp
services.AddScoped<IUserService, UserService>();
```

Validators: assembly scan from `LoginRequestValidator` (all FluentValidation validators in the API assembly).

Global MVC filters:

```csharp
services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
    options.Filters.Add<QueryResponseCacheFilter>();
})
```

Options: `services.Configure<TOptions>(configuration.GetSection(TOptions.SectionName))`.

### 4.5 Middleware and filters

**Pipeline order in `Program.cs` (do not reorder without a reason):**

1. `UseJUSPlatformForwardedHeaders()`
2. `ResponseIdMiddleware`
3. `ExceptionHandlingMiddleware`
4. `UseCors("JUSPlatformUi")`
5. `UseJUSPlatformRateLimiting()`
6. `UseSerilogRequestLogging(...)`
7. `UseJUSPlatformSpa()`
8. Development: `MapOpenApi()`, `MapScalarApiReference("/docs", ...)`
9. `UseAuthentication()`
10. `UseAuthorization()`
11. `UseJUSPlatformHangfireDashboard()`
12. `ApiErrorStatusMiddleware`
13. `MapControllers()`
14. `MapJUSPlatformSpaAndApiFallback()`

CLI modes `--seed` and ensure-PES **build the host and exit** before this pipeline.

### 4.6 Logging, validation, exception handling

- **Logging:** `UseJUSPlatformLogging`; `LogSink:Provider` = File (default), Database, or Seq. Do not log passwords or JWTs. Audit trail is `audit_entries` via `EntityChangeInterceptor`, not Serilog.
- **Validation:** FluentValidation; property names camelCase in error keys. `ValidationFilter` validates action arguments.
- **ModelState:** `InvalidModelStateResponseFactory` → `ApiErrorFactory.FromModelState`.
- **Errors:** `ApiErrorResponse` (`success`, `detail`, `errors`; extra fields gated by `ErrorResponse` / `AppDebug`).

### 4.7 Authentication and authorization

- Scheme: JWT Bearer. Claims include `sub`, `org_id` (org users), `permission` (repeated), `role_name`, `jti`.
- Logout: `ITokenRevocationStore` (in-memory) checks `jti` in `OnTokenValidated`.
- Policies registered 1:1 with permission codes in `AddPermissionPolicies`. SuperAdmin role bypasses permission checks.
- Login is enum-safe (same 401; dummy hash work if user missing).
- Anonymous + rate-limited: login, register, password reset, health ping.

When adding a capability: catalog in `Permissions.cs` → `Policies.*` → `AddPermissionPolicies` → `[Authorize(Policy = ...)]` → seed (`--seed`) → Bruno + OpenAPI.

---

## 5. How to build the same project again

This section is a **recreate playbook**. For a **new** product API, also read [section 8](#8-reuse-guide-for-future-projects).

### 5.1 Sample folder structure

```text
<Repo>/
  global.json                          # SDK 10.0.0
  .config/dotnet-tools.json            # dotnet-ef, reportgenerator
  JUSPlatform/
    JUSPlatform.csproj                 # Microsoft.NET.Sdk.Web, net10.0
    Program.cs
    appsettings.json
    appsettings.Development.json.example
    Dockerfile
    Properties/launchSettings.json
    Authorization/                     # Permissions, Policies, SystemRoles
    Controllers/
    Domain/
      Common/EntityBase.cs
      Entities/
      Enums/
      Exceptions/
    Application/
      Common/                          # ICurrentUser, ApiErrorResponse, paging
      Auth/
      <Feature>/
    Infrastructure/
      DependencyInjection/ServiceCollectionExtensions.cs
      Persistence/                     # AppDbContext, Configurations, Migrations, Seed, Oracle
      Authentication/
      Authorization/
      Logging/
      RateLimiting/
      Hangfire/
      Jobs/
      Storage/
      Observability/
      Hosting/                         # SPA
    Middleware/
    OpenApi/
    Mock/
    wwwroot/
  tests/
    JUSPlatform.UnitTests/
    JUSPlatform.IntegrationTests/
  apidocs/
  docs/
    policy.md
    JUSPlatform-implementation-guide.md
```

Naming: feature folders PascalCase; routes kebab-case plurals; permissions `{resource}.{action}` singular (`user.read`); policies PascalCase (`UsersRead`); DI extensions `AddJUSPlatform*` / `UseJUSPlatform*`.

### 5.2 Exact steps (greenfield using this architecture)

1. **Pin the SDK** — copy `global.json`. Confirm `dotnet --version` is 10.x.
2. **Create the web project**
   ```powershell
   dotnet new webapi -n JUSPlatform --framework net10.0 --no-openapi
   ```
   **Assumption:** `--no-openapi` avoids a second OpenAPI style; this repo registers OpenAPI in `OpenApi/OpenApiExtensions.cs`. Or copy `JUSPlatform.csproj` and add package references from the current csproj.
3. **Enable nullable and implicit usings** (already in the csproj). Add `UserSecretsId` (new GUID per project).
4. **Copy the common skeleton** listed in [section 8](#81-files-to-copy-as-a-base-template). Replace namespace `JUSPlatform` only if the new product is not JUSPlatform.
5. **Wire `Program.cs`** exactly as in this repo: bootstrap Serilog → Bugsink → logging → `AddJUSPlatformInfrastructure` → `AddJUSPlatformOpenApi` → seed CLI → middleware order in [section 4.5](#45-middleware-and-filters). Keep `public partial class Program;` for integration tests.
6. **Configuration** — commit `appsettings.json` with placeholders. Copy the Development example to a **gitignored** `appsettings.Development.json`. Set user-secrets for `ConnectionStrings:Default` and `Jwt:SigningKey`.
7. **PostgreSQL** — create empty database. Run `--seed` once. Verify `GET /api`.
8. **Add the first feature module** (repeatable recipe):
   1. Domain entity (`EntityBase` / `OrgScopedEntity`).
   2. `IEntityTypeConfiguration<>` in Persistence Configurations.
   3. `dotnet ef migrations add <Name> --project JUSPlatform\JUSPlatform.csproj --output-dir Infrastructure/Persistence/Migrations`
   4. Application: requests, DTO, `IFooService` / `FooService`, `*Validator`.
   5. Controller under `api/v1/<kebab>`.
   6. Permission + policy + `AddPermissionPolicies` + `--seed`.
   7. `services.AddScoped<IFooService, FooService>()`.
   8. Unit tests under `tests/JUSPlatform.UnitTests/<Feature>/`.
   9. Integration test if HTTP wiring is non-trivial.
   10. Bruno file under `apidocs/<feature>/`.
9. **Do not add a repository.** Query through `AppDbContext` in the service.
10. **OpenAPI** — every public action needs `EndpointName`, summary, `ProducesResponseType`. Scalar appears only in Development.

### 5.3 Example `Program.cs` composition (abbreviated)

```csharp
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

var builder = WebApplication.CreateBuilder(args);
builder.AddJUSPlatformBugsink();
builder.Host.UseJUSPlatformLogging(preserveStaticLogger: builder.Environment.IsEnvironment("Testing"));
builder.Services.AddJUSPlatformInfrastructure(builder.Configuration);
builder.Services.AddJUSPlatformOpenApi(builder.Configuration);

if (DatabaseBootstrap.IsSeedCommand(args))
{
    var seedApp = builder.Build();
    await DatabaseBootstrap.RunSeedCommandAsync(/* ... */);
    return;
}

var app = builder.Build();
app.UseJUSPlatformForwardedHeaders();
app.UseMiddleware<ResponseIdMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("JUSPlatformUi");
app.UseJUSPlatformRateLimiting();
app.UseSerilogRequestLogging(/* ResponseId enricher */);
app.UseJUSPlatformSpa();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/docs", /* title, hide telemetry */);
}
app.UseAuthentication();
app.UseAuthorization();
app.UseJUSPlatformHangfireDashboard();
app.UseMiddleware<ApiErrorStatusMiddleware>();
app.MapControllers();
app.MapJUSPlatformSpaAndApiFallback();
app.Run();

public partial class Program;
```

---

## 6. Build and run guide

Commands from **repo root**. Full detail: [JUSPlatform/README.md](../JUSPlatform/README.md).

### 6.1 Build

```powershell
dotnet restore JUSPlatform\JUSPlatform.csproj
dotnet build JUSPlatform\JUSPlatform.csproj
```

### 6.2 Run locally

```powershell
dotnet run --project JUSPlatform\JUSPlatform.csproj -- --seed
dotnet run --project JUSPlatform\JUSPlatform.csproj
```

| Surface | URL |
|---------|-----|
| HTTP profile | `http://localhost:5201` |
| HTTPS profile | `https://localhost:7034` |
| Ping | `GET /api` |
| OpenAPI | `GET /openapi/v1.json` (Development) |
| Scalar | `GET /docs` (Development) |
| UI (separate) | `http://localhost:5173` (`pnpm run dev` in `JUSPlatformUI`) |

`dotnet run` migrates pending EF changes. It does **not** seed.

Hot reload:

```powershell
cd JUSPlatform
dotnet watch run --no-restore
```

Seeded demo login (override via `Seed` config): `admin@demo.local` / `ChangeMe123!`. Register an organization to receive an Admin JWT with `org_id`.

### 6.3 Test endpoints

- **Scalar** — Development `/docs`, Authorize with Bearer token from login.
- **Bruno** — `apidocs/` (`opencollection.yml`, `environments/local.yml`).
- **curl / IDE HTTP** — `POST /api/v1/auth/login` then `Authorization: Bearer <token>`.
- **Automated**
  ```powershell
  .\scripts\test.ps1 -Unit
  .\scripts\test.ps1 -Integration
  dotnet test tests\JUSPlatform.UnitTests\JUSPlatform.UnitTests.csproj
  dotnet test tests\JUSPlatform.IntegrationTests\JUSPlatform.IntegrationTests.csproj
  ```

Coverage (when changing Application, Controllers, Middleware, Domain, Authorization): `.\scripts\test-coverage.ps1`. HTML: `artifacts/coverage-report/index.html`. Do not add tests only to raise % on OpenAPI, Mock, or Infrastructure wiring.

### 6.4 Debug in the IDE

`Properties/launchSettings.json` profiles:

- **http** — `http://localhost:5201`, `ASPNETCORE_ENVIRONMENT=Development`, `MockIntegrations__Enabled=true`, `Observability__Enabled=true`
- **https** — `https://localhost:7034` and HTTP 5201, same env

**Visual Studio / Rider:** set startup project `JUSPlatform`, profile `http`, F5. Breakpoints in services and middleware work; exception middleware will still catch unhandled exceptions unless you break on thrown CLR exceptions.

**Cursor / VS Code:** `.NET` debugger, program = `JUSPlatform` project, cwd repo or `JUSPlatform`. Match launch profile env vars.

**Assumption:** Antigravity and other IDEs debug the same way if they launch `dotnet run` / the `http` profile against port 5201.

### 6.5 Common errors and fixes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| SDK / TFM mismatch | .NET 8 first on PATH | Prepend user `.dotnet` folder; check `global.json` |
| Cannot connect to database | Wrong host/user/password | User-secrets Npgsql string; create database `jusplatform` |
| JWT 401 after login | Signing key / issuer / audience mismatch between issue and validate | Same `Jwt` section in the running environment |
| CORS errors from Vite | Origin not in `Cors:Origins` | Add `http://localhost:5173` (or the UI origin) |
| `ConnectionStrings:Oracle is required` | `Oracle:Enabled` true without secret | Disable Oracle locally or set `ConnectionStrings__Oracle` |
| Tests hitting real Postgres | `UseInMemoryDatabase` not true in Testing | Use Testing environment / test appsettings |
| `dotnet ef` not found | Tools not restored | `dotnet tool restore` from repo root |
| Permission 403 after adding a code | Catalog not seeded / policy not registered | Update `Permissions` + `AddPermissionPolicies` + `--seed` |
| Empty 404 HTML on `/api/...` | Fallback serving SPA | API 404s must stay under `/api` so `ApiErrorStatusMiddleware` / API fallback apply |

---

## 7. Deployment-ready considerations

**Release path:** DEV → SVN → Jenkins → UAT → Approval → PROD. Do not deploy to Production from a developer workstation. Do not use Production credentials in local config or AI chats.

### 7.1 Production configuration

- Windows host (default): IIS + ASP.NET Core 10 Hosting Bundle, in-process ANCM. See [deploy/iis/README.md](../deploy/iis/README.md).
- Linux: systemd + reverse proxy. See [deploy/README.md](../deploy/README.md).
- Publish: `dotnet publish .\JUSPlatform\JUSPlatform.csproj -c Release` (or `.\deploy\scripts\publish.ps1`). `UseAppHost=false` for IIS.
- Hangfire runs **in the same worker process** as the API.
- Secrets: IIS environment variables or a locked-down env file (`deploy/systemd/jusplatform.env.example` is placeholders only).

### 7.2 Appsettings per environment

| Environment | Typical store |
|-------------|----------------|
| Development | gitignored JSON + user-secrets |
| Testing | `appsettings.Testing.json`, InMemory |
| UAT / Production | Host env vars + `appsettings.Production.json` **without secrets** |

`ASPNETCORE_ENVIRONMENT` selects `appsettings.{Environment}.json`. Prefer env vars for `ConnectionStrings__Default` and `Jwt__SigningKey`.

### 7.3 Security practices (already in this codebase)

- JWT validation: issuer, audience, lifetime, signing key.
- Permission policies on write/read endpoints; SuperAdmin is seeded, not a client-chosen role check.
- Rate limiting on auth endpoints; optional forwarded headers only when the proxy is trusted.
- Enum-safe login; dummy password work.
- Soft-delete query filters.
- Minimal error JSON; stack traces only when `AppDebug` / `ErrorResponse` allow.
- OpenAPI + Scalar mapped in **Development only** in `Program.cs`. **Assumption:** if UAT needs Scalar, enable it explicitly behind auth; do not assume it is on in Production.
- CORS allowlist, not `AllowAnyOrigin` with credentials.
- Align with [docs/security.md](security.md).

### 7.4 API versioning

**As implemented:** URL prefix `api/v1/`. OpenAPI document name `v1` (`OpenApiExtensions.DocumentName`).

There is **no** `Asp.Versioning` (or equivalent) package.

**Assumption for a breaking v2:** add `api/v2/` controllers (or introduce a versioning library) and a second OpenAPI document. Do not silently change `v1` contracts.

### 7.5 Swagger / OpenAPI

- Package: `Microsoft.AspNetCore.OpenApi` (not Swashbuckle UI).
- Registration: `AddJUSPlatformOpenApi` → document transformer for title, contact, Bearer scheme.
- JSON: `/openapi/v1.json`
- UI: Scalar `/docs` in Development.
- Stable `operationId` from `[EndpointName]` (Orval / frontend codegen).

---

## 8. Reuse guide for future projects

Use this repo as a **platform template** for another internal ASP.NET Core API that should share auth style, errors, logging, and PostgreSQL conventions.

### 8.1 Files to copy as a base template

Copy, then rename namespaces only if the new product is not JUSPlatform:

| Copy | Why |
|------|-----|
| `global.json`, `.config/dotnet-tools.json` | SDK and EF tool versions |
| `Program.cs` shape | Pipeline order and seed CLI |
| `Infrastructure/DependencyInjection/ServiceCollectionExtensions.cs` | Composition root of DI |
| `Middleware/*` | Errors, response id, validation filter |
| `OpenApi/*` | Document + Bearer |
| `Domain/Common/EntityBase.cs`, `Domain/Exceptions/*` | Shared persistence and error types |
| `Application/Common/*` (`ICurrentUser`, API envelopes, paging) | HTTP/app contract |
| `Authorization/Permissions.cs` **pattern** (empty catalog for the new product) | Policy model |
| `Infrastructure/Authorization/PermissionAuthorization.cs` | Handler |
| Logging, rate limiting, observability, hosting (SPA) extensions | Cross-cutting |
| `Infrastructure/Persistence/AppDbContext` + name rewriter + interceptor **pattern** | PostgreSQL + audit |
| `appsettings.json` **keys** (placeholder values only) | Config surface |
| `Dockerfile`, `Properties/launchSettings.json` | Run/publish |
| Test project layouts + `WebApplicationFactory` | Quality gate |
| `docs/policy.md` | Working contract for agents and humans |

Do **not** copy production secrets, real `appsettings.Development.json`, customer data, or NDA files.

### 8.2 What to change per project

- Assembly and default namespace, `UserSecretsId`
- `Jwt:Issuer` / `Audience` names, CORS origins, OpenAPI title
- `ConnectionStrings:Default` database name
- `Seed` admin email/password **placeholders** (real values only in secrets)
- Permission catalog and policies
- Feature folders, controllers, entities, Bruno folders
- Hangfire / Oracle / Redis / storage **enabled flags** for that product

### 8.3 What should remain common

- Middleware order and `ApiErrorResponse` shape
- JWT + permission claims + `org_id` tenancy (if the product is multi-tenant)
- Thin controllers; no repositories
- FluentValidation + camelCase JSON + string enums
- PostgreSQL + snake_case columns
- Config cascade (appsettings → secrets → env)
- OpenAPI `EndpointName` + Bruno for every public route
- Tests for in-scope behavior (`Application`, `Controllers`, `Middleware`, `Domain`, `Authorization`)
- No secrets in git; no Production deploy from the laptop

---

## 9. Using this guide in Antigravity IDE

Antigravity (and similar agent IDEs) should treat this file plus [docs/policy.md](policy.md) as the **architecture source of truth**. Do not let the agent invent repositories, Swashbuckle, or SQL Server.

### 9.1 Open the company project

1. Open the **approved company workspace** (`janatics-unified`), not a public GitHub copy.
2. Confirm `global.json` and `JUSPlatform/JUSPlatform.csproj` target `net10.0`.
3. Pin in agent/context: `docs/JUSPlatform-implementation-guide.md`, `docs/policy.md`, `JUSPlatform/Program.cs`.

### 9.2 Recreate or extend consistently (agent tasks)

Run **one section at a time** so the agent does not skip DI or tests:

| Task | Prompt the IDE to follow |
|------|---------------------------|
| Scaffold | Section 5.2 steps 1–6; copy skeleton from 8.1 |
| First module | Section 5.2 step 8 (entity → config → migration → service → controller → permission → DI → tests → Bruno) |
| Register services | `ServiceCollectionExtensions.AddJUSPlatformInfrastructure` only |
| Pipeline | Do not reorder `Program.cs` middleware |
| Auth | `[Authorize(Policy = Policies.*)]` and `Permissions.Catalog` |
| Verify | `dotnet build`, `.\scripts\test.ps1 -Unit`, `GET /api` |

If the agent proposes `IRepository<T>`, Cookie auth, or `app.UseSwagger()`, reject it and point at this guide.

### 9.3 Debug and secrets

- Use the **http** launch profile (`http://localhost:5201`).
- Put connection strings and signing keys in **user-secrets** or gitignored Development JSON — **never** in the chat, the guide, or commits.
- Demo seed users already in git (`admin@demo.local`) may be mentioned; live tenant data must not.

### 9.4 After the agent finishes

Human checklist:

- [ ] Middleware order matches section 4.5
- [ ] New service is scoped in `AddJUSPlatformInfrastructure`
- [ ] Permission + policy + seed if a new capability exists
- [ ] OpenAPI `EndpointName` and Bruno file exist
- [ ] Unit (and integration if HTTP) tests cover happy path and one failure
- [ ] No secrets in the diff

---

## Related documents

| Document | Use |
|----------|-----|
| [JUSPlatform/README.md](../JUSPlatform/README.md) | Local setup, seed, Docker optional, config priority |
| [docs/policy.md](policy.md) | JWT, permissions, tenancy, layering |
| [docs/security.md](security.md) | Security expectations |
| [docs/migrate-net10.md](migrate-net10.md) | .NET 8 → 10 |
| [deploy/iis/README.md](../deploy/iis/README.md) | Windows IIS hosting |
| [deploy/README.md](../deploy/README.md) | Linux hosting |
| [tests/README.md](../tests/README.md) | Test projects |
| Root [README.md](../README.md) | Monolith get-started (API + UI) |

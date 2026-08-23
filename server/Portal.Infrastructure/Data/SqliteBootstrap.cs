using System.Data;
using Dapper;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;

namespace Portal.Infrastructure.Data;

public static class SqliteBootstrap
{
    public static void Initialize(IConfiguration config)
    {
        var connStr = config.GetConnectionString("Default") ?? "Data Source=portal.db";
        using var db = new SqliteConnection(connStr);
        db.Open();

        db.Execute(@"
            CREATE TABLE IF NOT EXISTS DATA_CONNECTION (
                ID TEXT PRIMARY KEY,
                NAME TEXT NOT NULL,
                PROVIDER TEXT NOT NULL,
                CONNECTION_STRING TEXT NOT NULL,
                IS_ACTIVE INTEGER NOT NULL DEFAULT 1,
                CREATED_AT_UTC TEXT NOT NULL
            );");

        db.Execute(@"
            CREATE TABLE IF NOT EXISTS SYNC_TABLE_CONFIG (
                ID TEXT PRIMARY KEY,
                CONNECTION_ID TEXT NOT NULL,
                TABLE_NAME TEXT NOT NULL,
                PRIMARY_KEY_COLUMN TEXT NOT NULL,
                TENANT_COLUMN TEXT,
                ALLOW_CREATE INTEGER NOT NULL DEFAULT 1,
                ALLOW_UPDATE INTEGER NOT NULL DEFAULT 1,
                ALLOW_DELETE INTEGER NOT NULL DEFAULT 1,
                IS_ENABLED INTEGER NOT NULL DEFAULT 1,
                CREATED_AT_UTC TEXT NOT NULL,
                FOREIGN KEY(CONNECTION_ID) REFERENCES DATA_CONNECTION(ID)
            );");

        db.Execute(@"
            CREATE TABLE IF NOT EXISTS GRID_COLUMN_CONFIG (
                ID TEXT PRIMARY KEY,
                SYNC_TABLE_ID TEXT NOT NULL,
                COLUMN_NAME TEXT NOT NULL,
                DISPLAY_LABEL TEXT NOT NULL,
                DATA_TYPE TEXT NOT NULL DEFAULT 'string',
                IS_VISIBLE INTEGER NOT NULL DEFAULT 1,
                IS_EDITABLE INTEGER NOT NULL DEFAULT 1,
                DISPLAY_ORDER INTEGER NOT NULL DEFAULT 0,
                WIDTH INTEGER,
                FOREIGN KEY(SYNC_TABLE_ID) REFERENCES SYNC_TABLE_CONFIG(ID)
            );");

        db.Execute(@"
            CREATE TABLE IF NOT EXISTS PORTAL_SECTION_CONFIG (
                ID TEXT PRIMARY KEY,
                SYNC_TABLE_ID TEXT NOT NULL,
                SECTION_KEY TEXT NOT NULL UNIQUE,
                LABEL TEXT NOT NULL,
                ICON TEXT NOT NULL,
                ROUTE TEXT NOT NULL,
                DISPLAY_ORDER INTEGER NOT NULL DEFAULT 0,
                ROLES_CSV TEXT NOT NULL,
                IS_ENABLED INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY(SYNC_TABLE_ID) REFERENCES SYNC_TABLE_CONFIG(ID)
            );");

        db.Execute(@"
            CREATE TABLE IF NOT EXISTS SYNC_ROW_META (
                SYNC_TABLE_ID TEXT NOT NULL,
                ROW_PK TEXT NOT NULL,
                VERSION_NUMBER INTEGER NOT NULL,
                UPDATED_AT_UTC TEXT NOT NULL,
                UPDATED_BY TEXT NOT NULL,
                DELETED_AT_UTC TEXT,
                PRIMARY KEY (SYNC_TABLE_ID, ROW_PK)
            );");

        db.Execute(@"
            CREATE TABLE IF NOT EXISTS SYNC_CHANGE (
                SERVER_CURSOR INTEGER PRIMARY KEY AUTOINCREMENT,
                SYNC_TABLE_ID TEXT NOT NULL,
                ROW_PK TEXT NOT NULL,
                CHANGE_TYPE TEXT NOT NULL,
                RECORD_JSON TEXT,
                CREATED_AT_UTC TEXT NOT NULL
            );");

        db.Execute(@"
            CREATE TABLE IF NOT EXISTS SYNC_OPERATION (
                OPERATION_ID TEXT PRIMARY KEY,
                SYNC_TABLE_ID TEXT NOT NULL,
                CLIENT_ID TEXT NOT NULL,
                ROW_PK TEXT NOT NULL,
                OPERATION_TYPE TEXT NOT NULL,
                STATUS TEXT NOT NULL,
                RESULT_JSON TEXT,
                CREATED_AT_UTC TEXT NOT NULL,
                COMPLETED_AT_UTC TEXT
            );");

        db.Execute(@"
            CREATE TABLE IF NOT EXISTS APP_USER (
                USERNAME TEXT PRIMARY KEY,
                PASSWORD_HASH TEXT NOT NULL,
                DISPLAY_NAME TEXT NOT NULL,
                ROLES_CSV TEXT NOT NULL
            );");

        // Seed Users
        db.Execute(@"
            INSERT OR IGNORE INTO APP_USER (USERNAME, PASSWORD_HASH, DISPLAY_NAME, ROLES_CSV)
            VALUES 
                ('admin', 'admin123', 'System Administrator', 'admin,planner,supervisor'),
                ('planner', 'planner123', 'Lead Planner', 'planner'),
                ('supervisor', 'supervisor123', 'Area Supervisor', 'supervisor');");

        // Seed Default Oracle Connection using OracleService
        var oracleCount = db.ExecuteScalar<int>("SELECT COUNT(1) FROM DATA_CONNECTION WHERE PROVIDER = 'oracle'");
        if (oracleCount == 0)
        {
            var oracleConnStr = new ExternalSources.OracleService().GetConnectionString();
            db.Execute(
                @"INSERT INTO DATA_CONNECTION (ID, NAME, PROVIDER, CONNECTION_STRING, IS_ACTIVE, CREATED_AT_UTC)
                  VALUES (@Id, @Name, @Provider, @ConnectionString, 1, @CreatedAt)",
                new
                {
                    Id = "default-oracle-conn",
                    Name = "Oracle ERP (Default)",
                    Provider = "oracle",
                    ConnectionString = oracleConnStr,
                    CreatedAt = DateTime.UtcNow.ToString("o")
                });
        }
    }
}

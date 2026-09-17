package org.traccar.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import liquibase.Contexts;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.LiquibaseException;
import liquibase.resource.DirectoryResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.postgresql.ds.PGSimpleDataSource;
import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.config.Config;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "TRACCAR_TEST_PG_URL",
        matches = "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/geofence_validation")
public class PostgresGeofenceValidationTest {

    private PGSimpleDataSource source(String label) throws Exception {
        var source = new PGSimpleDataSource();
        source.setURL(System.getenv("TRACCAR_TEST_PG_URL"));
        source.setUser("validation_owner");
        source.setConnectTimeout(5);
        source.setSocketTimeout(30);
        String schema = label + "_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            try (var result = statement.executeQuery(
                    "SELECT current_database(), current_setting('traccar.validation_cluster', true)")) {
                assertTrue(result.next());
                assertEquals("geofence_validation", result.getString(1));
                String marker = System.getenv("TRACCAR_TEST_PG_TOKEN");
                assertNotNull(marker, "An isolated cluster marker is required");
                assertFalse(marker.isBlank());
                assertEquals(marker, result.getString(2), "Refusing to modify an unmarked database");
            }
            if (label.equals("fresh")) {
                // Historical migrations inspect information_schema without a schema filter.
                // A fresh installation therefore needs its own database, not just a schema.
                statement.execute("CREATE DATABASE " + schema);
                source.setURL(System.getenv("TRACCAR_TEST_PG_URL").replace("/geofence_validation", "/" + schema));
                return source;
            }
            statement.execute("CREATE SCHEMA " + schema);
        }
        source.setCurrentSchema(schema);
        return source;
    }

    private void migrate(PGSimpleDataSource source, String file) throws Exception {
        try (var connection = source.getConnection();
                var resources = new DirectoryResourceAccessor(new File("."))) {
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            database.setDefaultSchemaName(source.getCurrentSchema());
            database.setLiquibaseSchemaName(source.getCurrentSchema());
            try (var liquibase = new Liquibase(file, resources, database)) {
                liquibase.update(new Contexts());
            }
        }
    }

    private long count(PGSimpleDataSource source, String table) throws Exception {
        try (var connection = source.getConnection(); var statement = connection.createStatement();
                var rows = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            rows.next();
            return rows.getLong(1);
        }
    }

    @Test
    public void sutranCrcMigrationPreservesHistoryAndAllowsExactLongValues() throws Exception {
        var source = source("sutran_crc");
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tc_forward_deliveries (id BIGINT PRIMARY KEY,"
                    + " status VARCHAR(16), responsecode INTEGER, crc VARCHAR(6))");
            statement.execute("INSERT INTO tc_forward_deliveries VALUES"
                    + " (1,'DELIVERED',2000,'ABC123'), (2,'REJECTED',2001,NULL),"
                    + " (3,'DELIVERED',2001,'S8J7e')");
        }
        migrate(source, "schema/changelog-sutran-crc.xml");
        migrate(source, "schema/changelog-sutran-crc.xml");
        assertEquals(1, count(source, "databasechangelog"));
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("SELECT id,status,responsecode,crc"
                    + " FROM tc_forward_deliveries ORDER BY id")) {
                assertTrue(rows.next());
                assertEquals("ABC123", rows.getString("crc"));
                assertTrue(rows.next());
                assertEquals("REJECTED", rows.getString("status"));
                assertEquals(2001, rows.getInt("responsecode"));
                assertNull(rows.getString("crc"));
                assertTrue(rows.next());
                assertEquals("S8J7e", rows.getString("crc"));
            }
            try (var insert = connection.prepareStatement(
                    "INSERT INTO tc_forward_deliveries VALUES (4,'DELIVERED',2001,?)")) {
                insert.setString(1, "SyntheticLongCrc");
                insert.executeUpdate();
            }
            try (var rows = statement.executeQuery("SELECT crc FROM tc_forward_deliveries WHERE id=4")) {
                assertTrue(rows.next());
                assertEquals("SyntheticLongCrc", rows.getString(1));
            }
            try (var rows = statement.executeQuery("SELECT data_type FROM information_schema.columns"
                    + " WHERE table_schema=current_schema() AND table_name='tc_forward_deliveries'"
                    + " AND column_name='crc'")) {
                assertTrue(rows.next());
                assertEquals("text", rows.getString(1));
            }
        }
    }

    @Test
    public void completeMasterMigrationIsRepeatableOnPostgres() throws Exception {
        var source = source("fresh");
        migrate(source, "schema/changelog-master.xml");
        long changes = count(source, "databasechangelog");
        assertTrue(changes > 100);
        migrate(source, "schema/changelog-master.xml");
        assertEquals(changes, count(source, "databasechangelog"));
        assertEquals(0, count(source, "tc_user_geofencefolder"));
        System.out.println("PostgreSQL master migration: " + changes + " changesets, repeatable");
    }

    private void legacyTables(Connection connection) throws Exception {
        try (var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tc_users (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE tc_geofence_folders (id BIGINT PRIMARY KEY, parentid BIGINT DEFAULT 0)");
            statement.execute("CREATE TABLE tc_user_geofencefolder (userid BIGINT, geofencefolderid BIGINT)");
            statement.execute("INSERT INTO tc_users VALUES (3000000000)");
            statement.execute("INSERT INTO tc_geofence_folders VALUES (4000000000,0)");
            statement.execute("INSERT INTO tc_user_geofencefolder VALUES (3000000000,4000000000)");
        }
    }

    @Test
    public void legacyBigintGrantsSurviveAndInvalidReferencesAreRejected() throws Exception {
        var source = source("legacy");
        try (var connection = source.getConnection()) {
            legacyTables(connection);
        }
        migrate(source, "schema/changelog-geofence-folder-permissions.xml");
        migrate(source, "schema/changelog-geofence-folder-permissions.xml");
        assertEquals(1, count(source, "tc_user_geofencefolder"));
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            assertThrows(SQLException.class, () ->
                    statement.execute("INSERT INTO tc_user_geofencefolder VALUES (99,4000000000)"));
            assertThrows(SQLException.class, () ->
                    statement.execute("INSERT INTO tc_user_geofencefolder VALUES (3000000000,4000000000)"));
            try (var rows = statement.executeQuery(
                    "SELECT userid, geofencefolderid, pg_typeof(userid)::text FROM tc_user_geofencefolder")) {
                assertTrue(rows.next());
                assertEquals(3000000000L, rows.getLong(1));
                assertEquals(4000000000L, rows.getLong(2));
                assertEquals("bigint", rows.getString(3));
            }
        }
    }

    @Test
    public void invalidLegacyDataHaltsWithoutDeletingGrants() throws Exception {
        var source = source("rejected");
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            legacyTables(connection);
            statement.execute("INSERT INTO tc_user_geofencefolder VALUES (3000000000,4000000000)");
        }
        assertThrows(LiquibaseException.class,
                () -> migrate(source, "schema/changelog-geofence-folder-permissions.xml"));
        assertEquals(2, count(source, "tc_user_geofencefolder"));
    }

    @Test
    public void permissionTransactionContractPassesOnPostgres() throws Exception {
        var source = source("atomic");
        try (var connection = source.getConnection()) {
            PermissionBatchContract.prepare(connection);
        }
        PermissionBatchContract.verify(new DatabaseStorage(new Config(), source, new ObjectMapper()));
    }

    @Test
    public void measureConcurrentPermissionReadsOnPostgres() throws Exception {
        var source = source("load");
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tc_users (id BIGINT PRIMARY KEY, administrator BOOLEAN DEFAULT FALSE)");
            statement.execute("CREATE TABLE tc_geofence_folders (id BIGINT PRIMARY KEY, name VARCHAR, parentid BIGINT)");
            statement.execute("CREATE TABLE tc_geofences (id BIGINT PRIMARY KEY, attributes VARCHAR)");
            statement.execute("CREATE TABLE tc_user_geofencefolder (userid BIGINT, geofencefolderid BIGINT)");
            statement.execute("CREATE TABLE tc_user_geofence (userid BIGINT, geofenceid BIGINT)");
            statement.execute("INSERT INTO tc_users (id) SELECT generate_series(1,20)");
            statement.execute("INSERT INTO tc_geofence_folders SELECT x, 'Folder', 0 FROM generate_series(1,100) x");
            statement.execute("INSERT INTO tc_user_geofencefolder SELECT x,x FROM generate_series(1,20) x");
            statement.execute("INSERT INTO tc_geofences SELECT x,"
                    + " '{\"folderId\":' || ((x-1)%100+1) || '}' FROM generate_series(1,10000) x");
        }
        var service = new GeofenceReadAccessService(new DatabaseStorage(new Config(), source, new ObjectMapper()));
        for (int user = 1; user <= 3; user++) {
            assertEquals(100, service.getReadableGeofenceIds(user).size());
        }
        var workers = Executors.newFixedThreadPool(4);
        try {
            List<Callable<Double>> requests = new ArrayList<>();
            for (long userId = 1; userId <= 20; userId++) {
                long user = userId;
                requests.add(() -> {
                    long start = System.nanoTime();
                    assertEquals(100, service.getReadableGeofenceIds(user).size());
                    return (System.nanoTime() - start) / 1_000_000.0;
                });
            }
            long start = System.nanoTime();
            var futures = workers.invokeAll(requests);
            var times = new ArrayList<Double>();
            for (var future : futures) {
                times.add(future.get());
            }
            double totalMs = (System.nanoTime() - start) / 1_000_000.0;
            Collections.sort(times);
            var report = Map.of("database", "isolated PostgreSQL", "users", 20, "geofences", 10000,
                    "workers", 4, "totalMs", totalMs, "p50Ms", times.get(9), "p95Ms", times.get(18),
                    "maxMs", times.get(19), "pool", "PGSimpleDataSource; new connection per query");
            Path file = Path.of("build", "reports", "geofence-postgres-load.json");
            Files.createDirectories(file.getParent());
            new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(file.toFile(), report);
        } finally {
            workers.shutdownNow();
        }
    }
}

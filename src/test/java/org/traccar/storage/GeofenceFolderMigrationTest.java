package org.traccar.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import liquibase.Contexts;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.exception.LiquibaseException;
import liquibase.resource.DirectoryResourceAccessor;
import org.junit.jupiter.api.Test;
import org.h2.jdbcx.JdbcDataSource;
import org.traccar.config.Config;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.User;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Exercises real constraints on disposable databases, never the configured Traccar database. */
public class GeofenceFolderMigrationTest {

    private Connection openDatabase() throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID(), "sa", "");
        execute(connection, "CREATE TABLE tc_users (id INT PRIMARY KEY)");
        execute(connection, "CREATE TABLE tc_geofence_folders (id BIGINT PRIMARY KEY, parentid BIGINT DEFAULT 0)");
        execute(connection, "CREATE TABLE tc_user_geofence (userid INT, geofenceid INT)");
        execute(connection, "INSERT INTO tc_users VALUES (1), (2)");
        execute(connection, "INSERT INTO tc_geofence_folders VALUES (10, 0), (11, 10)");
        execute(connection, "INSERT INTO tc_user_geofence VALUES (1, 100)");
        return connection;
    }

    private void migrate(Connection connection) throws Exception {
        try (var resources = new DirectoryResourceAccessor(new File("."))) {
            var database = DatabaseFactory.getInstance().openDatabase(
                    connection.getMetaData().getURL(), "sa", "", "org.h2.Driver",
                    null, null, null, resources);
            try (var liquibase = new Liquibase(
                    "schema/changelog-geofence-folder-permissions.xml", resources, database)) {
                liquibase.update(new Contexts());
            }
        }
    }

    private void execute(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private int count(Connection connection, String table) throws SQLException {
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            rows.next();
            return rows.getInt(1);
        }
    }

    @Test
    public void freshSchemaRejectsDuplicateNullAndOrphanGrants() throws Exception {
        try (var connection = openDatabase()) {
            migrate(connection);
            execute(connection, "INSERT INTO tc_user_geofencefolder VALUES (1, 10)");
            for (String values : new String[] {"(1, 10)", "(99, 10)", "(1, 99)", "(NULL, 10)", "(1, NULL)"}) {
                assertThrows(SQLException.class, () -> execute(
                        connection, "INSERT INTO tc_user_geofencefolder VALUES " + values));
            }
            assertEquals(1, count(connection, "tc_user_geofencefolder"));
            assertEquals(1, count(connection, "tc_user_geofence"));
        }
    }

    @Test
    public void legacyBigintSchemaPreservesExistingGrantsAndIsRepeatable() throws Exception {
        try (var connection = openDatabase()) {
            execute(connection, "CREATE TABLE tc_user_geofencefolder (userid BIGINT, geofencefolderid BIGINT)");
            execute(connection, "INSERT INTO tc_user_geofencefolder VALUES (1, 10), (2, 11)");
            migrate(connection);
            migrate(connection);
            assertEquals(2, count(connection, "tc_user_geofencefolder"));
            assertEquals(1, count(connection, "tc_user_geofence"));
            assertThrows(SQLException.class, () -> execute(
                    connection, "INSERT INTO tc_user_geofencefolder VALUES (1, 10)"));
        }
    }

    @Test
    public void existingNamedConstraintsArePreserved() throws Exception {
        try (var connection = openDatabase()) {
            execute(connection, "CREATE TABLE tc_user_geofencefolder (userid BIGINT NOT NULL, "
                    + "geofencefolderid BIGINT NOT NULL, CONSTRAINT pk_user_geofencefolder "
                    + "PRIMARY KEY (userid, geofencefolderid), CONSTRAINT fk_user_geofencefolder_user "
                    + "FOREIGN KEY (userid) REFERENCES tc_users(id) ON DELETE CASCADE, "
                    + "CONSTRAINT fk_user_geofencefolder_folder FOREIGN KEY (geofencefolderid) "
                    + "REFERENCES tc_geofence_folders(id) ON DELETE CASCADE)");
            execute(connection, "INSERT INTO tc_user_geofencefolder VALUES (1, 10)");
            migrate(connection);
            assertEquals(1, count(connection, "tc_user_geofencefolder"));
        }
    }

    @Test
    public void removingGrantDoesNotDeleteFoldersOrIndividualAssignments() throws Exception {
        try (var connection = openDatabase()) {
            migrate(connection);
            execute(connection, "INSERT INTO tc_user_geofencefolder VALUES (1, 10)");
            execute(connection, "DELETE FROM tc_user_geofencefolder WHERE userid = 1 AND geofencefolderid = 10");
            assertEquals(2, count(connection, "tc_geofence_folders"));
            assertEquals(1, count(connection, "tc_user_geofence"));
        }
    }

    @Test
    public void deletingFolderRemovesOnlyItsGrants() throws Exception {
        try (var connection = openDatabase()) {
            migrate(connection);
            execute(connection, "INSERT INTO tc_user_geofencefolder VALUES (1, 10), (2, 11)");
            execute(connection, "DELETE FROM tc_geofence_folders WHERE id = 11");
            assertEquals(1, count(connection, "tc_user_geofencefolder"));
            assertEquals(1, count(connection, "tc_user_geofence"));
        }
    }

    @Test
    public void storageKeepsIndividualPermissionsSeparateFromFolderGrants() throws Exception {
        try (var connection = openDatabase()) {
            execute(connection, "CREATE TABLE tc_geofences (id INT PRIMARY KEY)");
            execute(connection, "INSERT INTO tc_geofences VALUES (100), (101)");
            migrate(connection);
            execute(connection, "INSERT INTO tc_user_geofencefolder VALUES (2, 10)");
            var dataSource = new JdbcDataSource();
            dataSource.setURL(connection.getMetaData().getURL());
            dataSource.setUser("sa");
            dataSource.setPassword("");
            var storage = new DatabaseStorage(new Config(), dataSource, new ObjectMapper());

            // These are the actual SQL permission queries used by resource listing and access checks.
            assertEquals(1, storage.getObjects(Geofence.class, new Request(
                    new Columns.Include("id"), new Condition.Permission(User.class, 1, Geofence.class))).size());
            assertEquals(0, storage.getObjects(Geofence.class, new Request(
                    new Columns.Include("id"), new Condition.Permission(User.class, 2, Geofence.class))).size());
            assertEquals(1, storage.getObjects(GeofenceFolder.class, new Request(
                    new Columns.Include("id"), new Condition.Permission(User.class, 2, GeofenceFolder.class))).size());
            assertEquals(0, storage.getObjects(GeofenceFolder.class, new Request(
                    new Columns.Include("id"), new Condition.Permission(User.class, 1, GeofenceFolder.class))).size());
        }
    }

    @Test
    public void invalidExistingGrantsStopMigrationWithoutDeletingData() throws Exception {
        for (String values : new String[] {"(1, 10), (1, 10)", "(99, 10)", "(1, 99)", "(NULL, 10)"}) {
            try (var connection = openDatabase()) {
                execute(connection, "CREATE TABLE tc_user_geofencefolder (userid BIGINT, geofencefolderid BIGINT)");
                execute(connection, "INSERT INTO tc_user_geofencefolder VALUES " + values);
                int before = count(connection, "tc_user_geofencefolder");
                assertThrows(LiquibaseException.class, () -> migrate(connection));
                assertEquals(before, count(connection, "tc_user_geofencefolder"));
                assertEquals(1, count(connection, "tc_user_geofence"));
            }
        }
    }
}

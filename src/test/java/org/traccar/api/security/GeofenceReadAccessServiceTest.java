package org.traccar.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.traccar.config.Config;
import org.traccar.model.Geofence;
import org.traccar.storage.DatabaseStorage;
import org.traccar.storage.StorageException;

import java.sql.Connection;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Real SQL on disposable H2 databases; never loads the application's database configuration. */
public class GeofenceReadAccessServiceTest {

    private static class Fixture implements AutoCloseable {
        final Connection connection;
        final DatabaseStorage storage;
        final GeofenceReadAccessService service;

        Fixture() throws Exception {
            var source = new JdbcDataSource();
            source.setURL("jdbc:h2:mem:" + UUID.randomUUID());
            connection = source.getConnection();
            storage = new DatabaseStorage(new Config(), source, new ObjectMapper());
            service = new GeofenceReadAccessService(storage);
            sql("CREATE TABLE tc_users (id BIGINT PRIMARY KEY, administrator BOOLEAN DEFAULT FALSE,"
                    + " disabled BOOLEAN DEFAULT FALSE, expirationtime TIMESTAMP, readonly BOOLEAN DEFAULT FALSE)");
            sql("CREATE TABLE tc_geofence_folders (id BIGINT PRIMARY KEY, name VARCHAR, parentid BIGINT)");
            sql("CREATE TABLE tc_geofences (id BIGINT PRIMARY KEY, name VARCHAR, area VARCHAR, attributes VARCHAR)");
            sql("CREATE TABLE tc_user_geofencefolder (userid BIGINT, geofencefolderid BIGINT)");
            sql("CREATE TABLE tc_user_geofence (userid BIGINT, geofenceid BIGINT)");
            sql("INSERT INTO tc_users (id) VALUES (1), (2), (3), (4)");
            sql("UPDATE tc_users SET administrator = TRUE WHERE id = 4");
            sql("INSERT INTO tc_geofence_folders VALUES (10,'Parent',0),(11,'Child',10),"
                    + "(12,'Grandchild',11),(20,'Other',0)");
            sql("INSERT INTO tc_geofences VALUES (100,'A',NULL,'{\"folderId\":10}'),"
                    + "(101,'B',NULL,'{\"folderId\":11}'),(102,'C',NULL,'{\"folderId\":12}'),"
                    + "(200,'D',NULL,'{\"folderId\":20}'),(300,'Root',NULL,'{}')");
            sql("INSERT INTO tc_user_geofencefolder VALUES (1,10)");
            sql("INSERT INTO tc_user_geofence VALUES (2,101)");
        }

        void sql(String sql) throws Exception {
            try (var statement = connection.createStatement()) {
                statement.execute(sql);
            }
        }

        List<Long> ids(long user) throws Exception {
            return service.getReadAccess(user).geofences().stream().map(e -> e.geofence().getId()).toList();
        }

        @Override
        public void close() throws Exception {
            connection.close();
        }
    }

    @Test
    public void singleChecksAndSessionIdsMatchEffectiveAccessAfterRevocation() throws Exception {
        try (var f = new Fixture()) {
            assertEquals(java.util.Set.copyOf(f.ids(1)), f.service.getReadableGeofenceIds(1));
            assertTrue(f.service.canReadGeofence(1, 102));
            assertFalse(f.service.canReadGeofence(1, 200));
            assertTrue(f.service.canReadGeofence(2, 101));
            assertFalse(f.service.canReadGeofence(2, 102));
            f.sql("DELETE FROM tc_user_geofencefolder WHERE userid = 1");
            assertFalse(f.service.canReadGeofence(1, 102));
            assertEquals(java.util.Set.of(), f.service.getReadableGeofenceIds(1));
            assertFalse(f.service.canReadGeofence(4, 999));
        }
    }

    @Test
    public void inheritsDescendantsWithoutLeakingBetweenUsers() throws Exception {
        try (var f = new Fixture()) {
            assertEquals(List.of(100L, 101L, 102L), f.ids(1));
            assertEquals(List.of(101L), f.ids(2));
            assertEquals(List.of(), f.ids(3));
            assertEquals(List.of(100L, 101L, 102L), f.ids(1));
        }
    }

    @Test
    public void directChildGetsOnlyStructuralAncestors() throws Exception {
        try (var f = new Fixture()) {
            var result = f.service.getReadAccess(2);
            assertEquals(List.of(11L, 10L), result.folders().stream().map(e -> e.id()).toList());
            assertTrue(result.folders().stream().allMatch(e -> e.contextOnly()));
            var json = new ObjectMapper().valueToTree(result.folders().get(0));
            assertFalse(json.has("description"));
            assertFalse(json.has("attributes"));
        }
    }

    @Test
    public void removingFolderGrantPreservesIndividualAccess() throws Exception {
        try (var f = new Fixture()) {
            f.sql("INSERT INTO tc_user_geofence VALUES (1,101)");
            var entry = f.service.getReadAccess(1).geofences().get(1);
            assertTrue(entry.direct() && entry.inherited());
            f.sql("DELETE FROM tc_user_geofencefolder WHERE userid = 1");
            assertEquals(List.of(101L), f.ids(1));
            assertFalse(f.service.getReadAccess(1).geofences().get(0).inherited());
        }
    }

    @Test
    public void overlappingGrantsRetainChildAfterParentRevocation() throws Exception {
        try (var f = new Fixture()) {
            f.sql("INSERT INTO tc_user_geofencefolder VALUES (1,11)");
            f.sql("DELETE FROM tc_user_geofencefolder WHERE geofencefolderid = 10");
            assertEquals(List.of(101L, 102L), f.ids(1));
        }
    }

    @Test
    public void nextRequestReflectsNewAndMovedGeofences() throws Exception {
        try (var f = new Fixture()) {
            assertEquals(3, f.ids(1).size());
            f.sql("UPDATE tc_geofences SET attributes = '{\"folderId\":20}' WHERE id = 101");
            f.sql("INSERT INTO tc_geofences VALUES (103,'New',NULL,'{\"folderId\":12}')");
            assertEquals(List.of(100L, 102L, 103L), f.ids(1));
        }
    }

    @Test
    public void cyclesAndOrphansFailClosedWhileDirectAccessSurvives() throws Exception {
        try (var f = new Fixture()) {
            f.sql("UPDATE tc_geofence_folders SET parentid = 12 WHERE id = 10");
            assertEquals(List.of(), f.ids(1));
            assertEquals(List.of(101L), f.ids(2));
            assertEquals(0, f.service.getReadAccess(2).geofences().get(0).folderId());
            f.sql("UPDATE tc_geofence_folders SET parentid = 999 WHERE id = 10");
            assertEquals(List.of(), f.ids(1));
        }
    }

    @Test
    public void malformedFolderIdsNeverGrantAccess() throws Exception {
        try (var f = new Fixture()) {
            for (String value : List.of("10.5", "true", "\"invalid\"", "-10", "999", "null")) {
                f.sql("UPDATE tc_geofences SET attributes = '{\"folderId\":" + value + "}' WHERE id = 100");
                assertEquals(List.of(101L, 102L), f.ids(1));
            }
        }
    }

    @Test
    public void readonlyInheritanceDoesNotChangeLegacyAuthorization() throws Exception {
        try (var f = new Fixture()) {
            f.sql("UPDATE tc_users SET readonly = TRUE WHERE id = 1");
            assertEquals(3, f.ids(1).size());
            assertThrows(SecurityException.class,
                    () -> new PermissionsService(f.storage).checkPermission(Geofence.class, 1, 100));
        }
    }

    @Test
    public void disabledExpiredAndUnknownUsersAreRejected() throws Exception {
        try (var f = new Fixture()) {
            f.sql("UPDATE tc_users SET disabled = TRUE WHERE id = 1");
            assertThrows(SecurityException.class, () -> f.ids(1));
            f.sql("UPDATE tc_users SET disabled = FALSE, expirationtime = '2000-01-01 00:00:00' WHERE id = 1");
            assertThrows(SecurityException.class, () -> f.ids(1));
            assertThrows(SecurityException.class, () -> f.ids(999));
            assertThrows(SecurityException.class, () -> f.ids(0));
        }
    }

    @Test
    public void administratorSeesRootAndAllBranches() throws Exception {
        try (var f = new Fixture()) {
            assertTrue(f.service.getReadAccess(4).administrator());
            assertEquals(List.of(100L, 101L, 102L, 200L, 300L), f.ids(4));
        }
    }

    @Test
    public void databaseFailureDoesNotReturnPartialAccess() throws Exception {
        try (var f = new Fixture()) {
            f.sql("DROP TABLE tc_user_geofencefolder");
            assertThrows(StorageException.class, () -> f.ids(1));
        }
    }
}

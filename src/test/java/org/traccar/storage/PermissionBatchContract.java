package org.traccar.storage;

import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.Group;
import org.traccar.model.Permission;
import org.traccar.model.User;

import java.sql.Connection;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Identical transaction contract for disposable H2 and PostgreSQL. */
public final class PermissionBatchContract {

    private PermissionBatchContract() {
    }

    public static void prepare(Connection connection) throws Exception {
        try (var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tc_users (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE tc_geofences (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE tc_geofence_folders (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE tc_user_geofence (userid BIGINT REFERENCES tc_users(id),"
                    + " geofenceid BIGINT REFERENCES tc_geofences(id), PRIMARY KEY (userid,geofenceid))");
            statement.execute("CREATE TABLE tc_user_geofencefolder (userid BIGINT REFERENCES tc_users(id),"
                    + " geofencefolderid BIGINT REFERENCES tc_geofence_folders(id),"
                    + " PRIMARY KEY (userid,geofencefolderid))");
            statement.execute("INSERT INTO tc_users VALUES (1)");
            statement.execute("INSERT INTO tc_geofences VALUES (100),(200)");
            statement.execute("INSERT INTO tc_geofence_folders VALUES (10)");
            statement.execute("INSERT INTO tc_user_geofence VALUES (1,100)");
        }
    }

    public static void verify(Storage storage) throws Exception {
        var first = new Permission(User.class, 1, Geofence.class, 100);
        var second = new Permission(User.class, 1, Geofence.class, 200);
        var invalid = new Permission(User.class, 1, Geofence.class, 999);
        storage.updatePermissions(List.of(second), List.of(first));
        assertEquals(List.of(200L), geofenceIds(storage));

        // The removal and the first insert must both roll back when the later FK fails.
        assertThrows(StorageException.class, () ->
                storage.updatePermissions(List.of(first, invalid), List.of(second)));
        assertEquals(List.of(200L), geofenceIds(storage));

        // A duplicate must not leave the preceding insert committed.
        assertThrows(StorageException.class, () -> storage.updatePermissions(List.of(first, second), List.of()));
        assertEquals(List.of(200L), geofenceIds(storage));

        // Failure of a later removal must restore an earlier deletion.
        assertThrows(StorageException.class, () -> storage.updatePermissions(List.of(),
                List.of(second, new Permission(User.class, 1, Group.class, 10))));
        assertEquals(List.of(200L), geofenceIds(storage));

        storage.updatePermissions(
                List.of(first, new Permission(User.class, 1, GeofenceFolder.class, 10)), List.of(second));
        assertEquals(List.of(100L), geofenceIds(storage));
        assertEquals(1, storage.getPermissions(User.class, 1, GeofenceFolder.class, 10).size());
    }

    private static List<Long> geofenceIds(Storage storage) throws StorageException {
        return storage.getPermissions(User.class, 1, Geofence.class, 0).stream()
                .map(Permission::getPropertyId).sorted().toList();
    }
}

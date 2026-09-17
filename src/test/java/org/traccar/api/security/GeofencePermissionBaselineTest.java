package org.traccar.api.security;

import org.junit.jupiter.api.Test;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.Server;
import org.traccar.model.User;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Request;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Safety baseline before introducing read-only inherited access in a separate implementation stage. */
public class GeofencePermissionBaselineTest {

    private final Storage storage = mock(Storage.class);
    private final PermissionsService permissions = new PermissionsService(storage);

    private User regularUser() throws StorageException {
        User user = new User();
        user.setId(1);
        when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(user);
        when(storage.getObject(eq(Server.class), any(Request.class))).thenReturn(new Server());
        return user;
    }

    @Test
    public void folderAccessAloneDoesNotGrantGeofenceAccess() throws Exception {
        regularUser();
        when(storage.getObject(eq(GeofenceFolder.class), any(Request.class))).thenReturn(new GeofenceFolder());
        assertDoesNotThrow(() -> permissions.checkPermission(GeofenceFolder.class, 1, 10));
        assertThrows(SecurityException.class, () -> permissions.checkPermission(Geofence.class, 1, 100));
    }

    @Test
    public void individualAccessDoesNotGrantFolderAccess() throws Exception {
        regularUser();
        when(storage.getObject(eq(Geofence.class), any(Request.class))).thenReturn(new Geofence());
        assertDoesNotThrow(() -> permissions.checkPermission(Geofence.class, 1, 100));
        assertThrows(SecurityException.class, () -> permissions.checkPermission(GeofenceFolder.class, 1, 10));
    }

    @Test
    public void readonlyUserCanReadAssignedGeofenceButCannotEdit() throws Exception {
        regularUser().setReadonly(true);
        when(storage.getObject(eq(Geofence.class), any(Request.class))).thenReturn(new Geofence());
        assertDoesNotThrow(() -> permissions.checkPermission(Geofence.class, 1, 100));
        assertThrows(SecurityException.class, () -> permissions.checkEdit(1, Geofence.class, false, false));
        assertThrows(SecurityException.class, () -> permissions.checkEdit(1, GeofenceFolder.class, false, false));
    }

    @Test
    public void storageFailureDoesNotBecomePermissionGranted() throws Exception {
        regularUser();
        when(storage.getObject(eq(Geofence.class), any(Request.class)))
                .thenThrow(new StorageException("Database unavailable"));
        assertThrows(StorageException.class, () -> permissions.checkPermission(Geofence.class, 1, 100));
    }
}

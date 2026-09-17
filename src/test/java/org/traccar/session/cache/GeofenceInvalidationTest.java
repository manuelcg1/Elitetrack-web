package org.traccar.session.cache;

import org.junit.jupiter.api.Test;
import org.traccar.alert.AlertCache;
import org.traccar.alert.AlertGeofenceStateManager;
import org.traccar.broadcast.BroadcastService;
import org.traccar.config.Config;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.ObjectOperation;
import org.traccar.model.User;
import org.traccar.session.ConnectionManager;
import org.traccar.storage.Storage;

import static org.mockito.Mockito.*;

public class GeofenceInvalidationTest {

    @Test
    public void localFolderGrantInvalidatesSessionsEvenWithoutBroadcastLoopback() throws Exception {
        var broadcast = mock(BroadcastService.class);
        var sessions = mock(ConnectionManager.class);
        var alerts = mock(AlertCache.class);
        var cache = new CacheManager(new Config(), mock(Storage.class), broadcast,
                mock(AlertGeofenceStateManager.class), () -> sessions, alerts);
        cache.invalidatePermission(true, User.class, 1, GeofenceFolder.class, 10, false);
        verify(sessions).invalidatePermission(false, User.class, 1, GeofenceFolder.class, 10, false);
        verify(broadcast).invalidatePermission(true, User.class, 1, GeofenceFolder.class, 10, false);
        verifyNoInteractions(alerts); // Viewing permission must not change vehicle alert scope.
    }

    @Test
    public void folderAndGeofenceChangesInvalidateAlertScopeOnLocalAndRemoteNodes() throws Exception {
        var broadcast = mock(BroadcastService.class);
        var sessions = mock(ConnectionManager.class);
        var alerts = mock(AlertCache.class);
        var states = mock(AlertGeofenceStateManager.class);
        var cache = new CacheManager(new Config(), mock(Storage.class), broadcast, states, () -> sessions, alerts);
        cache.invalidateObject(true, GeofenceFolder.class, 10, ObjectOperation.UPDATE);
        verify(sessions).invalidateObject(false, GeofenceFolder.class, 10, ObjectOperation.UPDATE);
        verify(broadcast).invalidateObject(true, GeofenceFolder.class, 10, ObjectOperation.UPDATE);
        cache.invalidateObject(false, Geofence.class, 100, ObjectOperation.DELETE);
        verify(alerts).invalidateGeofenceFolders();
        verify(alerts).invalidate();
        verify(states).removeByGeofenceId(100);
        verify(sessions, never()).invalidateObject(false, Geofence.class, 100, ObjectOperation.DELETE);
    }
}

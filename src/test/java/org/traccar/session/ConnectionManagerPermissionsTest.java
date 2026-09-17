package org.traccar.session;

import io.netty.util.Timer;
import org.junit.jupiter.api.Test;
import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.broadcast.BroadcastService;
import org.traccar.config.Config;
import org.traccar.database.DeviceLookupService;
import org.traccar.database.NotificationManager;
import org.traccar.model.AlertEvent;
import org.traccar.model.Device;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.ObjectOperation;
import org.traccar.model.Position;
import org.traccar.model.User;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Request;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class ConnectionManagerPermissionsTest {

    private static class Fixture {
        final Storage storage = mock(Storage.class);
        final GeofenceReadAccessService access = mock(GeofenceReadAccessService.class);
        final ConnectionManager manager;
        final ConnectionManager.UpdateListener first = mock(ConnectionManager.UpdateListener.class);
        final ConnectionManager.UpdateListener second = mock(ConnectionManager.UpdateListener.class);
        final User user = new User();
        final Device device = new Device();

        Fixture() throws Exception {
            user.setId(1);
            device.setId(10);
            when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(user);
            when(storage.getObjects(eq(Device.class), any(Request.class))).thenReturn(List.of(device));
            when(access.getReadableGeofenceIds(anyLong())).thenReturn(Set.of(100L, 101L));
            manager = new ConnectionManager(new Config(), mock(CacheManager.class), storage,
                    mock(NotificationManager.class), mock(Timer.class), mock(BroadcastService.class),
                    mock(DeviceLookupService.class), access);
        }

        AlertEvent event(long geofenceId) {
            var event = new AlertEvent();
            event.setDeviceId(10);
            event.setGeofenceId(geofenceId);
            return event;
        }
    }

    @Test
    public void slowReloadDoesNotBlockOtherSubscribers() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        f.manager.addListener(2, f.second);
        var loading = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        doAnswer(invocation -> {
            loading.countDown();
            if (!release.await(5, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new StorageException("Test reload timed out");
            }
            return Set.of(100L);
        }).when(f.access).getReadableGeofenceIds(1);
        var workers = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var reload = workers.submit(() ->
                    f.manager.invalidatePermission(false, User.class, 1, GeofenceFolder.class, 10, false));
            org.junit.jupiter.api.Assertions.assertTrue(loading.await(5, java.util.concurrent.TimeUnit.SECONDS));
            var position = new Position();
            position.setDeviceId(10);
            long start = System.nanoTime();
            var dispatch = workers.submit(() -> f.manager.updatePosition(false, position));
            dispatch.get(1, java.util.concurrent.TimeUnit.SECONDS);
            System.out.println("Unrelated dispatch during blocked SQL: "
                    + java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start) + " ms");
            verify(f.second).onUpdatePosition(position);
            verify(f.first, never()).onUpdatePosition(position);
            release.countDown();
            reload.get(5, java.util.concurrent.TimeUnit.SECONDS);
        } finally {
            release.countDown();
            workers.shutdownNow();
        }
    }

    @Test
    public void outdatedReloadCannotRestoreRevokedPermissions() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        var loading = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        doAnswer(invocation -> {
            loading.countDown();
            if (!release.await(5, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new StorageException("Test reload timed out");
            }
            return Set.of(100L);
        }).when(f.access).getReadableGeofenceIds(1);
        var worker = java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            var oldReload = worker.submit(() ->
                    f.manager.invalidatePermission(false, User.class, 1, GeofenceFolder.class, 10, true));
            org.junit.jupiter.api.Assertions.assertTrue(loading.await(5, java.util.concurrent.TimeUnit.SECONDS));
            doReturn(Set.of()).when(f.access).getReadableGeofenceIds(1);
            f.manager.invalidatePermission(false, User.class, 1, GeofenceFolder.class, 10, false);
            release.countDown();
            oldReload.get(5, java.util.concurrent.TimeUnit.SECONDS);
            f.manager.updateAlertEvent(false, f.event(100));
            verifyNoInteractions(f.first);
        } finally {
            release.countDown();
            worker.shutdownNow();
        }
    }

    @Test
    public void oldReloadCannotPublishIntoReconnectedSession() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        var loading = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        doAnswer(invocation -> {
            loading.countDown();
            if (!release.await(5, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new StorageException("Test reload timed out");
            }
            return Set.of(100L);
        }).when(f.access).getReadableGeofenceIds(1);
        var worker = java.util.concurrent.Executors.newSingleThreadExecutor();
        try {
            var oldReload = worker.submit(() ->
                    f.manager.invalidatePermission(false, User.class, 1, GeofenceFolder.class, 10, true));
            org.junit.jupiter.api.Assertions.assertTrue(loading.await(5, java.util.concurrent.TimeUnit.SECONDS));
            f.manager.removeListener(1, f.first);
            doReturn(Set.of()).when(f.access).getReadableGeofenceIds(1);
            f.manager.addListener(1, f.second);
            release.countDown();
            oldReload.get(5, java.util.concurrent.TimeUnit.SECONDS);
            f.manager.updateAlertEvent(false, f.event(100));
            verifyNoInteractions(f.first, f.second);
        } finally {
            release.countDown();
            worker.shutdownNow();
        }
    }

    @Test
    public void batchRefreshesEachAffectedUserOnlyOnce() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        f.manager.addListener(2, f.second);
        var changes = new java.util.ArrayList<org.traccar.model.Permission>();
        for (long id = 1; id <= 100; id++) {
            changes.add(new org.traccar.model.Permission(User.class, 1, Geofence.class, id));
        }
        f.manager.invalidatePermissions(changes);
        verify(f.access, times(2)).getReadableGeofenceIds(1); // Registration and one batch refresh.
        verify(f.access).getReadableGeofenceIds(2);
    }

    @Test
    public void inheritedGeofencesAreDeliveredAndOtherGeofencesAreHidden() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        var allowed = f.event(100);
        var denied = f.event(200);
        f.manager.updateAlertEvent(false, allowed);
        f.manager.updateAlertEvent(false, denied);
        verify(f.first).onUpdateAlertEvent(allowed);
        verify(f.first, never()).onUpdateAlertEvent(denied);
        verify(f.access).getReadableGeofenceIds(1);
    }

    @Test
    public void addingAnotherUserDoesNotReplaceExistingDeviceSubscribers() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        f.manager.addListener(2, f.second);
        f.manager.invalidatePermission(true, User.class, 2, Device.class, 10, true);
        var event = f.event(100);
        f.manager.updateAlertEvent(false, event);
        verify(f.first).onUpdateAlertEvent(event);
        verify(f.second).onUpdateAlertEvent(event);
    }

    @Test
    public void revokingDeviceStopsPositionsAndAlertsOnlyForAffectedUser() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        f.manager.addListener(2, f.second);
        when(f.storage.getObjects(eq(Device.class), any(Request.class))).thenReturn(List.of());
        f.manager.invalidatePermission(false, User.class, 1, Device.class, 10, false);
        var position = new Position();
        position.setDeviceId(10);
        var event = f.event(100);
        f.manager.updatePosition(false, position);
        f.manager.updateAlertEvent(false, event);
        verifyNoInteractions(f.first);
        verify(f.second).onUpdatePosition(position);
        verify(f.second).onUpdateAlertEvent(event);
    }

    @Test
    public void folderRevocationPreservesRemainingIndividualGeofence() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        when(f.access.getReadableGeofenceIds(1)).thenReturn(Set.of(101L));
        f.manager.invalidatePermission(false, User.class, 1, GeofenceFolder.class, 20, false);
        var denied = f.event(100);
        var direct = f.event(101);
        f.manager.updateAlertEvent(false, denied);
        f.manager.updateAlertEvent(false, direct);
        verify(f.first, never()).onUpdateAlertEvent(denied);
        verify(f.first).onUpdateAlertEvent(direct);
    }

    @Test
    public void movingFolderRefreshesEveryConnectedUsersAccess() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        f.manager.addListener(2, f.second);
        when(f.access.getReadableGeofenceIds(1)).thenReturn(Set.of());
        when(f.access.getReadableGeofenceIds(2)).thenReturn(Set.of(100L));
        f.manager.invalidateObject(false, GeofenceFolder.class, 20, ObjectOperation.UPDATE);
        var event = f.event(100);
        f.manager.updateAlertEvent(false, event);
        verifyNoInteractions(f.first);
        verify(f.second).onUpdateAlertEvent(event);
    }

    @Test
    public void reloadFailureClearsOldPermissionsAndCanRecover() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        when(f.access.getReadableGeofenceIds(1)).thenThrow(new StorageException("Unavailable"));
        f.manager.invalidatePermission(false, User.class, 1, Geofence.class, 100, false);
        var event = f.event(100);
        f.manager.updateAlertEvent(false, event);
        verifyNoInteractions(f.first);
        doReturn(Set.of(100L)).when(f.access).getReadableGeofenceIds(1);
        f.manager.invalidatePermission(false, User.class, 1, Geofence.class, 100, true);
        f.manager.updateAlertEvent(false, event);
        verify(f.first).onUpdateAlertEvent(event);
    }

    @Test
    public void failedRegistrationDoesNotLeavePhantomListenerOrDeviceAccess() throws Exception {
        var f = new Fixture();
        when(f.access.getReadableGeofenceIds(1)).thenThrow(new StorageException("Unavailable"));
        assertThrows(StorageException.class, () -> f.manager.addListener(1, f.first));
        assertDoesNotThrow(() -> f.manager.removeListener(1, f.first));
        doReturn(Set.of(100L)).when(f.access).getReadableGeofenceIds(1);
        f.manager.addListener(1, f.first);
        var event = f.event(100);
        f.manager.updateAlertEvent(false, event);
        verify(f.first).onUpdateAlertEvent(event);
    }

    @Test
    public void disablingUserStopsLiveDelivery() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        f.user.setDisabled(true);
        f.manager.invalidateObject(false, User.class, 1, ObjectOperation.UPDATE);
        f.manager.updateAlertEvent(false, f.event(100));
        verifyNoInteractions(f.first);
    }

    @Test
    public void closingOneTabKeepsOtherTabAndRepeatedCloseIsSafe() throws Exception {
        var f = new Fixture();
        f.manager.addListener(1, f.first);
        f.manager.addListener(1, f.second);
        f.manager.removeListener(1, f.first);
        var event = f.event(100);
        f.manager.updateAlertEvent(false, event);
        verifyNoInteractions(f.first);
        verify(f.second).onUpdateAlertEvent(event);
        f.manager.removeListener(1, f.second);
        assertDoesNotThrow(() -> f.manager.removeListener(1, f.second));
    }
}

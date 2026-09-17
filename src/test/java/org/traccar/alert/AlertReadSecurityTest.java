package org.traccar.alert;

import org.junit.jupiter.api.Test;
import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.model.AlertEvent;
import org.traccar.model.Device;
import org.traccar.model.User;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Request;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class AlertReadSecurityTest {

    @Test
    public void vehiclePermissionAloneDoesNotExposeGeofenceEvent() throws Exception {
        var storage = mock(Storage.class);
        var geofences = mock(GeofenceReadAccessService.class);
        when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(new User());
        when(storage.getObject(eq(Device.class), any(Request.class))).thenReturn(new Device());
        var security = new AlertSecurity(storage, geofences);
        var event = new AlertEvent();
        event.setDeviceId(10);
        event.setGeofenceId(100);
        assertFalse(security.canReadEvent(1, event));
        when(geofences.canReadGeofence(1, 100)).thenReturn(true);
        assertTrue(security.canReadEvent(1, event));
        when(storage.getObject(eq(Device.class), any(Request.class))).thenReturn(null);
        assertFalse(security.canReadEvent(1, event));
    }

    @Test
    public void inheritedReadDoesNotGrantManagementOfGeofenceOnlyEvent() throws Exception {
        var storage = mock(Storage.class);
        var geofences = mock(GeofenceReadAccessService.class);
        when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(new User());
        when(geofences.canReadGeofence(1, 100)).thenReturn(true);
        var security = new AlertSecurity(storage, geofences);
        var event = new AlertEvent();
        event.setGeofenceId(100);
        assertTrue(security.canReadEvent(1, event));
        assertFalse(security.canAccessEvent(1, event));
    }

    @Test
    public void disabledAndExpiredAdministratorsCannotReadEvents() throws Exception {
        var storage = mock(Storage.class);
        var user = new User();
        user.setAdministrator(true);
        user.setDisabled(true);
        when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(user);
        var security = new AlertSecurity(storage, mock(GeofenceReadAccessService.class));
        assertFalse(security.canReadEvent(1, new AlertEvent()));
        user.setDisabled(false);
        user.setExpirationTime(new Date(0));
        assertFalse(security.canReadEvent(1, new AlertEvent()));
    }

    @Test
    public void storageFailureDoesNotBypassGeofenceCheck() throws Exception {
        var storage = mock(Storage.class);
        var geofences = mock(GeofenceReadAccessService.class);
        when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(new User());
        when(geofences.canReadGeofence(1, 100)).thenThrow(new StorageException("Unavailable"));
        var event = new AlertEvent();
        event.setDeviceId(10);
        event.setGeofenceId(100);
        assertThrows(StorageException.class, () -> new AlertSecurity(storage, geofences).canReadEvent(1, event));
    }
}

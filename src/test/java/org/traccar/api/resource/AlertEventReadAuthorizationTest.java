package org.traccar.api.resource;

import org.junit.jupiter.api.Test;
import org.traccar.alert.AlertSecurity;
import org.traccar.api.security.PermissionsService;
import org.traccar.model.AlertEvent;
import org.traccar.storage.Storage;
import org.traccar.storage.query.Request;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class AlertEventReadAuthorizationTest {

    private static class Resource extends AlertEventResource {
        Resource(Storage database, PermissionsService permissions, AlertSecurity alerts) throws Exception {
            storage = database;
            permissionsService = permissions;
            var field = AlertEventResource.class.getDeclaredField("alertSecurity");
            field.setAccessible(true);
            field.set(this, alerts);
        }

        @Override
        protected long getUserId() {
            return 1;
        }
    }

    @Test
    public void inheritedReaderCanReadButCannotUseReadPermissionToChangeStatus() throws Exception {
        var storage = mock(Storage.class);
        var security = mock(AlertSecurity.class);
        var event = new AlertEvent();
        event.setId(100);
        when(storage.getObject(eq(AlertEvent.class), any(Request.class))).thenReturn(event);
        when(security.canReadEvent(1, event)).thenReturn(true);
        var resource = new Resource(storage, mock(PermissionsService.class), security);
        assertSame(event, resource.get(100));
        assertThrows(SecurityException.class, () -> resource.resolve(100));
        verify(storage, never()).updateObject(any(), any(Request.class));
    }

    @Test
    public void readonlyRestrictionPreventsStatusChanges() throws Exception {
        var storage = mock(Storage.class);
        var permissions = mock(PermissionsService.class);
        doThrow(new SecurityException("Readonly")).when(permissions).checkRestriction(eq(1L), any());
        var resource = new Resource(storage, permissions, mock(AlertSecurity.class));
        assertThrows(SecurityException.class, () -> resource.acknowledge(100));
        verifyNoInteractions(storage);
    }
}

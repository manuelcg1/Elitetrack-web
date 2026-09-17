package org.traccar.api.resource;

import jakarta.ws.rs.NotFoundException;
import org.junit.jupiter.api.Test;
import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.model.Geofence;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class GeofenceReadAccessResourceTest {

    private GeofenceResource resource() throws Exception {
        var resource = new GeofenceResource() {
            @Override
            protected long getUserId() {
                return 7;
            }
        };
        resource.readAccessService = mock(GeofenceReadAccessService.class);
        var geofence = new Geofence();
        geofence.setId(100);
        when(resource.readAccessService.getReadAccess(7)).thenReturn(
                new GeofenceReadAccessService.ReadAccess(false, List.of(),
                        List.of(new GeofenceReadAccessService.GeofenceEntry(geofence, 10, false, true))));
        return resource;
    }

    @Test
    public void listUsesAuthenticatedIdentityAndDisablesCaching() throws Exception {
        var resource = resource();
        try (var response = resource.getReadAccess()) {
            assertEquals("no-store", response.getHeaderString("Cache-Control"));
            assertEquals(200, response.getStatus());
            verify(resource.readAccessService).getReadAccess(7);
        }
    }

    @Test
    public void authorizedDetailIsReturnedWithoutCaching() throws Exception {
        var resource = resource();
        try (var response = resource.getReadableGeofence(100)) {
            assertEquals(100, ((Geofence) response.getEntity()).getId());
            assertEquals("no-store", response.getHeaderString("Cache-Control"));
        }
    }

    @Test
    public void inaccessibleDetailIsNotFound() throws Exception {
        var resource = resource();
        assertThrows(NotFoundException.class, () -> resource.getReadableGeofence(200));
    }
}

package org.traccar.alert;

import org.junit.jupiter.api.Test;
import org.traccar.model.Alert;
import org.traccar.model.AlertGeofence;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.storage.Storage;
import org.traccar.storage.query.Request;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

public class AlertCacheInvalidationTest {

    @Test
    public void movingGeofenceTakesEffectAfterInvalidationWithoutWaitingForTtl() throws Exception {
        var storage = mock(Storage.class);
        var alert = new Alert();
        alert.setId(1);
        var relation = new AlertGeofence();
        relation.setAlertId(1);
        relation.setGroupId(10L);
        var folder = new GeofenceFolder();
        folder.setId(10);
        var geofence = new Geofence();
        geofence.setId(100);
        geofence.set("folderId", 10L);
        when(storage.getObjects(eq(Alert.class), any(Request.class))).thenReturn(List.of(alert));
        when(storage.getObjects(eq(AlertGeofence.class), any(Request.class))).thenReturn(List.of(relation));
        when(storage.getObjects(eq(GeofenceFolder.class), any(Request.class))).thenReturn(List.of(folder));
        when(storage.getObjects(eq(Geofence.class), any(Request.class))).thenReturn(List.of(geofence));
        var cache = new AlertCache(storage, mock(AlertGeofenceStateManager.class));
        assertEquals(List.of(100L), cache.getAlerts().get(0).geofenceIds());
        geofence.set("folderId", 20L);
        cache.invalidate();
        assertEquals(List.of(), cache.getAlerts().get(0).geofenceIds());
        verify(storage, times(2)).getObjects(eq(Alert.class), any(Request.class));
    }

    @Test
    public void invalidHierarchyDoesNotExpandScopeButExplicitGeofenceRemains() throws Exception {
        var storage = mock(Storage.class);
        var alert = new Alert();
        alert.setId(1);
        var relation = new AlertGeofence();
        relation.setAlertId(1);
        relation.setGroupId(10L);
        var explicit = new AlertGeofence();
        explicit.setAlertId(1);
        explicit.setGeofenceId(200L);
        var folder = new GeofenceFolder();
        folder.setId(10);
        folder.setParentid(10);
        var geofence = new Geofence();
        geofence.setId(100);
        geofence.set("folderId", 10L);
        var direct = new Geofence();
        direct.setId(200);
        when(storage.getObjects(eq(Alert.class), any(Request.class))).thenReturn(List.of(alert));
        when(storage.getObjects(eq(AlertGeofence.class), any(Request.class))).thenReturn(List.of(relation, explicit));
        when(storage.getObjects(eq(GeofenceFolder.class), any(Request.class))).thenReturn(List.of(folder));
        when(storage.getObjects(eq(Geofence.class), any(Request.class))).thenReturn(List.of(geofence, direct));
        var states = mock(AlertGeofenceStateManager.class);
        var cache = new AlertCache(storage, states);
        assertEquals(List.of(200L), cache.getAlerts().get(0).geofenceIds());
        cache.invalidate();
        cache.invalidateGeofenceFolders();
        verify(states).removeByAlertId(1);
    }
}

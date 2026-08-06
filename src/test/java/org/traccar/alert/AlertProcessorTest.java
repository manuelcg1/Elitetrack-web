package org.traccar.alert;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.traccar.model.Alert;
import org.traccar.model.AlertEvent;
import org.traccar.model.Device;
import org.traccar.model.Event;
import org.traccar.model.Geofence;
import org.traccar.model.Position;
import org.traccar.session.ConnectionManager;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class AlertProcessorTest {

    @Test
    public void testSameGeofencePositionIsIdempotentWhenCooldownDisabled() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        AlertSecurity alertSecurity = mock(AlertSecurity.class);
        AlertCache alertCache = mock(AlertCache.class);
        ConnectionManager connectionManager = mock(ConnectionManager.class);
        AlertNotificationService alertNotificationService = mock(AlertNotificationService.class);

        Alert alert = new Alert();
        alert.setId(1);
        alert.setName("Ingreso");
        alert.setType(Alert.TYPE_GEOFENCE_ENTER);
        alert.setLimitValue(999);
        alert.setOperator("greaterThan");
        alert.setUnit("km/h");
        alert.set("cooldownMinutes", 0);
        Geofence geofence = mock(Geofence.class);
        when(geofence.getId()).thenReturn(10L);
        AlertCache.CachedAlert cachedAlert = new AlertCache.CachedAlert(
                alert, List.of(1L), List.of(), List.of(10L), List.of(), List.of(geofence));
        when(alertCache.getAlerts()).thenReturn(List.of(cachedAlert));
        when(alertSecurity.alertAppliesToDevice(alert, 1, 0, List.of(1L), List.of())).thenReturn(true);
        when(storage.addObject(any(AlertEvent.class), any(Request.class))).thenReturn(100L, 101L);

        Device device = new Device();
        device.setId(1);
        when(cacheManager.getObject(Device.class, 1)).thenReturn(device);

        Position previousPosition = new Position();
        previousPosition.setDeviceId(1);
        previousPosition.setFixTime(new Date(System.currentTimeMillis() - 1000));
        previousPosition.setGeofenceIds(List.of());
        Position position = new Position();
        position.setId(50);
        position.setDeviceId(1);
        position.setFixTime(new Date());
        position.setSpeed(0);
        position.setGeofenceIds(List.of(10L));
        when(cacheManager.getPosition(1)).thenReturn(previousPosition);
        when(geofence.containsPosition(previousPosition)).thenReturn(false);
        when(geofence.containsPosition(position)).thenReturn(true);
        Event entry = new Event(Event.TYPE_GEOFENCE_ENTER, position);
        entry.setGeofenceId(10);

        AlertProcessor processor = new AlertProcessor(
                storage, cacheManager, alertSecurity, alertCache, connectionManager, alertNotificationService);
        processor.onPosition(position, filtered -> { });
        processor.onPosition(position, filtered -> { });
        processor.processEvent(entry, position);

        ArgumentCaptor<AlertEvent> captor = ArgumentCaptor.forClass(AlertEvent.class);
        verify(storage).addObject(captor.capture(), any(Request.class));
        verify(alertNotificationService).sendAsync(eq(alert), any(AlertEvent.class));
        assertEquals(List.of(10L), captor.getAllValues().stream()
                .map(AlertEvent::getGeofenceId).toList());
    }

    @Test
    public void testGeofenceExitCreatesEventWithoutSpeedOrDeviceGeofenceRelation() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        AlertSecurity alertSecurity = mock(AlertSecurity.class);
        AlertCache alertCache = mock(AlertCache.class);
        ConnectionManager connectionManager = mock(ConnectionManager.class);
        AlertNotificationService alertNotificationService = mock(AlertNotificationService.class);

        Alert alert = new Alert();
        alert.setId(2);
        alert.setName("Salida");
        alert.setType(Alert.TYPE_GEOFENCE_EXIT);
        alert.setLimitValue(999);
        alert.setOperator("greaterThan");
        alert.setUnit("km/h");
        Geofence geofence = mock(Geofence.class);
        when(geofence.getId()).thenReturn(10L);
        AlertCache.CachedAlert cachedAlert = new AlertCache.CachedAlert(
                alert, List.of(1L), List.of(), List.of(10L), List.of(), List.of(geofence));
        when(alertCache.getAlerts()).thenReturn(List.of(cachedAlert));
        when(alertSecurity.alertAppliesToDevice(alert, 1, 0, List.of(1L), List.of())).thenReturn(true);
        when(storage.addObject(any(AlertEvent.class), any(Request.class))).thenReturn(200L);

        Device device = new Device();
        device.setId(1);
        when(cacheManager.getObject(Device.class, 1)).thenReturn(device);

        Position previousPosition = new Position();
        previousPosition.setDeviceId(1);
        previousPosition.setFixTime(new Date(System.currentTimeMillis() - 1000));
        previousPosition.setGeofenceIds(List.of(10L));
        Position position = new Position();
        position.setId(51);
        position.setDeviceId(1);
        position.setFixTime(new Date());
        position.setSpeed(0);
        position.setGeofenceIds(List.of());
        when(cacheManager.getPosition(1)).thenReturn(previousPosition);
        when(geofence.containsPosition(previousPosition)).thenReturn(true);
        when(geofence.containsPosition(position)).thenReturn(false);

        AlertProcessor processor = new AlertProcessor(
                storage, cacheManager, alertSecurity, alertCache, connectionManager, alertNotificationService);
        processor.onPosition(position, filtered -> { });

        Event standardExit = new Event(Event.TYPE_GEOFENCE_EXIT, position);
        standardExit.setGeofenceId(10);
        processor.processEvent(standardExit, position);

        ArgumentCaptor<AlertEvent> captor = ArgumentCaptor.forClass(AlertEvent.class);
        verify(storage).addObject(captor.capture(), any(Request.class));
        verify(alertNotificationService).sendAsync(eq(alert), any(AlertEvent.class));
        ArgumentCaptor<Request> requestCaptor = ArgumentCaptor.forClass(Request.class);
        verify(storage, times(2)).getObjects(eq(AlertEvent.class), requestCaptor.capture());
        assertTrue(conditionContains(requestCaptor.getValue().getCondition(), "geofenceId", 10L));
        assertTrue(conditionContains(
                requestCaptor.getValue().getCondition(), "type", Alert.TYPE_GEOFENCE_EXIT));
        assertEquals(Alert.TYPE_GEOFENCE_EXIT, captor.getValue().getType());
        assertEquals(10, captor.getValue().getGeofenceId());
        assertEquals(0, captor.getValue().getValue());
        assertEquals(0, captor.getValue().getThreshold());
    }

    @Test
    public void testPowerCutAlarmCreatesAlertEventWithoutSpeedCondition() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        AlertSecurity alertSecurity = mock(AlertSecurity.class);
        AlertCache alertCache = mock(AlertCache.class);
        ConnectionManager connectionManager = mock(ConnectionManager.class);
        AlertNotificationService alertNotificationService = mock(AlertNotificationService.class);

        Alert alert = new Alert();
        alert.setId(3);
        alert.setName("Energía desconectada");
        alert.setType(Alert.TYPE_POWER_CUT);
        alert.setLimitValue(999);
        alert.setOperator("greaterThan");
        alert.setUnit("km/h");
        AlertCache.CachedAlert cachedAlert = new AlertCache.CachedAlert(
                alert, List.of(1L), List.of(), List.of(), List.of(), List.of());
        when(alertCache.getAlerts()).thenReturn(List.of(cachedAlert));
        when(alertSecurity.alertAppliesToDevice(alert, 1, 0, List.of(1L), List.of())).thenReturn(true);
        when(storage.getObjects(eq(AlertEvent.class), any(Request.class))).thenReturn(List.of());
        when(storage.addObject(any(AlertEvent.class), any(Request.class))).thenReturn(300L);

        Device device = new Device();
        device.setId(1);
        when(cacheManager.getObject(Device.class, 1)).thenReturn(device);

        Position position = new Position();
        position.setId(52);
        position.setDeviceId(1);
        position.setFixTime(new Date());
        position.setSpeed(0);
        Event source = new Event(Event.TYPE_ALARM, position);
        source.set(Position.KEY_ALARM, Position.ALARM_POWER_CUT);

        AlertProcessor processor = new AlertProcessor(
                storage, cacheManager, alertSecurity, alertCache, connectionManager, alertNotificationService);
        boolean alertGenerated = processor.processEvent(source, position);
        boolean duplicateGenerated = processor.processEvent(source, position);

        ArgumentCaptor<AlertEvent> captor = ArgumentCaptor.forClass(AlertEvent.class);
        verify(storage).addObject(captor.capture(), any(Request.class));
        verify(alertNotificationService).sendAsync(eq(alert), any(AlertEvent.class));
        assertEquals(Alert.TYPE_POWER_CUT, captor.getValue().getType());
        assertEquals("Energía desconectada", captor.getValue().getMessage());
        assertEquals(0, captor.getValue().getValue());
        assertEquals(0, captor.getValue().getThreshold());
        assertTrue(alertGenerated);
        assertTrue(duplicateGenerated);
    }

    @Test
    public void testUserWithoutDevicePermissionDoesNotCreateOrNotify() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        AlertSecurity alertSecurity = mock(AlertSecurity.class);
        AlertCache alertCache = mock(AlertCache.class);
        ConnectionManager connectionManager = mock(ConnectionManager.class);
        AlertNotificationService alertNotificationService = mock(AlertNotificationService.class);

        Alert alert = new Alert();
        alert.setId(4);
        alert.setType(Alert.TYPE_POWER_CUT);
        AlertCache.CachedAlert cachedAlert = new AlertCache.CachedAlert(
                alert, List.of(1L), List.of(), List.of(), List.of(), List.of());
        when(alertCache.getAlerts()).thenReturn(List.of(cachedAlert));
        when(alertSecurity.alertAppliesToDevice(alert, 1, 0, List.of(1L), List.of())).thenReturn(false);

        Device device = new Device();
        device.setId(1);
        when(cacheManager.getObject(Device.class, 1)).thenReturn(device);
        Position position = new Position();
        position.setDeviceId(1);
        Event source = new Event(Event.TYPE_ALARM, position);
        source.set(Position.KEY_ALARM, Position.ALARM_POWER_CUT);

        AlertProcessor processor = new AlertProcessor(
                storage, cacheManager, alertSecurity, alertCache, connectionManager, alertNotificationService);

        assertFalse(processor.processEvent(source, position));
        verify(storage, org.mockito.Mockito.never()).addObject(any(AlertEvent.class), any(Request.class));
        verify(alertNotificationService, org.mockito.Mockito.never()).sendAsync(any(), any());
    }

    @Test
    public void testInsertFailureDoesNotSendNotification() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        AlertSecurity alertSecurity = mock(AlertSecurity.class);
        AlertCache alertCache = mock(AlertCache.class);
        ConnectionManager connectionManager = mock(ConnectionManager.class);
        AlertNotificationService alertNotificationService = mock(AlertNotificationService.class);

        Alert alert = new Alert();
        alert.setId(5);
        alert.setType(Alert.TYPE_POWER_CUT);
        AlertCache.CachedAlert cachedAlert = new AlertCache.CachedAlert(
                alert, List.of(1L), List.of(), List.of(), List.of(), List.of());
        when(alertCache.getAlerts()).thenReturn(List.of(cachedAlert));
        when(alertSecurity.alertAppliesToDevice(alert, 1, 0, List.of(1L), List.of())).thenReturn(true);
        when(storage.getObjects(eq(AlertEvent.class), any(Request.class))).thenReturn(List.of());
        when(storage.addObject(any(AlertEvent.class), any(Request.class)))
                .thenThrow(new StorageException("insert failed"));

        Device device = new Device();
        device.setId(1);
        when(cacheManager.getObject(Device.class, 1)).thenReturn(device);
        Position position = new Position();
        position.setDeviceId(1);
        Event source = new Event(Event.TYPE_ALARM, position);
        source.set(Position.KEY_ALARM, Position.ALARM_POWER_CUT);

        AlertProcessor processor = new AlertProcessor(
                storage, cacheManager, alertSecurity, alertCache, connectionManager, alertNotificationService);

        assertFalse(processor.processEvent(source, position));
        verify(alertNotificationService, org.mockito.Mockito.never()).sendAsync(any(), any());
        verify(connectionManager, org.mockito.Mockito.never()).updateAlertEvent(eq(true), any());
    }

    private static boolean conditionContains(Condition condition, String column, Object value) {
        if (condition instanceof Condition.Compare compare) {
            return column.equals(compare.getColumn()) && value.equals(compare.getValue());
        }
        if (condition instanceof Condition.Binary binary) {
            return conditionContains(binary.getFirst(), column, value)
                    || conditionContains(binary.getSecond(), column, value);
        }
        return false;
    }
}

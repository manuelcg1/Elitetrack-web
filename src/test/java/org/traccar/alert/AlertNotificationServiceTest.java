package org.traccar.alert;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.traccar.model.Alert;
import org.traccar.model.AlertEvent;
import org.traccar.model.Device;
import org.traccar.model.Geofence;
import org.traccar.model.Position;
import org.traccar.model.User;
import org.traccar.notification.NotificationMessage;
import org.traccar.notification.NotificatorManager;
import org.traccar.notificators.Notificator;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.query.Request;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class AlertNotificationServiceTest {

    private AlertNotificationService createService(
            Storage storage, CacheManager cacheManager, NotificatorManager notificatorManager,
            ExecutorService executorService) {
        doAnswer(invocation -> {
            invocation.getArgument(0, Runnable.class).run();
            return null;
        }).when(executorService).execute(any(Runnable.class));
        return new AlertNotificationService(storage, cacheManager, notificatorManager, executorService);
    }

    @Test
    public void testNotificationChannelFormats() {
        AlertNotificationService service = new AlertNotificationService(
                mock(Storage.class), mock(CacheManager.class), mock(NotificatorManager.class),
                mock(ExecutorService.class));
        Alert alert = new Alert();

        assertTrue(service.isChannelEnabled(alert, "platform", true));
        assertFalse(service.isChannelEnabled(alert, "telegram", false));

        alert.getAttributes().put("notifications", List.of("platform", "telegram"));
        assertTrue(service.isChannelEnabled(alert, "telegram", false));

        alert.set("notifications", "platform, telegram");
        assertTrue(service.isChannelEnabled(alert, "telegram", false));

        alert.getAttributes().put("notifications", Map.of("platform", true, "telegram", false));
        assertFalse(service.isChannelEnabled(alert, "telegram", false));
    }

    @Test
    public void testNoTelegramChannelDoesNotScheduleTask() {
        ExecutorService executorService = mock(ExecutorService.class);
        AlertNotificationService service = new AlertNotificationService(
                mock(Storage.class), mock(CacheManager.class), mock(NotificatorManager.class), executorService);
        Alert alert = new Alert();
        alert.getAttributes().put("notifications", List.of("platform"));

        service.sendAsync(alert, new AlertEvent());

        verify(executorService, never()).execute(any(Runnable.class));
    }

    @Test
    public void testRejectedTaskDoesNotEscapeGpsFlow() {
        ExecutorService executorService = mock(ExecutorService.class);
        org.mockito.Mockito.doThrow(new java.util.concurrent.RejectedExecutionException("shutdown"))
                .when(executorService).execute(any(Runnable.class));
        AlertNotificationService service = new AlertNotificationService(
                mock(Storage.class), mock(CacheManager.class), mock(NotificatorManager.class), executorService);
        Alert alert = new Alert();
        alert.set("notifications", "telegram");

        service.sendAsync(alert, new AlertEvent());

        verify(executorService).execute(any(Runnable.class));
    }

    @Test
    public void testTelegramMessageWithPositionAndGeofence() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        NotificatorManager notificatorManager = mock(NotificatorManager.class);
        ExecutorService executorService = mock(ExecutorService.class);
        Notificator telegram = mock(Notificator.class);
        AlertNotificationService service = createService(
                storage, cacheManager, notificatorManager, executorService);

        Alert alert = new Alert();
        alert.setId(1);
        alert.setName("Ingreso principal");
        alert.setCreatedBy(7);
        alert.getAttributes().put("notifications", List.of("platform", "telegram"));

        User user = new User();
        user.setId(7);
        user.set("telegramChatId", "123456789");
        when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(user);

        Device device = new Device();
        device.setId(10);
        device.setName("TT1-123");
        when(cacheManager.getObject(Device.class, 10)).thenReturn(device);

        Position position = new Position();
        position.setId(20);
        position.setDeviceId(10);
        position.setLatitude(-8.1);
        position.setLongitude(-79.0);
        when(storage.getObject(eq(Position.class), any(Request.class))).thenReturn(position);

        Geofence geofence = new Geofence();
        geofence.setId(30);
        geofence.setName("Almacén");
        when(cacheManager.getObject(Geofence.class, 30)).thenReturn(geofence);
        when(notificatorManager.getNotificator("telegram")).thenReturn(telegram);

        AlertEvent event = new AlertEvent();
        event.setId(40);
        event.setDeviceId(10);
        event.setPositionId(20);
        event.setGeofenceId(30);
        event.setType(Alert.TYPE_GEOFENCE_ENTER);
        event.setSeverity(Alert.SEVERITY_HIGH);
        event.setMessage("Ingreso principal");
        event.setEventTime(new java.util.Date());

        service.sendAsync(alert, event);

        ArgumentCaptor<NotificationMessage> messageCaptor = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(telegram).send(eq(user), messageCaptor.capture(), eq(null), eq(position));
        assertTrue(messageCaptor.getValue().digest().contains("TT1-123 ingresó a la geocerca Almacén"));
        assertTrue(messageCaptor.getValue().digest().contains("-8.100000, -79.000000"));
        assertTrue(messageCaptor.getValue().priority());
    }

    @Test
    public void testMissingChatOrDisabledNotificatorDoesNotEscapeAsyncTask() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        NotificatorManager notificatorManager = mock(NotificatorManager.class);
        ExecutorService executorService = mock(ExecutorService.class);
        AlertNotificationService service = createService(
                storage, cacheManager, notificatorManager, executorService);

        Alert alert = new Alert();
        alert.setId(1);
        alert.setCreatedBy(7);
        alert.set("notifications", "telegram");
        AlertEvent event = new AlertEvent();
        event.setId(2);

        User user = new User();
        user.setId(7);
        when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(user);
        service.sendAsync(alert, event);
        verify(notificatorManager, never()).getNotificator("telegram");

        user.set("telegramChatId", "123");
        when(notificatorManager.getNotificator("telegram"))
                .thenThrow(new RuntimeException("disabled"));
        service.sendAsync(alert, event);
        verify(notificatorManager).getNotificator("telegram");
    }

    @Test
    public void testMissingStoredPositionUsesCachedPosition() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        NotificatorManager notificatorManager = mock(NotificatorManager.class);
        ExecutorService executorService = mock(ExecutorService.class);
        Notificator telegram = mock(Notificator.class);
        AlertNotificationService service = createService(
                storage, cacheManager, notificatorManager, executorService);

        Alert alert = new Alert();
        alert.setCreatedBy(7);
        alert.set("notifications", "telegram");
        User user = new User();
        user.set("telegramChatId", "123");
        when(storage.getObject(eq(User.class), any(Request.class))).thenReturn(user);
        when(storage.getObject(eq(Position.class), any(Request.class))).thenReturn(null);
        Position cachedPosition = new Position();
        cachedPosition.setDeviceId(10);
        when(cacheManager.getPosition(10)).thenReturn(cachedPosition);
        when(notificatorManager.getNotificator("telegram")).thenReturn(telegram);

        AlertEvent event = new AlertEvent();
        event.setDeviceId(10);
        event.setPositionId(20);
        service.sendAsync(alert, event);

        verify(telegram).send(eq(user), any(NotificationMessage.class), eq(null), eq(cachedPosition));
    }
}

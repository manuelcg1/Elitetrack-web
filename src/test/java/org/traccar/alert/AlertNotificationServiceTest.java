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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

public class AlertNotificationServiceTest {

    private AlertNotificationService createService(
            Storage storage, CacheManager cacheManager, NotificatorManager notificatorManager,
            ExecutorService executorService) {
        doAnswer(invocation -> {
            invocation.getArgument(0, Runnable.class).run();
            return null;
        }).when(executorService).execute(any(Runnable.class));
        AlertRecipientRepository repository = mock(AlertRecipientRepository.class);
        AlertSecurity security = mock(AlertSecurity.class);
        try {
            when(repository.getUserIds(anyLong())).thenReturn(List.of(7L));
            when(security.canAccessDevice(anyLong(), anyLong())).thenReturn(true);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return new AlertNotificationService(
                storage, cacheManager, notificatorManager, executorService, repository, security);
    }

    @Test
    public void testNotificationChannelFormats() {
        AlertNotificationService service = new AlertNotificationService(
                mock(Storage.class), mock(CacheManager.class), mock(NotificatorManager.class),
                mock(ExecutorService.class), mock(AlertRecipientRepository.class), mock(AlertSecurity.class));
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
                mock(Storage.class), mock(CacheManager.class), mock(NotificatorManager.class), executorService,
                mock(AlertRecipientRepository.class), mock(AlertSecurity.class));
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
                mock(Storage.class), mock(CacheManager.class), mock(NotificatorManager.class), executorService,
                mock(AlertRecipientRepository.class), mock(AlertSecurity.class));
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
        when(storage.getObjects(eq(User.class), any(Request.class))).thenReturn(List.of(user));

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
        when(storage.getObjects(eq(User.class), any(Request.class))).thenReturn(List.of(user));
        service.sendAsync(alert, event);
        verify(notificatorManager, never()).getNotificator("telegram");

        user.set("telegramChatId", "123");
        event.setId(3);
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
        user.setId(7);
        when(storage.getObjects(eq(User.class), any(Request.class))).thenReturn(List.of(user));
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

    @Test
    public void testRecipientFailureDoesNotBlockOthersAndDeduplicatesEvent() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        NotificatorManager manager = mock(NotificatorManager.class);
        ExecutorService executor = mock(ExecutorService.class);
        AlertRecipientRepository repository = mock(AlertRecipientRepository.class);
        AlertSecurity security = mock(AlertSecurity.class);
        doAnswer(invocation -> {
            invocation.getArgument(0, Runnable.class).run();
            return null;
        }).when(executor).execute(any(Runnable.class));

        User first = new User();
        first.setId(1);
        first.set("telegramChatId", "11111");
        User second = new User();
        second.setId(4);
        second.set("telegramChatId", "44444");
        when(repository.getUserIds(9)).thenReturn(List.of(1L, 4L, 4L));
        when(storage.getObjects(eq(User.class), any(Request.class))).thenReturn(List.of(first, second));
        when(security.canAccessDevice(anyLong(), eq(10L))).thenReturn(true);
        Notificator telegram = mock(Notificator.class);
        when(manager.getNotificator("telegram")).thenReturn(telegram);
        doThrow(new RuntimeException("recipient failure")).when(telegram)
                .send(eq(first), any(NotificationMessage.class), eq(null), any());

        AlertNotificationService service = new AlertNotificationService(
                storage, cacheManager, manager, executor, repository, security);
        Alert alert = new Alert();
        alert.setId(9);
        alert.getAttributes().put("notifications", List.of("telegram"));
        AlertEvent event = new AlertEvent();
        event.setId(20);
        event.setDeviceId(10);

        service.sendAsync(alert, event);
        service.sendAsync(alert, event);

        verify(telegram, times(1)).send(eq(first), any(NotificationMessage.class), eq(null), any());
        verify(telegram, times(1)).send(eq(second), any(NotificationMessage.class), eq(null), any());
    }

    @Test
    public void testRecipientWithoutDevicePermissionIsSkipped() throws Exception {
        Storage storage = mock(Storage.class);
        ExecutorService executor = mock(ExecutorService.class);
        doAnswer(invocation -> {
            invocation.getArgument(0, Runnable.class).run();
            return null;
        }).when(executor).execute(any(Runnable.class));
        AlertRecipientRepository repository = mock(AlertRecipientRepository.class);
        when(repository.getUserIds(9)).thenReturn(List.of(7L));
        User user = new User();
        user.setId(7);
        user.set("telegramChatId", "77777");
        when(storage.getObjects(eq(User.class), any(Request.class))).thenReturn(List.of(user));
        AlertSecurity security = mock(AlertSecurity.class);
        when(security.canAccessDevice(7, 10)).thenReturn(false);
        NotificatorManager manager = mock(NotificatorManager.class);
        AlertNotificationService service = new AlertNotificationService(
                storage, mock(CacheManager.class), manager, executor, repository, security);
        Alert alert = new Alert();
        alert.setId(9);
        alert.set("notifications", "telegram");
        AlertEvent event = new AlertEvent();
        event.setId(30);
        event.setDeviceId(10);

        service.sendAsync(alert, event);

        verify(manager, never()).getNotificator("telegram");
    }
}

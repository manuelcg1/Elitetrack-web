package org.traccar.database;

import org.junit.jupiter.api.Test;
import org.traccar.config.Config;
import org.traccar.model.Event;
import org.traccar.model.Position;
import org.traccar.notification.NotificatorManager;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.query.Request;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class NotificationManagerTest {

    @Test
    public void testSuppressedNotificationStillStoresNativeEvent() throws Exception {
        Storage storage = mock(Storage.class);
        CacheManager cacheManager = mock(CacheManager.class);
        NotificatorManager notificatorManager = mock(NotificatorManager.class);
        when(storage.addObject(any(Event.class), any(Request.class))).thenReturn(10L);

        NotificationManager manager = new NotificationManager(
                new Config(), storage, cacheManager, null, notificatorManager, null);

        Position position = new Position();
        position.setDeviceId(1);
        Event event = new Event(Event.TYPE_ALARM, position);
        event.set(Position.KEY_ALARM, Position.ALARM_POWER_CUT);

        manager.updateEvents(Map.of(event, position), true);

        verify(storage).addObject(eq(event), any(Request.class));
        verify(cacheManager, never()).getDeviceNotifications(1);
    }
}

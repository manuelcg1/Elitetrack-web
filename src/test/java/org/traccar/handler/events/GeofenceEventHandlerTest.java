package org.traccar.handler.events;

import org.junit.jupiter.api.Test;
import org.traccar.model.Event;
import org.traccar.model.Geofence;
import org.traccar.model.Position;
import org.traccar.session.cache.CacheManager;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class GeofenceEventHandlerTest {

    private Position position(long deviceId, long time, Long... geofenceIds) {
        Position position = new Position();
        position.setDeviceId(deviceId);
        position.setFixTime(new Date(time));
        position.setGeofenceIds(List.of(geofenceIds));
        return position;
    }

    @Test
    public void testGeofenceReentryGeneratesNewEvent() {
        CacheManager cacheManager = mock(CacheManager.class);
        Position outside = position(1, 1);
        Position inside = position(1, 2, 20L);
        Position outsideAgain = position(1, 3);
        Position reentry = position(1, 4, 20L);
        Geofence geofence = new Geofence();
        geofence.setId(20);

        when(cacheManager.getPosition(1)).thenReturn(
                outside, outside, inside, inside, outsideAgain, outsideAgain);
        when(cacheManager.getObject(eq(Geofence.class), eq(20L))).thenReturn(geofence);

        List<Event> events = new ArrayList<>();
        GeofenceEventHandler handler = new GeofenceEventHandler(cacheManager);
        handler.onPosition(inside, events::add);
        handler.onPosition(outsideAgain, events::add);
        handler.onPosition(reentry, events::add);

        assertEquals(3, events.size());
        assertEquals(Event.TYPE_GEOFENCE_ENTER, events.get(0).getType());
        assertEquals(20, events.get(0).getGeofenceId());
        assertEquals(Event.TYPE_GEOFENCE_EXIT, events.get(1).getType());
        assertEquals(Event.TYPE_GEOFENCE_ENTER, events.get(2).getType());
        assertEquals(20, events.get(2).getGeofenceId());
    }

    @Test
    public void testMissingGeofenceDoesNotInterruptProcessing() {
        CacheManager cacheManager = mock(CacheManager.class);
        Position previous = position(1, 1);
        Position current = position(1, 2, 20L);
        when(cacheManager.getPosition(1)).thenReturn(previous);

        List<Event> events = new ArrayList<>();
        new GeofenceEventHandler(cacheManager).onPosition(current, events::add);

        assertTrue(events.isEmpty());
    }
}

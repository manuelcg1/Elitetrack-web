package org.traccar.handler;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.traccar.database.StatisticsManager;
import org.traccar.forward.CatalogPositionForwarder;
import org.traccar.forward.PositionData;
import org.traccar.model.Device;
import org.traccar.model.Position;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.query.Request;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class SutranForwardingHandlerTest {

    @Test
    public void testPositionIsStoredOnceBeforeSutranForwarding() throws Exception {
        Storage storage = mock(Storage.class);
        StatisticsManager statisticsManager = mock(StatisticsManager.class);
        CacheManager cacheManager = mock(CacheManager.class);
        CatalogPositionForwarder catalog = mock(CatalogPositionForwarder.class);
        when(storage.addObject(any(Position.class), any(Request.class))).thenReturn(321L);

        Device device = new Device();
        device.setId(7);
        device.setName("CTM495");
        when(cacheManager.getObject(Device.class, 7L)).thenReturn(device);

        Position position = new Position();
        position.setDeviceId(7);
        AtomicInteger callbacks = new AtomicInteger();

        DatabaseHandler databaseHandler = new DatabaseHandler(storage, statisticsManager);
        SutranForwardingHandler sutranHandler = new SutranForwardingHandler(cacheManager, catalog, Runnable::run);
        databaseHandler.onPosition(position, filtered ->
                sutranHandler.onPosition(position, ignored -> callbacks.incrementAndGet()));

        ArgumentCaptor<PositionData> captor = ArgumentCaptor.forClass(PositionData.class);
        verify(storage, times(1)).addObject(any(Position.class), any(Request.class));
        verify(catalog).forwardSutran(captor.capture());
        assertSame(position, captor.getValue().getPosition());
        assertEquals(321L, captor.getValue().getPosition().getId());
        assertEquals(1, callbacks.get());
    }

}

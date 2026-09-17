package org.traccar.session.cache;

import com.google.inject.AbstractModule;
import com.google.inject.Guice;
import io.netty.util.Timer;
import org.junit.jupiter.api.Test;
import org.traccar.broadcast.BroadcastService;
import org.traccar.config.Config;
import org.traccar.database.DeviceLookupService;
import org.traccar.database.NotificationManager;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.User;
import org.traccar.session.ConnectionManager;
import org.traccar.storage.Storage;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;

/** Verifies the actual provider cycle without starting servers, timers or database migrations. */
public class SessionPermissionWiringTest {

    @Test
    public void cacheAndSessionManagerResolveAsSingletonsWithoutCircularConstruction() {
        var injector = Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                bind(Config.class).toInstance(new Config());
                bind(Storage.class).toInstance(mock(Storage.class));
                bind(BroadcastService.class).toInstance(mock(BroadcastService.class));
                bind(NotificationManager.class).toInstance(mock(NotificationManager.class));
                bind(DeviceLookupService.class).toInstance(mock(DeviceLookupService.class));
                bind(Timer.class).toInstance(mock(Timer.class));
            }
        });
        var cache = injector.getInstance(CacheManager.class);
        var sessions = injector.getInstance(ConnectionManager.class);
        assertSame(cache, injector.getInstance(CacheManager.class));
        assertSame(sessions, injector.getInstance(ConnectionManager.class));
        assertDoesNotThrow(() -> cache.invalidatePermission(true, User.class, 1, GeofenceFolder.class, 10, false));
    }
}

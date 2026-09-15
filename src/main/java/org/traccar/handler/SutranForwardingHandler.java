package org.traccar.handler;

import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.forward.CatalogPositionForwarder;
import org.traccar.forward.PositionData;
import org.traccar.forward.sutran.SutranOrderedDispatcher;
import org.traccar.model.Device;
import org.traccar.model.Position;
import org.traccar.session.cache.CacheManager;

import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;

public class SutranForwardingHandler extends BasePositionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(SutranForwardingHandler.class);

    private final CacheManager cacheManager;
    private final CatalogPositionForwarder catalogPositionForwarder;
    private final SutranOrderedDispatcher<Long> dispatcher;

    @Inject
    public SutranForwardingHandler(
            CacheManager cacheManager, CatalogPositionForwarder catalogPositionForwarder,
            ExecutorService executorService) {
        this(cacheManager, catalogPositionForwarder, (Executor) executorService);
    }

    SutranForwardingHandler(
            CacheManager cacheManager, CatalogPositionForwarder catalogPositionForwarder, Executor executor) {
        this.cacheManager = cacheManager;
        this.catalogPositionForwarder = catalogPositionForwarder;
        this.dispatcher = new SutranOrderedDispatcher<>(executor);
    }

    @Override
    public void onPosition(Position position, Callback callback) {
        PositionData positionData = new PositionData();
        positionData.setPosition(position);
        positionData.setDevice(cacheManager.getObject(Device.class, position.getDeviceId()));
        try {
            dispatcher.submit(position.getDeviceId(), completed -> {
                try {
                    catalogPositionForwarder.forwardSutran(positionData);
                } catch (RuntimeException e) {
                    LOGGER.warn("Unable to enqueue SUTRAN forwarding for device {}", position.getDeviceId());
                } finally {
                    completed.run();
                }
            });
        } catch (RuntimeException e) {
            LOGGER.warn("Unable to schedule SUTRAN forwarding for device {}", position.getDeviceId());
        }
        callback.processed(false);
    }

}

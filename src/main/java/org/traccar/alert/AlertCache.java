package org.traccar.alert;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.traccar.model.Alert;
import org.traccar.model.AlertDevice;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.List;
import java.util.ArrayList;

@Singleton
public class AlertCache {

    public record CachedAlert(Alert alert, List<Long> deviceIds, List<Long> groupIds) {
    }

    private static final long CACHE_TTL = 30000;

    private final Storage storage;

    private volatile long cacheTime;
    private volatile List<CachedAlert> speedAlerts;

    @Inject
    public AlertCache(Storage storage) {
        this.storage = storage;
    }

    public List<CachedAlert> getSpeedAlerts() throws StorageException {
        long now = System.currentTimeMillis();
        List<CachedAlert> cached = speedAlerts;
        if (cached == null || now - cacheTime > CACHE_TTL) {
            synchronized (this) {
                cached = speedAlerts;
                if (cached == null || now - cacheTime > CACHE_TTL) {
                    cached = loadSpeedAlerts();
                    speedAlerts = cached;
                    cacheTime = now;
                }
            }
        }
        return cached;
    }

    public void invalidate() {
        speedAlerts = null;
        cacheTime = 0;
    }

    private List<CachedAlert> loadSpeedAlerts() throws StorageException {
        List<Alert> alerts = storage.getObjects(Alert.class, new Request(
                new Columns.All(),
                new Condition.And(
                        new Condition.Equals("active", true),
                        new Condition.Equals("type", Alert.TYPE_SPEED))));

        List<CachedAlert> result = new ArrayList<>();
        for (Alert alert : alerts) {
            List<AlertDevice> relations = storage.getObjects(AlertDevice.class, new Request(
                    new Columns.All(), new Condition.Equals("alertId", alert.getId())));
            result.add(new CachedAlert(
                    alert,
                    relations.stream()
                            .map(AlertDevice::getDeviceId)
                            .filter(deviceId -> deviceId != null && deviceId > 0)
                            .toList(),
                    relations.stream()
                            .map(AlertDevice::getGroupId)
                            .filter(groupId -> groupId != null && groupId > 0)
                            .toList()));
        }
        return result;
    }

}

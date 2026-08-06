package org.traccar.alert;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.config.Config;
import org.traccar.config.Keys;

import java.time.Instant;
import java.util.Comparator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

@Singleton
public class AlertGeofenceStateManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(AlertGeofenceStateManager.class);

    public enum AlertGeofenceState {
        INSIDE,
        OUTSIDE
    }

    public record AlertGeofenceStateKey(long alertId, long deviceId, long geofenceId) {
    }

    public record StateTransition(
            boolean initialized, boolean changed, AlertGeofenceState previous, AlertGeofenceState current) {
    }

    private record StateEntry(AlertGeofenceState state, Instant updatedAt) {
    }

    private final ConcurrentHashMap<AlertGeofenceStateKey, StateEntry> states = new ConcurrentHashMap<>();
    private final long expirationMillis;
    private final long cleanupMillis;
    private final int maximumSize;
    private volatile long lastCleanup;

    @Inject
    public AlertGeofenceStateManager(Config config) {
        this(Math.max(1, config.getInteger(Keys.ALERT_GEOFENCE_STATE_EXPIRATION_HOURS)) * 3600000L,
                Math.max(1, config.getInteger(Keys.ALERT_GEOFENCE_STATE_CLEANUP_MINUTES)) * 60000L,
                Math.max(1, config.getInteger(Keys.ALERT_GEOFENCE_STATE_MAXIMUM_SIZE)));
    }

    AlertGeofenceStateManager(long expirationMillis, long cleanupMillis, int maximumSize) {
        this.expirationMillis = expirationMillis;
        this.cleanupMillis = cleanupMillis;
        this.maximumSize = maximumSize;
    }

    public StateTransition update(AlertGeofenceStateKey key, AlertGeofenceState current) {
        cleanupIfRequired();
        AtomicReference<StateTransition> result = new AtomicReference<>();
        Instant now = Instant.now();
        states.compute(key, (ignored, previousEntry) -> {
            if (previousEntry == null) {
                result.set(new StateTransition(true, false, null, current));
            } else {
                result.set(new StateTransition(
                        false, previousEntry.state() != current, previousEntry.state(), current));
            }
            return new StateEntry(current, now);
        });
        StateTransition transition = result.get();
        if (transition.initialized()) {
            LOGGER.debug("Alert geofence state initialized alertId={} deviceId={} geofenceId={} state={}",
                    key.alertId(), key.deviceId(), key.geofenceId(), current);
        } else if (transition.changed()) {
            LOGGER.debug("Alert geofence transition detected alertId={} deviceId={} geofenceId={} {} -> {}",
                    key.alertId(), key.deviceId(), key.geofenceId(), transition.previous(), current);
        } else {
            LOGGER.debug("Alert geofence state unchanged alertId={} deviceId={} geofenceId={} state={}",
                    key.alertId(), key.deviceId(), key.geofenceId(), current);
        }
        return transition;
    }

    public AlertGeofenceState getState(AlertGeofenceStateKey key) {
        StateEntry entry = states.get(key);
        return entry != null ? entry.state() : null;
    }

    public void removeByAlertId(long alertId) {
        removeMatching(key -> key.alertId() == alertId);
    }

    public void removeByDeviceId(long deviceId) {
        removeMatching(key -> key.deviceId() == deviceId);
    }

    public void removeByGeofenceId(long geofenceId) {
        removeMatching(key -> key.geofenceId() == geofenceId);
    }

    public int size() {
        return states.size();
    }

    public void cleanup() {
        long expiration = System.currentTimeMillis() - expirationMillis;
        states.entrySet().removeIf(entry -> entry.getValue().updatedAt().toEpochMilli() < expiration);
        int excess = states.size() - maximumSize;
        if (excess > 0) {
            states.entrySet().stream()
                    .sorted(Comparator.comparing(entry -> entry.getValue().updatedAt()))
                    .limit(excess)
                    .map(java.util.Map.Entry::getKey)
                    .toList()
                    .forEach(states::remove);
        }
        lastCleanup = System.currentTimeMillis();
    }

    private void cleanupIfRequired() {
        long now = System.currentTimeMillis();
        if (states.size() >= maximumSize || now - lastCleanup >= cleanupMillis) {
            synchronized (this) {
                if (states.size() >= maximumSize || now - lastCleanup >= cleanupMillis) {
                    cleanup();
                }
            }
        }
    }

    private void removeMatching(java.util.function.Predicate<AlertGeofenceStateKey> predicate) {
        states.keySet().removeIf(key -> {
            boolean remove = predicate.test(key);
            if (remove) {
                LOGGER.debug("Alert geofence state removed alertId={} deviceId={} geofenceId={}",
                        key.alertId(), key.deviceId(), key.geofenceId());
            }
            return remove;
        });
    }
}

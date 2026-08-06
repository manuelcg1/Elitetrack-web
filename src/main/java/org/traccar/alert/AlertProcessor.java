package org.traccar.alert;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.handler.BasePositionHandler;
import org.traccar.helper.UnitsConverter;
import org.traccar.model.Alert;
import org.traccar.model.AlertEvent;
import org.traccar.model.Device;
import org.traccar.model.Driver;
import org.traccar.model.Event;
import org.traccar.model.Position;
import org.traccar.session.ConnectionManager;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

@Singleton
public class AlertProcessor extends BasePositionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(AlertProcessor.class);

    private static final String OPERATOR_GREATER_THAN = "greaterThan";
    private static final String OPERATOR_GREATER_THAN_SYMBOL = ">";
    private static final String UNIT_KMH = "km/h";
    private static final int DEFAULT_COOLDOWN_MINUTES = 5;
    private static final int IDEMPOTENCY_LOCK_COUNT = 256;
    private static final int IDEMPOTENCY_CACHE_SIZE = 10000;
    private static final long IDEMPOTENCY_CACHE_EXPIRATION = 10 * 60 * 1000L;

    private final Storage storage;
    private final CacheManager cacheManager;
    private final AlertSecurity alertSecurity;
    private final AlertCache alertCache;
    private final ConnectionManager connectionManager;
    private final AlertNotificationService alertNotificationService;
    private final AlertGeofenceStateManager geofenceStateManager;
    private final Object[] idempotencyLocks = new Object[IDEMPOTENCY_LOCK_COUNT];
    private final ConcurrentHashMap<AlertEventKey, Long> recentEvents = new ConcurrentHashMap<>();

    @Inject
    public AlertProcessor(
            Storage storage, CacheManager cacheManager, AlertSecurity alertSecurity, AlertCache alertCache,
            ConnectionManager connectionManager, AlertNotificationService alertNotificationService,
            AlertGeofenceStateManager geofenceStateManager) {
        this.storage = storage;
        this.cacheManager = cacheManager;
        this.alertSecurity = alertSecurity;
        this.alertCache = alertCache;
        this.connectionManager = connectionManager;
        this.alertNotificationService = alertNotificationService;
        this.geofenceStateManager = geofenceStateManager;
        for (int i = 0; i < idempotencyLocks.length; i++) {
            idempotencyLocks[i] = new Object();
        }
    }

    @Override
    public void onPosition(Position position, Callback callback) {
        try {
            processSpeedAlerts(position);
            processBatteryAlerts(position);
            processGeofenceAlerts(position);
        } catch (Exception e) {
            LOGGER.warn("Alert processing failed", e);
        } finally {
            callback.processed(false);
        }
    }

    private void processSpeedAlerts(Position position) throws StorageException {
        double speed = UnitsConverter.kphFromKnots(position.getSpeed());
        Device device = cacheManager.getObject(Device.class, position.getDeviceId());
        long deviceGroupId = device != null ? device.getGroupId() : 0;

        for (AlertCache.CachedAlert cachedAlert : alertCache.getAlerts()) {
            Alert alert = cachedAlert.alert();
            if (!Alert.TYPE_SPEED.equals(alert.getType())
                    || alert.getLimitValue() <= 0
                    || !isGreaterThanOperator(alert.getOperator())
                    || !appliesToDevice(cachedAlert, position.getDeviceId(), deviceGroupId)
                    || !appliesToGeofence(cachedAlert, 0, position)
                    || hasRecentEvent(alert, position.getDeviceId(), 0, Alert.TYPE_SPEED)
                    || speed <= alert.getLimitValue()) {
                continue;
            }
            saveEvent(position, alert, Alert.TYPE_SPEED, speed, alert.getLimitValue(), UNIT_KMH, 0);
        }
    }

    private void processBatteryAlerts(Position position) throws StorageException {
        if (!position.hasAttribute(Position.KEY_BATTERY_LEVEL)) {
            return;
        }
        double batteryLevel = position.getDouble(Position.KEY_BATTERY_LEVEL);
        Position previousPosition = cacheManager.getPosition(position.getDeviceId());
        Device device = cacheManager.getObject(Device.class, position.getDeviceId());
        long deviceGroupId = device != null ? device.getGroupId() : 0;
        for (AlertCache.CachedAlert cachedAlert : alertCache.getAlerts()) {
            Alert alert = cachedAlert.alert();
            double threshold = alert.getLimitValue() > 0 ? alert.getLimitValue() : 20;
            boolean wasLow = previousPosition != null
                    && previousPosition.hasAttribute(Position.KEY_BATTERY_LEVEL)
                    && previousPosition.getDouble(Position.KEY_BATTERY_LEVEL) <= threshold;
            if (!Alert.TYPE_BATTERY_LOW.equals(alert.getType())
                    || !appliesToDevice(cachedAlert, position.getDeviceId(), deviceGroupId)
                    || !appliesToGeofence(cachedAlert, 0, position)
                    || hasRecentEvent(alert, position.getDeviceId(), 0, Alert.TYPE_BATTERY_LOW)
                    || wasLow
                    || batteryLevel > threshold) {
                continue;
            }
            saveEvent(position, alert, Alert.TYPE_BATTERY_LOW, batteryLevel, threshold, "%", 0);
        }
    }

    private void processGeofenceAlerts(Position position) throws StorageException {
        Device device = cacheManager.getObject(Device.class, position.getDeviceId());
        long deviceGroupId = device != null ? device.getGroupId() : 0;

        for (AlertCache.CachedAlert cachedAlert : alertCache.getAlerts()) {
            Alert alert = cachedAlert.alert();
            if (!isGeofenceTransition(alert.getType())
                    || cachedAlert.geofenceIds().isEmpty()
                    || !appliesToDevice(cachedAlert, position.getDeviceId(), deviceGroupId)) {
                continue;
            }
            for (var geofence : cachedAlert.geofences()) {
                long geofenceId = geofence.getId();
                var key = new AlertGeofenceStateManager.AlertGeofenceStateKey(
                        alert.getId(), position.getDeviceId(), geofenceId);
                var currentState = geofence.containsPosition(position)
                        ? AlertGeofenceStateManager.AlertGeofenceState.INSIDE
                        : AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE;
                var transition = geofenceStateManager.update(key, currentState);
                boolean matchingTransition = transition.changed()
                        && ((Alert.TYPE_GEOFENCE_ENTER.equals(alert.getType())
                                        && currentState == AlertGeofenceStateManager.AlertGeofenceState.INSIDE)
                                || (Alert.TYPE_GEOFENCE_EXIT.equals(alert.getType())
                                        && currentState == AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE));
                if (matchingTransition
                        && !hasRecentEvent(alert, position.getDeviceId(), geofenceId, alert.getType())) {
                    saveEvent(position, alert, alert.getType(), 0, 0, null, geofenceId);
                }
            }
        }
    }

    public boolean processEvent(Event source, Position position) {
        String alertType = switch (source.getType()) {
            case Event.TYPE_GEOFENCE_ENTER -> Alert.TYPE_GEOFENCE_ENTER;
            case Event.TYPE_GEOFENCE_EXIT -> Alert.TYPE_GEOFENCE_EXIT;
            case Event.TYPE_IGNITION_ON -> Alert.TYPE_IGNITION_ON;
            case Event.TYPE_IGNITION_OFF -> Alert.TYPE_IGNITION_OFF;
            case Event.TYPE_DEVICE_STOPPED -> Alert.TYPE_STOPPED_TOO_LONG;
            case Event.TYPE_DEVICE_MOVING -> Alert.TYPE_MOVEMENT;
            case Event.TYPE_ALARM -> getAlarmAlertType(source.getString(Position.KEY_ALARM));
            default -> null;
        };
        if (alertType == null) {
            return false;
        }
        if (isRepeatedPowerAlarm(alertType, position)) {
            LOGGER.debug("Alert skipped because no power state change for device {}", position.getDeviceId());
            return false;
        }
        boolean alertGenerated = false;
        try {
            Device device = cacheManager.getObject(Device.class, position.getDeviceId());
            long deviceGroupId = device != null ? device.getGroupId() : 0;
            for (AlertCache.CachedAlert cachedAlert : alertCache.getAlerts()) {
                Alert alert = cachedAlert.alert();
                if (!alertType.equals(alert.getType())
                        || (isGeofenceTransition(alertType) && !cachedAlert.geofenceIds().isEmpty())
                        || !appliesToDevice(cachedAlert, position.getDeviceId(), deviceGroupId)
                        || !appliesToGeofence(cachedAlert, source.getGeofenceId(), position)
                        || (!isGeofenceTransition(alertType)
                                && hasRecentEvent(alert, position.getDeviceId(), source.getGeofenceId(), alertType))) {
                    continue;
                }
                double threshold = Alert.TYPE_POWER_CUT.equals(alertType) ? 0 : alert.getLimitValue();
                String unit = Alert.TYPE_POWER_CUT.equals(alertType) ? null : alert.getUnit();
                saveEvent(position, alert, alertType, 0, threshold, unit, source.getGeofenceId());
                alertGenerated = true;
            }
        } catch (Exception e) {
            LOGGER.warn("Alert event processing failed", e);
        }
        return alertGenerated;
    }

    private String getAlarmAlertType(String alarm) {
        if (alarm == null) {
            return null;
        }
        return switch (alarm) {
            case Position.ALARM_ACCELERATION -> Alert.TYPE_HARSH_ACCELERATION;
            case Position.ALARM_BRAKING -> Alert.TYPE_HARSH_BRAKING;
            case Position.ALARM_CORNERING -> Alert.TYPE_HARSH_CORNERING;
            case Position.ALARM_POWER_CUT -> Alert.TYPE_POWER_CUT;
            case Position.ALARM_POWER_RESTORED -> Alert.TYPE_POWER_RESTORED;
            default -> null;
        };
    }

    private boolean isRepeatedPowerAlarm(String alertType, Position position) {
        if (!Alert.TYPE_POWER_CUT.equals(alertType) && !Alert.TYPE_POWER_RESTORED.equals(alertType)) {
            return false;
        }
        Position previousPosition = cacheManager.getPosition(position.getDeviceId());
        if (previousPosition == null) {
            return false;
        }
        String previousAlarms = previousPosition.getString(Position.KEY_ALARM);
        String expectedAlarm = Alert.TYPE_POWER_CUT.equals(alertType)
                ? Position.ALARM_POWER_CUT : Position.ALARM_POWER_RESTORED;
        return previousAlarms != null
                && new HashSet<>(java.util.Arrays.asList(previousAlarms.split(","))).contains(expectedAlarm);
    }

    private boolean appliesToGeofence(
            AlertCache.CachedAlert cachedAlert, long eventGeofenceId, Position position) {
        boolean hasGeofenceScope = !cachedAlert.geofenceIds().isEmpty()
                || !cachedAlert.geofenceGroupIds().isEmpty();
        if (!hasGeofenceScope) {
            return true;
        }
        if (eventGeofenceId > 0) {
            return cachedAlert.geofenceIds().contains(eventGeofenceId);
        }
        if (position.getGeofenceIds() != null
                && position.getGeofenceIds().stream().anyMatch(cachedAlert.geofenceIds()::contains)) {
            return true;
        }
        for (var geofence : cachedAlert.geofences()) {
            if (geofence.containsPosition(position)) {
                return true;
            }
        }
        return false;
    }

    private boolean isGeofenceTransition(String type) {
        return Alert.TYPE_GEOFENCE_ENTER.equals(type) || Alert.TYPE_GEOFENCE_EXIT.equals(type);
    }

    private boolean isPlatformEnabled(Alert alert) {
        return alertNotificationService.isChannelEnabled(
                alert, AlertNotificationService.CHANNEL_PLATFORM, true);
    }

    private boolean appliesToDevice(AlertCache.CachedAlert cachedAlert, long deviceId, long deviceGroupId)
            throws StorageException {
        return alertSecurity.alertAppliesToDevice(
                cachedAlert.alert(), deviceId, deviceGroupId, cachedAlert.deviceIds(), cachedAlert.groupIds());
    }

    private boolean isGreaterThanOperator(String operator) {
        return operator == null
                || operator.isBlank()
                || OPERATOR_GREATER_THAN.equals(operator)
                || OPERATOR_GREATER_THAN_SYMBOL.equals(operator);
    }

    private boolean hasRecentEvent(Alert alert, long deviceId, long geofenceId, String eventType)
            throws StorageException {
        Condition condition = new Condition.And(
                new Condition.Equals("alertId", alert.getId()),
                new Condition.Equals("deviceId", deviceId));
        condition = new Condition.And(condition, new Condition.Equals("type", eventType));
        condition = new Condition.And(condition, new Condition.Equals("geofenceId", geofenceId));

        int cooldownMinutes = Math.max(0, alert.getInteger("cooldownMinutes", DEFAULT_COOLDOWN_MINUTES));
        if (cooldownMinutes == 0) {
            return false;
        }
        Date cooldownStart = new Date(System.currentTimeMillis() - cooldownMinutes * 60000L);
        return !storage.getObjects(AlertEvent.class, new Request(
                new Columns.Include("id"),
                new Condition.And(condition, new Condition.Compare("eventTime", ">=", cooldownStart)),
                new org.traccar.storage.query.Order("eventTime", true, 1, 0))).isEmpty();
    }

    private void saveEvent(
            Position position, Alert alert, String type, double value, double threshold, String unit, long geofenceId)
            throws StorageException {
        AlertEventKey eventKey = new AlertEventKey(
                alert.getId(), position.getDeviceId(), position.getId(), type, geofenceId);
        Object lock = idempotencyLocks[Math.floorMod(eventKey.hashCode(), idempotencyLocks.length)];
        synchronized (lock) {
            if (hasEvent(eventKey)) {
                LOGGER.debug("Duplicate alert event skipped for alert {} and device {}",
                        alert.getId(), position.getDeviceId());
                return;
            }
            saveEventUnchecked(position, alert, type, value, threshold, unit, geofenceId);
            if (recentEvents.size() >= IDEMPOTENCY_CACHE_SIZE) {
                long expiration = System.currentTimeMillis() - IDEMPOTENCY_CACHE_EXPIRATION;
                recentEvents.entrySet().removeIf(entry -> entry.getValue() < expiration);
                if (recentEvents.size() >= IDEMPOTENCY_CACHE_SIZE) {
                    recentEvents.clear();
                }
            }
            recentEvents.put(eventKey, System.currentTimeMillis());
        }
    }

    private boolean hasEvent(AlertEventKey key) throws StorageException {
        Long cachedAt = recentEvents.get(key);
        if (cachedAt != null && cachedAt >= System.currentTimeMillis() - IDEMPOTENCY_CACHE_EXPIRATION) {
            return true;
        }
        Condition condition = new Condition.And(
                new Condition.Equals("alertId", key.alertId()),
                new Condition.Equals("deviceId", key.deviceId()));
        condition = new Condition.And(condition, new Condition.Equals("positionId", key.positionId()));
        condition = new Condition.And(condition, new Condition.Equals("type", key.type()));
        condition = new Condition.And(condition, new Condition.Equals("geofenceId", key.geofenceId()));
        return !storage.getObjects(AlertEvent.class, new Request(
                new Columns.Include("id"), condition,
                new org.traccar.storage.query.Order("id", true, 1, 0))).isEmpty();
    }

    private void saveEventUnchecked(
            Position position, Alert alert, String type, double value, double threshold, String unit, long geofenceId)
            throws StorageException {
        AlertEvent event = new AlertEvent();
        event.setAlertId(alert.getId());
        event.setDeviceId(position.getDeviceId());
        event.setPositionId(position.getId());
        event.setType(type);
        event.setSeverity(alert.getSeverity());
        event.setStatus(AlertEvent.STATUS_OPEN);
        event.setEventTime(position.getFixTime() != null ? position.getFixTime() : new Date());
        event.setMessage(Alert.TYPE_SPEED.equals(type)
                ? String.format(Locale.US, "%s: %.2f km/h > %.2f km/h", alert.getName(), value, threshold)
                : alert.getName());
        event.setValue(value);
        event.setThreshold(threshold);
        event.setUnit(unit);
        event.setLatitude(position.getLatitude());
        event.setLongitude(position.getLongitude());
        event.setAddress(position.getAddress());
        event.setGeofenceId(geofenceId);
        event.set("platform", isPlatformEnabled(alert));
        Device device = cacheManager.getObject(Device.class, position.getDeviceId());
        event.setGroupId(device != null ? device.getGroupId() : 0);
        event.setAlertName(alert.getName());
        event.setDeviceName(device != null ? device.getName() : null);
        String driverUniqueId = position.getString(Position.KEY_DRIVER_UNIQUE_ID);
        if (driverUniqueId != null) {
            cacheManager.getDeviceObjects(position.getDeviceId(), Driver.class).stream()
                    .filter(driver -> driverUniqueId.equals(driver.getUniqueId()))
                    .findFirst()
                    .ifPresent(driver -> event.setDriverName(driver.getName()));
        }
        event.setId(storage.addObject(event, new Request(new Columns.Exclude("id"))));
        if (isPlatformEnabled(alert)) {
            connectionManager.updateAlertEvent(true, event);
        }
        alertNotificationService.sendAsync(alert, event);
    }

    private record AlertEventKey(long alertId, long deviceId, long positionId, String type, long geofenceId) {
    }

}

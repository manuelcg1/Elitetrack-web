package org.traccar.alert;

import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.handler.BasePositionHandler;
import org.traccar.helper.UnitsConverter;
import org.traccar.model.Alert;
import org.traccar.model.AlertEvent;
import org.traccar.model.Device;
import org.traccar.model.Position;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.Date;
import java.util.List;
import java.util.Locale;

public class AlertProcessor extends BasePositionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(AlertProcessor.class);

    private static final String OPERATOR_GREATER_THAN = "greaterThan";
    private static final String OPERATOR_GREATER_THAN_SYMBOL = ">";
    private static final String UNIT_KMH = "km/h";
    private static final int DEFAULT_COOLDOWN_MINUTES = 5;

    private final Storage storage;
    private final CacheManager cacheManager;
    private final AlertSecurity alertSecurity;
    private final AlertCache alertCache;

    @Inject
    public AlertProcessor(
            Storage storage, CacheManager cacheManager, AlertSecurity alertSecurity, AlertCache alertCache) {
        this.storage = storage;
        this.cacheManager = cacheManager;
        this.alertSecurity = alertSecurity;
        this.alertCache = alertCache;
    }

    @Override
    public void onPosition(Position position, Callback callback) {
        try {
            processSpeedAlerts(position);
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

        for (AlertCache.CachedAlert cachedAlert : alertCache.getSpeedAlerts()) {
            Alert alert = cachedAlert.alert();
            if (alert.getLimitValue() <= 0
                    || !isGreaterThanOperator(alert.getOperator())
                    || !appliesToDevice(cachedAlert, position.getDeviceId(), deviceGroupId)
                    || hasRecentEvent(alert, position.getDeviceId())
                    || speed <= alert.getLimitValue()) {
                continue;
            }
            saveEvent(position, alert, speed);
        }
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

    private boolean hasRecentEvent(Alert alert, long deviceId) throws StorageException {
        Condition condition = new Condition.And(
                new Condition.Equals("alertId", alert.getId()),
                new Condition.Equals("deviceId", deviceId));

        List<AlertEvent> activeEvents = storage.getObjects(AlertEvent.class, new Request(
                new Columns.Include("id"),
                new Condition.And(
                        condition,
                        new Condition.Or(
                                new Condition.Equals("status", AlertEvent.STATUS_OPEN),
                                new Condition.Equals("status", AlertEvent.STATUS_ACKNOWLEDGED))),
                new org.traccar.storage.query.Order("eventTime", true, 1, 0)));
        if (!activeEvents.isEmpty()) {
            return true;
        }

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

    private void saveEvent(Position position, Alert alert, double speed) throws StorageException {
        AlertEvent event = new AlertEvent();
        event.setAlertId(alert.getId());
        event.setDeviceId(position.getDeviceId());
        event.setPositionId(position.getId());
        event.setType(Alert.TYPE_SPEED);
        event.setSeverity(alert.getSeverity());
        event.setStatus(AlertEvent.STATUS_OPEN);
        event.setEventTime(position.getFixTime() != null ? position.getFixTime() : new Date());
        event.setMessage(String.format(
                Locale.US,
                "Speed alert '%s': %.2f km/h > %.2f km/h",
                alert.getName(), speed, alert.getLimitValue()));
        event.setValue(speed);
        event.setThreshold(alert.getLimitValue());
        event.setUnit(UNIT_KMH);
        event.setLatitude(position.getLatitude());
        event.setLongitude(position.getLongitude());
        event.setAddress(position.getAddress());
        event.setId(storage.addObject(event, new Request(new Columns.Exclude("id"))));
    }

}

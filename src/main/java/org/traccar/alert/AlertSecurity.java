package org.traccar.alert;

import jakarta.inject.Inject;
import org.traccar.model.Alert;
import org.traccar.model.AlertDevice;
import org.traccar.model.AlertEvent;
import org.traccar.model.AlertGeofence;
import org.traccar.model.Device;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.Group;
import org.traccar.model.User;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.List;

public class AlertSecurity {

    private final Storage storage;

    @Inject
    public AlertSecurity(Storage storage) {
        this.storage = storage;
    }

    public boolean isAdmin(long userId) throws StorageException {
        if (userId == 0) {
            return false;
        }
        User user = storage.getObject(User.class, new Request(
                new Columns.Include("administrator"), new Condition.Equals("id", userId)));
        return user != null && user.getAdministrator();
    }

    public void checkAlertPayload(long userId, Alert alert) throws StorageException {
        if (isAdmin(userId)) {
            return;
        }

        for (long deviceId : alert.getDeviceIds()) {
            checkPermission(Device.class, userId, deviceId);
        }
        for (long groupId : alert.getGroupIds()) {
            checkPermission(Group.class, userId, groupId);
        }
        for (long geofenceId : alert.getGeofenceIds()) {
            checkPermission(Geofence.class, userId, geofenceId);
        }
        for (long geofenceGroupId : alert.getGeofenceGroupIds()) {
            checkPermission(GeofenceFolder.class, userId, geofenceGroupId);
        }
    }

    public boolean canAccessAlert(long userId, Alert alert) throws StorageException {
        if (isAdmin(userId) || alert.getCreatedBy() == userId) {
            return true;
        }
        return hasAccessibleTarget(userId, alert);
    }

    public boolean canManageAlert(long userId, Alert alert) throws StorageException {
        return isAdmin(userId) || alert.getCreatedBy() == userId;
    }

    public boolean canAccessEvent(long userId, AlertEvent event) throws StorageException {
        if (isAdmin(userId)) {
            return true;
        }
        if (event.getDeviceId() > 0) {
            return hasPermission(Device.class, userId, event.getDeviceId());
        }
        if (event.getGroupId() > 0) {
            return hasPermission(Group.class, userId, event.getGroupId());
        }
        if (event.getGeofenceId() > 0) {
            return hasPermission(Geofence.class, userId, event.getGeofenceId());
        }
        if (event.getAlertId() > 0) {
            Alert alert = storage.getObject(Alert.class, new Request(
                    new Columns.All(), new Condition.Equals("id", event.getAlertId())));
            return alert != null && canAccessAlert(userId, alert);
        }
        return false;
    }

    public boolean alertAppliesToDevice(
            Alert alert, long deviceId, long deviceGroupId, List<Long> deviceIds, List<Long> groupIds)
            throws StorageException {
        if (deviceIds.isEmpty() && groupIds.isEmpty()) {
            long ownerId = alert.getCreatedBy();
            return ownerId == 0 || isAdmin(ownerId) || hasPermission(Device.class, ownerId, deviceId);
        }

        if (deviceIds.contains(deviceId) || deviceGroupId > 0 && groupIds.contains(deviceGroupId)) {
            long ownerId = alert.getCreatedBy();
            return ownerId == 0 || isAdmin(ownerId) || hasPermission(Device.class, ownerId, deviceId);
        }
        return false;
    }

    private boolean hasAccessibleTarget(long userId, Alert alert) throws StorageException {
        for (AlertDevice relation : storage.getObjects(AlertDevice.class, new Request(
                new Columns.All(), new Condition.Equals("alertId", alert.getId())))) {
            Long deviceId = relation.getDeviceId();
            Long groupId = relation.getGroupId();
            if (deviceId != null && deviceId > 0 && hasPermission(Device.class, userId, deviceId)
                    || groupId != null && groupId > 0 && hasPermission(Group.class, userId, groupId)) {
                return true;
            }
        }
        for (AlertGeofence relation : storage.getObjects(AlertGeofence.class, new Request(
                new Columns.All(), new Condition.Equals("alertId", alert.getId())))) {
            Long geofenceId = relation.getGeofenceId();
            Long groupId = relation.getGroupId();
            if (geofenceId != null && geofenceId > 0 && hasPermission(Geofence.class, userId, geofenceId)
                    || groupId != null && groupId > 0 && hasPermission(GeofenceFolder.class, userId, groupId)) {
                return true;
            }
        }
        return false;
    }

    private <T extends org.traccar.model.BaseModel> void checkPermission(
            Class<T> clazz, long userId, long objectId) throws StorageException {
        if (!hasPermission(clazz, userId, objectId)) {
            throw new SecurityException(clazz.getSimpleName() + " access denied");
        }
    }

    private <T extends org.traccar.model.BaseModel> boolean hasPermission(
            Class<T> clazz, long userId, long objectId) throws StorageException {
        if (objectId <= 0 || userId <= 0) {
            return false;
        }
        if (isAdmin(userId)) {
            return true;
        }
        return storage.getObject(clazz, new Request(
                new Columns.Include("id"),
                new Condition.And(
                        new Condition.Equals("id", objectId),
                        new Condition.Permission(User.class, userId, clazz)))) != null;
    }

}

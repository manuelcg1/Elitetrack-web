package org.traccar.database;

import jakarta.inject.Inject;
import org.traccar.model.Device;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.Group;
import org.traccar.model.Position;
import org.traccar.model.SpeedAlert;
import org.traccar.model.SpeedAlertDevice;
import org.traccar.model.SpeedAlertGeofence;
import org.traccar.model.SpeedAlertGeofenceGroup;
import org.traccar.model.SpeedAlertLog;
import org.traccar.model.SpeedAlertTelemetry;
import org.traccar.model.SpeedAlertVehicleGroup;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class SpeedAlertEvaluator {

    private final Storage storage;

    @Inject
    public SpeedAlertEvaluator(Storage storage) {
        this.storage = storage;
    }

    public List<SpeedAlertLog> evaluate(SpeedAlertTelemetry telemetry) throws StorageException {
        Position position = new Position();
        position.setDeviceId(telemetry.getDeviceId());
        position.setLatitude(telemetry.getLatitude());
        position.setLongitude(telemetry.getLongitude());
        position.setFixTime(new Date());

        Device device = storage.getObject(Device.class, new Request(
                new Columns.All(), new Condition.Equals("id", telemetry.getDeviceId())));
        long vehicleGroupId = telemetry.getVehicleGroupId();
        if (vehicleGroupId == 0 && device != null) {
            vehicleGroupId = device.getGroupId();
        }

        Group vehicleGroup = vehicleGroupId > 0 ? storage.getObject(Group.class, new Request(
                new Columns.All(), new Condition.Equals("id", vehicleGroupId))) : null;

        Map<Long, GeofenceFolder> folders = loadFolders();
        List<Geofence> containingGeofences = findContainingGeofences(position);
        Map<Long, Set<Long>> geofenceFolders = resolveGeofenceFolders(containingGeofences, folders);

        List<SpeedAlertLog> createdLogs = new ArrayList<>();
        for (SpeedAlert alert : loadAlerts()) {
            if (!alert.getActive() || telemetry.getSpeed() <= alert.getSpeedLimit()) {
                continue;
            }
            hydrateRelations(alert);
            if (!matchesVehicle(alert, telemetry.getDeviceId(), vehicleGroupId)) {
                continue;
            }
            if (hasGeofenceScope(alert)) {
                for (Geofence geofence : containingGeofences) {
                    if (matchesGeofence(alert, geofence.getId(), geofenceFolders.get(geofence.getId()))) {
                        SpeedAlertLog log = buildLog(alert, telemetry, vehicleGroup, geofence);
                        log.setId(storage.addObject(log, new Request(new Columns.Exclude("id"))));
                        createdLogs.add(log);
                    }
                }
            } else {
                SpeedAlertLog log = buildLog(alert, telemetry, vehicleGroup, null);
                log.setId(storage.addObject(log, new Request(new Columns.Exclude("id"))));
                createdLogs.add(log);
            }
        }
        return createdLogs;
    }

    private List<SpeedAlert> loadAlerts() throws StorageException {
        return storage.getObjects(SpeedAlert.class, new Request(new Columns.All()));
    }

    private List<Geofence> findContainingGeofences(Position position) throws StorageException {
        List<Geofence> result = new ArrayList<>();
        for (Geofence geofence : storage.getObjects(Geofence.class, new Request(new Columns.All()))) {
            if (geofence.containsPosition(position)) {
                result.add(geofence);
            }
        }
        return result;
    }

    private Map<Long, GeofenceFolder> loadFolders() throws StorageException {
        Map<Long, GeofenceFolder> result = new LinkedHashMap<>();
        for (GeofenceFolder folder : storage.getObjects(GeofenceFolder.class, new Request(new Columns.All()))) {
            result.put(folder.getId(), folder);
        }
        return result;
    }

    private Map<Long, Set<Long>> resolveGeofenceFolders(
            List<Geofence> geofences, Map<Long, GeofenceFolder> folders) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Geofence geofence : geofences) {
            Set<Long> folderIds = new HashSet<>();
            long folderId = geofence.getLong("folderId");
            while (folderId > 0 && folderIds.add(folderId)) {
                GeofenceFolder folder = folders.get(folderId);
                folderId = folder != null ? folder.getParentid() : 0;
            }
            result.put(geofence.getId(), folderIds);
        }
        return result;
    }

    public void hydrateRelations(SpeedAlert alert) throws StorageException {
        long alertId = alert.getId();
        alert.setDeviceIds(storage.getObjects(SpeedAlertDevice.class, new Request(
                new Columns.All(), new Condition.Equals("alertId", alertId)))
                .stream().map(SpeedAlertDevice::getDeviceId).toList());
        alert.setVehicleGroupIds(storage.getObjects(SpeedAlertVehicleGroup.class, new Request(
                new Columns.All(), new Condition.Equals("alertId", alertId)))
                .stream().map(SpeedAlertVehicleGroup::getGroupId).toList());
        alert.setGeofenceIds(storage.getObjects(SpeedAlertGeofence.class, new Request(
                new Columns.All(), new Condition.Equals("alertId", alertId)))
                .stream().map(SpeedAlertGeofence::getGeofenceId).toList());
        alert.setGeofenceGroupIds(storage.getObjects(SpeedAlertGeofenceGroup.class, new Request(
                new Columns.All(), new Condition.Equals("alertId", alertId)))
                .stream().map(SpeedAlertGeofenceGroup::getGeofenceGroupId).toList());
    }

    private boolean matchesVehicle(SpeedAlert alert, long deviceId, long vehicleGroupId) {
        return alert.getDeviceIds().contains(deviceId)
                || vehicleGroupId > 0 && alert.getVehicleGroupIds().contains(vehicleGroupId);
    }

    private boolean matchesGeofence(SpeedAlert alert, long geofenceId, Set<Long> folderIds) {
        return alert.getGeofenceIds().contains(geofenceId)
                || folderIds != null && folderIds.stream().anyMatch(alert.getGeofenceGroupIds()::contains);
    }

    private boolean hasGeofenceScope(SpeedAlert alert) {
        return !alert.getGeofenceIds().isEmpty() || !alert.getGeofenceGroupIds().isEmpty();
    }

    private SpeedAlertLog buildLog(
            SpeedAlert alert, SpeedAlertTelemetry telemetry, Group vehicleGroup, Geofence geofence) {
        SpeedAlertLog log = new SpeedAlertLog();
        log.setAlertId(alert.getId());
        log.setPlate(telemetry.getPlate());
        log.setLatitude(telemetry.getLatitude());
        log.setLongitude(telemetry.getLongitude());
        log.setDriver(telemetry.getDriver());
        log.setVehicleGroup(vehicleGroup != null ? vehicleGroup.getName() : null);
        log.setGeofenceName(geofence != null ? geofence.getName() : null);
        log.setAlertName(alert.getName());
        log.setRecordedSpeed(telemetry.getSpeed());
        log.setEventTime(new Date());
        return log;
    }

}

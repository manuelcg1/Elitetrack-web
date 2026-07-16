package org.traccar.alert;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.traccar.model.Alert;
import org.traccar.model.AlertDevice;
import org.traccar.model.AlertGeofence;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Singleton
public class AlertCache {

    public record CachedAlert(
            Alert alert, List<Long> deviceIds, List<Long> groupIds,
            List<Long> geofenceIds, List<Long> geofenceGroupIds, List<Geofence> geofences) {
    }

    private static final long CACHE_TTL = 30000;

    private final Storage storage;

    private volatile long cacheTime;
    private volatile List<CachedAlert> alerts;

    @Inject
    public AlertCache(Storage storage) {
        this.storage = storage;
    }

    public List<CachedAlert> getAlerts() throws StorageException {
        long now = System.currentTimeMillis();
        List<CachedAlert> cached = alerts;
        if (cached == null || now - cacheTime > CACHE_TTL) {
            synchronized (this) {
                cached = alerts;
                if (cached == null || now - cacheTime > CACHE_TTL) {
                    cached = loadAlerts();
                    alerts = cached;
                    cacheTime = now;
                }
            }
        }
        return cached;
    }

    public void invalidate() {
        alerts = null;
        cacheTime = 0;
    }

    private List<CachedAlert> loadAlerts() throws StorageException {
        List<Alert> alerts = storage.getObjects(Alert.class, new Request(
                new Columns.All(),
                new Condition.Equals("active", true)));

        Map<Long, List<AlertDevice>> deviceRelations = storage.getObjects(
                AlertDevice.class, new Request(new Columns.All())).stream()
                .collect(Collectors.groupingBy(AlertDevice::getAlertId));
        Map<Long, List<AlertGeofence>> geofenceRelations = storage.getObjects(
                AlertGeofence.class, new Request(new Columns.All())).stream()
                .collect(Collectors.groupingBy(AlertGeofence::getAlertId));

        List<AlertGeofence> scopedGeofenceRelations = alerts.stream()
                .flatMap(alert -> geofenceRelations.getOrDefault(alert.getId(), List.of()).stream())
                .toList();
        boolean hasGeofenceGroupScope = scopedGeofenceRelations.stream()
                .anyMatch(relation -> relation.getGroupId() != null && relation.getGroupId() > 0);

        Map<Long, Geofence> geofences = new LinkedHashMap<>();
        if (!scopedGeofenceRelations.isEmpty()) {
            for (Geofence geofence : storage.getObjects(Geofence.class, new Request(
                    new Columns.Include("id", "area", "attributes")))) {
                geofences.put(geofence.getId(), geofence);
            }
        }

        Map<Long, Set<Long>> geofenceFolders = new LinkedHashMap<>();
        if (hasGeofenceGroupScope) {
            Map<Long, GeofenceFolder> folders = new LinkedHashMap<>();
            for (GeofenceFolder folder : storage.getObjects(GeofenceFolder.class, new Request(
                    new Columns.Include("id", "parentid")))) {
                folders.put(folder.getId(), folder);
            }
            for (Geofence geofence : geofences.values()) {
                Set<Long> folderIds = new HashSet<>();
                long folderId = geofence.getLong("folderId");
                while (folderId > 0 && folderIds.add(folderId)) {
                    GeofenceFolder folder = folders.get(folderId);
                    folderId = folder != null ? folder.getParentid() : 0;
                }
                geofenceFolders.put(geofence.getId(), folderIds);
            }
        }

        List<CachedAlert> result = new ArrayList<>();
        for (Alert alert : alerts) {
            List<AlertDevice> relations = deviceRelations.getOrDefault(alert.getId(), List.of());
            List<AlertGeofence> alertGeofenceRelations =
                    geofenceRelations.getOrDefault(alert.getId(), List.of());
            List<Long> geofenceGroupIds = alertGeofenceRelations.stream()
                    .map(AlertGeofence::getGroupId)
                    .filter(groupId -> groupId != null && groupId > 0)
                    .toList();
            Set<Long> effectiveGeofenceIds = new LinkedHashSet<>(alertGeofenceRelations.stream()
                    .map(AlertGeofence::getGeofenceId)
                    .filter(geofenceId -> geofenceId != null && geofenceId > 0)
                    .toList());
            if (!geofenceGroupIds.isEmpty()) {
                geofenceFolders.forEach((geofenceId, folderIds) -> {
                    if (folderIds.stream().anyMatch(geofenceGroupIds::contains)) {
                        effectiveGeofenceIds.add(geofenceId);
                    }
                });
            }
            List<Geofence> effectiveGeofences = new ArrayList<>();
            for (long geofenceId : effectiveGeofenceIds) {
                Geofence geofence = geofences.get(geofenceId);
                if (geofence != null) {
                    effectiveGeofences.add(geofence);
                }
            }
            result.add(new CachedAlert(
                    alert,
                    relations.stream()
                            .map(AlertDevice::getDeviceId)
                            .filter(deviceId -> deviceId != null && deviceId > 0)
                            .toList(),
                    relations.stream()
                            .map(AlertDevice::getGroupId)
                            .filter(groupId -> groupId != null && groupId > 0)
                            .toList(),
                    List.copyOf(effectiveGeofenceIds),
                    geofenceGroupIds,
                    List.copyOf(effectiveGeofences)));
        }
        return result;
    }

}

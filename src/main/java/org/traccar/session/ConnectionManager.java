/*
 * Copyright 2015 - 2024 Anton Tananaev (anton@traccar.org)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.traccar.session;

import io.netty.channel.Channel;
import io.netty.util.Timeout;
import io.netty.util.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.Protocol;
import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.broadcast.BroadcastInterface;
import org.traccar.broadcast.BroadcastService;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.database.DeviceLookupService;
import org.traccar.database.NotificationManager;
import org.traccar.model.AlertEvent;
import org.traccar.model.BaseModel;
import org.traccar.model.Device;
import org.traccar.model.Event;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.Group;
import org.traccar.model.LogRecord;
import org.traccar.model.ObjectOperation;
import org.traccar.model.Position;
import org.traccar.model.Permission;
import org.traccar.model.User;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.net.InetSocketAddress;
import java.net.SocketAddress;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Singleton
public class ConnectionManager implements BroadcastInterface {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConnectionManager.class);

    private final long deviceTimeout;
    private final boolean showUnknownDevices;

    private final Map<Long, DeviceSession> sessionsByDeviceId = new ConcurrentHashMap<>();
    private final Map<ConnectionKey, Map<String, DeviceSession>> sessionsByEndpoint = new ConcurrentHashMap<>();
    private final Map<ConnectionKey, String> unknownByEndpoint = new ConcurrentHashMap<>();

    private final Config config;
    private final CacheManager cacheManager;
    private final Storage storage;
    private final NotificationManager notificationManager;
    private final Timer timer;
    private final BroadcastService broadcastService;
    private final DeviceLookupService deviceLookupService;
    private final GeofenceReadAccessService geofenceReadAccessService;

    private final Map<Long, Set<UpdateListener>> listeners = new HashMap<>();
    private final Map<Long, Set<Long>> userDevices = new HashMap<>();
    private final Map<Long, Set<Long>> deviceUsers = new HashMap<>();
    private final Map<Long, Set<Long>> userGeofences = new HashMap<>();
    private final Map<Long, Long> permissionRefreshTimes = new HashMap<>();
    private final Map<Long, Long> permissionGenerations = new HashMap<>();
    private long nextPermissionGeneration;
    private static final long PERMISSION_REFRESH_INTERVAL = 30000;

    private record PermissionReload(long userId, long generation) {
    }

    private record PermissionSnapshot(Set<Long> devices, Set<Long> geofences, long refreshTime) {
    }

    private final Map<Long, Timeout> timeouts = new ConcurrentHashMap<>();

    @Inject
    public ConnectionManager(
            Config config, CacheManager cacheManager, Storage storage,
            NotificationManager notificationManager, Timer timer, BroadcastService broadcastService,
            DeviceLookupService deviceLookupService, GeofenceReadAccessService geofenceReadAccessService) {
        this.config = config;
        this.cacheManager = cacheManager;
        this.storage = storage;
        this.notificationManager = notificationManager;
        this.timer = timer;
        this.broadcastService = broadcastService;
        this.deviceLookupService = deviceLookupService;
        this.geofenceReadAccessService = geofenceReadAccessService;
        deviceTimeout = config.getLong(Keys.STATUS_TIMEOUT);
        showUnknownDevices = config.getBoolean(Keys.WEB_SHOW_UNKNOWN_DEVICES);
        broadcastService.registerListener(this);
    }

    public DeviceSession getDeviceSession(long deviceId) {
        return sessionsByDeviceId.get(deviceId);
    }

    public DeviceSession getDeviceSession(
            Protocol protocol, Channel channel, SocketAddress remoteAddress,
            String... uniqueIds) throws Exception {

        ConnectionKey connectionKey = new ConnectionKey(channel, remoteAddress);
        Map<String, DeviceSession> endpointSessions = sessionsByEndpoint.getOrDefault(
                connectionKey, new ConcurrentHashMap<>());

        uniqueIds = Arrays.stream(uniqueIds).filter(Objects::nonNull).toArray(String[]::new);
        if (uniqueIds.length > 0) {
            for (String uniqueId : uniqueIds) {
                DeviceSession deviceSession = endpointSessions.get(uniqueId);
                if (deviceSession != null) {
                    return deviceSession;
                }
            }
        } else {
            return endpointSessions.values().stream().findAny().orElse(null);
        }

        Device device = deviceLookupService.lookup(uniqueIds);

        String firstUniqueId = uniqueIds[0];
        if (device == null && config.getBoolean(Keys.DATABASE_REGISTER_UNKNOWN)) {
            if (firstUniqueId.matches(config.getString(Keys.DATABASE_REGISTER_UNKNOWN_REGEX))) {
                device = addUnknownDevice(firstUniqueId);
            }
        }

        if (device != null) {
            unknownByEndpoint.remove(connectionKey);
            device.checkDisabled();

            DeviceSession oldSession = sessionsByDeviceId.remove(device.getId());
            if (oldSession != null) {
                Map<String, DeviceSession> oldEndpointSessions = sessionsByEndpoint.get(oldSession.getConnectionKey());
                if (oldEndpointSessions != null && oldEndpointSessions.size() > 1) {
                    oldEndpointSessions.remove(device.getUniqueId());
                } else {
                    sessionsByEndpoint.remove(oldSession.getConnectionKey());
                }
            }

            DeviceSession deviceSession = new DeviceSession(
                    device.getId(), device.getUniqueId(), device.getModel(), protocol, channel, remoteAddress);
            endpointSessions.put(device.getUniqueId(), deviceSession);
            sessionsByEndpoint.put(connectionKey, endpointSessions);
            sessionsByDeviceId.put(device.getId(), deviceSession);

            if (oldSession == null) {
                cacheManager.addDevice(device.getId(), connectionKey);
            }

            return deviceSession;
        } else {
            unknownByEndpoint.put(connectionKey, firstUniqueId);
            LOGGER.warn("Unknown device - " + String.join(" ", uniqueIds)
                    + " (" + ((InetSocketAddress) remoteAddress).getHostString() + ")");
            return null;
        }
    }

    private Device addUnknownDevice(String uniqueId) {
        Device device = new Device();
        device.setName(uniqueId);
        device.setUniqueId(uniqueId);
        device.setCategory(config.getString(Keys.DATABASE_REGISTER_UNKNOWN_DEFAULT_CATEGORY));

        long defaultGroupId = config.getLong(Keys.DATABASE_REGISTER_UNKNOWN_DEFAULT_GROUP_ID);
        if (defaultGroupId != 0) {
            device.setGroupId(defaultGroupId);
        }

        try {
            device.setId(storage.addObject(device, new Request(new Columns.Exclude("id"))));
            LOGGER.info("Automatically registered " + uniqueId);
            return device;
        } catch (StorageException e) {
            LOGGER.warn("Automatic registration failed", e);
            return null;
        }
    }

    public void deviceDisconnected(Channel channel, boolean supportsOffline) {
        SocketAddress remoteAddress = channel.remoteAddress();
        if (remoteAddress != null) {
            ConnectionKey connectionKey = new ConnectionKey(channel, remoteAddress);
            Map<String, DeviceSession> endpointSessions = sessionsByEndpoint.remove(connectionKey);
            if (endpointSessions != null) {
                for (DeviceSession deviceSession : endpointSessions.values()) {
                    if (supportsOffline) {
                        updateDevice(deviceSession.getDeviceId(), Device.STATUS_OFFLINE, null);
                    }
                    sessionsByDeviceId.remove(deviceSession.getDeviceId());
                    cacheManager.removeDevice(deviceSession.getDeviceId(), connectionKey);
                }
            }
            unknownByEndpoint.remove(connectionKey);
        }
    }

    public void deviceUnknown(long deviceId) {
        updateDevice(deviceId, Device.STATUS_UNKNOWN, null);
        removeDeviceSession(deviceId);
    }

    private void removeDeviceSession(long deviceId) {
        DeviceSession deviceSession = sessionsByDeviceId.remove(deviceId);
        if (deviceSession != null) {
            ConnectionKey connectionKey = deviceSession.getConnectionKey();
            cacheManager.removeDevice(deviceId, connectionKey);
            sessionsByEndpoint.computeIfPresent(connectionKey, (e, sessions) -> {
                sessions.remove(deviceSession.getUniqueId());
                return sessions.isEmpty() ? null : sessions;
            });
        }
    }

    public void updateDevice(long deviceId, String status, Date time) {
        Device device = cacheManager.getObject(Device.class, deviceId);
        if (device == null) {
            try {
                device = storage.getObject(Device.class, new Request(
                        new Columns.All(), new Condition.Equals("id", deviceId)));
            } catch (StorageException e) {
                LOGGER.warn("Failed to get device", e);
            }
            if (device == null) {
                return;
            }
        }

        String oldStatus = device.getStatus();
        device.setStatus(status);

        if (!status.equals(oldStatus)) {
            String eventType;
            Map<Event, Position> events = new HashMap<>();
            eventType = switch (status) {
                case Device.STATUS_ONLINE -> Event.TYPE_DEVICE_ONLINE;
                case Device.STATUS_UNKNOWN -> Event.TYPE_DEVICE_UNKNOWN;
                default -> Event.TYPE_DEVICE_OFFLINE;
            };
            events.put(new Event(eventType, deviceId), null);
            notificationManager.updateEvents(events);
        }

        if (time != null) {
            device.setLastUpdate(time);
        }

        Timeout timeout = timeouts.remove(deviceId);
        if (timeout != null) {
            timeout.cancel();
        }

        if (status.equals(Device.STATUS_ONLINE)) {
            timeouts.put(deviceId, timer.newTimeout(timeout1 -> {
                if (!timeout1.isCancelled()) {
                    deviceUnknown(deviceId);
                }
            }, deviceTimeout, TimeUnit.SECONDS));
        }

        try {
            storage.updateObject(device, new Request(
                    new Columns.Include("status", "lastUpdate"),
                    new Condition.Equals("id", deviceId)));
        } catch (StorageException e) {
            LOGGER.warn("Update device status error", e);
        }

        updateDevice(true, device);
    }

    public void sendKeepalive() {
        refreshExpiredPermissions();
        dispatchKeepalive();
    }

    private synchronized void dispatchKeepalive() {
        for (Set<UpdateListener> userListeners : listeners.values()) {
            for (UpdateListener listener : userListeners) {
                listener.onKeepalive();
            }
        }
    }

    @Override
    public void updateDevice(boolean local, Device device) {
        refreshExpiredPermissions();
        dispatchDevice(local, device);
    }

    private synchronized void dispatchDevice(boolean local, Device device) {
        if (local) {
            broadcastService.updateDevice(true, device);
        } else if (Device.STATUS_ONLINE.equals(device.getStatus())) {
            timeouts.remove(device.getId());
            removeDeviceSession(device.getId());
        }
        for (long userId : deviceUsers.getOrDefault(device.getId(), Collections.emptySet())) {
            if (listeners.containsKey(userId)) {
                for (UpdateListener listener : listeners.get(userId)) {
                    listener.onUpdateDevice(device);
                }
            }
        }
    }

    @Override
    public void updatePosition(boolean local, Position position) {
        refreshExpiredPermissions();
        dispatchPosition(local, position);
    }

    private synchronized void dispatchPosition(boolean local, Position position) {
        if (local) {
            broadcastService.updatePosition(true, position);
        }
        for (long userId : deviceUsers.getOrDefault(position.getDeviceId(), Collections.emptySet())) {
            if (listeners.containsKey(userId)) {
                for (UpdateListener listener : listeners.get(userId)) {
                    listener.onUpdatePosition(position);
                }
            }
        }
    }

    @Override
    public synchronized void updateEvent(boolean local, long userId, Event event) {
        if (local) {
            broadcastService.updateEvent(true, userId, event);
        }
        if (listeners.containsKey(userId)) {
            for (UpdateListener listener : listeners.get(userId)) {
                listener.onUpdateEvent(event);
            }
        }
    }

    @Override
    public void updateAlertEvent(boolean local, AlertEvent event) {
        refreshExpiredPermissions();
        dispatchAlertEvent(local, event);
    }

    private synchronized void dispatchAlertEvent(boolean local, AlertEvent event) {
        if (local) {
            broadcastService.updateAlertEvent(true, event);
        }
        for (long userId : deviceUsers.getOrDefault(event.getDeviceId(), Collections.emptySet())) {
            if (event.getGeofenceId() > 0
                    && !userGeofences.getOrDefault(userId, Collections.emptySet()).contains(event.getGeofenceId())) {
                continue;
            }
            for (UpdateListener listener : listeners.getOrDefault(userId, Collections.emptySet())) {
                listener.onUpdateAlertEvent(event);
            }
        }
    }

    @Override
    public <T1 extends BaseModel, T2 extends BaseModel> void invalidatePermission(
            boolean local, Class<T1> clazz1, long id1, Class<T2> clazz2, long id2, boolean link) {
        if (clazz1.equals(User.class) && (clazz2.equals(Device.class) || clazz2.equals(Group.class)
                || clazz2.equals(Geofence.class) || clazz2.equals(GeofenceFolder.class))) {
            refreshPermissions(List.of(id1), false);
        }
    }

    public void invalidatePermissions(Collection<Permission> changes) {
        Set<Long> users = new HashSet<>();
        for (Permission permission : changes) {
            Class<?> property = permission.getPropertyClass();
            if (permission.getOwnerClass().equals(User.class) && (property.equals(Device.class)
                    || property.equals(Group.class) || property.equals(Geofence.class)
                    || property.equals(GeofenceFolder.class))) {
                users.add(permission.getOwnerId());
            }
        }
        refreshPermissions(users, false);
    }

    @Override
    public <T extends BaseModel> void invalidateObject(
            boolean local, Class<T> clazz, long id, ObjectOperation operation) {
        if (clazz.equals(User.class)) {
            refreshPermissions(List.of(id), false);
        } else if (clazz.equals(Geofence.class) || clazz.equals(GeofenceFolder.class)
                || clazz.equals(Device.class) || clazz.equals(Group.class)) {
            refreshPermissions(connectedUserIds(), false);
        }
    }

    private void refreshExpiredPermissions() {
        refreshPermissions(connectedUserIds(), true);
    }

    private synchronized List<Long> connectedUserIds() {
        return List.copyOf(listeners.keySet());
    }

    private synchronized List<PermissionReload> beginPermissionReloads(Collection<Long> userIds, boolean expiredOnly) {
        List<PermissionReload> reloads = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (long userId : userIds) {
            if (listeners.containsKey(userId)
                    && (!expiredOnly || now >= permissionRefreshTimes.getOrDefault(userId, 0L))) {
                // Revoke all affected snapshots before starting any SQL.
                clearPermissions(userId);
                long generation = ++nextPermissionGeneration;
                permissionGenerations.put(userId, generation);
                permissionRefreshTimes.put(userId, Long.MAX_VALUE);
                reloads.add(new PermissionReload(userId, generation));
            }
        }
        return reloads;
    }

    private void clearPermissions(long userId) {
        for (long deviceId : userDevices.getOrDefault(userId, Set.of())) {
            deviceUsers.computeIfPresent(deviceId, (id, users) -> {
                users.remove(userId);
                return users.isEmpty() ? null : users;
            });
        }
        userDevices.remove(userId);
        userGeofences.remove(userId);
        permissionRefreshTimes.remove(userId);
    }

    private PermissionSnapshot readPermissions(long userId) throws StorageException {
        // No session monitor is held during database access.
        User user = storage.getObject(User.class, new Request(
                new Columns.All(), new Condition.Equals("id", userId)));
        if (user == null) {
            throw new SecurityException("User access required");
        }
        user.checkDisabled();
        var devices = storage.getObjects(Device.class, new Request(
                new Columns.Include("id"), new Condition.Permission(User.class, userId, Device.class)));
        Set<Long> geofences = geofenceReadAccessService.getReadableGeofenceIds(userId);
        user.checkDisabled();
        long refreshTime = System.currentTimeMillis() + PERMISSION_REFRESH_INTERVAL;
        if (user.getExpirationTime() != null) {
            refreshTime = Math.min(refreshTime, user.getExpirationTime().getTime());
        }
        return new PermissionSnapshot(devices.stream().map(BaseModel::getId).collect(Collectors.toUnmodifiableSet()),
                Set.copyOf(geofences), refreshTime);
    }

    private synchronized void completePermissionReload(PermissionReload reload, PermissionSnapshot snapshot) {
        long userId = reload.userId();
        if (listeners.containsKey(userId) && permissionGenerations.getOrDefault(userId, 0L) == reload.generation()) {
            if (snapshot != null && snapshot.refreshTime() > System.currentTimeMillis()) {
                userDevices.put(userId, snapshot.devices());
                snapshot.devices().forEach(deviceId ->
                        deviceUsers.computeIfAbsent(deviceId, id -> new HashSet<>()).add(userId));
                userGeofences.put(userId, snapshot.geofences());
                permissionRefreshTimes.put(userId, snapshot.refreshTime());
            } else {
                permissionRefreshTimes.put(userId, System.currentTimeMillis() + PERMISSION_REFRESH_INTERVAL);
            }
        }
    }

    private void reloadPermissions(PermissionReload reload) throws StorageException {
        try {
            completePermissionReload(reload, readPermissions(reload.userId()));
        } catch (StorageException | RuntimeException e) {
            completePermissionReload(reload, null);
            throw e;
        }
    }

    private void refreshPermissions(Collection<Long> userIds, boolean expiredOnly) {
        for (var reload : beginPermissionReloads(userIds, expiredOnly)) {
            try {
                reloadPermissions(reload);
            } catch (StorageException | RuntimeException e) {
                LOGGER.warn("Session permissions unavailable for user {}", reload.userId(), e);
            }
        }
    }

    public void updateLog(LogRecord record) {
        refreshExpiredPermissions();
        dispatchLog(record);
    }

    private synchronized void dispatchLog(LogRecord record) {
        var sessions = sessionsByEndpoint.getOrDefault(record.getConnectionKey(), Map.of());
        if (sessions.isEmpty()) {
            String unknownUniqueId = unknownByEndpoint.get(record.getConnectionKey());
            if (unknownUniqueId != null && showUnknownDevices) {
                record.setUniqueId(unknownUniqueId);
                listeners.values().stream()
                        .flatMap(Set::stream)
                        .forEach((listener) -> listener.onUpdateLog(record));
            }
        } else {
            var firstEntry = sessions.entrySet().iterator().next();
            record.setUniqueId(firstEntry.getKey());
            record.setDeviceId(firstEntry.getValue().getDeviceId());
            for (long userId : deviceUsers.getOrDefault(record.getDeviceId(), Set.of())) {
                for (UpdateListener listener : listeners.getOrDefault(userId, Set.of())) {
                    listener.onUpdateLog(record);
                }
            }
        }
    }

    public interface UpdateListener {
        void onKeepalive();
        void onUpdateDevice(Device device);
        void onUpdatePosition(Position position);
        void onUpdateEvent(Event event);
        void onUpdateAlertEvent(AlertEvent event);
        void onUpdateLog(LogRecord record);
    }

    public void addListener(long userId, UpdateListener listener) throws StorageException {
        List<PermissionReload> reloads;
        synchronized (this) {
            listeners.computeIfAbsent(userId, id -> new HashSet<>()).add(listener);
            reloads = beginPermissionReloads(List.of(userId), true);
        }
        try {
            for (var reload : reloads) {
                reloadPermissions(reload);
            }
        } catch (StorageException | RuntimeException e) {
            removeListener(userId, listener);
            throw e;
        }
    }

    public synchronized void removeListener(long userId, UpdateListener listener) {
        var set = listeners.get(userId);
        if (set == null) {
            return;
        }
        set.remove(listener);
        if (set.isEmpty()) {
            listeners.remove(userId);

            clearPermissions(userId);
            permissionGenerations.remove(userId);
        }
    }

}

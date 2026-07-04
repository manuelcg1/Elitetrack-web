package org.traccar.forward;

import jakarta.annotation.Nullable;
import jakarta.inject.Inject;
import org.traccar.model.DeviceForwardServer;
import org.traccar.model.ForwardServer;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

public class CatalogPositionForwarder implements PositionForwarder {

    private static final Logger LOGGER = Logger.getLogger(CatalogPositionForwarder.class.getName());

    private final Storage storage;
    private final MultiDestinationJsonForwarder multiDestinationJsonForwarder;

    private volatile Map<Long, ForwardServer> servers = Map.of();
    private volatile Map<Long, List<DeviceForwardServer>> deviceServers = Map.of();

    @Nullable
    private PositionForwarder delegate;

    @Inject
    public CatalogPositionForwarder(Storage storage, MultiDestinationJsonForwarder multiDestinationJsonForwarder) {
        this.storage = storage;
        this.multiDestinationJsonForwarder = multiDestinationJsonForwarder;
        reload();
    }

    public void setDelegate(@Nullable PositionForwarder delegate) {
        this.delegate = delegate;
    }

    public synchronized void reload() {
        try {
            var loadedServers = storage.getObjects(ForwardServer.class, new Request(new Columns.All())).stream()
                    .filter(ForwardServer::getActive)
                    .collect(Collectors.toUnmodifiableMap(ForwardServer::getId, server -> server));
            Set<Long> activeServerIds = loadedServers.keySet();
            var loadedAssignments = storage.getObjects(
                    DeviceForwardServer.class, new Request(new Columns.All())).stream()
                    .filter(assignment -> activeServerIds.contains(assignment.getServerId()))
                    .collect(Collectors.groupingBy(
                            DeviceForwardServer::getDeviceId,
                            ConcurrentHashMap::new,
                            Collectors.toList()));
            servers = loadedServers;
            deviceServers = loadedAssignments;
        } catch (StorageException e) {
            throw new RuntimeException("Forward server catalog reload failed", e);
        }
    }

    @Override
    public void forward(PositionData positionData, ResultHandler resultHandler) {
        List<DeviceForwardServer> assignments = deviceServers.getOrDefault(
                positionData.getDevice().getId(), List.of());
        List<ForwardServer> targets = assignments
                .stream()
                .map(assignment -> servers.get(assignment.getServerId()))
                .filter(server -> server != null)
                .toList();

        PositionForwarder currentDelegate = delegate;
        if (targets.isEmpty()) {
            if (currentDelegate != null) {
                currentDelegate.forward(positionData, resultHandler);
            } else {
                resultHandler.onResult(true, null);
            }
            return;
        }

        multiDestinationJsonForwarder.forward(
                targets,
                positionData,
                (success, throwable) -> {
                    if (currentDelegate != null && success) {
                        currentDelegate.forward(positionData, resultHandler);
                    } else {
                        resultHandler.onResult(success, throwable);
                    }
                },
                server -> assignments.stream()
                        .filter(assignment -> assignment.getServerId() == server.getId())
                        .findFirst()
                        .ifPresent(assignment -> updateLastSent(assignment.getId())));
    }

    private void updateLastSent(long assignmentId) {
        try {
            DeviceForwardServer assignment = new DeviceForwardServer();
            assignment.setLastSent(new Date());
            storage.updateObject(
                    assignment,
                    new Request(
                            new Columns.Include("lastSent"),
                            new Condition.Equals("id", assignmentId)));
        } catch (StorageException e) {
            LOGGER.log(Level.WARNING, "Forward server last sent update failed", e);
        }
    }

}

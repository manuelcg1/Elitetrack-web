package org.traccar.forward;

import jakarta.annotation.Nullable;
import jakarta.inject.Inject;
import org.traccar.model.DeviceForwardServer;
import org.traccar.model.ForwardServer;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Request;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public class CatalogPositionForwarder implements PositionForwarder {

    private final Storage storage;
    private final MultiDestinationJsonForwarder multiDestinationJsonForwarder;

    private volatile Map<Long, ForwardServer> servers = Map.of();
    private volatile Map<Long, List<Long>> deviceServers = Map.of();

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
                            Collectors.mapping(DeviceForwardServer::getServerId, Collectors.toList())));
            servers = loadedServers;
            deviceServers = loadedAssignments;
        } catch (StorageException e) {
            throw new RuntimeException("Forward server catalog reload failed", e);
        }
    }

    @Override
    public void forward(PositionData positionData, ResultHandler resultHandler) {
        List<ForwardServer> targets = deviceServers
                .getOrDefault(positionData.getDevice().getId(), List.of())
                .stream()
                .map(servers::get)
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

        multiDestinationJsonForwarder.forward(targets, positionData, (success, throwable) -> {
            if (currentDelegate != null && success) {
                currentDelegate.forward(positionData, resultHandler);
            } else {
                resultHandler.onResult(success, throwable);
            }
        });
    }

}

package org.traccar.forward.sutran;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.ws.rs.client.Client;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.forward.PositionData;
import org.traccar.model.ForwardDelivery;
import org.traccar.model.ForwardServer;
import org.traccar.model.DeviceForwardServer;
import org.traccar.model.Position;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Order;
import org.traccar.storage.query.Request;

import java.util.Date;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

@Singleton
public class SutranDeliveryQueue {

    @FunctionalInterface
    interface Sender {
        void send(
                ForwardServer server, SutranTransmissionRequest request,
                java.util.function.Consumer<SutranSendResult> handler);
    }

    @FunctionalInterface
    interface TrackedSender {
        void send(ForwardServer server, SutranTransmissionRequest request,
                java.util.function.IntPredicate beforeAttempt,
                java.util.function.Consumer<SutranSendResult> handler);
    }

    private static final Logger LOGGER = LoggerFactory.getLogger(SutranDeliveryQueue.class);
    private static final int RECOVERY_LIMIT = 1000;
    private static final long MAXIMUM_RETRY_DELAY = 60000;
    private static final long INVALID_ID_LOG_INTERVAL = 60000;

    private final Storage storage;
    private final ObjectMapper objectMapper;
    private final TrackedSender sender;
    private final ScheduledExecutorService scheduler;
    private final java.util.Set<Long> activeDeliveries = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final java.util.Set<Long> knownUnsentDeliveries = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private final java.util.Map<Long, Runnable> deferredDeliveries = new java.util.concurrent.ConcurrentHashMap<>();
    private final AtomicBoolean recoveryScheduled = new AtomicBoolean();
    private final SutranPayloadMapper payloadMapper = new SutranPayloadMapper();
    private final AtomicBoolean recovering = new AtomicBoolean();
    private final java.util.concurrent.atomic.AtomicLong invalidIdLogTime =
            new java.util.concurrent.atomic.AtomicLong();
    private final boolean transmissionAllowed;
    private record Lane(long serverId, String plate) { }
    private final SutranOrderedDispatcher<Lane> dispatcher;

    @Inject
    public SutranDeliveryQueue(
            Storage storage, Client client, ObjectMapper objectMapper, ScheduledExecutorService scheduler,
            SutranTokenCipher tokenCipher, Config config, java.util.concurrent.ExecutorService executor) {
        this.storage = storage;
        this.objectMapper = objectMapper;
        this.scheduler = scheduler;
        this.dispatcher = new SutranOrderedDispatcher<>(executor);
        this.transmissionAllowed = config.getBoolean(Keys.SUTRAN_TRANSMISSION_ENABLED);
        this.sender = (server, request, beforeAttempt, handler) -> {
            ForwardServer current;
            try {
                current = storage.getObject(ForwardServer.class,
                        new Request(new Columns.All(), new Condition.Equals("id", server.getId())));
            } catch (StorageException e) {
                handler.accept(new SutranSendResult(new SutranDeliveryResult(
                        SutranDeliveryResult.Status.RETRY, 0, null, null,
                        "Unable to verify SUTRAN destination before sending"), 0));
                return;
            }
            if (current == null || !current.getActive() || !current.getTransmissionEnabled()
                    || !ForwardServer.TYPE_SUTRAN_V2.equals(current.getType())) {
                handler.accept(new SutranSendResult(new SutranDeliveryResult(
                        SutranDeliveryResult.Status.REJECTED, 0, null, null,
                        "SUTRAN destination disabled before sending"), 0));
                return;
            }
            SutranClient sutranClient = new SutranClient(
                    client, objectMapper, scheduler, SutranEnvironment.valueOf(current.getEnvironment()),
                    tokenCipher.decrypt(current.getApiKey()), current.getConnectTimeout(), current.getReadTimeout(),
                    current.getMaxAttempts(), current.getRetryDelay(), MAXIMUM_RETRY_DELAY);
            sutranClient.sendTracked(request, beforeAttempt, handler);
        };
    }

    SutranDeliveryQueue(Storage storage, ObjectMapper objectMapper, Sender sender) {
        this(storage, objectMapper, sender, true);
    }

    SutranDeliveryQueue(Storage storage, ObjectMapper objectMapper, Sender sender, boolean transmissionAllowed) {
        this(storage, objectMapper, (server, request, beforeAttempt, handler) -> {
            if (beforeAttempt.test(1)) {
                sender.send(server, request, handler);
            }
        }, transmissionAllowed, null, Runnable::run);
    }

    SutranDeliveryQueue(Storage storage, ObjectMapper objectMapper, TrackedSender sender,
            boolean transmissionAllowed, ScheduledExecutorService scheduler, java.util.concurrent.Executor executor) {
        this.storage = storage;
        this.objectMapper = objectMapper;
        this.sender = sender;
        this.scheduler = scheduler;
        this.dispatcher = new SutranOrderedDispatcher<>(executor);
        this.transmissionAllowed = transmissionAllowed;
    }

    public boolean isTransmissionAllowed() {
        return transmissionAllowed;
    }

    public void recover() {
        if (!transmissionAllowed) {
            return;
        }
        if (!recovering.compareAndSet(false, true)) {
            return;
        }
        try {
            // Keep the lane occupied while a known-unsent predecessor waits for storage recovery.
            // Snapshot prevents one failed retry from being attempted repeatedly in the same sweep.
            for (var entry : new java.util.ArrayList<>(deferredDeliveries.entrySet())) {
                if (deferredDeliveries.remove(entry.getKey(), entry.getValue())) {
                    entry.getValue().run();
                }
            }
            Condition condition = new Condition.Or(
                    new Condition.Equals("status", ForwardDelivery.STATUS_PENDING),
                    new Condition.Equals("status", ForwardDelivery.STATUS_PROCESSING));
            long lastId = 0;
            while (true) {
                // Keyset pagination stays stable while callbacks change delivery statuses.
                var page = storage.getObjects(ForwardDelivery.class, new Request(new Columns.All(),
                        new Condition.And(condition, new Condition.Compare("id", ">", lastId)),
                        new Order("id", false, RECOVERY_LIMIT)));
                if (page.isEmpty()) {
                    break;
                }
                for (ForwardDelivery delivery : page) {
                    lastId = Math.max(lastId, delivery.getId());
                    recoverDelivery(delivery.getId());
                }
            }
        } catch (StorageException e) {
            LOGGER.warn("SUTRAN delivery recovery failed");
        } finally {
            recovering.set(false);
            scheduleRecovery();
        }
    }

    private void scheduleRecovery() {
        if (scheduler != null && recoveryScheduled.compareAndSet(false, true)) {
            try {
                scheduler.schedule(() -> {
                    recoveryScheduled.set(false);
                    recover();
                }, 30, java.util.concurrent.TimeUnit.SECONDS);
            } catch (java.util.concurrent.RejectedExecutionException e) {
                recoveryScheduled.set(false);
                LOGGER.warn("SUTRAN recovery scheduler unavailable; restart recovery required");
            }
        }
    }

    private void recoverDelivery(long id) throws StorageException {
        if (!activeDeliveries.add(id)) {
            return;
        }
        boolean dispatched = false;
        try {
            // Re-read after reserving: a callback may have committed since the page was read.
            ForwardDelivery delivery = storage.getObject(ForwardDelivery.class,
                    new Request(new Columns.All(), new Condition.Equals("id", id)));
            if (delivery == null) {
                knownUnsentDeliveries.remove(id);
                return;
            }
            if (knownUnsentDeliveries.contains(id) && ForwardDelivery.STATUS_PROCESSING.equals(delivery.getStatus())) {
                // This process observed the preflight failure before HTTP. After a restart this
                // in-memory evidence is gone, so PROCESSING remains conservatively uncertain.
                delivery.setStatus(ForwardDelivery.STATUS_PENDING);
                if (!update(delivery, new Columns.Include("status"))) {
                    return;
                }
            }
            if (ForwardDelivery.STATUS_PROCESSING.equals(delivery.getStatus())) {
                quarantineInterruptedDelivery(delivery);
            } else if (ForwardDelivery.STATUS_PENDING.equals(delivery.getStatus())) {
                ForwardServer server = storage.getObject(ForwardServer.class,
                        new Request(new Columns.All(), new Condition.Equals("id", delivery.getServerId())));
                if (server != null && server.getActive() && server.getTransmissionEnabled()
                        && ForwardServer.TYPE_SUTRAN_V2.equals(server.getType())) {
                    sendReserved(server, delivery);
                    dispatched = true;
                }
            }
        } finally {
            if (!dispatched) {
                activeDeliveries.remove(id);
            }
        }
    }

    private void quarantineInterruptedDelivery(ForwardDelivery delivery) {
        // Single-instance startup only: the previous process may have sent this record.
        // Keep all available evidence; lack of a durable acknowledgement is not proof of rejection.
        delivery.setStatus(ForwardDelivery.STATUS_FAILED);
        delivery.setErrorMessage(ForwardDelivery.ERROR_ACKNOWLEDGEMENT_UNKNOWN);
        delivery.setNextAttempt(null);
        delivery.setUpdatedTime(new Date());
        update(delivery, new Columns.Include("status", "errorMessage", "nextAttempt", "updatedTime"));
        LOGGER.warn("SUTRAN delivery {} requires acknowledgement reconciliation; automatic resend blocked",
                delivery.getId());
    }

    public boolean enqueue(ForwardServer server, PositionData positionData) {
        if (!transmissionAllowed) {
            return false;
        }
        long positionId = positionData.getPosition().getId();
        if (positionId <= 0) {
            logInvalidPositionId(server, positionData);
            return false;
        }
        if (alreadyQueued(positionId, server.getId())) {
            return true;
        }

        ForwardDelivery delivery = new ForwardDelivery();
        Date now = new Date();
        delivery.setPositionId(positionId);
        delivery.setServerId(server.getId());
        delivery.setStatus(ForwardDelivery.STATUS_PENDING);
        delivery.setAttempts(0);
        delivery.setCreatedTime(now);
        delivery.setUpdatedTime(now);
        try {
            delivery.setPayload(objectMapper.writeValueAsString(payloadMapper.map(positionData)));
        } catch (IllegalArgumentException | JsonProcessingException e) {
            delivery.setStatus(ForwardDelivery.STATUS_REJECTED);
            delivery.setPayload("{}");
            delivery.setErrorMessage("SUTRAN position validation or serialization failed");
        }

        try {
            delivery.setId(storage.addObject(delivery, new Request(new Columns.Exclude("id"))));
            if (ForwardDelivery.STATUS_PENDING.equals(delivery.getStatus())) {
                send(server, delivery);
            }
            return true;
        } catch (StorageException e) {
            LOGGER.warn("SUTRAN delivery could not be queued for position {}", positionId);
            return alreadyQueued(positionId, server.getId());
        }
    }

    private void logInvalidPositionId(ForwardServer server, PositionData positionData) {
        long now = System.currentTimeMillis();
        long previous = invalidIdLogTime.get();
        if (now - previous >= INVALID_ID_LOG_INTERVAL && invalidIdLogTime.compareAndSet(previous, now)) {
            LOGGER.warn(
                    "SUTRAN delivery not queued: deviceId={}, serverId={}, reason=position has no persisted id",
                    positionData.getDevice() != null ? positionData.getDevice().getId() : 0,
                    server.getId());
        }
    }

    private boolean alreadyQueued(long positionId, long serverId) {
        try {
            Condition condition = new Condition.And(
                    new Condition.Equals("positionId", positionId),
                    new Condition.Equals("serverId", serverId));
            return storage.getObject(
                    ForwardDelivery.class, new Request(new Columns.Include("id"), condition)) != null;
        } catch (StorageException e) {
            return false;
        }
    }

    private void send(ForwardServer server, ForwardDelivery delivery) {
        if (!activeDeliveries.add(delivery.getId())) {
            return;
        }
        try {
            var current = storage.getObject(ForwardDelivery.class,
                    new Request(new Columns.All(), new Condition.Equals("id", delivery.getId())));
            if (current != null && ForwardDelivery.STATUS_PENDING.equals(current.getStatus())) {
                sendReserved(server, current);
                return;
            }
        } catch (StorageException e) {
            LOGGER.warn("SUTRAN delivery could not be verified before dispatch");
        }
        activeDeliveries.remove(delivery.getId());
    }

    private void sendReserved(ForwardServer server, ForwardDelivery delivery) {
        SutranTransmissionRequest request;
        try {
            request = objectMapper.readValue(delivery.getPayload(), SutranTransmissionRequest.class);
        } catch (JsonProcessingException e) {
            updateRejected(delivery, "Stored SUTRAN payload is invalid");
            activeDeliveries.remove(delivery.getId());
            return;
        }

        dispatcher.submit(new Lane(server.getId(), request.getPlate()), laneCompleted -> {
            Runnable completed = () -> {
                deferredDeliveries.remove(delivery.getId());
                activeDeliveries.remove(delivery.getId());
                laneCompleted.run();
            };
            try {
                sendOrdered(server, delivery, request, completed);
            } catch (RuntimeException e) {
                updateRejected(delivery, "SUTRAN dispatch failed before acknowledgement");
                completed.run();
            }
        }, () -> activeDeliveries.remove(delivery.getId()));
    }

    private void sendOrdered(ForwardServer server, ForwardDelivery delivery,
            SutranTransmissionRequest request, Runnable completed) {
        delivery.setStatus(ForwardDelivery.STATUS_PROCESSING);
        delivery.setUpdatedTime(new Date());
        if (!update(delivery, new Columns.Include("status", "updatedTime"))) {
            // Never put an HTTP request on the wire without a durable in-flight marker.
            deferUnsent(server, delivery, request, completed);
            return;
        }

        try {
            int initialAttempts = delivery.getAttempts();
            sender.send(server, request, attempt -> {
                int previous = delivery.getAttempts();
                delivery.setAttempts(initialAttempts + attempt);
                delivery.setUpdatedTime(new Date());
                if (!update(delivery, new Columns.Include("attempts", "updatedTime"))) {
                    delivery.setAttempts(previous);
                    return false;
                }
                knownUnsentDeliveries.remove(delivery.getId());
                return true;
            }, result -> {
                try {
                    updateResult(delivery, result);
                } finally {
                    if (result.result().status() == SutranDeliveryResult.Status.RETRY && result.attempts() == 0) {
                        deferUnsent(server, delivery, request, completed);
                    } else {
                        completed.run();
                    }
                }
            });
        } catch (IllegalArgumentException e) {
            updateRejected(delivery, "SUTRAN configuration is invalid");
            completed.run();
        }
    }

    private void deferUnsent(ForwardServer server, ForwardDelivery delivery,
            SutranTransmissionRequest request, Runnable completed) {
        knownUnsentDeliveries.add(delivery.getId());
        deferredDeliveries.put(delivery.getId(), () -> {
            try {
                sendOrdered(server, delivery, request, completed);
            } catch (RuntimeException e) {
                updateRejected(delivery, "SUTRAN deferred dispatch failed before acknowledgement");
                completed.run();
            }
        });
        scheduleRecovery();
    }

    private void updateResult(ForwardDelivery delivery, SutranSendResult sendResult) {
        SutranDeliveryResult result = sendResult.result();
        delivery.setHttpStatus(result.httpStatus() > 0 ? result.httpStatus() : null);
        delivery.setResponseCode(result.responseCode());
        delivery.setCrc(result.crc());
        delivery.setErrorMessage(safeMessage(result.message()));
        delivery.setNextAttempt(null);
        delivery.setUpdatedTime(new Date());
        if (result.status() == SutranDeliveryResult.Status.RETRY && sendResult.attempts() == 0) {
            // Zero attempts is supplied only by preflight/attempt-guard failures, before HTTP.
            knownUnsentDeliveries.add(delivery.getId());
            delivery.setStatus(ForwardDelivery.STATUS_PENDING);
        } else if (result.status() == SutranDeliveryResult.Status.DELIVERED) {
            delivery.setStatus(ForwardDelivery.STATUS_DELIVERED);
            delivery.setSentTime(new Date());
            delivery.setErrorMessage(null);
        } else if (result.status() == SutranDeliveryResult.Status.REJECTED) {
            delivery.setStatus(ForwardDelivery.STATUS_REJECTED);
        } else {
            delivery.setStatus(ForwardDelivery.STATUS_FAILED);
        }
        boolean saved = update(delivery, new Columns.Include(
                "status", "attempts", "nextAttempt", "httpStatus", "responseCode", "crc",
                "errorMessage", "sentTime", "updatedTime"));
        if (saved) {
            knownUnsentDeliveries.remove(delivery.getId());
        }
        if (saved && ForwardDelivery.STATUS_DELIVERED.equals(delivery.getStatus())) {
            updateLastSent(delivery);
        }
    }

    private void updateLastSent(ForwardDelivery delivery) {
        try {
            Position position = storage.getObject(
                    Position.class,
                    new Request(new Columns.Include("deviceId"), new Condition.Equals("id", delivery.getPositionId())));
            if (position == null) {
                return;
            }
            Condition assignmentCondition = new Condition.And(
                    new Condition.Equals("deviceId", position.getDeviceId()),
                    new Condition.Equals("serverId", delivery.getServerId()));
            DeviceForwardServer assignment = storage.getObject(
                    DeviceForwardServer.class, new Request(new Columns.Include("id"), assignmentCondition));
            if (assignment != null) {
                assignment.setLastSent(delivery.getSentTime());
                storage.updateObject(
                        assignment,
                        new Request(new Columns.Include("lastSent"), new Condition.Equals("id", assignment.getId())));
            }
        } catch (StorageException e) {
            LOGGER.warn("SUTRAN assignment last sent update failed for delivery {}", delivery.getId());
        }
    }

    private void updateRejected(ForwardDelivery delivery, String message) {
        delivery.setStatus(ForwardDelivery.STATUS_REJECTED);
        delivery.setErrorMessage(safeMessage(message));
        delivery.setUpdatedTime(new Date());
        update(delivery, new Columns.Include("status", "errorMessage", "updatedTime"));
    }

    private boolean update(ForwardDelivery delivery, Columns columns) {
        try {
            storage.updateObject(delivery, new Request(columns, new Condition.Equals("id", delivery.getId())));
            return true;
        } catch (StorageException e) {
            LOGGER.warn("SUTRAN delivery status update failed for delivery {}", delivery.getId());
            return false;
        }
    }

    private static String safeMessage(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 512 ? value : value.substring(0, 512);
    }

}

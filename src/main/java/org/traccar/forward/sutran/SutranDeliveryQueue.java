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

    private static final Logger LOGGER = LoggerFactory.getLogger(SutranDeliveryQueue.class);
    private static final int RECOVERY_LIMIT = 1000;
    private static final long MAXIMUM_RETRY_DELAY = 60000;
    private static final long INVALID_ID_LOG_INTERVAL = 60000;

    private final Storage storage;
    private final ObjectMapper objectMapper;
    private final Sender sender;
    private final SutranPayloadMapper payloadMapper = new SutranPayloadMapper();
    private final AtomicBoolean recovered = new AtomicBoolean();
    private final java.util.concurrent.atomic.AtomicLong invalidIdLogTime = new java.util.concurrent.atomic.AtomicLong();
    private final boolean transmissionAllowed;

    @Inject
    public SutranDeliveryQueue(
            Storage storage, Client client, ObjectMapper objectMapper, ScheduledExecutorService scheduler,
            SutranTokenCipher tokenCipher, Config config) {
        this.storage = storage;
        this.objectMapper = objectMapper;
        this.transmissionAllowed = config.getBoolean(Keys.SUTRAN_TRANSMISSION_ENABLED);
        this.sender = (server, request, handler) -> {
            SutranClient sutranClient = new SutranClient(
                    client, objectMapper, scheduler, SutranEnvironment.valueOf(server.getEnvironment()),
                    tokenCipher.decrypt(server.getApiKey()), server.getConnectTimeout(), server.getReadTimeout(),
                    server.getMaxAttempts(), server.getRetryDelay(), MAXIMUM_RETRY_DELAY);
            sutranClient.sendTracked(request, handler);
        };
    }

    SutranDeliveryQueue(Storage storage, ObjectMapper objectMapper, Sender sender) {
        this(storage, objectMapper, sender, true);
    }

    SutranDeliveryQueue(Storage storage, ObjectMapper objectMapper, Sender sender, boolean transmissionAllowed) {
        this.storage = storage;
        this.objectMapper = objectMapper;
        this.sender = sender;
        this.transmissionAllowed = transmissionAllowed;
    }

    public boolean isTransmissionAllowed() {
        return transmissionAllowed;
    }

    public void recover() {
        if (!transmissionAllowed) {
            return;
        }
        if (!recovered.compareAndSet(false, true)) {
            return;
        }
        try {
            Condition condition = new Condition.Or(
                    new Condition.Equals("status", ForwardDelivery.STATUS_PENDING),
                    new Condition.Equals("status", ForwardDelivery.STATUS_PROCESSING));
            for (ForwardDelivery delivery : storage.getObjects(
                    ForwardDelivery.class,
                    new Request(new Columns.All(), condition, new Order("createdTime", false, RECOVERY_LIMIT)))) {
                ForwardServer server = storage.getObject(
                        ForwardServer.class,
                        new Request(new Columns.All(), new Condition.Equals("id", delivery.getServerId())));
                if (server != null && server.getActive()
                        && server.getTransmissionEnabled()
                        && ForwardServer.TYPE_SUTRAN_V2.equals(server.getType())) {
                    send(server, delivery);
                }
            }
        } catch (StorageException e) {
            LOGGER.warn("SUTRAN delivery recovery failed");
        }
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
            delivery.setErrorMessage(safeMessage(e.getMessage()));
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
                    "SUTRAN delivery not queued: deviceId={}, device={}, serverId={}, reason=position has no persisted id",
                    positionData.getDevice() != null ? positionData.getDevice().getId() : 0,
                    positionData.getDevice() != null ? positionData.getDevice().getName() : "unknown",
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
        SutranTransmissionRequest request;
        try {
            request = objectMapper.readValue(delivery.getPayload(), SutranTransmissionRequest.class);
        } catch (JsonProcessingException e) {
            updateRejected(delivery, "Stored SUTRAN payload is invalid");
            return;
        }

        delivery.setStatus(ForwardDelivery.STATUS_PROCESSING);
        delivery.setUpdatedTime(new Date());
        update(delivery, new Columns.Include("status", "updatedTime"));

        try {
            sender.send(server, request, result -> updateResult(delivery, result));
        } catch (IllegalArgumentException e) {
            updateRejected(delivery, e.getMessage());
        }
    }

    private void updateResult(ForwardDelivery delivery, SutranSendResult sendResult) {
        SutranDeliveryResult result = sendResult.result();
        delivery.setAttempts(delivery.getAttempts() + sendResult.attempts());
        delivery.setHttpStatus(result.httpStatus() > 0 ? result.httpStatus() : null);
        delivery.setResponseCode(result.responseCode());
        delivery.setCrc(result.crc());
        delivery.setErrorMessage(safeMessage(result.message()));
        delivery.setNextAttempt(null);
        delivery.setUpdatedTime(new Date());
        if (result.status() == SutranDeliveryResult.Status.DELIVERED) {
            delivery.setStatus(ForwardDelivery.STATUS_DELIVERED);
            delivery.setSentTime(new Date());
            delivery.setErrorMessage(null);
            updateLastSent(delivery);
        } else if (result.status() == SutranDeliveryResult.Status.REJECTED) {
            delivery.setStatus(ForwardDelivery.STATUS_REJECTED);
        } else {
            delivery.setStatus(ForwardDelivery.STATUS_FAILED);
        }
        update(delivery, new Columns.Include(
                "status", "attempts", "nextAttempt", "httpStatus", "responseCode", "crc",
                "errorMessage", "sentTime", "updatedTime"));
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
                assignment.setLastSent(new Date());
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

    private void update(ForwardDelivery delivery, Columns columns) {
        try {
            storage.updateObject(delivery, new Request(columns, new Condition.Equals("id", delivery.getId())));
        } catch (StorageException e) {
            LOGGER.warn("SUTRAN delivery status update failed for delivery {}", delivery.getId());
        }
    }

    private static String safeMessage(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 512 ? value : value.substring(0, 512);
    }

}

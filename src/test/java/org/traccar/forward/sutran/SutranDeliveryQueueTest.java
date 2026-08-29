package org.traccar.forward.sutran;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.traccar.forward.PositionData;
import org.traccar.model.Device;
import org.traccar.model.ForwardDelivery;
import org.traccar.model.ForwardServer;
import org.traccar.model.Position;
import org.traccar.storage.MemoryStorage;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Request;

import java.time.Instant;
import java.util.Date;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class SutranDeliveryQueueTest {

    @Test
    public void testDeliveredPositionIsPersistedOnce() throws Exception {
        AtomicInteger requests = new AtomicInteger();
        MemoryStorage storage = new MemoryStorage();
        SutranDeliveryQueue queue = new SutranDeliveryQueue(storage, new ObjectMapper(), (server, request, handler) -> {
            requests.incrementAndGet();
            handler.accept(new SutranSendResult(new SutranDeliveryResult(
                    SutranDeliveryResult.Status.DELIVERED, 200, 2000, "ABC123", "OK"), 1));
        });
        ForwardServer server = server();
        PositionData positionData = positionData("ABC123");

        assertTrue(queue.enqueue(server, positionData));
        assertTrue(awaitStatus(storage, ForwardDelivery.STATUS_DELIVERED));
        assertTrue(queue.enqueue(server, positionData));

        ForwardDelivery delivery = storage.getObjects(
                ForwardDelivery.class, new Request(new Columns.All())).get(0);
        assertEquals("ABC123", delivery.getCrc());
        assertEquals(2000, delivery.getResponseCode());
        assertEquals(1, delivery.getAttempts());
        assertEquals(1, requests.get());
    }

    @Test
    public void testInvalidPlateIsPersistedAsRejected() {
        MemoryStorage storage = new MemoryStorage();
        SutranDeliveryQueue queue = new SutranDeliveryQueue(
                storage, new ObjectMapper(), (server, request, handler) -> { });

        assertTrue(queue.enqueue(server(), positionData("VH3")));

        ForwardDelivery delivery = storage.getObjects(
                ForwardDelivery.class, new Request(new Columns.All())).get(0);
        assertEquals(ForwardDelivery.STATUS_REJECTED, delivery.getStatus());
        assertEquals(0, delivery.getAttempts());
    }

    @Test
    public void testGlobalSafetySwitchBlocksQueueing() {
        AtomicInteger requests = new AtomicInteger();
        MemoryStorage storage = new MemoryStorage();
        SutranDeliveryQueue queue = new SutranDeliveryQueue(
                storage, new ObjectMapper(),
                (server, request, handler) -> requests.incrementAndGet(), false);

        assertFalse(queue.enqueue(server(), positionData("ABC123")));
        assertTrue(storage.getObjects(
                ForwardDelivery.class, new Request(new Columns.All())).isEmpty());
        assertEquals(0, requests.get());
    }

    @Test
    public void testPositionWithoutPersistedIdIsNotQueued() {
        MemoryStorage storage = new MemoryStorage();
        SutranDeliveryQueue queue = new SutranDeliveryQueue(
                storage, new ObjectMapper(), (server, request, handler) -> { });
        PositionData positionData = positionData("CTM495");
        positionData.getPosition().setId(0);

        assertFalse(queue.enqueue(server(), positionData));
        assertTrue(storage.getObjects(
                ForwardDelivery.class, new Request(new Columns.All())).isEmpty());
    }

    @Test
    public void testPendingChangesToProcessingBeforeHttpResult() {
        MemoryStorage storage = new MemoryStorage();
        AtomicReference<Consumer<SutranSendResult>> resultHandler = new AtomicReference<>();
        SutranDeliveryQueue queue = new SutranDeliveryQueue(
                storage, new ObjectMapper(),
                (server, request, handler) -> resultHandler.set(handler));

        assertTrue(queue.enqueue(server(), positionData("CTM495")));
        ForwardDelivery processing = storage.getObjects(
                ForwardDelivery.class, new Request(new Columns.All())).get(0);
        assertEquals(ForwardDelivery.STATUS_PROCESSING, processing.getStatus());

        resultHandler.get().accept(new SutranSendResult(new SutranDeliveryResult(
                SutranDeliveryResult.Status.DELIVERED, 200, 2000, "ABC123", "OK"), 1));

        ForwardDelivery delivered = storage.getObjects(
                ForwardDelivery.class, new Request(new Columns.All())).get(0);
        assertEquals(ForwardDelivery.STATUS_DELIVERED, delivered.getStatus());
        assertEquals("ABC123", delivered.getCrc());
    }

    @Test
    public void testRecoveryResendsProcessingDelivery() throws Exception {
        MemoryStorage storage = new MemoryStorage();
        ForwardServer server = server();
        long serverId = storage.addObject(server, new Request(new Columns.Exclude("id")));
        server.setId(serverId);

        ObjectMapper objectMapper = new ObjectMapper();
        ForwardDelivery delivery = new ForwardDelivery();
        delivery.setPositionId(99);
        delivery.setServerId(serverId);
        delivery.setStatus(ForwardDelivery.STATUS_PROCESSING);
        delivery.setPayload(objectMapper.writeValueAsString(
                new SutranPayloadMapper().map(positionData("CTM495"))));
        delivery.setCreatedTime(new Date());
        delivery.setUpdatedTime(new Date());
        long deliveryId = storage.addObject(delivery, new Request(new Columns.Exclude("id")));
        delivery.setId(deliveryId);

        AtomicInteger requests = new AtomicInteger();
        SutranDeliveryQueue queue = new SutranDeliveryQueue(storage, objectMapper, (target, request, handler) -> {
            requests.incrementAndGet();
            handler.accept(new SutranSendResult(new SutranDeliveryResult(
                    SutranDeliveryResult.Status.DELIVERED, 200, 2000, "ABC123", "OK"), 1));
        });

        queue.recover();

        assertEquals(1, requests.get());
        assertEquals(ForwardDelivery.STATUS_DELIVERED, storage.getObjects(
                ForwardDelivery.class, new Request(new Columns.All())).get(0).getStatus());
    }

    private ForwardServer server() {
        ForwardServer server = new ForwardServer();
        server.setId(7);
        server.setType(ForwardServer.TYPE_SUTRAN_V2);
        server.setEnvironment(SutranEnvironment.DEVELOPMENT.name());
        server.setApiKey("123e4567-e89b-12d3-a456-426614174000");
        server.setConnectTimeout(1000);
        server.setReadTimeout(1000);
        server.setMaxAttempts(1);
        server.setRetryDelay(100);
        server.setActive(true);
        server.setTransmissionEnabled(true);
        return server;
    }

    private PositionData positionData(String plate) {
        Device device = new Device();
        device.setName(plate);
        device.setUniqueId("123456789012345");
        Position position = new Position();
        position.setId(99);
        position.setValid(true);
        position.setLatitude(-11.4);
        position.setLongitude(-76.9);
        position.setFixTime(Date.from(Instant.parse("2026-08-28T12:00:00Z")));
        PositionData positionData = new PositionData();
        positionData.setDevice(device);
        positionData.setPosition(position);
        return positionData;
    }

    private boolean awaitStatus(MemoryStorage storage, String status) throws InterruptedException {
        for (int i = 0; i < 50; i++) {
            var deliveries = storage.getObjects(ForwardDelivery.class, new Request(new Columns.All()));
            if (!deliveries.isEmpty() && status.equals(deliveries.get(0).getStatus())) {
                return true;
            }
            TimeUnit.MILLISECONDS.sleep(20);
        }
        return false;
    }

}

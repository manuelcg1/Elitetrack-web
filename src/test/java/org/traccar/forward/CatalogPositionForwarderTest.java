package org.traccar.forward;

import org.junit.jupiter.api.Test;
import org.traccar.forward.sutran.SutranDeliveryQueue;
import org.traccar.model.Device;
import org.traccar.model.DeviceForwardServer;
import org.traccar.model.ForwardServer;
import org.traccar.model.Position;
import org.traccar.storage.Storage;
import org.traccar.storage.query.Request;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class CatalogPositionForwarderTest {

    @Test
    public void testGenericFailureDoesNotPreventIndependentSutranQueue() throws Exception {
        Fixture fixture = new Fixture();
        doAnswer(invocation -> {
            ResultHandler handler = invocation.getArgument(2);
            handler.onResult(false, new RuntimeException("HF unavailable"));
            return null;
        }).when(fixture.genericForwarder).forward(anyList(), any(), any(), any());

        AtomicBoolean genericSuccess = new AtomicBoolean(true);
        fixture.catalog.forward(fixture.positionData, (success, error) -> genericSuccess.set(success));

        assertFalse(genericSuccess.get());
        verify(fixture.queue, never()).enqueue(any(), any());

        fixture.catalog.forwardSutran(fixture.positionData);

        verify(fixture.queue).enqueue(fixture.sutran, fixture.positionData);
    }

    @Test
    public void testSutranFailureDoesNotDuplicateGenericDestination() throws Exception {
        Fixture fixture = new Fixture();
        doAnswer(invocation -> {
            ResultHandler handler = invocation.getArgument(2);
            handler.onResult(true, null);
            return null;
        }).when(fixture.genericForwarder).forward(anyList(), any(), any(), any());
        when(fixture.queue.enqueue(fixture.sutran, fixture.positionData)).thenReturn(false);

        fixture.catalog.forwardSutran(fixture.positionData);
        AtomicBoolean genericSuccess = new AtomicBoolean();
        fixture.catalog.forward(fixture.positionData, (success, error) -> genericSuccess.set(success));

        assertTrue(genericSuccess.get());
        verify(fixture.genericForwarder).forward(anyList(), eq(fixture.positionData), any(), any());
        verify(fixture.queue).enqueue(fixture.sutran, fixture.positionData);
    }

    @Test
    public void testReloadChangesPilotWithoutRestart() throws Exception {
        Fixture fixture = new Fixture();
        fixture.catalog.forwardSutran(fixture.positionData);
        verify(fixture.queue).enqueue(fixture.sutran, fixture.positionData);

        reset(fixture.queue);
        when(fixture.queue.isTransmissionAllowed()).thenReturn(true);
        fixture.assignments.set(List.of());
        fixture.catalog.reload();
        fixture.catalog.forwardSutran(fixture.positionData);

        verify(fixture.queue, never()).enqueue(any(), any());
    }

    @Test
    public void testSafetySwitchesPreventQueueing() throws Exception {
        Fixture fixture = new Fixture();

        fixture.sutran.setTransmissionEnabled(false);
        fixture.catalog.reload();
        fixture.catalog.forwardSutran(fixture.positionData);
        verify(fixture.queue, never()).enqueue(any(), any());

        fixture.sutran.setTransmissionEnabled(true);
        fixture.sutran.setActive(false);
        fixture.catalog.reload();
        fixture.catalog.forwardSutran(fixture.positionData);
        verify(fixture.queue, never()).enqueue(any(), any());

        fixture.sutran.setActive(true);
        when(fixture.queue.isTransmissionAllowed()).thenReturn(false);
        fixture.catalog.reload();
        fixture.catalog.forwardSutran(fixture.positionData);
        verify(fixture.queue, never()).enqueue(any(), any());
    }

    private static class Fixture {

        private final Storage storage = mock(Storage.class);
        private final MultiDestinationJsonForwarder genericForwarder = mock(MultiDestinationJsonForwarder.class);
        private final SutranDeliveryQueue queue = mock(SutranDeliveryQueue.class);
        private final AtomicReference<List<DeviceForwardServer>> assignments = new AtomicReference<>();
        private final ForwardServer sutran = server(3, ForwardServer.TYPE_SUTRAN_V2);
        private final PositionData positionData = positionData();
        private final CatalogPositionForwarder catalog;

        Fixture() throws Exception {
            ForwardServer hf = server(2, ForwardServer.TYPE_GENERIC_JSON);
            DeviceForwardServer hfAssignment = assignment(7, 2);
            DeviceForwardServer sutranAssignment = assignment(7, 3);
            assignments.set(List.of(hfAssignment, sutranAssignment));
            when(storage.getObjects(eq(ForwardServer.class), any(Request.class))).thenReturn(List.of(hf, sutran));
            when(storage.getObjects(eq(DeviceForwardServer.class), any(Request.class)))
                    .thenAnswer(invocation -> assignments.get());
            when(queue.isTransmissionAllowed()).thenReturn(true);
            catalog = new CatalogPositionForwarder(storage, genericForwarder, queue);
        }

        private static ForwardServer server(long id, String type) {
            ForwardServer server = new ForwardServer();
            server.setId(id);
            server.setType(type);
            server.setActive(true);
            server.setTransmissionEnabled(true);
            return server;
        }

        private static DeviceForwardServer assignment(long deviceId, long serverId) {
            DeviceForwardServer assignment = new DeviceForwardServer();
            assignment.setDeviceId(deviceId);
            assignment.setServerId(serverId);
            return assignment;
        }

        private static PositionData positionData() {
            Device device = new Device();
            device.setId(7);
            Position position = new Position();
            position.setId(101);
            PositionData data = new PositionData();
            data.setDevice(device);
            data.setPosition(position);
            return data;
        }
    }

}

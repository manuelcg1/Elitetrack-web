package org.traccar.forward.sutran;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.traccar.forward.PositionData;
import org.traccar.helper.UnitsConverter;
import org.traccar.model.Device;
import org.traccar.model.Position;

import java.time.Instant;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class SutranPayloadMapperTest {

    private final SutranPayloadMapper mapper = new SutranPayloadMapper();

    private PositionData positionData(String plate, String uniqueId, double speed, double course) {
        Device device = new Device();
        device.setName(plate);
        device.setUniqueId(uniqueId);

        Position position = new Position();
        position.setValid(true);
        position.setLatitude(-11.410890);
        position.setLongitude(-76.9604001);
        position.setSpeed(speed);
        position.setCourse(course);
        position.setFixTime(Date.from(Instant.parse("2023-04-14T04:59:01Z")));

        PositionData positionData = new PositionData();
        positionData.setDevice(device);
        positionData.setPosition(position);
        return positionData;
    }

    @Test
    public void testContractPayload() throws Exception {
        PositionData positionData = positionData(
                "vac036", "123456789012345", UnitsConverter.knotsFromKph(50), 38);

        SutranTransmissionRequest request = mapper.map(positionData);

        assertEquals("VAC036", request.getPlate());
        assertArrayEquals(new double[] {-11.410890, -76.9604001}, request.getGeo());
        assertEquals(38, request.getDirection());
        assertEquals(SutranPayloadMapper.EVENT_ROUTE, request.getEvent());
        assertEquals(50, request.getSpeed());
        assertEquals("2023-04-13 23:59:01", request.getTimeDevice());
        assertEquals(123456789012345L, request.getImei());

        assertEquals(
                "{\"plate\":\"VAC036\",\"geo\":[-11.41089,-76.9604001],\"direction\":38,"
                        + "\"event\":\"ER\",\"speed\":50,\"time_device\":\"2023-04-13 23:59:01\","
                        + "\"imei\":123456789012345}",
                new ObjectMapper().writeValueAsString(request));
    }

    @Test
    public void testStoppedAndRoundedValues() {
        SutranTransmissionRequest request = mapper.map(positionData("ABC123", "invalid", 0, 359.6));

        assertEquals(SutranPayloadMapper.EVENT_STOPPED, request.getEvent());
        assertEquals(0, request.getSpeed());
        assertEquals(360, request.getDirection());
        assertNull(request.getImei());
    }

    @Test
    public void testPanicHasPriority() {
        PositionData positionData = positionData("ABC123", "123456789012345", 10, 20);
        positionData.getPosition().set(Position.KEY_ALARM, Position.ALARM_POWER_CUT + "," + Position.ALARM_SOS);

        assertEquals(SutranPayloadMapper.EVENT_PANIC, mapper.map(positionData).getEvent());
    }

    @Test
    public void testDirectionNormalization() {
        assertEquals(350, mapper.map(positionData("ABC123", "123456789012345", 0, -10)).getDirection());
        assertEquals(10, mapper.map(positionData("ABC123", "123456789012345", 0, 370)).getDirection());
    }

    @Test
    public void testInvalidRequiredData() {
        assertThrows(IllegalArgumentException.class,
                () -> mapper.map(positionData("VH3", "123456789012345", 0, 0)));

        PositionData invalidPosition = positionData("ABC123", "123456789012345", 0, 0);
        invalidPosition.getPosition().setValid(false);
        assertThrows(IllegalArgumentException.class, () -> mapper.map(invalidPosition));

        PositionData invalidCoordinates = positionData("ABC123", "123456789012345", 0, 0);
        invalidCoordinates.getPosition().setLatitude(Double.NaN);
        assertThrows(IllegalArgumentException.class, () -> mapper.map(invalidCoordinates));

        assertThrows(IllegalArgumentException.class,
                () -> mapper.map(positionData("ABC123", "123456789012345", -1, 0)));
        assertThrows(IllegalArgumentException.class,
                () -> mapper.map(positionData("ABC123", "123456789012345", 0, Double.NaN)));
    }

}

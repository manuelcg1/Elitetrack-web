package org.traccar.forward.sutran;

import org.traccar.forward.PositionData;
import org.traccar.helper.UnitsConverter;
import org.traccar.model.Device;
import org.traccar.model.Position;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Locale;

public class SutranPayloadMapper {

    public static final String EVENT_PANIC = "BP";
    public static final String EVENT_ROUTE = "ER";
    public static final String EVENT_STOPPED = "PA";

    private static final ZoneId SUTRAN_ZONE = ZoneId.of("America/Lima");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public SutranTransmissionRequest map(PositionData positionData) {
        if (positionData == null || positionData.getDevice() == null || positionData.getPosition() == null) {
            throw new IllegalArgumentException("Device and position are required");
        }

        Device device = positionData.getDevice();
        Position position = positionData.getPosition();

        SutranTransmissionRequest request = new SutranTransmissionRequest();
        request.setPlate(formatPlate(device.getName()));
        request.setGeo(formatGeo(position));
        request.setDirection(formatDirection(position.getCourse()));
        request.setSpeed(formatSpeed(position.getSpeed()));
        request.setEvent(formatEvent(position, request.getSpeed()));
        request.setTimeDevice(formatTime(position));
        request.setImei(formatImei(device.getUniqueId()));
        return request;
    }

    private String formatPlate(String value) {
        if (value == null) {
            throw new IllegalArgumentException("SUTRAN plate is required");
        }
        String plate = value.trim().toUpperCase(Locale.ROOT);
        if (!plate.matches("[A-Z0-9]{6}")) {
            throw new IllegalArgumentException("SUTRAN plate must contain exactly 6 alphanumeric characters");
        }
        return plate;
    }

    private double[] formatGeo(Position position) {
        double latitude = position.getLatitude();
        double longitude = position.getLongitude();
        if (!position.getValid()
                || !Double.isFinite(latitude) || latitude < -90 || latitude > 90
                || !Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("Valid SUTRAN coordinates are required");
        }
        return new double[] {latitude, longitude};
    }

    private int formatDirection(double course) {
        if (!Double.isFinite(course)) {
            throw new IllegalArgumentException("SUTRAN direction must be finite");
        }
        double normalized = (course % 360 + 360) % 360;
        return (int) Math.round(normalized);
    }

    private int formatSpeed(double speed) {
        if (!Double.isFinite(speed) || speed < 0) {
            throw new IllegalArgumentException("SUTRAN speed must be a non-negative number");
        }
        long rounded = Math.round(UnitsConverter.kphFromKnots(speed));
        if (rounded > Integer.MAX_VALUE) {
            throw new IllegalArgumentException("SUTRAN speed is outside the supported range");
        }
        return (int) rounded;
    }

    private String formatEvent(Position position, int speed) {
        String alarms = position.getString(Position.KEY_ALARM);
        if (alarms != null && Arrays.asList(alarms.split(",")).contains(Position.ALARM_SOS)) {
            return EVENT_PANIC;
        }
        return speed > 0 ? EVENT_ROUTE : EVENT_STOPPED;
    }

    private String formatTime(Position position) {
        if (position.getFixTime() == null) {
            throw new IllegalArgumentException("SUTRAN fix time is required");
        }
        return DATE_FORMAT.format(Instant.ofEpochMilli(position.getFixTime().getTime()).atZone(SUTRAN_ZONE));
    }

    private Long formatImei(String value) {
        if (value != null) {
            String imei = value.trim();
            if (imei.matches("[0-9]{15}")) {
                return Long.valueOf(imei);
            }
        }
        return null;
    }

}

package org.traccar.reports;

import org.junit.jupiter.api.Test;
import org.traccar.helper.model.GeofenceMembership;
import org.traccar.model.Device;
import org.traccar.model.Geofence;
import org.traccar.model.Position;
import org.traccar.reports.model.GeofenceReportItem;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class GeofenceReportProviderTest {

    private static final long FROM = 1_000_000_000_000L;

    private static Geofence circle(long id, String name, double lat, double lon, int radius) {
        Geofence geofence = new Geofence();
        geofence.setId(id);
        geofence.setName(name);
        geofence.setArea("CIRCLE (" + lat + " " + lon + ", " + radius + ")");
        return geofence;
    }

    private static Position position(int minute, double lat, double lon, double totalDistance) {
        Position position = new Position();
        position.setValid(true);
        position.setFixTime(new Date(FROM + minute * 60_000L));
        position.setLatitude(lat);
        position.setLongitude(lon);
        position.set(Position.KEY_TOTAL_DISTANCE, totalDistance);
        return position;
    }

    private static Device device() {
        Device device = new Device();
        device.setId(7);
        device.setName("Camión 01");
        return device;
    }

    private static final double OUT = -12.20;

    private final GeofenceMembership membership = new GeofenceMembership(List.of(
            circle(1, "Base", -12.00, -77.00, 500),
            circle(2, "Cliente", -12.10, -77.00, 500),
            circle(3, "Carga", -12.103, -77.00, 100)));

    @Test
    public void testVisits() {
        List<Position> positions = new ArrayList<>();
        positions.add(position(-5, -12.00, -77.00, 0)); // antes del período, dentro de Base
        positions.add(position(0, -12.00, -77.00, 0));
        positions.add(position(10, OUT, -77.00, 1000)); // sale de Base
        positions.add(position(20, -12.10, -77.00, 2000)); // entra a Cliente
        positions.add(position(30, -12.103, -77.00, 2100)); // sigue en Cliente y entra a Carga
        positions.add(position(40, -12.10, -77.00, 2300)); // sale de Carga
        positions.add(position(50, OUT, -77.00, 3000)); // sale de Cliente
        positions.add(position(60, -12.00, -77.00, 4000)); // entra a Base y queda dentro

        var items = GeofenceReportProvider.buildVisits(device(), membership, positions.iterator(), new Date(FROM));
        assertEquals(4, items.size());

        GeofenceReportItem base = items.get(0);
        assertEquals("Base", base.getGeofenceName());
        assertTrue(base.getOpenStart());
        assertFalse(base.getOpenEnd());
        assertEquals(new Date(FROM), base.getStartTime());
        assertEquals(new Date(FROM + 10 * 60_000L), base.getEndTime());
        assertEquals(1000, base.getDistance(), 0.1);

        GeofenceReportItem carga = items.get(1);
        assertEquals("Carga", carga.getGeofenceName());
        assertEquals(new Date(FROM + 30 * 60_000L), carga.getStartTime());
        assertEquals(new Date(FROM + 40 * 60_000L), carga.getEndTime());

        GeofenceReportItem cliente = items.get(2);
        assertEquals("Cliente", cliente.getGeofenceName());
        assertFalse(cliente.getOpenStart());
        assertEquals(new Date(FROM + 20 * 60_000L), cliente.getStartTime());
        assertEquals(new Date(FROM + 50 * 60_000L), cliente.getEndTime());

        GeofenceReportItem last = items.get(3);
        assertEquals("Base", last.getGeofenceName());
        assertTrue(last.getOpenEnd());
        assertEquals(new Date(FROM + 60 * 60_000L), last.getStartTime());
        assertEquals(new Date(FROM + 60 * 60_000L), last.getEndTime());
    }

    @Test
    public void testNoPreviousPosition() {
        var positions = List.of(position(0, -12.00, -77.00, 0), position(10, OUT, -77.00, 500));
        var items = GeofenceReportProvider.buildVisits(device(), membership, positions.iterator(), new Date(FROM));
        assertEquals(1, items.size());
        assertFalse(items.get(0).getOpenStart());
    }

    @Test
    public void testPositionGeofences() {
        assertEquals(List.of(2L, 3L), membership.find(position(0, -12.103, -77.00, 0)));
        assertTrue(membership.find(position(0, OUT, -77.00, 0)).isEmpty());
        Geofence invalid = new Geofence();
        invalid.setId(9);
        invalid.setArea("POLYGON ((bad))");
        assertEquals(0, new GeofenceMembership(List.of(invalid)).getGeofences().size());
    }

}

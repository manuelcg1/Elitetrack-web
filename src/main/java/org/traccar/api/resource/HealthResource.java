package org.traccar.api.resource;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import org.traccar.api.BaseResource;
import org.traccar.model.Device;
import org.traccar.model.DeviceHealth;
import org.traccar.model.Position;
import org.traccar.model.User;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;

@Path("health")
@Produces(MediaType.APPLICATION_JSON)
public class HealthResource extends BaseResource {

    private static final long DEFAULT_NO_REPORT_MINUTES = 30;
    private static final double DEFAULT_LOW_BATTERY_LEVEL = 20.0;

    @Inject
    private CacheManager cacheManager;

    @GET
    @Path("devices")
    public List<DeviceHealth> devices(
            @QueryParam("noReportMinutes") Long noReportMinutes,
            @QueryParam("lowBatteryLevel") Double lowBatteryLevel) throws StorageException {

        long noReportMillis = (noReportMinutes != null ? noReportMinutes : DEFAULT_NO_REPORT_MINUTES) * 60_000L;
        double lowBatteryThreshold = lowBatteryLevel != null ? lowBatteryLevel : DEFAULT_LOW_BATTERY_LEVEL;
        long now = System.currentTimeMillis();

        List<Device> devices = storage.getObjects(Device.class, new Request(
                new Columns.All(),
                new Condition.Permission(User.class, getUserId(), Device.class)));

        List<DeviceHealth> result = new ArrayList<>();

        for (Device device : devices) {
            Position position = cacheManager.getPosition(device.getId());

            DeviceHealth health = new DeviceHealth();
            health.setDeviceId(device.getId());
            health.setName(device.getName());
            health.setUniqueId(device.getUniqueId());
            health.setStatus(device.getStatus());
            health.setLastUpdate(device.getLastUpdate());

            Long minutesSinceLastUpdate = null;
            if (device.getLastUpdate() != null) {
                minutesSinceLastUpdate = (now - device.getLastUpdate().getTime()) / 60000L;
            }
            health.setMinutesSinceLastUpdate(minutesSinceLastUpdate);

            boolean online = Device.STATUS_ONLINE.equals(device.getStatus());
            health.setOnline(online);

            boolean noReport = device.getLastUpdate() == null
                    || now - device.getLastUpdate().getTime() > noReportMillis;
            health.setNoReport(noReport);

            boolean invalidPosition = position != null && !position.getValid();
            health.setInvalidPosition(invalidPosition);

            Double batteryLevelValue = null;
            if (position != null && position.hasAttribute(Position.KEY_BATTERY_LEVEL)) {
                Object value = position.getAttributes().get(Position.KEY_BATTERY_LEVEL);
                if (value instanceof Number number) {
                    batteryLevelValue = number.doubleValue();
                }
            }

            health.setBatteryLevel(batteryLevelValue);
            boolean lowBattery = batteryLevelValue != null && batteryLevelValue <= lowBatteryThreshold;
            health.setLowBattery(lowBattery);

            if (noReport) {
                health.setIssue("Sin reporte reciente");
                health.setSeverity("critical");
            } else if (invalidPosition) {
                health.setIssue("Posición inválida");
                health.setSeverity("warning");
            } else if (lowBattery) {
                health.setIssue("Batería baja");
                health.setSeverity("warning");
            } else if (!online) {
                health.setIssue("Dispositivo no conectado");
                health.setSeverity("warning");
            } else {
                health.setIssue("OK");
                health.setSeverity("ok");
            }

            result.add(health);
        }

        return result;
    }

    @GET
    @Path("summary")
    public HashMap<String, Object> summary() throws StorageException {
        List<DeviceHealth> devices = devices(DEFAULT_NO_REPORT_MINUTES, DEFAULT_LOW_BATTERY_LEVEL);

        HashMap<String, Object> summary = new HashMap<>();
        summary.put("total", devices.size());
        summary.put("online", devices.stream().filter(DeviceHealth::getOnline).count());
        summary.put("offline", devices.stream().filter((item) -> !item.getOnline()).count());
        summary.put("noReport", devices.stream().filter(DeviceHealth::getNoReport).count());
        summary.put("invalidPosition", devices.stream().filter(DeviceHealth::getInvalidPosition).count());
        summary.put("lowBattery", devices.stream().filter(DeviceHealth::getLowBattery).count());
        summary.put("generatedAt", new Date());

        return summary;
    }
}
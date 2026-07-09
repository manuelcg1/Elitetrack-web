package org.traccar.api.resource;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.traccar.alert.AlertCache;
import org.traccar.alert.AlertSecurity;
import org.traccar.api.BaseResource;
import org.traccar.api.security.MenuKeys;
import org.traccar.model.Alert;
import org.traccar.model.AlertDevice;
import org.traccar.model.AlertGeofence;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Order;
import org.traccar.storage.query.Request;

import java.util.Date;
import java.util.List;
import java.util.Objects;

@Path("alerts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AlertResource extends BaseResource {

    @Inject
    private AlertSecurity alertSecurity;

    @Inject
    private AlertCache alertCache;

    private static final List<String> TYPES = List.of(
            Alert.TYPE_SPEED,
            Alert.TYPE_GEOFENCE_ENTER,
            Alert.TYPE_GEOFENCE_EXIT,
            Alert.TYPE_BATTERY_LOW,
            Alert.TYPE_IGNITION_ON,
            Alert.TYPE_IGNITION_OFF,
            Alert.TYPE_STOPPED_TOO_LONG);

    private static final List<String> SEVERITIES = List.of(
            Alert.SEVERITY_LOW,
            Alert.SEVERITY_MEDIUM,
            Alert.SEVERITY_HIGH,
            Alert.SEVERITY_CRITICAL);

    @GET
    public List<Alert> list() throws StorageException {
        checkAlertsAccess();
        List<Alert> alerts = storage.getObjects(Alert.class, new Request(
                new Columns.All(), new Order("id", true, 0, 0)));
        List<Alert> result = new java.util.ArrayList<>();
        for (Alert alert : alerts) {
            hydrateRelations(alert);
            if (alertSecurity.canAccessAlert(getUserId(), alert)) {
                result.add(alert);
            }
        }
        return result;
    }

    @Path("{id}")
    @GET
    public Alert get(@PathParam("id") long id) throws StorageException {
        checkAlertsAccess();
        Alert alert = storage.getObject(Alert.class, new Request(
                new Columns.All(), new Condition.Equals("id", id)));
        if (alert == null) {
            throw new NotFoundException();
        }
        hydrateRelations(alert);
        if (!alertSecurity.canAccessAlert(getUserId(), alert)) {
            throw new SecurityException("Alert access denied");
        }
        return alert;
    }

    @POST
    public Response add(Alert alert) throws StorageException {
        checkAlertsAccess();
        validate(alert);
        alertSecurity.checkAlertPayload(getUserId(), alert);
        Date now = new Date();
        alert.setCreatedBy(getUserId());
        alert.setCreatedAt(now);
        alert.setUpdatedAt(now);
        alert.setId(storage.addObject(alert, new Request(new Columns.Exclude(
                "id", "deviceIds", "groupIds", "geofenceIds", "geofenceGroupIds"))));
        saveRelations(alert);
        alertCache.invalidate();
        hydrateRelations(alert);
        return Response.ok(alert).build();
    }

    @Path("{id}")
    @PUT
    public Response update(@PathParam("id") long id, Alert alert) throws StorageException {
        checkAlertsAccess();
        if (storage.getObject(Alert.class, new Request(
                new Columns.Include("id"), new Condition.Equals("id", id))) == null) {
            throw new NotFoundException();
        }
        Alert before = storage.getObject(Alert.class, new Request(
                new Columns.All(), new Condition.Equals("id", id)));
        hydrateRelations(before);
        if (!alertSecurity.canManageAlert(getUserId(), before)) {
            throw new SecurityException("Alert access denied");
        }
        validate(alert);
        alertSecurity.checkAlertPayload(getUserId(), alert);
        alert.setId(id);
        alert.setUpdatedAt(new Date());
        storage.updateObject(alert, new Request(
                new Columns.Exclude("id", "createdBy", "createdAt", "deviceIds", "groupIds",
                        "geofenceIds", "geofenceGroupIds"),
                new Condition.Equals("id", id)));
        removeRelations(id);
        saveRelations(alert);
        alertCache.invalidate();
        hydrateRelations(alert);
        return Response.ok(alert).build();
    }

    @Path("{id}")
    @DELETE
    public Response remove(@PathParam("id") long id) throws StorageException {
        checkAlertsAccess();
        Alert alert = storage.getObject(Alert.class, new Request(
                new Columns.All(), new Condition.Equals("id", id)));
        if (alert == null) {
            throw new NotFoundException();
        }
        hydrateRelations(alert);
        if (!alertSecurity.canManageAlert(getUserId(), alert)) {
            throw new SecurityException("Alert access denied");
        }
        removeRelations(id);
        storage.removeObject(Alert.class, new Request(new Condition.Equals("id", id)));
        alertCache.invalidate();
        return Response.noContent().build();
    }

    private void checkAlertsAccess() throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ALERTS);
    }

    private void validate(Alert alert) {
        if (alert == null) {
            throw new BadRequestException("Alert payload is required");
        }
        if (alert.getName() == null || alert.getName().isBlank()) {
            throw new BadRequestException("Alert name is required");
        }
        if (alert.getType() == null || alert.getType().isBlank()) {
            throw new BadRequestException("Alert type is required");
        }
        if (!TYPES.contains(alert.getType())) {
            throw new BadRequestException("Unsupported alert type");
        }
        if (alert.getSeverity() != null && !alert.getSeverity().isBlank()
                && !SEVERITIES.contains(alert.getSeverity())) {
            throw new BadRequestException("Unsupported alert severity");
        }
        if (Alert.TYPE_SPEED.equals(alert.getType()) && alert.getLimitValue() <= 0) {
            throw new BadRequestException("Limit value is required for speed alerts");
        }
    }

    private void saveRelations(Alert alert) throws StorageException {
        for (Long deviceId : alert.getDeviceIds()) {
            AlertDevice relation = new AlertDevice();
            relation.setAlertId(alert.getId());
            relation.setDeviceId(deviceId);
            storage.addObject(relation, new Request(new Columns.Exclude("id")));
        }
        for (Long groupId : alert.getGroupIds()) {
            AlertDevice relation = new AlertDevice();
            relation.setAlertId(alert.getId());
            relation.setGroupId(groupId);
            storage.addObject(relation, new Request(new Columns.Exclude("id")));
        }
        for (Long geofenceId : alert.getGeofenceIds()) {
            AlertGeofence relation = new AlertGeofence();
            relation.setAlertId(alert.getId());
            relation.setGeofenceId(geofenceId);
            storage.addObject(relation, new Request(new Columns.Exclude("id")));
        }
        for (Long geofenceGroupId : alert.getGeofenceGroupIds()) {
            AlertGeofence relation = new AlertGeofence();
            relation.setAlertId(alert.getId());
            relation.setGroupId(geofenceGroupId);
            storage.addObject(relation, new Request(new Columns.Exclude("id")));
        }
    }

    private void removeRelations(long alertId) throws StorageException {
        Condition condition = new Condition.Equals("alertId", alertId);
        storage.removeObject(AlertDevice.class, new Request(condition));
        storage.removeObject(AlertGeofence.class, new Request(condition));
    }

    private void hydrateRelations(Alert alert) throws StorageException {
        List<AlertDevice> devices = storage.getObjects(AlertDevice.class, new Request(
                new Columns.All(), new Condition.Equals("alertId", alert.getId())));
        alert.setDeviceIds(devices.stream()
                .map(AlertDevice::getDeviceId)
                .filter(Objects::nonNull)
                .toList());
        alert.setGroupIds(devices.stream()
                .map(AlertDevice::getGroupId)
                .filter(Objects::nonNull)
                .toList());

        List<AlertGeofence> geofences = storage.getObjects(AlertGeofence.class, new Request(
                new Columns.All(), new Condition.Equals("alertId", alert.getId())));
        alert.setGeofenceIds(geofences.stream()
                .map(AlertGeofence::getGeofenceId)
                .filter(Objects::nonNull)
                .toList());
        alert.setGeofenceGroupIds(geofences.stream()
                .map(AlertGeofence::getGroupId)
                .filter(Objects::nonNull)
                .toList());
    }

}

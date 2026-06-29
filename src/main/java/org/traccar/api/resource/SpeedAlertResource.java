package org.traccar.api.resource;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.traccar.api.BaseResource;
import org.traccar.database.SpeedAlertEvaluator;
import org.traccar.model.SpeedAlert;
import org.traccar.model.SpeedAlertDevice;
import org.traccar.model.SpeedAlertGeofence;
import org.traccar.model.SpeedAlertGeofenceGroup;
import org.traccar.model.SpeedAlertLog;
import org.traccar.model.SpeedAlertTelemetry;
import org.traccar.model.SpeedAlertVehicleGroup;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Order;
import org.traccar.storage.query.Request;

import java.util.List;

@Path("alerts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SpeedAlertResource extends BaseResource {

    @Inject
    private SpeedAlertEvaluator evaluator;

    @GET
    public List<SpeedAlert> list() throws StorageException {
        checkAdmin();
        List<SpeedAlert> alerts = storage.getObjects(SpeedAlert.class, new Request(
                new Columns.All(), new Order("id", true, 0, 0)));
        for (SpeedAlert alert : alerts) {
            evaluator.hydrateRelations(alert);
        }
        return alerts;
    }

    @Path("{id}")
    @GET
    public Response get(@PathParam("id") long id) throws StorageException {
        checkAdmin();
        SpeedAlert alert = storage.getObject(SpeedAlert.class, new Request(
                new Columns.All(), new Condition.Equals("id", id)));
        if (alert == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        evaluator.hydrateRelations(alert);
        return Response.ok(alert).build();
    }

    @POST
    public Response add(SpeedAlert alert) throws StorageException {
        checkAdmin();
        validate(alert);
        alert.setType(SpeedAlert.TYPE_SPEED);
        alert.setId(storage.addObject(alert, new Request(new Columns.Exclude(
                "id", "deviceIds", "vehicleGroupIds", "geofenceIds", "geofenceGroupIds"))));
        saveRelations(alert);
        evaluator.hydrateRelations(alert);
        return Response.ok(alert).build();
    }

    @Path("{id}")
    @PUT
    public Response update(@PathParam("id") long id, SpeedAlert alert) throws StorageException {
        checkAdmin();
        alert.setId(id);
        validate(alert);
        alert.setType(SpeedAlert.TYPE_SPEED);
        storage.updateObject(alert, new Request(
                new Columns.Exclude("id", "deviceIds", "vehicleGroupIds", "geofenceIds", "geofenceGroupIds"),
                new Condition.Equals("id", id)));
        removeRelations(id);
        saveRelations(alert);
        evaluator.hydrateRelations(alert);
        return Response.ok(alert).build();
    }

    @Path("{id}")
    @DELETE
    public Response remove(@PathParam("id") long id) throws StorageException {
        checkAdmin();
        removeRelations(id);
        storage.removeObject(SpeedAlert.class, new Request(new Condition.Equals("id", id)));
        return Response.noContent().build();
    }

    @Path("logs")
    @GET
    public List<SpeedAlertLog> logs() throws StorageException {
        checkAdmin();
        return storage.getObjects(SpeedAlertLog.class, new Request(
                new Columns.All(), new Order("eventTime", true, 100, 0)));
    }

    @Path("evaluate")
    @POST
    public List<SpeedAlertLog> evaluate(SpeedAlertTelemetry telemetry) throws StorageException {
        checkAdmin();
        return evaluator.evaluate(telemetry);
    }

    private void checkAdmin() throws StorageException {
        permissionsService.checkAdmin(getUserId());
    }

    private void validate(SpeedAlert alert) {
        if (alert.getName() == null || alert.getName().isBlank()) {
            throw new IllegalArgumentException("Alert name is required");
        }
        if (alert.getSpeedLimit() <= 0) {
            throw new IllegalArgumentException("Speed limit must be greater than zero");
        }
    }

    private void saveRelations(SpeedAlert alert) throws StorageException {
        for (Long deviceId : alert.getDeviceIds()) {
            SpeedAlertDevice relation = new SpeedAlertDevice();
            relation.setAlertId(alert.getId());
            relation.setDeviceId(deviceId);
            storage.addObject(relation, new Request(new Columns.Exclude("id")));
        }
        for (Long groupId : alert.getVehicleGroupIds()) {
            SpeedAlertVehicleGroup relation = new SpeedAlertVehicleGroup();
            relation.setAlertId(alert.getId());
            relation.setGroupId(groupId);
            storage.addObject(relation, new Request(new Columns.Exclude("id")));
        }
        for (Long geofenceId : alert.getGeofenceIds()) {
            SpeedAlertGeofence relation = new SpeedAlertGeofence();
            relation.setAlertId(alert.getId());
            relation.setGeofenceId(geofenceId);
            storage.addObject(relation, new Request(new Columns.Exclude("id")));
        }
        for (Long geofenceGroupId : alert.getGeofenceGroupIds()) {
            SpeedAlertGeofenceGroup relation = new SpeedAlertGeofenceGroup();
            relation.setAlertId(alert.getId());
            relation.setGeofenceGroupId(geofenceGroupId);
            storage.addObject(relation, new Request(new Columns.Exclude("id")));
        }
    }

    private void removeRelations(long alertId) throws StorageException {
        Condition condition = new Condition.Equals("alertId", alertId);
        storage.removeObject(SpeedAlertDevice.class, new Request(condition));
        storage.removeObject(SpeedAlertVehicleGroup.class, new Request(condition));
        storage.removeObject(SpeedAlertGeofence.class, new Request(condition));
        storage.removeObject(SpeedAlertGeofenceGroup.class, new Request(condition));
    }

}

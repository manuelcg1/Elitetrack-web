package org.traccar.api.resource;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.inject.Inject;
import org.traccar.alert.AlertSecurity;
import org.traccar.api.BaseResource;
import org.traccar.api.security.MenuKeys;
import org.traccar.model.AlertEvent;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Order;
import org.traccar.storage.query.Request;

import java.util.Date;
import java.util.ArrayList;
import java.util.List;

@Path("alert-events")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AlertEventResource extends BaseResource {

    private static final int DEFAULT_LIMIT = 200;
    private static final int MAX_LIMIT = 500;

    @Inject
    private AlertSecurity alertSecurity;

    @GET
    public List<AlertEvent> list(
            @QueryParam("status") String status,
            @QueryParam("severity") String severity,
            @QueryParam("type") String type,
            @QueryParam("deviceId") long deviceId,
            @QueryParam("groupId") long groupId,
            @QueryParam("alertId") long alertId,
            @QueryParam("dateFrom") Date dateFrom,
            @QueryParam("dateTo") Date dateTo,
            @QueryParam("limit") int limit,
            @QueryParam("offset") int offset) throws StorageException {
        checkAlertsAccess();
        int safeLimit = limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
        int safeOffset = Math.max(offset, 0);
        List<AlertEvent> events = storage.getObjects(AlertEvent.class, new Request(
                new Columns.All(),
                buildCondition(status, severity, type, deviceId, groupId, alertId, dateFrom, dateTo),
                new Order("eventTime", true, safeLimit, safeOffset)));
        List<AlertEvent> result = new java.util.ArrayList<>();
        for (AlertEvent event : events) {
            if (alertSecurity.canAccessEvent(getUserId(), event)) {
                result.add(event);
            }
        }
        return result;
    }

    private Condition buildCondition(
            String status, String severity, String type, long deviceId, long groupId, long alertId,
            Date dateFrom, Date dateTo) {
        List<Condition> conditions = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            conditions.add(new Condition.Equals("status", status));
        }
        if (severity != null && !severity.isBlank()) {
            conditions.add(new Condition.Equals("severity", severity));
        }
        if (type != null && !type.isBlank()) {
            conditions.add(new Condition.Equals("type", type));
        }
        if (deviceId > 0) {
            conditions.add(new Condition.Equals("deviceId", deviceId));
        }
        if (groupId > 0) {
            conditions.add(new Condition.Equals("groupId", groupId));
        }
        if (alertId > 0) {
            conditions.add(new Condition.Equals("alertId", alertId));
        }
        if (dateFrom != null && dateTo != null) {
            conditions.add(new Condition.Between("eventTime", dateFrom, dateTo));
        } else if (dateFrom != null) {
            conditions.add(new Condition.Compare("eventTime", ">=", dateFrom));
        } else if (dateTo != null) {
            conditions.add(new Condition.Compare("eventTime", "<=", dateTo));
        }
        return Condition.merge(conditions);
    }

    @Path("{id}")
    @GET
    public AlertEvent get(@PathParam("id") long id) throws StorageException {
        checkAlertsAccess();
        AlertEvent event = storage.getObject(AlertEvent.class, new Request(
                new Columns.All(), new Condition.Equals("id", id)));
        if (event == null) {
            throw new NotFoundException();
        }
        if (!alertSecurity.canAccessEvent(getUserId(), event)) {
            throw new SecurityException("Alert event access denied");
        }
        return event;
    }

    @Path("{id}/acknowledge")
    @PUT
    public Response acknowledge(@PathParam("id") long id) throws StorageException {
        updateStatus(id, AlertEvent.STATUS_ACKNOWLEDGED);
        return Response.noContent().build();
    }

    @Path("{id}/resolve")
    @PUT
    public Response resolve(@PathParam("id") long id) throws StorageException {
        updateStatus(id, AlertEvent.STATUS_RESOLVED);
        return Response.noContent().build();
    }

    @Path("{id}/dismiss")
    @PUT
    public Response dismiss(@PathParam("id") long id) throws StorageException {
        updateStatus(id, AlertEvent.STATUS_DISMISSED);
        return Response.noContent().build();
    }

    private void updateStatus(long id, String status) throws StorageException {
        checkAlertsAccess();
        AlertEvent event = storage.getObject(AlertEvent.class, new Request(
                new Columns.All(), new Condition.Equals("id", id)));
        if (event == null) {
            throw new NotFoundException();
        }
        if (!alertSecurity.canAccessEvent(getUserId(), event)) {
            throw new SecurityException("Alert event access denied");
        }

        event.setStatus(status);
        Date now = new Date();
        Columns columns = new Columns.Include("status");
        if (AlertEvent.STATUS_ACKNOWLEDGED.equals(status)) {
            event.setAcknowledgedAt(now);
            event.setAcknowledgedBy(getUserId());
            columns = new Columns.Include("status", "acknowledgedAt", "acknowledgedBy");
        } else if (AlertEvent.STATUS_RESOLVED.equals(status)) {
            event.setResolvedAt(now);
            columns = new Columns.Include("status", "resolvedAt");
        } else if (AlertEvent.STATUS_DISMISSED.equals(status)) {
            event.setDismissedAt(now);
            columns = new Columns.Include("status", "dismissedAt");
        }
        storage.updateObject(event, new Request(columns, new Condition.Equals("id", id)));
    }

    private void checkAlertsAccess() throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ALERTS);
    }

}

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
import org.traccar.alert.AlertRecipientRepository;
import org.traccar.api.BaseResource;
import org.traccar.api.security.MenuKeys;
import org.traccar.model.Alert;
import org.traccar.model.AlertDevice;
import org.traccar.model.AlertGeofence;
import org.traccar.model.User;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Order;
import org.traccar.storage.query.Request;

import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;

@Path("alerts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AlertResource extends BaseResource {

    @Inject
    private AlertSecurity alertSecurity;

    @Inject
    private AlertCache alertCache;

    @Inject
    private AlertRecipientRepository alertRecipientRepository;

    public record RecipientUpdate(List<Long> userIds) {
    }

    public record Recipient(
            long userId, String name, String email, boolean telegramLinked, String maskedChatId) {
    }

    private static final List<String> TYPES = List.of(
            Alert.TYPE_SPEED,
            Alert.TYPE_GEOFENCE_ENTER,
            Alert.TYPE_GEOFENCE_EXIT,
            Alert.TYPE_BATTERY_LOW,
            Alert.TYPE_POWER_CUT,
            Alert.TYPE_IGNITION_ON,
            Alert.TYPE_IGNITION_OFF,
            Alert.TYPE_STOPPED_TOO_LONG,
            Alert.TYPE_MOVEMENT,
            Alert.TYPE_HARSH_ACCELERATION,
            Alert.TYPE_HARSH_BRAKING,
            Alert.TYPE_HARSH_CORNERING);

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
        normalizeCondition(alert);
        validate(alert);
        alertSecurity.checkAlertPayload(getUserId(), alert);
        Date now = new Date();
        alert.setCreatedBy(getUserId());
        alert.setCreatedAt(now);
        alert.setUpdatedAt(now);
        alert.setId(storage.addObject(alert, new Request(new Columns.Exclude(
                "id", "deviceIds", "groupIds", "geofenceIds", "geofenceGroupIds", "recipientIds"))));
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
        normalizeCondition(alert);
        validate(alert);
        alertSecurity.checkAlertPayload(getUserId(), alert);
        alert.setId(id);
        alert.setUpdatedAt(new Date());
        storage.updateObject(alert, new Request(
                new Columns.Exclude("id", "createdBy", "createdAt", "deviceIds", "groupIds",
                        "geofenceIds", "geofenceGroupIds", "recipientIds"),
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

    @Path("{id}/recipients")
    @GET
    public List<Recipient> getRecipients(@PathParam("id") long id) throws StorageException {
        Alert alert = getManagedAlert(id);
        return loadRecipientUsers(getRecipientIds(alert.getId())).stream().map(AlertResource::toRecipient).toList();
    }

    @Path("{id}/recipient-options")
    @GET
    public List<Recipient> getRecipientOptions(@PathParam("id") long id) throws StorageException {
        getManagedAlert(id);
        boolean admin = alertSecurity.isAdmin(getUserId());
        return storage.getObjects(User.class, new Request(new Columns.All(), new Order("name"))).stream()
                .filter(user -> !user.getDisabled())
                .filter(AlertResource::notExpired)
                .filter(user -> admin || canManageUser(user.getId()))
                .map(AlertResource::toRecipient)
                .toList();
    }

    @Path("recipient-options")
    @GET
    public List<Recipient> getRecipientOptions() throws StorageException {
        checkAlertsAccess();
        boolean admin = alertSecurity.isAdmin(getUserId());
        return storage.getObjects(User.class, new Request(new Columns.All(), new Order("name"))).stream()
                .filter(user -> !user.getDisabled())
                .filter(AlertResource::notExpired)
                .filter(user -> admin || canManageUser(user.getId()))
                .map(AlertResource::toRecipient)
                .toList();
    }

    @Path("{id}/recipients")
    @PUT
    public List<Recipient> replaceRecipients(@PathParam("id") long id, RecipientUpdate update)
            throws StorageException {
        Alert alert = getManagedAlert(id);
        Set<Long> userIds = new LinkedHashSet<>(update != null && update.userIds() != null
                ? update.userIds() : List.of());
        if (userIds.stream().anyMatch(userId -> userId == null || userId <= 0)) {
            throw new BadRequestException("Invalid recipient user id");
        }
        List<User> users = loadRecipientUsers(userIds);
        if (users.size() != userIds.size()) {
            throw new BadRequestException("One or more recipient users do not exist");
        }
        for (User user : users) {
            if (user.getDisabled() || !notExpired(user)
                    || (!alertSecurity.isAdmin(getUserId()) && !canManageUser(user.getId()))) {
                throw new SecurityException("Recipient user access denied");
            }
        }
        try {
            alertRecipientRepository.replace(alert.getId(), userIds);
        } catch (SQLException e) {
            throw new StorageException("Failed to replace alert recipients", e);
        }
        return users.stream().map(AlertResource::toRecipient).toList();
    }

    private Alert getManagedAlert(long id) throws StorageException {
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
        return alert;
    }

    private boolean canManageUser(long userId) {
        try {
            permissionsService.checkUser(getUserId(), userId);
            return true;
        } catch (StorageException | SecurityException e) {
            return false;
        }
    }

    private List<Long> getRecipientIds(long alertId) throws StorageException {
        try {
            return alertRecipientRepository.getUserIds(alertId);
        } catch (SQLException e) {
            throw new StorageException("Failed to load alert recipients", e);
        }
    }

    private List<User> loadRecipientUsers(java.util.Collection<Long> userIds) throws StorageException {
        Condition condition = null;
        for (long userId : userIds) {
            Condition next = new Condition.Equals("id", userId);
            condition = condition == null ? next : new Condition.Or(condition, next);
        }
        return condition != null
                ? storage.getObjects(User.class, new Request(new Columns.All(), condition)) : List.of();
    }

    private static Recipient toRecipient(User user) {
        String chatId = user.getString("telegramChatId");
        String maskedChatId = chatId != null && !chatId.isBlank()
                ? "••••••" + chatId.substring(Math.max(0, chatId.length() - 4)) : null;
        return new Recipient(user.getId(), user.getName(), user.getEmail(),
                chatId != null && !chatId.isBlank(), maskedChatId);
    }

    private static boolean notExpired(User user) {
        return user.getExpirationTime() == null || user.getExpirationTime().after(new Date());
    }

    private void normalizeCondition(Alert alert) {
        if (alert != null && (Alert.TYPE_GEOFENCE_ENTER.equals(alert.getType())
                || Alert.TYPE_GEOFENCE_EXIT.equals(alert.getType())
                || Alert.TYPE_POWER_CUT.equals(alert.getType()))) {
            alert.setLimitValue(0);
            alert.setOperator(null);
            alert.setUnit(null);
            alert.getAttributes().remove("minimumDuration");
            alert.getAttributes().remove("resolveThreshold");
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
        alert.setRecipientIds(getRecipientIds(alert.getId()));
    }

}

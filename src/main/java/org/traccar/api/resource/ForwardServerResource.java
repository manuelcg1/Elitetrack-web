package org.traccar.api.resource;

import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;
import org.traccar.api.BaseResource;
import org.traccar.api.security.MenuKeys;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.forward.CatalogPositionForwarder;
import org.traccar.model.Device;
import org.traccar.model.DeviceForwardServer;
import org.traccar.model.ForwardDelivery;
import org.traccar.model.ForwardServer;
import org.traccar.model.User;
import org.traccar.forward.sutran.SutranEnvironment;
import org.traccar.forward.sutran.SutranTokenCipher;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;
import org.traccar.storage.query.Order;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Stream;

@Path("forward")
public class ForwardServerResource extends BaseResource {

    @Inject
    private CatalogPositionForwarder catalogPositionForwarder;

    @Inject
    SutranTokenCipher sutranTokenCipher;

    @Inject
    Config config;

    void validateServer(ForwardServer server) {
        if (server == null) {
            throw new BadRequestException("Server payload is required");
        }
        if (server.getName() == null || server.getName().isBlank()) {
            throw new BadRequestException("Server name is required");
        }
        server.setName(server.getName().trim());
        String type = server.getType() != null ? server.getType().trim().toUpperCase(Locale.ROOT) : null;
        if (type == null || type.isBlank()) {
            type = ForwardServer.TYPE_GENERIC_JSON;
        }
        if (!ForwardServer.TYPE_GENERIC_JSON.equals(type) && !ForwardServer.TYPE_SUTRAN_V2.equals(type)) {
            throw new BadRequestException("Unsupported forwarding server type");
        }
        server.setType(type);
        if (server.getConnectTimeout() == 0) {
            server.setConnectTimeout(5000);
        }
        if (server.getReadTimeout() == 0) {
            server.setReadTimeout(10000);
        }
        if (server.getMaxAttempts() == 0) {
            server.setMaxAttempts(5);
        }
        if (server.getRetryDelay() == 0) {
            server.setRetryDelay(1000);
        }
        if (ForwardServer.TYPE_SUTRAN_V2.equals(type)) {
            validateSutranServer(server);
        } else {
            validateGenericServer(server);
        }
        if (server.getConnectTimeout() < 100 || server.getConnectTimeout() > 60000
                || server.getReadTimeout() < 100 || server.getReadTimeout() > 120000) {
            throw new BadRequestException("Forwarding timeouts are outside the supported range");
        }
        if (server.getMaxAttempts() < 1 || server.getMaxAttempts() > 20
                || server.getRetryDelay() < 100 || server.getRetryDelay() > 3600000) {
            throw new BadRequestException("Forwarding retry settings are outside the supported range");
        }
    }

    private void validateGenericServer(ForwardServer server) {
        if (server.getIpDominio() == null || server.getIpDominio().isBlank()) {
            throw new BadRequestException("Server URL is required");
        }
        if (server.getUsername() == null || server.getUsername().isBlank()) {
            throw new BadRequestException("Server username is required");
        }
        if (server.getPassword() == null || server.getPassword().isBlank()) {
            throw new BadRequestException("Server password is required");
        }
        if (server.getApiKey() == null || server.getApiKey().isBlank()) {
            throw new BadRequestException("Server API key is required");
        }
        server.setIpDominio(server.getIpDominio().trim());
        server.setUsername(server.getUsername().trim());
        server.setApiKey(server.getApiKey().trim());
        server.setEnvironment("DEVELOPMENT");
        server.setTransmissionEnabled(false);
    }

    private void validateSutranServer(ForwardServer server) {
        String environmentValue = server.getEnvironment() != null
                ? server.getEnvironment().trim().toUpperCase(Locale.ROOT) : null;
        SutranEnvironment environment;
        try {
            environment = SutranEnvironment.valueOf(environmentValue);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BadRequestException("SUTRAN environment must be DEVELOPMENT or PRODUCTION");
        }
        if (server.getApiKey() == null || server.getApiKey().isBlank()) {
            throw new BadRequestException("SUTRAN access token is required");
        }
        String storedToken = server.getApiKey().trim();
        String token;
        try {
            token = sutranTokenCipher.isEncrypted(storedToken)
                    ? sutranTokenCipher.decrypt(storedToken) : storedToken;
            UUID.fromString(token);
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw new BadRequestException("SUTRAN access token must be a UUID");
        }
        server.setEnvironment(environment.name());
        server.setIpDominio(environment.getEndpoint().toString());
        server.setUsername(null);
        server.setPassword(null);
        try {
            server.setApiKey(sutranTokenCipher.isEncrypted(storedToken)
                    ? storedToken : sutranTokenCipher.encrypt(token));
        } catch (IllegalStateException e) {
            throw new BadRequestException("SUTRAN encryption key is not configured");
        }
        if (server.getTransmissionEnabled() && !config.getBoolean(Keys.SUTRAN_TRANSMISSION_ENABLED)) {
            throw new BadRequestException("SUTRAN transmission is disabled by server configuration");
        }
    }

    @Path("servers")
    @GET
    public Stream<ForwardServer> getServers() throws StorageException {
        checkForwardAccess();
        return storage.getObjectsStream(ForwardServer.class, new Request(new Columns.All()))
                .map(this::sanitize);
    }

    @Path("servers")
    @POST
    public Response addServer(ForwardServer server) throws Exception {
        checkForwardManage();
        validateServer(server);
        server.setId(storage.addObject(server, new Request(new Columns.Exclude("id"))));
        catalogPositionForwarder.reload();
        return Response.ok(sanitize(server)).build();
    }

    @Path("servers/{id}")
    @PUT
    public Response updateServer(@PathParam("id") long id, ForwardServer server) throws Exception {
        checkForwardManage();
        ForwardServer existing = storage.getObject(
                ForwardServer.class, new Request(new Columns.All(), new Condition.Equals("id", id)));
        if (existing == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        if (server.getPassword() == null || server.getPassword().isBlank()) {
            server.setPassword(existing.getPassword());
        }
        if (server.getApiKey() == null || server.getApiKey().isBlank()) {
            server.setApiKey(existing.getApiKey());
        }
        validateServer(server);
        server.setId(id);
        storage.updateObject(server, new Request(new Columns.Exclude("id"), new Condition.Equals("id", id)));
        catalogPositionForwarder.reload();
        return Response.ok(sanitize(server)).build();
    }

    @Path("servers/{id}")
    @DELETE
    public Response removeServer(@PathParam("id") long id) throws Exception {
        checkForwardManage();
        for (DeviceForwardServer assignment : storage.getObjects(
                DeviceForwardServer.class,
                new Request(new Columns.Include("id"), new Condition.Equals("serverId", id)))) {
            storage.removeObject(
                    DeviceForwardServer.class, new Request(new Condition.Equals("id", assignment.getId())));
        }
        storage.removeObject(ForwardServer.class, new Request(new Condition.Equals("id", id)));
        catalogPositionForwarder.reload();
        return Response.noContent().build();
    }

    @Path("servers/{id}/devices")
    @GET
    public Stream<DeviceForwardServer> getServerDevices(@PathParam("id") long id) throws Exception {
        checkForwardAccess();
        return storage.getObjectsStream(
                DeviceForwardServer.class,
                new Request(new Columns.All(), new Condition.Equals("serverId", id)));
    }

    @Path("servers/{id}/deliveries")
    @GET
    public Stream<ForwardDelivery> getServerDeliveries(@PathParam("id") long id) throws Exception {
        checkForwardAccess();
        return storage.getObjectsStream(
                ForwardDelivery.class,
                new Request(
                        new Columns.Exclude("payload"),
                        new Condition.Equals("serverId", id),
                        new Order("createdTime", true, 100)));
    }

    @Path("devices/{deviceId}/servers")
    @GET
    public Stream<DeviceForwardServer> getDeviceServers(@PathParam("deviceId") long deviceId) throws Exception {
        permissionsService.checkPermission(Device.class, getUserId(), deviceId);
        return storage.getObjectsStream(
                DeviceForwardServer.class,
                new Request(new Columns.All(), new Condition.Equals("deviceId", deviceId)));
    }

    @Path("devices/{deviceId}/servers")
    @PUT
    public Response updateDeviceServers(@PathParam("deviceId") long deviceId, List<Long> serverIds) throws Exception {
        permissionsService.checkPermission(Device.class, getUserId(), deviceId);
        checkForwardManage();
        if (serverIds == null || serverIds.stream().anyMatch(serverId -> serverId == null || serverId <= 0)) {
            throw new BadRequestException("Server ids are required");
        }
        List<Long> uniqueServerIds = serverIds.stream().distinct().toList();

        for (DeviceForwardServer assignment : storage.getObjects(
                DeviceForwardServer.class,
                new Request(new Columns.Include("id"), new Condition.Equals("deviceId", deviceId)))) {
            storage.removeObject(
                    DeviceForwardServer.class, new Request(new Condition.Equals("id", assignment.getId())));
        }
        for (Long serverId : uniqueServerIds) {
            DeviceForwardServer assignment = new DeviceForwardServer();
            assignment.setDeviceId(deviceId);
            assignment.setServerId(serverId);
            storage.addObject(assignment, new Request(new Columns.Exclude("id")));
        }
        catalogPositionForwarder.reload();
        return Response.noContent().build();
    }

    private User checkForwardAccess() throws StorageException {
        User user = permissionsService.getUser(getUserId());
        if (user == null || user.getMenuKeys() == null || user.getMenuKeys().stream()
                .noneMatch(menuKey -> menuKey.equals(MenuKeys.MONITORING) || menuKey.equals(MenuKeys.SETTINGS))) {
            throw new SecurityException("Forwarding access required");
        }
        return user;
    }

    private void checkForwardManage() throws StorageException {
        checkForwardAccess();
        permissionsService.checkManager(getUserId());
    }

    private ForwardServer sanitize(ForwardServer server) {
        ForwardServer sanitized = new ForwardServer();
        sanitized.setId(server.getId());
        sanitized.setName(server.getName());
        sanitized.setIpDominio(server.getIpDominio());
        sanitized.setUsername(server.getUsername());
        sanitized.setType(server.getType());
        sanitized.setEnvironment(server.getEnvironment());
        sanitized.setConnectTimeout(server.getConnectTimeout());
        sanitized.setReadTimeout(server.getReadTimeout());
        sanitized.setMaxAttempts(server.getMaxAttempts());
        sanitized.setRetryDelay(server.getRetryDelay());
        sanitized.setTransmissionEnabled(server.getTransmissionEnabled());
        sanitized.setApiKeyConfigured(server.getApiKey() != null && !server.getApiKey().isBlank());
        sanitized.setActive(server.getActive());
        return sanitized;
    }

}

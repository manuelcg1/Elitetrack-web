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
import org.traccar.forward.CatalogPositionForwarder;
import org.traccar.model.Device;
import org.traccar.model.DeviceForwardServer;
import org.traccar.model.ForwardServer;
import org.traccar.model.User;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.List;
import java.util.stream.Stream;

@Path("forward")
public class ForwardServerResource extends BaseResource {

    @Inject
    private CatalogPositionForwarder catalogPositionForwarder;

    private void validateServer(ForwardServer server) {
        if (server == null) {
            throw new BadRequestException("Server payload is required");
        }
        if (server.getName() == null || server.getName().isBlank()) {
            throw new BadRequestException("Server name is required");
        }
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
        server.setName(server.getName().trim());
        server.setIpDominio(server.getIpDominio().trim());
        server.setUsername(server.getUsername().trim());
        server.setApiKey(server.getApiKey().trim());
    }

    @Path("servers")
    @GET
    public Stream<ForwardServer> getServers() throws StorageException {
        User user = checkForwardAccess();
        boolean includeSecrets = canManageForward(user);
        return storage.getObjectsStream(ForwardServer.class, new Request(new Columns.All()))
                .map((server) -> includeSecrets ? server : sanitize(server));
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

    private boolean canManageForward(User user) {
        return user.getAdministrator() || user.getUserLimit() != 0;
    }

    private ForwardServer sanitize(ForwardServer server) {
        ForwardServer sanitized = new ForwardServer();
        sanitized.setId(server.getId());
        sanitized.setName(server.getName());
        sanitized.setIpDominio(server.getIpDominio());
        sanitized.setUsername(server.getUsername());
        sanitized.setActive(server.getActive());
        return sanitized;
    }

}

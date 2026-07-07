package org.traccar.api.resource;

import org.traccar.api.BaseResource;
import org.traccar.api.security.MenuKeys;
import org.traccar.model.Role;
import org.traccar.model.RoleMenu;
import org.traccar.model.User;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Order;
import org.traccar.storage.query.Request;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;

@Path("roles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RoleResource extends BaseResource {

    @GET
    public List<Role> get() throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ROLES);
        List<Role> roles = storage.getObjects(Role.class, new Request(
                new Columns.All(), null, new Order("name")));
        for (Role role : roles) {
            loadMenus(role);
            loadUserCount(role);
        }
        return roles;
    }

    @Path("menus")
    @GET
    public List<Map<String, String>> getMenus() throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ROLES);
        return MenuKeys.DEFINITIONS;
    }

    @Path("assign")
    @POST
    public Response assign(Map<String, Long> assignment) throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ROLES);
        if (assignment == null) {
            throw new BadRequestException("Assignment payload is required");
        }
        long userId = assignment.getOrDefault("userId", 0L);
        long roleId = assignment.getOrDefault("roleId", 0L);
        if (userId <= 0 || roleId <= 0) {
            throw new BadRequestException("User and role are required");
        }
        permissionsService.checkUser(getUserId(), userId);
        if (storage.getObject(Role.class, new Request(
                new Columns.Include("id"), new Condition.Equals("id", roleId))) == null) {
            throw new WebApplicationException(Response.Status.BAD_REQUEST);
        }
        User user = storage.getObject(User.class, new Request(
                new Columns.Include("id", "roleId"), new Condition.Equals("id", userId)));
        if (user == null) {
            throw new WebApplicationException(Response.Status.NOT_FOUND);
        }
        user.setRoleId(roleId);
        storage.updateObject(user, new Request(
                new Columns.Include("roleId"),
                new Condition.Equals("id", userId)));
        return Response.noContent().build();
    }

    @Path("{id}")
    @GET
    public Role getSingle(@PathParam("id") long id) throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ROLES);
        Role role = storage.getObject(Role.class, new Request(
                new Columns.All(), new Condition.Equals("id", id)));
        if (role == null) {
            throw new WebApplicationException(Response.Status.NOT_FOUND);
        }
        loadMenus(role);
        loadUserCount(role);
        return role;
    }

    @POST
    public Response add(Role role) throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ROLES);
        validate(role);
        role.setId(storage.addObject(role, new Request(new Columns.Exclude("id"))));
        saveMenus(role);
        return Response.ok(getSingle(role.getId())).build();
    }

    @Path("{id}")
    @PUT
    public Response update(@PathParam("id") long id, Role role) throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ROLES);
        validate(role);
        role.setId(id);
        storage.updateObject(role, new Request(
                new Columns.Exclude("id"),
                new Condition.Equals("id", id)));
        saveMenus(role);
        return Response.ok(getSingle(id)).build();
    }

    @Path("{id}")
    @DELETE
    public Response remove(@PathParam("id") long id) throws StorageException {
        permissionsService.checkMenuAccess(getUserId(), MenuKeys.ROLES);
        List<User> users = storage.getObjects(User.class, new Request(
                new Columns.Include("id"), new Condition.Equals("roleId", id)));
        if (!users.isEmpty()) {
            throw new WebApplicationException("Role has assigned users", Response.Status.CONFLICT);
        }
        storage.removeObject(Role.class, new Request(new Condition.Equals("id", id)));
        return Response.noContent().build();
    }

    private void validate(Role role) {
        if (role == null) {
            throw new BadRequestException("Role payload is required");
        }
        if (role.getName() == null || role.getName().trim().isEmpty()) {
            throw new WebApplicationException("Role name is required", Response.Status.BAD_REQUEST);
        }
        role.setName(role.getName().trim());
        if (role.getMenuKeys() == null) {
            throw new BadRequestException("Role menus are required");
        }
        if (!MenuKeys.ALL.containsAll(role.getMenuKeys())) {
            throw new WebApplicationException("Unknown menu key", Response.Status.BAD_REQUEST);
        }
    }

    private void loadMenus(Role role) throws StorageException {
        storage.getObjects(RoleMenu.class, new Request(
                new Columns.All(), new Condition.Equals("roleId", role.getId()), new Order("menuKey")))
                .forEach((roleMenu) -> role.getMenuKeys().add(roleMenu.getMenuKey()));
    }

    private void loadUserCount(Role role) throws StorageException {
        role.setUserCount(storage.getObjects(User.class, new Request(
                new Columns.Include("id"), new Condition.Equals("roleId", role.getId()))).size());
    }

    private void saveMenus(Role role) throws StorageException {
        storage.removeObject(RoleMenu.class, new Request(new Condition.Equals("roleId", role.getId())));
        for (String menuKey : role.getMenuKeys()) {
            RoleMenu roleMenu = new RoleMenu();
            roleMenu.setRoleId(role.getId());
            roleMenu.setMenuKey(menuKey);
            storage.addObject(roleMenu, new Request(new Columns.Exclude("id")));
        }
    }

}

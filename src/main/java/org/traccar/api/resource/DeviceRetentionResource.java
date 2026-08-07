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
import org.traccar.model.DeviceRetentionPolicy;
import org.traccar.retention.DeviceRetentionRepository;
import org.traccar.retention.DeviceRetentionService;

import java.util.List;

@Path("retention")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DeviceRetentionResource extends BaseResource {

    public record PolicyUpdate(boolean enabled, Integer retentionDays) {
    }

    public record BulkUpdate(List<Long> deviceIds, boolean enabled, Integer retentionDays) {
    }

    public record RunRequest(Boolean dryRun) {
    }

    @Inject
    private DeviceRetentionRepository repository;

    @Inject
    private DeviceRetentionService service;

    private void checkAdmin() throws Exception {
        permissionsService.checkAdmin(getUserId());
    }

    @GET
    @Path("policies")
    public List<DeviceRetentionPolicy> getPolicies() throws Exception {
        checkAdmin();
        return repository.getAll();
    }

    @GET
    @Path("policies/{deviceId}")
    public DeviceRetentionPolicy getPolicy(@PathParam("deviceId") long deviceId) throws Exception {
        checkAdmin();
        service.requireDevice(deviceId);
        DeviceRetentionPolicy policy = repository.get(deviceId);
        return policy != null ? policy : defaultPolicy(deviceId);
    }

    @PUT
    @Path("policies/{deviceId}")
    public DeviceRetentionPolicy updatePolicy(
            @PathParam("deviceId") long deviceId, PolicyUpdate update) throws Exception {
        checkAdmin();
        service.requireDevice(deviceId);
        DeviceRetentionPolicy policy = policy(deviceId, update.enabled(), update.retentionDays());
        repository.save(policy, getUserId());
        return repository.get(deviceId);
    }

    @DELETE
    @Path("policies/{deviceId}")
    public Response deletePolicy(@PathParam("deviceId") long deviceId) throws Exception {
        checkAdmin();
        repository.remove(deviceId);
        return Response.noContent().build();
    }

    @PUT
    @Path("policies/bulk")
    public Response updateBulk(BulkUpdate update) throws Exception {
        checkAdmin();
        if (update == null || update.deviceIds() == null || update.deviceIds().isEmpty()) {
            throw new IllegalArgumentException("Device ids are required");
        }
        int retentionDays = days(update.retentionDays());
        for (long deviceId : update.deviceIds()) {
            service.requireDevice(deviceId);
        }
        repository.saveBulk(update.deviceIds(), update.enabled(), retentionDays, getUserId());
        return Response.ok().build();
    }

    @POST
    @Path("policies/{deviceId}/preview")
    public DeviceRetentionService.Preview preview(@PathParam("deviceId") long deviceId) throws Exception {
        checkAdmin();
        DeviceRetentionPolicy policy = repository.get(deviceId);
        if (policy == null) {
            throw new IllegalArgumentException("Retention policy does not exist");
        }
        return service.preview(policy);
    }

    @POST
    @Path("policies/{deviceId}/run")
    public Response run(@PathParam("deviceId") long deviceId, RunRequest request) throws Exception {
        checkAdmin();
        Boolean dryRun = request != null ? request.dryRun() : null;
        if (!service.submit(deviceId, getUserId(), dryRun)) {
            return Response.status(Response.Status.CONFLICT).entity("Retention is already running").build();
        }
        return Response.accepted().build();
    }

    @GET
    @Path("status/{deviceId}")
    public DeviceRetentionPolicy status(@PathParam("deviceId") long deviceId) throws Exception {
        return getPolicy(deviceId);
    }

    private DeviceRetentionPolicy defaultPolicy(long deviceId) {
        return policy(deviceId, false, 60);
    }

    private DeviceRetentionPolicy policy(long deviceId, boolean enabled, Integer retentionDays) {
        DeviceRetentionPolicy policy = new DeviceRetentionPolicy();
        policy.setDeviceId(deviceId);
        policy.setEnabled(enabled);
        policy.setRetentionDays(days(retentionDays));
        service.validate(policy);
        return policy;
    }

    private int days(Integer value) {
        if (value == null) {
            throw new IllegalArgumentException("Retention days are required");
        }
        return value;
    }
}

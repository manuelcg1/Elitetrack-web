/*
 * Copyright 2026 EliteTrack
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.traccar.api.resource;

import java.util.List;
import java.util.Date;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.traccar.api.SimpleObjectResource;
import org.traccar.inventory.GpsInventoryInspectionService;
import org.traccar.inventory.GpsInventoryAssignmentService;
import org.traccar.model.GpsInventory;
import org.traccar.model.GpsInventoryAssignment;
import org.traccar.model.GpsInventoryEvent;
import org.traccar.model.GpsInventoryInspection;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Order;
import org.traccar.storage.query.Request;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.inject.Inject;

/**
 * Endpoint REST para el inventario de GPS.
 * Hereda automáticamente GET/POST/PUT/DELETE + permisos vía
 * SimpleObjectResource, igual que GroupResource.
 *
 * Rutas expuestas:
 *   GET    /api/gps-inventory
 *   GET    /api/gps-inventory/{id}
 *   POST   /api/gps-inventory
 *   PUT    /api/gps-inventory/{id}
 *   DELETE /api/gps-inventory/{id}
 */
@Path("gps-inventory")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GpsInventoryResource extends SimpleObjectResource<GpsInventory> {

    private static final int DEFAULT_HISTORY_LIMIT = 100;
    private static final int MAX_HISTORY_LIMIT = 1000;
    private static final int MAX_IDENTIFIER_LENGTH = 128;

    @Inject
    private GpsInventoryInspectionService inspectionService;

    @Inject
    private GpsInventoryAssignmentService assignmentService;

    public record History(
            GpsInventory inventory,
            List<GpsInventoryAssignment> assignments,
            List<GpsInventoryInspection> inspections,
            List<GpsInventoryEvent> events) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StartInspection(String notes) {
    }

    public record CompleteInspection(
            String result, String findings, String actionsTaken, Date nextInspectionAt, String notes) {
    }

    public record CreatedInspection(long id) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AssignDevice(long deviceId, String reason, String notes) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UnassignDevice(String reason, String targetStatus, String notes) {
    }

    public record CreatedAssignment(long id) {
    }

    public GpsInventoryResource() {
        super(GpsInventory.class, "imei", List.of("imei", "brand", "model", "serialNumber", "status"));
    }

    private int safeLimit(int limit) {
        return limit > 0 ? Math.min(limit, MAX_HISTORY_LIMIT) : DEFAULT_HISTORY_LIMIT;
    }

    private int safeOffset(int offset) {
        return Math.max(offset, 0);
    }

    private GpsInventory requireInventory(long id) throws StorageException {
        permissionsService.checkPermission(GpsInventory.class, getUserId(), id);
        GpsInventory inventory = storage.getObject(GpsInventory.class, new Request(
                new Columns.All(), new Condition.Equals("id", id)));
        if (inventory == null) {
            throw new NotFoundException();
        }
        return inventory;
    }

    private void validateIdentifier(GpsInventory entity) {
        if (entity == null || entity.getImei() == null) {
            throw new IllegalArgumentException("GPS identifier is required");
        }
        String identifier = entity.getImei().trim();
        if (identifier.isEmpty() || identifier.length() > MAX_IDENTIFIER_LENGTH
                || !identifier.matches("[\\p{L}\\p{N}]+")) {
            throw new IllegalArgumentException(
                    "GPS identifier must contain between 1 and 128 letters or numbers without spaces");
        }
        entity.setImei(identifier);
    }

    @Override
    @POST
    public Response add(GpsInventory entity) throws Exception {
        validateIdentifier(entity);
        return super.add(entity);
    }

    @Override
    @Path("{id}")
    @PUT
    public Response update(GpsInventory entity) throws Exception {
        validateIdentifier(entity);
        GpsInventory current = requireInventory(entity.getId());
        entity.setRegisteredAt(current.getRegisteredAt());
        entity.setRegisteredBy(current.getRegisteredBy());
        entity.setDeviceId(current.getDeviceId());
        entity.setUpdatedAt(current.getUpdatedAt());
        entity.setUpdatedBy(current.getUpdatedBy());
        entity.setRetiredAt(current.getRetiredAt());
        entity.setRetiredBy(current.getRetiredBy());
        entity.setRetirementReason(current.getRetirementReason());
        return super.update(entity);
    }

    private List<GpsInventoryAssignment> loadAssignments(long id, int limit, int offset) throws StorageException {
        return storage.getObjects(GpsInventoryAssignment.class, new Request(
                new Columns.All(),
                new Condition.Equals("gpsInventoryId", id),
                new Order("assignedAt", true, safeLimit(limit), safeOffset(offset))));
    }

    private List<GpsInventoryInspection> loadInspections(long id, int limit, int offset) throws StorageException {
        return storage.getObjects(GpsInventoryInspection.class, new Request(
                new Columns.All(),
                new Condition.Equals("gpsInventoryId", id),
                new Order("startedAt", true, safeLimit(limit), safeOffset(offset))));
    }

    private List<GpsInventoryEvent> loadEvents(long id, int limit, int offset) throws StorageException {
        return storage.getObjects(GpsInventoryEvent.class, new Request(
                new Columns.All(),
                new Condition.Equals("gpsInventoryId", id),
                new Order("eventTime", true, safeLimit(limit), safeOffset(offset))));
    }

    @Path("{id}/assignments")
    @GET
    public List<GpsInventoryAssignment> getAssignments(
            @PathParam("id") long id, @QueryParam("limit") int limit, @QueryParam("offset") int offset)
            throws StorageException {
        requireInventory(id);
        return loadAssignments(id, limit, offset);
    }

    @Path("{id}/assignments")
    @POST
    public Response assignDevice(@PathParam("id") long id, AssignDevice request) throws Exception {
        requireInventory(id);
        permissionsService.checkEdit(getUserId(), GpsInventory.class, false, false);
        if (request == null || request.deviceId() <= 0) {
            throw new IllegalArgumentException("Device is required");
        }
        long assignmentId = assignmentService.assign(
                id, request.deviceId(), getUserId(), request.reason(), request.notes());
        return Response.ok(new CreatedAssignment(assignmentId)).build();
    }

    @Path("{id}/assignments/unassign")
    @POST
    public Response unassignDevice(@PathParam("id") long id, UnassignDevice request) throws Exception {
        requireInventory(id);
        permissionsService.checkEdit(getUserId(), GpsInventory.class, false, false);
        if (request == null) {
            throw new IllegalArgumentException("Unassignment data is required");
        }
        assignmentService.unassign(
                id, getUserId(), request.reason(), request.targetStatus(), request.notes());
        return Response.noContent().build();
    }

    @Path("{id}/assignments/reassign")
    @POST
    public Response reassignDevice(@PathParam("id") long id, AssignDevice request) throws Exception {
        requireInventory(id);
        permissionsService.checkEdit(getUserId(), GpsInventory.class, false, false);
        if (request == null || request.deviceId() <= 0) {
            throw new IllegalArgumentException("Device is required");
        }
        long assignmentId = assignmentService.reassign(
                id, request.deviceId(), getUserId(), request.reason(), request.notes());
        return Response.ok(new CreatedAssignment(assignmentId)).build();
    }

    @Path("{id}/inspections")
    @GET
    public List<GpsInventoryInspection> getInspections(
            @PathParam("id") long id, @QueryParam("limit") int limit, @QueryParam("offset") int offset)
            throws StorageException {
        requireInventory(id);
        return loadInspections(id, limit, offset);
    }

    @Path("{id}/inspections")
    @POST
    public Response startInspection(@PathParam("id") long id, StartInspection request) throws Exception {
        requireInventory(id);
        permissionsService.checkEdit(getUserId(), GpsInventory.class, false, false);
        long inspectionId = inspectionService.start(id, getUserId(), request != null ? request.notes() : null);
        return Response.ok(new CreatedInspection(inspectionId)).build();
    }

    @Path("{id}/inspections/{inspectionId}/complete")
    @POST
    public Response completeInspection(
            @PathParam("id") long id, @PathParam("inspectionId") long inspectionId,
            CompleteInspection request) throws Exception {
        requireInventory(id);
        permissionsService.checkEdit(getUserId(), GpsInventory.class, false, false);
        if (request == null || request.result() == null) {
            throw new IllegalArgumentException("Inspection result is required");
        }
        inspectionService.complete(
                id, inspectionId, getUserId(), request.result(), request.findings(),
                request.actionsTaken(), request.nextInspectionAt(), request.notes());
        return Response.noContent().build();
    }

    @Path("{id}/events")
    @GET
    public List<GpsInventoryEvent> getEvents(
            @PathParam("id") long id, @QueryParam("limit") int limit, @QueryParam("offset") int offset)
            throws StorageException {
        requireInventory(id);
        return loadEvents(id, limit, offset);
    }

    @Path("{id}/history")
    @GET
    public History getHistory(
            @PathParam("id") long id, @QueryParam("limit") int limit, @QueryParam("offset") int offset)
            throws StorageException {
        GpsInventory inventory = requireInventory(id);
        return new History(
                inventory,
                loadAssignments(id, limit, offset),
                loadInspections(id, limit, offset),
                loadEvents(id, limit, offset));
    }

}

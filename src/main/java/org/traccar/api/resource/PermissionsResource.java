/*
 * Copyright 2017 - 2022 Anton Tananaev (anton@traccar.org)
 * Copyright 2017 Andrey Kunitsyn (andrey@traccar.org)
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

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Context;
import org.traccar.api.BaseResource;
import org.traccar.helper.LogAction;
import org.traccar.model.Permission;
import org.traccar.model.UserRestrictions;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.StorageException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.ArrayList;
import java.util.HashSet;

@Path("permissions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PermissionsResource  extends BaseResource {

    private static final Logger LOGGER = LoggerFactory.getLogger(PermissionsResource.class);
    private static final int MAX_BATCH_SIZE = 10000;

    public record PermissionBatch(
            List<LinkedHashMap<String, Long>> additions, List<LinkedHashMap<String, Long>> removals) {
    }

    @Inject
    private CacheManager cacheManager;

    @Inject
    private LogAction actionLogger;

    @Context
    private HttpServletRequest request;

    private void checkPermission(Permission permission) throws StorageException {
        if (permissionsService.notAdmin(getUserId())) {
            permissionsService.checkPermission(permission.getOwnerClass(), getUserId(), permission.getOwnerId());
            permissionsService.checkPermission(permission.getPropertyClass(), getUserId(), permission.getPropertyId());
        }
    }

    private void checkPermissionTypes(List<LinkedHashMap<String, Long>> entities) {
        if (entities == null) {
            throw new jakarta.ws.rs.BadRequestException("Permission list is required");
        }
        Set<String> keys = null;
        for (LinkedHashMap<String, Long> entity: entities) {
            if (entity == null || keys != null && !entity.keySet().equals(keys)) {
                throw new WebApplicationException(Response.status(Response.Status.BAD_REQUEST).build());
            }
            keys = entity.keySet();
        }
    }

    @Path("bulk")
    @POST
    public Response add(List<LinkedHashMap<String, Long>> entities) throws Exception {
        checkPermissionTypes(entities);
        return updateBatch(new PermissionBatch(entities, List.of()));
    }

    @POST
    public Response add(LinkedHashMap<String, Long> entity) throws Exception {
        return add(Collections.singletonList(entity));
    }

    @DELETE
    @Path("bulk")
    public Response remove(List<LinkedHashMap<String, Long>> entities) throws Exception {
        checkPermissionTypes(entities);
        return updateBatch(new PermissionBatch(List.of(), entities));
    }

    @DELETE
    public Response remove(LinkedHashMap<String, Long> entity) throws Exception {
        return remove(Collections.singletonList(entity));
    }

    @POST
    @Path("batch")
    public Response updateBatch(PermissionBatch batch) throws StorageException {
        permissionsService.checkRestriction(getUserId(), UserRestrictions::getReadonly);
        if (batch == null || batch.additions() == null || batch.removals() == null
                || (long) batch.additions().size() + batch.removals().size() > MAX_BATCH_SIZE) {
            throw new jakarta.ws.rs.BadRequestException("Invalid permission batch (maximum 10000 changes)");
        }
        Set<String> seen = new HashSet<>();
        List<Permission> additions = validatePermissions(batch.additions(), seen);
        List<Permission> removals = validatePermissions(batch.removals(), seen);
        if (additions.isEmpty() && removals.isEmpty()) {
            return Response.noContent().build();
        }
        // Authorize the entire request before its first write; commit before notifying any cache or audit sink.
        storage.updatePermissions(additions, removals);
        boolean refreshPending = false;
        try {
            cacheManager.invalidatePermissions(additions, removals);
        } catch (Exception e) {
            refreshPending = true;
            LOGGER.error("Permissions committed but cache refresh failed for actor {}", getUserId(), e);
        }
        boolean auditPending = false;
        for (boolean link : List.of(false, true)) {
            for (Permission permission : link ? additions : removals) {
                try {
                    if (link) {
                        actionLogger.link(request, getUserId(), permission.getOwnerClass(), permission.getOwnerId(),
                                permission.getPropertyClass(), permission.getPropertyId());
                    } else {
                        actionLogger.unlink(request, getUserId(), permission.getOwnerClass(), permission.getOwnerId(),
                                permission.getPropertyClass(), permission.getPropertyId());
                    }
                } catch (RuntimeException e) {
                    auditPending = true;
                    LOGGER.error("Permissions committed but audit failed for actor {}", getUserId(), e);
                }
            }
        }
        // A post-commit failure must not masquerade as a transaction rollback.
        return Response.noContent().header("X-Permission-Refresh", refreshPending ? "pending" : "complete")
                .header("X-Permission-Audit", auditPending ? "pending" : "complete").build();
    }

    private List<Permission> validatePermissions(List<LinkedHashMap<String, Long>> entities, Set<String> seen)
            throws StorageException {
        List<Permission> permissions = new ArrayList<>();
        for (var entity : entities) {
            if (entity == null || entity.size() != 2) {
                throw new jakarta.ws.rs.BadRequestException("Each permission requires two identifiers");
            }
            for (var entry : entity.entrySet()) {
                String key = entry.getKey();
                var clazz = key != null && key.endsWith("Id") ? Permission.getKeyClass(key) : null;
                if (clazz == null || !Permission.getKey(clazz).equals(key)
                        || entry.getValue() == null || entry.getValue() <= 0) {
                    throw new jakarta.ws.rs.BadRequestException("Invalid permission identifier");
                }
            }
            Permission permission = new Permission(entity);
            String identity = permission.getStorageName() + ":" + permission.getOwnerId()
                    + ":" + permission.getPropertyId();
            if (!seen.add(identity)) {
                throw new jakarta.ws.rs.BadRequestException("Duplicate or conflicting permission change");
            }
            checkPermission(permission);
            permissions.add(permission);
        }
        return permissions;
    }

}

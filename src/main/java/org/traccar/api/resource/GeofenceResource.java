/*
 * Copyright 2016 - 2026 Anton Tananaev (anton@traccar.org)
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

import org.traccar.api.ExtendedObjectResource;
import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.model.Geofence;
import org.traccar.storage.StorageException;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("geofences")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GeofenceResource extends ExtendedObjectResource<Geofence> {

    @Inject
    protected GeofenceReadAccessService readAccessService;

    public GeofenceResource() {
        super(Geofence.class, "name", List.of("name"));
    }

    // Separate from the direct-assignment list used by the Connections editor.
    @GET
    @Path("read-access")
    public Response getReadAccess() throws StorageException {
        return Response.ok(readAccessService.getReadAccess(getUserId()))
                .header("Cache-Control", "no-store").build();
    }

    @GET
    @Path("read-access/{id}")
    public Response getReadableGeofence(@PathParam("id") long id) throws StorageException {
        Geofence result = readAccessService.getReadAccess(getUserId()).geofences().stream()
                .map(GeofenceReadAccessService.GeofenceEntry::geofence)
                .filter(geofence -> geofence.getId() == id)
                .findFirst().orElseThrow(NotFoundException::new);
        return Response.ok(result).header("Cache-Control", "no-store").build();
    }

}

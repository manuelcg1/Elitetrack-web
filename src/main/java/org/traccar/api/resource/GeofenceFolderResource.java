package org.traccar.api.resource;

import java.util.List;

import org.traccar.api.ExtendedObjectResource;
import org.traccar.model.GeofenceFolder;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("geofenceFolders")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GeofenceFolderResource extends ExtendedObjectResource<GeofenceFolder> {

    public GeofenceFolderResource() {
        super(GeofenceFolder.class, "name", List.of("name"));
    }

}
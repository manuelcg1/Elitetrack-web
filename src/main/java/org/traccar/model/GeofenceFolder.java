package org.traccar.model;

import org.traccar.storage.StorageName;

@StorageName("tc_geofence_folders")
public class GeofenceFolder extends ExtendedModel {

    private String name;

    private String description;

    private long parentid;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public long getParentid() {
        return parentid;
    }

    public void setParentid(long parentid) {
        this.parentid = parentid;
    }

}
package org.traccar.model;

import org.traccar.storage.StorageName;

@StorageName("tc_alert_geofence_groups")
public class SpeedAlertGeofenceGroup extends BaseModel {

    private long alertId;
    private long geofenceGroupId;

    public long getAlertId() {
        return alertId;
    }

    public void setAlertId(long alertId) {
        this.alertId = alertId;
    }

    public long getGeofenceGroupId() {
        return geofenceGroupId;
    }

    public void setGeofenceGroupId(long geofenceGroupId) {
        this.geofenceGroupId = geofenceGroupId;
    }

}

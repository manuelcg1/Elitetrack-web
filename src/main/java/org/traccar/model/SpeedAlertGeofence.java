package org.traccar.model;

import org.traccar.storage.StorageName;

@StorageName("alert_geofences")
public class SpeedAlertGeofence extends BaseModel {

    private long alertId;
    private long geofenceId;

    public long getAlertId() {
        return alertId;
    }

    public void setAlertId(long alertId) {
        this.alertId = alertId;
    }

    public long getGeofenceId() {
        return geofenceId;
    }

    public void setGeofenceId(long geofenceId) {
        this.geofenceId = geofenceId;
    }

}

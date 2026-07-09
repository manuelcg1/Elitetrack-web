package org.traccar.model;

import org.traccar.storage.StorageName;

@StorageName("tc_alert_geofences")
public class AlertGeofence extends BaseModel {

    private long alertId;
    private Long geofenceId;
    private Long groupId;

    public long getAlertId() {
        return alertId;
    }

    public void setAlertId(long alertId) {
        this.alertId = alertId;
    }

    public Long getGeofenceId() {
        return geofenceId;
    }

    public void setGeofenceId(Long geofenceId) {
        this.geofenceId = geofenceId;
    }

    public Long getGroupId() {
        return groupId;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }

}

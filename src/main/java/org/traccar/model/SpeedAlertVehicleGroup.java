package org.traccar.model;

import org.traccar.storage.StorageName;

@StorageName("tc_alert_vehicle_groups")
public class SpeedAlertVehicleGroup extends BaseModel {

    private long alertId;
    private long groupId;

    public long getAlertId() {
        return alertId;
    }

    public void setAlertId(long alertId) {
        this.alertId = alertId;
    }

    public long getGroupId() {
        return groupId;
    }

    public void setGroupId(long groupId) {
        this.groupId = groupId;
    }

}

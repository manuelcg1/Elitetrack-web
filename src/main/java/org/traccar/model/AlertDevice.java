package org.traccar.model;

import org.traccar.storage.StorageName;

@StorageName("tc_alert_devices")
public class AlertDevice extends BaseModel {

    private long alertId;
    private Long deviceId;
    private Long groupId;

    public long getAlertId() {
        return alertId;
    }

    public void setAlertId(long alertId) {
        this.alertId = alertId;
    }

    public Long getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(Long deviceId) {
        this.deviceId = deviceId;
    }

    public Long getGroupId() {
        return groupId;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }

}

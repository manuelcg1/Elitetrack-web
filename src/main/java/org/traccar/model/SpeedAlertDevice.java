package org.traccar.model;

import org.traccar.storage.StorageName;

@StorageName("alert_devices")
public class SpeedAlertDevice extends BaseModel {

    private long alertId;
    private long deviceId;

    public long getAlertId() {
        return alertId;
    }

    public void setAlertId(long alertId) {
        this.alertId = alertId;
    }

    public long getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(long deviceId) {
        this.deviceId = deviceId;
    }

}

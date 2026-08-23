package org.traccar.model;

import java.util.Date;

import org.traccar.storage.StorageName;

@StorageName("tc_gps_inventory_events")
public class GpsInventoryEvent extends ExtendedModel {

    private long gpsInventoryId;
    public long getGpsInventoryId() { return gpsInventoryId; }
    public void setGpsInventoryId(long gpsInventoryId) { this.gpsInventoryId = gpsInventoryId; }

    private Date eventTime;
    public Date getEventTime() { return eventTime; }
    public void setEventTime(Date eventTime) { this.eventTime = eventTime; }

    private String eventType;
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    private Long deviceId;
    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }

    private String deviceNameSnapshot;
    public String getDeviceNameSnapshot() { return deviceNameSnapshot; }
    public void setDeviceNameSnapshot(String deviceNameSnapshot) { this.deviceNameSnapshot = deviceNameSnapshot; }

    private String deviceUniqueIdSnapshot;
    public String getDeviceUniqueIdSnapshot() { return deviceUniqueIdSnapshot; }
    public void setDeviceUniqueIdSnapshot(String deviceUniqueIdSnapshot) {
        this.deviceUniqueIdSnapshot = deviceUniqueIdSnapshot;
    }

    private Long userId;
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    private String notes;
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

}

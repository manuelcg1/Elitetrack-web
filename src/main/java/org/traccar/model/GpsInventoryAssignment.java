package org.traccar.model;

import java.util.Date;

import org.traccar.storage.StorageName;

@StorageName("tc_gps_inventory_assignments")
public class GpsInventoryAssignment extends ExtendedModel {

    private long gpsInventoryId;
    public long getGpsInventoryId() { return gpsInventoryId; }
    public void setGpsInventoryId(long gpsInventoryId) { this.gpsInventoryId = gpsInventoryId; }

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

    private Date assignedAt;
    public Date getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Date assignedAt) { this.assignedAt = assignedAt; }

    private Long assignedBy;
    public Long getAssignedBy() { return assignedBy; }
    public void setAssignedBy(Long assignedBy) { this.assignedBy = assignedBy; }

    private Date unassignedAt;
    public Date getUnassignedAt() { return unassignedAt; }
    public void setUnassignedAt(Date unassignedAt) { this.unassignedAt = unassignedAt; }

    private Long unassignedBy;
    public Long getUnassignedBy() { return unassignedBy; }
    public void setUnassignedBy(Long unassignedBy) { this.unassignedBy = unassignedBy; }

    private String assignmentReason;
    public String getAssignmentReason() { return assignmentReason; }
    public void setAssignmentReason(String assignmentReason) { this.assignmentReason = assignmentReason; }

    private String unassignmentReason;
    public String getUnassignmentReason() { return unassignmentReason; }
    public void setUnassignmentReason(String unassignmentReason) { this.unassignmentReason = unassignmentReason; }

    private String notes;
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

}

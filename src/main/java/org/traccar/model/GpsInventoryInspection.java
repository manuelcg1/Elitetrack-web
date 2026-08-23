package org.traccar.model;

import java.util.Date;

import org.traccar.storage.StorageName;

@StorageName("tc_gps_inventory_inspections")
public class GpsInventoryInspection extends ExtendedModel {

    private long gpsInventoryId;
    public long getGpsInventoryId() { return gpsInventoryId; }
    public void setGpsInventoryId(long gpsInventoryId) { this.gpsInventoryId = gpsInventoryId; }

    private Date startedAt;
    public Date getStartedAt() { return startedAt; }
    public void setStartedAt(Date startedAt) { this.startedAt = startedAt; }

    private Date completedAt;
    public Date getCompletedAt() { return completedAt; }
    public void setCompletedAt(Date completedAt) { this.completedAt = completedAt; }

    private Long technicianUserId;
    public Long getTechnicianUserId() { return technicianUserId; }
    public void setTechnicianUserId(Long technicianUserId) { this.technicianUserId = technicianUserId; }

    private String result;
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    private String findings;
    public String getFindings() { return findings; }
    public void setFindings(String findings) { this.findings = findings; }

    private String actionsTaken;
    public String getActionsTaken() { return actionsTaken; }
    public void setActionsTaken(String actionsTaken) { this.actionsTaken = actionsTaken; }

    private Date nextInspectionAt;
    public Date getNextInspectionAt() { return nextInspectionAt; }
    public void setNextInspectionAt(Date nextInspectionAt) { this.nextInspectionAt = nextInspectionAt; }

    private String notes;
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

}

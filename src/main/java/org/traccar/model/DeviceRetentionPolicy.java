package org.traccar.model;

import java.util.Date;

public class DeviceRetentionPolicy {

    private long deviceId;
    private boolean enabled;
    private int retentionDays = 60;
    private Date lastCleanup;
    private String lastStatus;
    private Long lastDeleted;
    private String lastError;
    private Date createdAt;
    private Date updatedAt;
    private Long updatedBy;

    public long getDeviceId() { return deviceId; }
    public void setDeviceId(long deviceId) { this.deviceId = deviceId; }
    public boolean getEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getRetentionDays() { return retentionDays; }
    public void setRetentionDays(int retentionDays) { this.retentionDays = retentionDays; }
    public Date getLastCleanup() { return lastCleanup; }
    public void setLastCleanup(Date lastCleanup) { this.lastCleanup = lastCleanup; }
    public String getLastStatus() { return lastStatus; }
    public void setLastStatus(String lastStatus) { this.lastStatus = lastStatus; }
    public Long getLastDeleted() { return lastDeleted; }
    public void setLastDeleted(Long lastDeleted) { this.lastDeleted = lastDeleted; }
    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}

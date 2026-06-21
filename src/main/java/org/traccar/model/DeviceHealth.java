package org.traccar.model;

import java.util.Date;

public class DeviceHealth {

    private long deviceId;
    private String name;
    private String uniqueId;
    private String status;
    private Date lastUpdate;
    private boolean online;
    private boolean noReport;
    private boolean invalidPosition;
    private boolean lowBattery;
    private Double batteryLevel;
    private String issue;

    private String severity;
    private Long minutesSinceLastUpdate;
    
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public Long getMinutesSinceLastUpdate() { return minutesSinceLastUpdate; }
    public void setMinutesSinceLastUpdate(Long minutesSinceLastUpdate) {
        this.minutesSinceLastUpdate = minutesSinceLastUpdate;
    }

    public long getDeviceId() { return deviceId; }
    public void setDeviceId(long deviceId) { this.deviceId = deviceId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUniqueId() { return uniqueId; }
    public void setUniqueId(String uniqueId) { this.uniqueId = uniqueId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Date getLastUpdate() { return lastUpdate; }
    public void setLastUpdate(Date lastUpdate) { this.lastUpdate = lastUpdate; }

    public boolean getOnline() { return online; }
    public void setOnline(boolean online) { this.online = online; }

    public boolean getNoReport() { return noReport; }
    public void setNoReport(boolean noReport) { this.noReport = noReport; }

    public boolean getInvalidPosition() { return invalidPosition; }
    public void setInvalidPosition(boolean invalidPosition) { this.invalidPosition = invalidPosition; }

    public boolean getLowBattery() { return lowBattery; }
    public void setLowBattery(boolean lowBattery) { this.lowBattery = lowBattery; }

    public Double getBatteryLevel() { return batteryLevel; }
    public void setBatteryLevel(Double batteryLevel) { this.batteryLevel = batteryLevel; }

    public String getIssue() { return issue; }
    public void setIssue(String issue) { this.issue = issue; }
}
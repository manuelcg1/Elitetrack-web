package org.traccar.model;

import org.traccar.storage.QueryIgnore;
import org.traccar.storage.StorageName;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@StorageName("tc_alerts")
public class Alert extends ExtendedModel {

    public static final String TYPE_SPEED = "speed";
    public static final String TYPE_GEOFENCE_ENTER = "geofenceEnter";
    public static final String TYPE_GEOFENCE_EXIT = "geofenceExit";
    public static final String TYPE_BATTERY_LOW = "batteryLow";
    public static final String TYPE_IGNITION_ON = "ignitionOn";
    public static final String TYPE_IGNITION_OFF = "ignitionOff";
    public static final String TYPE_STOPPED_TOO_LONG = "stoppedTooLong";

    public static final String SEVERITY_LOW = "low";
    public static final String SEVERITY_MEDIUM = "medium";
    public static final String SEVERITY_HIGH = "high";
    public static final String SEVERITY_CRITICAL = "critical";

    private String name;
    private String type = TYPE_SPEED;
    private String description;
    private String severity = SEVERITY_MEDIUM;
    private boolean active = true;
    private double limitValue;
    private String unit;
    private String operator;
    private long createdBy;
    private Date createdAt;
    private Date updatedAt;

    private List<Long> deviceIds = new ArrayList<>();
    private List<Long> groupIds = new ArrayList<>();
    private List<Long> geofenceIds = new ArrayList<>();
    private List<Long> geofenceGroupIds = new ArrayList<>();

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public boolean getActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public double getLimitValue() {
        return limitValue;
    }

    public void setLimitValue(double limitValue) {
        this.limitValue = limitValue;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public long getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(long createdBy) {
        this.createdBy = createdBy;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }

    @QueryIgnore
    public List<Long> getDeviceIds() {
        return deviceIds;
    }

    public void setDeviceIds(List<Long> deviceIds) {
        this.deviceIds = deviceIds != null ? deviceIds : new ArrayList<>();
    }

    @QueryIgnore
    public List<Long> getGroupIds() {
        return groupIds;
    }

    public void setGroupIds(List<Long> groupIds) {
        this.groupIds = groupIds != null ? groupIds : new ArrayList<>();
    }

    @QueryIgnore
    public List<Long> getGeofenceIds() {
        return geofenceIds;
    }

    public void setGeofenceIds(List<Long> geofenceIds) {
        this.geofenceIds = geofenceIds != null ? geofenceIds : new ArrayList<>();
    }

    @QueryIgnore
    public List<Long> getGeofenceGroupIds() {
        return geofenceGroupIds;
    }

    public void setGeofenceGroupIds(List<Long> geofenceGroupIds) {
        this.geofenceGroupIds = geofenceGroupIds != null ? geofenceGroupIds : new ArrayList<>();
    }

}

package org.traccar.model;

import org.traccar.storage.QueryIgnore;
import org.traccar.storage.StorageName;

import java.util.Date;

@StorageName("tc_alert_events")
public class AlertEvent extends ExtendedModel {

    public static final String STATUS_OPEN = "open";
    public static final String STATUS_ACKNOWLEDGED = "acknowledged";
    public static final String STATUS_RESOLVED = "resolved";
    public static final String STATUS_DISMISSED = "dismissed";

    private long alertId;
    private long deviceId;
    private long positionId;
    private String type;
    private String severity;
    private String status = STATUS_OPEN;
    private Date eventTime;
    private Date acknowledgedAt;
    private long acknowledgedBy;
    private Date resolvedAt;
    private Date dismissedAt;
    private String message;
    private double value;
    private double threshold;
    private String unit;
    private double latitude;
    private double longitude;
    private String address;
    private long geofenceId;
    private long groupId;
    private String alertName;
    private String deviceName;
    private String driverName;

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

    public long getPositionId() {
        return positionId;
    }

    public void setPositionId(long positionId) {
        this.positionId = positionId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Date getEventTime() {
        return eventTime;
    }

    public void setEventTime(Date eventTime) {
        this.eventTime = eventTime;
    }

    public Date getAcknowledgedAt() {
        return acknowledgedAt;
    }

    public void setAcknowledgedAt(Date acknowledgedAt) {
        this.acknowledgedAt = acknowledgedAt;
    }

    public long getAcknowledgedBy() {
        return acknowledgedBy;
    }

    public void setAcknowledgedBy(long acknowledgedBy) {
        this.acknowledgedBy = acknowledgedBy;
    }

    public Date getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Date resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Date getDismissedAt() {
        return dismissedAt;
    }

    public void setDismissedAt(Date dismissedAt) {
        this.dismissedAt = dismissedAt;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public double getValue() {
        return value;
    }

    public void setValue(double value) {
        this.value = value;
    }

    public double getThreshold() {
        return threshold;
    }

    public void setThreshold(double threshold) {
        this.threshold = threshold;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public double getLatitude() {
        return latitude;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public long getGeofenceId() {
        return geofenceId;
    }

    public void setGeofenceId(long geofenceId) {
        this.geofenceId = geofenceId;
    }

    public long getGroupId() {
        return groupId;
    }

    public void setGroupId(long groupId) {
        this.groupId = groupId;
    }

    @QueryIgnore
    public String getAlertName() {
        return alertName;
    }

    public void setAlertName(String alertName) {
        this.alertName = alertName;
    }

    @QueryIgnore
    public String getDeviceName() {
        return deviceName;
    }

    public void setDeviceName(String deviceName) {
        this.deviceName = deviceName;
    }

    @QueryIgnore
    public String getDriverName() {
        return driverName;
    }

    public void setDriverName(String driverName) {
        this.driverName = driverName;
    }

}

package org.traccar.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.traccar.storage.QueryIgnore;
import org.traccar.storage.StorageName;

import java.util.ArrayList;
import java.util.List;

@StorageName("tc_alerts")
@JsonIgnoreProperties(ignoreUnknown = true)
public class SpeedAlert extends BaseModel {

    public static final String TYPE_SPEED = "Velocidad";

    private String type = TYPE_SPEED;
    private String name;
    private double speedLimit;
    private boolean active = true;

    private List<Long> deviceIds = new ArrayList<>();
    private List<Long> vehicleGroupIds = new ArrayList<>();
    private List<Long> geofenceIds = new ArrayList<>();
    private List<Long> geofenceGroupIds = new ArrayList<>();

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public double getSpeedLimit() {
        return speedLimit;
    }

    public void setSpeedLimit(double speedLimit) {
        this.speedLimit = speedLimit;
    }

    @QueryIgnore
    public double getLimitValue() {
        return speedLimit;
    }

    public void setLimitValue(double limitValue) {
        this.speedLimit = limitValue;
    }

    public boolean getActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    @QueryIgnore
    public List<Long> getDeviceIds() {
        return deviceIds;
    }

    public void setDeviceIds(List<Long> deviceIds) {
        this.deviceIds = deviceIds != null ? deviceIds : new ArrayList<>();
    }

    @QueryIgnore
    public List<Long> getVehicleGroupIds() {
        return vehicleGroupIds;
    }

    public void setVehicleGroupIds(List<Long> vehicleGroupIds) {
        this.vehicleGroupIds = vehicleGroupIds != null ? vehicleGroupIds : new ArrayList<>();
    }

    @QueryIgnore
    public List<Long> getGroupIds() {
        return vehicleGroupIds;
    }

    public void setGroupIds(List<Long> groupIds) {
        this.vehicleGroupIds = groupIds != null ? groupIds : new ArrayList<>();
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

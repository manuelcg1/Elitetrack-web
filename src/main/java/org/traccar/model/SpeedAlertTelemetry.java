package org.traccar.model;

public class SpeedAlertTelemetry {

    private long deviceId;
    private String plate;
    private double latitude;
    private double longitude;
    private double speed;
    private String driver;
    private long vehicleGroupId;

    public long getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(long deviceId) {
        this.deviceId = deviceId;
    }

    public String getPlate() {
        return plate;
    }

    public void setPlate(String plate) {
        this.plate = plate;
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

    public double getSpeed() {
        return speed;
    }

    public void setSpeed(double speed) {
        this.speed = speed;
    }

    public String getDriver() {
        return driver;
    }

    public void setDriver(String driver) {
        this.driver = driver;
    }

    public long getVehicleGroupId() {
        return vehicleGroupId;
    }

    public void setVehicleGroupId(long vehicleGroupId) {
        this.vehicleGroupId = vehicleGroupId;
    }

}

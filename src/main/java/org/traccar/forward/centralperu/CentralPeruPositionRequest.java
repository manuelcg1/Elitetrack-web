package org.traccar.forward.centralperu;

public class CentralPeruPositionRequest {

    private String imei;
    private double latitud;
    private double longitud;
    private long date;
    private double course;
    private double altitud;
    private double speed;

    public String getImei() {
        return imei;
    }

    public void setImei(String imei) {
        this.imei = imei;
    }

    public double getLatitud() {
        return latitud;
    }

    public void setLatitud(double latitud) {
        this.latitud = latitud;
    }

    public double getLongitud() {
        return longitud;
    }

    public void setLongitud(double longitud) {
        this.longitud = longitud;
    }

    public long getDate() {
        return date;
    }

    public void setDate(long date) {
        this.date = date;
    }

    public double getCourse() {
        return course;
    }

    public void setCourse(double course) {
        this.course = course;
    }

    public double getAltitud() {
        return altitud;
    }

    public void setAltitud(double altitud) {
        this.altitud = altitud;
    }

    public double getSpeed() {
        return speed;
    }

    public void setSpeed(double speed) {
        this.speed = speed;
    }
}
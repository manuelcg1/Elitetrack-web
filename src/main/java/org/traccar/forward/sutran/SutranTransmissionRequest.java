package org.traccar.forward.sutran;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({"plate", "geo", "direction", "event", "speed", "time_device", "imei"})
public class SutranTransmissionRequest {

    private String plate;
    private double[] geo;
    private int direction;
    private String event;
    private int speed;
    private String timeDevice;
    private Long imei;

    public String getPlate() {
        return plate;
    }

    public void setPlate(String plate) {
        this.plate = plate;
    }

    public double[] getGeo() {
        return geo;
    }

    public void setGeo(double[] geo) {
        this.geo = geo;
    }

    public int getDirection() {
        return direction;
    }

    public void setDirection(int direction) {
        this.direction = direction;
    }

    public String getEvent() {
        return event;
    }

    public void setEvent(String event) {
        this.event = event;
    }

    public int getSpeed() {
        return speed;
    }

    public void setSpeed(int speed) {
        this.speed = speed;
    }

    @JsonProperty("time_device")
    public String getTimeDevice() {
        return timeDevice;
    }

    public void setTimeDevice(String timeDevice) {
        this.timeDevice = timeDevice;
    }

    public Long getImei() {
        return imei;
    }

    public void setImei(Long imei) {
        this.imei = imei;
    }

}

package org.traccar.model;

import org.traccar.storage.StorageName;

/**
 * GpsInventory — Activo físico GPS gestionado como inventario independiente.
 *
 * Extiende ExtendedModel (NO GroupedModel) para evitar el mecanismo de
 * herencia de permisos vía grupos que genera queries inválidas en
 * DatabaseStorage (tc_user_group.gpsinventoryid).
 */
@StorageName("tc_gps_inventory")
public class GpsInventory extends ExtendedModel {

    private String imei;
    public String getImei() { return imei; }
    public void setImei(String imei) { this.imei = imei; }

    private String brand;
    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    private String model;
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    private String serialNumber;
    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }

    private String status;
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    private String notes;
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    private long deviceId;
    public long getDeviceId() { return deviceId; }
    public void setDeviceId(long deviceId) { this.deviceId = deviceId; }

}

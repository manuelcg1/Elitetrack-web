package org.traccar.model;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonProperty;
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

    private Long deviceId;
    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }

    private Date registeredAt;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public Date getRegisteredAt() { return registeredAt; }
    public void setRegisteredAt(Date registeredAt) { this.registeredAt = registeredAt; }

    private Long registeredBy;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public Long getRegisteredBy() { return registeredBy; }
    public void setRegisteredBy(Long registeredBy) { this.registeredBy = registeredBy; }

    private Date updatedAt;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }

    private Long updatedBy;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }

    private Date retiredAt;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public Date getRetiredAt() { return retiredAt; }
    public void setRetiredAt(Date retiredAt) { this.retiredAt = retiredAt; }

    private Long retiredBy;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public Long getRetiredBy() { return retiredBy; }
    public void setRetiredBy(Long retiredBy) { this.retiredBy = retiredBy; }

    private String retirementReason;
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public String getRetirementReason() { return retirementReason; }
    public void setRetirementReason(String retirementReason) { this.retirementReason = retirementReason; }

}

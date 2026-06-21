/*
 * Copyright 2026 EliteTrack
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.traccar.model;

import org.traccar.storage.StorageName;

/**
 * GpsInventory — Representa un dispositivo GPS físico como activo de
 * inventario, independiente del vehículo en el que esté instalado.
 *
 * Forma parte del módulo de ciclo de vida de mantenimiento GPS:
 * un mismo GPS puede rotar entre varios vehículos a lo largo de su
 * vida útil, y este modelo lo rastrea como entidad propia.
 *
 * Estados posibles (ver gpsConstants.js en el frontend):
 *   en_almacen | asignado | instalado | en_revision |
 *   desinstalado | danado | dado_de_baja
 */
@StorageName("tc_gps_inventory")
public class GpsInventory extends GroupedModel {

    private String imei;

    public String getImei() {
        return imei;
    }

    public void setImei(String imei) {
        this.imei = imei;
    }

    private String brand;

    public String getBrand() {
        return brand;
    }

    public void setBrand(String brand) {
        this.brand = brand;
    }

    private String model;

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    private String serialNumber;

    public String getSerialNumber() {
        return serialNumber;
    }

    public void setSerialNumber(String serialNumber) {
        this.serialNumber = serialNumber;
    }

    private String status;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    private String notes;

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    // Vehículo actual donde está instalado (null si está en almacén)
    private Long deviceId;

    public Long getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(Long deviceId) {
        this.deviceId = deviceId;
    }

}

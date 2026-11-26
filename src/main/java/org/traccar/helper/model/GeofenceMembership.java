/*
 * Copyright 2026 Anton Tananaev (anton@traccar.org)
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
package org.traccar.helper.model;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.model.Geofence;
import org.traccar.model.Position;
import org.traccar.storage.StorageException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Calcula en qué geocercas está cada posición comparando contra la geometría, sin depender
 * de los vínculos con el dispositivo ni del dato guardado al recibir la posición.
 */
public final class GeofenceMembership {

    private static final Logger LOGGER = LoggerFactory.getLogger(GeofenceMembership.class);

    private final List<Geofence> geofences = new ArrayList<>();

    public GeofenceMembership(Collection<Geofence> geofences) {
        for (Geofence geofence : geofences) {
            try {
                if (geofence.getArea() != null && geofence.getGeometry() != null) {
                    this.geofences.add(geofence);
                }
            } catch (RuntimeException e) {
                LOGGER.warn("Geocerca {} con geometría inválida", geofence.getId(), e);
            }
        }
    }

    /** Geocercas que el usuario puede ver, opcionalmente limitadas a los identificadores indicados. */
    public static GeofenceMembership forUser(
            GeofenceReadAccessService readAccessService, long userId, Collection<Long> geofenceIds)
            throws StorageException {
        var selected = readAccessService.getReadAccess(userId).geofences().stream()
                .map(GeofenceReadAccessService.GeofenceEntry::geofence)
                .filter(geofence -> geofenceIds == null || geofenceIds.isEmpty()
                        || geofenceIds.contains(geofence.getId()))
                .toList();
        return new GeofenceMembership(selected);
    }

    public List<Geofence> getGeofences() {
        return geofences;
    }

    public List<Long> find(Position position) {
        List<Long> result = new ArrayList<>();
        if (position.getValid() || position.getLatitude() != 0 || position.getLongitude() != 0) {
            for (Geofence geofence : geofences) {
                // containsPoint descarta primero por el rectángulo que envuelve la geocerca.
                if (geofence.containsPosition(position)) {
                    result.add(geofence.getId());
                }
            }
        }
        return result;
    }

}

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
package org.traccar.reports;

import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.helper.model.DeviceUtil;
import org.traccar.helper.model.GeofenceMembership;
import org.traccar.helper.model.PositionUtil;
import org.traccar.model.Device;
import org.traccar.model.Geofence;
import org.traccar.model.Position;
import org.traccar.reports.common.ReportUtils;
import org.traccar.reports.model.GeofenceReportItem;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;

import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Arma las visitas a geocercas recorriendo las posiciones del período y comparándolas con la
 * geometría de las geocercas que el usuario puede ver. No depende de los vínculos con el
 * dispositivo ni de los eventos de entrada y salida guardados.
 */
public class GeofenceReportProvider {

    private final ReportUtils reportUtils;
    private final Storage storage;
    private final GeofenceReadAccessService readAccessService;

    @Inject
    public GeofenceReportProvider(
            ReportUtils reportUtils, Storage storage, GeofenceReadAccessService readAccessService) {
        this.reportUtils = reportUtils;
        this.storage = storage;
        this.readAccessService = readAccessService;
    }

    public Collection<GeofenceReportItem> getObjects(
            long userId, Collection<Long> deviceIds, Collection<Long> groupIds, Collection<Long> geofenceIds,
            Date from, Date to) throws StorageException {
        reportUtils.checkPeriodLimit(from, to);

        var membership = GeofenceMembership.forUser(readAccessService, userId, geofenceIds);
        var result = new ArrayList<GeofenceReportItem>();
        if (membership.getGeofences().isEmpty()) {
            return result;
        }
        for (Device device : DeviceUtil.getAccessibleDevices(storage, userId, deviceIds, groupIds)) {
            // Incluye la última posición anterior al período para saber si ya estaba dentro.
            try (var positions = PositionUtil.getPositionsStreamWithExtra(storage, device.getId(), from, to)) {
                result.addAll(buildVisits(device, membership, positions.iterator(), from));
            }
        }
        result.sort(Comparator.comparing(GeofenceReportItem::getStartTime));
        return result;
    }

    private static final class Visit {
        private final Position start;
        private final boolean openStart;

        private Visit(Position start, boolean openStart) {
            this.start = start;
            this.openStart = openStart;
        }
    }

    static List<GeofenceReportItem> buildVisits(
            Device device, GeofenceMembership membership, Iterator<Position> positions, Date from) {

        Map<Long, Geofence> geofences = membership.getGeofences().stream()
                .collect(Collectors.toMap(Geofence::getId, Function.identity(), (a, b) -> a));
        var result = new ArrayList<GeofenceReportItem>();
        Map<Long, Visit> open = new LinkedHashMap<>();
        Set<Long> before = null;
        boolean first = true;
        Position last = null;

        while (positions.hasNext()) {
            Position position = positions.next();
            Set<Long> inside = new HashSet<>(membership.find(position));
            if (position.getFixTime().before(from)) {
                before = inside;
                continue;
            }
            for (long geofenceId : inside) {
                if (!open.containsKey(geofenceId)) {
                    boolean openStart = first && before != null && before.contains(geofenceId);
                    open.put(geofenceId, new Visit(position, openStart));
                }
            }
            var iterator = open.entrySet().iterator();
            while (iterator.hasNext()) {
                var entry = iterator.next();
                if (!inside.contains(entry.getKey())) {
                    result.add(createItem(device, geofences.get(entry.getKey()), entry.getValue(), position, false));
                    iterator.remove();
                }
            }
            first = false;
            last = position;
        }

        if (last != null) {
            for (var entry : open.entrySet()) {
                result.add(createItem(device, geofences.get(entry.getKey()), entry.getValue(), last, true));
            }
        }
        return result;
    }

    private static GeofenceReportItem createItem(
            Device device, Geofence geofence, Visit visit, Position end, boolean openEnd) {
        GeofenceReportItem item = new GeofenceReportItem();
        item.setDeviceId(device.getId());
        item.setDeviceName(device.getName());
        item.setGeofenceId(geofence.getId());
        item.setGeofenceName(geofence.getName());
        item.setStartTime(visit.start.getFixTime());
        item.setEndTime(end.getFixTime());
        item.setDistance(Math.max(0, PositionUtil.calculateDistance(visit.start, end, false)));
        item.setOpenStart(visit.openStart);
        item.setOpenEnd(openEnd);
        return item;
    }

}

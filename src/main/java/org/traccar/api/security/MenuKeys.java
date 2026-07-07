package org.traccar.api.security;

import java.util.List;
import java.util.Map;
import java.util.Set;

public final class MenuKeys {

    public static final String VEHICLES = "vehicles";
    public static final String GEOFENCES = "geofences";
    public static final String MAP = "map";
    public static final String REPORTS = "reports";
    public static final String SETTINGS = "settings";
    public static final String ALERTS = "alerts";
    public static final String MONITORING = "monitoring";
    public static final String ROLES = "roles";

    public static final Set<String> ALL = Set.of(
            VEHICLES, GEOFENCES, MAP, REPORTS, SETTINGS, ALERTS, MONITORING, ROLES);

    public static final List<Map<String, String>> DEFINITIONS = List.of(
            Map.of("key", VEHICLES, "name", "Vehiculos"),
            Map.of("key", GEOFENCES, "name", "Geocercas"),
            Map.of("key", MAP, "name", "Mapa"),
            Map.of("key", REPORTS, "name", "Reportes"),
            Map.of("key", SETTINGS, "name", "Ajustes"),
            Map.of("key", ALERTS, "name", "Alertas"),
            Map.of("key", MONITORING, "name", "Monitoreo"),
            Map.of("key", ROLES, "name", "Mantenedor de roles"));

    private MenuKeys() {
    }

}

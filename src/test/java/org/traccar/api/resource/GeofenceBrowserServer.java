package org.traccar.api.resource;

import java.nio.file.Files;
import java.nio.file.Path;

/** Opt-in browser fixture: synthetic H2 only, no Main/configuration or outbound services. */
public final class GeofenceBrowserServer {
    private GeofenceBrowserServer() { }

    public static void main(String[] args) throws Exception {
        try (var fixture = new GeofenceHttpAccessTest.Fixture()) {
            fixture.sql("UPDATE tc_users SET readonly = TRUE WHERE id = 2");
            Path state = Path.of("build", "geofence-browser-server.txt");
            Files.writeString(state, fixture.baseUrl.replace("/api/geofences", ""));
            System.out.println("ISOLATED_BROWSER_BACKEND " + Files.readString(state));
            // Bounded lifetime; deleting this sentinel also requests a graceful shutdown.
            Path sentinel = Path.of("build", "geofence-browser-running");
            Files.writeString(sentinel, "synthetic");
            long deadline = System.nanoTime() + java.time.Duration.ofMinutes(30).toNanos();
            while (Files.exists(sentinel) && System.nanoTime() < deadline) {
                Thread.sleep(500);
            }
        }
    }
}

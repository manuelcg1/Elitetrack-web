package org.traccar.forward.sutran;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.client.ClientBuilder;
import org.postgresql.ds.PGSimpleDataSource;
import org.traccar.config.Config;
import org.traccar.forward.PositionData;
import org.traccar.model.Device;
import org.traccar.model.ForwardServer;
import org.traccar.model.Position;
import org.traccar.storage.DatabaseStorage;

import java.net.URI;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.Executors;

/** Child JVM used only by the isolated crash rehearsal. Exit 73 models a lost durable acknowledgement. */
public final class SutranCrashProbe {
    private SutranCrashProbe() { }

    public static void main(String[] args) throws Exception {
        String url = System.getenv("TRACCAR_TEST_PG_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/geofence_validation")
                || !args[0].matches("sutran_runtime_[a-f0-9]{32}")) {
            throw new IllegalArgumentException("Isolated database required");
        }
        URI receiver = URI.create(args[1]);
        if (!"http".equals(receiver.getScheme()) || !"127.0.0.1".equals(receiver.getHost())) {
            throw new IllegalArgumentException("Loopback receiver required");
        }
        var source = new PGSimpleDataSource();
        source.setURL(url);
        source.setUser("validation_owner");
        source.setCurrentSchema(args[0]);
        try (var connection = source.getConnection(); var sql = connection.createStatement();
                var rows = sql.executeQuery("SELECT current_setting('traccar.validation_cluster',true)")) {
            if (!rows.next() || System.getenv("TRACCAR_TEST_PG_TOKEN") == null
                    || !System.getenv("TRACCAR_TEST_PG_TOKEN").equals(rows.getString(1))) {
                throw new IllegalStateException("Cluster marker mismatch");
            }
        }
        var mapper = new ObjectMapper();
        var storage = new DatabaseStorage(new Config(), source, mapper);
        var scheduler = Executors.newSingleThreadScheduledExecutor();
        try (var http = ClientBuilder.newClient()) {
            var client = new SutranClient(http, mapper, scheduler, new SutranPayloadMapper(), receiver,
                    UUID.randomUUID().toString(), 1000, 3000, 1, 10, 100);
            var queue = new SutranDeliveryQueue(storage, mapper, (server, request, guard, callback) ->
                    client.sendTracked(request, guard, response -> {
                        // Simulated remote acceptance has arrived, but the queue never persists it.
                        if (response.result().status() == SutranDeliveryResult.Status.DELIVERED) {
                            Runtime.getRuntime().halt(73);
                        }
                    }), true, null, Runnable::run);
            var server = new ForwardServer();
            server.setId(7);
            var device = new Device();
            device.setId(1);
            device.setName("SIM001");
            var position = new Position();
            position.setId(1);
            position.setDeviceId(1);
            position.setValid(true);
            position.setLatitude(-11.4);
            position.setLongitude(-76.9);
            position.setFixTime(Date.from(Instant.parse("2026-09-01T12:00:00Z")));
            var data = new PositionData();
            data.setDevice(device);
            data.setPosition(position);
            queue.enqueue(server, data);
            Thread.sleep(15000);
            throw new IllegalStateException("Crash probe never received the synthetic acknowledgement");
        } finally {
            scheduler.shutdownNow();
        }
    }
}

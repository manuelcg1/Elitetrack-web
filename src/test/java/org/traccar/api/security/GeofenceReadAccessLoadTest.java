package org.traccar.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.traccar.config.Config;
import org.traccar.storage.DatabaseStorage;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Synthetic SQL workload, not a PostgreSQL capacity or production latency guarantee. */
public class GeofenceReadAccessLoadTest {

    @Test
    public void measureIdentifierRefreshForTwentyUsersAndTenThousandGeofences() throws Exception {
        var source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:" + UUID.randomUUID());
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tc_users (id BIGINT PRIMARY KEY, administrator BOOLEAN DEFAULT FALSE)");
            statement.execute("CREATE TABLE tc_geofence_folders (id BIGINT PRIMARY KEY, name VARCHAR, parentid BIGINT)");
            statement.execute("CREATE TABLE tc_geofences (id BIGINT PRIMARY KEY, attributes VARCHAR)");
            statement.execute("CREATE TABLE tc_user_geofencefolder (userid BIGINT, geofencefolderid BIGINT)");
            statement.execute("CREATE TABLE tc_user_geofence (userid BIGINT, geofenceid BIGINT)");
            statement.execute("INSERT INTO tc_users (id) SELECT X FROM SYSTEM_RANGE(1,20)");
            statement.execute("INSERT INTO tc_geofence_folders SELECT X, 'Folder', 0 FROM SYSTEM_RANGE(1,100)");
            statement.execute("INSERT INTO tc_user_geofencefolder SELECT X, X FROM SYSTEM_RANGE(1,20)");
            try (var insert = connection.prepareStatement("INSERT INTO tc_geofences VALUES (?,?)")) {
                for (int id = 1; id <= 10000; id++) {
                    insert.setLong(1, id);
                    insert.setString(2, "{\"folderId\":" + ((id - 1) % 100 + 1) + "}");
                    insert.addBatch();
                }
                insert.executeBatch();
            }
            var mapper = new ObjectMapper();
            var service = new GeofenceReadAccessService(new DatabaseStorage(new Config(), source, mapper));
            for (int user = 1; user <= 3; user++) {
                assertEquals(100, service.getReadableGeofenceIds(user).size());
            }
            var timings = new ArrayList<Double>();
            long totalStart = System.nanoTime();
            for (int user = 1; user <= 20; user++) {
                long start = System.nanoTime();
                assertEquals(100, service.getReadableGeofenceIds(user).size());
                timings.add((System.nanoTime() - start) / 1_000_000.0);
            }
            double totalMs = (System.nanoTime() - totalStart) / 1_000_000.0;
            Collections.sort(timings);
            var report = Map.of("database", "disposable H2", "users", 20, "geofences", 10000,
                    "mode", "sequential identifier refresh after 3 warmups",
                    "totalMs", totalMs, "p50Ms", timings.get(9), "p95Ms", timings.get(18),
                    "maxMs", timings.get(19));
            Path output = Path.of("build", "reports", "geofence-load.json");
            Files.createDirectories(output.getParent());
            mapper.writerWithDefaultPrettyPrinter().writeValue(output.toFile(), report);
            System.out.println(mapper.writeValueAsString(report));
        }
    }
}

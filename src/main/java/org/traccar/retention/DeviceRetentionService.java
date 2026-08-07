package org.traccar.retention;

import jakarta.annotation.PreDestroy;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.model.Device;
import org.traccar.model.DeviceRetentionPolicy;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Singleton
public class DeviceRetentionService {

    public record Preview(
            long deviceId, int retentionDays, Date cutoff, long eligiblePositions,
            Date oldestPosition, Date newestPosition, long currentPositionId, boolean estimated) {
    }

    private static final Logger LOGGER = LoggerFactory.getLogger(DeviceRetentionService.class);
    private static final int MIN_DAYS = 30;
    private static final int MAX_DAYS = 3650;

    private final DeviceRetentionRepository repository;
    private final Storage storage;
    private final DataSource dataSource;
    private final int batchSize;
    private final long pauseMillis;
    private final boolean defaultDryRun;
    private final Set<Long> running = ConcurrentHashMap.newKeySet();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Inject
    public DeviceRetentionService(
            DeviceRetentionRepository repository, Storage storage, DataSource dataSource, Config config) {
        this.repository = repository;
        this.storage = storage;
        this.dataSource = dataSource;
        batchSize = Math.max(1, config.getInteger(Keys.RETENTION_BATCH_SIZE));
        pauseMillis = Math.max(0, config.getInteger(Keys.RETENTION_PAUSE_MILLIS));
        defaultDryRun = config.getBoolean(Keys.RETENTION_DRY_RUN);
    }

    public void validate(DeviceRetentionPolicy policy) {
        if (policy == null || policy.getRetentionDays() < MIN_DAYS || policy.getRetentionDays() > MAX_DAYS) {
            throw new IllegalArgumentException("Retention days must be between 30 and 3650");
        }
    }

    public Device requireDevice(long deviceId) throws StorageException {
        Device device = storage.getObject(Device.class, new Request(
                new Columns.Include("id", "positionId"), new Condition.Equals("id", deviceId)));
        if (device == null) {
            throw new IllegalArgumentException("Device does not exist");
        }
        return device;
    }

    public Preview preview(DeviceRetentionPolicy policy) throws Exception {
        validate(policy);
        Device device = requireDevice(policy.getDeviceId());
        Date cutoff = Date.from(Instant.now().minus(policy.getRetentionDays(), ChronoUnit.DAYS));
        String sql = "SELECT COUNT(*) AS count, MIN(servertime) AS oldest, MAX(servertime) AS newest "
                + "FROM tc_positions p WHERE p.deviceid = ? AND p.servertime < ? AND p.id <> ? "
                + "AND NOT EXISTS (SELECT 1 FROM tc_events e WHERE e.positionid = p.id) "
                + "AND NOT EXISTS (SELECT 1 FROM tc_alert_events a WHERE a.positionid = p.id)";
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, policy.getDeviceId());
            statement.setTimestamp(2, new Timestamp(cutoff.getTime()));
            statement.setLong(3, device.getPositionId());
            try (var resultSet = statement.executeQuery()) {
                resultSet.next();
                return new Preview(policy.getDeviceId(), policy.getRetentionDays(), cutoff,
                        resultSet.getLong("count"), date(resultSet.getTimestamp("oldest")),
                        date(resultSet.getTimestamp("newest")), device.getPositionId(), false);
            }
        }
    }

    public boolean submit(long deviceId, long userId, Boolean requestedDryRun) throws Exception {
        DeviceRetentionPolicy policy = repository.get(deviceId);
        if (policy == null) {
            throw new IllegalArgumentException("Retention policy does not exist");
        }
        requireDevice(deviceId);
        if (!running.add(deviceId)) {
            return false;
        }
        boolean dryRun = requestedDryRun != null ? requestedDryRun : defaultDryRun;
        repository.updateStatus(deviceId, "PENDING", 0, null);
        executor.execute(() -> execute(policy, userId, dryRun));
        return true;
    }

    public void executeScheduled(DeviceRetentionPolicy policy) {
        if (running.add(policy.getDeviceId())) {
            executor.execute(() -> execute(policy, 0, defaultDryRun));
        }
    }

    private void execute(DeviceRetentionPolicy policy, long userId, boolean dryRun) {
        Date startedAt = new Date();
        long deleted = 0;
        try {
            repository.updateStatus(policy.getDeviceId(), "RUNNING", 0, null);
            Preview preview = preview(policy);
            if (!dryRun) {
                int count;
                do {
                    count = deleteBatch(policy.getDeviceId(), preview.cutoff(), preview.currentPositionId());
                    deleted += count;
                    if (count > 0 && pauseMillis > 0) {
                        Thread.sleep(pauseMillis);
                    }
                } while (count == batchSize);
            }
            repository.updateStatus(policy.getDeviceId(), "SUCCESS", deleted, null);
            audit(policy, userId, dryRun, startedAt, deleted, "SUCCESS", null);
        } catch (Exception e) {
            String error = safeError(e);
            LOGGER.warn("Retention failed for device {}", policy.getDeviceId(), e);
            try {
                repository.updateStatus(policy.getDeviceId(), deleted > 0 ? "PARTIAL" : "FAILED", deleted, error);
                audit(policy, userId, dryRun, startedAt, deleted, deleted > 0 ? "PARTIAL" : "FAILED", error);
            } catch (SQLException nested) {
                LOGGER.warn("Failed to update retention status for device {}", policy.getDeviceId(), nested);
            }
        } finally {
            running.remove(policy.getDeviceId());
        }
    }

    private int deleteBatch(long deviceId, Date cutoff, long currentPositionId) throws SQLException {
        String sql = "DELETE FROM tc_positions WHERE id IN (SELECT p.id FROM tc_positions p "
                + "WHERE p.deviceid = ? AND p.servertime < ? AND p.id <> ? "
                + "AND NOT EXISTS (SELECT 1 FROM tc_events e WHERE e.positionid = p.id) "
                + "AND NOT EXISTS (SELECT 1 FROM tc_alert_events a WHERE a.positionid = p.id) "
                + "ORDER BY p.id LIMIT ?)";
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, deviceId);
            statement.setTimestamp(2, new Timestamp(cutoff.getTime()));
            statement.setLong(3, currentPositionId);
            statement.setInt(4, batchSize);
            return statement.executeUpdate();
        }
    }

    private void audit(
            DeviceRetentionPolicy policy, long userId, boolean dryRun, Date startedAt,
            long deleted, String status, String error)
            throws SQLException {
        String sql = "INSERT INTO tc_device_retention_runs "
                + "(deviceid, userid, retentiondays, dryrun, startedat, finishedat, deletedrows, status, error) "
                + "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)";
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, policy.getDeviceId());
            if (userId > 0) {
                statement.setLong(2, userId);
            } else {
                statement.setNull(2, java.sql.Types.BIGINT);
            }
            statement.setInt(3, policy.getRetentionDays());
            statement.setBoolean(4, dryRun);
            statement.setTimestamp(5, new Timestamp(startedAt.getTime()));
            statement.setLong(6, deleted);
            statement.setString(7, status);
            statement.setString(8, error);
            statement.executeUpdate();
        }
    }

    private String safeError(Exception error) {
        String message = error.getMessage() != null ? error.getMessage() : error.getClass().getSimpleName();
        return message.substring(0, Math.min(message.length(), 1024));
    }

    private Date date(Timestamp timestamp) {
        return timestamp != null ? new Date(timestamp.getTime()) : null;
    }

    @PreDestroy
    public void stop() {
        executor.shutdown();
    }
}

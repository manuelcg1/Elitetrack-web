package org.traccar.retention;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.traccar.model.DeviceRetentionPolicy;

import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Singleton
public class DeviceRetentionRepository {

    private final DataSource dataSource;

    @Inject
    public DeviceRetentionRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public List<DeviceRetentionPolicy> getAll() throws SQLException {
        try (var connection = dataSource.getConnection();
                var statement = connection.prepareStatement("SELECT * FROM tc_device_retention ORDER BY deviceid");
                var resultSet = statement.executeQuery()) {
            List<DeviceRetentionPolicy> result = new ArrayList<>();
            while (resultSet.next()) {
                result.add(readPolicy(resultSet));
            }
            return result;
        }
    }

    public List<DeviceRetentionPolicy> getActive() throws SQLException {
        return getAll().stream().filter(DeviceRetentionPolicy::getEnabled).toList();
    }

    public DeviceRetentionPolicy get(long deviceId) throws SQLException {
        try (var connection = dataSource.getConnection();
                var statement = connection.prepareStatement(
                        "SELECT * FROM tc_device_retention WHERE deviceid = ?")) {
            statement.setLong(1, deviceId);
            try (var resultSet = statement.executeQuery()) {
                return resultSet.next() ? readPolicy(resultSet) : null;
            }
        }
    }

    public void save(DeviceRetentionPolicy policy, long userId) throws SQLException {
        String sql = "INSERT INTO tc_device_retention "
                + "(deviceid, enabled, retentiondays, laststatus, createdat, updatedat, updatedby) "
                + "VALUES (?, ?, ?, 'NEVER_RUN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?) "
                + "ON CONFLICT (deviceid) DO UPDATE SET enabled = EXCLUDED.enabled, "
                + "retentiondays = EXCLUDED.retentiondays, updatedat = CURRENT_TIMESTAMP, updatedby = EXCLUDED.updatedby";
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, policy.getDeviceId());
            statement.setBoolean(2, policy.getEnabled());
            statement.setInt(3, policy.getRetentionDays());
            if (userId > 0) {
                statement.setLong(4, userId);
            } else {
                statement.setNull(4, java.sql.Types.BIGINT);
            }
            statement.executeUpdate();
        }
    }

    public void saveBulk(List<Long> deviceIds, boolean enabled, int retentionDays, long userId) throws SQLException {
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                for (long deviceId : deviceIds) {
                    DeviceRetentionPolicy policy = new DeviceRetentionPolicy();
                    policy.setDeviceId(deviceId);
                    policy.setEnabled(enabled);
                    policy.setRetentionDays(retentionDays);
                    save(connection, policy, userId);
                }
                connection.commit();
            } catch (SQLException e) {
                connection.rollback();
                throw e;
            }
        }
    }

    private void save(java.sql.Connection connection, DeviceRetentionPolicy policy, long userId) throws SQLException {
        String sql = "INSERT INTO tc_device_retention "
                + "(deviceid, enabled, retentiondays, laststatus, createdat, updatedat, updatedby) "
                + "VALUES (?, ?, ?, 'NEVER_RUN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?) "
                + "ON CONFLICT (deviceid) DO UPDATE SET enabled = EXCLUDED.enabled, "
                + "retentiondays = EXCLUDED.retentiondays, updatedat = CURRENT_TIMESTAMP, updatedby = EXCLUDED.updatedby";
        try (var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, policy.getDeviceId());
            statement.setBoolean(2, policy.getEnabled());
            statement.setInt(3, policy.getRetentionDays());
            if (userId > 0) {
                statement.setLong(4, userId);
            } else {
                statement.setNull(4, java.sql.Types.BIGINT);
            }
            statement.executeUpdate();
        }
    }

    public void remove(long deviceId) throws SQLException {
        try (var connection = dataSource.getConnection();
                var statement = connection.prepareStatement("DELETE FROM tc_device_retention WHERE deviceid = ?")) {
            statement.setLong(1, deviceId);
            statement.executeUpdate();
        }
    }

    public void updateStatus(long deviceId, String status, long deleted, String error) throws SQLException {
        String sql = "UPDATE tc_device_retention SET lastcleanup = CURRENT_TIMESTAMP, laststatus = ?, "
                + "lastdeleted = ?, lasterror = ?, updatedat = CURRENT_TIMESTAMP WHERE deviceid = ?";
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement(sql)) {
            statement.setString(1, status);
            statement.setLong(2, deleted);
            statement.setString(3, error);
            statement.setLong(4, deviceId);
            statement.executeUpdate();
        }
    }

    private DeviceRetentionPolicy readPolicy(ResultSet resultSet) throws SQLException {
        DeviceRetentionPolicy policy = new DeviceRetentionPolicy();
        policy.setDeviceId(resultSet.getLong("deviceid"));
        policy.setEnabled(resultSet.getBoolean("enabled"));
        policy.setRetentionDays(resultSet.getInt("retentiondays"));
        policy.setLastCleanup(date(resultSet.getTimestamp("lastcleanup")));
        policy.setLastStatus(resultSet.getString("laststatus"));
        long deleted = resultSet.getLong("lastdeleted");
        policy.setLastDeleted(resultSet.wasNull() ? null : deleted);
        policy.setLastError(resultSet.getString("lasterror"));
        policy.setCreatedAt(date(resultSet.getTimestamp("createdat")));
        policy.setUpdatedAt(date(resultSet.getTimestamp("updatedat")));
        long updatedBy = resultSet.getLong("updatedby");
        policy.setUpdatedBy(resultSet.wasNull() ? null : updatedBy);
        return policy;
    }

    private Date date(Timestamp timestamp) {
        return timestamp != null ? new Date(timestamp.getTime()) : null;
    }
}

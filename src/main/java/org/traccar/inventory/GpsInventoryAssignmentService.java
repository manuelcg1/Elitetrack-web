package org.traccar.inventory;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.Objects;
import java.util.Set;

@Singleton
public class GpsInventoryAssignmentService {

    private static final Set<String> UNASSIGNED_STATUSES = Set.of(
            "en_almacen", "en_revision", "desinstalado", "danado");

    private final DataSource dataSource;

    @Inject
    public GpsInventoryAssignmentService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public long assign(long gpsId, long deviceId, long userId, String reason, String notes) throws SQLException {
        requireText(reason, "Assignment reason is required");
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                InventoryState inventory = lockInventory(connection, gpsId);
                if ("dado_de_baja".equals(inventory.status())) {
                    throw new IllegalStateException("Retired GPS cannot be assigned");
                }
                ensureNoActiveInspection(connection, gpsId);
                if (inventory.deviceId() != null) {
                    ActiveAssignment existing = ensureActiveAssignment(connection, gpsId, inventory, userId);
                    if (Objects.equals(existing.device().id(), deviceId)) {
                        connection.commit();
                        return existing.id();
                    }
                    throw new IllegalStateException("GPS already has a current device; use reassignment");
                }
                DeviceSnapshot device = lockDevice(connection, deviceId);
                long assignmentId = insertAssignment(
                        connection, gpsId, device, userId, reason, notes);
                updateInventory(connection, gpsId, deviceId, userId, "asignado");
                insertEvent(connection, gpsId, device, userId, "ASSIGNED", reason);
                connection.commit();
                return assignmentId;
            } catch (SQLException error) {
                connection.rollback();
                if ("23505".equals(error.getSQLState())) {
                    throw new IllegalStateException("GPS or device already has an active assignment", error);
                }
                throw error;
            } catch (RuntimeException error) {
                connection.rollback();
                throw error;
            }
        }
    }

    public void unassign(
            long gpsId, long userId, String reason, String targetStatus, String notes) throws SQLException {
        requireText(reason, "Unassignment reason is required");
        validateUnassignedStatus(targetStatus);
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                InventoryState inventory = lockInventory(connection, gpsId);
                ensureNoActiveInspection(connection, gpsId);
                ActiveAssignment assignment = ensureActiveAssignment(connection, gpsId, inventory, userId);
                closeAssignment(connection, assignment.id(), userId, reason, notes);
                updateInventory(connection, gpsId, null, userId, targetStatus);
                insertEvent(connection, gpsId, assignment.device(), userId, "UNASSIGNED", reason);
                connection.commit();
            } catch (SQLException | RuntimeException error) {
                connection.rollback();
                throw error;
            }
        }
    }

    public long reassign(
            long gpsId, long deviceId, long userId, String reason, String notes) throws SQLException {
        requireText(reason, "Reassignment reason is required");
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                InventoryState inventory = lockInventory(connection, gpsId);
                if ("dado_de_baja".equals(inventory.status())) {
                    throw new IllegalStateException("Retired GPS cannot be reassigned");
                }
                ensureNoActiveInspection(connection, gpsId);
                ActiveAssignment previous = ensureActiveAssignment(connection, gpsId, inventory, userId);
                if (Objects.equals(previous.device().id(), deviceId)) {
                    throw new IllegalArgumentException("GPS is already assigned to this device");
                }
                DeviceSnapshot next = lockDevice(connection, deviceId);
                closeAssignment(connection, previous.id(), userId, reason, notes);
                insertEvent(connection, gpsId, previous.device(), userId, "UNASSIGNED", reason);
                long assignmentId = insertAssignment(connection, gpsId, next, userId, reason, notes);
                updateInventory(connection, gpsId, deviceId, userId, "asignado");
                insertEvent(connection, gpsId, next, userId, "REASSIGNED", reason);
                connection.commit();
                return assignmentId;
            } catch (SQLException error) {
                connection.rollback();
                if ("23505".equals(error.getSQLState())) {
                    throw new IllegalStateException("GPS or device already has an active assignment", error);
                }
                throw error;
            } catch (RuntimeException error) {
                connection.rollback();
                throw error;
            }
        }
    }

    private InventoryState lockInventory(Connection connection, long id) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT status, deviceid FROM tc_gps_inventory WHERE id = ? FOR UPDATE")) {
            statement.setLong(1, id);
            try (var resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalArgumentException("GPS inventory item not found");
                }
                long deviceId = resultSet.getLong("deviceid");
                Long currentDeviceId = resultSet.wasNull() ? null : deviceId;
                return new InventoryState(resultSet.getString("status"), currentDeviceId);
            }
        }
    }

    private DeviceSnapshot lockDevice(Connection connection, long id) throws SQLException {
        if (id <= 0) {
            throw new IllegalArgumentException("Valid device is required");
        }
        try (var statement = connection.prepareStatement(
                "SELECT id, name, uniqueid FROM tc_devices WHERE id = ? FOR SHARE")) {
            statement.setLong(1, id);
            try (var resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalArgumentException("Device not found");
                }
                return new DeviceSnapshot(
                        resultSet.getLong("id"), resultSet.getString("name"), resultSet.getString("uniqueid"));
            }
        }
    }

    private void ensureNoActiveInspection(Connection connection, long gpsId) throws SQLException {
        if (gpsId == 0) {
            return;
        }
        try (var statement = connection.prepareStatement(
                "SELECT id FROM tc_gps_inventory_inspections "
                        + "WHERE gpsinventoryid = ? AND completedat IS NULL")) {
            statement.setLong(1, gpsId);
            try (var resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    throw new IllegalStateException("GPS has an active inspection");
                }
            }
        }
    }

    private ActiveAssignment ensureActiveAssignment(
            Connection connection, long gpsId, InventoryState inventory, long userId) throws SQLException {
        ActiveAssignment assignment = lockActiveAssignment(connection, gpsId);
        if (assignment != null) {
            return assignment;
        }
        if (inventory.deviceId() == null) {
            throw new IllegalStateException("GPS does not have an active assignment");
        }
        DeviceSnapshot device = lockDevice(connection, inventory.deviceId());
        long assignmentId = insertAssignment(
                connection, gpsId, device, userId, "Asociacion existente incorporada a trazabilidad", null);
        insertEvent(connection, gpsId, device, userId, "ASSIGNMENT_IMPORTED", "Asociacion existente");
        return new ActiveAssignment(assignmentId, device);
    }

    private ActiveAssignment lockActiveAssignment(Connection connection, long gpsId) throws SQLException {
        String sql = "SELECT id, deviceid, devicenamesnapshot, deviceuniqueidsnapshot "
                + "FROM tc_gps_inventory_assignments WHERE gpsinventoryid = ? AND unassignedat IS NULL FOR UPDATE";
        try (var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, gpsId);
            try (var resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return null;
                }
                long deviceId = resultSet.getLong("deviceid");
                return new ActiveAssignment(
                        resultSet.getLong("id"),
                        new DeviceSnapshot(
                                resultSet.wasNull() ? null : deviceId,
                                resultSet.getString("devicenamesnapshot"),
                                resultSet.getString("deviceuniqueidsnapshot")));
            }
        }
    }

    private long insertAssignment(
            Connection connection, long gpsId, DeviceSnapshot device, long userId, String reason, String notes)
            throws SQLException {
        String sql = "INSERT INTO tc_gps_inventory_assignments "
                + "(gpsinventoryid, deviceid, devicenamesnapshot, deviceuniqueidsnapshot, assignedat, "
                + "assignedby, assignmentreason, notes, attributes) "
                + "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, '{}')";
        try (var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setLong(1, gpsId);
            statement.setLong(2, device.id());
            statement.setString(3, device.name());
            statement.setString(4, device.uniqueId());
            setUser(statement, 5, userId);
            statement.setString(6, reason);
            statement.setString(7, notes);
            statement.executeUpdate();
            try (var keys = statement.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("Assignment identifier was not generated");
                }
                return keys.getLong(1);
            }
        }
    }

    private void closeAssignment(
            Connection connection, long assignmentId, long userId, String reason, String notes) throws SQLException {
        String sql = "UPDATE tc_gps_inventory_assignments SET unassignedat = CURRENT_TIMESTAMP, "
                + "unassignedby = ?, unassignmentreason = ?, notes = COALESCE(?, notes) "
                + "WHERE id = ? AND unassignedat IS NULL";
        try (var statement = connection.prepareStatement(sql)) {
            setUser(statement, 1, userId);
            statement.setString(2, reason);
            statement.setString(3, notes);
            statement.setLong(4, assignmentId);
            if (statement.executeUpdate() != 1) {
                throw new IllegalStateException("Assignment is no longer active");
            }
        }
    }

    private void updateInventory(
            Connection connection, long gpsId, Long deviceId, long userId, String status) throws SQLException {
        String sql = "UPDATE tc_gps_inventory SET deviceid = ?, status = ?, "
                + "updatedat = CURRENT_TIMESTAMP, updatedby = ? WHERE id = ?";
        try (var statement = connection.prepareStatement(sql)) {
            if (deviceId != null) {
                statement.setLong(1, deviceId);
            } else {
                statement.setNull(1, Types.INTEGER);
            }
            statement.setString(2, status);
            setUser(statement, 3, userId);
            statement.setLong(4, gpsId);
            statement.executeUpdate();
        }
    }

    private void insertEvent(
            Connection connection, long gpsId, DeviceSnapshot device, long userId, String type, String notes)
            throws SQLException {
        String sql = "INSERT INTO tc_gps_inventory_events "
                + "(gpsinventoryid, eventtime, eventtype, deviceid, devicenamesnapshot, "
                + "deviceuniqueidsnapshot, userid, notes, attributes) "
                + "VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, '{}')";
        try (var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, gpsId);
            statement.setString(2, type);
            if (device.id() != null) {
                statement.setLong(3, device.id());
            } else {
                statement.setNull(3, Types.INTEGER);
            }
            statement.setString(4, device.name());
            statement.setString(5, device.uniqueId());
            setUser(statement, 6, userId);
            statement.setString(7, notes);
            statement.executeUpdate();
        }
    }

    private void validateUnassignedStatus(String status) {
        if (!UNASSIGNED_STATUSES.contains(status)) {
            throw new IllegalArgumentException("Unsupported unassignment status");
        }
    }

    private void requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    private void setUser(java.sql.PreparedStatement statement, int index, long userId) throws SQLException {
        if (userId > 0) {
            statement.setLong(index, userId);
        } else {
            statement.setNull(index, Types.INTEGER);
        }
    }

    private record InventoryState(String status, Long deviceId) {
    }

    private record DeviceSnapshot(Long id, String name, String uniqueId) {
    }

    private record ActiveAssignment(long id, DeviceSnapshot device) {
    }

}

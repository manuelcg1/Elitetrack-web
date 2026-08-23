package org.traccar.inventory;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.Date;
import java.util.Set;

@Singleton
public class GpsInventoryInspectionService {

    private static final Set<String> RESULTS = Set.of(
            "operational", "repaired", "requires_repair", "unrepairable", "observation");

    private final DataSource dataSource;

    @Inject
    public GpsInventoryInspectionService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public long start(long gpsInventoryId, long userId, String notes) throws SQLException {
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                lockInventory(connection, gpsInventoryId);
                ensureNotRetired(connection, gpsInventoryId);
                long inspectionId = insertInspection(connection, gpsInventoryId, userId, notes);
                updateStatus(connection, gpsInventoryId, userId, "en_revision");
                insertEvent(connection, gpsInventoryId, userId, "INSPECTION_STARTED", notes);
                connection.commit();
                return inspectionId;
            } catch (SQLException error) {
                connection.rollback();
                if ("23505".equals(error.getSQLState())) {
                    throw new IllegalStateException("GPS already has an active inspection", error);
                }
                throw error;
            } catch (RuntimeException error) {
                connection.rollback();
                throw error;
            }
        }
    }

    public void complete(
            long gpsInventoryId, long inspectionId, long userId, String result,
            String findings, String actionsTaken, Date nextInspectionAt, String notes) throws SQLException {
        if (!RESULTS.contains(result)) {
            throw new IllegalArgumentException("Unsupported inspection result");
        }
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                lockInventory(connection, gpsInventoryId);
                completeInspection(connection, gpsInventoryId, inspectionId, userId, result,
                        findings, actionsTaken, nextInspectionAt, notes);
                updateStatus(connection, gpsInventoryId, userId, statusForResult(result));
                insertEvent(connection, gpsInventoryId, userId, "INSPECTION_COMPLETED", notes);
                connection.commit();
            } catch (SQLException | RuntimeException error) {
                connection.rollback();
                throw error;
            }
        }
    }

    private void lockInventory(Connection connection, long id) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT id FROM tc_gps_inventory WHERE id = ? FOR UPDATE")) {
            statement.setLong(1, id);
            try (var resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new IllegalArgumentException("GPS inventory item not found");
                }
            }
        }
    }

    private void ensureNotRetired(Connection connection, long id) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT status FROM tc_gps_inventory WHERE id = ?")) {
            statement.setLong(1, id);
            try (var resultSet = statement.executeQuery()) {
                resultSet.next();
                if ("dado_de_baja".equals(resultSet.getString(1))) {
                    throw new IllegalStateException("Retired GPS cannot enter inspection");
                }
            }
        }
    }

    private long insertInspection(Connection connection, long gpsId, long userId, String notes)
            throws SQLException {
        String sql = "INSERT INTO tc_gps_inventory_inspections "
                + "(gpsinventoryid, startedat, technicianuserid, notes, attributes) "
                + "VALUES (?, CURRENT_TIMESTAMP, ?, ?, '{}')";
        try (var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setLong(1, gpsId);
            setUser(statement, 2, userId);
            statement.setString(3, notes);
            statement.executeUpdate();
            try (var keys = statement.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("Inspection identifier was not generated");
                }
                return keys.getLong(1);
            }
        }
    }

    private void completeInspection(
            Connection connection, long gpsId, long inspectionId, long userId, String result,
            String findings, String actionsTaken, Date nextInspectionAt, String notes) throws SQLException {
        String sql = "UPDATE tc_gps_inventory_inspections SET completedat = CURRENT_TIMESTAMP, "
                + "technicianuserid = ?, result = ?, findings = ?, actionstaken = ?, "
                + "nextinspectionat = ?, notes = ? WHERE id = ? AND gpsinventoryid = ? AND completedat IS NULL";
        try (var statement = connection.prepareStatement(sql)) {
            setUser(statement, 1, userId);
            statement.setString(2, result);
            statement.setString(3, findings);
            statement.setString(4, actionsTaken);
            if (nextInspectionAt != null) {
                statement.setTimestamp(5, new java.sql.Timestamp(nextInspectionAt.getTime()));
            } else {
                statement.setNull(5, Types.TIMESTAMP);
            }
            statement.setString(6, notes);
            statement.setLong(7, inspectionId);
            statement.setLong(8, gpsId);
            if (statement.executeUpdate() != 1) {
                throw new IllegalStateException("Inspection is not active");
            }
        }
    }

    private void updateStatus(Connection connection, long gpsId, long userId, String status) throws SQLException {
        try (var statement = connection.prepareStatement(
                "UPDATE tc_gps_inventory SET status = ?, updatedat = CURRENT_TIMESTAMP, updatedby = ? WHERE id = ?")) {
            statement.setString(1, status);
            setUser(statement, 2, userId);
            statement.setLong(3, gpsId);
            statement.executeUpdate();
        }
    }

    private void insertEvent(Connection connection, long gpsId, long userId, String type, String notes)
            throws SQLException {
        String sql = "INSERT INTO tc_gps_inventory_events "
                + "(gpsinventoryid, eventtime, eventtype, userid, notes, attributes) "
                + "VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, '{}')";
        try (var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, gpsId);
            statement.setString(2, type);
            setUser(statement, 3, userId);
            statement.setString(4, notes);
            statement.executeUpdate();
        }
    }

    private void setUser(java.sql.PreparedStatement statement, int index, long userId) throws SQLException {
        if (userId > 0) {
            statement.setLong(index, userId);
        } else {
            statement.setNull(index, Types.INTEGER);
        }
    }

    private String statusForResult(String result) {
        return switch (result) {
            case "unrepairable" -> "danado";
            case "requires_repair", "observation" -> "en_revision";
            default -> "en_almacen";
        };
    }

}

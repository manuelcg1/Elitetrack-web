package org.traccar.alert;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

@Singleton
public class AlertRecipientRepository {

    private final DataSource dataSource;

    @Inject
    public AlertRecipientRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public List<Long> getUserIds(long alertId) throws SQLException {
        try (var connection = dataSource.getConnection();
                var statement = connection.prepareStatement(
                        "SELECT userid FROM tc_alert_recipients WHERE alertid = ? ORDER BY userid")) {
            statement.setLong(1, alertId);
            try (var resultSet = statement.executeQuery()) {
                var result = new java.util.ArrayList<Long>();
                while (resultSet.next()) {
                    result.add(resultSet.getLong(1));
                }
                return result;
            }
        }
    }

    public void replace(long alertId, Collection<Long> requestedUserIds) throws SQLException {
        var userIds = new LinkedHashSet<>(requestedUserIds);
        try (var connection = dataSource.getConnection()) {
            boolean autoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                try (var delete = connection.prepareStatement(
                        "DELETE FROM tc_alert_recipients WHERE alertid = ?")) {
                    delete.setLong(1, alertId);
                    delete.executeUpdate();
                }
                if (!userIds.isEmpty()) {
                    try (var insert = connection.prepareStatement(
                            "INSERT INTO tc_alert_recipients (alertid, userid) VALUES (?, ?)")) {
                        for (long userId : userIds) {
                            insert.setLong(1, alertId);
                            insert.setLong(2, userId);
                            insert.addBatch();
                        }
                        insert.executeBatch();
                    }
                }
                connection.commit();
            } catch (SQLException e) {
                connection.rollback();
                throw e;
            } finally {
                connection.setAutoCommit(autoCommit);
            }
        }
    }

}

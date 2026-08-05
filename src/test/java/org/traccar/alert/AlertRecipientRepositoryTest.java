package org.traccar.alert;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class AlertRecipientRepositoryTest {

    private JdbcDataSource createDataSource() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:alertRecipients" + System.nanoTime() + ";DB_CLOSE_DELAY=-1");
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE tc_alerts (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE tc_users (id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE tc_alert_recipients (alertid BIGINT NOT NULL, userid BIGINT NOT NULL, "
                    + "PRIMARY KEY (alertid, userid), FOREIGN KEY (alertid) REFERENCES tc_alerts(id) ON DELETE CASCADE, "
                    + "FOREIGN KEY (userid) REFERENCES tc_users(id) ON DELETE CASCADE)");
            statement.execute("INSERT INTO tc_alerts VALUES (9)");
            statement.execute("INSERT INTO tc_users VALUES (1), (4), (8)");
        }
        return dataSource;
    }

    @Test
    public void testReplaceDeduplicatesAndReplacesCollection() throws Exception {
        JdbcDataSource dataSource = createDataSource();
        AlertRecipientRepository repository = new AlertRecipientRepository(dataSource);
        repository.replace(9, List.of(1L, 4L, 4L));
        assertEquals(List.of(1L, 4L), repository.getUserIds(9));
        repository.replace(9, List.of(8L));
        assertEquals(List.of(8L), repository.getUserIds(9));
    }

    @Test
    public void testAlertDeleteCascadesRecipients() throws Exception {
        JdbcDataSource dataSource = createDataSource();
        AlertRecipientRepository repository = new AlertRecipientRepository(dataSource);
        repository.replace(9, List.of(1L, 4L));
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM tc_alerts WHERE id = 9");
        }
        assertEquals(List.of(), repository.getUserIds(9));
    }

}

package org.traccar.forward.sutran;

import liquibase.Contexts;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.resource.DirectoryResourceAccessor;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.sql.DriverManager;
import java.util.HashMap;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class SutranMigrationTest {

    @Test
    public void testCompleteChangelogOnIsolatedDatabase() throws Exception {
        String url = "jdbc:h2:mem:sutranMigration;DB_CLOSE_DELAY=-1";
        var resourceAccessor = new DirectoryResourceAccessor(new File("."));
        Database database = DatabaseFactory.getInstance().openDatabase(
                url, "sa", "", "org.h2.Driver", null, null, null, resourceAccessor);
        try (Liquibase liquibase = new Liquibase("schema/changelog-master.xml", resourceAccessor, database)) {
            liquibase.update(new Contexts());
        }

        try (var connection = DriverManager.getConnection(url, "sa", "")) {
            var metadata = connection.getMetaData();
            assertTrue(metadata.getTables(null, null, "TC_FORWARD_DELIVERIES", null).next());
            assertTrue(metadata.getColumns(null, null, "TC_FORWARD_SERVERS", "TYPE").next());
            assertTrue(metadata.getColumns(null, null, "TC_FORWARD_SERVERS", "TRANSMISSIONENABLED").next());
            var uniqueIndexes = new HashMap<String, HashSet<String>>();
            try (var indexes = metadata.getIndexInfo(null, null, "TC_FORWARD_DELIVERIES", true, false)) {
                while (indexes.next()) {
                    String indexName = indexes.getString("INDEX_NAME");
                    String columnName = indexes.getString("COLUMN_NAME");
                    if (indexName != null && columnName != null) {
                        uniqueIndexes.computeIfAbsent(indexName, key -> new HashSet<>()).add(columnName);
                    }
                }
            }
            assertTrue(uniqueIndexes.values().stream()
                    .anyMatch(columns -> columns.contains("POSITIONID") && columns.contains("SERVERID")));
        }
    }

}

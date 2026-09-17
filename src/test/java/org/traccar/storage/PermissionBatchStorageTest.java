package org.traccar.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.traccar.config.Config;

import java.util.UUID;

public class PermissionBatchStorageTest {

    @Test
    public void additionsAndRemovalsCommitOrRollbackTogether() throws Exception {
        var source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:" + UUID.randomUUID());
        try (var connection = source.getConnection()) {
            PermissionBatchContract.prepare(connection);
            PermissionBatchContract.verify(new DatabaseStorage(new Config(), source, new ObjectMapper()));
        }
    }
}

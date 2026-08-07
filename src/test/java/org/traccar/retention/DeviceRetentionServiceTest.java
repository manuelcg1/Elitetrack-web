package org.traccar.retention;

import org.junit.jupiter.api.Test;
import org.traccar.config.Config;
import org.traccar.model.DeviceRetentionPolicy;
import org.traccar.storage.Storage;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

public class DeviceRetentionServiceTest {

    private DeviceRetentionService service() {
        return new DeviceRetentionService(
                mock(DeviceRetentionRepository.class), mock(Storage.class), mock(DataSource.class), new Config());
    }

    private DeviceRetentionPolicy policy(int days) {
        DeviceRetentionPolicy policy = new DeviceRetentionPolicy();
        policy.setDeviceId(1);
        policy.setEnabled(true);
        policy.setRetentionDays(days);
        return policy;
    }

    @Test
    public void testRetentionDaysValidation() {
        DeviceRetentionService service = service();
        assertDoesNotThrow(() -> service.validate(policy(30)));
        assertDoesNotThrow(() -> service.validate(policy(3650)));
        assertThrows(IllegalArgumentException.class, () -> service.validate(policy(29)));
        assertThrows(IllegalArgumentException.class, () -> service.validate(policy(3651)));
        service.stop();
    }
}

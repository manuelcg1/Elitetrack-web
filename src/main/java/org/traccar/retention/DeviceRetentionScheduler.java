package org.traccar.retention;

import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.schedule.SingleScheduleTask;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class DeviceRetentionScheduler extends SingleScheduleTask {

    private static final Logger LOGGER = LoggerFactory.getLogger(DeviceRetentionScheduler.class);

    private final DeviceRetentionRepository repository;
    private final DeviceRetentionService service;
    private final boolean enabled;
    private final LocalTime schedule;
    private final int maxDevices;

    @Inject
    public DeviceRetentionScheduler(
            DeviceRetentionRepository repository, DeviceRetentionService service, Config config) {
        this.repository = repository;
        this.service = service;
        enabled = config.getBoolean(Keys.RETENTION_ENABLED);
        schedule = LocalTime.parse(config.getString(Keys.RETENTION_SCHEDULE));
        maxDevices = Math.max(0, config.getInteger(Keys.RETENTION_MAX_DEVICES_PER_RUN));
    }

    @Override
    public void schedule(ScheduledExecutorService executor) {
        if (enabled) {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime next = now.toLocalDate().atTime(schedule);
            if (!next.isAfter(now)) {
                next = next.plusDays(1);
            }
            executor.scheduleAtFixedRate(this, Duration.between(now, next).toMillis(),
                    TimeUnit.DAYS.toMillis(1), TimeUnit.MILLISECONDS);
        }
    }

    @Override
    public void run() {
        LOGGER.info("Device retention run started");
        try {
            var policies = repository.getActive();
            int limit = maxDevices > 0 ? Math.min(maxDevices, policies.size()) : policies.size();
            for (int i = 0; i < limit; i++) {
                service.executeScheduled(policies.get(i));
            }
        } catch (Exception e) {
            LOGGER.warn("Device retention scheduler failed", e);
        }
        LOGGER.info("Device retention run finished");
    }
}

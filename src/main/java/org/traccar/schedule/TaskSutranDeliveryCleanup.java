package org.traccar.schedule;

import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.model.ForwardDelivery;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class TaskSutranDeliveryCleanup extends SingleScheduleTask {

    private static final Logger LOGGER = LoggerFactory.getLogger(TaskSutranDeliveryCleanup.class);
    private static final int RETENTION_DAYS = 30;

    private final Storage storage;

    @Inject
    public TaskSutranDeliveryCleanup(Storage storage) {
        this.storage = storage;
    }

    @Override
    public void schedule(ScheduledExecutorService executor) {
        executor.scheduleAtFixedRate(this, 24, 24, TimeUnit.HOURS);
    }

    @Override
    public void run() {
        Date cutoff = Date.from(Instant.now().minus(RETENTION_DAYS, ChronoUnit.DAYS));
        Condition finalStatus = new Condition.Or(
                new Condition.Equals("status", ForwardDelivery.STATUS_DELIVERED),
                new Condition.Or(
                        new Condition.Equals("status", ForwardDelivery.STATUS_REJECTED),
                        new Condition.Equals("status", ForwardDelivery.STATUS_FAILED)));
        try {
            storage.removeObject(
                    ForwardDelivery.class,
                    new Request(new Condition.And(finalStatus, new Condition.Compare("createdTime", "<", cutoff))));
        } catch (StorageException e) {
            LOGGER.warn("Failed to delete expired SUTRAN deliveries", e);
        }
    }

}

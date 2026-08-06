package org.traccar.alert;

import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class AlertGeofenceStateManagerTest {

    private static AlertGeofenceStateManager.AlertGeofenceStateKey key(
            long alertId, long deviceId, long geofenceId) {
        return new AlertGeofenceStateManager.AlertGeofenceStateKey(alertId, deviceId, geofenceId);
    }

    @Test
    public void testInitializationAndTransitions() {
        var manager = new AlertGeofenceStateManager(60000, 60000, 100);
        var key = key(1, 2, 3);

        var initialized = manager.update(key, AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        assertTrue(initialized.initialized());
        assertFalse(initialized.changed());

        var unchanged = manager.update(key, AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        assertFalse(unchanged.initialized());
        assertFalse(unchanged.changed());

        var exit = manager.update(key, AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE);
        assertTrue(exit.changed());
        assertEquals(AlertGeofenceStateManager.AlertGeofenceState.INSIDE, exit.previous());

        var enter = manager.update(key, AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        assertTrue(enter.changed());
        assertEquals(AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE, enter.previous());
    }

    @Test
    public void testAlertsDevicesAndGeofencesHaveIndependentState() {
        var manager = new AlertGeofenceStateManager(60000, 60000, 100);
        manager.update(key(1, 1, 1), AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        manager.update(key(2, 1, 1), AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE);
        manager.update(key(1, 2, 1), AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE);
        manager.update(key(1, 1, 2), AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE);

        assertEquals(AlertGeofenceStateManager.AlertGeofenceState.INSIDE, manager.getState(key(1, 1, 1)));
        assertEquals(AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE, manager.getState(key(2, 1, 1)));
        assertEquals(AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE, manager.getState(key(1, 2, 1)));
        assertEquals(AlertGeofenceStateManager.AlertGeofenceState.OUTSIDE, manager.getState(key(1, 1, 2)));
    }

    @Test
    public void testExplicitRemoval() {
        var manager = new AlertGeofenceStateManager(60000, 60000, 100);
        manager.update(key(1, 1, 1), AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        manager.update(key(1, 2, 2), AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        manager.update(key(2, 2, 3), AlertGeofenceStateManager.AlertGeofenceState.INSIDE);

        manager.removeByGeofenceId(1);
        assertNull(manager.getState(key(1, 1, 1)));
        manager.removeByAlertId(1);
        assertNull(manager.getState(key(1, 2, 2)));
        manager.removeByDeviceId(2);
        assertNull(manager.getState(key(2, 2, 3)));
        assertEquals(0, manager.size());
    }

    @Test
    public void testExpirationAndMaximumSize() throws Exception {
        var expiringManager = new AlertGeofenceStateManager(1, 1, 100);
        expiringManager.update(key(1, 1, 1), AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        Thread.sleep(5);
        expiringManager.cleanup();
        assertEquals(0, expiringManager.size());

        var boundedManager = new AlertGeofenceStateManager(60000, 60000, 2);
        boundedManager.update(key(1, 1, 1), AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        boundedManager.update(key(1, 1, 2), AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        boundedManager.update(key(1, 1, 3), AlertGeofenceStateManager.AlertGeofenceState.INSIDE);
        boundedManager.cleanup();
        assertEquals(2, boundedManager.size());
    }

    @Test
    public void testConcurrentInitializationIsAtomic() throws Exception {
        var manager = new AlertGeofenceStateManager(60000, 60000, 100);
        var key = key(1, 1, 1);
        var start = new CountDownLatch(1);
        var done = new CountDownLatch(8);
        var initialized = new java.util.concurrent.atomic.AtomicInteger();
        var executor = Executors.newFixedThreadPool(8);
        try {
            for (int i = 0; i < 8; i++) {
                executor.execute(() -> {
                    try {
                        start.await();
                        if (manager.update(key, AlertGeofenceStateManager.AlertGeofenceState.INSIDE).initialized()) {
                            initialized.incrementAndGet();
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        done.countDown();
                    }
                });
            }
            start.countDown();
            done.await();
        } finally {
            executor.shutdownNow();
        }
        assertEquals(1, initialized.get());
        assertEquals(1, manager.size());
    }
}

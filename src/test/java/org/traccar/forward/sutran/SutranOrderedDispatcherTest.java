package org.traccar.forward.sutran;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SutranOrderedDispatcherTest {

    @Test
    void onlyOneWorkerPerKeyAndNoGlobalWait() {
        var workers = new ArrayList<Runnable>();
        var dispatcher = new SutranOrderedDispatcher<String>(workers::add);
        var order = new ArrayList<Integer>();
        var finish = new AtomicReference<Runnable>();
        dispatcher.submit("first", done -> {
            order.add(1);
            finish.set(done);
        });
        dispatcher.submit("first", done -> {
            order.add(2);
            done.run();
        });
        dispatcher.submit("other", done -> {
            order.add(3);
            done.run();
        });
        assertEquals(2, workers.size());
        workers.get(1).run();
        workers.get(0).run();
        assertEquals(List.of(3, 1), order);
        finish.get().run();
        workers.get(2).run();
        assertEquals(List.of(3, 1, 2), order);
    }

    @Test
    void failedOperationReleasesLane() {
        var dispatcher = new SutranOrderedDispatcher<String>(Runnable::run);
        dispatcher.submit("test", done -> { throw new IllegalStateException("Synthetic failure"); });
        var calls = new ArrayList<Integer>();
        dispatcher.submit("test", done -> {
            calls.add(1);
            done.run();
        });
        assertEquals(List.of(1), calls);
    }
}

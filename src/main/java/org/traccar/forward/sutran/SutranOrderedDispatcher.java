package org.traccar.forward.sutran;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.function.Consumer;

/** FIFO per key; a lane remains occupied until its asynchronous operation completes. */
public final class SutranOrderedDispatcher<K> {

    private static final org.slf4j.Logger LOGGER = org.slf4j.LoggerFactory.getLogger(SutranOrderedDispatcher.class);
    private final Executor executor;
    private final Map<K, CompletableFuture<Void>> tails = new HashMap<>();

    public SutranOrderedDispatcher(Executor executor) {
        this.executor = executor;
    }

    public void submit(K key, Consumer<Runnable> operation) {
        submit(key, operation, () -> { });
    }

    public void submit(K key, Consumer<Runnable> operation, Runnable rejected) {
        var completed = new CompletableFuture<Void>();
        CompletableFuture<Void> previous;
        synchronized (tails) {
            previous = tails.put(key, completed);
        }
        completed.whenComplete((value, error) -> {
            synchronized (tails) {
                tails.remove(key, completed);
            }
        });
        Runnable start = () -> {
            try {
                executor.execute(() -> {
                    try {
                        operation.accept(() -> completed.complete(null));
                    } catch (RuntimeException e) {
                        LOGGER.warn("SUTRAN ordered operation failed; lane released");
                        rejected.run();
                        completed.complete(null);
                    }
                });
            } catch (RuntimeException e) {
                LOGGER.warn("SUTRAN executor unavailable; pending persisted work requires recovery");
                rejected.run();
                completed.complete(null);
            }
        };
        if (previous == null) {
            start.run();
        } else {
            previous.whenComplete((value, error) -> start.run());
        }
    }
}

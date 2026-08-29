package org.traccar;

import org.junit.jupiter.api.Test;
import org.traccar.handler.DatabaseHandler;
import org.traccar.handler.PositionForwardingHandler;
import org.traccar.handler.SutranForwardingHandler;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class ProcessingHandlerOrderTest {

    @Test
    public void testSutranForwardingRunsAfterPositionPersistence() {
        int genericForwarding = ProcessingHandler.POSITION_HANDLER_CLASSES.indexOf(PositionForwardingHandler.class);
        int persistence = ProcessingHandler.POSITION_HANDLER_CLASSES.indexOf(DatabaseHandler.class);
        int sutranForwarding = ProcessingHandler.POSITION_HANDLER_CLASSES.indexOf(SutranForwardingHandler.class);

        assertTrue(genericForwarding >= 0 && genericForwarding < persistence);
        assertTrue(persistence >= 0 && persistence < sutranForwarding);
    }

}

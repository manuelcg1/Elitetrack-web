package org.traccar.forward.sutran;

public record SutranSendResult(SutranDeliveryResult result, int attempts) {
}

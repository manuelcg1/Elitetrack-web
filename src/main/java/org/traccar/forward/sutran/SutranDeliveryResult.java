package org.traccar.forward.sutran;

public record SutranDeliveryResult(
        Status status, int httpStatus, Integer responseCode, String crc, String message) {

    public enum Status {
        DELIVERED,
        RETRY,
        REJECTED
    }

    public static SutranDeliveryResult classify(int httpStatus, SutranTransmissionResponse response) {
        if (httpStatus == 408 || httpStatus == 429 || httpStatus >= 500) {
            return new SutranDeliveryResult(
                    Status.RETRY, httpStatus, responseCode(response), null, responseMessage(response));
        }
        if (httpStatus < 200 || httpStatus >= 300) {
            return new SutranDeliveryResult(
                    Status.REJECTED, httpStatus, responseCode(response), null, responseMessage(response));
        }
        if (response == null) {
            return new SutranDeliveryResult(Status.RETRY, httpStatus, null, null, "Empty SUTRAN response");
        }
        if (response.getCode() == SutranResponseCode.DELIVERED.getCode()) {
            if (response.getCrc() == null || !response.getCrc().matches("[0-9A-Za-z]{6}")) {
                return new SutranDeliveryResult(
                        Status.RETRY, httpStatus, response.getCode(), null, "Invalid SUTRAN CRC");
            }
            return new SutranDeliveryResult(
                    Status.DELIVERED, httpStatus, response.getCode(), response.getCrc(), response.getResult());
        }
        return new SutranDeliveryResult(
                Status.REJECTED, httpStatus, response.getCode(), null, response.getResult());
    }

    private static Integer responseCode(SutranTransmissionResponse response) {
        return response != null ? response.getCode() : null;
    }

    private static String responseMessage(SutranTransmissionResponse response) {
        return response != null ? response.getResult() : null;
    }

}

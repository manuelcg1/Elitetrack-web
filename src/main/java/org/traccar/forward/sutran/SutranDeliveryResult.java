package org.traccar.forward.sutran;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public record SutranDeliveryResult(
        Status status, int httpStatus, Integer responseCode, String crc, String message) {

    private static final Logger LOGGER = LoggerFactory.getLogger(SutranDeliveryResult.class);

    public enum Status {
        DELIVERED,
        RETRY,
        REJECTED
    }

    public static SutranDeliveryResult classify(int httpStatus, SutranTransmissionResponse response) {
        Integer code = response != null ? response.getCode() : null;
        String crc = response != null ? response.getCrc() : null;
        if (code != null && (code == 2000 || code == 2001)) {
            // Acknowledged records must never be resent, even when the acknowledgement is anomalous.
            if (httpStatus < 200 || httpStatus >= 300 || crc == null || crc.isBlank()) {
                LOGGER.warn("SUTRAN acknowledged delivery anomaly: HTTP {}, code {}, CRC present {}",
                        httpStatus, code, crc != null && !crc.isBlank());
                return new SutranDeliveryResult(Status.REJECTED, httpStatus, code, crc,
                        "SUTRAN acknowledgement anomaly: missing CRC or inconsistent HTTP status; not retried");
            }
            if (!crc.matches("[0-9A-Za-z]{6}")) {
                LOGGER.warn("SUTRAN CRC differs from documented format: code {}, length {}", code, crc.length());
            }
            return new SutranDeliveryResult(Status.DELIVERED, httpStatus, code, crc, null);
        }
        // These are functional/authentication failures, irrespective of their HTTP envelope.
        if (code != null && SutranResponseCode.fromCode(code).isPresent()) {
            return new SutranDeliveryResult(Status.REJECTED, httpStatus, code, crc,
                    "SUTRAN rejected request: code " + code);
        }
        if (httpStatus == 408 || httpStatus == 429 || httpStatus >= 500 || response == null
                && httpStatus >= 200 && httpStatus < 300) {
            return new SutranDeliveryResult(Status.RETRY, httpStatus, code, crc,
                    "SUTRAN transient HTTP failure or unreadable response");
        }
        // Do not expose an untrusted remote result string, which can echo credentials or payloads.
        return new SutranDeliveryResult(Status.REJECTED, httpStatus, code, crc,
                "SUTRAN request rejected or response code unknown");
    }

}

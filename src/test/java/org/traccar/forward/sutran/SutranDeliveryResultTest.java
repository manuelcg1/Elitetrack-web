package org.traccar.forward.sutran;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

public class SutranDeliveryResultTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private SutranTransmissionResponse response(String json) throws Exception {
        return objectMapper.readValue(json, SutranTransmissionResponse.class);
    }

    @Test
    public void testSuccessfulResponse() throws Exception {
        SutranDeliveryResult result = SutranDeliveryResult.classify(
                200, response("{\"crc\":\"yB5kht\",\"code\":2000,\"result\":\"OK\"}"));

        assertEquals(SutranDeliveryResult.Status.DELIVERED, result.status());
        assertEquals(2000, result.responseCode());
        assertEquals("yB5kht", result.crc());
    }

    @Test
    public void testHttp200IsNotEnough() throws Exception {
        SutranDeliveryResult result = SutranDeliveryResult.classify(
                200, response("{\"code\":4002,\"result\":\"Cadena JSON no cumple caracteristicas\"}"));

        assertEquals(SutranDeliveryResult.Status.REJECTED, result.status());
        assertEquals(4002, result.responseCode());
        assertNull(result.crc());
    }

    @Test
    public void testShortCrcIsPreserved() throws Exception {
        SutranDeliveryResult result = SutranDeliveryResult.classify(
                200, response("{\"crc\":\"bad\",\"code\":2000,\"result\":\"OK\"}"));

        assertEquals(SutranDeliveryResult.Status.DELIVERED, result.status());
        assertEquals("bad", result.crc());
        assertNull(result.message());
    }

    @Test
    public void testHistoricalSuccessAndMissingCrcNeverRetry() throws Exception {
        for (int code : new int[] {2000, 2001}) {
            var delivered = SutranDeliveryResult.classify(200,
                    response("{\"code\":" + code + ",\"crc\":\"S8J7e\",\"result\":\"OK\"}"));
            assertEquals(SutranDeliveryResult.Status.DELIVERED, delivered.status());
            assertEquals("S8J7e", delivered.crc());
            assertNull(delivered.message());
            var missing = SutranDeliveryResult.classify(200, response("{\"code\":" + code + "}"));
            assertEquals(SutranDeliveryResult.Status.REJECTED, missing.status());
            assertEquals(code, missing.responseCode());
            assertNull(missing.crc());
        }
    }

    @Test
    public void testRemoteMessageIsNeverReflectedAndSuccessIsNotRetriedOnInconsistentHttp() throws Exception {
        var rejected = SutranDeliveryResult.classify(400,
                response("{\"code\":4002,\"result\":\"sensitive-synthetic-text\"}"));
        org.junit.jupiter.api.Assertions.assertFalse(rejected.message().contains("sensitive-synthetic-text"));
        for (int code : new int[] {2000, 2001}) {
            var result = SutranDeliveryResult.classify(503,
                    response("{\"code\":" + code + ",\"crc\":\"S8J7e\"}"));
            assertEquals(SutranDeliveryResult.Status.REJECTED, result.status());
            assertEquals("S8J7e", result.crc());
        }
    }

    @Test
    public void testTransientHttpResponses() {
        assertEquals(SutranDeliveryResult.Status.RETRY, SutranDeliveryResult.classify(408, null).status());
        assertEquals(SutranDeliveryResult.Status.RETRY, SutranDeliveryResult.classify(429, null).status());
        assertEquals(SutranDeliveryResult.Status.RETRY, SutranDeliveryResult.classify(503, null).status());
    }

    @Test
    public void testPermanentHttpResponse() {
        assertEquals(SutranDeliveryResult.Status.REJECTED, SutranDeliveryResult.classify(401, null).status());
    }

    @Test
    public void testValidationErrorPayload() throws Exception {
        SutranTransmissionResponse response = response(
                "{\"error\":[{\"path\":\"/plate\",\"txt\":\"String is too long: 7/6.\"}],"
                        + "\"code\":4002,\"result\":\"Cadena JSON no cumple caracteristicas\"}");

        assertEquals("/plate", response.getError().get(0).getPath());
        assertEquals("String is too long: 7/6.", response.getError().get(0).getTxt());
    }

    @Test
    public void testContractRejectionCodesAreFinal() throws Exception {
        for (int code = 4001; code <= 4004; code++) {
            SutranDeliveryResult result = SutranDeliveryResult.classify(
                    200, response("{\"code\":" + code + ",\"result\":\"Rejected\"}"));
            assertEquals(SutranDeliveryResult.Status.REJECTED, result.status());
        }
    }

    @Test
    public void testContractServerCodesAreFinalWhenReturnedInSuccessfulHttp() throws Exception {
        for (int code = 5001; code <= 5003; code++) {
            SutranDeliveryResult result = SutranDeliveryResult.classify(
                    200, response("{\"code\":" + code + ",\"result\":\"Server response\"}"));
            assertEquals(SutranDeliveryResult.Status.REJECTED, result.status());
        }
    }

}

package org.traccar.forward.sutran;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.InvocationCallback;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.glassfish.jersey.client.ClientProperties;
import org.traccar.forward.PositionData;

import java.net.URI;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public class SutranClient {

    public static final String ACCESS_TOKEN_HEADER = "access-token";

    private final Client client;
    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService scheduler;
    private final SutranPayloadMapper payloadMapper;
    private final URI endpoint;
    private final String accessToken;
    private final int connectTimeout;
    private final int readTimeout;
    private final int maximumAttempts;
    private final long initialRetryDelay;
    private final long maximumRetryDelay;

    public SutranClient(
            Client client, ObjectMapper objectMapper, ScheduledExecutorService scheduler,
            SutranEnvironment environment, String accessToken, int connectTimeout, int readTimeout,
            int maximumAttempts, long initialRetryDelay, long maximumRetryDelay) {
        this(client, objectMapper, scheduler, new SutranPayloadMapper(), environment.getEndpoint(), accessToken,
                connectTimeout, readTimeout, maximumAttempts, initialRetryDelay, maximumRetryDelay);
    }

    SutranClient(
            Client client, ObjectMapper objectMapper, ScheduledExecutorService scheduler,
            SutranPayloadMapper payloadMapper, URI endpoint, String accessToken,
            int connectTimeout, int readTimeout, int maximumAttempts,
            long initialRetryDelay, long maximumRetryDelay) {
        this.client = Objects.requireNonNull(client);
        this.objectMapper = Objects.requireNonNull(objectMapper);
        this.scheduler = Objects.requireNonNull(scheduler);
        this.payloadMapper = Objects.requireNonNull(payloadMapper);
        this.endpoint = validateEndpoint(endpoint);
        this.accessToken = validateAccessToken(accessToken);
        this.connectTimeout = requirePositive(connectTimeout, "connect timeout");
        this.readTimeout = requirePositive(readTimeout, "read timeout");
        this.maximumAttempts = requirePositive(maximumAttempts, "maximum attempts");
        this.initialRetryDelay = requirePositive(initialRetryDelay, "initial retry delay");
        this.maximumRetryDelay = requirePositive(maximumRetryDelay, "maximum retry delay");
        if (initialRetryDelay > maximumRetryDelay) {
            throw new IllegalArgumentException("Initial retry delay cannot exceed maximum retry delay");
        }
    }

    public void send(PositionData positionData, Consumer<SutranDeliveryResult> resultHandler) {
        Objects.requireNonNull(resultHandler);
        SutranTransmissionRequest request;
        try {
            request = payloadMapper.map(positionData);
        } catch (IllegalArgumentException e) {
            resultHandler.accept(new SutranDeliveryResult(
                    SutranDeliveryResult.Status.REJECTED, 0, null, null, e.getMessage()));
            return;
        }
        send(request, resultHandler);
    }

    public void send(SutranTransmissionRequest request, Consumer<SutranDeliveryResult> resultHandler) {
        sendTracked(request, result -> resultHandler.accept(result.result()));
    }

    public void sendTracked(SutranTransmissionRequest request, Consumer<SutranSendResult> resultHandler) {
        Objects.requireNonNull(request);
        Objects.requireNonNull(resultHandler);
        try {
            send(objectMapper.writeValueAsString(request), 1, resultHandler);
        } catch (JsonProcessingException e) {
            resultHandler.accept(new SutranSendResult(new SutranDeliveryResult(
                    SutranDeliveryResult.Status.REJECTED, 0, null, null, "Unable to create SUTRAN JSON"), 0));
        }
    }

    private void send(String payload, int attempt, Consumer<SutranSendResult> resultHandler) {
        try {
            client.target(endpoint)
                    .property(ClientProperties.CONNECT_TIMEOUT, connectTimeout)
                    .property(ClientProperties.READ_TIMEOUT, readTimeout)
                    .request(MediaType.APPLICATION_JSON_TYPE)
                    .header(ACCESS_TOKEN_HEADER, accessToken)
                    .async()
                    .post(Entity.entity(payload, MediaType.APPLICATION_JSON_TYPE), new InvocationCallback<Response>() {
                        @Override
                        public void completed(Response response) {
                            try {
                                SutranDeliveryResult result = SutranDeliveryResult.classify(
                                        response.getStatus(), parseResponse(response));
                                finish(payload, attempt, result, resultHandler);
                            } finally {
                                response.close();
                            }
                        }

                        @Override
                        public void failed(Throwable throwable) {
                            finish(payload, attempt, transportFailure(throwable), resultHandler);
                        }
                    });
        } catch (RuntimeException e) {
            finish(payload, attempt, transportFailure(e), resultHandler);
        }
    }

    private SutranTransmissionResponse parseResponse(Response response) {
        if (!response.hasEntity()) {
            return null;
        }
        try {
            return objectMapper.readValue(response.readEntity(String.class), SutranTransmissionResponse.class);
        } catch (JsonProcessingException | IllegalStateException e) {
            return null;
        }
    }

    private void finish(
            String payload, int attempt, SutranDeliveryResult result,
            Consumer<SutranSendResult> resultHandler) {
        if (result.status() == SutranDeliveryResult.Status.RETRY && attempt < maximumAttempts) {
            long delay = retryDelay(attempt);
            try {
                scheduler.schedule(() -> send(payload, attempt + 1, resultHandler), delay, TimeUnit.MILLISECONDS);
            } catch (RuntimeException e) {
                resultHandler.accept(new SutranSendResult(transportFailure(e), attempt));
            }
        } else {
            resultHandler.accept(new SutranSendResult(result, attempt));
        }
    }

    private long retryDelay(int attempt) {
        long multiplier = 1L << Math.min(attempt - 1, 30);
        if (initialRetryDelay > Long.MAX_VALUE / multiplier) {
            return maximumRetryDelay;
        }
        return Math.min(initialRetryDelay * multiplier, maximumRetryDelay);
    }

    private static SutranDeliveryResult transportFailure(Throwable throwable) {
        String type = throwable != null ? throwable.getClass().getSimpleName() : "Unknown";
        return new SutranDeliveryResult(
                SutranDeliveryResult.Status.RETRY, 0, null, null, "SUTRAN transport failure (" + type + ")");
    }

    private static String validateAccessToken(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("SUTRAN access token is required");
        }
        String token = value.trim();
        try {
            UUID.fromString(token);
            return token;
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("SUTRAN access token must be a UUID", e);
        }
    }

    private static URI validateEndpoint(URI value) {
        if (value == null || value.getScheme() == null || value.getHost() == null) {
            throw new IllegalArgumentException("SUTRAN endpoint is invalid");
        }
        return value;
    }

    private static int requirePositive(int value, String name) {
        if (value <= 0) {
            throw new IllegalArgumentException("SUTRAN " + name + " must be positive");
        }
        return value;
    }

    private static long requirePositive(long value, String name) {
        if (value <= 0) {
            throw new IllegalArgumentException("SUTRAN " + name + " must be positive");
        }
        return value;
    }

}

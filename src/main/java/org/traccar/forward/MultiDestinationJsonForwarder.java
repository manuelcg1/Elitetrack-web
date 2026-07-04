package org.traccar.forward;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.InvocationCallback;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.traccar.forward.centralperu.CentralPeruPositionRequest;
import org.traccar.model.Device;
import org.traccar.model.ForwardServer;
import org.traccar.model.Position;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class MultiDestinationJsonForwarder {

    private final Client client;
    private final ObjectMapper objectMapper;

    @Inject
    public MultiDestinationJsonForwarder(Client client, ObjectMapper objectMapper) {
        this.client = client;
        this.objectMapper = objectMapper;
    }

    public void forward(List<ForwardServer> servers, PositionData positionData, ResultHandler resultHandler) {
        if (servers.isEmpty()) {
            resultHandler.onResult(true, null);
            return;
        }

        String payload;
        try {
            payload = objectMapper.writeValueAsString(createRequest(positionData));
        } catch (JsonProcessingException e) {
            resultHandler.onResult(false, e);
            return;
        }

        AtomicInteger pending = new AtomicInteger(servers.size());
        AtomicReference<Throwable> failure = new AtomicReference<>();

        for (ForwardServer server : servers) {
            try {
                var requestBuilder = client.target(server.getIpDominio()).request();
                if (server.getUsername() != null && !server.getUsername().isBlank()) {
                    String password = server.getPassword() != null ? server.getPassword() : "";
                    String credentials = server.getUsername() + ":" + password;
                    String token = Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
                    requestBuilder.header(
                            HttpHeaders.AUTHORIZATION,
                            "Basic " + token);
                }
                if (server.getApiKey() != null && !server.getApiKey().isBlank()) {
                    requestBuilder.header("x-api-key", server.getApiKey());
                }
                var entity = Entity.entity(payload, MediaType.APPLICATION_JSON_TYPE);
                requestBuilder.async().post(entity, new InvocationCallback<Response>() {
                    @Override
                    public void completed(Response response) {
                        try {
                            if (response.getStatusInfo().getFamily() != Response.Status.Family.SUCCESSFUL) {
                                failure.compareAndSet(null, new RuntimeException(
                                        server.getName() + " HTTP " + response.getStatusInfo().getStatusCode()));
                            }
                        } finally {
                            response.close();
                            finish();
                        }
                    }

                    @Override
                    public void failed(Throwable throwable) {
                        failure.compareAndSet(null, throwable);
                        finish();
                    }

                    private void finish() {
                        if (pending.decrementAndGet() == 0) {
                            Throwable throwable = failure.get();
                            resultHandler.onResult(throwable == null, throwable);
                        }
                    }
                });
            } catch (RuntimeException e) {
                failure.compareAndSet(null, e);
                if (pending.decrementAndGet() == 0) {
                    Throwable throwable = failure.get();
                    resultHandler.onResult(false, throwable);
                }
            }
        }
    }

    private CentralPeruPositionRequest createRequest(PositionData positionData) {
        Position position = positionData.getPosition();
        Device device = positionData.getDevice();

        CentralPeruPositionRequest request = new CentralPeruPositionRequest();
        request.setImei(device.getUniqueId());
        request.setLatitud(position.getLatitude());
        request.setLongitud(position.getLongitude());
        request.setDate(position.getFixTime().getTime() / 1000);
        request.setCourse(position.getCourse());
        request.setAltitud(position.getAltitude());
        request.setSpeed(position.getSpeed());
        return request;
    }

}

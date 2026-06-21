package org.traccar.forward.centralperu;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.InvocationCallback;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.forward.PositionData;
import org.traccar.forward.PositionForwarder;
import org.traccar.forward.ResultHandler;
import org.traccar.model.Device;
import org.traccar.model.Position;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class CentralPeruPositionForwarder
        implements PositionForwarder {

    private final Client client;
    private final ObjectMapper objectMapper;

    private final String url;
    private final String username;
    private final String password;
    private final String apiKey;

    public CentralPeruPositionForwarder(
            Config config,
            Client client,
            ObjectMapper objectMapper) {

        this.client = client;
        this.objectMapper = objectMapper;

        this.url = config.getString(Keys.FORWARD_URL);

        this.username =
                config.getString(Keys.CENTRALPERU_USERNAME);

        this.password =
                config.getString(Keys.CENTRALPERU_PASSWORD);

        this.apiKey =
                config.getString(Keys.CENTRALPERU_API_KEY);
    }

    @Override
    public void forward(
            PositionData positionData,
            ResultHandler resultHandler) {

        try {

            Position position =
                    positionData.getPosition();

            Device device =
                    positionData.getDevice();

            CentralPeruPositionRequest request =
                    new CentralPeruPositionRequest();

            request.setImei(device.getUniqueId());
            request.setLatitud(position.getLatitude());
            request.setLongitud(position.getLongitude());

            request.setDate(
                    position.getFixTime().getTime() / 1000);

            request.setCourse(position.getCourse());
            request.setAltitud(position.getAltitude());
            request.setSpeed(position.getSpeed());

            String auth =
                    Base64.getEncoder().encodeToString(
                            (username + ":" + password)
                                    .getBytes(StandardCharsets.UTF_8));

            client.target(url)
                    .request(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.AUTHORIZATION,
                            "Basic " + auth)
                    .header("x-api-key", apiKey)
                    .async()
                    .post(
                            Entity.json(
                                    objectMapper.writeValueAsString(request)),
                            new InvocationCallback<Response>() {

                                @Override
                                public void completed(
                                        Response response) {

                                    if (response.getStatus() >= 200
                                            && response.getStatus() < 300) {

                                        resultHandler.onResult(
                                                true,
                                                null);

                                    } else {

                                        resultHandler.onResult(
                                                false,
                                                new RuntimeException(
                                                        "HTTP "
                                                                + response.getStatus()));
                                    }
                                }

                                @Override
                                public void failed(
                                        Throwable throwable) {

                                    resultHandler.onResult(
                                            false,
                                            throwable);
                                }
                            });

        } catch (Exception e) {

            resultHandler.onResult(
                    false,
                    e);
        }
    }
}
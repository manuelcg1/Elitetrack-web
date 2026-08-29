package org.traccar.forward.sutran;

import java.net.URI;

public enum SutranEnvironment {

    DEVELOPMENT("https://ws03.sutran.ehg.pe/api/v2.0/transmisiones"),
    PRODUCTION("https://ws03.sutran.gob.pe/api/v2.0/transmisiones");

    private final URI endpoint;

    SutranEnvironment(String endpoint) {
        this.endpoint = URI.create(endpoint);
    }

    public URI getEndpoint() {
        return endpoint;
    }

}

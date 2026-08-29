package org.traccar.api.resource;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;
import org.traccar.model.ForwardServer;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.forward.sutran.SutranTokenCipher;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class ForwardServerResourceTest {

    private final ForwardServerResource resource = resource(false);

    private ForwardServerResource resource(boolean transmissionEnabled) {
        Config config = new Config();
        config.setString(Keys.SUTRAN_ENCRYPTION_KEY, Base64.getEncoder().encodeToString(new byte[32]));
        config.setString(Keys.SUTRAN_TRANSMISSION_ENABLED, Boolean.toString(transmissionEnabled));
        ForwardServerResource resource = new ForwardServerResource();
        resource.config = config;
        resource.sutranTokenCipher = new SutranTokenCipher(config);
        return resource;
    }

    @Test
    public void testSutranTransmissionRequiresGlobalAuthorization() {
        ForwardServer server = new ForwardServer();
        server.setName(" SUTRAN ");
        server.setType(ForwardServer.TYPE_SUTRAN_V2);
        server.setEnvironment("production");
        server.setIpDominio("https://attacker.example/transmissions");
        server.setApiKey("123e4567-e89b-12d3-a456-426614174000");
        server.setTransmissionEnabled(true);

        assertThrows(BadRequestException.class, () -> resource.validateServer(server));

        server.setTransmissionEnabled(false);
        resource.validateServer(server);

        assertEquals("SUTRAN", server.getName());
        assertEquals("PRODUCTION", server.getEnvironment());
        assertEquals("https://ws03.sutran.gob.pe/api/v2.0/transmisiones", server.getIpDominio());
        assertNull(server.getUsername());
        assertNull(server.getPassword());
        assertFalse(server.getTransmissionEnabled());
        assertEquals(
                "123e4567-e89b-12d3-a456-426614174000",
                resource.sutranTokenCipher.decrypt(server.getApiKey()));
    }

    @Test
    public void testSutranTransmissionCanBeEnabledWithGlobalAuthorization() {
        ForwardServer server = new ForwardServer();
        server.setName("SUTRAN pilot");
        server.setType(ForwardServer.TYPE_SUTRAN_V2);
        server.setEnvironment("DEVELOPMENT");
        server.setApiKey("123e4567-e89b-12d3-a456-426614174000");
        server.setTransmissionEnabled(true);

        resource(true).validateServer(server);

        assertTrue(server.getTransmissionEnabled());
    }

    @Test
    public void testLegacyPayloadReceivesSafeDefaults() {
        ForwardServer server = new ForwardServer();
        server.setName("Central");
        server.setType(null);
        server.setIpDominio("https://central.example/positions");
        server.setUsername("user");
        server.setPassword("password");
        server.setApiKey("key");
        server.setConnectTimeout(0);
        server.setReadTimeout(0);
        server.setMaxAttempts(0);
        server.setRetryDelay(0);

        resource.validateServer(server);

        assertEquals(ForwardServer.TYPE_GENERIC_JSON, server.getType());
        assertEquals(5000, server.getConnectTimeout());
        assertEquals(10000, server.getReadTimeout());
        assertEquals(5, server.getMaxAttempts());
        assertEquals(1000, server.getRetryDelay());
    }

    @Test
    public void testInvalidSutranTokenIsRejected() {
        ForwardServer server = new ForwardServer();
        server.setName("SUTRAN");
        server.setType(ForwardServer.TYPE_SUTRAN_V2);
        server.setEnvironment("DEVELOPMENT");
        server.setApiKey("secret");

        assertThrows(BadRequestException.class, () -> resource.validateServer(server));
    }

}

package org.traccar.api;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ResourceErrorHandlerTest {
    private final ResourceErrorHandler handler = new ResourceErrorHandler();

    @Test
    void hidesInternalDetailsAndKeepsLegacyStatus() {
        var response = handler.toResponse(new RuntimeException("password=secret; SELECT * FROM tc_users"));
        assertEquals(400, response.getStatus());
        assertEquals("Request failed", response.getEntity());
        assertEquals("no-store", response.getHeaderString("Cache-Control"));
    }

    @Test
    void preservesHttpStatusAndRetryHeaderButReplacesPrivateEntity() {
        var response = handler.toResponse(new WebApplicationException("private path", Response.status(429)
                .header("Retry-After", "30").entity("secret details").build()));
        assertEquals(429, response.getStatus());
        assertEquals("30", response.getHeaderString("Retry-After"));
        assertFalse(response.getEntity().toString().contains("secret"));
        assertFalse(response.getEntity().toString().contains("private"));
    }

    @Test
    void discardsCustomReasonAndStaleEntityHeaders() {
        var response = handler.toResponse(new WebApplicationException(Response.status(499, "private details")
                .header("Content-Encoding", "gzip").header("Content-Length", "999").build()));
        assertEquals(499, response.getStatus());
        assertEquals("Request failed", response.getEntity());
        assertNull(response.getHeaderString("Content-Encoding"));
        assertNull(response.getHeaderString("Content-Length"));
    }

    @Test
    void securityMessagesAreControlledAndNotArbitraryExceptionText() {
        assertEquals("Write access denied", handler.toResponse(new SecurityException("Write access denied")).getEntity());
        assertEquals("User access denied", handler.toResponse(new SecurityException("private user details")).getEntity());
    }
}

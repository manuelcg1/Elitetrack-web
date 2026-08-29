package org.traccar.forward.sutran;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class SutranClientTest {

    private static final String ACCESS_TOKEN = "123e4567-e89b-12d3-a456-426614174000";

    private final List<Client> clients = new ArrayList<>();
    private final List<ScheduledExecutorService> schedulers = new ArrayList<>();
    private final List<ExecutorService> serverExecutors = new ArrayList<>();
    private final List<HttpServer> servers = new ArrayList<>();

    @AfterEach
    public void tearDown() {
        clients.forEach(Client::close);
        schedulers.forEach(ScheduledExecutorService::shutdownNow);
        servers.forEach(server -> server.stop(0));
        serverExecutors.forEach(ExecutorService::shutdownNow);
    }

    @Test
    public void testSuccessfulRequestContract() throws Exception {
        AtomicReference<String> token = new AtomicReference<>();
        AtomicReference<String> contentType = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        HttpServer server = server(exchange -> {
            token.set(exchange.getRequestHeaders().getFirst(SutranClient.ACCESS_TOKEN_HEADER));
            contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            respond(exchange, 200, "{\"crc\":\"aB12z9\",\"code\":2000,\"result\":\"OK\"}");
        });

        SutranDeliveryResult result = send(client(server, 3, 1, 1000), request());

        assertEquals(SutranDeliveryResult.Status.DELIVERED, result.status());
        assertEquals("aB12z9", result.crc());
        assertEquals(ACCESS_TOKEN, token.get());
        assertTrue(contentType.get().startsWith("application/json"));
        assertEquals(
                "{\"plate\":\"ABC123\",\"geo\":[-11.4,-76.9],\"direction\":38,\"event\":\"ER\","
                        + "\"speed\":50,\"time_device\":\"2026-08-28 11:45:30\",\"imei\":123456789012345}",
                body.get());
        assertFalse(body.get().contains(ACCESS_TOKEN));
    }

    @Test
    public void testTransientFailureRetriesOnlySutran() throws Exception {
        AtomicInteger requests = new AtomicInteger();
        HttpServer server = server(exchange -> {
            if (requests.incrementAndGet() == 1) {
                respond(exchange, 503, "Service unavailable");
            } else {
                respond(exchange, 200, "{\"crc\":\"ABC123\",\"code\":2000,\"result\":\"OK\"}");
            }
        });

        SutranDeliveryResult result = send(client(server, 3, 1, 1000), request());

        assertEquals(SutranDeliveryResult.Status.DELIVERED, result.status());
        assertEquals(2, requests.get());
    }

    @Test
    public void testContractRejectionIsNotRetried() throws Exception {
        AtomicInteger requests = new AtomicInteger();
        HttpServer server = server(exchange -> {
            requests.incrementAndGet();
            respond(exchange, 200, "{\"code\":4002,\"result\":\"Invalid data\"}");
        });

        SutranDeliveryResult result = send(client(server, 3, 1, 1000), request());

        assertEquals(SutranDeliveryResult.Status.REJECTED, result.status());
        assertEquals(4002, result.responseCode());
        assertEquals(1, requests.get());
    }

    @Test
    public void testTimeoutStopsAtMaximumAttempts() throws Exception {
        AtomicInteger requests = new AtomicInteger();
        HttpServer server = server(exchange -> {
            requests.incrementAndGet();
            try {
                Thread.sleep(250);
                respond(exchange, 200, "{\"crc\":\"ABC123\",\"code\":2000,\"result\":\"OK\"}");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        SutranDeliveryResult result = send(client(server, 2, 1, 50), request());

        assertEquals(SutranDeliveryResult.Status.RETRY, result.status());
        assertEquals(2, requests.get());
        assertTrue(result.message().startsWith("SUTRAN transport failure"));
        assertFalse(result.message().contains(ACCESS_TOKEN));
    }

    @Test
    public void testConfigurationValidation() {
        Client client = ClientBuilder.newClient();
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        clients.add(client);
        schedulers.add(scheduler);

        assertThrows(IllegalArgumentException.class, () -> new SutranClient(
                client, new ObjectMapper(), scheduler, SutranEnvironment.DEVELOPMENT, "secret", 1000, 1000,
                3, 100, 1000));
        assertEquals(
                "https://ws03.sutran.ehg.pe/api/v2.0/transmisiones",
                SutranEnvironment.DEVELOPMENT.getEndpoint().toString());
        assertEquals(
                "https://ws03.sutran.gob.pe/api/v2.0/transmisiones",
                SutranEnvironment.PRODUCTION.getEndpoint().toString());
    }

    private SutranClient client(HttpServer server, int maximumAttempts, long retryDelay, int readTimeout) {
        Client client = ClientBuilder.newClient();
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        clients.add(client);
        schedulers.add(scheduler);
        return new SutranClient(
                client, new ObjectMapper(), scheduler, new SutranPayloadMapper(),
                java.net.URI.create("http://localhost:" + server.getAddress().getPort() + "/transmisiones"),
                ACCESS_TOKEN, 1000, readTimeout, maximumAttempts, retryDelay, 1000);
    }

    private SutranDeliveryResult send(SutranClient client, SutranTransmissionRequest request) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<SutranDeliveryResult> result = new AtomicReference<>();
        client.send(request, value -> {
            result.set(value);
            latch.countDown();
        });
        assertTrue(latch.await(5, TimeUnit.SECONDS));
        return result.get();
    }

    private HttpServer server(com.sun.net.httpserver.HttpHandler handler) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        ExecutorService executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.createContext("/transmisiones", handler);
        server.start();
        serverExecutors.add(executor);
        servers.add(server);
        return server;
    }

    private static void respond(HttpExchange exchange, int status, String response) throws IOException {
        byte[] data = response.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, data.length);
        exchange.getResponseBody().write(data);
        exchange.close();
    }

    private static SutranTransmissionRequest request() {
        SutranTransmissionRequest request = new SutranTransmissionRequest();
        request.setPlate("ABC123");
        request.setGeo(new double[] {-11.4, -76.9});
        request.setDirection(38);
        request.setEvent("ER");
        request.setSpeed(50);
        request.setTimeDevice("2026-08-28 11:45:30");
        request.setImei(123456789012345L);
        return request;
    }

}

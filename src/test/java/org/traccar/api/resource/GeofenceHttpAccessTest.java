package org.traccar.api.resource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.inject.Injector;
import org.eclipse.jetty.ee10.servlet.ServletContextHandler;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.glassfish.hk2.utilities.binding.AbstractBinder;
import org.glassfish.jersey.jackson.JacksonFeature;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.servlet.ServletContainer;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.traccar.api.ResourceErrorHandler;
import org.traccar.api.StreamWriter;
import org.traccar.api.security.GeofenceReadAccessService;
import org.traccar.api.security.LoginService;
import org.traccar.api.security.PermissionsService;
import org.traccar.api.security.SecurityRequestFilter;
import org.traccar.api.signature.TokenManager;
import org.traccar.config.Config;
import org.traccar.database.StatisticsManager;
import org.traccar.helper.LogAction;
import org.traccar.model.User;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.DatabaseStorage;
import org.traccar.storage.Storage;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real loopback HTTP, production authentication/filter/resources, disposable SQL and synthetic accounts. */
public class GeofenceHttpAccessTest {

    static class Fixture implements AutoCloseable {
        final Connection database;
        final Server server = new Server();
        final ObjectMapper mapper = new ObjectMapper();
        final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        final String baseUrl;

        Fixture() throws Exception {
            var source = new JdbcDataSource();
            source.setURL("jdbc:h2:mem:" + UUID.randomUUID());
            database = source.getConnection();
            sql("CREATE TABLE tc_users (id BIGINT PRIMARY KEY, email VARCHAR, login VARCHAR,"
                    + " hashedpassword VARCHAR, salt VARCHAR, administrator BOOLEAN DEFAULT FALSE,"
                    + " disabled BOOLEAN DEFAULT FALSE, expirationtime TIMESTAMP, readonly BOOLEAN DEFAULT FALSE,"
                    + " roleid BIGINT DEFAULT 1)");
            sql("CREATE TABLE tc_role_menus (id BIGINT, roleid BIGINT, menukey VARCHAR)");
            sql("CREATE TABLE tc_servers (id BIGINT, readonly BOOLEAN DEFAULT FALSE)");
            sql("INSERT INTO tc_servers (id) VALUES (1)");
            sql("INSERT INTO tc_role_menus VALUES (1,1,'geofences')");
            sql("CREATE TABLE tc_geofence_folders (id BIGINT PRIMARY KEY, name VARCHAR, parentid BIGINT)");
            sql("CREATE TABLE tc_geofences (id BIGINT PRIMARY KEY, name VARCHAR, area VARCHAR, attributes VARCHAR)");
            sql("CREATE TABLE tc_user_geofencefolder (userid BIGINT, geofencefolderid BIGINT)");
            sql("CREATE TABLE tc_user_geofence (userid BIGINT NOT NULL, geofenceid BIGINT NOT NULL)");
            sql("INSERT INTO tc_geofence_folders VALUES (10,'Parent',0),(11,'Child',10),(20,'Other',0)");
            sql("INSERT INTO tc_geofences VALUES (100,'Visible','CIRCLE (0 0, 100)','{\"folderId\":11}'),"
                    + "(200,'Secret','CIRCLE (1 1, 100)','{\"folderId\":20}')");
            sql("INSERT INTO tc_user_geofencefolder VALUES (1,10)");
            sql("INSERT INTO tc_user_geofence VALUES (2,200)");
            var password = new User();
            password.setPassword("test-password");
            try (var insert = database.prepareStatement(
                    "INSERT INTO tc_users (id,email,hashedpassword,salt) VALUES (?,?,?,?)")) {
                for (int id = 1; id <= 4; id++) {
                    insert.setLong(1, id);
                    insert.setString(2, "user" + id + "@example.test");
                    insert.setString(3, password.getHashedPassword());
                    insert.setString(4, password.getSalt());
                    insert.executeUpdate();
                }
            }
            sql("UPDATE tc_users SET roleid = 0 WHERE id = 3");
            sql("UPDATE tc_users SET administrator = TRUE WHERE id = 4");
            sql("ALTER TABLE tc_user_geofence ADD PRIMARY KEY (userid,geofenceid)");
            sql("ALTER TABLE tc_user_geofence ADD FOREIGN KEY (userid) REFERENCES tc_users(id)");
            sql("ALTER TABLE tc_user_geofence ADD FOREIGN KEY (geofenceid) REFERENCES tc_geofences(id)");
            Storage storage = new DatabaseStorage(new Config(), source, mapper);
            var injector = mock(Injector.class);
            when(injector.getInstance(PermissionsService.class)).thenAnswer(i -> new PermissionsService(storage));
            var resources = new ResourceConfig(GeofenceResource.class, GeofenceFolderResource.class,
                    PermissionsResource.class, SecurityRequestFilter.class,
                    ResourceErrorHandler.class, JacksonFeature.class, StreamWriter.class);
            resources.property("jersey.config.server.wadl.disableWadl", true);
            resources.register(new AbstractBinder() {
                @Override
                protected void configure() {
                    bind(storage).to(Storage.class);
                    bind(mapper).to(ObjectMapper.class);
                    bind(injector).to(Injector.class);
                    bind(mock(StatisticsManager.class)).to(StatisticsManager.class);
                    bind(mock(CacheManager.class)).to(CacheManager.class);
                    bind(mock(LogAction.class)).to(LogAction.class);
                    bind(new LoginService(new Config(), storage, mock(TokenManager.class), null)).to(LoginService.class);
                    bind(new GeofenceReadAccessService(storage)).to(GeofenceReadAccessService.class);
                    bindFactory(new org.glassfish.hk2.api.Factory<PermissionsService>() {
                        @Override
                        public PermissionsService provide() {
                            return new PermissionsService(storage);
                        }

                        @Override
                        public void dispose(PermissionsService instance) {
                        }
                    }).to(PermissionsService.class);
                }
            });
            var context = new ServletContextHandler(ServletContextHandler.SESSIONS);
            context.setContextPath("/");
            context.addServlet(new ServletHolder(new ServletContainer(resources)), "/api/*");
            server.setHandler(context);
            var connector = new ServerConnector(server);
            connector.setHost("127.0.0.1");
            connector.setPort(0);
            server.addConnector(connector);
            try {
                server.start();
            } catch (Exception e) {
                server.stop();
                database.close();
                throw e;
            }
            baseUrl = "http://127.0.0.1:" + connector.getLocalPort() + "/api/geofences";
        }

        void sql(String sql) throws Exception {
            try (var statement = database.createStatement()) {
                statement.execute(sql);
            }
        }

        HttpResponse<String> request(String method, String path, String authorization) throws Exception {
            return request(method, path, authorization, "");
        }

        HttpResponse<String> request(String method, String path, String authorization, String body) throws Exception {
            String url = path.startsWith("/permissions") ? baseUrl.replace("/geofences", "") + path : baseUrl + path;
            var request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10))
                    .header("Accept", "application/json").header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(body));
            if (authorization != null) {
                request.header("Authorization", authorization);
            }
            return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
        }

        String auth(int id) {
            return "Basic " + Base64.getEncoder().encodeToString(
                    ("user" + id + "@example.test:test-password").getBytes(StandardCharsets.US_ASCII));
        }

        @Override
        public void close() throws Exception {
            try {
                server.stop();
            } finally {
                database.close();
            }
        }
    }

    @Test
    public void authenticatesAndSeparatesUsersAndMenuPermissions() throws Exception {
        try (var f = new Fixture()) {
            assertEquals(401, f.request("GET", "/read-access", null).statusCode());
            assertEquals(401, f.request("GET", "/read-access", "Basic d3Jvbmc6d3Jvbmc=").statusCode());
            var denied = f.request("GET", "/read-access", f.auth(3));
            assertEquals(403, denied.statusCode());
            assertEquals("Forbidden", denied.body());
            assertEquals("no-store", denied.headers().firstValue("Cache-Control").orElseThrow());
            var first = f.request("GET", "/read-access?userId=2", f.auth(1));
            assertEquals(200, first.statusCode(), first.body());
            assertEquals("no-store", first.headers().firstValue("Cache-Control").orElseThrow());
            var data = f.mapper.readTree(first.body());
            assertEquals(1, data.get("geofences").size());
            assertEquals(100, data.at("/geofences/0/geofence/id").asLong());
            assertTrue(data.at("/geofences/0/inherited").asBoolean());
            var second = f.request("GET", "/read-access", f.auth(2));
            assertEquals(200, second.statusCode(), second.body());
            assertEquals(200, f.mapper.readTree(second.body()).at("/geofences/0/geofence/id").asLong());
        }
    }

    @Test
    public void inheritedReadDoesNotChangeDirectListsOrAuthorizeDeletion() throws Exception {
        try (var f = new Fixture()) {
            var detail = f.request("GET", "/read-access/100", f.auth(1));
            assertEquals(200, detail.statusCode(), detail.body());
            assertEquals(404, f.request("GET", "/read-access/200", f.auth(1)).statusCode());
            var direct = f.request("GET", "?userId=1", f.auth(1));
            assertEquals(200, direct.statusCode(), direct.body());
            assertTrue(f.mapper.readTree(direct.body()).isEmpty());
            // Existing ResourceErrorHandler maps SecurityException to 400.
            assertEquals(400, f.request("DELETE", "/100", f.auth(1)).statusCode());
            assertEquals(200, f.request("GET", "/read-access/100", f.auth(1)).statusCode());
        }
    }

    @Test
    public void readonlyUserCanReadButCannotUpdateOrDeleteDirectGeofence() throws Exception {
        try (var f = new Fixture()) {
            f.sql("UPDATE tc_users SET readonly = TRUE WHERE id = 2");
            assertEquals(200, f.request("GET", "/read-access/200", f.auth(2)).statusCode());
            var update = f.request("PUT", "/200", f.auth(2),
                    "{\"id\":200,\"name\":\"Changed\",\"area\":\"CIRCLE (1 1, 100)\"}");
            assertEquals(400, update.statusCode());
            assertTrue(update.body().contains("Write access denied"), update.body());
            var delete = f.request("DELETE", "/200", f.auth(2));
            assertEquals(400, delete.statusCode());
            assertTrue(delete.body().contains("Write access denied"), delete.body());
            var original = f.request("GET", "/read-access/200", f.auth(2));
            assertEquals("Secret", f.mapper.readTree(original.body()).get("name").asText());
        }
    }

    @Test
    public void batchHttpRollsBackAllChangesOnForeignKeyFailureThenCommitsValidBatch() throws Exception {
        try (var f = new Fixture()) {
            var failed = f.request("POST", "/permissions/batch", f.auth(4),
                    "{\"additions\":[{\"userId\":1,\"geofenceId\":100},{\"userId\":1,\"geofenceId\":999}],"
                            + "\"removals\":[{\"userId\":2,\"geofenceId\":200}]}");
            assertEquals(400, failed.statusCode(), failed.body());
            assertEquals(200, f.request("GET", "/read-access/200", f.auth(2)).statusCode());
            assertTrue(f.mapper.readTree(f.request("GET", "?userId=1", f.auth(1)).body()).isEmpty());
            var saved = f.request("POST", "/permissions/batch", f.auth(4),
                    "{\"additions\":[{\"userId\":1,\"geofenceId\":100}],"
                            + "\"removals\":[{\"userId\":2,\"geofenceId\":200}]}");
            assertEquals(204, saved.statusCode(), saved.body());
            assertEquals(404, f.request("GET", "/read-access/200", f.auth(2)).statusCode());
            assertEquals(1, f.mapper.readTree(f.request("GET", "?userId=1", f.auth(1)).body()).size());
        }
    }

    @Test
    public void legacyBulkIsAtomicAndInheritedReadCannotDelegate() throws Exception {
        try (var f = new Fixture()) {
            var failed = f.request("POST", "/permissions/bulk", f.auth(4),
                    "[{\"userId\":1,\"geofenceId\":100},{\"userId\":1,\"geofenceId\":999}]");
            assertEquals(400, failed.statusCode(), failed.body());
            assertTrue(f.mapper.readTree(f.request("GET", "?userId=1", f.auth(1)).body()).isEmpty());
            var denied = f.request("POST", "/permissions/batch", f.auth(1),
                    "{\"additions\":[{\"userId\":1,\"geofenceId\":100}],\"removals\":[]}");
            assertEquals(400, denied.statusCode(), denied.body());
            assertTrue(denied.body().contains("access denied"), denied.body());
            assertTrue(f.mapper.readTree(f.request("GET", "?userId=1", f.auth(1)).body()).isEmpty());
        }
    }

    @Test
    public void revocationAndDisabledUsersTakeEffectOnFollowingHttpRequest() throws Exception {
        try (var f = new Fixture()) {
            assertEquals(200, f.request("GET", "/read-access/100", f.auth(1)).statusCode());
            f.sql("DELETE FROM tc_user_geofencefolder WHERE userid = 1");
            assertEquals(404, f.request("GET", "/read-access/100", f.auth(1)).statusCode());
            f.sql("UPDATE tc_users SET disabled = TRUE WHERE id = 2");
            assertEquals(401, f.request("GET", "/read-access", f.auth(2)).statusCode());
            f.sql("UPDATE tc_users SET disabled = FALSE, expirationtime = '2000-01-01 00:00:00' WHERE id = 2");
            assertEquals(401, f.request("GET", "/read-access", f.auth(2)).statusCode());
        }
    }
}

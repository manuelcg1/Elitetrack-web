package org.traccar.notificators;

import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.helper.ObjectMapperContextResolver;
import org.traccar.model.User;
import org.traccar.notification.MessageException;
import org.traccar.notification.NotificationFormatter;
import org.traccar.notification.NotificationMessage;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class NotificatorTelegramTest {

    private NotificatorTelegram createNotificator(Response response, RuntimeException failure) {
        Config config = mock(Config.class);
        when(config.getString(Keys.NOTIFICATOR_TELEGRAM_KEY)).thenReturn("secret");
        Client client = mock(Client.class);
        WebTarget target = mock(WebTarget.class);
        Invocation.Builder builder = mock(Invocation.Builder.class);
        when(client.target(anyString())).thenReturn(target);
        when(target.property(anyString(), any())).thenReturn(target);
        when(target.request()).thenReturn(builder);
        if (failure != null) {
            when(builder.post(any(Entity.class))).thenThrow(failure);
        } else {
            when(builder.post(any(Entity.class))).thenReturn(response);
        }
        return new NotificatorTelegram(
                config, mock(NotificationFormatter.class), client, mock(ObjectMapperContextResolver.class));
    }

    private User createUser() {
        User user = new User();
        user.set("telegramChatId", "123456789");
        return user;
    }

    @Test
    public void testSuccessfulResponse() throws Exception {
        Response response = mock(Response.class);
        when(response.getStatus()).thenReturn(200);
        createNotificator(response, null).send(
                createUser(), new NotificationMessage("title", "body", "body", false), null, null);
    }

    @Test
    public void testBadRequestAndForbiddenResponses() {
        for (int status : new int[] {400, 403}) {
            Response response = mock(Response.class);
            when(response.getStatus()).thenReturn(status);
            NotificatorTelegram notificator = createNotificator(response, null);
            assertThrows(MessageException.class, () -> notificator.send(
                    createUser(), new NotificationMessage("title", "body", "body", false), null, null));
        }
    }

    @Test
    public void testRateLimitResponse() {
        Response response = mock(Response.class);
        when(response.getStatus()).thenReturn(429);
        NotificatorTelegram notificator = createNotificator(response, null);
        assertThrows(MessageException.class, () -> notificator.send(
                createUser(), new NotificationMessage("title", "body", "body", false), null, null));
    }

    @Test
    public void testTimeout() {
        NotificatorTelegram notificator = createNotificator(
                null, new ProcessingException("timeout"));
        assertThrows(MessageException.class, () -> notificator.send(
                createUser(), new NotificationMessage("title", "body", "body", false), null, null));
    }
}

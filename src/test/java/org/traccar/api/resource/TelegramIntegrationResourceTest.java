package org.traccar.api.resource;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.ServiceUnavailableException;
import org.junit.jupiter.api.Test;
import org.traccar.api.security.PermissionsService;
import org.traccar.helper.LogAction;
import org.traccar.model.User;
import org.traccar.notification.NotificatorManager;
import org.traccar.storage.Storage;
import org.traccar.storage.query.Request;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class TelegramIntegrationResourceTest {

    private static class TestResource extends TelegramIntegrationResource {
        TestResource(Storage storage, PermissionsService permissionsService) {
            this.storage = storage;
            this.permissionsService = permissionsService;
            config = mock(org.traccar.config.Config.class);
            notificatorManager = mock(NotificatorManager.class);
            actionLogger = mock(LogAction.class);
        }

        @Override
        protected long getUserId() {
            return 1;
        }
    }

    private User createUser() {
        User user = new User();
        user.setId(7);
        user.setName("Usuario");
        user.setEmail("usuario@example.com");
        user.set("preference", "preserved");
        return user;
    }

    @Test
    public void testValidChatId() {
        assertEquals("6401213138", TelegramIntegrationResource.validateChatId(" 6401213138 "));
    }

    @Test
    public void testInvalidChatIds() {
        assertThrows(BadRequestException.class, () -> TelegramIntegrationResource.validateChatId("1234"));
        assertThrows(BadRequestException.class, () -> TelegramIntegrationResource.validateChatId("12345abc"));
        assertThrows(BadRequestException.class, () -> TelegramIntegrationResource.validateChatId("123456789012345678901"));
    }

    @Test
    public void testGroupChatIdRejected() {
        BadRequestException exception = assertThrows(BadRequestException.class,
                () -> TelegramIntegrationResource.validateChatId("-1001234567890"));
        assertEquals("Los grupos de Telegram aún no son compatibles.", exception.getMessage());
    }

    @Test
    public void testChatIdMasking() {
        assertEquals("••••••3138", TelegramIntegrationResource.maskChatId("6401213138"));
        assertNull(TelegramIntegrationResource.maskChatId(null));
    }

    @Test
    public void testListUsersAndAdministratorCheck() throws Exception {
        Storage storage = mock(Storage.class);
        PermissionsService permissions = mock(PermissionsService.class);
        when(storage.getObjects(any(), any(Request.class))).thenReturn(List.of(createUser()));
        TestResource resource = new TestResource(storage, permissions);
        assertEquals(1, resource.getUsers().size());
        verify(permissions).checkAdmin(1);
    }

    @Test
    public void testUserWithoutPermission() throws Exception {
        PermissionsService permissions = mock(PermissionsService.class);
        doThrow(new SecurityException()).when(permissions).checkAdmin(1);
        TestResource resource = new TestResource(mock(Storage.class), permissions);
        assertThrows(SecurityException.class, resource::getUsers);
    }

    @Test
    public void testLinkPreservesAttributesAndUnlink() throws Exception {
        Storage storage = mock(Storage.class);
        User user = createUser();
        when(storage.getObject(any(), any(Request.class))).thenReturn(user);
        TestResource resource = new TestResource(storage, mock(PermissionsService.class));

        var result = resource.link(7, new TelegramIntegrationResource.LinkRequest("6401213138"));
        assertTrue(result.linked());
        assertEquals("preserved", user.getString("preference"));
        verify(storage).updateObject(any(User.class), any(Request.class));

        resource.unlink(7);
        assertNull(user.getString("telegramChatId"));
        assertEquals("preserved", user.getString("preference"));
    }

    @Test
    public void testMissingUser() throws Exception {
        Storage storage = mock(Storage.class);
        when(storage.getObject(any(), any(Request.class))).thenReturn(null);
        TestResource resource = new TestResource(storage, mock(PermissionsService.class));
        assertThrows(NotFoundException.class,
                () -> resource.link(99, new TelegramIntegrationResource.LinkRequest("6401213138")));
    }

    @Test
    public void testUserWithoutTelegramAndDisabledTelegram() throws Exception {
        Storage storage = mock(Storage.class);
        User user = createUser();
        when(storage.getObject(any(), any(Request.class))).thenReturn(user);
        TestResource resource = new TestResource(storage, mock(PermissionsService.class));
        assertThrows(BadRequestException.class, () -> resource.test(7));

        user.set("telegramChatId", "6401213138");
        when(resource.notificatorManager.getNotificator("telegram")).thenThrow(new RuntimeException());
        assertThrows(ServiceUnavailableException.class, () -> resource.test(7));
    }

}

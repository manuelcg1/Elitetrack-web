package org.traccar.api.resource;

import org.junit.jupiter.api.Test;
import org.traccar.api.security.PermissionsService;
import org.traccar.helper.LogAction;
import org.traccar.model.Geofence;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;

import java.util.LinkedHashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class PermissionBatchResourceTest {

    private static class Resource extends PermissionsResource {
        final CacheManager cache = mock(CacheManager.class);
        final LogAction audit = mock(LogAction.class);
        final Storage database = mock(Storage.class);
        final PermissionsService permissions = mock(PermissionsService.class);

        Resource() throws Exception {
            storage = database;
            permissionsService = permissions;
            var cacheField = PermissionsResource.class.getDeclaredField("cacheManager");
            cacheField.setAccessible(true);
            cacheField.set(this, cache);
            var auditField = PermissionsResource.class.getDeclaredField("actionLogger");
            auditField.setAccessible(true);
            auditField.set(this, audit);
        }

        @Override
        protected long getUserId() {
            return 1;
        }
    }

    private LinkedHashMap<String, Long> relation(long id) {
        var relation = new LinkedHashMap<String, Long>();
        relation.put("userId", 1L);
        relation.put("geofenceId", id);
        return relation;
    }

    @Test
    public void laterAuthorizationFailurePreventsEveryWrite() throws Exception {
        var resource = new Resource();
        when(resource.permissions.notAdmin(1)).thenReturn(true);
        doThrow(new SecurityException("Denied")).when(resource.permissions)
                .checkPermission(Geofence.class, 1, 200);
        assertThrows(SecurityException.class, () -> resource.updateBatch(
                new PermissionsResource.PermissionBatch(List.of(relation(100), relation(200)), List.of())));
        verifyNoInteractions(resource.database, resource.cache, resource.audit);
    }

    @Test
    public void failedTransactionDoesNotNotifyCachesOrAudit() throws Exception {
        var resource = new Resource();
        doThrow(new StorageException("Rollback")).when(resource.database).updatePermissions(anyList(), anyList());
        assertThrows(StorageException.class, () -> resource.updateBatch(
                new PermissionsResource.PermissionBatch(List.of(relation(100)), List.of(relation(200)))));
        verifyNoInteractions(resource.cache, resource.audit);
    }

    @Test
    public void cacheAndAuditRunOnlyAfterTransactionReturns() throws Exception {
        var resource = new Resource();
        try (var response = resource.updateBatch(
                new PermissionsResource.PermissionBatch(List.of(relation(100)), List.of(relation(200))))) {
            assertEquals(204, response.getStatus());
        }
        var order = inOrder(resource.database, resource.cache, resource.audit);
        order.verify(resource.database).updatePermissions(anyList(), anyList());
        order.verify(resource.cache).invalidatePermissions(anyList(), anyList());
        order.verify(resource.audit).unlink(any(), eq(1L), any(), eq(1L), any(), eq(200L));
        order.verify(resource.audit).link(any(), eq(1L), any(), eq(1L), any(), eq(100L));
    }

    @Test
    public void malformedAndConflictingBatchesDoNotWrite() throws Exception {
        var resource = new Resource();
        assertThrows(jakarta.ws.rs.BadRequestException.class, () -> resource.updateBatch(
                new PermissionsResource.PermissionBatch(List.of(relation(100)), List.of(relation(100)))));
        var unknown = new LinkedHashMap<String, Long>();
        unknown.put("userId", 1L);
        unknown.put("unknownId", 5L);
        assertThrows(jakarta.ws.rs.BadRequestException.class, () -> resource.updateBatch(
                new PermissionsResource.PermissionBatch(List.of(unknown), List.of())));
        assertThrows(jakarta.ws.rs.BadRequestException.class, () -> resource.updateBatch(null));
        verifyNoInteractions(resource.database, resource.cache, resource.audit);
    }

    @Test
    public void postCommitFailureIsReportedWithoutPretendingTheWriteRolledBack() throws Exception {
        var resource = new Resource();
        doThrow(new StorageException("Cache unavailable")).when(resource.cache)
                .invalidatePermissions(anyList(), anyList());
        try (var response = resource.updateBatch(
                new PermissionsResource.PermissionBatch(List.of(relation(100)), List.of()))) {
            assertEquals(204, response.getStatus());
            assertEquals("pending", response.getHeaderString("X-Permission-Refresh"));
        }
        verify(resource.database).updatePermissions(anyList(), anyList());
        verify(resource.audit).link(any(), eq(1L), any(), eq(1L), any(), eq(100L));
    }
}

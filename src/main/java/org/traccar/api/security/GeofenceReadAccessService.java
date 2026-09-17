package org.traccar.api.security;

import jakarta.inject.Inject;
import org.traccar.helper.model.GeofenceFolderHierarchy;
import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;
import org.traccar.model.Permission;
import org.traccar.model.User;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.traccar.helper.model.GeofenceFolderHierarchy.folderId;

/** Resolves consultation rights only. Never use this service to authorize writes or delegation. */
public class GeofenceReadAccessService {

    public record FolderEntry(
            long id, String name, long parentid, boolean direct, boolean inherited, boolean contextOnly) {
    }

    public record GeofenceEntry(Geofence geofence, long folderId, boolean direct, boolean inherited) {
    }

    public record ReadAccess(boolean administrator, List<FolderEntry> folders, List<GeofenceEntry> geofences) {
        public ReadAccess {
            folders = List.copyOf(folders);
            geofences = List.copyOf(geofences);
        }
    }

    private final Storage storage;

    @Inject
    public GeofenceReadAccessService(Storage storage) {
        this.storage = storage;
    }

    public ReadAccess getReadAccess(long userId) throws StorageException {
        return resolve(userId, new Columns.All());
    }

    /** Session filtering needs identifiers, not stored geometries. */
    public Set<Long> getReadableGeofenceIds(long userId) throws StorageException {
        return resolve(userId, new Columns.Include("id", "attributes")).geofences().stream()
                .map(entry -> entry.geofence().getId()).collect(Collectors.toUnmodifiableSet());
    }

    /** A single-event check avoids scanning every geofence. Storage failures remain errors. */
    public boolean canReadGeofence(long userId, long geofenceId) throws StorageException {
        User user = activeUser(userId);
        if (geofenceId <= 0) {
            return false;
        }
        Geofence geofence = storage.getObject(Geofence.class, new Request(
                new Columns.Include("id", "attributes"), new Condition.Equals("id", geofenceId)));
        if (geofence == null) {
            return false;
        }
        if (user.getAdministrator()
                || !storage.getPermissions(User.class, userId, Geofence.class, geofenceId).isEmpty()) {
            return true;
        }
        Set<Long> assigned = storage.getPermissions(User.class, userId, GeofenceFolder.class, 0).stream()
                .map(Permission::getPropertyId).collect(Collectors.toSet());
        if (assigned.isEmpty()) {
            return false;
        }
        var hierarchy = new GeofenceFolderHierarchy(storage.getObjects(GeofenceFolder.class,
                new Request(new Columns.Include("id", "parentid"))));
        return hierarchy.descendants(assigned).contains(folderId(geofence));
    }

    private User activeUser(long userId) throws StorageException {
        if (userId <= 0) {
            throw new SecurityException("User access required");
        }
        User user = storage.getObject(User.class, new Request(
                new Columns.All(), new Condition.Equals("id", userId)));
        if (user == null) {
            throw new SecurityException("User access required");
        }
        user.checkDisabled();
        return user;
    }

    private ReadAccess resolve(long userId, Columns columns) throws StorageException {
        User user = activeUser(userId);
        Set<Long> directFolders = storage.getPermissions(User.class, userId, GeofenceFolder.class, 0).stream()
                .map(Permission::getPropertyId).collect(Collectors.toSet());
        Set<Long> directGeofences = storage.getPermissions(User.class, userId, Geofence.class, 0).stream()
                .map(Permission::getPropertyId).collect(Collectors.toSet());
        boolean administrator = user.getAdministrator();
        if (!administrator && directFolders.isEmpty() && directGeofences.isEmpty()) {
            return new ReadAccess(false, List.of(), List.of());
        }

        // Only structural metadata is needed; folder descriptions and attributes are never returned.
        List<GeofenceFolder> folders = storage.getObjects(GeofenceFolder.class,
                new Request(new Columns.Include("id", "name", "parentid")));
        var hierarchy = new GeofenceFolderHierarchy(folders);
        Set<Long> readableFolders = hierarchy.descendants(directFolders);
        Set<Long> visibleFolders = new HashSet<>(readableFolders);
        // Preserve explicit folder access even when its legacy parent is invalid, but grant no descendants.
        visibleFolders.addAll(directFolders);
        if (administrator) {
            folders.forEach(folder -> visibleFolders.add(folder.getId()));
        }

        List<GeofenceEntry> entries = new ArrayList<>();
        Condition geofenceCondition = !administrator && directFolders.isEmpty()
                ? new Condition.Permission(User.class, userId, Geofence.class).excludeGroups() : null;
        // Stream rather than retain unassigned geometries. No shared cache: the next request sees grant changes.
        try (var geofences = storage.getObjectsStream(Geofence.class, new Request(columns, geofenceCondition))) {
            geofences.forEach(geofence -> {
                long folderId = hierarchy.validFolderId(folderId(geofence));
                boolean direct = directGeofences.contains(geofence.getId());
                boolean inherited = folderId > 0 && readableFolders.contains(folderId);
                if (administrator || direct || inherited) {
                    entries.add(new GeofenceEntry(geofence, folderId, direct, inherited));
                    if (folderId > 0) {
                        visibleFolders.add(folderId);
                    }
                }
            });
        }
        visibleFolders.addAll(hierarchy.withAncestors(visibleFolders));

        List<FolderEntry> folderEntries = folders.stream()
                .filter(folder -> visibleFolders.contains(folder.getId()))
                .map(folder -> {
                    boolean direct = directFolders.contains(folder.getId());
                    boolean inherited = !direct && readableFolders.contains(folder.getId());
                    long parentId = hierarchy.validFolderId(folder.getId()) == 0 ? 0 : folder.getParentid();
                    return new FolderEntry(folder.getId(), folder.getName(), parentId,
                            direct, inherited, !administrator && !direct && !inherited);
                })
                .sorted(Comparator.comparing(FolderEntry::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparingLong(FolderEntry::id))
                .toList();
        entries.sort(Comparator.comparing((GeofenceEntry entry) -> entry.geofence().getName(),
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                .thenComparingLong(entry -> entry.geofence().getId()));
        return new ReadAccess(administrator, folderEntries, entries);
    }

}

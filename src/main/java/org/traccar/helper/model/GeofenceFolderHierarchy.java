package org.traccar.helper.model;

import org.traccar.model.Geofence;
import org.traccar.model.GeofenceFolder;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/** A request-local hierarchy. Invalid branches never grant inherited access. */
public final class GeofenceFolderHierarchy {

    private final Map<Long, GeofenceFolder> folders = new HashMap<>();
    private final Map<Long, Collection<Long>> children = new HashMap<>();
    private final Set<Long> validFolders;

    public GeofenceFolderHierarchy(Collection<GeofenceFolder> items) {
        for (GeofenceFolder folder : items) {
            if (folder.getId() > 0) {
                folders.put(folder.getId(), folder);
                children.computeIfAbsent(folder.getParentid(), key -> new ArrayList<>()).add(folder.getId());
            }
        }
        // With a single parent per node, only branches reachable from the root are valid.
        // This excludes cycles and missing/negative parents without recursive traversal.
        validFolders = expand(children.getOrDefault(0L, Set.of()));
    }

    private Set<Long> expand(Collection<Long> roots) {
        Set<Long> result = new LinkedHashSet<>();
        var pending = new ArrayDeque<>(roots);
        while (!pending.isEmpty()) {
            long id = pending.removeFirst();
            if (folders.containsKey(id) && result.add(id)) {
                pending.addAll(children.getOrDefault(id, Set.of()));
            }
        }
        return result;
    }

    public Set<Long> descendants(Set<Long> assignedFolders) {
        Set<Long> validRoots = new HashSet<>(assignedFolders);
        validRoots.retainAll(validFolders);
        return expand(validRoots);
    }

    public long validFolderId(long id) {
        return validFolders.contains(id) ? id : 0;
    }

    public Set<Long> withAncestors(Collection<Long> visibleFolders) {
        Set<Long> result = new LinkedHashSet<>();
        for (long id : visibleFolders) {
            while (validFolders.contains(id) && result.add(id)) {
                id = folders.get(id).getParentid();
            }
        }
        return result;
    }

    public static long folderId(Geofence geofence) {
        Object value = geofence.getAttributes().get("folderId");
        if (value == null) {
            return 0;
        }
        try {
            // Fractions, booleans and malformed legacy values must not become valid IDs.
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}

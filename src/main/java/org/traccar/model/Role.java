package org.traccar.model;

import org.traccar.storage.QueryIgnore;
import org.traccar.storage.StorageName;

import java.util.LinkedHashSet;
import java.util.Set;

@StorageName("tc_roles")
public class Role extends BaseModel {

    private String name;

    private Set<String> menuKeys = new LinkedHashSet<>();

    private int userCount;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    @QueryIgnore
    public Set<String> getMenuKeys() {
        return menuKeys;
    }

    @QueryIgnore
    public void setMenuKeys(Set<String> menuKeys) {
        this.menuKeys = menuKeys != null ? new LinkedHashSet<>(menuKeys) : new LinkedHashSet<>();
    }

    @QueryIgnore
    public int getUserCount() {
        return userCount;
    }

    @QueryIgnore
    public void setUserCount(int userCount) {
        this.userCount = userCount;
    }

}

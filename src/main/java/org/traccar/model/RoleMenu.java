package org.traccar.model;

import org.traccar.storage.StorageName;

@StorageName("tc_role_menus")
public class RoleMenu extends BaseModel {

    private long roleId;

    private String menuKey;

    public long getRoleId() {
        return roleId;
    }

    public void setRoleId(long roleId) {
        this.roleId = roleId;
    }

    public String getMenuKey() {
        return menuKey;
    }

    public void setMenuKey(String menuKey) {
        this.menuKey = menuKey;
    }

}

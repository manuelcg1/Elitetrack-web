package org.traccar.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import org.traccar.storage.StorageName;

@StorageName("tc_forward_servers")
public class ForwardServer extends BaseModel {

    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    private String ipDominio;

    public String getIpDominio() {
        return ipDominio;
    }

    public void setIpDominio(String ipDominio) {
        this.ipDominio = ipDominio;
    }

    private String username;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    private String password;

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    private String apiKey;

    public String getApiKey() {
        return apiKey;
    }

    @JsonAlias("apikey")
    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    private boolean active;

    public boolean getActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

}

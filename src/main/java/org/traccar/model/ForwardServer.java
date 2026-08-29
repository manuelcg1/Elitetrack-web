package org.traccar.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import org.traccar.storage.QueryIgnore;
import org.traccar.storage.StorageName;

@StorageName("tc_forward_servers")
public class ForwardServer extends BaseModel {

    public static final String TYPE_GENERIC_JSON = "GENERIC_JSON";
    public static final String TYPE_SUTRAN_V2 = "SUTRAN_V2";

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

    private boolean apiKeyConfigured;

    @QueryIgnore
    public boolean getApiKeyConfigured() {
        return apiKeyConfigured;
    }

    public void setApiKeyConfigured(boolean apiKeyConfigured) {
        this.apiKeyConfigured = apiKeyConfigured;
    }

    private String type = TYPE_GENERIC_JSON;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    private String environment = "DEVELOPMENT";

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    private int connectTimeout = 5000;

    public int getConnectTimeout() {
        return connectTimeout;
    }

    public void setConnectTimeout(int connectTimeout) {
        this.connectTimeout = connectTimeout;
    }

    private int readTimeout = 10000;

    public int getReadTimeout() {
        return readTimeout;
    }

    public void setReadTimeout(int readTimeout) {
        this.readTimeout = readTimeout;
    }

    private int maxAttempts = 5;

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    private long retryDelay = 1000;

    public long getRetryDelay() {
        return retryDelay;
    }

    public void setRetryDelay(long retryDelay) {
        this.retryDelay = retryDelay;
    }

    private boolean transmissionEnabled;

    public boolean getTransmissionEnabled() {
        return transmissionEnabled;
    }

    public void setTransmissionEnabled(boolean transmissionEnabled) {
        this.transmissionEnabled = transmissionEnabled;
    }

    private boolean active;

    public boolean getActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

}

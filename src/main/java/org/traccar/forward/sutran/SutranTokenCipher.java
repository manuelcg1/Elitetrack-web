package org.traccar.forward.sutran;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.traccar.config.Config;
import org.traccar.config.Keys;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

@Singleton
public class SutranTokenCipher {

    private static final String PREFIX = "enc:v1:";
    private static final int KEY_LENGTH = 32;
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH = 128;

    private final SecretKeySpec key;
    private final SecureRandom secureRandom = new SecureRandom();

    @Inject
    public SutranTokenCipher(Config config) {
        String value = config.getString(Keys.SUTRAN_ENCRYPTION_KEY);
        if (value == null || value.isBlank()) {
            key = null;
            return;
        }
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(value.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("SUTRAN encryption key must be valid Base64", e);
        }
        if (decoded.length != KEY_LENGTH) {
            throw new IllegalArgumentException("SUTRAN encryption key must contain exactly 32 bytes");
        }
        key = new SecretKeySpec(decoded, "AES");
    }

    public boolean isConfigured() {
        return key != null;
    }

    public boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    public String encrypt(String plaintext) {
        requireConfigured();
        byte[] iv = new byte[IV_LENGTH];
        secureRandom.nextBytes(iv);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] result = ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array();
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(result);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Unable to encrypt SUTRAN token", e);
        }
    }

    public String decrypt(String encryptedValue) {
        requireConfigured();
        if (!isEncrypted(encryptedValue)) {
            throw new IllegalArgumentException("SUTRAN token is not encrypted");
        }
        try {
            byte[] value = Base64.getUrlDecoder().decode(encryptedValue.substring(PREFIX.length()));
            if (value.length <= IV_LENGTH) {
                throw new IllegalArgumentException("SUTRAN encrypted token is invalid");
            }
            ByteBuffer buffer = ByteBuffer.wrap(value);
            byte[] iv = new byte[IV_LENGTH];
            buffer.get(iv);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (AEADBadTagException e) {
            throw new IllegalArgumentException("SUTRAN encrypted token authentication failed", e);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalArgumentException("SUTRAN encrypted token is invalid", e);
        }
    }

    private void requireConfigured() {
        if (key == null) {
            throw new IllegalStateException("SUTRAN encryption key is not configured");
        }
    }

}

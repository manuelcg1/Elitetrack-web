package org.traccar.forward.sutran;

import org.junit.jupiter.api.Test;
import org.traccar.config.Config;
import org.traccar.config.Keys;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class SutranTokenCipherTest {

    private static final String TOKEN = "123e4567-e89b-12d3-a456-426614174000";

    @Test
    public void testAuthenticatedEncryptionRoundTrip() {
        SutranTokenCipher cipher = cipher("01234567890123456789012345678901".getBytes(StandardCharsets.UTF_8));

        String first = cipher.encrypt(TOKEN);
        String second = cipher.encrypt(TOKEN);

        assertTrue(first.startsWith("enc:v1:"));
        assertNotEquals(first, second);
        assertEquals(TOKEN, cipher.decrypt(first));
        assertEquals(TOKEN, cipher.decrypt(second));
    }

    @Test
    public void testTamperedCiphertextIsRejected() {
        SutranTokenCipher cipher = cipher(new byte[32]);
        String encrypted = cipher.encrypt(TOKEN);
        char replacement = encrypted.endsWith("A") ? 'B' : 'A';
        String tampered = encrypted.substring(0, encrypted.length() - 1) + replacement;

        assertThrows(IllegalArgumentException.class, () -> cipher.decrypt(tampered));
    }

    @Test
    public void testMissingAndInvalidKeysAreRejected() {
        SutranTokenCipher missing = new SutranTokenCipher(new Config());
        assertThrows(IllegalStateException.class, () -> missing.encrypt(TOKEN));

        Config invalid = new Config();
        invalid.setString(Keys.SUTRAN_ENCRYPTION_KEY, Base64.getEncoder().encodeToString(new byte[16]));
        assertThrows(IllegalArgumentException.class, () -> new SutranTokenCipher(invalid));
    }

    private SutranTokenCipher cipher(byte[] key) {
        Config config = new Config();
        config.setString(Keys.SUTRAN_ENCRYPTION_KEY, Base64.getEncoder().encodeToString(key));
        return new SutranTokenCipher(config);
    }

}

package org.traccar.forward.sutran;

import java.util.Arrays;
import java.util.Optional;

public enum SutranResponseCode {

    DELIVERED(2000),
    INVALID_JSON(4001),
    INVALID_DATA(4002),
    POSITION_TOO_OLD(4003),
    POSITION_IN_FUTURE(4004),
    METHOD_NOT_ALLOWED(5001),
    TOKEN_REQUIRED(5002),
    TOKEN_INVALID(5003);

    private final int code;

    SutranResponseCode(int code) {
        this.code = code;
    }

    public int getCode() {
        return code;
    }

    public static Optional<SutranResponseCode> fromCode(int code) {
        return Arrays.stream(values()).filter(value -> value.code == code).findFirst();
    }

}

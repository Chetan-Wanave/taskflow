package com.chetanwanave.todo.dto;

public final class ApiPatterns {

    public static final String UUID =
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

    public static final String HEX_COLOR = "^#[0-9A-Fa-f]{6}$";

    private ApiPatterns() {
    }
}

package com.chetanwanave.todo.config;

import org.springframework.stereotype.Component;

/**
 * Auth seam: resolves the acting user server-side. v1 always returns the seeded
 * user from V1__init.sql; Spring Security plugs in here later with zero contract change.
 */
@Component
public class CurrentUser {

    public static final String SEED_USER_ID = "00000000-0000-0000-0000-000000000001";

    public String id() {
        return SEED_USER_ID;
    }
}

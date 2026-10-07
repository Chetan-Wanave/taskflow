package com.chetanwanave.todo.dto;

import java.time.Instant;

public record TagResponse(
        String id,
        String name,
        String color,
        Instant createdAt) {
}

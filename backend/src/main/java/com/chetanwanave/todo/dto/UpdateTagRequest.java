package com.chetanwanave.todo.dto;

import org.openapitools.jackson.nullable.JsonNullable;

/**
 * Tri-state PATCH body: name must be a non-null value when present; explicit null
 * clears color. Validated in TagService (see UpdateTaskRequest).
 */
public record UpdateTagRequest(
        JsonNullable<String> name,
        JsonNullable<String> color) {

    public UpdateTagRequest {
        name = name == null ? JsonNullable.undefined() : name;
        color = color == null ? JsonNullable.undefined() : color;
    }
}

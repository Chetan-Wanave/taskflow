package com.chetanwanave.todo.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ReorderRequest(
        @NotNull(message = "must not be null")
        @Valid
        List<@NotNull(message = "must not be null") PositionEntry> positions) {

    public record PositionEntry(
            @NotBlank(message = "must not be blank")
            String id,
            @Min(value = 1, message = "must be at least 1")
            long position) {
    }
}

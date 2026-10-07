package com.chetanwanave.todo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTagRequest(
        @Pattern(regexp = ApiPatterns.UUID, message = "must be a lowercase UUID")
        String id,
        @NotBlank(message = "must not be blank")
        @Size(max = 50, message = "must be at most 50 characters")
        String name,
        @Pattern(regexp = ApiPatterns.HEX_COLOR, message = "must match #RRGGBB")
        String color) {
}

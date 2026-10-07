package com.chetanwanave.todo.dto;

import com.chetanwanave.todo.entity.Priority;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record CreateTaskRequest(
        @Pattern(regexp = ApiPatterns.UUID, message = "must be a lowercase UUID")
        String id,
        @NotBlank(message = "must not be blank")
        @Size(max = 500, message = "must be at most 500 characters")
        String title,
        @Size(max = 10000, message = "must be at most 10000 characters")
        String notes,
        Priority priority,
        LocalDate dueDate,
        @Min(value = 1, message = "must be at least 1")
        Long position,
        @Pattern(regexp = ApiPatterns.UUID, message = "must be a lowercase UUID")
        String parentId,
        List<@NotNull(message = "must not be null")
             @Pattern(regexp = ApiPatterns.UUID, message = "must be a lowercase UUID") String> tagIds) {
}

package com.chetanwanave.todo.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

// Reuses the response records so the import shape is exactly the export/localStorage envelope.
public record ImportRequest(
        @NotNull(message = "must be 2")
        Integer schemaVersion,
        List<TaskResponse> tasks,
        List<TagResponse> tags) {
}

package com.chetanwanave.todo.dto;

public record ImportResult(
        int importedTasks,
        int importedTags,
        int skippedExisting) {
}

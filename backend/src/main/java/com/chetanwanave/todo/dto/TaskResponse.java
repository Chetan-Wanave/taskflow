package com.chetanwanave.todo.dto;

import com.chetanwanave.todo.entity.Priority;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

// Component order defines the JSON key order — keep in sync with the SPEC.md sample.
public record TaskResponse(
        String id,
        String title,
        String notes,
        Priority priority,
        LocalDate dueDate,
        Instant completedAt,
        long position,
        String parentId,
        List<String> tagIds,
        Instant createdAt,
        Instant updatedAt) {
}

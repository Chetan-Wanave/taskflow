package com.chetanwanave.todo.dto;

import com.chetanwanave.todo.entity.Priority;
import org.openapitools.jackson.nullable.JsonNullable;

import java.time.LocalDate;
import java.util.List;

/**
 * Tri-state PATCH body: each field is absent (undefined), explicit null, or a value.
 * The compact constructor normalizes absent fields to JsonNullable.undefined() so the
 * service can rely on isPresent(). Field-level validation happens in TaskService
 * because Jakarta annotations do not unwrap JsonNullable.
 */
public record UpdateTaskRequest(
        JsonNullable<String> title,
        JsonNullable<String> notes,
        JsonNullable<Priority> priority,
        JsonNullable<LocalDate> dueDate,
        JsonNullable<Boolean> completed,
        JsonNullable<Long> position,
        JsonNullable<List<String>> tagIds) {

    public UpdateTaskRequest {
        title = title == null ? JsonNullable.undefined() : title;
        notes = notes == null ? JsonNullable.undefined() : notes;
        priority = priority == null ? JsonNullable.undefined() : priority;
        dueDate = dueDate == null ? JsonNullable.undefined() : dueDate;
        completed = completed == null ? JsonNullable.undefined() : completed;
        position = position == null ? JsonNullable.undefined() : position;
        tagIds = tagIds == null ? JsonNullable.undefined() : tagIds;
    }
}

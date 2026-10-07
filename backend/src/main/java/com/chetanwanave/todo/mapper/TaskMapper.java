package com.chetanwanave.todo.mapper;

import com.chetanwanave.todo.dto.TaskResponse;
import com.chetanwanave.todo.entity.TagEntity;
import com.chetanwanave.todo.entity.TaskEntity;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TaskMapper {

    public TaskResponse toResponse(TaskEntity task) {
        // Sorted for a deterministic order (the join table has none).
        List<String> tagIds = task.getTags().stream()
                .map(TagEntity::getId)
                .sorted()
                .toList();
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getNotes(),
                task.getPriority(),
                task.getDueDate(),
                task.getCompletedAt(),
                task.getPosition(),
                task.getParentId(),
                tagIds,
                task.getCreatedAt(),
                task.getUpdatedAt());
    }
}

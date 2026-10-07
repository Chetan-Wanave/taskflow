package com.chetanwanave.todo.service;

import com.chetanwanave.todo.config.CurrentUser;
import com.chetanwanave.todo.dto.ClearCompletedResponse;
import com.chetanwanave.todo.dto.CreateTaskRequest;
import com.chetanwanave.todo.dto.ReorderRequest;
import com.chetanwanave.todo.dto.TaskResponse;
import com.chetanwanave.todo.dto.UpdateTaskRequest;
import com.chetanwanave.todo.entity.Priority;
import com.chetanwanave.todo.entity.TagEntity;
import com.chetanwanave.todo.entity.TaskEntity;
import com.chetanwanave.todo.exception.DuplicateIdException;
import com.chetanwanave.todo.exception.FieldValidationError;
import com.chetanwanave.todo.exception.NotFoundException;
import com.chetanwanave.todo.exception.ValidationException;
import com.chetanwanave.todo.mapper.TaskMapper;
import com.chetanwanave.todo.repository.TagRepository;
import com.chetanwanave.todo.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private static final Set<String> VALID_STATUSES = Set.of("all", "active", "completed");
    private static final long POSITION_GAP = 1024;

    private final TaskRepository taskRepository;
    private final TagRepository tagRepository;
    private final TaskMapper taskMapper;
    private final CurrentUser currentUser;

    public TaskService(TaskRepository taskRepository, TagRepository tagRepository,
                       TaskMapper taskMapper, CurrentUser currentUser) {
        this.taskRepository = taskRepository;
        this.tagRepository = tagRepository;
        this.taskMapper = taskMapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> list(String status, String search, String tagId) {
        if (!VALID_STATUSES.contains(status)) {
            throw ValidationException.of("status", "must be one of: all, active, completed");
        }
        String normalizedSearch = (search == null || search.isBlank()) ? null : escapeLike(search.trim());
        String normalizedTagId = (tagId == null || tagId.isBlank()) ? null : tagId;
        return taskRepository.findFiltered(currentUser.id(), status, normalizedSearch, normalizedTagId)
                .stream()
                .map(taskMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse get(String id) {
        return taskMapper.toResponse(requireTask(id));
    }

    @Transactional
    public TaskResponse create(CreateTaskRequest request) {
        String id = request.id() != null ? request.id() : UUID.randomUUID().toString();
        if (taskRepository.existsById(id)) {
            throw new DuplicateIdException("Task with id '" + id + "' already exists");
        }

        List<FieldValidationError> errors = new ArrayList<>();
        Set<TagEntity> tags = resolveTags(
                request.tagIds() == null ? List.of() : request.tagIds(), "tagIds", errors);
        String parentId = resolveParentId(request.parentId(), "parentId", errors);
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }

        TaskEntity task = new TaskEntity();
        task.setId(id);
        task.setUserId(currentUser.id());
        task.setTitle(request.title().trim());
        task.setNotes(request.notes());
        task.setPriority(request.priority() != null ? request.priority() : Priority.NONE);
        task.setDueDate(request.dueDate());
        task.setParentId(parentId);
        task.setPosition(request.position() != null ? request.position() : nextPosition());
        task.setTags(tags);
        return taskMapper.toResponse(taskRepository.saveAndFlush(task));
    }

    @Transactional
    public TaskResponse update(String id, UpdateTaskRequest request) {
        TaskEntity task = requireTask(id);
        List<FieldValidationError> errors = new ArrayList<>();

        if (request.title().isPresent()) {
            String title = request.title().get();
            if (title == null || title.trim().isEmpty()) {
                errors.add(new FieldValidationError("title", "must not be blank"));
            } else if (title.trim().length() > 500) {
                errors.add(new FieldValidationError("title", "must be at most 500 characters"));
            } else {
                task.setTitle(title.trim());
            }
        }
        if (request.notes().isPresent()) {
            String notes = request.notes().get();
            if (notes != null && notes.length() > 10000) {
                errors.add(new FieldValidationError("notes", "must be at most 10000 characters"));
            } else {
                task.setNotes(notes); // explicit null clears
            }
        }
        if (request.priority().isPresent()) {
            Priority priority = request.priority().get();
            if (priority == null) {
                errors.add(new FieldValidationError("priority", "must be one of: NONE, LOW, MEDIUM, HIGH"));
            } else {
                task.setPriority(priority);
            }
        }
        if (request.dueDate().isPresent()) {
            task.setDueDate(request.dueDate().get()); // explicit null clears
        }
        if (request.completed().isPresent()) {
            Boolean completed = request.completed().get();
            if (completed == null) {
                errors.add(new FieldValidationError("completed", "must be true or false"));
            } else {
                // Intent in, timestamp out: the server owns completedAt.
                task.setCompletedAt(completed ? Instant.now().truncatedTo(ChronoUnit.MILLIS) : null);
            }
        }
        if (request.position().isPresent()) {
            Long position = request.position().get();
            if (position == null || position < 1) {
                errors.add(new FieldValidationError("position", "must be at least 1"));
            } else {
                task.setPosition(position);
            }
        }
        if (request.tagIds().isPresent()) {
            List<String> tagIds = request.tagIds().get();
            Set<TagEntity> tags = resolveTags(tagIds == null ? List.of() : tagIds, "tagIds", errors);
            if (errors.isEmpty()) {
                Set<String> before = task.getTags().stream()
                        .map(TagEntity::getId).collect(Collectors.toSet());
                Set<String> after = tags.stream()
                        .map(TagEntity::getId).collect(Collectors.toSet());
                task.setTags(tags);
                if (!before.equals(after)) {
                    // A join-table-only change never dirties the tasks row, so
                    // @PreUpdate would not fire — stamp updatedAt explicitly.
                    task.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MILLIS));
                }
            }
        }

        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
        // Flush so @PreUpdate stamps updatedAt before the entity is mapped.
        return taskMapper.toResponse(taskRepository.saveAndFlush(task));
    }

    @Transactional
    public void delete(String id) {
        // Idempotent: deleting a missing task is a no-op (controller returns 204 either way).
        taskRepository.findById(id)
                .filter(task -> task.getUserId().equals(currentUser.id()))
                .ifPresent(taskRepository::delete);
    }

    @Transactional
    public void reorder(ReorderRequest request) {
        // Any unknown id throws → whole batch rolls back.
        for (ReorderRequest.PositionEntry entry : request.positions()) {
            TaskEntity task = requireTask(entry.id());
            task.setPosition(entry.position());
        }
        taskRepository.flush();
    }

    @Transactional
    public ClearCompletedResponse clearCompleted() {
        List<TaskEntity> completed = taskRepository.findByUserIdAndCompletedAtIsNotNull(currentUser.id());
        List<String> deletedIds = completed.stream().map(TaskEntity::getId).toList();
        taskRepository.deleteAll(completed);
        return new ClearCompletedResponse(deletedIds);
    }

    private TaskEntity requireTask(String id) {
        return taskRepository.findById(id)
                .filter(task -> task.getUserId().equals(currentUser.id()))
                .orElseThrow(() -> new NotFoundException("Task with id '" + id + "' not found"));
    }

    private long nextPosition() {
        Long max = taskRepository.findMaxPositionByUserId(currentUser.id());
        return (max == null ? 0 : max) + POSITION_GAP;
    }

    /**
     * Search terms are matched literally: LIKE metacharacters in the user's query
     * ('%', '_') are escaped with '!' (the escape char declared in findFiltered).
     */
    private String escapeLike(String search) {
        return search.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private Set<TagEntity> resolveTags(List<String> tagIds, String field,
                                       List<FieldValidationError> errors) {
        // PATCH bodies bypass bean validation (JsonNullable), so guard nulls here too.
        if (tagIds.stream().anyMatch(Objects::isNull)) {
            errors.add(new FieldValidationError(field, "must not contain null entries"));
            return Set.of();
        }
        List<String> distinct = tagIds.stream().distinct().toList();
        List<TagEntity> found = tagRepository.findAllById(distinct);
        Set<String> foundIds = found.stream()
                .filter(tag -> tag.getUserId().equals(currentUser.id()))
                .map(TagEntity::getId)
                .collect(Collectors.toSet());
        List<String> missing = distinct.stream().filter(tagId -> !foundIds.contains(tagId)).toList();
        if (!missing.isEmpty()) {
            errors.add(new FieldValidationError(field,
                    "unknown tag ids: " + String.join(", ", missing)));
            return Set.of();
        }
        return new HashSet<>(found);
    }

    private String resolveParentId(String parentId, String field, List<FieldValidationError> errors) {
        if (parentId == null) {
            return null;
        }
        TaskEntity parent = taskRepository.findById(parentId)
                .filter(task -> task.getUserId().equals(currentUser.id()))
                .orElse(null);
        if (parent == null) {
            errors.add(new FieldValidationError(field, "must reference an existing task"));
            return null;
        }
        if (parent.getParentId() != null) {
            errors.add(new FieldValidationError(field, "must reference a top-level task (one level max)"));
            return null;
        }
        return parentId;
    }
}

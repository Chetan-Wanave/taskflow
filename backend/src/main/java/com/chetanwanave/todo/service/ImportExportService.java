package com.chetanwanave.todo.service;

import com.chetanwanave.todo.config.CurrentUser;
import com.chetanwanave.todo.dto.ApiPatterns;
import com.chetanwanave.todo.dto.ExportResponse;
import com.chetanwanave.todo.dto.ImportRequest;
import com.chetanwanave.todo.dto.ImportResult;
import com.chetanwanave.todo.dto.TagResponse;
import com.chetanwanave.todo.dto.TaskResponse;
import com.chetanwanave.todo.entity.Priority;
import com.chetanwanave.todo.entity.TagEntity;
import com.chetanwanave.todo.entity.TaskEntity;
import com.chetanwanave.todo.exception.DuplicateNameException;
import com.chetanwanave.todo.exception.FieldValidationError;
import com.chetanwanave.todo.exception.ValidationException;
import com.chetanwanave.todo.mapper.TagMapper;
import com.chetanwanave.todo.mapper.TaskMapper;
import com.chetanwanave.todo.repository.TagRepository;
import com.chetanwanave.todo.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ImportExportService {

    private static final int SCHEMA_VERSION = 2;
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");
    private static final Pattern UUID_FORMAT = Pattern.compile(ApiPatterns.UUID);

    private final TaskRepository taskRepository;
    private final TagRepository tagRepository;
    private final TaskMapper taskMapper;
    private final TagMapper tagMapper;
    private final CurrentUser currentUser;

    public ImportExportService(TaskRepository taskRepository, TagRepository tagRepository,
                               TaskMapper taskMapper, TagMapper tagMapper, CurrentUser currentUser) {
        this.taskRepository = taskRepository;
        this.tagRepository = tagRepository;
        this.taskMapper = taskMapper;
        this.tagMapper = tagMapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public ExportResponse export() {
        List<TaskResponse> tasks = taskRepository.findByUserIdOrderByPositionAsc(currentUser.id())
                .stream().map(taskMapper::toResponse).toList();
        List<TagResponse> tags = tagRepository.findByUserIdOrderByCreatedAtAscIdAsc(currentUser.id())
                .stream().map(tagMapper::toResponse).toList();
        return new ExportResponse(SCHEMA_VERSION, tasks, tags);
    }

    /**
     * Transactional upsert-by-id: rows whose id already exists are skipped (counted in
     * skippedExisting), new rows are inserted with their payload timestamps preserved.
     * This is the local→API data handoff, so the envelope is trusted but still validated.
     */
    @Transactional
    public ImportResult importData(ImportRequest request) {
        if (request.schemaVersion() == null || request.schemaVersion() != SCHEMA_VERSION) {
            throw ValidationException.of("schemaVersion", "must be 2");
        }
        List<TaskResponse> tasks = request.tasks() == null ? List.of() : request.tasks();
        List<TagResponse> tags = request.tags() == null ? List.of() : request.tags();

        int importedTags = 0;
        int importedTasks = 0;
        int skippedExisting = 0;

        for (int i = 0; i < tags.size(); i++) {
            TagResponse data = tags.get(i);
            if (data == null) {
                throw ValidationException.of("tags[" + i + "]", "must not be null");
            }
            if (data.id() != null && UUID_FORMAT.matcher(data.id()).matches()
                    && tagRepository.existsById(data.id())) {
                skippedExisting++;
                continue;
            }
            validateTag(data, i);
            String name = data.name().trim();
            tagRepository.findByUserIdAndNameIgnoreCase(currentUser.id(), name).ifPresent(existing -> {
                throw new DuplicateNameException("Tag with name '" + name + "' already exists");
            });
            TagEntity tag = new TagEntity();
            tag.setId(data.id() != null ? data.id() : UUID.randomUUID().toString());
            tag.setUserId(currentUser.id());
            tag.setName(name);
            tag.setColor(data.color());
            tag.setCreatedAt(data.createdAt()); // null → stamped by @PrePersist
            tagRepository.save(tag);
            importedTags++;
        }

        // Reject null rows up front, then order parents before children so the
        // parent_id FK resolves (one level max in v1). The stable sort keeps payload
        // order otherwise; carrying the original index keeps error messages accurate
        // even when the payload contains value-identical rows.
        List<IndexedTask> ordered = new ArrayList<>(tasks.size());
        for (int i = 0; i < tasks.size(); i++) {
            TaskResponse data = tasks.get(i);
            if (data == null) {
                throw ValidationException.of("tasks[" + i + "]", "must not be null");
            }
            ordered.add(new IndexedTask(i, data));
        }
        ordered.sort(Comparator.comparing(entry -> entry.data().parentId() != null));
        for (IndexedTask entry : ordered) {
            int index = entry.index();
            TaskResponse data = entry.data();
            if (data.id() != null && UUID_FORMAT.matcher(data.id()).matches()
                    && taskRepository.existsById(data.id())) {
                skippedExisting++;
                continue;
            }
            validateTask(data, index);
            TaskEntity task = new TaskEntity();
            task.setId(data.id() != null ? data.id() : UUID.randomUUID().toString());
            task.setUserId(currentUser.id());
            task.setTitle(data.title().trim());
            task.setNotes(data.notes());
            task.setPriority(data.priority() != null ? data.priority() : Priority.NONE);
            task.setDueDate(data.dueDate());
            task.setCompletedAt(data.completedAt());
            task.setPosition(data.position());
            task.setParentId(resolveParentId(data.parentId(), index));
            task.setTags(resolveTags(data.tagIds(), index));
            task.setCreatedAt(data.createdAt());  // null → stamped by @PrePersist
            task.setUpdatedAt(data.updatedAt());
            taskRepository.save(task);
            importedTasks++;
        }

        return new ImportResult(importedTasks, importedTags, skippedExisting);
    }

    private record IndexedTask(int index, TaskResponse data) {
    }

    private void validateTag(TagResponse data, int index) {
        List<FieldValidationError> errors = new ArrayList<>();
        if (data.id() != null && !UUID_FORMAT.matcher(data.id()).matches()) {
            errors.add(new FieldValidationError("tags[" + index + "].id", "must be a lowercase UUID"));
        }
        if (data.name() == null || data.name().trim().isEmpty()) {
            errors.add(new FieldValidationError("tags[" + index + "].name", "must not be blank"));
        } else if (data.name().trim().length() > 50) {
            errors.add(new FieldValidationError("tags[" + index + "].name", "must be at most 50 characters"));
        }
        if (data.color() != null && !HEX_COLOR.matcher(data.color()).matches()) {
            errors.add(new FieldValidationError("tags[" + index + "].color", "must match #RRGGBB"));
        }
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    private void validateTask(TaskResponse data, int index) {
        List<FieldValidationError> errors = new ArrayList<>();
        if (data.id() != null && !UUID_FORMAT.matcher(data.id()).matches()) {
            errors.add(new FieldValidationError("tasks[" + index + "].id", "must be a lowercase UUID"));
        }
        if (data.title() == null || data.title().trim().isEmpty()) {
            errors.add(new FieldValidationError("tasks[" + index + "].title", "must not be blank"));
        } else if (data.title().trim().length() > 500) {
            errors.add(new FieldValidationError("tasks[" + index + "].title", "must be at most 500 characters"));
        }
        if (data.notes() != null && data.notes().length() > 10000) {
            errors.add(new FieldValidationError("tasks[" + index + "].notes", "must be at most 10000 characters"));
        }
        if (data.position() < 1) {
            errors.add(new FieldValidationError("tasks[" + index + "].position", "must be at least 1"));
        }
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    private String resolveParentId(String parentId, int index) {
        if (parentId == null) {
            return null;
        }
        // findById also sees parents saved earlier in this same import transaction,
        // so the one-level rule below covers in-batch grandchildren too.
        TaskEntity parent = taskRepository.findById(parentId).orElse(null);
        if (parent == null) {
            throw ValidationException.of("tasks[" + index + "].parentId",
                    "must reference an existing task");
        }
        // Same one-level rule TaskService.resolveParentId enforces on POST /tasks.
        if (parent.getParentId() != null) {
            throw ValidationException.of("tasks[" + index + "].parentId",
                    "must reference a top-level task (one level max)");
        }
        return parentId;
    }

    private Set<TagEntity> resolveTags(List<String> tagIds, int index) {
        if (tagIds == null || tagIds.isEmpty()) {
            return new HashSet<>();
        }
        if (tagIds.stream().anyMatch(Objects::isNull)) {
            throw ValidationException.of("tasks[" + index + "].tagIds",
                    "must not contain null entries");
        }
        List<String> distinct = tagIds.stream().distinct().toList();
        List<TagEntity> found = tagRepository.findAllById(distinct);
        Set<String> foundIds = found.stream().map(TagEntity::getId).collect(Collectors.toSet());
        List<String> missing = distinct.stream().filter(id -> !foundIds.contains(id)).toList();
        if (!missing.isEmpty()) {
            throw ValidationException.of("tasks[" + index + "].tagIds",
                    "unknown tag ids: " + String.join(", ", missing));
        }
        return new HashSet<>(found);
    }
}

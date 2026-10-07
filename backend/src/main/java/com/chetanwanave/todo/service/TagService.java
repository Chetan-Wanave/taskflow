package com.chetanwanave.todo.service;

import com.chetanwanave.todo.config.CurrentUser;
import com.chetanwanave.todo.dto.CreateTagRequest;
import com.chetanwanave.todo.dto.TagResponse;
import com.chetanwanave.todo.dto.UpdateTagRequest;
import com.chetanwanave.todo.entity.TagEntity;
import com.chetanwanave.todo.exception.DuplicateIdException;
import com.chetanwanave.todo.exception.DuplicateNameException;
import com.chetanwanave.todo.exception.FieldValidationError;
import com.chetanwanave.todo.exception.NotFoundException;
import com.chetanwanave.todo.exception.ValidationException;
import com.chetanwanave.todo.mapper.TagMapper;
import com.chetanwanave.todo.repository.TagRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class TagService {

    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private final TagRepository tagRepository;
    private final TagMapper tagMapper;
    private final CurrentUser currentUser;

    public TagService(TagRepository tagRepository, TagMapper tagMapper, CurrentUser currentUser) {
        this.tagRepository = tagRepository;
        this.tagMapper = tagMapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<TagResponse> list() {
        return tagRepository.findByUserIdOrderByCreatedAtAscIdAsc(currentUser.id())
                .stream()
                .map(tagMapper::toResponse)
                .toList();
    }

    @Transactional
    public TagResponse create(CreateTagRequest request) {
        String id = request.id() != null ? request.id() : UUID.randomUUID().toString();
        if (tagRepository.existsById(id)) {
            throw new DuplicateIdException("Tag with id '" + id + "' already exists");
        }
        String name = request.name().trim();
        requireUniqueName(name, null);

        TagEntity tag = new TagEntity();
        tag.setId(id);
        tag.setUserId(currentUser.id());
        tag.setName(name);
        tag.setColor(request.color());
        return tagMapper.toResponse(tagRepository.saveAndFlush(tag));
    }

    @Transactional
    public TagResponse update(String id, UpdateTagRequest request) {
        TagEntity tag = requireTag(id);
        List<FieldValidationError> errors = new ArrayList<>();

        if (request.name().isPresent()) {
            String name = request.name().get();
            if (name == null || name.trim().isEmpty()) {
                errors.add(new FieldValidationError("name", "must not be blank"));
            } else if (name.trim().length() > 50) {
                errors.add(new FieldValidationError("name", "must be at most 50 characters"));
            } else {
                String trimmed = name.trim();
                requireUniqueName(trimmed, id);
                tag.setName(trimmed);
            }
        }
        if (request.color().isPresent()) {
            String color = request.color().get();
            if (color != null && !HEX_COLOR.matcher(color).matches()) {
                errors.add(new FieldValidationError("color", "must match #RRGGBB"));
            } else {
                tag.setColor(color); // explicit null clears
            }
        }

        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
        return tagMapper.toResponse(tagRepository.saveAndFlush(tag));
    }

    @Transactional
    public void delete(String id) {
        // Idempotent; task_tags join rows cascade at the DB level.
        tagRepository.findById(id)
                .filter(tag -> tag.getUserId().equals(currentUser.id()))
                .ifPresent(tagRepository::delete);
    }

    private TagEntity requireTag(String id) {
        return tagRepository.findById(id)
                .filter(tag -> tag.getUserId().equals(currentUser.id()))
                .orElseThrow(() -> new NotFoundException("Tag with id '" + id + "' not found"));
    }

    private void requireUniqueName(String name, String selfId) {
        tagRepository.findByUserIdAndNameIgnoreCase(currentUser.id(), name)
                .filter(existing -> !existing.getId().equals(selfId))
                .ifPresent(existing -> {
                    throw new DuplicateNameException("Tag with name '" + name + "' already exists");
                });
    }
}

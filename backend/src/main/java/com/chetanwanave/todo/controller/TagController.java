package com.chetanwanave.todo.controller;

import com.chetanwanave.todo.dto.CreateTagRequest;
import com.chetanwanave.todo.dto.TagResponse;
import com.chetanwanave.todo.dto.UpdateTagRequest;
import com.chetanwanave.todo.service.TagService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @GetMapping
    public List<TagResponse> list() {
        return tagService.list();
    }

    @PostMapping
    public ResponseEntity<TagResponse> create(@Valid @RequestBody CreateTagRequest request) {
        TagResponse created = tagService.create(request);
        return ResponseEntity
                .created(URI.create("/api/v1/tags/" + created.id()))
                .body(created);
    }

    @PatchMapping("/{id}")
    public TagResponse update(@PathVariable String id, @RequestBody UpdateTagRequest request) {
        return tagService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        tagService.delete(id);
    }
}

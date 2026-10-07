package com.chetanwanave.todo.controller;

import com.chetanwanave.todo.dto.ClearCompletedResponse;
import com.chetanwanave.todo.dto.CreateTaskRequest;
import com.chetanwanave.todo.dto.ReorderRequest;
import com.chetanwanave.todo.dto.TaskResponse;
import com.chetanwanave.todo.dto.UpdateTaskRequest;
import com.chetanwanave.todo.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> list(@RequestParam(defaultValue = "all") String status,
                                   @RequestParam(required = false) String search,
                                   @RequestParam(required = false) String tagId) {
        return taskService.list(status, search, tagId);
    }

    @PostMapping
    public ResponseEntity<TaskResponse> create(@Valid @RequestBody CreateTaskRequest request) {
        TaskResponse created = taskService.create(request);
        return ResponseEntity
                .created(URI.create("/api/v1/tasks/" + created.id()))
                .body(created);
    }

    @GetMapping("/{id}")
    public TaskResponse get(@PathVariable String id) {
        return taskService.get(id);
    }

    @PatchMapping("/{id}")
    public TaskResponse update(@PathVariable String id, @RequestBody UpdateTaskRequest request) {
        return taskService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        taskService.delete(id);
    }

    @PutMapping("/positions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@Valid @RequestBody ReorderRequest request) {
        taskService.reorder(request);
    }

    @PostMapping("/clear-completed")
    public ClearCompletedResponse clearCompleted() {
        return taskService.clearCompleted();
    }
}

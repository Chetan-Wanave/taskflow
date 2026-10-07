package com.chetanwanave.todo.dto;

import java.util.List;

// Identical shape to the frontend's localStorage envelope ('todo.app.v2').
public record ExportResponse(
        int schemaVersion,
        List<TaskResponse> tasks,
        List<TagResponse> tags) {
}

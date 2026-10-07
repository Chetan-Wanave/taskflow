package com.chetanwanave.todo.dto;

import java.util.List;

public record ClearCompletedResponse(List<String> deletedIds) {
}

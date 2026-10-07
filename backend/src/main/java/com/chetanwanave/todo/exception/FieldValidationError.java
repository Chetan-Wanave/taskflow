package com.chetanwanave.todo.exception;

// Shape of one entry in the RFC 9457 problem's errors[] array.
public record FieldValidationError(String field, String message) {
}

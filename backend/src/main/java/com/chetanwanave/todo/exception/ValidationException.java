package com.chetanwanave.todo.exception;

import java.util.List;

// Service-level validation failures (e.g. JsonNullable PATCH fields) → 400 with errors[].
public class ValidationException extends RuntimeException {

    private final List<FieldValidationError> errors;

    public ValidationException(List<FieldValidationError> errors) {
        super("Validation failed");
        this.errors = List.copyOf(errors);
    }

    public static ValidationException of(String field, String message) {
        return new ValidationException(List.of(new FieldValidationError(field, message)));
    }

    public List<FieldValidationError> getErrors() {
        return errors;
    }
}

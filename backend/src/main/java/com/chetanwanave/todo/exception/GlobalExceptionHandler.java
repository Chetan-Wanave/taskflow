package com.chetanwanave.todo.exception;

import com.fasterxml.jackson.databind.JsonMappingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        List<FieldValidationError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new FieldValidationError(fe.getField(), fe.getDefaultMessage()))
                .toList();
        return problem(HttpStatus.BAD_REQUEST, "Validation failed", "Request validation failed", errors);
    }

    @ExceptionHandler(ValidationException.class)
    public ProblemDetail handleValidation(ValidationException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Validation failed", "Request validation failed", ex.getErrors());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleUnreadable(HttpMessageNotReadableException ex) {
        List<FieldValidationError> errors = List.of();
        if (ex.getCause() instanceof JsonMappingException jme && !jme.getPath().isEmpty()) {
            String field = jme.getPath().stream()
                    .map(JsonMappingException.Reference::getFieldName)
                    .filter(Objects::nonNull)
                    .collect(Collectors.joining("."));
            if (!field.isEmpty()) {
                errors = List.of(new FieldValidationError(field, "has an invalid value"));
            }
        }
        return problem(HttpStatus.BAD_REQUEST, "Malformed request",
                "Request body is malformed or contains invalid field values", errors);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ProblemDetail handleHandlerMethodValidation(HandlerMethodValidationException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Validation failed", "Request validation failed", List.of());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Validation failed",
                "Parameter '" + ex.getName() + "' has an invalid value", List.of());
    }

    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail handleNotFound(NotFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, "Not found", ex.getMessage(), List.of());
    }

    @ExceptionHandler({DuplicateIdException.class, DuplicateNameException.class})
    public ProblemDetail handleConflict(RuntimeException ex) {
        return problem(HttpStatus.CONFLICT, "Conflict", ex.getMessage(), List.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        // DB UNIQUE/FK backstop for races that slip past the service-level checks
        // (e.g. two concurrent creates of the same tag name). Detail stays generic
        // on purpose — never leak SQL or constraint internals to the client.
        log.warn("Data integrity violation mapped to 409", ex);
        return problem(HttpStatus.CONFLICT, "Conflict",
                "Request conflicts with existing data", List.of());
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        // Framework exceptions (unknown path → 404, wrong method → 405, unsupported
        // media type → 415, ...) carry their own status and problem body — pass them
        // through instead of masking them as 500s.
        if (ex instanceof ErrorResponse errorResponse) {
            ProblemDetail problemDetail = errorResponse.getBody();
            problemDetail.setProperty("errors", List.of());
            return problemDetail;
        }
        log.error("Unhandled exception", ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error",
                "An unexpected error occurred", List.of());
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail,
                                  List<FieldValidationError> errors) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(status, detail);
        problemDetail.setTitle(title);
        problemDetail.setProperty("errors", errors);
        return problemDetail;
    }
}

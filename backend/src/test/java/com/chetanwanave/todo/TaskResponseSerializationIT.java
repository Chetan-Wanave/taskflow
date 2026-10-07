package com.chetanwanave.todo;

import com.chetanwanave.todo.dto.TaskResponse;
import com.chetanwanave.todo.entity.Priority;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Locks the wire format to the sample TaskResponse in SPEC.md §REST API contract:
 * exact key names, key order, null handling, 'YYYY-MM-DD' dates and ISO-8601 UTC
 * millisecond timestamps. Uses the application's ObjectMapper so DTOs cannot drift
 * from the frontend's TS types without failing this test.
 */
class TaskResponseSerializationIT extends AbstractIntegrationTest {

    @Test
    void serializesExactlyLikeTheSpecSample() throws Exception {
        TaskResponse sample = new TaskResponse(
                "0b6c9adc-52f1-4b12-9f6b-1a2b3c4d5e6f",
                "Ship design tokens",
                null,
                Priority.NONE,
                LocalDate.of(2026, 9, 8),
                Instant.parse("2026-09-06T09:00:00.000Z"),
                1024L,
                null,
                List.of("3f9d2c77-8a4e-4c1b-a2d0-9e8f7a6b5c4d"),
                Instant.parse("2026-09-01T12:00:00.000Z"),
                Instant.parse("2026-09-06T09:00:00.000Z"));

        String expected = "{"
                + "\"id\":\"0b6c9adc-52f1-4b12-9f6b-1a2b3c4d5e6f\","
                + "\"title\":\"Ship design tokens\","
                + "\"notes\":null,"
                + "\"priority\":\"NONE\","
                + "\"dueDate\":\"2026-09-08\","
                + "\"completedAt\":\"2026-09-06T09:00:00.000Z\","
                + "\"position\":1024,"
                + "\"parentId\":null,"
                + "\"tagIds\":[\"3f9d2c77-8a4e-4c1b-a2d0-9e8f7a6b5c4d\"],"
                + "\"createdAt\":\"2026-09-01T12:00:00.000Z\","
                + "\"updatedAt\":\"2026-09-06T09:00:00.000Z\""
                + "}";

        assertEquals(expected, objectMapper.writeValueAsString(sample));
    }
}

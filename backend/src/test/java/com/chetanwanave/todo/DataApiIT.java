package com.chetanwanave.todo;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DataApiIT extends AbstractIntegrationTest {

    @Test
    void health_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void export_matchesEnvelopeShape() throws Exception {
        String tagId = createTag("{\"name\":\"work\"}").get("id").asText();
        String taskId = createTask("{\"title\":\"exported\",\"tagIds\":[\"" + tagId + "\"]}")
                .get("id").asText();
        mockMvc.perform(patch("/api/v1/tasks/" + taskId).contentType(APPLICATION_JSON)
                .content("{\"completed\":true}")).andExpect(status().isOk());
        createTask("{\"title\":\"second\"}");

        mockMvc.perform(get("/api/v1/export"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schemaVersion").value(2))
                .andExpect(jsonPath("$.tasks.length()").value(2))
                .andExpect(jsonPath("$.tasks[0].id").value(taskId))
                .andExpect(jsonPath("$.tasks[0].tagIds[0]").value(tagId))
                .andExpect(jsonPath("$.tasks[0].completedAt").isNotEmpty())
                .andExpect(jsonPath("$.tags.length()").value(1))
                .andExpect(jsonPath("$.tags[0].id").value(tagId));
    }

    @Test
    void import_upsertsById_skippingExistingRows() throws Exception {
        String tagId = createTag("{\"name\":\"kept\"}").get("id").asText();
        String existingTaskId = createTask("{\"title\":\"already here\"}").get("id").asText();

        String newTaskId = "55555555-5555-4555-8555-555555555555";
        String envelope = """
                {
                  "schemaVersion": 2,
                  "tasks": [
                    { "id": "%s", "title": "already here", "notes": null, "priority": "NONE",
                      "dueDate": null, "completedAt": null, "position": 1024, "parentId": null,
                      "tagIds": [], "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-01T10:00:00.000Z" },
                    { "id": "%s", "title": "imported fresh", "notes": "from local", "priority": "HIGH",
                      "dueDate": "2026-09-10", "completedAt": "2026-09-05T08:30:00.000Z", "position": 2048,
                      "parentId": null, "tagIds": ["%s"],
                      "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-02T11:00:00.000Z" }
                  ],
                  "tags": [
                    { "id": "%s", "name": "kept", "color": null, "createdAt": "2026-09-01T09:00:00.000Z" }
                  ]
                }
                """.formatted(existingTaskId, newTaskId, tagId, tagId);

        mockMvc.perform(post("/api/v1/import").contentType(APPLICATION_JSON).content(envelope))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.importedTasks").value(1))
                .andExpect(jsonPath("$.importedTags").value(0))
                .andExpect(jsonPath("$.skippedExisting").value(2));

        // imported row preserves the payload's timestamps and metadata
        mockMvc.perform(get("/api/v1/tasks/" + newTaskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("imported fresh"))
                .andExpect(jsonPath("$.priority").value("HIGH"))
                .andExpect(jsonPath("$.dueDate").value("2026-09-10"))
                .andExpect(jsonPath("$.completedAt").value("2026-09-05T08:30:00.000Z"))
                .andExpect(jsonPath("$.position").value(2048))
                .andExpect(jsonPath("$.tagIds[0]").value(tagId))
                .andExpect(jsonPath("$.createdAt").value("2026-09-01T10:00:00.000Z"))
                .andExpect(jsonPath("$.updatedAt").value("2026-09-02T11:00:00.000Z"));
    }

    @Test
    void import_thenReimportOfOwnExport_skipsEverything() throws Exception {
        createTag("{\"name\":\"roundtrip\"}");
        createTask("{\"title\":\"task one\"}");
        createTask("{\"title\":\"task two\"}");

        JsonNode export = readBody(mockMvc.perform(get("/api/v1/export"))
                .andExpect(status().isOk()).andReturn());

        mockMvc.perform(post("/api/v1/import")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(export)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.importedTasks").value(0))
                .andExpect(jsonPath("$.importedTags").value(0))
                .andExpect(jsonPath("$.skippedExisting").value(3));

        JsonNode after = readBody(mockMvc.perform(get("/api/v1/export")).andReturn());
        assertThat(after).isEqualTo(export);
    }

    @Test
    void import_wrongSchemaVersion_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/import")
                        .contentType(APPLICATION_JSON)
                        .content("{\"schemaVersion\":1,\"tasks\":[],\"tags\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("schemaVersion"));
    }

    @Test
    void import_invalidTask_rollsBackWholeBatch() throws Exception {
        String good = "66666666-6666-4666-8666-666666666666";
        String envelope = """
                {
                  "schemaVersion": 2,
                  "tasks": [
                    { "id": "%s", "title": "valid", "notes": null, "priority": "NONE",
                      "dueDate": null, "completedAt": null, "position": 1024, "parentId": null,
                      "tagIds": [], "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-01T10:00:00.000Z" },
                    { "id": "77777777-7777-4777-8777-777777777777", "title": "   ", "notes": null,
                      "priority": "NONE", "dueDate": null, "completedAt": null, "position": 2048,
                      "parentId": null, "tagIds": [],
                      "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-01T10:00:00.000Z" }
                  ],
                  "tags": []
                }
                """.formatted(good);

        mockMvc.perform(post("/api/v1/import").contentType(APPLICATION_JSON).content(envelope))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/tasks/" + good)).andExpect(status().isNotFound());
    }

    @Test
    void import_invalidTaskId_returns400InsteadOfDataTruncation500() throws Exception {
        // A non-UUID id (here longer than CHAR(36)) must fail validation, not blow up
        // at the database with a data-truncation 500.
        String envelope = """
                {
                  "schemaVersion": 2,
                  "tasks": [
                    { "id": "definitely-not-a-uuid-and-way-too-long-for-char36", "title": "bad id",
                      "notes": null, "priority": "NONE", "dueDate": null, "completedAt": null,
                      "position": 1024, "parentId": null, "tagIds": [],
                      "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-01T10:00:00.000Z" }
                  ],
                  "tags": []
                }
                """;

        mockMvc.perform(post("/api/v1/import").contentType(APPLICATION_JSON).content(envelope))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("tasks[0].id"))
                .andExpect(jsonPath("$.errors[0].message").value("must be a lowercase UUID"));

        mockMvc.perform(get("/api/v1/tasks"))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void import_grandchildTask_returns400AndRollsBack() throws Exception {
        // A → B → C: B under A is fine (one level), C under B breaks the
        // one-level rule that POST /tasks already enforces.
        String a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        String b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
        String c = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        String envelope = """
                {
                  "schemaVersion": 2,
                  "tasks": [
                    { "id": "%s", "title": "A root", "notes": null, "priority": "NONE",
                      "dueDate": null, "completedAt": null, "position": 1024, "parentId": null,
                      "tagIds": [], "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-01T10:00:00.000Z" },
                    { "id": "%s", "title": "B child", "notes": null, "priority": "NONE",
                      "dueDate": null, "completedAt": null, "position": 2048, "parentId": "%s",
                      "tagIds": [], "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-01T10:00:00.000Z" },
                    { "id": "%s", "title": "C grandchild", "notes": null, "priority": "NONE",
                      "dueDate": null, "completedAt": null, "position": 3072, "parentId": "%s",
                      "tagIds": [], "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": "2026-09-01T10:00:00.000Z" }
                  ],
                  "tags": []
                }
                """.formatted(a, b, a, c, b);

        mockMvc.perform(post("/api/v1/import").contentType(APPLICATION_JSON).content(envelope))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("tasks[2].parentId"))
                .andExpect(jsonPath("$.errors[0].message")
                        .value("must reference a top-level task (one level max)"));

        // whole batch rolled back — not even the valid rows were kept
        mockMvc.perform(get("/api/v1/tasks"))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void import_nullRows_return400NotServerError() throws Exception {
        mockMvc.perform(post("/api/v1/import")
                        .contentType(APPLICATION_JSON)
                        .content("{\"schemaVersion\":2,\"tasks\":[null],\"tags\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("tasks[0]"));

        mockMvc.perform(post("/api/v1/import")
                        .contentType(APPLICATION_JSON)
                        .content("{\"schemaVersion\":2,\"tasks\":[],\"tags\":[null]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("tags[0]"));
    }
}

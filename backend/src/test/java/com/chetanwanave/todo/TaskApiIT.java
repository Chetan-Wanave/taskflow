package com.chetanwanave.todo;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TaskApiIT extends AbstractIntegrationTest {

    private static final String UUID_RE =
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    private static final String ISO_MILLIS_RE =
            "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z";

    @Test
    void createTask_honorsClientIdAndReturnsLocation() throws Exception {
        String id = "11111111-1111-4111-8111-111111111111";
        mockMvc.perform(post("/api/v1/tasks")
                        .contentType(APPLICATION_JSON)
                        .content("{\"id\":\"" + id + "\",\"title\":\"First task\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/v1/tasks/" + id))
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.title").value("First task"))
                .andExpect(jsonPath("$.priority").value("NONE"))
                .andExpect(jsonPath("$.position").value(1024))
                .andExpect(jsonPath("$.notes").value((Object) null))
                .andExpect(jsonPath("$.dueDate").value((Object) null))
                .andExpect(jsonPath("$.completedAt").value((Object) null))
                .andExpect(jsonPath("$.parentId").value((Object) null))
                .andExpect(jsonPath("$.tagIds").isEmpty())
                .andExpect(jsonPath("$.createdAt").value(org.hamcrest.Matchers.matchesPattern(ISO_MILLIS_RE)))
                .andExpect(jsonPath("$.updatedAt").value(org.hamcrest.Matchers.matchesPattern(ISO_MILLIS_RE)));
    }

    @Test
    void createTask_mintsIdWhenAbsentAndAppendsPositions() throws Exception {
        JsonNode first = createTask("{\"title\":\"one\"}");
        JsonNode second = createTask("{\"title\":\"two\"}");
        assertThat(first.get("id").asText()).matches(UUID_RE);
        assertThat(first.get("position").asLong()).isEqualTo(1024);
        assertThat(second.get("position").asLong()).isEqualTo(2048);
    }

    @Test
    void createTask_blankTitle_returns400WithErrorsArray() throws Exception {
        mockMvc.perform(post("/api/v1/tasks")
                        .contentType(APPLICATION_JSON)
                        .content("{\"title\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type").value("about:blank"))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors[0].field").value("title"))
                .andExpect(jsonPath("$.errors[0].message").value("must not be blank"));
    }

    @Test
    void createTask_duplicateClientId_returns409() throws Exception {
        String body = "{\"id\":\"22222222-2222-4222-8222-222222222222\",\"title\":\"dup\"}";
        createTask(body);
        mockMvc.perform(post("/api/v1/tasks").contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.title").value("Conflict"));
    }

    @Test
    void getAndPatchUnknownTask_return404() throws Exception {
        String unknown = "99999999-9999-4999-8999-999999999999";
        mockMvc.perform(get("/api/v1/tasks/" + unknown))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.title").value("Not found"));
        mockMvc.perform(patch("/api/v1/tasks/" + unknown)
                        .contentType(APPLICATION_JSON)
                        .content("{\"title\":\"x\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void patch_triState_absentUnchanged_explicitNullClears() throws Exception {
        JsonNode created = createTask(
                "{\"title\":\"with meta\",\"notes\":\"some notes\",\"dueDate\":\"2026-09-08\",\"priority\":\"HIGH\"}");
        String id = created.get("id").asText();

        // absent fields stay unchanged
        mockMvc.perform(patch("/api/v1/tasks/" + id)
                        .contentType(APPLICATION_JSON)
                        .content("{\"title\":\"renamed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("renamed"))
                .andExpect(jsonPath("$.notes").value("some notes"))
                .andExpect(jsonPath("$.dueDate").value("2026-09-08"))
                .andExpect(jsonPath("$.priority").value("HIGH"));

        // explicit null clears notes/dueDate
        mockMvc.perform(patch("/api/v1/tasks/" + id)
                        .contentType(APPLICATION_JSON)
                        .content("{\"notes\":null,\"dueDate\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notes").value((Object) null))
                .andExpect(jsonPath("$.dueDate").value((Object) null))
                .andExpect(jsonPath("$.title").value("renamed"));

        // explicit null title is invalid
        mockMvc.perform(patch("/api/v1/tasks/" + id)
                        .contentType(APPLICATION_JSON)
                        .content("{\"title\":null}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));
    }

    @Test
    void patch_completedTrueStampsCompletedAt_falseClearsIt() throws Exception {
        String id = createTask("{\"title\":\"toggle me\"}").get("id").asText();

        mockMvc.perform(patch("/api/v1/tasks/" + id)
                        .contentType(APPLICATION_JSON)
                        .content("{\"completed\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completedAt").value(org.hamcrest.Matchers.matchesPattern(ISO_MILLIS_RE)));

        mockMvc.perform(patch("/api/v1/tasks/" + id)
                        .contentType(APPLICATION_JSON)
                        .content("{\"completed\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completedAt").value((Object) null));
    }

    @Test
    void delete_isIdempotent204Twice() throws Exception {
        String id = createTask("{\"title\":\"delete me\"}").get("id").asText();
        mockMvc.perform(delete("/api/v1/tasks/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/tasks/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/tasks/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void reorderBatch_updatesPositions() throws Exception {
        String a = createTask("{\"title\":\"a\"}").get("id").asText(); // 1024
        String b = createTask("{\"title\":\"b\"}").get("id").asText(); // 2048

        mockMvc.perform(put("/api/v1/tasks/positions")
                        .contentType(APPLICATION_JSON)
                        .content("{\"positions\":[{\"id\":\"" + a + "\",\"position\":3072},"
                                + "{\"id\":\"" + b + "\",\"position\":1024}]}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(b))
                .andExpect(jsonPath("$[1].id").value(a));
    }

    @Test
    void reorderBatch_unknownId_returns404AndRollsBackWholeBatch() throws Exception {
        String a = createTask("{\"title\":\"a\"}").get("id").asText(); // 1024
        String unknown = "99999999-9999-4999-8999-999999999999";

        mockMvc.perform(put("/api/v1/tasks/positions")
                        .contentType(APPLICATION_JSON)
                        .content("{\"positions\":[{\"id\":\"" + a + "\",\"position\":5000},"
                                + "{\"id\":\"" + unknown + "\",\"position\":6000}]}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/tasks/" + a))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.position").value(1024));
    }

    @Test
    void clearCompleted_returnsDeletedIds() throws Exception {
        String a = createTask("{\"title\":\"done 1\"}").get("id").asText();
        String b = createTask("{\"title\":\"done 2\"}").get("id").asText();
        String c = createTask("{\"title\":\"still active\"}").get("id").asText();
        mockMvc.perform(patch("/api/v1/tasks/" + a).contentType(APPLICATION_JSON)
                .content("{\"completed\":true}")).andExpect(status().isOk());
        mockMvc.perform(patch("/api/v1/tasks/" + b).contentType(APPLICATION_JSON)
                .content("{\"completed\":true}")).andExpect(status().isOk());

        JsonNode result = readBody(mockMvc.perform(post("/api/v1/tasks/clear-completed"))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(result.get("deletedIds")).hasSize(2);
        java.util.List<String> deleted = new java.util.ArrayList<>();
        result.get("deletedIds").forEach(node -> deleted.add(node.asText()));
        assertThat(deleted).containsExactlyInAnyOrder(a, b);

        mockMvc.perform(get("/api/v1/tasks"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(c));
    }

    @Test
    void list_filtersByStatusSearchAndTag() throws Exception {
        String tagId = createTag("{\"name\":\"work\"}").get("id").asText();
        String milk = createTask("{\"title\":\"Buy milk\",\"tagIds\":[\"" + tagId + "\"]}")
                .get("id").asText();
        String book = createTask("{\"title\":\"Read book\"}").get("id").asText();
        mockMvc.perform(patch("/api/v1/tasks/" + book).contentType(APPLICATION_JSON)
                .content("{\"completed\":true}")).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/tasks").param("status", "active"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(milk));

        mockMvc.perform(get("/api/v1/tasks").param("status", "completed"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(book));

        mockMvc.perform(get("/api/v1/tasks").param("search", "MILK"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(milk));

        mockMvc.perform(get("/api/v1/tasks").param("tagId", tagId))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(milk));

        mockMvc.perform(get("/api/v1/tasks").param("status", "bogus"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("status"));
    }

    @Test
    void tagIds_resolveOnCreateAndPatch_unknownTagIs400() throws Exception {
        String tagId = createTag("{\"name\":\"home\"}").get("id").asText();
        JsonNode created = createTask("{\"title\":\"tagged\",\"tagIds\":[\"" + tagId + "\"]}");
        String id = created.get("id").asText();
        java.time.Instant createdUpdatedAt = java.time.Instant.parse(created.get("updatedAt").asText());

        mockMvc.perform(get("/api/v1/tasks/" + id))
                .andExpect(jsonPath("$.tagIds[0]").value(tagId));

        String unknownTag = "88888888-8888-4888-8888-888888888888";
        mockMvc.perform(patch("/api/v1/tasks/" + id)
                        .contentType(APPLICATION_JSON)
                        .content("{\"tagIds\":[\"" + unknownTag + "\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("tagIds"));

        // clearing via empty array — a tagIds-only patch must also bump updatedAt
        // (join-table-only changes don't dirty the tasks row, so @PreUpdate alone
        // would leave the stale timestamp)
        Thread.sleep(20); // updatedAt has millisecond precision
        JsonNode cleared = readBody(mockMvc.perform(patch("/api/v1/tasks/" + id)
                        .contentType(APPLICATION_JSON)
                        .content("{\"tagIds\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tagIds").isEmpty())
                .andReturn());
        java.time.Instant clearedUpdatedAt = java.time.Instant.parse(cleared.get("updatedAt").asText());
        assertThat(clearedUpdatedAt).isAfter(createdUpdatedAt);
    }

    @Test
    void malformedJson_returns400ProblemJson() throws Exception {
        mockMvc.perform(post("/api/v1/tasks")
                        .contentType(APPLICATION_JSON)
                        .content("{\"title\": \"broken\""))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));

        mockMvc.perform(post("/api/v1/tasks")
                        .contentType(APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"priority\":\"URGENT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void frameworkErrors_keepTheirStatusCodes_neverMaskedAs500() throws Exception {
        // unknown path → 404
        mockMvc.perform(get("/api/v1/nonexistent"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(404));

        // wrong method → 405
        mockMvc.perform(put("/api/v1/tasks")
                        .contentType(APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(405));

        // unsupported media type → 415
        mockMvc.perform(post("/api/v1/tasks")
                        .contentType(org.springframework.http.MediaType.TEXT_PLAIN)
                        .content("not json"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(415));
    }

    @Test
    void reorderBatch_nullEntry_returns400NotServerError() throws Exception {
        mockMvc.perform(put("/api/v1/tasks/positions")
                        .contentType(APPLICATION_JSON)
                        .content("{\"positions\":[null]}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void search_treatsLikeWildcardsAsLiterals() throws Exception {
        String discount = createTask("{\"title\":\"50% off sale\"}").get("id").asText();
        createTask("{\"title\":\"plain title\"}");

        // '%' must match only the title that literally contains it (not act as a wildcard)
        mockMvc.perform(get("/api/v1/tasks").param("search", "%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(discount));

        // '_' must not match arbitrary single characters
        mockMvc.perform(get("/api/v1/tasks").param("search", "_"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}

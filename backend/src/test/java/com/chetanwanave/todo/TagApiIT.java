package com.chetanwanave.todo;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TagApiIT extends AbstractIntegrationTest {

    @Test
    void createAndListTags() throws Exception {
        JsonNode created = createTag("{\"name\":\"work\",\"color\":\"#5B5BD6\"}");
        assertThat(created.get("name").asText()).isEqualTo("work");
        assertThat(created.get("color").asText()).isEqualTo("#5B5BD6");
        assertThat(created.get("createdAt").asText()).isNotEmpty();

        mockMvc.perform(get("/api/v1/tags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("work"));
    }

    @Test
    void createTag_duplicateNameCaseInsensitive_returns409() throws Exception {
        createTag("{\"name\":\"Work\"}");
        mockMvc.perform(post("/api/v1/tags")
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"work\"}"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.title").value("Conflict"));
    }

    @Test
    void createTag_duplicateClientId_returns409() throws Exception {
        String id = "33333333-3333-4333-8333-333333333333";
        createTag("{\"id\":\"" + id + "\",\"name\":\"alpha\"}");
        mockMvc.perform(post("/api/v1/tags")
                        .contentType(APPLICATION_JSON)
                        .content("{\"id\":\"" + id + "\",\"name\":\"beta\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void createTag_invalidColor_returns400WithErrors() throws Exception {
        mockMvc.perform(post("/api/v1/tags")
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"bad\",\"color\":\"red\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("color"));
    }

    @Test
    void patchTag_renameAndColor_conflictAndNotFound() throws Exception {
        String a = createTag("{\"name\":\"alpha\"}").get("id").asText();
        createTag("{\"name\":\"beta\"}");

        mockMvc.perform(patch("/api/v1/tags/" + a)
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"gamma\",\"color\":\"#30A46C\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("gamma"))
                .andExpect(jsonPath("$.color").value("#30A46C"));

        // explicit null clears color
        mockMvc.perform(patch("/api/v1/tags/" + a)
                        .contentType(APPLICATION_JSON)
                        .content("{\"color\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.color").value((Object) null));

        // renaming to an existing name (case-insensitive) conflicts
        mockMvc.perform(patch("/api/v1/tags/" + a)
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"BETA\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(patch("/api/v1/tags/44444444-4444-4444-8444-444444444444")
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"x\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteTag_isIdempotentAndCascadesJoinRowsOnly() throws Exception {
        String tagId = createTag("{\"name\":\"todelete\"}").get("id").asText();
        String taskId = createTask("{\"title\":\"keeps living\",\"tagIds\":[\"" + tagId + "\"]}")
                .get("id").asText();

        mockMvc.perform(delete("/api/v1/tags/" + tagId)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/tags/" + tagId)).andExpect(status().isNoContent());

        // task survives, tag reference is gone
        mockMvc.perform(get("/api/v1/tasks/" + taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tagIds").isEmpty());
    }
}

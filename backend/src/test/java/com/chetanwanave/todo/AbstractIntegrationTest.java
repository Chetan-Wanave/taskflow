package com.chetanwanave.todo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * All integration tests run against a real MySQL 8.4 (Testcontainers) with the Flyway
 * schema applied — never H2. One container is shared via the cached Spring context.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfig.class)
public abstract class AbstractIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("DELETE FROM task_tags");
        jdbcTemplate.execute("DELETE FROM tasks");
        jdbcTemplate.execute("DELETE FROM tags");
    }

    protected JsonNode readBody(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    protected JsonNode createTask(String bodyJson) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/tasks")
                        .contentType(APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isCreated())
                .andReturn();
        return readBody(result);
    }

    protected JsonNode createTag(String bodyJson) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/tags")
                        .contentType(APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isCreated())
                .andReturn();
        return readBody(result);
    }
}

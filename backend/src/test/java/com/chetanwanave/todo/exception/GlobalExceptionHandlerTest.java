package com.chetanwanave.todo.exception;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The DB UNIQUE/FK backstop only trips on concurrent races (the service-level
 * pre-checks catch every single-request path deterministically, because Hibernate
 * auto-flushes pending rows before each check query). So the 409 mapping is
 * verified here through the MVC dispatch with a controller that throws exactly
 * what such a race produces at flush time.
 */
class GlobalExceptionHandlerTest {

    private static final String SQL_DETAIL =
            "could not execute statement [Duplicate entry 'work' for key 'tags.uq_tags_user_name']";

    private MockMvc mockMvc;

    @RestController
    static class ThrowingController {
        @PostMapping("/boom")
        String boom() {
            throw new DataIntegrityViolationException(SQL_DETAIL);
        }
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ThrowingController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void dataIntegrityViolation_mapsTo409ProblemJson_withoutLeakingSql() throws Exception {
        String body = mockMvc.perform(post("/boom"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.title").value("Conflict"))
                .andExpect(jsonPath("$.detail").value("Request conflicts with existing data"))
                .andExpect(jsonPath("$.errors").isEmpty())
                .andReturn().getResponse().getContentAsString();

        // The raw SQL/constraint message must never reach the client.
        assertThat(body).doesNotContain("Duplicate entry");
        assertThat(body).doesNotContain("uq_tags_user_name");
    }
}

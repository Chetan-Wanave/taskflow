package com.chetanwanave.todo;

import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Guards against the task→tags N+1: listing/exporting N tasks must not issue one
 * extra tag query per task. Counted via Hibernate statistics (JDBC statements
 * prepared per request), so a reintroduced lazy-load per task fails loudly.
 */
class TaskQueryCountIT extends AbstractIntegrationTest {

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private Statistics statistics;

    @BeforeEach
    void enableStatistics() {
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
    }

    @AfterEach
    void disableStatistics() {
        statistics.setStatisticsEnabled(false);
    }

    @Test
    void listTasks_fetchesTagsInSingleQuery_noNPlusOne() throws Exception {
        String tagA = createTag("{\"name\":\"alpha\"}").get("id").asText();
        String tagB = createTag("{\"name\":\"beta\"}").get("id").asText();
        createTask("{\"title\":\"one\",\"tagIds\":[\"" + tagA + "\",\"" + tagB + "\"]}"); // pos 1024
        createTask("{\"title\":\"two\",\"tagIds\":[\"" + tagA + "\"]}");                   // pos 2048
        createTask("{\"title\":\"three\"}");                                                // pos 3072

        statistics.clear();
        mockMvc.perform(get("/api/v1/tasks"))
                .andExpect(status().isOk())
                // fetch join must not duplicate the multi-tag task, and position order holds
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].title").value("one"))
                .andExpect(jsonPath("$[0].tagIds.length()").value(2))
                .andExpect(jsonPath("$[1].title").value("two"))
                .andExpect(jsonPath("$[2].title").value("three"));
        assertThat(statistics.getPrepareStatementCount())
                .as("GET /tasks with 3 tasks must run exactly 1 statement (was 1 + N)")
                .isEqualTo(1);
    }

    @Test
    void listTasks_tagFilter_stillReturnsFullTagSetInOneQuery() throws Exception {
        String tagA = createTag("{\"name\":\"alpha\"}").get("id").asText();
        String tagB = createTag("{\"name\":\"beta\"}").get("id").asText();
        createTask("{\"title\":\"both tags\",\"tagIds\":[\"" + tagA + "\",\"" + tagB + "\"]}");
        createTask("{\"title\":\"untagged\"}");

        statistics.clear();
        // filtering by tagA must not truncate the task's loaded tag set to just tagA
        mockMvc.perform(get("/api/v1/tasks").param("tagId", tagA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("both tags"))
                .andExpect(jsonPath("$[0].tagIds.length()").value(2));
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
    }

    @Test
    void export_fetchesTasksWithTagsAndTagsInTwoQueries() throws Exception {
        String tagA = createTag("{\"name\":\"alpha\"}").get("id").asText();
        createTask("{\"title\":\"one\",\"tagIds\":[\"" + tagA + "\"]}");
        createTask("{\"title\":\"two\",\"tagIds\":[\"" + tagA + "\"]}");
        createTask("{\"title\":\"three\"}");

        statistics.clear();
        mockMvc.perform(get("/api/v1/export"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks.length()").value(3))
                .andExpect(jsonPath("$.tasks[0].tagIds.length()").value(1))
                .andExpect(jsonPath("$.tags.length()").value(1));
        assertThat(statistics.getPrepareStatementCount())
                .as("export = 1 tasks-with-tags query + 1 tags query")
                .isEqualTo(2);
    }
}

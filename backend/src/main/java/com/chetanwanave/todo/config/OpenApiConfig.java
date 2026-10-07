package com.chetanwanave.todo.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI taskflowOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Taskflow API")
                .description("REST API for the Taskflow task manager (SPEC.md contract)")
                .version("v1"));
    }
}

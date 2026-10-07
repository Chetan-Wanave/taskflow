package com.chetanwanave.todo.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import org.openapitools.jackson.nullable.JsonNullableModule;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Configuration
public class JacksonConfig {

    @Bean
    public JsonNullableModule jsonNullableModule() {
        return new JsonNullableModule();
    }

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer instantMillisCustomizer() {
        return builder -> builder.serializerByType(Instant.class, new InstantMillisSerializer());
    }

    /**
     * The contract fixes timestamps to ISO-8601 UTC with exactly three fractional
     * digits ("2026-09-06T09:00:00.000Z"); Jackson's default drops trailing zeros.
     */
    static final class InstantMillisSerializer extends JsonSerializer<Instant> {

        private static final DateTimeFormatter ISO_MILLIS =
                DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

        @Override
        public void serialize(Instant value, JsonGenerator gen, SerializerProvider serializers)
                throws IOException {
            gen.writeString(ISO_MILLIS.format(value));
        }
    }
}

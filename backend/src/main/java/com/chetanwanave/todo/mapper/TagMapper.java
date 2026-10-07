package com.chetanwanave.todo.mapper;

import com.chetanwanave.todo.dto.TagResponse;
import com.chetanwanave.todo.entity.TagEntity;
import org.springframework.stereotype.Component;

@Component
public class TagMapper {

    public TagResponse toResponse(TagEntity tag) {
        return new TagResponse(
                tag.getId(),
                tag.getName(),
                tag.getColor(),
                tag.getCreatedAt());
    }
}

package com.chetanwanave.todo.repository;

import com.chetanwanave.todo.entity.TagEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends JpaRepository<TagEntity, String> {

    List<TagEntity> findByUserIdOrderByCreatedAtAscIdAsc(String userId);

    Optional<TagEntity> findByUserIdAndNameIgnoreCase(String userId, String name);
}

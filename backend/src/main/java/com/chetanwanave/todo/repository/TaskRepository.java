package com.chetanwanave.todo.repository;

import com.chetanwanave.todo.entity.TaskEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TaskRepository extends JpaRepository<TaskEntity, String> {

    // Export path: fetch tags with the tasks in one query (avoids N+1 per task).
    @EntityGraph(attributePaths = "tags")
    List<TaskEntity> findByUserIdOrderByPositionAsc(String userId);

    List<TaskEntity> findByUserIdAndCompletedAtIsNotNull(String userId);

    @Query("select max(t.position) from TaskEntity t where t.userId = :userId")
    Long findMaxPositionByUserId(@Param("userId") String userId);

    // 'left join fetch t.tags' loads each task's full tag set in the same query
    // (no N+1); the separate non-fetch 'filterTag' join exists only for the tagId
    // filter — filtering on the fetched alias would truncate the loaded collections.
    @Query("""
            select distinct t from TaskEntity t
            left join fetch t.tags
            left join t.tags filterTag
            where t.userId = :userId
              and (:status = 'all'
                   or (:status = 'active' and t.completedAt is null)
                   or (:status = 'completed' and t.completedAt is not null))
              and (:search is null or lower(t.title) like lower(concat('%', :search, '%')) escape '!')
              and (:tagId is null or filterTag.id = :tagId)
            order by t.position asc
            """)
    List<TaskEntity> findFiltered(@Param("userId") String userId,
                                  @Param("status") String status,
                                  @Param("search") String search,
                                  @Param("tagId") String tagId);
}

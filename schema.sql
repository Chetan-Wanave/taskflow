-- Canonical schema. Lives at backend/src/main/resources/db/migration/V1__init.sql
-- and as an identical checked-in copy at repo root: TODO/schema.sql
-- MySQL 8.x, InnoDB, utf8mb4.

CREATE TABLE users (
  id           CHAR(36)     NOT NULL,
  email        VARCHAR(255) NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tasks (
  id           CHAR(36)     NOT NULL,
  user_id      CHAR(36)     NOT NULL,
  parent_id    CHAR(36)     NULL,
  title        VARCHAR(500) NOT NULL,
  notes        TEXT         NULL,
  priority     VARCHAR(10)  NOT NULL DEFAULT 'NONE',
  due_date     DATE         NULL,
  completed_at DATETIME(3)  NULL,
  position     BIGINT       NOT NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_tasks_user     FOREIGN KEY (user_id)   REFERENCES users(id),
  CONSTRAINT fk_tasks_parent   FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('NONE','LOW','MEDIUM','HIGH')),
  KEY idx_tasks_user_position  (user_id, position),
  KEY idx_tasks_user_due       (user_id, due_date),
  KEY idx_tasks_user_completed (user_id, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tags (
  id         CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  name       VARCHAR(50) NOT NULL,
  color      CHAR(7)     NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_tags_user_name (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_tags (
  task_id CHAR(36) NOT NULL,
  tag_id  CHAR(36) NOT NULL,
  PRIMARY KEY (task_id, tag_id),
  CONSTRAINT fk_task_tags_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_tags_tag  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (id, email, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 'Local User');

-- Notes: tag-name case-insensitive uniqueness is satisfied by utf8mb4_0900_ai_ci on uq_tags_user_name.
-- All DATETIME(3) values are UTC (hibernate.jdbc.time_zone=UTC). due_date is DATE on purpose — never DATETIME.
-- Future (documented, NOT in V1): projects table + tasks.project_id; version BIGINT for optimistic locking.

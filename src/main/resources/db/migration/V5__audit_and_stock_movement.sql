-- V5: solo garantizar tablas si no existen. Nada de índices acá (ya están en V1 y V24).

CREATE TABLE IF NOT EXISTS audit_event (
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  timestamp        DATETIME(6) NOT NULL,
  actor_id         BIGINT NULL,
  actor_name       VARCHAR(200) NOT NULL,
  roles            VARCHAR(400) NULL,
  ip               VARCHAR(64) NULL,
  user_agent       VARCHAR(400) NULL,
  request_id       VARCHAR(64) NULL,
  action           VARCHAR(80)  NOT NULL,
  entity           VARCHAR(120) NOT NULL,
  entity_id        BIGINT NULL,
  status           VARCHAR(20)  NOT NULL,
  message          VARCHAR(500) NULL
);

CREATE TABLE IF NOT EXISTS audit_detail (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id   BIGINT NOT NULL,
  diff_json  LONGTEXT NULL,
  old_json   LONGTEXT NULL,
  new_json   LONGTEXT NULL,
  CONSTRAINT fk_auditdetail_event
    FOREIGN KEY (event_id) REFERENCES audit_event(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movement (
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  timestamp        DATETIME(6) NOT NULL,
  material_id      BIGINT NOT NULL,
  material_name    VARCHAR(300) NOT NULL,
  warehouse_id     BIGINT NOT NULL,
  warehouse_name   VARCHAR(200) NOT NULL,
  from_qty         DECIMAL(19,3) NOT NULL,
  to_qty           DECIMAL(19,3) NOT NULL,
  delta            DECIMAL(19,3) NOT NULL,
  reason           VARCHAR(40)  NOT NULL,
  source_type      VARCHAR(40)  NULL,
  source_id        BIGINT NULL,
  user_id          BIGINT NULL,
  user_name        VARCHAR(200) NULL,
  note             VARCHAR(500) NULL,
  request_id       VARCHAR(64) NULL
);

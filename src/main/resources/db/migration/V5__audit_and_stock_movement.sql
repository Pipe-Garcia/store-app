-- === AuditEvent / AuditDetail / StockMovement ================================

CREATE TABLE IF NOT EXISTS audit_event (
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  timestamp        DATETIME(6) NOT NULL,
  actor_id         BIGINT NULL,
  actor_name       VARCHAR(200) NOT NULL,
  roles            VARCHAR(400) NULL,
  ip               VARCHAR(64) NULL,
  user_agent       VARCHAR(400) NULL,
  request_id       VARCHAR(64) NULL,
  action           VARCHAR(80)  NOT NULL,          -- ej: SALE_CREATE, UPDATE, DELETE, DELIVERY_CREATE
  entity           VARCHAR(120) NOT NULL,          -- ej: Sale, Orders, StockReservation
  entity_id        BIGINT NULL,
  status           VARCHAR(20)  NOT NULL,          -- SUCCESS | FAIL
  message          VARCHAR(500) NULL
);

CREATE INDEX idx_audit_event_time ON audit_event (timestamp DESC);
CREATE INDEX idx_audit_event_entity ON audit_event (entity, entity_id);
CREATE INDEX idx_audit_event_actor  ON audit_event (actor_id);
CREATE INDEX idx_audit_event_action ON audit_event (action);
CREATE INDEX idx_audit_event_status ON audit_event (status);

CREATE TABLE IF NOT EXISTS audit_detail (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id   BIGINT NOT NULL,
  diff_json  LONGTEXT NULL,                        -- {field, old, new}[] ó JSON Patch
  old_json   LONGTEXT NULL,
  new_json   LONGTEXT NULL,
  CONSTRAINT fk_auditdetail_event
    FOREIGN KEY (event_id) REFERENCES audit_event(id)
    ON DELETE CASCADE
);

-- Histórico operativo de stock (lista plana, rápida para filtrar)
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
  reason           VARCHAR(40)  NOT NULL,          -- SALE | DELIVERY | RESERVATION | ADJUSTMENT | TRANSFER | PURCHASE ...
  source_type      VARCHAR(40)  NULL,              -- SALE | DELIVERY | ORDER | RESERVATION | PURCHASE | ADJUSTMENT
  source_id        BIGINT NULL,
  user_id          BIGINT NULL,
  user_name        VARCHAR(200) NULL,
  note             VARCHAR(500) NULL,
  request_id       VARCHAR(64) NULL
);

CREATE INDEX idx_stockmov_time         ON stock_movement (timestamp DESC);
CREATE INDEX idx_stockmov_mat          ON stock_movement (material_id);
CREATE INDEX idx_stockmov_wh           ON stock_movement (warehouse_id);
CREATE INDEX idx_stockmov_reason       ON stock_movement (reason);
CREATE INDEX idx_stockmov_source       ON stock_movement (source_type, source_id);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  business_date DATE NOT NULL,
  status        VARCHAR(16) NOT NULL,
  opened_at     DATETIME NOT NULL,
  opened_by     VARCHAR(100) NOT NULL,
  opening_cash  DECIMAL(19,2) NOT NULL DEFAULT 0,

  closed_at     DATETIME NULL,
  closed_by     VARCHAR(100) NULL,
  counted_cash  DECIMAL(19,2) NULL,
  system_cash   DECIMAL(19,2) NULL,
  difference_cash DECIMAL(19,2) NULL,

  note          VARCHAR(500) NULL
);

CREATE INDEX idx_cash_sessions_date ON cash_sessions(business_date);
CREATE INDEX idx_cash_sessions_status ON cash_sessions(status);

CREATE TABLE IF NOT EXISTS cash_movements (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id    BIGINT NOT NULL,
  business_date DATE NOT NULL,
  ts            DATETIME NOT NULL,

  direction     VARCHAR(8) NOT NULL,   -- IN / OUT
  amount        DECIMAL(19,2) NOT NULL,

  method        VARCHAR(40) NOT NULL,  -- CASH / TRANSFER / CARD / OTHER
  reason        VARCHAR(40) NOT NULL,  -- SALE_PAYMENT (por ahora)
  source_type   VARCHAR(40) NULL,      -- Sale / Purchase / Manual
  source_id     BIGINT NULL,

  user_name     VARCHAR(100) NULL,
  note          VARCHAR(500) NULL,

  CONSTRAINT fk_cash_movements_session
    FOREIGN KEY (session_id) REFERENCES cash_sessions(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_cash_mov_date ON cash_movements(business_date);
CREATE INDEX idx_cash_mov_ts ON cash_movements(ts);
CREATE INDEX idx_cash_mov_method ON cash_movements(method);
CREATE INDEX idx_cash_mov_reason ON cash_movements(reason);
CREATE INDEX idx_cash_mov_dir ON cash_movements(direction);
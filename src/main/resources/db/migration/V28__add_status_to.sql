-- V28__add_status_to_sale.sql
-- Agrega el campo 'status' a la tabla de ventas.

ALTER TABLE sale
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- Por seguridad, si hubiera filas con NULL por algún motivo:
UPDATE sale
SET status = 'ACTIVE'
WHERE status IS NULL;
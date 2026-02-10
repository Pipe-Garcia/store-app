-- V30__add_status_to_purchase.sql
-- Agrega el campo 'status' a la tabla purchase.

ALTER TABLE purchase
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

UPDATE purchase
SET status = 'ACTIVE'
WHERE status IS NULL;
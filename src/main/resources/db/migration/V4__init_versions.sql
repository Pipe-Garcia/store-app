-- V4__init_versions.sql

-- Stock Reservation
UPDATE stock_reservation SET version = 0 WHERE version IS NULL;
ALTER TABLE stock_reservation MODIFY COLUMN version BIGINT NOT NULL DEFAULT 0;

-- Delivery
UPDATE delivery SET version = 0 WHERE version IS NULL;
ALTER TABLE delivery MODIFY COLUMN version BIGINT NOT NULL DEFAULT 0;

-- Delivery Item
UPDATE delivery_item SET version = 0 WHERE version IS NULL;
ALTER TABLE delivery_item MODIFY COLUMN version BIGINT NOT NULL DEFAULT 0;

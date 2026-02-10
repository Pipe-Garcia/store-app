-- V31__add_warehouse_to_purchase_detail.sql
-- Permite guardar el depósito por detalle de compra (para poder revertir stock al anular).

ALTER TABLE purchase_detail
  ADD COLUMN warehouse_id BIGINT NULL,
  ADD CONSTRAINT fk_purchase_detail_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES warehouse (id_warehouse);
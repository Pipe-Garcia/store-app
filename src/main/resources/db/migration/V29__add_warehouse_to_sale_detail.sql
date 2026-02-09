-- V29__add_warehouse_to_sale_detail.sql
ALTER TABLE sale_detail
  ADD COLUMN warehouse_id BIGINT NULL,
  ADD CONSTRAINT fk_sale_detail_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES warehouse (id_warehouse);
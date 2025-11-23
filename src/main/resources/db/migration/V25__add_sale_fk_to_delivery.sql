-- V25__add_sale_fk_to_delivery.sql
-- Añade la FK desde delivery hacia sale para soportar Delivery.sale

ALTER TABLE delivery
    ADD COLUMN sale_id BIGINT NULL;

ALTER TABLE delivery
    ADD CONSTRAINT fk_delivery_sale
        FOREIGN KEY (sale_id) REFERENCES sale(id_sale);
